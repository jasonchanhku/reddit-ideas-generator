# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Validly** is a Next.js SaaS idea generator that mines Reddit for pain points and generates startup ideas. It chains two external services: Decodo (Reddit scraping) → AI model (analysis).

Users can scrape 1–5 subreddits simultaneously, control the time range (week/month/year/all), and select a focus mode that shifts the AI analysis angle.

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
POST /api/analyze { subreddits[], timeRange, focusMode }
  → scrapeMultipleSubreddits()  [lib/reddit.ts]
      structureRedditData() × N subreddits in parallel
        scrapeReddit() via Decodo API  (URL uses ?t=<timeRange>)
        fetchCommentsForPost() × N posts (concurrency=4)
      Merge + dedup posts by permalink, cap at 8
  → analyzeWithAI()             [lib/ai.ts]
      System prompt selected by focusMode (pain-points | revenue-first | better-mousetrap | emerging-trends)
      OpenAI-compatible chat completions (via openai npm package)
      Zod-validate JSON response
      optional MongoDB Atlas persistence (stores subreddits[])
  → Response { subreddits[], source, ideas[] }
```

### Key Files

| File | Role |
|------|------|
| `app/api/analyze/route.ts` | Single API endpoint; accepts `subreddits[]`, `timeRange`, `focusMode`; chains reddit → AI |
| `lib/reddit.ts` | Decodo API integration; `scrapeMultipleSubreddits` runs subreddits in parallel; tries 3 request strategies, caches first success |
| `lib/ai.ts` | AI client wrapper; `SYSTEM_PROMPTS` map keyed by `FocusMode`; handles chat completions, JSON repair, optional MongoDB write |
| `lib/db.ts` | Cached MongoClient singleton (Next.js-safe); used only when `MONGODB_URI` is set |
| `lib/env.ts` | Zod-validated env config; call `getServerEnv()` everywhere instead of `process.env` directly |
| `lib/types.ts` | All shared TypeScript interfaces + `TimeRange` and `FocusMode` union types |
| `app/page.tsx` | Client component; multi-subreddit tag input, time range pills, focus mode grid, idea card display |

### Focus Modes

Defined in `lib/ai.ts` as `SYSTEM_PROMPTS: Record<FocusMode, string>`:

| Mode | Description |
|------|-------------|
| `pain-points` | Default; surfaces repeated user frustrations and SaaS opportunities |
| `revenue-first` | Prioritises threads where users already pay for inferior substitutes |
| `better-mousetrap` | Finds crowded markets where all incumbents share one flaw |
| `emerging-trends` | Spots new behaviours/workflows with no dominant tool yet |

### Resilience Design

`lib/reddit.ts` tries three Decodo request strategies and caches the first that works for subsequent calls. AI responses may be malformed JSON — `jsonrepair` fixes them before Zod parsing.

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
- `MONGODB_DB_NAME` — MongoDB DB name
