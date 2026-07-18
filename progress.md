# Session Progress Log

## Current State

**Last Updated:** 2026-07-18
**Active Feature:** KAN-6 — UI Mockup Generation
**Branch:** feature/KAN-5 (merge to main when ready; start fresh branch for KAN-6)

## Project Status

### Shipped (in main)
- [x] Reddit scraping via Decodo API (1–5 subreddits, parallel, 3-strategy fallback)
- [x] AI analysis via OpenAI-compatible API (4 focus modes, parallel, Zod-validated)
- [x] MongoDB Atlas persistence for runs
- [x] Multi-page architecture (KAN-1): /discover, root redirect, TopNav
- [x] Favourites system (KAN-2): heart icon, PATCH /api/ideas/:runId/favourite, idea_id stamping
- [x] Research page (KAN-3): /research card grid, /research/[id] detail view, GET /api/ideas aggregation
- [x] Deep Research (KAN-4): SerpAPI + AI market synthesis, stage → researched
- [x] DeepSeek compatibility bugfix: max_tokens 6000, truncation salvage in parseJsonArray, finish_reason warnings

### Done on feature/KAN-5 (2026-07-18)
- [x] **KAN-5** — PoC Page & PRD Generation
  - [x] KAN-16 — Move to PoC button (researched-only), PoC badge stays on Research page
  - [x] KAN-17 — /poc grid of poc-stage ideas with PRD/Mockups status pills
  - [x] KAN-18 — Generate PRD with reasoning_effort='high' + thinking enabled (streaming); inline Markdown render; persisted
  - [x] KAN-19 — Blob download of <kebab-idea-name>-prd.md, no extra API call; Re-generate PRD
  - [x] KAN-54 — POST /api/ideas/[id]/move-to-poc (409 unless researched)
  - [x] KAN-55 — app/poc/page.tsx grid + GET /api/ideas?stage= filter
  - [x] KAN-56 — app/poc/[id]/page.tsx detail (idea + research + PRD panels, disabled Generate Mockups placeholder)
  - [x] KAN-57 — generatePRD() in lib/ai.ts + POST /api/ideas/[id]/generate-prd + prd_content on SaasIdea
  - [x] KAN-58 — download/re-generate UI in PoC detail view

### Roadmap

| Epic | Name | Status |
|------|------|--------|
| KAN-6 | UI Mockup Generation | To Do |

Live status is in JIRA (project KAN). Always query via Atlassian MCP.

## Blockers / Risks

- PRD generation takes ~1–2 min with high reasoning effort (verified 73s on deepseek-v4-flash); route has maxDuration=300
- KAN-6 (DALL-E mockups) requires an OpenAI image-capable key — current OPENAI_* env points at DeepSeek, which has no image API; may need a separate env var for the image provider
- SerpAPI free tier is 100 searches/month; each research run consumes ~4 searches

## Decisions Made

- **High-reasoning PRD call** (KAN-18 reference adapted): `reasoning_effort: "high"` (typed SDK param) + `thinking: { type: "enabled" }` (extra body via cast) on chat.completions.create; on OpenAI.BadRequestError retry once without both (providers like gpt-4o-mini reject them)
- **Streaming is mandatory for the PRD call**: non-streaming requests were terminated (~62s) while the model reasoned silently; generatePRD accumulates delta.content chunks (ignores delta.reasoning_content)
- **PRD prompt** enforces 9 numbered sections (exec summary → risks) with personas, user stories + acceptance criteria, data model, API surface — output pure Markdown, no fences
- **prd_content overwritten on re-generate** (no history), mirroring research re-runs
- **Shared UI extracted** to app/components/idea-detail.tsx (Field, LinkField, ResearchResultsSection, Spinner, focus-mode maps, scoreTone) — used by /research, /research/[id], /poc, /poc/[id]
- **Markdown rendering**: react-markdown + remark-gfm + @tailwindcss/typography (`@plugin` in globals.css), prose classes
- **Generate Mockups** rendered as disabled placeholder on /poc/[id] — KAN-6 owns mockup_images and the live button

## Key Files Changed in KAN-5

| File | Change |
|------|--------|
| `lib/types.ts` | prd_content? on SaasIdea |
| `lib/ai.ts` | generatePRD (streaming, high reasoning, fallback), PRD_SYSTEM_PROMPT |
| `app/api/ideas/route.ts` | stage query param filter |
| `app/api/ideas/[id]/move-to-poc/route.ts` | New — POST, 409 guard |
| `app/api/ideas/[id]/generate-prd/route.ts` | New — POST, maxDuration 300 |
| `app/components/idea-detail.tsx` | New — shared detail components |
| `app/research/page.tsx` | PoC badge; imports shared components |
| `app/research/[id]/page.tsx` | Active Move to PoC + View in PoC link; shared components |
| `app/poc/page.tsx` | Rewritten — poc-stage card grid |
| `app/poc/[id]/page.tsx` | New — detail + PRD generate/render/download |
| `app/globals.css` | @plugin @tailwindcss/typography |
| `package.json` | +react-markdown, +remark-gfm, +@tailwindcss/typography |
