import OpenAI from "openai";
import { jsonrepair } from "jsonrepair";
import { z } from "zod";

import { getServerEnv } from "@/lib/env";
import { getMongoClient } from "@/lib/db";
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

function parseJsonArray(raw: string): SaasIdea[] {
  const withoutCodeFence = raw.replace(/```json|```/gi, "").trim();
  const start = withoutCodeFence.indexOf("[");
  const end = withoutCodeFence.lastIndexOf("]");

  if (start === -1 || end === -1 || end < start) {
    throw new Error("AI response did not include a JSON array.");
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
          ? `Failed to parse AI JSON: ${repairError.message}`
          : "Failed to parse AI JSON.",
      );
    }
  }
}

function compactStructuredData(data: StructuredRedditData): StructuredRedditData {
  console.log(`\n📦 [COMPACT DATA] Preparing data for AI...`);
  console.log(`   Original posts: ${data.posts.length}`);
  console.log(`   AI post limit: ${AI_POST_LIMIT}`);

  const originalCommentCount = data.posts.reduce((sum, p) => sum + p.comments.length, 0);

  const compacted = {
    subreddit: data.subreddit,
    scrapedAt: data.scrapedAt,
    posts: data.posts.slice(0, AI_POST_LIMIT).map((post) => ({
      title: post.title,
      permalink: post.permalink,
      threadUrl: post.threadUrl,
      comments: post.comments.slice(0, AI_COMMENT_LIMIT),
    })),
  };

  const compactedCommentCount = compacted.posts.reduce((sum, p) => sum + p.comments.length, 0);

  console.log(`   Compacted posts: ${compacted.posts.length}`);
  console.log(`   Original comments: ${originalCommentCount}`);
  console.log(`   Compacted comments: ${compactedCommentCount}`);
  console.log(`   Compression ratio: ${((compactedCommentCount / originalCommentCount) * 100).toFixed(1)}%`);

  return compacted;
}

async function maybeStoreIdeas(
  mongodbUri: string | undefined,
  collection: string,
  subreddit: string,
  ideas: SaasIdea[],
): Promise<void> {
  if (!mongodbUri) {
    console.log(`\n💾 [STORAGE] No MONGODB_URI configured, skipping persistence`);
    return;
  }

  if (ideas.length === 0) {
    console.log(`\n💾 [STORAGE] No ideas to store`);
    return;
  }

  console.log(`\n💾 [STORAGE] Persisting ${ideas.length} ideas to MongoDB collection: ${collection}`);

  try {
    const client = getMongoClient(mongodbUri);
    const db = client.db();
    const analyzed_at = new Date().toISOString();

    await db.collection(collection).insertOne({ subreddit, ideas, analyzed_at });

    console.log(`   ✅ Successfully stored ${ideas.length} ideas`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error(`   ⚠️  Storage failed (non-blocking): ${errorMsg}`);
  }
}

export async function analyzeWithAI(data: StructuredRedditData): Promise<SaasIdea[]> {
  console.log(`\n\n${"=".repeat(80)}`);
  console.log(`🤖 [AI ANALYSIS] Starting idea generation...`);
  console.log(`   Subreddit: r/${data.subreddit}`);
  console.log(`   Posts: ${data.posts.length}`);
  console.log(`   Total Comments: ${data.posts.reduce((sum, p) => sum + p.comments.length, 0)}`);
  console.log("=".repeat(80));

  const env = getServerEnv();

  console.log(`\n⚙️  [CONFIG]`);
  console.log(`   OpenAI Base URL: ${env.openaiBaseUrl}`);
  console.log(`   Model: ${env.openaiModel}`);
  console.log(`   Timeout: ${env.openaiTimeoutMs}ms`);
  console.log(`   MongoDB: ${env.mongodbUri ? `enabled (collection: ${env.mongodbCollection})` : "disabled"}`);

  const compactData = compactStructuredData(data);
  const payloadSize = JSON.stringify(compactData).length;
  console.log(`   Payload Size: ${payloadSize} bytes (${(payloadSize / 1024).toFixed(2)} KB)`);

  console.log(`\n🔧 [CLIENT] Creating OpenAI client...`);
  const client = new OpenAI({
    apiKey: env.openaiApiKey,
    baseURL: env.openaiBaseUrl,
    timeout: env.openaiTimeoutMs,
  });
  console.log(`   ✅ Client created`);

  console.log(`\n🚀 [API CALL] Sending request to AI...`);
  console.log(`   Model: ${env.openaiModel}`);
  console.log(`   Temperature: 0.2`);
  console.log(`   Max Tokens: 2200`);
  console.log(`   System Prompt Length: ${SYSTEM_PROMPT.length} chars`);
  console.log(`   User Content Length: ${JSON.stringify(compactData).length} chars`);

  const requestStart = Date.now();
  const response = await client.chat.completions.create({
    model: env.openaiModel,
    temperature: 0.2,
    max_tokens: 2200,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: JSON.stringify(compactData) },
    ],
  });

  const requestElapsed = Date.now() - requestStart;
  console.log(`   ⏱️  AI Response Time: ${requestElapsed}ms (${(requestElapsed / 1000).toFixed(2)}s)`);

  console.log(`\n📤 [RESPONSE] Processing AI response...`);
  const rawContent = response.choices[0]?.message?.content ?? "";
  console.log(`   Raw Content Length: ${rawContent.length} chars`);
  console.log(`   First 100 chars: ${rawContent.slice(0, 100).replace(/\n/g, " ")}...`);

  console.log(`\n🔍 [PARSING] Extracting and validating ideas...`);
  const ideas = parseJsonArray(rawContent);

  console.log(`\n✨ [IDEAS GENERATED] ${ideas.length} SaaS ideas`);
  console.log("=".repeat(80));

  ideas.forEach((idea, index) => {
    console.log(`\n💡 [IDEA ${index + 1}/${ideas.length}]`);
    console.log(`   Name: ${idea.idea_name}`);
    console.log(`   Score: ${idea.score}/10`);
    console.log(`   Verdict: ${idea.verdict}`);
    console.log(`   Demand: ${idea.demand_level}`);
    console.log(`   Problem: ${idea.problem.slice(0, 80)}${idea.problem.length > 80 ? "..." : ""}`);
    console.log(`   Opportunity: ${idea.opportunity.slice(0, 80)}${idea.opportunity.length > 80 ? "..." : ""}`);
    console.log(`   Monetization: ${idea.monetization_model}`);
    console.log(`   Source Threads: ${idea.source_threads.length}`);
    idea.source_threads.forEach((thread, i) => {
      console.log(`      ${i + 1}. ${thread.title.slice(0, 60)}${thread.title.length > 60 ? "..." : ""}`);
    });
  });

  console.log(`\n${"=".repeat(80)}`);
  console.log(`📊 [SUMMARY]`);
  console.log(`   Total Ideas: ${ideas.length}`);
  console.log(`   Strong Ideas: ${ideas.filter((i) => i.verdict === "Strong").length}`);
  console.log(`   Decent Ideas: ${ideas.filter((i) => i.verdict === "Decent").length}`);
  console.log(`   Weak Ideas: ${ideas.filter((i) => i.verdict === "Weak").length}`);
  console.log(`   Avg Score: ${(ideas.reduce((sum, i) => sum + i.score, 0) / ideas.length).toFixed(2)}`);
  console.log(`   High Demand: ${ideas.filter((i) => i.demand_level === "High").length}`);
  console.log(`   Medium Demand: ${ideas.filter((i) => i.demand_level === "Medium").length}`);
  console.log(`   Low Demand: ${ideas.filter((i) => i.demand_level === "Low").length}`);
  console.log(`${"=".repeat(80)}\n`);

  await maybeStoreIdeas(env.mongodbUri, env.mongodbCollection, data.subreddit, ideas);

  return ideas;
}
