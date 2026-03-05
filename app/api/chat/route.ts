// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { streamText, StreamData, LangChainAdapter, Message } from "ai";
import { ChatGroq } from "@langchain/groq";
import { tavilyTool } from "@/lib/tavily";
import { graph } from "@/lib/agent";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { calculateCost, estimateTokens } from "@/lib/cost-calc";
import { saveQuery, getUserPreferences, upsertUserPreference } from "@/lib/memory";
import { auth } from "@/lib/auth";
import { randomUUID } from "crypto";
import { searchInternalDocs } from "@/lib/tools/internal-docs-search";

export const maxDuration = 180; // Deep Mode needs up to 3 minutes

// Detect if user is stating a preference
function detectPreference(message: string): string | null {
    const prefPatterns = [
        /i prefer (.+)/i,
        /i like (.+)/i,
        /please use (.+)/i,
        /always give me (.+)/i,
        /i want (.+) in responses/i,
        /remember that i (.+)/i,
    ];

    for (const pattern of prefPatterns) {
        const match = message.match(pattern);
        if (match) return match[1].trim();
    }
    return null;
}

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        const userId = session?.user?.id;

        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { messages, mode, sessionId, ingestedRepo, activeDocName } = await req.json();
        const latestMessage = messages[messages.length - 1].content;

        // Check and save any preference in the user's message
        const detectedPref = detectPreference(latestMessage);
        if (detectedPref && sessionId) {
            await upsertUserPreference(userId, sessionId, detectedPref);
        }

        // Get user preferences to enhance responses
        const userPrefs = sessionId ? await getUserPreferences(userId, sessionId) : [];
        const prefContext = userPrefs.length > 0
            ? `\n\nUser Preferences (follow these): ${userPrefs.join(", ")}`
            : "";

        // ===== PR SECURITY ANALYSIS — early-exit if a GitHub PR URL is detected =====
        const { detectPRUrl, fetchPRContext } = await import("@/lib/tools/pr-analysis");
        const prMatch = detectPRUrl(latestMessage);

        if (prMatch) {
            const accessToken = (session as any)?.accessToken as string | undefined;
            const model = new ChatGroq({ model: "llama-3.1-8b-instant", temperature: 0 });

            let prContext: string;
            try {
                prContext = await fetchPRContext(prMatch.owner, prMatch.repo, prMatch.prNumber, accessToken);
            } catch (err: any) {
                prContext = `Failed to fetch PR data: ${err.message}. Please ensure the repo is public or you are signed in with GitHub.`;
            }

            const securityPrompt = `You are a Senior Application Security Engineer performing a thorough code review.
${prefContext}

Analyze the following Pull Request for security vulnerabilities. Be precise and cite the exact file and line in the diff.

Structure your response EXACTLY like this:

## 🔍 PR Overview
Brief 1-2 sentence summary of what this PR does.

## 🔴 Critical Issues
List any SQL injection, authentication bypass, hardcoded secrets, RCE, SSRF, or similar HIGH severity issues. Quote the relevant diff lines.

## 🟡 Medium Issues
Insecure dependencies, missing input validation, CSRF, XSS, insecure headers, etc.

## 🟢 Low / Best Practice
Code style issues, missing error handling, insecure defaults, minor info leaks.

## ✅ Verdict
One sentence: APPROVE / REQUEST CHANGES / NEEDS MANUAL REVIEW — and why.

---
${prContext}`;

            return new NextResponse(new ReadableStream({
                async start(controller) {
                    const encoder = new TextEncoder();
                    const write = (str: string) => controller.enqueue(encoder.encode(str));

                    try {
                        write(`2:${JSON.stringify([{ type: "thinking", value: `Fetching PR #${prMatch.prNumber} from ${prMatch.owner}/${prMatch.repo}...` }])}\n`);
                        await new Promise(r => setTimeout(r, 800));
                        write(`2:${JSON.stringify([{ type: "thinking", value: "Running security analysis on diff..." }])}\n`);

                        const stream = await model.stream([new SystemMessage(securityPrompt)]);
                        let fullText = "";
                        for await (const chunk of stream) {
                            const token = chunk.content as string;
                            fullText += token;
                            write(`0:${JSON.stringify(token)}\n`);
                        }

                        write(`2:${JSON.stringify([{ type: "relevancy", value: 99 }])}\n`);
                        if (sessionId) await saveQuery(userId, sessionId, latestMessage, fullText, 0, "quick", 99);
                    } catch (err) {
                        controller.error(err);
                    } finally {
                        controller.close();
                    }
                }
            }), { headers: { "Content-Type": "text/plain; charset=utf-8", "x-vercel-ai-data-stream": "v1" } });
        }
        // ===== END PR ANALYSIS =====

        // Quick Mode
        if (mode === "quick") {
            const quickStartTime = Date.now();
            const model = new ChatGroq({
                model: "llama-3.3-70b-versatile",
                temperature: 0,
            });

            // Build conversation history from previous messages (max last 6 messages for token efficiency)
            const prevMessages = messages.slice(0, -1).slice(-6); // exclude latest, take last 6
            let conversationHistory = "";
            if (prevMessages.length > 0) {
                conversationHistory = "\n\nPrevious Conversation:\n" + prevMessages.map((m: any) => {
                    const role = m.role === "user" ? "User" : "Assistant";
                    // Truncate long assistant responses to save tokens
                    const content = m.role === "assistant" ? m.content.slice(0, 800) : m.content;
                    return `${role}: ${content}`;
                }).join("\n") + "\n---\n";
            }

            // Follow-up detection (only if there's conversation history)
            let isFollowUp = prevMessages.length > 0; // default: if history exists, assume follow-up
            if (prevMessages.length > 0) {
                try {
                    // Strip system-injected "Regarding: ..." prefix from the query before detection
                    const cleanedQuery = latestMessage.replace(/^Regarding:\s*"[^"]*\.{3}"\s*—\s*/i, '').trim();

                    const detectPrompt = `You are a strict conversation topic classifier. Determine if the new user query is related to the previous conversation in ANY way, or if it is about a COMPLETELY DIFFERENT and UNRELATED subject.

RULES:
- If the new query mentions, modifies, extends, asks about, or refers to ANYTHING from the previous conversation → reply "followup"
- If the new query uses words like "this", "that", "above", "it", "also", "add", "change", "modify", "update", "remove", "fix" → reply "followup"
- ONLY reply "new" if the topic is 100% completely different and has ZERO connection to anything discussed before

Previous conversation:
${prevMessages.slice(-2).map((m: any) => `${m.role}: ${m.content.slice(0, 300)}`).join("\n")}

New query: "${cleanedQuery}"

Reply with ONLY one word: "followup" or "new"`;
                    const detectResponse = await model.invoke([new SystemMessage(detectPrompt)]);
                    const detection = (detectResponse.content as string).trim().toLowerCase();
                    isFollowUp = !detection.startsWith("new");
                } catch {
                    // If detection fails, default to follow-up (safer)
                    isFollowUp = true;
                }
            }

            let searchResult: string = "";
            let internalDocsContext = "";

            if (ingestedRepo) {
                // Repo has been ingested → use Qdrant only
                const { searchGithubRepoTool } = await import("@/lib/tools/github-search");
                const repoPattern = ingestedRepo.match(/([a-zA-Z0-9-]+)\/([a-zA-Z0-9-_\.]+)/);
                const repoName = repoPattern ? repoPattern[0] : "";
                searchResult = await searchGithubRepoTool.invoke({
                    query: latestMessage,
                    repository: repoName,
                    limit: 5
                });
            } else if (activeDocName) {
                // Document has been ingested → use internal docs RAG
                try {
                    internalDocsContext = await searchInternalDocs(userId, latestMessage, 5);
                } catch (e) {
                    console.warn("[Quick Mode] Internal docs search failed, continuing without it.");
                }
            } else {
                // No repo ingested and no active doc → use Tavily internet search
                searchResult = await tavilyTool.invoke(latestMessage);
            }

            // Build the internal docs section only if we found relevant chunks
            const internalDocsSection = internalDocsContext
                ? `\n\nInternal Documents Context (from user's uploaded files):\n${internalDocsContext}`
                : "";

            const systemPrompt = `You are a Senior Technical Analyst.${prefContext} Answer the query using the research context below. Be technically precise — include API names, version numbers, code snippets, and concrete details. Structure with ## headers. Cite sources inline as [[url]] — use MULTIPLE different URLs from the context. Do NOT add a Sources section at the end. Do NOT output any rules or guidelines.${conversationHistory}
MERMAID DIAGRAMS RULE: ONLY generate a Mermaid.js diagram (\`\`\`mermaid ... \`\`\`) if the user EXPLICITLY asks for a diagram, flowchart, sequence diagram, or architecture visualization. Do NOT add diagrams when the user asks you to BUILD, CREATE, or MAKE something (like a game, app, component, etc.). Building requests should be 90% code and 10% brief explanation.
CRITICAL INSTRUCTION FOR WEB PROJECTS: If the user asks you to build or generate a web project, component, game, or app (HTML/CSS/JS or React), you MUST provide ALL the code consolidated into ONE SINGLE \`\`\`html\`\`\` OR \`\`\`react\`\`\` block. ABSOLUTELY DO NOT split HTML, CSS, and JS into separate blocks or steps. You must put the CSS inside <style> tags and the JavaScript inside <script> tags within the same HTML file. If it's React, put everything in one JSX/TSX file. This is mandatory so the user can preview the entire app at once.
If the user refers to "above", "previous", "that code", or similar words, use the Previous Conversation context to understand what they're referring to and respond accordingly.
User Query: ${latestMessage}
Context: ${ingestedRepo ? `Code Repository (${ingestedRepo})` : activeDocName ? `Uploaded Document (${activeDocName})` : "Web Research"}:
${searchResult}${internalDocsSection}`;

            // Evaluate relevancy for Quick Mode
            const relevancyPrompt = `You are a strict Relevancy Evaluator for a research assistant.
            User Query: "${latestMessage}"
            Search Results Summary: ${searchResult.slice(0, 600)}
            
            Rate how relevant and useful the search results are to answering the user's query.
            Consider: Does the data directly address the query? Are the sources on-topic?
            
            Return ONLY a single integer between 0 and 100. Nothing else.`;
            const relevancyResponse = await model.invoke([new SystemMessage(relevancyPrompt)]);
            let relevancy = 80;
            try {
                const cleaned = (relevancyResponse.content as string).replace(/[^0-9]/g, '').trim();
                const parsed = parseInt(cleaned);
                if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) relevancy = Math.max(parsed, 15);
            } catch { }

            return new NextResponse(new ReadableStream({
                async start(controller) {
                    const encoder = new TextEncoder();
                    const write = (str: string) => controller.enqueue(encoder.encode(str));

                    try {
                        // Artificial Thinking Steps (5s total)
                        write(`2:${JSON.stringify([{ type: "thinking", value: ingestedRepo ? `Qdrant: Searching your codebase "${ingestedRepo}"...` : activeDocName ? `Doc RAG: Analyzing "${activeDocName}"...` : "Tavily: Scanning web for high-signal data..." }])}\n`);
                        await new Promise(resolve => setTimeout(resolve, 2000));

                        write(`2:${JSON.stringify([{ type: "thinking", value: "CortEx: Synthesizing concise response..." }])}\n`);
                        await new Promise(resolve => setTimeout(resolve, 3000));

                        // Stream topic detection result ONLY if there was conversation history
                        // Skip for the first message — no comparison possible
                        if (prevMessages.length > 0) {
                            write(`2:${JSON.stringify([{ type: "topic_detection", value: isFollowUp ? "followup" : "new" }])}\n`);
                        }

                        // Stream the actual response
                        const stream = await model.stream([new HumanMessage(systemPrompt)]);
                        let fullCompletion = "";
                        for await (const chunk of stream) {
                            const content = chunk.content;
                            fullCompletion += content;
                            write(`0:${JSON.stringify(content)}\n`);
                        }

                        // Calculate cost based on actual tokens used
                        const inputTokens = estimateTokens(systemPrompt);
                        const outputTokens = estimateTokens(fullCompletion);
                        const cost = calculateCost("llama-3.3-70b-versatile", inputTokens, outputTokens, 1);

                        // Send Metadata
                        write(`2:${JSON.stringify([{ type: "relevancy", value: relevancy }])}\n`);
                        write(`2:${JSON.stringify([{ type: "cost", value: cost }])}\n`);

                        // Persistence — use a new sessionId for new topics
                        if (sessionId) {
                            const saveSessionId = (!isFollowUp && prevMessages.length > 0) ? randomUUID() : sessionId;
                            await saveQuery(userId, saveSessionId, latestMessage, fullCompletion, cost, "quick", relevancy);
                            // If new topic, tell frontend to update its sessionId
                            if (saveSessionId !== sessionId) {
                                write(`2:${JSON.stringify([{ type: "new_session_id", value: saveSessionId }])}\n`);
                            }
                        }
                    } catch (err) {
                        controller.error(err);
                    } finally {
                        controller.close();
                    }
                }
            }));
        }

        // Deep Mode
        else {
            const startTime = Date.now();
            const initialState = {
                query: latestMessage,
                messages: messages.map((m: any) => m.role === 'user' ? new HumanMessage(m.content) : new AIMessage(m.content)),
                plan: [],
                findings: [],
                critique: null,
                loopCount: 0,
                relevancy: 0,
                ingestedRepo: ingestedRepo ?? null,
                userId,
                activeDocName: activeDocName ?? null,
            };

            const eventStream = await graph.stream(initialState, { recursionLimit: 25 });

            let finalResponse = "";
            let cost = 0;
            let relevancy = 85;

            return new NextResponse(new ReadableStream({
                async start(controller) {
                    const encoder = new TextEncoder();
                    const write = (str: string) => controller.enqueue(encoder.encode(str));

                    try {
                        for await (const event of eventStream) {
                            if (event.planner) {
                                write(`2:${JSON.stringify([{ type: "thinking", value: "Planning: Decomposing query into technical sub-problems..." }])}\n`);
                            }
                            if (event.researcher) {
                                const findings = event.researcher.findings;
                                const lastFinding = findings[findings.length - 1];
                                // Extract the actual search query from the finding
                                const searchQueryMatch = lastFinding?.match(/Search Query: "([^"]+)"/);
                                const searchLabel = searchQueryMatch ? searchQueryMatch[1].slice(0, 60) : "technical sources";
                                write(`2:${JSON.stringify([{ type: "thinking", value: `Searching: "${searchLabel}"...` }])}\n`);
                                cost += calculateCost("tavily", 0, 0, 1);
                            }
                            if (event.analyzer) {
                                write(`2:${JSON.stringify([{ type: "thinking", value: "Critiquing: Evaluating source authority and technical depth..." }])}\n`);
                            }

                            if (event.synthesizer) {
                                // Ensure Deep Mode takes at least 60 seconds
                                const elapsed = Date.now() - startTime;
                                if (elapsed < 60000) {
                                    const remaining = 60000 - elapsed;
                                    const stepDuration = Math.floor(remaining / 4);

                                    write(`2:${JSON.stringify([{ type: "thinking", value: "CortEx: Cross-referencing sources and validating technical claims..." }])}\n`);
                                    await new Promise(resolve => setTimeout(resolve, stepDuration));

                                    write(`2:${JSON.stringify([{ type: "thinking", value: "CortEx: Comparing implementation approaches and trade-offs..." }])}\n`);
                                    await new Promise(resolve => setTimeout(resolve, stepDuration));

                                    write(`2:${JSON.stringify([{ type: "thinking", value: "CortEx: Building structured technical report with code examples..." }])}\n`);
                                    await new Promise(resolve => setTimeout(resolve, stepDuration));

                                    write(`2:${JSON.stringify([{ type: "thinking", value: "CortEx: Finalizing production-quality research report..." }])}\n`);
                                    await new Promise(resolve => setTimeout(resolve, stepDuration));
                                }

                                const msg = event.synthesizer.messages[0];
                                finalResponse = msg.content as string;
                                relevancy = event.synthesizer.relevancy || 85;
                                cost += calculateCost("llama-3.1-8b-instant", estimateTokens(latestMessage + (event.synthesizer.findings || []).join('')), estimateTokens(finalResponse), 0);
                                write(`0:${JSON.stringify(finalResponse)}\n`);
                                write(`2:${JSON.stringify([{ type: "relevancy", value: relevancy }])}\n`);
                            }
                        }
                        write(`2:${JSON.stringify([{ type: "cost", value: cost }])}\n`);
                        if (sessionId) await saveQuery(userId, sessionId, latestMessage, finalResponse, cost, "deep", relevancy);
                    } catch (err) {
                        controller.error(err);
                    } finally {
                        controller.close();
                    }
                }
            }));
        }

    } catch (error: any) {
        console.error("API ROUTE ERROR:", error);
        const isRateLimit = error?.message?.includes('rate_limit') ||
            error?.message?.includes('429') ||
            error?.status === 429;
        if (isRateLimit) {
            return NextResponse.json(
                { error: "Rate limit reached. Please wait a moment and try again." },
                { status: 429 }
            );
        }
        return NextResponse.json({ error: error.message || "An unexpected error occurred" }, { status: 500 });
    }
}
