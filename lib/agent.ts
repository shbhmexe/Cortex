// @ts-nocheck
import { tavilyTool } from "@/lib/tavily";
import { searchGithubRepoTool } from "@/lib/tools/github-search";
import { searchInternalDocs } from "@/lib/tools/internal-docs-search";
import { ChatGroq } from "@langchain/groq";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage, SystemMessage, AIMessage, BaseMessage } from "@langchain/core/messages";
import { StateGraph, END, Annotation, START } from "@langchain/langgraph";
import { RunnableConfig } from "@langchain/core/runnables";

// Define the State using Annotation
const AgentState = Annotation.Root({
    messages: Annotation<BaseMessage[]>({
        reducer: (x, y) => x.concat(y),
        default: () => [],
    }),
    query: Annotation<string>({
        reducer: (x, y) => y ?? x,
        default: () => "",
    }),
    plan: Annotation<string[]>({
        reducer: (x, y) => y ?? x,
        default: () => [],
    }),
    findings: Annotation<string[]>({
        reducer: (x, y) => x.concat(y),
        default: () => [],
    }),
    critique: Annotation<string | null>({
        reducer: (x, y) => y,
        default: () => null,
    }),
    loopCount: Annotation<number>({
        reducer: (x, y) => y ?? x,
        default: () => 0,
    }),
    relevancy: Annotation<number>({
        reducer: (x, y) => y ?? x,
        default: () => 0,
    }),
    ingestedRepo: Annotation<string | null>({
        reducer: (x, y) => y ?? x,
        default: () => null,
    }),
    userId: Annotation<string>({
        reducer: (x, y) => y ?? x,
        default: () => "",
    }),
    activeDocName: Annotation<string | null>({
        reducer: (x, y) => y ?? x,
        default: () => null,
    }),
    modelName: Annotation<string>({
        reducer: (x, y) => y ?? x,
        default: () => "llama-3.3-70b-versatile",
    }),
});

// Tools
const tools = [tavilyTool, searchGithubRepoTool];

// Retry wrapper for rate limits, dynamically instantiates model with fallbacks
async function callWithRetry(messages: any[], modelName: string, maxRetries = 3): Promise<any> {
    let primaryModel;
    let fallbackModel;

    if (modelName.startsWith("gemini")) {
        primaryModel = new ChatGoogleGenerativeAI({
            model: modelName,
            temperature: 0,
            maxOutputTokens: 8192,
            apiKey: process.env.GOOGLE_API_KEY || "AIzaSy_fake_key_to_prevent_crash",
        });
        fallbackModel = new ChatGroq({
            model: "llama-3.3-70b-versatile",
            temperature: 0,
        });
    } else {
        primaryModel = new ChatGroq({
            model: modelName,
            temperature: 0,
        });
        fallbackModel = new ChatGoogleGenerativeAI({
            model: "gemini-2.0-flash",
            temperature: 0,
            maxOutputTokens: 8192,
            apiKey: process.env.GOOGLE_API_KEY || "AIzaSy_fake_key_to_prevent_crash",
        });
    }

    const model = primaryModel.withFallbacks({
        fallbacks: [fallbackModel],
    });

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await model.invoke(messages);
        } catch (error: any) {
            const isRateLimit = error?.message?.includes('rate_limit') ||
                error?.message?.includes('429') ||
                error?.status === 429 ||
                error?.message?.includes('429 Too Many Requests');
            if (isRateLimit && attempt < maxRetries - 1) {
                const delay = (attempt + 1) * 5000; // 5s, 10s, 15s
                console.log(`Rate limited. Retrying in ${delay / 1000}s (attempt ${attempt + 1}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                throw error;
            }
        }
    }
}
// Nodes

async function planNode(state: typeof AgentState.State) {
    const { query } = state;
    const prompt = `You are a Senior Research Engineer and Technical Architect.
  Your task is to break down a user's technical query into a structured, multi-step research plan.
  
  For the following query, produce a research plan that covers these dimensions:
  1. Core Concepts — What technical foundations need to be understood?
  2. Implementation Patterns — What code patterns, APIs, or frameworks are relevant?
  3. Architecture & Trade-offs — What architectural decisions and trade-offs exist?
  4. Production Considerations — Scalability, security, performance, deployment concerns?
  5. Comparative Analysis — What alternative approaches exist and how do they compare?
  
  Query: "${query}"
  
  Return ONLY a JSON array of specific search queries (strings) that will gather the information needed.
  Each query should target documentation, research papers, engineering blogs, or code repositories.
  Generate 4-6 targeted search queries. Example format:
  ["Next.js App Router architecture patterns", "React Server Components vs Client Components performance benchmarks", ...]`;

    const { modelName } = state;
    const response = await callWithRetry([new SystemMessage(prompt), new HumanMessage(query)], modelName);
    let plan: string[] = [];
    try {
        const cleanContent = (response.content as string).replace(/```json|```/g, "").trim();
        plan = JSON.parse(cleanContent);
    } catch (e) {
        plan = [query];
    }

    return { plan, loopCount: 0, findings: [] };
}

async function researchNode(state: typeof AgentState.State, config?: RunnableConfig) {
    const { plan, findings, loopCount, query: originalQuery, ingestedRepo, userId, activeDocName } = state;

    const context = findings.join("\n\n");
    const prompt = `You are a Senior Research Engineer performing targeted technical research.
    
    Research Plan: ${JSON.stringify(plan)}
    Existing Findings (${findings.length} sources gathered so far): ${context.slice(0, 2000)}
    Current Loop: ${loopCount + 1}
    
    Based on the plan and what has already been found, generate the NEXT most important search query.
    Return ONLY the search query string, nothing else.`;

    const { modelName } = state;
    const searchQueryMsg = await callWithRetry([new SystemMessage(prompt)], modelName);
    const searchQuery = searchQueryMsg.content as string;

    let searchResults = "";
    let internalDocsResults = "";

    if (ingestedRepo) {
        // User has an ingested repo → use Qdrant ONLY
        const repoPattern = ingestedRepo.match(/([a-zA-Z0-9-]+)\/([a-zA-Z0-9-_\.]+)/);
        const repoName = repoPattern ? repoPattern[0] : "";
        console.log(`[Agent] Qdrant only. Repo: "${repoName}". Query: "${searchQuery}"`);
        searchResults = await searchGithubRepoTool.invoke({
            query: searchQuery || originalQuery,
            repository: repoName,
            limit: 4
        });
    } else if (userId && activeDocName) {
        // User has an active document → use Internal Docs ONLY
        console.log(`[Agent] Internal docs only. Doc: "${activeDocName}". Query: "${searchQuery}"`);
        try {
            internalDocsResults = await searchInternalDocs(userId, searchQuery || originalQuery, 3);
        } catch (e) {
            console.warn("[Agent] Internal docs search failed, continuing without it.");
        }
    } else {
        // No ingested repo + no active doc → use Tavily ONLY
        console.log(`[Agent] Tavily only. Query: "${searchQuery}"`);
        searchResults = await tavilyTool.invoke(searchQuery);
    }

    const combinedResults = internalDocsResults
        ? `${searchResults}\n\n--- Internal Documents ---\n${internalDocsResults}`
        : searchResults;

    return {
        findings: [`Search Query: "${searchQuery}"\nResults: ${combinedResults}`],
        loopCount: loopCount + 1
    };
}


async function critiqueNode(state: typeof AgentState.State) {
    const { query, findings, loopCount } = state;

    // Allow 2 research loops to stay within token limits
    if (loopCount >= 2 || findings.length >= 3) {
        return { critique: null };
    }

    const prompt = `You are a Technical Quality Gate for a Deep Research Agent.
    
    User Query: ${query}
    Current Findings (${findings.length} sources): ${findings.slice(0, 3).map(f => f.slice(0, 300)).join("\n---\n")}
    Loop Count: ${loopCount}/2
    
    Evaluate the findings against these criteria:
    1. Source Authority — Are sources from official docs, reputable engineering blogs, or verified repos?
    2. Technical Depth — Do findings include code examples, architecture details, or implementation patterns?
    3. Coverage — Do findings cover multiple perspectives (trade-offs, alternatives, best practices)?
    4. Practicality — Can an engineer act on these findings to make implementation decisions?
    
    If we have fewer than 2 findings OR findings lack code examples OR lack authoritative sources:
      Return "more_research_needed"
    If findings are technically deep, well-sourced, and cover multiple angles:
      Return "sufficient"`;

    const { modelName } = state;
    const response = await callWithRetry([new SystemMessage(prompt)], modelName);
    const content = (response.content as string).toLowerCase();

    const decision = (content.includes("sufficient") && findings.length >= 3) ? null : "needs_research";

    return { critique: decision };
}

async function synthesizeNode(state: typeof AgentState.State) {
    const { query, findings } = state;

    const prompt = `INSTRUCTIONS (do NOT include these instructions in your output):
You are writing a technical report. Use ONLY the research findings below. Cite sources inline using [[url]] format. Use MULTIPLE different source URLs throughout your report — do not rely on just one source.

User Query: "${query}"

Research Findings:
${findings.map(f => f.slice(0, 1000)).join("\n\n---\n\n")}

Write your report using this EXACT structure. Start directly with the first header. Do NOT output any instructions, rules, or guidelines — only the report itself.
MERMAID DIAGRAMS RULE: ONLY generate a Mermaid.js diagram (\`\`\`mermaid ... \`\`\`) if the user EXPLICITLY asks for a diagram, flowchart, sequence diagram, or architecture visualization. Do NOT add diagrams when the user asks you to BUILD, CREATE, or MAKE something.
CRITICAL MERMAID SYNTAX RULE: Never use \`-->|text|>\` or \`--|text|>\`. The correct syntax for a text link is \`A -->|text| B\`. Nodes must be defined before linking if using special characters.
CRITICAL INSTRUCTION FOR WEB PROJECTS: If the user asks you to build or generate a web project, component, game, or app (HTML/CSS/JS or React), you MUST provide ALL the code consolidated into ONE SINGLE \`\`\`html\`\`\` OR \`\`\`react\`\`\` block. ABSOLUTELY DO NOT split HTML, CSS, and JS into separate blocks or steps. You must put the CSS inside <style> tags and the JavaScript inside <script> tags within the same HTML file. If it's React, put everything in one JSX/TSX file. This is mandatory so the user can preview the entire app at once.

## Executive Summary
    A 2-3 sentence overview of the key findings and recommendation.

## Technical Analysis
Explain the core concepts in depth. Include code examples in fenced code blocks. Cite each major claim with [[url]] from the findings above. Use multiple different source URLs.

## Comparison of Approaches
Compare approaches using a markdown table if applicable:
| Feature | Approach A | Approach B |
|---------|-----------|-----------|
Include trade-offs and cite sources with [[url]].

## Production Considerations
Cover scalability, security, deployment, and monitoring. Cite relevant sources.

## Recommended Approach
State your recommendation with justification. Cite supporting evidence.

Remember: cite sources as [[https://example.com/path]] inline in sentences. Use multiple different URLs from the findings. Do NOT add a Sources/References section at the end. Start your response with "## Executive Summary".`;

    const { modelName } = state;
    const finalContent = await callWithRetry([new SystemMessage(prompt)], modelName);

    // Evaluate relevancy score
    const relevancyPrompt = `You are a strict Technical Relevancy Evaluator.
    User Query: "${query}"
    Research Findings Summary: ${findings.slice(0, 3).map(f => f.slice(0, 200)).join("\n")}
    Final Answer (first 500 chars): ${(finalContent.content as string).slice(0, 500)}
    
    Evaluate how relevant and comprehensive the gathered data is to the user's query.
    Consider:
    - Does the data directly answer the query with technical depth?
    - Are the sources authoritative (official docs, reputable engineering blogs)?
    - Is there sufficient coverage including code examples and trade-offs?
    - Are there any critical gaps in the research?
    
    Return ONLY a single integer between 0 and 100 representing the relevancy percentage. Nothing else.`;

    const relevancyResponse = await callWithRetry([new SystemMessage(relevancyPrompt)], modelName);
    let relevancy = 85;
    try {
        const cleaned = (relevancyResponse.content as string).replace(/[^0-9]/g, '').trim();
        const parsed = parseInt(cleaned);
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
            relevancy = Math.max(parsed, 15); // Floor at 15% to avoid misleading 0%
        }
    } catch { }

    return { messages: [finalContent], relevancy };
}

// Conditional Edge
function shouldContinue(state: typeof AgentState.State) {
    if (state.critique === "needs_research" && state.loopCount < 3) {
        return "researcher";
    }
    return "synthesizer";
}

// Graph Construction
const workflow = new StateGraph(AgentState)
    .addNode("planner", planNode)
    .addNode("researcher", researchNode)
    .addNode("analyzer", critiqueNode)
    .addNode("synthesizer", synthesizeNode)
    .addEdge(START, "planner")
    .addEdge("planner", "researcher")
    .addEdge("researcher", "analyzer")
    .addConditionalEdges("analyzer", shouldContinue)
    .addEdge("synthesizer", END);

export const graph = workflow.compile();
