# Session Handoff

## Current Objective

- **Goal:** Evolve Validly from a single-page Reddit idea scraper into a multi-stage SaaS validation pipeline (Discover → Research → PoC)
- **Current status:** KAN-5 Done. Next epic: KAN-6 — UI Mockup Generation (final epic)
- **Branch:** `feature/KAN-5` — merge to main, then create `feature/KAN-6`

## Completed This Session

- [x] Bugfix (merged to main): DeepSeek truncation — max_tokens 6000, parseJsonArray salvage, finish_reason warnings
- [x] KAN-5: POST /api/ideas/[id]/move-to-poc (409 unless stage='researched')
- [x] KAN-5: GET /api/ideas?stage= filter; /poc grid with PRD/Mockups status pills
- [x] KAN-5: /poc/[id] detail — Generate PRD, inline Markdown render, Blob download, Re-generate
- [x] KAN-5: generatePRD in lib/ai.ts — reasoning_effort='high' + thinking enabled (KAN-18 reference), STREAMING (non-streaming was terminated at ~60s during silent reasoning), 400-fallback for non-reasoning providers
- [x] KAN-5: shared components extracted to app/components/idea-detail.tsx
- [x] KAN-5: Research page PoC badge + View in PoC link
- [x] Verified E2E against live MongoDB + DeepSeek (deepseek-v4-flash)

## Verification Evidence

| Check | Command | Result |
|-------|---------|--------|
| Lint | `npm run lint` | ✓ 0 errors, 0 warnings |
| Build | `npm run build` | ✓ All 16 routes compiled |
| E2E move | POST /api/ideas/:id/move-to-poc | ✓ 200 → stage 'poc'; repeat → 409 |
| E2E PRD | POST /api/ideas/:id/generate-prd | ✓ 200 in 73s; 24,336-char PRD, all 9 sections; persisted (fresh GET) |

## Architecture Notes for KAN-6

KAN-6 — UI Mockup Generation. Stories KAN-20, KAN-21; subtasks KAN-59, KAN-60, KAN-61. Re-confirm details in JIRA (user updates descriptions).

Per feature_list.json:
- Add `mockup_images?: string[]` to SaasIdea in lib/types.ts (KAN-59)
- `POST /api/ideas/[id]/generate-mockups` using OpenAI DALL-E; persist image URLs to MongoDB
- Gallery on /poc/[id] with per-image download and Download All ZIP
- The disabled "Generate Mockups" button + placeholder already render on /poc/[id] — wire them up
- The /poc grid "Mockups —" pill is hardcoded to the not-generated state — derive from mockup_images
- **Provider risk:** OPENAI_* currently points at DeepSeek, which has no image API. Likely need a dedicated env var (e.g. IMAGE_API_KEY / IMAGE_BASE_URL) or reuse OPENAI_* only when pointed at OpenAI — ask the user
- DALL-E URLs expire (~1h) — consider storing base64 or re-hosting; raise with user before implementing

## Blockers / Risks

- PRD generation ~1–2 min (high reasoning); generate-prd route maxDuration=300
- `MONGODB_URI` required for all stage-pipeline features
- JIRA MCP HTTP+SSE transport deprecated after June 30 2026; server still relaying migration notice → Streamable HTTP endpoint https://mcp.atlassian.com/v1/mcp

## Next Session Startup

1. Read `CLAUDE.md` for project overview and architecture.
2. Read `feature_list.json` for KAN-6 epic structure and done criteria.
3. **Query JIRA** (`project = KAN ORDER BY created ASC`) via Atlassian MCP — confirm KAN-6 is the remaining non-Done epic and fetch latest story/subtask descriptions.
4. Read `progress.md` for current state and key files.
5. Run `./init.sh` to confirm clean baseline before editing.
6. Implement KAN-6 only — it is the final epic in the roadmap.

## Recommended Next Step

**Merge `feature/KAN-5` to `main`, then start `feature/KAN-6`.**

First task in KAN-6:
- Fetch KAN-6 stories (KAN-20, KAN-21) and subtasks (KAN-59–61) from JIRA for latest acceptance criteria
- Resolve the image-provider question (DeepSeek has no image API) with the user before writing code
