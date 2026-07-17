# Session Handoff

## Current Objective

- **Goal:** Evolve Validly from a single-page Reddit idea scraper into a multi-stage SaaS validation pipeline (Discover → Research → PoC)
- **Current status:** KAN-3 Done. Next epic: KAN-4 — Deep Research Feature
- **Branch:** `feature/KAN-3` — merge to main, then create `feature/KAN-4`

## Completed This Session

- [x] Created `feature/KAN-3` branch from merged `main`
- [x] KAN-3: GET /api/ideas?is_favourite=true — MongoDB $unwind aggregation, includes run_id per idea
- [x] KAN-3: GET /api/ideas/[id] — fetch single idea by UUID
- [x] KAN-3: app/research/page.tsx — card grid of favourited ideas, unfavourite removes card, empty state
- [x] KAN-3: app/research/[id]/page.tsx — full detail view, all SaasIdea fields, disabled Perform Research button
- [x] lib/types.ts: run_id? added to SaasIdea
- [x] feature_list.json: evidence block added to KAN-3
- [x] npm run build ✓, npm run lint ✓

## Verification Evidence

| Check | Command | Result |
|-------|---------|--------|
| Lint | `npm run lint` | ✓ 0 errors, 0 warnings |
| Build | `npm run build` | ✓ All 12 routes compiled |

## Architecture Notes for KAN-4

KAN-4 adds "Perform Research" functionality — the disabled button in /research/[id] becomes active.

KAN-4 needs:
- `SERPH_API_KEY` in lib/env.ts (optional; graceful degradation — button disabled when absent)
- `lib/research.ts` — `searchWeb(query: string)` via SERPH API
- `lib/ai.ts` — `runResearchAnalysis(idea: SaasIdea, webResults: string[])` synthesises research
- `POST /api/ideas/[id]/research` — calls searchWeb + runResearchAnalysis, writes `research_results` to MongoDB, sets `stage = 'researched'`
- Update `app/research/[id]/page.tsx` to enable the Perform Research button and display `research_results` when present

The `[id]` in `POST /api/ideas/[id]/research` is the idea_id UUID. Use MongoDB positional `$` operator on the embedded ideas array. The `run_id` (included in GET /api/ideas/[id] response) tells the API which run document to update.

## Blockers / Risks

- `SERPH_API_KEY` — not yet configured; KAN-4 must degrade gracefully without it
- `MONGODB_URI` must be set for all KAN-3+ features
- JIRA MCP HTTP+SSE transport deprecated after June 30 2026; may need migration to Streamable HTTP

## Next Session Startup

1. Read `CLAUDE.md` for project overview and architecture.
2. Read `feature_list.json` for KAN-4 epic structure, dependencies, and done criteria.
3. **Query JIRA** (`project = KAN ORDER BY created ASC`) via Atlassian MCP — confirm KAN-4 is the first non-Done epic.
4. Read `progress.md` for current state and key files.
5. Run `./init.sh` to confirm clean baseline before editing.
6. Implement KAN-4 only. Do not begin KAN-5 work.

## Recommended Next Step

**Merge `feature/KAN-3` to `main`, transition KAN-3 + stories/subtasks (KAN-3, KAN-11, KAN-12, KAN-13, KAN-47, KAN-48, KAN-49) to Done in JIRA. Then start `feature/KAN-4`.**

First task in KAN-4:
- Fetch KAN-4 stories and subtasks from JIRA to confirm scope
- Add `SERPH_API_KEY` (optional) to `lib/env.ts`
- Create `lib/research.ts` with `searchWeb()` via SERPH API
- Create `POST /api/ideas/[id]/research` endpoint
