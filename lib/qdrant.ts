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
