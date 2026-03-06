require('dotenv').config({ path: '.env.local' });
const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
const { ChatGroq } = require("@langchain/groq");

async function testModels() {
    console.log("--- Testing Gemini ---");
    try {
        const gemini = new ChatGoogleGenerativeAI({
            model: "gemini-2.5-pro",
            temperature: 0,
            maxOutputTokens: 100,
            apiKey: process.env.GOOGLE_API_KEY || "AIzaSy_fake_key_to_prevent_crash",
        });
        const res1 = await gemini.invoke("Say hello in 2 words");
        console.log("Gemini Response:", res1.content);
    } catch (e) {
        console.error("Gemini failed:", e.message);
    }

    console.log("\n--- Testing Groq (Gemma) ---");
    try {
        const groq = new ChatGroq({
            model: "gemma2-9b-it",
            temperature: 0,
        });
        const res2 = await groq.invoke("Say hello in 2 words");
        console.log("Groq Response:", res2.content);
    } catch (e) {
        console.error("Groq failed:", e.message);
    }
}

testModels();
