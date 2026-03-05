import { QdrantClient } from "@qdrant/js-client-rest";

const url = process.env.QDRANT_URL;
const apiKey = process.env.QDRANT_API_KEY;

if (!url || !apiKey) {
    throw new Error("QDRANT_URL and QDRANT_API_KEY must be set");
}

export const qdrantClient = new QdrantClient({
    url,
    apiKey,
});

export const COLLECTIONS = {
    USER_PREFERENCES: "user_preferences",
    RESEARCH_HISTORY: "research_history",
    GITHUB_REPOS: "github_repos",
    INTERNAL_DOCS: "internal_docs",
};

export async function ensureCollection(collectionName: string) {
    try {
        const result = await qdrantClient.getCollections();
        const exists = result.collections.some((c) => c.name === collectionName);

        if (!exists) {
            await qdrantClient.createCollection(collectionName, {
                vectors: {
                    size: 1536,
                    distance: "Cosine",
                },
            });
            console.log(`Created collection: ${collectionName}`);
        }

        // Always ensure the index exists (strict mode requirement)
        const collectionInfo = await qdrantClient.getCollection(collectionName);
        if (!collectionInfo.payload_schema?.sessionId) {
            await qdrantClient.createPayloadIndex(collectionName, {
                field_name: "sessionId",
                field_schema: "keyword",
            });
            console.log(`Created index for sessionId in ${collectionName}`);
        }
    } catch (error) {
        console.error(`Error ensuring collection ${collectionName}:`, error);
    }
}

/**
 * Dedicated collection setup for GitHub Repos.
 * Uses 384 dimensions to match the Xenova/all-MiniLM-L6-v2 local embedding model.
 * Will auto-delete and recreate if the wrong dimension is detected.
 */
export async function ensureGithubCollection() {
    const name = COLLECTIONS.GITHUB_REPOS;
    try {
        const result = await qdrantClient.getCollections();
        const existing = result.collections.find((c) => c.name === name);

        if (existing) {
            // Check if dimensions are correct; if not, delete and recreate
            const info = await qdrantClient.getCollection(name);
            const existingSize = (info.config?.params?.vectors as any)?.size;
            if (existingSize && existingSize !== 384) {
                console.log(`[Qdrant] Collection ${name} has wrong dim (${existingSize}). Recreating with 384...`);
                await qdrantClient.deleteCollection(name);
            } else {
                console.log(`[Qdrant] Collection ${name} already correct (dim=384). Ensuring payload indexes...`);
                // Ensure payload indexes exist even on existing collections
                await ensureGithubPayloadIndex(name);
                return;
            }
        }

        await qdrantClient.createCollection(name, {
            vectors: {
                size: 384, // Xenova/all-MiniLM-L6-v2 output dimension
                distance: "Cosine",
            },
        });
        console.log(`[Qdrant] Created collection ${name} with size 384.`);
        // Create payload index for filtering by repository
        await ensureGithubPayloadIndex(name);
    } catch (error) {
        console.error(`[Qdrant] Error ensuring GitHub collection:`, error);
    }
}

async function ensureGithubPayloadIndex(name: string) {
    try {
        await qdrantClient.createPayloadIndex(name, {
            field_name: "repository",
            field_schema: "keyword",
        });
        console.log(`[Qdrant] Created payload index for 'repository' in ${name}.`);
    } catch (e: any) {
        // Index may already exist — that's fine
        if (!e?.message?.includes("already exists")) {
            console.warn(`[Qdrant] Could not create payload index:`, e?.message);
        }
    }
}

export async function ensureInternalDocsCollection() {
    const name = COLLECTIONS.INTERNAL_DOCS;
    try {
        const result = await qdrantClient.getCollections();
        const existing = result.collections.find((c) => c.name === name);

        if (existing) {
            const info = await qdrantClient.getCollection(name);
            const existingSize = (info.config?.params?.vectors as any)?.size;
            if (existingSize && existingSize !== 384) {
                console.log(`[Qdrant] Collection ${name} has wrong dim (${existingSize}). Recreating with 384...`);
                await qdrantClient.deleteCollection(name);
            } else {
                console.log(`[Qdrant] Collection ${name} already correct (dim=384). Ensuring payload index...`);
                await ensureInternalDocsPayloadIndex(name);
                return;
            }
        }

        await qdrantClient.createCollection(name, {
            vectors: {
                size: 384, // Xenova/all-MiniLM-L6-v2 output dimension
                distance: "Cosine",
            },
        });
        console.log(`[Qdrant] Created collection ${name} with size 384.`);
        await ensureInternalDocsPayloadIndex(name);
    } catch (error) {
        console.error(`[Qdrant] Error ensuring Internal Docs collection:`, error);
    }
}

async function ensureInternalDocsPayloadIndex(name: string) {
    try {
        await qdrantClient.createPayloadIndex(name, {
            field_name: "userId",
            field_schema: "keyword",
        });
        console.log(`[Qdrant] Created payload index for 'userId' in ${name}.`);
    } catch (e: any) {
        if (!e?.message?.includes("already exists")) {
            console.warn(`[Qdrant] Could not create payload index for userId:`, e?.message);
        }
    }
}
