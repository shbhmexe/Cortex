// @ts-nocheck
import { tavilyTool } from "@/lib/tavily";
import { ChatGroq } from "@langchain/groq";
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
});

// Tools
const researchTool = tavilyTool;

// Model — llama-3.1-8b-instant (Standard production model)
const model = new ChatGroq({
    model: "llama-3.1-8b-instant",
    temperature: 0,
});

// Retry wrapper for Groq rate limits
async function callWithRetry(messages: any[], maxRetries = 3): Promise<any> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await model.invoke(messages);
        } catch (error: any) {
            const isRateLimit = error?.message?.includes('rate_limit') ||
                error?.message?.includes('429') ||
                error?.status === 429;
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

    const response = await callWithRetry([new SystemMessage(prompt), new HumanMessage(query)]);
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
    const { plan, findings, loopCount } = state;

    const context = findings.join("\n\n");
    const prompt = `You are a Senior Research Engineer performing targeted technical research.
    
    Research Plan: ${JSON.stringify(plan)}
    Existing Findings (${findings.length} sources gathered so far): ${context.slice(0, 2000)}
    Current Loop: ${loopCount + 1}
    
    Based on the plan and what has already been found, generate the NEXT search query to gather missing technical information.
    Focus on finding:
    - Official documentation and API references
    - Engineering blog posts with implementation details
    - Code repositories and real-world examples
    - Performance benchmarks and comparison data
    - Architecture diagrams and system design patterns
    
    If previous findings lack code examples, prioritize finding code.
    If previous findings lack authoritative sources, prioritize official docs.
    
    Return ONLY the search query string, nothing else.`;

    const searchQueryMsg = await callWithRetry([new SystemMessage(prompt)]);
    const searchQuery = searchQueryMsg.content as string;

    const searchResults = await researchTool.invoke(searchQuery);

    return {
        findings: [`Search Query: "${searchQuery}"\nResults: ${searchResults}`],
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

    const response = await callWithRetry([new SystemMessage(prompt)]);
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

    const finalContent = await callWithRetry([new SystemMessage(prompt)]);

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

    const relevancyResponse = await callWithRetry([new SystemMessage(relevancyPrompt)]);
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
