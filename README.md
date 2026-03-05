# 🧠 CortEx: Deep Research for Engineers

CortEx is a high-performance, AI-driven technical research assistant designed for engineers. It goes beyond simple chat by performing multi-step web research, planning, critiquing findings, and synthesizing production-quality technical reports with code examples and architectural analysis.

![CortEx Banner](https://images.unsplash.com/photo-1620712943543-bcc4688e7485?auto=format&fit=crop&q=80&w=2000&ixlib=rb-4.0.3)

## 🚀 Core Features

### ⚡ Quick Dive Mode
- **Instant Insights**: Rapid technical answers with a single research loop.
- **Web-Augmented**: Fetches real-time technical data using Tavily.
- **Relevancy Scoring**: Automatically evaluates how well the answer satisfies the query (0–100).
- **Context-Aware Conversations**: Maintains conversation history across sessions with automatic follow-up vs. new topic detection.
- **Stop Generation**: Cancel any ongoing AI response instantly with a ChatGPT-style stop button.

### 🧠 Deep Logic Mode (The Agentic Core)
- **Autonomous Planning**: Decomposes complex engineering queries into technical sub-problems using LangGraph.
- **Recursive Research**: Performs up to 3 research loops with an AI critique gate to gather comprehensive data.
- **Technical Critique**: Evaluates source authority, technical depth, and coverage before moving to synthesis.
- **Structured Reporting**: Generates deep-dive reports with:
  - Executive Summaries
  - Technical Architecture Analysis
  - Code Examples (Tailored to your preferences)
  - Comparison Tables & Trade-offs
  - Production & Security Considerations

### 🐙 GitHub Repository Analysis (Smart RAG)
- **One-Click Repo Ingestion**: Paste any GitHub repo URL → CortEx recursively fetches the file tree, chunks the code, and embeds it into Qdrant using local `Xenova/all-MiniLM-L6-v2` embeddings.
- **Semantic Code Search**: Ask natural language questions about any ingested codebase ("How does authentication work?", "Show me the API structure").
- **Persistent Context Banner**: A dismissible "Code Context" pill sits above the input box with smart prompt suggestions.
- **PR Security Analysis**: Fetch and analyze Pull Request diffs for security flaws using `lib/tools/pr-analysis.ts`.

### 📚 Internal Knowledge RAG (Document Uploads)
- **Upload & Query**: Upload PDF, Markdown, or TXT files directly from the sidebar.
- **Chunked RAG Pipeline**: Documents are parsed, split using `RecursiveCharacterTextSplitter`, embedded with `Xenova`, and stored in Qdrant's `internal_docs` collection.
- **Smart Context Priority**: When a document is active, responses come exclusively from document context — no web search fallback.
- **Mutual Exclusivity**: Only one context (Repo OR Document) can be active at a time. Activating one auto-dismisses the other.
- **Prompt Suggestions**: Contextual suggestions like "Summarize this document", "Key takeaways?" appear above the input box.

### 💻 Live Code Execution (Sandbox)
- **Secure Execution**: Run AI-generated code safely via **E2B Code Interpreter** micro-VMs.
- **Streamed Output**: Terminal stdout/stderr rendered dynamically inside the chat UI.
- **Multi-Language Support**: Execute Python, JavaScript, and more.

### 🤝 Collaborative Coding Workspace
- **Real-Time Code Sharing**: Global slide-over editor panel synced via **Liveblocks** + **Yjs** CRDTs.
- **Room-Based Pairing**: Create or join rooms with a 6-digit secure room code.
- **Multi-Cursor Editing**: See collaborators' cursors and edits live.

### 📊 Auto-Generated Architecture Diagrams
- **Mermaid.js Integration**: AI-generated `mermaid` code blocks are automatically rendered as interactive flowcharts, sequence diagrams, and class diagrams.
- **Copy & Export**: Diagrams can be copied or used directly in documentation.

### 🌐 Web Project Preview (Interactive Sandbox)
- **Live Preview Sidebar**: Render HTML/CSS/JS and React snippets in a secure iframe sandbox.
- **Instant JSX Compilation**: Powered by `babel-standalone` + CDN React for zero-config previews.
- **Dark Mode Support**: Preview matches your current theme.

### 📋 Engineering-First Features
- **Validated Sources**: Every claim is cited inline (`[[source]]`) and displayed as clickable source cards.
- **Agent Logic Visibility**: Watch the agent "think" through planning, research, and critique steps in real-time.
- **Cost Transparency**: Real-time token usage and cost estimation based on Groq market pricing.
- **Personalized Context**: Qdrant-backed long-term memory for your technical preferences.
- **PDF Export**: Save any research session as a professional multi-page PDF report via `jsPDF`.
- **Session History**: Browse, reload, and continue past research sessions from the sidebar.
- **Double-Tap to Reply**: Double-tap any AI response to quote and reference it in your next message.
- **Dark/Light Theme**: Glassmorphism UI with polished dark and light modes.

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | [Next.js 16+](https://nextjs.org/) (App Router, Turbopack) |
| **AI Orchestration** | [LangChain](https://js.langchain.com/) & [LangGraph](https://langchain-ai.github.io/langgraphjs/) |
| **LLM** | [Groq API](https://groq.com/) (LLaMA 4 Scout, Llama 3.3 70B) |
| **Web Search** | [Tavily API](https://tavily.com/) (Advanced Technical Search) |
| **Vector DB** | [Qdrant](https://qdrant.tech/) (Embeddings for memory, repos & docs) |
| **Local Embeddings** | [Xenova/all-MiniLM-L6-v2](https://huggingface.co/Xenova/all-MiniLM-L6-v2) (384-dim) |
| **Collaboration** | [Liveblocks](https://liveblocks.io/) + [Yjs](https://yjs.dev/) CRDTs |
| **Code Execution** | [E2B](https://e2b.dev/) Sandboxed Interpreters |
| **Auth** | [NextAuth.js](https://next-auth.js.org/) (GitHub OAuth) |
| **Styling** | [Tailwind CSS](https://tailwindcss.com/) + [Shadcn UI](https://ui.shadcn.com/) |

## ⚙️ Setup & Installation

### 1. Clone the repository
```bash
git clone https://github.com/shbhmexe/Cortex.git
cd Cortex
```

### 2. Install dependencies
```bash
npm install
```

### 3. Environment Variables
Create a `.env.local` file in the root directory:
```env
# AI Models (Groq)
GROQ_API_KEY=your_groq_key

# Search (Tavily)
TAVILY_API_KEY=your_tavily_key

# Vector Database (Qdrant)
QDRANT_URL=your_qdrant_url
QDRANT_API_KEY=your_qdrant_key

# Auth (NextAuth + GitHub OAuth)
AUTH_SECRET=your_auth_secret
GITHUB_ID=your_github_client_id
GITHUB_SECRET=your_github_client_secret

# Collaborative Workspace (Liveblocks)
LIVEBLOCKS_SECRET_KEY=your_liveblocks_key

# Code Execution (E2B)
E2B_API_KEY=your_e2b_key
```

### 4. Run the development server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to start your first technical dive.

## 📐 Project Structure

```
cortex/
├── app/
│   ├── api/
│   │   ├── chat/           # Core chat API (Quick + Deep modes)
│   │   ├── github/ingest/  # GitHub repo ingestion pipeline
│   │   ├── upload-doc/     # Internal docs upload & embedding
│   │   ├── history/        # Session history CRUD
│   │   ├── run-code/       # E2B code execution endpoint
│   │   ├── liveblocks-auth/# Collaborative room authentication
│   │   └── auth/           # NextAuth handlers
│   └── page.tsx            # Main app with state management
├── components/
│   ├── chat-interface.tsx   # Chat UI, context banners, stop button
│   ├── message-bubble.tsx   # Rich message rendering (Mermaid, code, sources)
│   ├── sidebar.tsx          # History, repo analysis, doc upload
│   ├── collab-workspace.tsx # Real-time collaborative editor
│   ├── mermaid-diagram.tsx  # Auto-rendered architecture diagrams
│   ├── preview-sidebar.tsx  # Live web preview panel
│   └── web-sandbox.tsx      # Secure iframe sandbox
├── lib/
│   ├── agent.ts             # LangGraph Deep Mode brain
│   ├── memory.ts            # Qdrant preference memory
│   ├── qdrant.ts            # Vector DB collections & provisioning
│   ├── tavily.ts            # Web search tool
│   ├── github.ts            # GitHub API utilities
│   ├── tools/
│   │   ├── github-search.ts        # Semantic code search tool
│   │   ├── internal-docs-search.ts  # Document RAG search tool
│   │   └── pr-analysis.ts          # PR diff security analysis
│   ├── export-pdf.ts        # PDF report generation
│   └── cost-calc.ts         # Token cost estimation
└── liveblocks.config.ts     # Collaborative workspace config
```

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---
*Built for engineers, by engineers.* 🛠️
