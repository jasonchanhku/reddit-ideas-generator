# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Validly** is a Next.js SaaS idea generator that mines Reddit for pain points and generates startup ideas. It chains two external services: Decodo (Reddit scraping) → AI model (analysis).

## Commands

```bash
npm run dev      # Start dev server at localhost:3000
npm run build    # Production build
npm run lint     # Run ESLint
```

No test framework is configured.

## Architecture

### Data Flow

```
POST /api/analyze { subreddit }
  → structureRedditData()   [lib/reddit.ts]
      scrapeReddit() via Decodo API
      fetchCommentsForPost() × N posts (concurrency=4)
  → analyzeWithAI()         [lib/ai.ts]
      OpenAI-compatible chat completions (via openai npm package)
      Zod-validate JSON response
      optional MongoDB Atlas persistence
  → Response { subreddit, source, ideas[] }
```

### Key Files

| File | Role |
|------|------|
| `app/api/analyze/route.ts` | Single API endpoint; chains reddit → AI |
| `lib/reddit.ts` | Decodo API integration; tries 3 request strategies in sequence, caches first success |
| `lib/ai.ts` | AI client wrapper; uses `openai` package, handles chat completions, JSON repair, optional MongoDB write |
| `lib/db.ts` | Cached MongoClient singleton (Next.js-safe); used only when `MONGODB_URI` is set |
| `lib/env.ts` | Zod-validated env config; call `getServerEnv()` everywhere instead of `process.env` directly |
| `lib/types.ts` | All shared TypeScript interfaces |
| `app/page.tsx` | Client component; subreddit form + idea card display |

### Resilience Design

`lib/reddit.ts` tries three Decodo request strategies (see `DECODO.md`) and caches the first that works for subsequent calls. AI responses may be malformed JSON — `jsonrepair` fixes them before Zod parsing.

### LLM Provider Swap

The OpenAI client is provider-agnostic. To switch from OpenAI to another provider (e.g. DeepSeek), set:
- `OPENAI_BASE_URL=https://api.deepseek.com/v1`
- `OPENAI_MODEL=deepseek-chat`
- `OPENAI_API_KEY=<provider-key>`

## Environment Variables

**Required:**
- `DECODO_API_KEY` — web scraping auth
- `OPENAI_API_KEY` — AI provider auth (works with any OpenAI-compatible provider)

**Optional (all have defaults in `lib/env.ts`):**
- `OPENAI_BASE_URL` (default: `https://api.openai.com/v1`) — override for DeepSeek, Together, etc.
- `OPENAI_MODEL` (default: `gpt-4o-mini`)
- `OPENAI_TIMEOUT_MS` (default: `90000`)
- `DECODO_PROXY_POOL`, `DECODO_HEADLESS_MODE`, `DECODO_TIMEOUT_MS`
- `MONGODB_URI` — opt-in MongoDB Atlas persistence; omit to skip storage
- `MONGODB_COLLECTION` (default: `ideas`) — Atlas collection name
