# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Validly** is a Next.js SaaS idea generator that mines Reddit for pain points and generates startup ideas. It chains two external services: Decodo (Reddit scraping) → AI model (analysis).

Users can scrape 1–5 subreddits simultaneously, control the time range (week/month/year/all), and select one or more focus modes that shift the AI analysis angle. Each selected focus mode runs a parallel AI call; results are merged and deduplicated by idea name.

## Startup Workflow

1. Read `feature_list.json` — understand the epic structure, dependencies, and done criteria.
2. **Query JIRA for live status** — use the Atlassian MCP tool to fetch current issue status from project `KAN` (cloudId: `d63c5661-5d76-42bf-835a-347d238a2a32`, site: `https://jasonchanhku.atlassian.net`). JQL: `project = KAN ORDER BY created ASC`. Pick the first epic whose JIRA status is not Done, respecting the dependency order in `feature_list.json`.
3. Read `progress.md` — review last-known state and any blockers.
4. Read `session-handoff.md` — pick up the recommended next step.
5. Run `./init.sh` (or `npm install && npm run lint && npm run build`) before making any changes.
6. Work on **one feature at a time**. Do not start a new feature until the active one passes verification.

> **Feature status is owned by JIRA.** `feature_list.json` is a structural index (dependencies, done criteria, implementation notes) — not a status tracker. Always check JIRA for what is actually To Do / In Progress / Done.

## Definition of Done

A feature is done when **all** of the following are true:

- `npm run build` passes with no errors
- `npm run lint` passes with no warnings
- The `done_criteria` in `feature_list.json` for the feature are met (manually verified)
- The feature's `status` is updated to `"done"` and `evidence` is filled in `feature_list.json`
- `progress.md` and `session-handoff.md` are updated before the session ends

## Scope Boundaries

- **One active feature at a time.** Never implement code for a future feature while working on the current one.
- **No unrequested abstractions.** Only build what the current feature's `done_criteria` require.
- **State files are authoritative.** If `feature_list.json` says a feature is `not-started`, do not assume it is done.
- To claim a feature complete, evidence must be recorded in `feature_list.json` under `"evidence"`.

## End of Session

1. Run `npm run build` and `npm run lint` — both must pass.
2. Update the active feature's `status` and `evidence` in `feature_list.json`.
3. Update `progress.md` with what was done and what is next.
4. Update `session-handoff.md` with the recommended next step.
5. Commit any changes with a descriptive message referencing the JIRA ticket (e.g. `KAN-42: move discover route`).

## Commands

```bash
npm run dev      # Start dev server at localhost:3000
npm run build    # Production build
npm run lint     # Run ESLint
npx tsc --noEmit # Type-check without building
./init.sh        # Full baseline check (install + lint + build)
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
      Optional MongoDB Atlas persistence (stores subreddits[], focusModes[], timeRange, ideas[], analyzed_at)
  → Response { subreddits[], source, ideas[] }   // ideas have focus_mode field
```

### Key Files

| File | Role |
|------|------|
| `app/api/analyze/route.ts` | Single API endpoint; accepts `subreddits[]`, `timeRange`, `focusModes[]`; chains reddit → AI |
| `app/api/runs/route.ts` | `GET /api/runs` — returns last 50 run summaries (no ideas) sorted newest-first; returns `{ runs: [] }` when MongoDB is unconfigured |
| `app/api/runs/[id]/route.ts` | `GET /api/runs/:id` — returns full run with ideas; `DELETE /api/runs/:id` — removes run from MongoDB |
| `lib/reddit.ts` | Decodo API integration; `scrapeMultipleSubreddits` runs subreddits in parallel; tries 3 request strategies, caches first success |
| `lib/ai.ts` | AI client wrapper; `SYSTEM_PROMPTS` map keyed by `FocusMode`; `runSingleAnalysis` per mode in parallel; merges + deduplicates results; optional MongoDB write |
| `lib/db.ts` | Cached MongoClient singleton (Next.js-safe); used only when `MONGODB_URI` is set |
| `lib/env.ts` | Zod-validated env config; call `getServerEnv()` everywhere instead of `process.env` directly |
| `lib/types.ts` | All shared TypeScript interfaces + `TimeRange` and `FocusMode` union types; `SaasIdea.focus_mode` is set post-parse; `RunSummary` and `RunDocument` for stored run shapes |
| `app/page.tsx` | Client component; searchable dropdown multiselect for subreddits, time range pills, multi-select focus mode grid, colour-coded idea cards, past runs dropdown with delete |

### Focus Modes

Defined in `lib/ai.ts` as `SYSTEM_PROMPTS: Record<FocusMode, string>`. Multiple modes can be selected per request; each runs a separate AI call in parallel and the results are merged.

| Mode | Description |
|------|-------------|
| `pain-points` | Default; surfaces repeated user frustrations and SaaS opportunities |
| `revenue-first` | Prioritises threads where users already pay for inferior substitutes; mines thread data for quantitative revenue signals (prices, ARR/MRR, download counts) to populate `revenue_potential` |
| `better-mousetrap` | Finds crowded markets where all incumbents share one flaw |
| `emerging-trends` | Spots new behaviours/workflows with no dominant tool yet |

Each returned `SaasIdea` has a `focus_mode` field indicating which mode generated it. The UI renders a colour-coded badge per mode on each idea card.

### Persistent Runs

Each completed analysis run is written to MongoDB as a single document: `{ subreddits, focusModes, timeRange, ideas, analyzed_at }`. The collection is controlled by `MONGODB_COLLECTION` (default `ideas`) — one document per run, not per idea.

`GET /api/runs` fetches run metadata (no `ideas` array) for the Past Runs dropdown. `GET /api/runs/:id` fetches the full document. `DELETE /api/runs/:id` removes it. When `MONGODB_URI` is unset all three routes return gracefully and the dropdown is hidden.

Run display name format: `"May 17, 2026 14:30 — r/SaaS + r/microsaas · week"` (derived from `analyzed_at` + subreddits + timeRange; timeRange is omitted for legacy documents written before this feature).

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
- `SERPH_API_KEY` — SerpAPI key for Deep Research on `/research/[id]`; the "Perform Research" button is disabled when absent
