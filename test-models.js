require('dotenv').config({ path: '.env.local' });

async function listModels() {
    console.log("Fetching allowed models...");
    const key = process.env.GOOGLE_API_KEY;
    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        const data = await res.json();
        if (data.models) {
            console.log("Available models:");
            data.models.forEach(m => console.log(m.name));
        } else {
            console.error("Error/No models:", data);
        }
    } catch (e) {
        console.error("Fetch Error:", e.message);
    }
}

listModels();
