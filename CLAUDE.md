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
  → analyzeWithAI()         [lib/insforge.ts]
      Insforge/OpenAI-compatible chat completions
      Zod-validate JSON response
      optional DB persistence
  → Response { subreddit, source, ideas[] }
```

### Key Files

| File | Role |
|------|------|
| `app/api/analyze/route.ts` | Single API endpoint; chains reddit → AI |
| `lib/reddit.ts` | Decodo API integration; tries 3 request strategies in sequence, caches first success |
| `lib/insforge.ts` | AI client wrapper; handles chat completions, JSON repair, optional DB write |
| `lib/env.ts` | Zod-validated env config; call `getEnv()` everywhere instead of `process.env` directly |
| `lib/types.ts` | All shared TypeScript interfaces |
| `app/page.tsx` | Client component; subreddit form + idea card display |

### Resilience Design

`lib/reddit.ts` tries three Decodo request strategies (see `DECODO.md`) and caches the first that works for subsequent calls. AI responses may be malformed JSON — `jsonrepair` fixes them before Zod parsing.

## Environment Variables

**Required:**
- `DECODO_API_KEY` — web scraping auth
- `INSFORGE_API_KEY` — AI platform auth (or any OpenAI-compatible key)

**Optional (all have defaults in `lib/env.ts`):**
- `INSFORGE_URL` (default: `https://api.insforge.dev`)
- `INSFORGE_MODEL` (default: `openai/gpt-4o-mini`)
- `DECODO_PROXY_POOL`, `DECODO_HEADLESS_MODE`, `DECODO_TIMEOUT_MS`, `INSFORGE_TIMEOUT_MS`
- `INSFORGE_RESULTS_TABLE` — opt-in DB persistence; omit to skip storage

## Current Branch Context

`feature/remove-insforge-dependency` — active work to decouple from `@insforge/sdk` and call an OpenAI-compatible endpoint directly. Changes will primarily affect `lib/insforge.ts` and `lib/env.ts`.
