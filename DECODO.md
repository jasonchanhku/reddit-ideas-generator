# DECODO_API_KEY Usage

## Overview

`DECODO_API_KEY` authenticates the app with [Decodo](https://visit.decodo.com/oNza7b), a web scraping API service. It is a **required** environment variable validated by Zod in `lib/env.ts` and cached via `getServerEnv()`.

The key is used for all scraping calls in `lib/reddit.ts`.

---

## Service Used

### Web Scraping API (`POST https://scraper-api.decodo.com/v2/scrape`)

Decodo fetches raw HTML from Reddit pages. The app targets `old.reddit.com` specifically, scraping both the subreddit top-weekly listing page and individual post comment threads.

**Request method:** `POST`  
**Content-Type:** `application/json`  

---

## Authentication

The API key is sent via the `Authorization` header. The code auto-prefixes `Basic ` if the key doesn't already start with `Basic` or `Bearer`:

```
Authorization: Basic <DECODO_API_KEY>
```

Additionally, when using the Insforge SDK client (for persistence), the key is also duplicated as:
```
Authorization: Bearer <DECODO_API_KEY>
X-API-Key: <DECODO_API_KEY>
```

---

## Resilience: Three Strategies

Decodo account setups can differ, so the integration tries up to **three request-body strategies** in sequence, caching whichever succeeds first for future calls:

### Strategy 1 — `web-scraping-api-fast`
Minimal payload — only the URL and proxy pool.

```json
{
  "url": "https://old.reddit.com/r/saas/top/?t=week",
  "proxy_pool": "premium"
}
```

### Strategy 2 — `web-scraping-api`
Adds a `headless` parameter.

```json
{
  "url": "https://old.reddit.com/r/saas/top/?t=week",
  "proxy_pool": "premium",
  "headless": "html"
}
```

### Strategy 3 — `web-scraping-api-render-flag`
Same as Strategy 2 but also sets `render: true`.

```json
{
  "url": "https://old.reddit.com/r/saas/top/?t=week",
  "proxy_pool": "premium",
  "headless": "html",
  "render": true
}
```

---

## Request Parameters

| Parameter | Source | Description |
|---|---|---|
| `url` | Hardcoded | `old.reddit.com` URL (subreddit top/week or post permalink) |
| `proxy_pool` | `DECODO_PROXY_POOL` env var | Proxy pool type |
| `headless` | `DECODO_HEADLESS_MODE` env var | Headless browser mode |
| `render` | Strategy 3 only | Forces JavaScript rendering |

---

## Response Handling

Decodo may return:
- **Direct HTML** — used as-is
- **JSON** — the code recursively searches for an HTML string in common keys (`html`, `content`, `body`, `result`, `results`, `data`, `response`, `source`) and nested objects

The extracted HTML is then parsed with **Cheerio** to extract post titles, permalinks, and comments.

---

## Related Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DECODO_API_KEY` | ✅ Yes | — | Authenticates all Decodo scraping requests |
| `DECODO_PROXY_POOL` | ❌ No | `premium` | Proxy pool type (e.g., `residential`) |
| `DECODO_HEADLESS_MODE` | ❌ No | `html` | Headless browser mode (e.g., `true`) |
| `DECODO_TIMEOUT_MS` | ❌ No | `20000` | Timeout per scraping request in ms |

---

## Flow

1. The `POST /api/analyze` route calls `structureRedditData(subreddit)`
2. `scrapeReddit()` fetches the subreddit's top-weekly page via Decodo
3. `extractPostCandidates()` parses the HTML with Cheerio to find up to 8 posts
4. For each post, `fetchCommentsForPost()` scrapes the individual thread page via Decodo
5. Comment fetching runs in batches of 4 concurrent requests (`COMMENT_FETCH_CONCURRENCY`)
6. The structured data (posts + comments) is then sent to Insforge AI for analysis
