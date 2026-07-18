# Session Progress Log

## Current State

**Last Updated:** 2026-07-18
**Active Feature:** KAN-5 — PoC Page & PRD Generation
**Branch:** feature/KAN-4-implement (merge to main when ready; start fresh branch for KAN-5)

## Project Status

### Shipped (in main)
- [x] Reddit scraping via Decodo API (1–5 subreddits, parallel, 3-strategy fallback)
- [x] AI analysis via OpenAI-compatible API (4 focus modes, parallel, Zod-validated)
- [x] MongoDB Atlas persistence for runs
- [x] Multi-page architecture (KAN-1): /discover, root redirect, TopNav
- [x] Favourites system (KAN-2): heart icon, PATCH /api/ideas/:runId/favourite, idea_id stamping
- [x] Research page (KAN-3): /research card grid, /research/[id] detail view, GET /api/ideas aggregation

### Done on feature/KAN-4-implement (commit caec19e, 2026-07-18)
- [x] **KAN-4** — Deep Research Feature
  - [x] KAN-14 — Perform Research: SerpAPI web search + AI market synthesis (cited, directional facts)
  - [x] KAN-15 — Results persisted to MongoDB; Re-run Research once results exist; stage → researched
  - [x] KAN-50 — SERPH_API_KEY in lib/env.ts + CLAUDE.md; button disabled with tooltip when absent
  - [x] KAN-51 — lib/research.ts SerpAPI client (4 targeted queries, per-query failure tolerance)
  - [x] KAN-52 — runResearchAnalysis in lib/ai.ts + ResearchResults types/Zod schema
  - [x] KAN-53 — POST /api/ideas/[id]/research (search → synthesis → positional $ persist)

### Roadmap

Dependency order: KAN-5 → KAN-6

| Epic | Name | Status |
|------|------|--------|
| KAN-5 | PoC Page & PRD Generation | To Do |
| KAN-6 | UI Mockup Generation | To Do |

Live status is in JIRA (project KAN). Always query via Atlassian MCP.

## Blockers / Risks

- `MONGODB_URI` and `SERPH_API_KEY` both configured locally; research verified against live services
- Legacy run documents (pre-KAN-2) lack `idea_id` — invisible to Research page; no migration needed
- SerpAPI free tier is 100 searches/month; each research run consumes ~4 searches

## Decisions Made

- **SERPH = SerpAPI** (serpapi.com, `GET /search.json?engine=google`) — confirmed with user
- **ResearchResults shape** driven by updated KAN-14 acceptance criteria: market_size (TAM/CAGR directional midpoints), niche_size, competitors[{name,strengths,pricing,gap}], competitive_gap, adjacent_trends, beachhead_sizing, key_risks[], monetisation_angles[], summary, sources[] (cited urls only), researched_at
- **Query strategy**: 4 queries per run — market size, tools discovery, industry trends, competitor pricing (skipped if idea has no competitors); individual query failures tolerated, run fails only if all fail
- **research_enabled flag** returned by GET /api/ideas/[id] so the client knows whether SERPH_API_KEY is configured without a separate config endpoint
- **maxDuration = 120** on the research route — search + synthesis can exceed 60s
- **Re-run overwrites** previous research_results (no history kept)

## Key Files Changed in KAN-4

| File | Change |
|------|--------|
| `lib/env.ts` | SERPH_API_KEY optional; serphApiKey on ServerEnv |
| `lib/types.ts` | ResearchResults, CompetitorProfile, ResearchSource; research_results on SaasIdea |
| `lib/research.ts` | New — SerpAPI client + query builder |
| `lib/ai.ts` | runResearchAnalysis, researchResultsSchema, RESEARCH_SYSTEM_PROMPT, parseResearchObject |
| `app/api/ideas/[id]/research/route.ts` | New — POST research endpoint |
| `app/api/ideas/[id]/route.ts` | Returns research_enabled |
| `app/research/[id]/page.tsx` | Active research button + results panel + sources footer |
| `CLAUDE.md` | SERPH_API_KEY documented |
