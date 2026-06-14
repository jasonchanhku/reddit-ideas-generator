# Session Handoff

## Current Objective

- **Goal:** Evolve Validly from a single-page Reddit idea scraper into a multi-stage SaaS validation pipeline (Discover → Research → PoC)
- **Current status:** Harness created; roadmap mapped from JIRA project KAN; all 6 epics are To Do
- **Branch:** `feature/add-harness-engineering` (harness files only; merge to main when done)
- **Next feature:** KAN-1 — Multi-Page App Architecture & Navigation

## Completed This Session

- [x] Explored project structure and architecture
- [x] Pulled all 41 JIRA issues from project KAN
- [x] Created harness files: `feature_list.json`, `progress.md`, `session-handoff.md`, `init.sh`
- [x] Populated `feature_list.json` with 6 real epics derived from JIRA, with stories, subtasks, done criteria, and implementation notes

## Verification Evidence

| Check | Command | Result |
|-------|---------|--------|
| Lint | `npm run lint` | Run before each session |
| Build | `npm run build` | Run before claiming any feature done |
| Type check | `npx tsc --noEmit` | Run after any lib/types.ts change |

## Decisions Made

- Harness files live at project root (not in `.claude/`) so they are visible to any agent
- `feature_list.json` uses JIRA epic IDs (`KAN-1` … `KAN-6`) as feature IDs for traceability
- Each feature entry includes `stories`, `subtasks`, `implementation_notes`, and `done_criteria`

## Blockers / Risks

- None blocking KAN-1
- KAN-4 requires `SERPH_API_KEY` (not yet procured); add to `.env.local` and `lib/env.ts` when starting that epic
- All features from KAN-2 onward require `MONGODB_URI` to be set in `.env.local`

## Next Session Startup

1. Read `CLAUDE.md` for project overview and architecture.
2. Read `feature_list.json` for epic structure, dependencies, and done criteria.
3. **Query JIRA** (`project = KAN ORDER BY created ASC`) via Atlassian MCP to find the first epic not yet Done — that is the active feature.
4. Read `progress.md` for last-known state and any blockers.
5. Run `./init.sh` (installs deps, lints, builds) to confirm clean baseline before editing.
6. Implement ONE feature only. When done, transition the relevant JIRA epic and subtasks to Done via MCP.
7. Update `progress.md` and this file before ending the session.

## Recommended Next Step

**Start KAN-1, subtask KAN-42:**
- Move `app/page.tsx` → `app/discover/page.tsx`
- Add `app/page.tsx` root redirect (`redirect('/discover')` via Next.js)
- Update any internal `href="/"` references to `href="/discover"`
- Then do KAN-43: create `components/TopNav.tsx` with Discover/Research/PoC links and `usePathname` active highlighting; add `<TopNav>` to `app/layout.tsx`
