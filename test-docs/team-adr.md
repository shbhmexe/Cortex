# ADR-001: Why We Chose Groq Over OpenAI

**Status:** Accepted  
**Date:** 2026-01-15  
**Author:** Shubham (Lead Developer)

## Context
We needed a fast, cost-effective LLM provider for CortEx. The platform requires:
- Sub-5-second response times for Quick Mode
- Support for 70B+ parameter models
- Free or very low-cost tier for hackathon/demo use

## Decision
We chose **Groq (Llama 3.3 70B Versatile)** over OpenAI GPT-4o for the following reasons:

| Criteria | Groq | OpenAI |
|----------|------|--------|
| Latency | ~500ms TTFT | ~2-3s TTFT |
| Cost | Free tier (30 RPM) | $5/1M input tokens |
| Model Quality | Llama 3.3 70B (near GPT-4 level) | GPT-4o (best-in-class) |
| Rate Limits | 30 RPM, 6000 TPM | Varies by tier |

## Consequences
- **Positive:** Extremely fast inference, zero cost for demos
- **Negative:** Rate limits require retry logic with exponential backoff
- **Negative:** No native function calling (we use prompt-based tool routing)
- **Risk:** Groq free tier may change; need fallback to Ollama/local models

---

# ADR-002: Qdrant as Vector Database

**Status:** Accepted  
**Date:** 2026-01-18

## Context
We need a vector database for:
1. Storing embedded code chunks from GitHub repos
2. Storing user chat history with semantic search
3. Storing uploaded internal documents

## Decision
Chose **Qdrant Cloud** over Pinecone and Weaviate.

**Reasons:**
- Free 1GB cluster on Qdrant Cloud
- Native payload filtering (critical for userId-based isolation)
- REST API with excellent TypeScript client
- Supports hybrid search (dense + sparse vectors)

## Collections Design
- `research_history` (1536 dim) — Legacy dimension from early OpenAI experiments
- `github_repos` (384 dim) — Matches Xenova/all-MiniLM-L6-v2 output
- `internal_docs` (384 dim) — Same model as github_repos for consistency
- `user_preferences` (1536 dim) — Legacy, may migrate to 384

---

# ADR-003: Local Embeddings with Xenova

**Status:** Accepted  
**Date:** 2026-02-01

## Context
OpenAI embeddings cost $0.13/1M tokens. For a hackathon project processing hundreds of code files, this adds up quickly.

## Decision
Use **@huggingface/transformers** with **Xenova/all-MiniLM-L6-v2** for all new embedding pipelines.

**Trade-offs:**
- **Pro:** Zero cost, runs locally, no API key needed
- **Pro:** 384 dimensions (smaller vectors = faster search)
- **Con:** First load takes ~3-5 seconds (model download)
- **Con:** CPU-only in Node.js (no GPU acceleration)

## Migration Note
Legacy collections (`research_history`, `user_preferences`) still use 1536-dim mock embeddings. 
Future migration planned to unify all collections to 384-dim Xenova embeddings.
