# 🏆 CortEx: Hackathon Executive Q&A & Pitch Guide

This document contains expected questions from hackathon judges regarding the **CortEx** project, along with detailed, strategic answers to help you pitch the project successfully.

---

## 🚀 1. The Core Idea & Value Proposition

### **Q: What exactly is CortEx, and what problem does it solve?**
**A:** CortEx is a **Multi-Modal AI Research Agent & Pair Programmer**. The core problem it solves is tool-switching fatigue and lost context. Developers and researchers today use one tool to browse the web (ChatGPT/Tavily), another to understand their GitHub repos, another to read their PDFs, and another to edit code. 
CortEx unifies all of this. It integrates **Web Search (Tavily), Local Repo Analysis (Qdrant Vector DB), PDF/Document RAG, and Vision Analysis (Llama 4 Vision)** into one seamless interface. It can autonomously write code, search the web for the latest docs, analyze a screenshot of an error, and create a collaborative room (Collab Workspace) to execute code—all in one place.

### **Q: Who is your target audience?**
**A:** Software engineers, technical researchers, and engineering leads. Anyone who needs to ingest massive amounts of data (like a whole GitHub repo or a 100-page PDF) and needs an intelligent agent to interact with that data to write code, find bugs, or summarize docs.

### **Q: Why not just use ChatGPT or GitHub Copilot?**
**A:** Copilot is great for auto-completion but lacks deep repository-wide architectural understanding out of the box. ChatGPT relies on manual copy-pasting of code or documents. CortEx has *native capabilities* engineered for engineers:
1. **Direct GitHub Ingestion:** You drop a repo link, we clone it, chunk it, and index it into a Vector DB. 
2. **Deep Mode vs Quick Mode:** It features a "Deep Research Mode" where the agent autonomously breaks down a complex problem into steps, executes tool calls, and compiles a final report—which standard chatbots don't do.
3. **Execution Sandbox:** CortEx doesn't just write code; it provides an embedded `Node.js/Python Sandbox` to actually run and test the code during the chat.

---

## 🛠️ 2. Architecture & Technical Stack

### **Q: What is your tech stack?**
**A:** 
- **Frontend:** Next.js (App Router), React, Tailwind CSS, Lucide Icons, Framer Motion.
- **Backend/API:** Node.js API routes inside Next.js.
- **AI/LLM Layer:** LangChain (`@langchain/core`) for agent orchestration.
- **Models:** Groq API (Llama 3.3 70B, Llama 4 Scout 17B, Llama 3.1 8B) for blazing-fast inference, and Gemini API for deep context models.
- **RAG & Vector DB:** Qdrant (for vector embeddings), `@langchain/huggingface` (for embedding generation), recursive character text splitting.
- **Real-Time Collaboration:** Liveblocks for the multiplayer Co-Code workspace.
- **Tools:** Tavily Search API (web grounding), WebContainer API / Docker (for the execution sandbox).

### **Q: How does the RAG (Retrieval-Augmented Generation) work when I upload a PDF or Repo?**
**A:** 
1. **Ingestion:** When a user uploads a PDF or provides a GitHub link, the backend downloads the asset.
2. **Chunking:** We use LangChain's `RecursiveCharacterTextSplitter` to break the text/code into manageable semantic chunks (e.g., 1000 tokens with 200 overlap).
3. **Embedding:** We convert these text chunks into mathematical vectors using HuggingFace embeddings (`all-MiniLM-L6-v2`).
4. **Storage:** The vectors are stored in **Qdrant**, our vector database.
5. **Retrieval:** When a user asks a question, we embed their query, perform a cosine similarity search in Qdrant to find the top 5 most relevant chunks, and inject those chunks into the LLM's system prompt as verified context.

### **Q: How are you managing state and long-running agent tasks?**
**A:** For the chat interface, we utilize the Vercel AI SDK (`useChat`), which provides automatic streaming of server-sent events (SSE). For deep research tasks, the agent iteratively calls LangChain tools (`model.invoke` with tool bindings). The intermediate states (like "Searching Tavily" or "Analyzing Repo") are streamed back to the client as custom JSON payloads via the chunk stream to provide an artifact-rich UI (the "Agent Internal Logic" accordion).

---

## 💡 3. Specific Features & Differentiators

### **Q: Tell me about "Deep Mode" vs "Quick Mode".**
**A:** 
- **Quick Mode** is a standard conversational interface augmented with minimal RAG/Search for latency-sensitive queries (sub-2 seconds).
- **Deep Mode** transforms the LLM into an autonomous agent. It utilizes a `ReAct` (Reasoning and Acting) loop. The agent is given a complex goal, and it decides which tools to use (Search, RAG, File System), executes them, reads the output, and iterates until it resolves the user's objective.

### **Q: I see a "Vision" feature. How does the image analysis work?**
**A:** If a user attaches an image (like a system architecture diagram or a screenshot of a terminal error), the frontend converts it to a Base64 string. The backend detects this and routes it to an advanced multi-modal model (specifically **Llama 4 Scout 17B Vision via Groq**). The vision model generates a highly accurate technical description of the image, which is then injected into the main system prompt to give the primary LLM complete visual context for its answer.

### **Q: What is the "Co-Code" Collaborative Workspace?**
**A:** It's an integrated, real-time multiplayer code editor powered by **Liveblocks**. If the AI generates a useful block of code, instead of just copy-pasting it offline, users can click "Co-Code." This opens a shared room where the user and their teammates (or the AI) can edit the code together collaboratively, see live cursors, and even safely execute the code directly inside the browser using our sandbox integration.

---

## 🧗‍♂️ 4. Challenges & Future Scope

### **Q: What was the biggest technical challenge you faced during the hackathon?**
**A:** *(Choose the one that resonates most with your actual experience!)*
1. **Prompt Injection & Context Window:** Managing the context window sizes. Passing a whole repo is impossible, so optimizing the RAG pipeline to return only high-signal code snippets required fine-tuning our chunk sizes, overlap margins, and search thresholds.
2. **Streaming Complex Tool Calls:** Vercel AI SDK handles text well, but streaming complex metadata (like "Thinking" steps, Cost calculations, or Relevancy scores) required us to build a custom chunk parser on the frontend that intercepts specific JSON prefixes (e.g., `2:{"type":"thinking", ...}`) before they hit the text bubble.
3. **Handling Model Deprecations Mid-Hackathon:** *(True story!)* We initially built on Groq's Gemma model, which was decommissioned right before the deadline. We had to dynamically build a model-checking architecture to pivot to Llama 3.1 8B instantly without breaking the UI.

### **Q: What is the business model, or how would you monetize this?**
**A:** 
- **Freemium Tier:** Basic web search and chat with smaller models (Llama 8B).
- **Pro Tier ($20/mo):** Access to Deep Mode autonomous agents, higher context limits for massive GitHub repositories, Vision analysis, and the execution sandbox.
- **Enterprise Team Tier:** Private instances, SSO, SOC2 compliance, and multiplayer team collaborative rooms.

### **Q: What’s next for CortEx? (Future Roadmap)**
**A:** 
1. **Local LLM Integration (Ollama):** Allowing users to run the backend against local open-source models for 100% data privacy.
2. **Automated PR Review Bot:** Creating a GitHub App that uses the CortEx agent to automatically comment on and review incoming Pull Requests for security flaws and code style.
3. **Voice UI:** Integrating Groq Whisper for real-time voice-to-code capabilities.

---

## 🎯 Pro-Tips for the Pitch
- **Live Demo Trumps Slides:** Execute a Deep Mode query live that involves fetching a GitHub repo. Show the judges the "Agent Internal Logic" accordion dropping down and printing tool actions.
- **Highlight Speed:** Emphasize that you chose Groq (Llama) for ultra-low latency, making the tool feel significantly snappier than traditional GPT-4 wrappers.
- **Show the Vision:** Upload an architecture diagram (like a Mermaid chart) and ask CortEx to "generate the React code for this UI." Judges love multi-modal demos.
