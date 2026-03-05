# CortEx Platform — Internal Architecture Document

## Overview
CortEx is a multi-modal AI research assistant built on **Next.js 16** with a LangGraph-based agentic pipeline. The platform uses **Groq's Llama 3.3 70B** as the primary LLM and **Qdrant** as the vector database for semantic search.

## Core Components

### 1. Quick Mode (Single-Pass)
- Uses a single LLM call with Tavily web search context
- Response time: **2-5 seconds**
- Best for factual lookups, code generation, and simple queries
- Token budget: ~4000 input, ~2000 output

### 2. Deep Mode (Multi-Agent Pipeline)
- LangGraph state machine with 4 nodes: Planner → Researcher → Critic → Synthesizer
- Response time: **15-45 seconds**
- Performs 2-3 research loops with iterative refinement
- Token budget: ~12000 input per loop, ~4000 output

### 3. PR Analysis Mode
- Specialized mode for GitHub Pull Request review
- Fetches diff, analyzes code quality, security, and performance
- Generates structured feedback with severity ratings

## Database Architecture

### Qdrant Collections
| Collection | Purpose | Vector Dim | Distance |
|------------|---------|-----------|----------|
| `research_history` | Chat history & session tracking | 1536 | Cosine |
| `user_preferences` | User settings & preferences | 1536 | Cosine |
| `github_repos` | Ingested repository code chunks | 384 | Cosine |
| `internal_docs` | Uploaded internal documents | 384 | Cosine |

### Authentication
- **NextAuth v5 (Beta 30)** with GitHub OAuth provider
- Session-based auth with JWT strategy
- Protected API routes via `auth()` middleware

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/chat` | POST | Main chat endpoint (Quick/Deep/PR modes) |
| `/api/history` | GET | Fetch user's chat history |
| `/api/upload-doc` | POST | Upload internal documents for RAG |
| `/api/github/ingest` | POST | Ingest GitHub repository for code RAG |
| `/api/run-code` | POST | Execute code in E2B sandbox |
| `/api/liveblocks-auth` | POST | Authenticate collaborative coding sessions |

## Cost Model
- Groq API: Free tier with rate limits (30 RPM, 6000 TPM)
- Estimated cost per Quick Mode query: **$0.0003**
- Estimated cost per Deep Mode query: **$0.0018**

## Security Considerations
- All code execution happens in **E2B sandboxed environments**
- GitHub tokens are never stored in plaintext
- Qdrant data is filtered by `userId` to prevent cross-user data leakage
- Rate limiting applied at 30 requests per minute per user

## Deployment
- **Platform**: Vercel (Edge + Serverless)
- **Max Duration**: 180 seconds for Deep Mode
- **Environment Variables**: GROQ_API_KEY, QDRANT_URL, QDRANT_API_KEY, TAVILY_API_KEY, AUTH_SECRET
