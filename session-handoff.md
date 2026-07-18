# Session Handoff

## Current Objective

- **Goal:** Evolve Validly from a single-page Reddit idea scraper into a multi-stage SaaS validation pipeline (Discover → Research → PoC)
- **Current status:** KAN-4 Done. Next epic: KAN-5 — PoC Page & PRD Generation
- **Branch:** `feature/KAN-4-implement` — merge to main, then create `feature/KAN-5`

## Completed This Session

- [x] Fast-forwarded `feature/KAN-4-implement` onto origin/main (branch was created from stale local main missing the KAN-3 merge)
- [x] KAN-4: SERPH_API_KEY (SerpAPI) in lib/env.ts, CLAUDE.md, env.local.template
- [x] KAN-4: lib/research.ts — buildResearchQueries (4 targeted queries), searchWeb, runResearchSearches
- [x] KAN-4: lib/ai.ts — runResearchAnalysis, researchResultsSchema, RESEARCH_SYSTEM_PROMPT
- [x] KAN-4: POST /api/ideas/[id]/research — search → synthesis → persist + stage='researched'
- [x] KAN-4: GET /api/ideas/[id] returns research_enabled
- [x] KAN-4: /research/[id] — active Perform/Re-run Research button, results panel, sources footer
- [x] Verified end-to-end against live SerpAPI + MongoDB (real research run persisted)
- [x] feature_list.json evidence for KAN-4; npm run build ✓, npm run lint ✓

## Verification Evidence

| Check | Command | Result |
|-------|---------|--------|
| Lint | `npm run lint` | ✓ 0 errors, 0 warnings |
| Build | `npm run build` | ✓ All 13 routes compiled |
| E2E | POST /api/ideas/:id/research on dev server | ✓ 200; market sizing + 3 competitors + 4 sources; stage persisted 'researched' |

## Architecture Notes for KAN-5

KAN-5 adds the PoC pipeline stage. Stories KAN-16–19, subtasks KAN-54–58.

KAN-5 needs (per feature_list.json — re-confirm details in JIRA, user may have updated):
- `POST /api/ideas/[id]/move-to-poc` — validate `stage === 'researched'`, set `stage = 'poc'` (positional `$` operator, same pattern as research route)
- `app/poc/page.tsx` — replace Coming Soon stub with grid of poc-stage ideas (reuse Research page pattern; `GET /api/ideas` may need a `stage` query param — currently only supports `is_favourite`)
- `app/poc/[id]/page.tsx` — detail view with Generate PRD button
- `generatePRD()` in lib/ai.ts — likely consumes idea + research_results
- `POST /api/ideas/[id]/generate-prd` — returns Markdown; browser download as `<kebab-idea-name>-prd.md`
- The disabled "Move to PoC" button already renders on /research/[id] when `stage === 'researched'` — wire it up

## Blockers / Risks

- SerpAPI free tier: 100 searches/month, ~4 per research run
- `MONGODB_URI` required for all stage-pipeline features
- JIRA MCP HTTP+SSE transport deprecated after June 30 2026; may need migration to Streamable HTTP endpoint

## Next Session Startup

1. Read `CLAUDE.md` for project overview and architecture.
2. Read `feature_list.json` for KAN-5 epic structure, dependencies, and done criteria.
3. **Query JIRA** (`project = KAN ORDER BY created ASC`) via Atlassian MCP — confirm KAN-5 is the first non-Done epic and fetch latest story/subtask descriptions (user updates them).
4. Read `progress.md` for current state and key files.
5. Run `./init.sh` to confirm clean baseline before editing.
6. Implement KAN-5 only. Do not begin KAN-6 work.

## Recommended Next Step

**Merge `feature/KAN-4-implement` to `main`, then start `feature/KAN-5`.**

First task in KAN-5:
- Fetch KAN-5 stories (KAN-16–19) and subtasks (KAN-54–58) from JIRA for latest acceptance criteria
- Create `POST /api/ideas/[id]/move-to-poc` and wire the existing Move to PoC button on /research/[id]
- Extend `GET /api/ideas` with a `stage` filter for the /poc grid
