require('dotenv').config({ path: '.env.local' });

async function testRawAPI() {
    console.log("Testing RAW Gemini API with fetch...");
    const key = process.env.GOOGLE_API_KEY;
    if (!key) {
        console.error("No API key found in .env.local!");
        return;
    }

    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent?key=${key}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: "Say hello in 2 words" }] }]
            })
        });

        const data = await res.json();
        if (data.error) {
            console.error("Gemini API Error:", data.error.message);
        } else {
            console.log("Success! Response:", data.candidates[0].content.parts[0].text);
        }
    } catch (e) {
        console.error("Network/Fetch Error:", e.message);
    }
}

testRawAPI();
