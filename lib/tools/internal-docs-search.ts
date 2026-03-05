import { qdrantClient, COLLECTIONS } from "@/lib/qdrant";
import { pipeline } from "@huggingface/transformers";

let embeddingPipeline: any = null;

/**
 * Search the user's uploaded internal documents in Qdrant.
 * Returns the top matching text chunks as a formatted string.
 * Uses the same Xenova/all-MiniLM-L6-v2 model as GitHub ingest for consistency.
 */
export async function searchInternalDocs(
    userId: string,
    query: string,
    limit: number = 5
): Promise<string> {
    try {
        // Lazy-init embedding pipeline (shared across calls)
        if (!embeddingPipeline) {
            embeddingPipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
        }

        // Vectorize the query
        const output = await embeddingPipeline(query, { pooling: 'mean', normalize: true });
        const queryVector = Array.from(output.data) as number[];

        // Search Qdrant with userId filter
        const results = await qdrantClient.search(COLLECTIONS.INTERNAL_DOCS, {
            vector: queryVector,
            limit,
            with_payload: true,
            filter: {
                must: [
                    { key: "userId", match: { value: userId } }
                ]
            }
        });

        if (!results || results.length === 0) {
            return "";
        }

        // Format results — only keep chunks with reasonable similarity (score > 0.3)
        const relevant = results.filter((r: any) => r.score > 0.3);
        if (relevant.length === 0) return "";

        const formatted = relevant.map((r: any, i: number) => {
            const p = r.payload;
            return `[Internal Doc: ${p.filename || "unknown"} — chunk ${(p.chunkIndex ?? i) + 1}/${p.totalChunks ?? "?"}]\n${p.text}`;
        }).join("\n\n");

        return formatted;
    } catch (error: any) {
        console.error("[Internal Docs Search] Error:", error.message);
        return "";
    }
}
