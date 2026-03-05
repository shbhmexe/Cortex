# 🚀 CortEx: Future Roadmap & Enhancements

This document outlines the planned features and technical enhancements to take **CortEx** from a high-performance research assistant to a production-ready engineering powerhouse.

---

## ✅ Recently Implemented Features

### 1. 💻 Local Code Execution (Sandbox) [COMPLETED]
- Integration of **@e2b/code-interpreter** to execute generated Groq code safely in a micro-VM.
- Streamed terminal output (Stdout/Stderr) rendered dynamically inside the Chat UI.

### 2. 🤝 Live Collaborative Coding Workspace [COMPLETED]
- Global slide-over editor panel synced via WebSockets.
- Powered by **Liveblocks** and **Yjs** CRDTs to share a real-time reactive code state.
- 6-Digit secure room joining mechanism allowing multi-player pairing.

### 3. ✨ Premium UI Aesthetics & UX Polish [COMPLETED]
- Complete Glassmorphism UI redesign with `backdrop-blur` and translucent panels.
- Highly tested Dark and Light themes with custom Scrollbar handling.
- Integrated AI-generated, high-resolution Favicon for a polished production edge.

### 4. 📄 Professional PDF Export [COMPLETED]
- Allowed users to save their research sessions as professional technical reports.
- Integrated **jsPDF** with multi-page support and automated styling for user/assistant messages.

### 5. 🐙 GitHub Repository Context (Smart RAG) [COMPLETED]
- Complete NextAuth GitHub Provider integration.
- Recursive AST/file-tree fetching with efficient filtering to drop `node_modules` and standard binaries.
- Real-time chunking and `Xenova` local vector embeddings injected straight into a Qdrant semantic database, exposed to the agent via custom LangGraph tools.

### 2. 🐙 GitHub/GitLab Integration (Repo-level Context) ✅ [COMPLETED]
- **Concept:** Extend research capabilities to private and public codebases.
- **Implementation:** OAuth for GitHub/GitLab ✅; RAG-based indexing via Qdrant + Xenova embeddings ✅; PR diff fetching + LLM security analysis ✅.
- **Value:** Enables queries like *"Analyze this PR for security flaws"* ✅ or *"Explain how the logging module works in my project"* ✅.
- **Delivered:** `lib/tools/pr-analysis.ts` (PR diff tool), `lib/tools/github-search.ts` (semantic code search), Qdrant ingestion pipeline, persistent Code Context bar.

### 4. 📊 Auto-Generate Architecture Diagrams ✅ [COMPLETED]
- **Concept:** Visualize system designs automatically.
- **Implementation:** Integrated **Mermaid.js** into the chat interface (`message-bubble.tsx`) via a custom `MermaidDiagram` React component.
- **Value:** Turns complex architectural descriptions into easy-to-understand flowcharts and sequence diagrams automatically when the AI outputs `mermaid` code.
- **Delivered:** `components/mermaid-diagram.tsx`, `npm install mermaid`.

### 5. 🌐 Web Project Preview (Interactive Sidebar Sandbox) ✅ [COMPLETED]
- **Concept:** Render generated HTML/CSS/JS and React web snippets interactively inside the app.
- **Implementation:** Built a sliding `PreviewSidebar` containing a secure `WebSandbox` iframe. It leverages `babel-standalone` and CDN React to compile JSX instantly in the browser. 
- **Value:** Turns CortEx into a mini-IDE where users can instantly visualize and play with the frontend code the AI writes, complete with a dark mode preview.
- **Delivered:** `components/web-sandbox.tsx`, `components/preview-sidebar.tsx`, injected into `app/layout.tsx`.
---


### 3. 🔒 Local LLM Support (Privacy First)
- **Concept:** Allow users to use their own hardware for processing sensitive data.
- **Implementation:** Support for **Ollama**, **LM Studio**, or **LocalAI** endpoints.
- **Value:** Absolute data privacy for corporate environments.


### 5. 📚 Internal Knowledge RAG (File Uploads)
- **Concept:** Research across internet data AND internal company documentation.
- **Implementation:** Support for PDF, Markdown, and TXT uploads into the **Qdrant** vector store.
- **Value:** Agent can answer questions based on internal API specs, architectural decision records (ADRs), and legacy docs.

### 6. 🫂 Multi-Agent Expert Panel
- **Concept:** Use specialized agents to critique and improve research.
- **Implementation:** **LangGraph** workflow with personas: *System Architect*, *Security Auditor*, and *Performance Lead*.
- **Value:** Higher quality reporting with built-in "defense" against hallucinations and security gaps.

### 7. 🔌 IDE & Note-taking Extensions
- **Concept:** Bring CortEx into the developer's existing workflow.
- **Implementation:** VS Code Extension and "Export to Notion/Obsidian" features.
- **Value:** Lower friction for using research findings in actual development.



### 9. 🎙️ Developer "Roast" Mode
- **Concept:** Engaging, sarcastic feedback on technical queries.
- **Implementation:** A UI toggle that enables high-temperature, sarcastic system prompts (already partially supported in `lib/roasts.ts`).
- **Value:** Makes learning and debugging more fun and memorable.

---

## 🌟 New Ideas for Technical Excellence

### 9. ⏹️ Side-by-Side Model Benchmarking
- **Concept:** Run the same technical query across different models (e.g., Llama 3.3 70B vs Gemma 2 9B).
- **Implementation:** Parallel API calls to Groq and a split-screen UI.
- **Value:** Helps engineers find the most cost-effective and accurate model for their specific task.

### 10. ⚡ Streaming Research Visualization
- **Concept:** Real-time visibility into the agent's web-crawling process.
- **Implementation:** Live feed showing URLs being visited, technical snippets extracted, and relevancy scores as they happen.
- **Value:** Increases transparency and user trust in the agent's findings.

### 11. 🎨 Multi-Modal Architecture Analysis
- **Concept:** Upload diagrams and get technical analysis.
- **Implementation:** Use Vision models (like Llama 3.2 Vision) to interpret architecture diagrams or UI mockups.
- **Value:** Bridges the gap between visual design and technical implementation.

### 12. ⏱️ Performance & Cost Analytics Dashboard
- **Concept:** Track where the "thinking time" and "token budget" are going.
- **Implementation:** Dashboard showing average latency per research node and cumulative project costs.
- **Value:** Essential for managing team-level deployments and hitting project deadlines.

---

## 🏗 Next Steps for Implementation
1. **Phase 1:** Implement **Mermaid.js** rendering (Visual Impact).
2. **Phase 2:** Add **File Uploads** for local RAG (Utility Impact).
3. **Phase 3:** Create **VS Code Extension** (Workflow Impact).

*Built for engineers, by engineers. Let's build the future of technical research.*
