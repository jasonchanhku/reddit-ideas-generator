# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Validly** is a Next.js SaaS idea generator that mines Reddit for pain points and generates startup ideas. It chains two external services: Decodo (Reddit scraping) → AI model (analysis).

Users can scrape 1–5 subreddits simultaneously, control the time range (week/month/year/all), and select one or more focus modes that shift the AI analysis angle. Each selected focus mode runs a parallel AI call; results are merged and deduplicated by idea name.

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
POST /api/analyze { subreddits[], timeRange, focusModes[] }
  → scrapeMultipleSubreddits()  [lib/reddit.ts]
      structureRedditData() × N subreddits in parallel
        scrapeReddit() via Decodo API  (URL uses ?t=<timeRange>)
        fetchCommentsForPost() × N posts (concurrency=4)
      Merge + dedup posts by permalink, cap at 8
  → analyzeWithAI()             [lib/ai.ts]
      runSingleAnalysis() × N focus modes in parallel
        System prompt selected from SYSTEM_PROMPTS[focusMode]
        OpenAI-compatible chat completions (via openai npm package)
        Zod-validate JSON response (min 1, max 10 ideas per mode)
        Tag each idea with focus_mode
      Merge all mode results, dedup by idea_name, sort by score desc
      Optional MongoDB Atlas persistence (stores subreddits[], focusModes[])
  → Response { subreddits[], source, ideas[] }   // ideas have focus_mode field
```

### Key Files

| File | Role |
|------|------|
| `app/api/analyze/route.ts` | Single API endpoint; accepts `subreddits[]`, `timeRange`, `focusModes[]`; chains reddit → AI |
| `lib/reddit.ts` | Decodo API integration; `scrapeMultipleSubreddits` runs subreddits in parallel; tries 3 request strategies, caches first success |
| `lib/ai.ts` | AI client wrapper; `SYSTEM_PROMPTS` map keyed by `FocusMode`; `runSingleAnalysis` per mode in parallel; merges + deduplicates results; optional MongoDB write |
| `lib/db.ts` | Cached MongoClient singleton (Next.js-safe); used only when `MONGODB_URI` is set |
| `lib/env.ts` | Zod-validated env config; call `getServerEnv()` everywhere instead of `process.env` directly |
| `lib/types.ts` | All shared TypeScript interfaces + `TimeRange` and `FocusMode` union types; `SaasIdea.focus_mode` is set post-parse |
| `app/page.tsx` | Client component; searchable dropdown multiselect for subreddits, time range pills, multi-select focus mode grid, colour-coded idea cards |

### Focus Modes

Defined in `lib/ai.ts` as `SYSTEM_PROMPTS: Record<FocusMode, string>`. Multiple modes can be selected per request; each runs a separate AI call in parallel and the results are merged.

| Mode | Description |
|------|-------------|
| `pain-points` | Default; surfaces repeated user frustrations and SaaS opportunities |
| `revenue-first` | Prioritises threads where users already pay for inferior substitutes; mines thread data for quantitative revenue signals (prices, ARR/MRR, download counts) to populate `revenue_potential` |
| `better-mousetrap` | Finds crowded markets where all incumbents share one flaw |
| `emerging-trends` | Spots new behaviours/workflows with no dominant tool yet |

Each returned `SaasIdea` has a `focus_mode` field indicating which mode generated it. The UI renders a colour-coded badge per mode on each idea card.

### Resilience Design

`lib/reddit.ts` tries three Decodo request strategies and caches the first that works for subsequent calls. AI responses may be malformed JSON — `jsonrepair` fixes them before Zod parsing. Array fields (`existing_solutions`, `similar_competitors`, `user_complaints`) use a `coercedString` schema that flattens objects the AI occasionally returns instead of plain strings.

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
