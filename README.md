# Validly

Validly is a Next.js App Router application that turns weekly Reddit discussions into validated SaaS opportunities.

## Workflow

1. Scrape Reddit HTML with the Decodo Scraping API.
2. Parse post titles plus the top 2–3 comments with Cheerio.
3. Send structured discussion data to Insforge AI.
4. Return scored SaaS ideas, market gaps, and user complaints.

## Tech Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Cheerio
- Zod
- Insforge SDK

## Environment Variables

Copy `.env.example` to `.env.local` and set:

```bash
DECODO_API_KEY=your_decodo_api_key
INSFORGE_API_KEY=your_insforge_api_key
```

Optional overrides:

```bash
INSFORGE_URL=https://api.insforge.dev
INSFORGE_MODEL=openai/gpt-4o-mini
INSFORGE_RESULTS_TABLE=validated_saas_ideas
```

`INSFORGE_URL` is optional in this project because the code falls back to `https://api.insforge.dev`, but Insforge projects commonly use a project-specific base URL. Set it explicitly if your workspace uses a dedicated Insforge deployment.

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## API

`POST /api/analyze`

Request body:

```json
{
	"subreddit": "saas"
}
```

Response shape:

```json
{
	"subreddit": "saas",
	"source": {
		"subreddit": "saas",
		"scrapedAt": "2026-04-13T00:00:00.000Z",
		"posts": [
			{
				"title": "...",
				"comments": ["...", "..."],
				"permalink": "/r/saas/comments/..."
			}
		]
	},
	"ideas": [
		{
			"idea_name": "...",
			"problem": "...",
			"demand_level": "High",
			"existing_solutions": ["..."],
			"user_complaints": ["..."],
			"opportunity": "...",
			"score": 8,
			"verdict": "Strong"
		}
	]
}
```

## Notes

- The Decodo integration is intentionally resilient and tries multiple auth and payload conventions because Decodo account setups can differ.
- Optional Insforge persistence is disabled unless `INSFORGE_RESULTS_TABLE` is set and the target table already exists.
- The route validates both request input and AI output before returning data to the UI.
