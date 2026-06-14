# Session Progress Log

## Current State

**Last Updated:** 2026-06-14
**Active Feature:** KAN-1 — Multi-Page App Architecture & Navigation
**Branch:** feature/add-harness-engineering

## Project Status

### Shipped (in main)
- [x] Reddit scraping via Decodo API (1–5 subreddits, parallel, 3-strategy fallback)
- [x] AI analysis via OpenAI-compatible API (4 focus modes, parallel, Zod-validated)
- [x] MongoDB Atlas persistence for runs
- [x] Past Runs dropdown with delete
- [x] Multi-subreddit selection (searchable dropdown), time range pills, focus mode grid
- [x] Colour-coded idea cards with focus_mode badges

### Roadmap

Live status is in JIRA (project KAN, `https://jasonchanhku.atlassian.net`). Query via Atlassian MCP — do not rely on this file for status. As of 2026-06-14 all 6 epics (KAN-1 through KAN-6) are To Do.

Dependency order: KAN-1 → KAN-2 → KAN-3 → KAN-4 → KAN-5 → KAN-6

### Next Action

Start **KAN-1** (Multi-Page App Architecture):
1. `KAN-42` — Move `app/page.tsx` → `app/discover/page.tsx`, add root redirect
2. `KAN-43` — Create `components/TopNav.tsx` + update `app/layout.tsx`

## Blockers / Risks

- `SERPH_API_KEY` required for KAN-4 (Deep Research) — not yet configured; graceful degradation planned
- `MONGODB_URI` must be set for Favourites (KAN-2) and all downstream features to persist

## Decisions Made

- **Idea identity**: Each `SaasIdea` needs a `uuid` (idea_id) generated at persist time to enable per-idea API routes (`/api/ideas/[id]/*`)
- **Stage model**: ideas flow `discovered` → `favourited` → `researched` → `poc`; stage stored alongside each idea in MongoDB
- **Provider agnostic**: OpenAI SDK with configurable `baseURL`; currently supports OpenAI, DeepSeek, Together AI

## Files to Know Before Starting KAN-1

- `app/page.tsx` — entire UI to be moved to `app/discover/page.tsx`
- `app/layout.tsx` — gets shared `<TopNav>` inserted
- `lib/types.ts` — `SaasIdea` will need `idea_id`, `is_favourite`, `stage` in KAN-2
