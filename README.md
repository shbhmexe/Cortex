# 🧠 CortEx: Deep Research for Engineers

CortEx is a high-performance, AI-driven technical research assistant designed for engineers. It goes beyond simple chat by performing multi-step web research, planning, critiquing findings, and synthesizing production-quality technical reports with code examples and architectural analysis.

![CortEx Banner](https://images.unsplash.com/photo-1620712943543-bcc4688e7485?auto=format&fit=crop&q=80&w=2000&ixlib=rb-4.0.3)

## 🚀 Core Features

### ⚡ Quick Mode
- **Instant Insights**: Rapid technical answers with a single research loop.
- **Web-Augmented**: Fetches real-time technical data using Tavily.
- **Relevancy Scoring**: Automatically evaluates how well the answer satisfies the query.

### 🕵️ Deep Mode (The Agentic Core)
- **Autonomous Planning**: Decomposes complex engineering queries into technical sub-problems.
- **Recursive Research**: Performs up to 3 research loops to gather comprehensive data.
- **Technical Critique**: Evaluates source authority and depth before move to synthesis.
- **Structured Reporting**: Generates deep-dive reports with:
  - Executive Summaries
  - Technical Architecture Analysis
  - Code Examples (Tailored to your preferences)
  - Comparison Tables & Trade-offs
  - Production & Security Considerations

### 📋 Engineering-First Features
- **Validated Sources**: Every technical claim is cited inline (`[[source]]`) and displayed as clickable cards.
- **Agent Logic Visibility**: Watch the agent "think" through its planning and research steps in real-time.
- **Cost Transparency**: Real-time token usage and cost estimation based on market pricing.
- **Personalized Context**: Remembers your technical preferences (e.g., "I prefer Rust code examples", "I care about scalability").

## 🛠 Tech Stack

- **Framework**: [Next.js 15+](https://nextjs.org/) (App Router, Server Actions)
- **AI Orchestration**: [LangChain](https://js.langchain.com/) & [LangGraph](https://langchain-ai.github.io/langgraphjs/)
- **LLM Frontier**: [Groq API](https://groq.com/) (Llama 3.1 8B, Llama 3.3 70B, Gemma 2 9B)
- **Search Engine**: [Tavily API](https://tavily.com/) (Advanced Technical Search)
- **Vector Memory**: [Qdrant](https://qdrant.tech/) (Long-term preference storage)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) + [Shadcn UI](https://ui.shadcn.com/)
- **Database**: [Prisma](https://www.prisma.io/) + [PostgreSQL](https://www.postgresql.org/)

## ⚙️ Setup & Installation

### 1. Clone the repository
```bash
git clone https://github.com/your-username/cortex.git
cd cortex
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

# Memory (Qdrant)
QDRANT_URL=your_qdrant_url
QDRANT_API_KEY=your_qdrant_key

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/cortex"

# Auth (NextAuth)
NEXTAUTH_SECRET=your_secret
NEXTAUTH_URL=http://localhost:3000
```

### 4. Run the development server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to start your first technical dive.

## 📐 Project Structure

- `/app`: Next.js pages and API routes (logic for chat, history, etc.)
- `/lib`: Core agentic logic (LangGraph state, tools, cost calculation)
- `/components`: Unified UI system (Chat Interface, Message Bubbles, Cost Badges)
- `/lib/agent.ts`: The "Brain" - holds the LangGraph research nodes and logic.

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---
*Built for engineers, by engineers.* 🛠️
