import OpenAI from "openai";
import { jsonrepair } from "jsonrepair";
import { z } from "zod";

import { getServerEnv } from "@/lib/env";
import { getDb } from "@/lib/db";
import type { FocusMode, SaasIdea, StructuredRedditData, TimeRange } from "@/lib/types";

const AI_POST_LIMIT = 8;
const AI_COMMENT_LIMIT = 3;

const sourceThreadSchema = z.object({
  title: z.string().trim().min(1),
  thread_url: z.string().trim().url(),
});

// Coerces objects (e.g. {"name": "Acme", "pricing": "$99/mo"}) to flat strings.
// Some focus modes prompt the AI to include extra detail, which causes it to return
// objects instead of plain strings despite the JSON schema instruction.
const coercedString = z.string().trim().or(
  z.record(z.string(), z.unknown()).transform((obj) => {
    const parts = Object.values(obj).filter((v): v is string => typeof v === "string");
    return parts.join(" — ") || JSON.stringify(obj);
  }),
);

const ideaSchema = z.object({
  idea_name: z.string().trim().min(1),
  problem: z.string().trim().min(1),
  demand_level: z.enum(["Low", "Medium", "High"]),
  existing_solutions: z.array(coercedString).default([]),
  similar_competitors: z.array(coercedString).default([]),
  user_complaints: z.array(coercedString).default([]),
  opportunity: z.string().trim().min(1),
  monetization_model: z.string().trim().min(1),
  pricing_hint: z.string().trim().min(1),
  revenue_potential: z.string().trim().min(1),
  go_to_market: z.string().trim().min(1),
  score: z.coerce.number().min(0).max(10),
  verdict: z.enum(["Weak", "Decent", "Strong"]),
  source_threads: z.array(sourceThreadSchema).min(1).max(3),
});

const ideaArraySchema = z.array(ideaSchema).min(1).max(10);

const SHARED_OUTPUT_BLOCK = `
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

const SYSTEM_PROMPTS: Record<FocusMode, string> = {
  "pain-points": `You are an expert startup analyst and product researcher.

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
${SHARED_OUTPUT_BLOCK}`,

  "revenue-first": `You are a revenue-focused SaaS analyst.

You scan Reddit conversations looking specifically for signals of willingness to pay and existing spend patterns.
Prioritise ideas where users are already paying for inferior substitutes, mentioning price, or expressing budget frustration.
Ignore problems people merely complain about but would never pay to solve.

Return 5 to 10 ideas.

Every idea must cite 1 to 3 source threads taken from the provided Reddit data.
Use the exact thread title and exact thread_url from the input data.

PROCESS:

Identify threads where money is explicitly or implicitly on the table
Estimate demand based on how many people are already paying for something similar
List what users currently spend on and why it falls short
Generate a SaaS idea targeting that spend with a tighter, cheaper, or better solution
List the most similar competitors and their pricing tiers
Set a realistic price point users would switch to
Explain the fastest path to first dollar (not first user)
Score each idea 1–10 weighted heavily toward monetisation likelihood

REVENUE POTENTIAL FIELD — CRITICAL INSTRUCTION:
For revenue_potential, actively mine the thread data for any quantitative signals users mention:
- Dollar amounts they currently pay (e.g. "paying $200/mo for X")
- ARR/MRR or revenue figures quoted by founders or users
- App download counts or user numbers users reference
- Pricing tiers of named competitors
- Budget figures users mention they have available
Quote these verbatim as evidence (e.g. "Thread mentions users paying $200/mo for X; 3 competitors at $99–$299/mo suggests $149/mo SaaS pricing viable"). If no figures appear in the threads, estimate from market signals and state it is an estimate.
${SHARED_OUTPUT_BLOCK}`,

  "better-mousetrap": `You are a product differentiation analyst.

You look for crowded markets where users are complaining that every existing solution has the same flaw.
Your goal is to find the one specific gap that all incumbents share and design a SaaS that wins on that single axis.

Return 5 to 10 ideas.

Every idea must cite 1 to 3 source threads taken from the provided Reddit data.
Use the exact thread title and exact thread_url from the input data.

PROCESS:

Identify markets where 3 or more solutions exist but users still complain
Find the shared weakness across all named competitors in the thread
Propose a SaaS that solves only that weakness and does it significantly better
Be explicit about the single differentiating feature — do not describe a full-feature clone
List the incumbents and their shared flaw in existing_solutions and similar_competitors
Estimate whether the differentiation alone is enough to cause switching
Score each idea 1–10 weighted toward feasibility of the wedge
${SHARED_OUTPUT_BLOCK}`,

  "emerging-trends": `You are a trend-spotting SaaS analyst.

You look for new tools, workflows, technologies, or behaviours that users are just starting to adopt.
Your goal is to find categories that do not yet have a clear dominant player — early-stage markets where a new entrant could define the category.

Return 5 to 10 ideas.

Every idea must cite 1 to 3 source threads taken from the provided Reddit data.
Use the exact thread title and exact thread_url from the input data.

PROCESS:

Identify threads discussing new workflows, recently emerged tools, or changing behaviours
Look for questions like "is there a tool for X?" where X is a behaviour under 2 years old
Propose a SaaS that could become the default in that emerging category
List any early-stage competitors or workarounds users are currently cobbling together in existing_solutions
Estimate the market formation timeline in revenue_potential: is this 6 months or 2 years from mainstream adoption?
Score each idea 1–10 weighted toward category-defining potential and timing advantage
${SHARED_OUTPUT_BLOCK}`,
};

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
    subreddits: data.subreddits,
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

  return compacted;
}

async function runSingleAnalysis(
  client: OpenAI,
  compactData: StructuredRedditData,
  focusMode: FocusMode,
  env: ReturnType<typeof getServerEnv>,
): Promise<SaasIdea[]> {
  const systemPrompt = SYSTEM_PROMPTS[focusMode];

  console.log(`\n🚀 [AI CALL] Mode: ${focusMode} | Model: ${env.openaiModel}`);

  const requestStart = Date.now();
  const response = await client.chat.completions.create({
    model: env.openaiModel,
    temperature: 0.2,
    max_tokens: 2200,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: JSON.stringify(compactData) },
    ],
  });

  const elapsed = Date.now() - requestStart;
  console.log(`   ⏱️  [${focusMode}] Response: ${elapsed}ms`);

  const rawContent = response.choices[0]?.message?.content ?? "";
  const ideas = parseJsonArray(rawContent);

  console.log(`   ✅ [${focusMode}] Parsed ${ideas.length} ideas`);

  return ideas.map((idea) => ({ ...idea, focus_mode: focusMode }));
}

async function maybeStoreIdeas(
  mongodbUri: string | undefined,
  dbName: string,
  collection: string,
  subreddits: string[],
  focusModes: FocusMode[],
  timeRange: TimeRange,
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

  console.log(`\n💾 [STORAGE] Persisting ${ideas.length} ideas to ${dbName}.${collection}`);

  try {
    const db = await getDb(mongodbUri, dbName);
    const analyzed_at = new Date().toISOString();

    await db.collection(collection).insertOne({ subreddits, focusModes, timeRange, ideas, analyzed_at });

    console.log(`   ✅ Successfully stored ${ideas.length} ideas`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error(`   ⚠️  Storage failed (non-blocking): ${errorMsg}`);
  }
}

export async function analyzeWithAI(data: StructuredRedditData, focusModes: FocusMode[] = ["pain-points"], timeRange: TimeRange = "week"): Promise<SaasIdea[]> {
  console.log(`\n\n${"=".repeat(80)}`);
  console.log(`🤖 [AI ANALYSIS] Starting idea generation...`);
  console.log(`   Subreddits: ${data.subreddits.join(", ")}`);
  console.log(`   Focus Modes: ${focusModes.join(", ")}`);
  console.log(`   Posts: ${data.posts.length}`);
  console.log("=".repeat(80));

  const env = getServerEnv();

  console.log(`\n⚙️  [CONFIG]`);
  console.log(`   OpenAI Base URL: ${env.openaiBaseUrl}`);
  console.log(`   Model: ${env.openaiModel}`);
  console.log(`   Timeout: ${env.openaiTimeoutMs}ms`);
  console.log(`   MongoDB: ${env.mongodbUri ? `enabled (${env.mongodbDbName}.${env.mongodbCollection})` : "disabled"}`);

  const compactData = compactStructuredData(data);
  const payloadSize = JSON.stringify(compactData).length;
  console.log(`   Payload Size: ${payloadSize} bytes (${(payloadSize / 1024).toFixed(2)} KB)`);

  const client = new OpenAI({
    apiKey: env.openaiApiKey,
    baseURL: env.openaiBaseUrl,
    timeout: env.openaiTimeoutMs,
  });

  console.log(`\n🔄 [PARALLEL AI] Running ${focusModes.length} mode(s) in parallel...`);

  const allResults = await Promise.all(
    focusModes.map((mode) => runSingleAnalysis(client, compactData, mode, env)),
  );

  // Merge, deduplicate by normalized idea_name (keep highest score), sort by score desc
  const seen = new Map<string, SaasIdea>();
  for (const ideas of allResults) {
    for (const idea of ideas) {
      const key = idea.idea_name.toLowerCase().trim();
      const existing = seen.get(key);
      if (!existing || idea.score > existing.score) {
        seen.set(key, idea);
      }
    }
  }

  const merged = Array.from(seen.values()).sort((a, b) => b.score - a.score);

  console.log(`\n✨ [IDEAS GENERATED] ${merged.length} unique SaaS ideas across ${focusModes.length} mode(s)`);
  console.log("=".repeat(80));

  merged.forEach((idea, index) => {
    console.log(`\n💡 [IDEA ${index + 1}/${merged.length}] [${idea.focus_mode}]`);
    console.log(`   Name: ${idea.idea_name}`);
    console.log(`   Score: ${idea.score}/10 | Verdict: ${idea.verdict} | Demand: ${idea.demand_level}`);
    console.log(`   Problem: ${idea.problem.slice(0, 80)}${idea.problem.length > 80 ? "..." : ""}`);
  });

  console.log(`\n${"=".repeat(80)}`);
  console.log(`📊 [SUMMARY]`);
  console.log(`   Total Ideas: ${merged.length}`);
  console.log(`   Strong: ${merged.filter((i) => i.verdict === "Strong").length} | Decent: ${merged.filter((i) => i.verdict === "Decent").length} | Weak: ${merged.filter((i) => i.verdict === "Weak").length}`);
  console.log(`   Avg Score: ${(merged.reduce((sum, i) => sum + i.score, 0) / merged.length).toFixed(2)}`);
  console.log(`${"=".repeat(80)}\n`);

  await maybeStoreIdeas(env.mongodbUri, env.mongodbDbName, env.mongodbCollection, data.subreddits, focusModes, timeRange, merged);

  return merged;
}
