import { NextResponse } from "next/server";
import { z } from "zod";

import { analyzeWithAI } from "@/lib/ai";
import { scrapeMultipleSubreddits } from "@/lib/reddit";

export const runtime = "nodejs";
export const maxDuration = 60;

const subredditNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(50)
  .regex(/^[A-Za-z0-9_]+$/, "Use subreddit names without /r/ or spaces")
  .transform((s) => s.replace(/^r\//i, ""));

const requestSchema = z.object({
  subreddits: z
    .array(subredditNameSchema)
    .min(1, "At least one subreddit is required")
    .max(5, "Maximum 5 subreddits")
    .transform((arr) => [...new Set(arr)]),
  timeRange: z.enum(["week", "month", "year", "all"]).default("week"),
  focusModes: z
    .array(z.enum(["pain-points", "revenue-first", "better-mousetrap", "emerging-trends"]))
    .min(1, "At least one focus mode is required")
    .max(4)
    .default(["pain-points"]),
});

function getErrorMessage(error: unknown): string {
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message ?? "Invalid request payload.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unexpected server error.";
}

export async function POST(request: Request) {
  try {
    const body = requestSchema.parse(await request.json());
    console.log(`[API] Starting analysis for r/${body.subreddits.join(", ")} | timeRange=${body.timeRange} | focusModes=${body.focusModes.join(", ")}`);

    const source = await scrapeMultipleSubreddits(body.subreddits, body.timeRange);
    console.log(`[API] Scraped ${source.posts.length} posts from ${source.subreddits.length} subreddit(s)`);

    const ideas = await analyzeWithAI(source, body.focusModes, body.timeRange);
    console.log(`[API] Generated ${ideas.length} ideas`);

    return NextResponse.json({
      subreddits: source.subreddits,
      source,
      ideas,
    });
  } catch (error) {
    console.error("[API] Error occurred:", error);
    const message = getErrorMessage(error);
    const status = error instanceof z.ZodError ? 400 : 500;

    return NextResponse.json(
      {
        error: message,
      },
      { status },
    );
  }
}
