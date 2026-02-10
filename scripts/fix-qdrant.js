const { QdrantClient } = require("@qdrant/js-client-rest");
require("dotenv").config({ path: ".env.local" });

async function fix() {
    const client = new QdrantClient({
        url: process.env.QDRANT_URL,
        apiKey: process.env.QDRANT_API_KEY,
    });

    const collectionName = "research_history";

    try {
        console.log("Checking collection...");
        const info = await client.getCollection(collectionName);
        console.log("Current schema:", JSON.stringify(info.payload_schema, null, 2));

        if (!info.payload_schema.sessionId) {
            console.log("Creating index for sessionId...");
            await client.createPayloadIndex(collectionName, {
                field_name: "sessionId",
                field_schema: "keyword",
                wait: true
            });
            console.log("Index created!");
        } else {
            console.log("Index already exists.");
        }
    } catch (e) {
        console.error("Fix failed:", e.message);
        if (e.response?.data) console.error(JSON.stringify(e.response.data, null, 2));
    }
}

fix();
