import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { qdrantClient, COLLECTIONS } from "@/lib/qdrant";
import { pipeline } from "@huggingface/transformers";

let embeddingPipeline: any = null;

export const searchGithubRepoTool = new DynamicStructuredTool({
    name: "search_github_repo",
    description: "Search an indexed GitHub repository for relevant code snippets or documentation using semantic search. Use this when the user asks questions about a specific GitHub repository that has been analyzed/ingested.",
    schema: z.object({
        query: z.string().describe("The semantic search query, e.g., 'how does authentication work' or 'show me the user schema'"),
        repository: z.string().describe("The owner/repo identifier to search within, e.g., 'shbhmexe/Project-2025'. Leave empty for broad search."),
        limit: z.number().optional().default(3).describe("Number of code chunks to return (default 3, max 5)")
    }),
    func: async ({ query, repository, limit = 3 }) => {
        try {
            // Strip surrounding brackets/quotes in case query was prefixed with [repo] pattern
            const cleanQuery = query.replace(/^\[.*?\]\s*/, "").trim() || query;
            console.log(`[Agent Tool: search_github_repo] Searching "${cleanQuery}" in repo: "${repository || 'any'}"`);

            // 1. Initialize the embedding pipeline if not already done
            if (!embeddingPipeline) {
                embeddingPipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
            }

            // 2. Vectorize the user's semantic search query
            const output = await embeddingPipeline(cleanQuery, { pooling: 'mean', normalize: true });
            const queryVector = Array.from(output.data) as number[];

            // 3. First try: Qdrant filter by repository (requires payload index to exist)
            let searchResults: any[] = [];
            if (repository) {
                try {
                    searchResults = await qdrantClient.search(COLLECTIONS.GITHUB_REPOS, {
                        vector: queryVector,
                        limit: Math.min(limit * 3, 15), // Fetch more to allow in-code filtering
                        with_payload: true,
                        filter: {
                            must: [
                                {
                                    key: "repository",
                                    match: { value: repository }
                                }
                            ]
                        }
                    });
                    console.log(`[Agent Tool] Qdrant filter returned ${searchResults.length} results for repo: ${repository}`);
                } catch (filterErr: any) {
                    console.warn(`[Agent Tool] Qdrant filter failed (${filterErr.message}), falling back to broad search + in-code filter`);
                    // Fallback: fetch more results and filter in-code
                    searchResults = await qdrantClient.search(COLLECTIONS.GITHUB_REPOS, {
                        vector: queryVector,
                        limit: 20,
                        with_payload: true,
                    });
                    // In-code filter by repository substring match
                    searchResults = searchResults.filter((r: any) => {
                        const repoField = r.payload?.repository as string ?? "";
                        return repoField.includes(repository) || repository.includes(repoField);
                    });
                    console.log(`[Agent Tool] In-code filter gave ${searchResults.length} results`);
                }
            }

            // 4. If still no results — broad search (no filter)
            if (searchResults.length === 0) {
                console.log(`[Agent Tool] No filtered results. Doing broad Qdrant search...`);
                searchResults = await qdrantClient.search(COLLECTIONS.GITHUB_REPOS, {
                    vector: queryVector,
                    limit: Math.min(limit, 5),
                    with_payload: true,
                });
            }

            if (searchResults.length === 0) {
                return `No code found for "${cleanQuery}" in repository "${repository}". Make sure the repository has been ingested first via the Sidebar → Repo Analysis button.`;
            }

            // Trim to requested limit
            searchResults = searchResults.slice(0, Math.min(limit, 5));

            // 5. Format outputs for the Agent
            const formattedResults = searchResults.map((result: any, i: number) => {
                const payload = result.payload as any;
                return `--- Result ${i + 1} (Score: ${result.score?.toFixed(3) ?? "?"}) ---\nFile: ${payload.title}\nRepository: ${payload.repository}\nBranch: ${payload.branch}\n\nCode:\n${payload.text}`;
            }).join("\n\n");

            return `Here are the most relevant code snippets from ${repository || "your indexed repositories"}:\n\n${formattedResults}`;

        } catch (error: any) {
            console.error("[Agent Tool: search_github_repo] Error:", error);
            return `Failed to search GitHub repository. Error: ${error.message}`;
        }
    }
});
