const { graph } = require("../lib/agent");
const { HumanMessage } = require("@langchain/core/messages");

async function test() {
    const initialState = {
        query: "test query",
        messages: [new HumanMessage("test query")],
        plan: [],
        findings: [],
        critique: null,
        loopCount: 0,
    };

    try {
        console.log("Starting graph stream...");
        const eventStream = await graph.stream(initialState, { recursionLimit: 3 });
        for await (const event of eventStream) {
            console.log("EVENT:", JSON.stringify(event, null, 2));
        }
        console.log("Graph finished!");
    } catch (e) {
        console.error("Graph failed:", e.message);
        console.error(e.stack);
    }
}

test();
