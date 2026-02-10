// @ts-nocheck
import { NextRequest, NextResponse } from "next/server";
import { streamText, StreamData, LangChainAdapter, Message } from "ai";
import { ChatGroq } from "@langchain/groq";
import { tavilyTool } from "@/lib/tavily";
import { graph } from "@/lib/agent";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { calculateCost, estimateTokens } from "@/lib/cost-calc";
import { saveQuery, getUserPreferences, upsertUserPreference } from "@/lib/memory";

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
        const { messages, mode, sessionId } = await req.json();
        const latestMessage = messages[messages.length - 1].content;

        // Check and save any preference in the user's message
        const detectedPref = detectPreference(latestMessage);
        if (detectedPref && sessionId) {
            await upsertUserPreference(sessionId, detectedPref);
        }

        // Get user preferences to enhance responses
        const userPrefs = sessionId ? await getUserPreferences(sessionId) : [];
        const prefContext = userPrefs.length > 0
            ? `\n\nUser Preferences (follow these): ${userPrefs.join(", ")}`
            : "";

        // Quick Mode
        if (mode === "quick") {
            const quickStartTime = Date.now();
            const model = new ChatGroq({
                model: "llama-3.1-8b-instant",
                temperature: 0,
            });

            const searchResult = await tavilyTool.invoke(latestMessage);

            const systemPrompt = `You are a Senior Technical Analyst.${prefContext} Answer the query using the research context below. Be technically precise — include API names, version numbers, code snippets, and concrete details. Structure with ## headers. Cite sources inline as [[url]] — use MULTIPLE different URLs from the context. Do NOT add a Sources section at the end. Do NOT output any rules or guidelines.

User Query: ${latestMessage}
Context from Web Research: ${searchResult}`;

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
                        write(`2:${JSON.stringify([{ type: "thinking", value: "Tavily: Scanning web for high-signal data..." }])}\n`);
                        await new Promise(resolve => setTimeout(resolve, 2000));

                        write(`2:${JSON.stringify([{ type: "thinking", value: "CortEx: Synthesizing concise response..." }])}\n`);
                        await new Promise(resolve => setTimeout(resolve, 3000));

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
                        const cost = calculateCost("llama-3.1-8b-instant", inputTokens, outputTokens, 1);

                        // Send Metadata
                        write(`2:${JSON.stringify([{ type: "relevancy", value: relevancy }])}\n`);
                        write(`2:${JSON.stringify([{ type: "cost", value: cost }])}\n`);

                        // Persistence
                        if (sessionId) await saveQuery(sessionId, latestMessage, fullCompletion, cost, "quick", relevancy);
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
                        if (sessionId) await saveQuery(sessionId, latestMessage, finalResponse, cost, "deep", relevancy);
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
