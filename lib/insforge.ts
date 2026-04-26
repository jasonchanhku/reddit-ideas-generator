import { createClient } from "@insforge/sdk";
import { jsonrepair } from "jsonrepair";
import { z } from "zod";

import { getServerEnv } from "@/lib/env";
import type { SaasIdea, StructuredRedditData } from "@/lib/types";

const AI_POST_LIMIT = 8;
const AI_COMMENT_LIMIT = 3;

const sourceThreadSchema = z.object({
  title: z.string().trim().min(1),
  thread_url: z.string().trim().url(),
});

const ideaSchema = z.object({
  idea_name: z.string().trim().min(1),
  problem: z.string().trim().min(1),
  demand_level: z.enum(["Low", "Medium", "High"]),
  existing_solutions: z.array(z.string().trim()).default([]),
  similar_competitors: z.array(z.string().trim()).default([]),
  user_complaints: z.array(z.string().trim()).default([]),
  opportunity: z.string().trim().min(1),
  monetization_model: z.string().trim().min(1),
  pricing_hint: z.string().trim().min(1),
  revenue_potential: z.string().trim().min(1),
  go_to_market: z.string().trim().min(1),
  score: z.coerce.number().min(0).max(10),
  verdict: z.enum(["Weak", "Decent", "Strong"]),
  source_threads: z.array(sourceThreadSchema).min(1).max(3),
});

const ideaArraySchema = z.array(ideaSchema).min(5).max(10);

const SYSTEM_PROMPT = `You are an expert startup analyst and product researcher.

You analyze real user discussions and extract VALIDATED SaaS opportunities.

You MUST base all insights on the provided data.

Return 5 to 10 ideas.

Every idea must cite 1 to 3 source threads taken from the provided Reddit data.
Use the exact thread title and exact thread_url from the input data.

PROCESS:

Identify repeated problems or frustrations
Estimate demand based on frequency and intensity
Identify existing solutions (if implied)
Extract user complaints about those solutions
Generate a SaaS idea that improves on them
List the most similar competitors or adjacent products
Estimate realistic revenue potential and pricing logic
Explain how the product could go to market first
Score each idea from 1–10

OUTPUT STRICT JSON:

[
  {
    "idea_name": "",
    "problem": "",
    "demand_level": "Low | Medium | High",
    "existing_solutions": [],
    "similar_competitors": [],
    "user_complaints": [],
    "opportunity": "",
    "monetization_model": "",
    "pricing_hint": "",
    "revenue_potential": "",
    "go_to_market": "",
    "score": 0,
    "verdict": "Weak | Decent | Strong",
    "source_threads": [
      {
        "title": "",
        "thread_url": "https://www.reddit.com/..."
      }
    ]
  }
]

Do NOT return text outside JSON.
Keep output concise but meaningful.`;

function extractMessageContent(response: unknown): string {
  const record = response as Record<string, unknown>;

  const directContent =
    (record?.choices as Array<Record<string, unknown>> | undefined)?.[0]?.message &&
    typeof ((record.choices as Array<Record<string, unknown>>)[0].message as Record<string, unknown>).content === "string"
      ? (((record.choices as Array<Record<string, unknown>>)[0].message as Record<string, unknown>).content as string)
      : undefined;

  if (directContent) {
    return directContent;
  }

  const nestedData = record?.data as Record<string, unknown> | undefined;
  const nestedChoices = nestedData?.choices as Array<Record<string, unknown>> | undefined;

  if (
    nestedChoices?.[0]?.message &&
    typeof (nestedChoices[0].message as Record<string, unknown>).content === "string"
  ) {
    return (nestedChoices[0].message as Record<string, unknown>).content as string;
  }

  if (typeof nestedData?.response === "string") {
    return nestedData.response;
  }

  if (typeof record?.response === "string") {
    return record.response;
  }

  throw new Error("Insforge AI response did not contain a readable message payload.");
}

function parseJsonArray(raw: string): SaasIdea[] {
  const withoutCodeFence = raw.replace(/```json|```/gi, "").trim();
  const start = withoutCodeFence.indexOf("[");
  const end = withoutCodeFence.lastIndexOf("]");

  if (start === -1 || end === -1 || end < start) {
    throw new Error("Insforge AI response did not include a JSON array.");
  }

  const candidate = withoutCodeFence.slice(start, end + 1);

  try {
    return ideaArraySchema.parse(JSON.parse(candidate));
  } catch {
    try {
      return ideaArraySchema.parse(JSON.parse(jsonrepair(candidate)));
    } catch (repairError) {
      throw new Error(
        repairError instanceof Error
          ? `Failed to parse Insforge AI JSON: ${repairError.message}`
          : "Failed to parse Insforge AI JSON.",
      );
    }
  }
}

function compactStructuredData(data: StructuredRedditData): StructuredRedditData {
  return {
    subreddit: data.subreddit,
    scrapedAt: data.scrapedAt,
    posts: data.posts.slice(0, AI_POST_LIMIT).map((post) => ({
      title: post.title,
      permalink: post.permalink,
      threadUrl: post.threadUrl,
      comments: post.comments.slice(0, AI_COMMENT_LIMIT),
    })),
  };
}

async function maybeStoreIdeas(
  table: string | undefined,
  subreddit: string,
  ideas: SaasIdea[],
): Promise<void> {
  if (!table || ideas.length === 0) {
    return;
  }

  const { insforgeApiKey, insforgeUrl, insforgeTimeoutMs } = getServerEnv();
  const insforge = createClient({
    baseUrl: insforgeUrl,
    anonKey: insforgeApiKey,
    isServerMode: true,
    timeout: insforgeTimeoutMs,
    retryCount: 1,
    headers: {
      Authorization: `Bearer ${insforgeApiKey}`,
      "X-API-Key": insforgeApiKey,
    },
  });

  try {
    await insforge.database.from(table).insert(
      ideas.map((idea) => ({
        subreddit,
        ...idea,
        analyzed_at: new Date().toISOString(),
      })),
    );
  } catch {
    // Optional persistence should never block the core workflow.
  }
}

export async function analyzeWithAI(data: StructuredRedditData): Promise<SaasIdea[]> {
  const env = getServerEnv();
  const compactData = compactStructuredData(data);
  const insforge = createClient({
    baseUrl: env.insforgeUrl,
    anonKey: env.insforgeApiKey,
    isServerMode: true,
    timeout: env.insforgeTimeoutMs,
    retryCount: 1,
    headers: {
      Authorization: `Bearer ${env.insforgeApiKey}`,
      "X-API-Key": env.insforgeApiKey,
    },
  });

  const response = await insforge.ai.chat.completions.create({
    model: env.insforgeModel,
    temperature: 0.2,
    maxTokens: 2200,
    messages: [
      {
        role: "system",
        content: SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: JSON.stringify(compactData),
      },
    ],
  } as never);

  const ideas = parseJsonArray(extractMessageContent(response));
  await maybeStoreIdeas(env.insforgeResultsTable, data.subreddit, ideas);

  return ideas;
}