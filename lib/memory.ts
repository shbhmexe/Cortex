import { qdrantClient, COLLECTIONS, ensureCollection } from "./qdrant";
import { v4 as uuidv4 } from "uuid";

// Mock embeddings for hackathon - removes OpenAI dependency
const embeddings = {
    embedQuery: async (text: string) => Array(1536).fill(0),
};

export async function saveQuery(
    userId: string,
    sessionId: string,
    query: string,
    response: string,
    cost: number,
    mode: "quick" | "deep" = "quick",
    relevancy: number = 0
) {
    try {
        const textToEmbed = `${query}\n\n${response}`;
        const vector = await embeddings.embedQuery(textToEmbed);

        const pointId = uuidv4();

        await qdrantClient.upsert(COLLECTIONS.RESEARCH_HISTORY, {
            points: [
                {
                    id: pointId,
                    vector,
                    payload: {
                        userId,
                        sessionId,
                        query,
                        response,
                        cost,
                        mode,
                        relevancy,
                        timestamp: new Date().toISOString(),
                    },
                },
            ],
        });
    } catch (e: any) {
        console.error("Error saving query to Qdrant:", e.message);
    }
}

export async function getRecentQueries(userId: string, sessionId?: string, limit: number = 20) {
    await ensureCollection(COLLECTIONS.RESEARCH_HISTORY);
    try {
        const mustFilters: any[] = [
            {
                key: "userId",
                match: {
                    value: userId,
                },
            },
        ];

        if (sessionId) {
            mustFilters.push({
                key: "sessionId",
                match: {
                    value: sessionId,
                },
            });
        }

        const filter = { must: mustFilters };

        const result = await qdrantClient.scroll(COLLECTIONS.RESEARCH_HISTORY, {
            filter,
            limit,
            with_payload: true,
        });

        // Sort by timestamp if possible, though scroll is often insertion order. 
        // Payload has timestamp.
        return result.points
            .map((point) => ({ ...(point.payload as any), id: point.id }))
            .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } catch (e: any) {
        console.error("Error fetching recent queries:", e.message);
        return [];
    }
}

export async function deleteRecentQuery(id: string) {
    await ensureCollection(COLLECTIONS.RESEARCH_HISTORY);
    try {
        await qdrantClient.delete(COLLECTIONS.RESEARCH_HISTORY, {
            points: [id]
        });
    } catch (e: any) {
        console.error("Error deleting research history:", e.message);
        throw e;
    }
}

export async function upsertUserPreference(
    userId: string,
    sessionId: string,
    preference: string
) {
    try {
        const vector = await embeddings.embedQuery(preference);
        const pointId = uuidv4();

        await qdrantClient.upsert(COLLECTIONS.USER_PREFERENCES, {
            points: [
                {
                    id: pointId,
                    vector,
                    payload: {
                        userId,
                        sessionId,
                        preference,
                        timestamp: new Date().toISOString(),
                    },
                },
            ],
        });
    } catch (e: any) {
        console.error("Error saving preference to Qdrant:", e.message);
    }
}

export async function getUserPreferences(userId: string, sessionId: string) {
    await ensureCollection(COLLECTIONS.USER_PREFERENCES);

    // Simplistic retrieval: get all preferences for session
    try {
        const result = await qdrantClient.scroll(COLLECTIONS.USER_PREFERENCES, {
            filter: {
                must: [
                    {
                        key: "userId",
                        match: {
                            value: userId,
                        },
                    },
                    {
                        key: "sessionId",
                        match: {
                            value: sessionId,
                        },
                    },
                ],
            },
            limit: 10,
            with_payload: true,
        });

        return result.points.map(p => p.payload?.preference as string).filter(Boolean);
    } catch (e) {
        console.error("Error fetching preferences", e);
        return [];
    }
}
