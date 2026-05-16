# INSFORGE_API_KEY Usage

## Overview

`INSFORGE_API_KEY` authenticates the app with [Insforge](https://insforge.dev), an AI infrastructure platform. It is a **required** environment variable validated by Zod in `lib/env.ts` and cached via `getServerEnv()`.

The key is used by the Insforge SDK (`@insforge/sdk` v1.2.4) in `lib/insforge.ts`.

---

## Services Used

### 1. AI Chat Completions (`insforge.ai.chat.completions.create`)

Sends structured Reddit post/comment data to an LLM (default: `openai/gpt-4o-mini`) with a detailed system prompt. The AI returns a JSON array of 5–10 validated SaaS ideas, each scored 1–10 with market insights.

- **Model:** Configurable via `INSFORGE_MODEL`
- **Temperature:** 0.2
- **Max Tokens:** 2200

### 2. Database Persistence (`insforge.database.from(table).insert(records)`)

Optionally stores generated SaaS ideas into an Insforge-hosted database table.

- **Opt-in only:** Disabled unless `INSFORGE_RESULTS_TABLE` is set and the target table already exists.
- **Non-blocking:** Failures are logged but do not crash the workflow.

---

## Related Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `INSFORGE_API_KEY` | ✅ Yes | — | Authenticates all Insforge API calls |
| `INSFORGE_URL` | ❌ No | `https://api.insforge.dev` | API base URL |
| `INSFORGE_MODEL` | ❌ No | `openai/gpt-4o-mini` | LLM model for AI analysis |
| `INSFORGE_RESULTS_TABLE` | ❌ No | — | DB table name for optional persistence |
| `INSFORGE_TIMEOUT_MS` | ❌ No | `90000` | Timeout for AI API calls |

---

## Flow

1. The `POST /api/analyze` route (`app/api/analyze/route.ts`) receives a subreddit name
2. Reddit data is scraped and structured via `lib/reddit.ts`
3. `analyzeWithAI()` in `lib/insforge.ts` creates an Insforge client with the API key
4. Structured Reddit data is sent to the AI chat completions endpoint
5. The AI response is parsed, validated with Zod, and returned
6. If configured, results are optionally persisted to an Insforge database table
