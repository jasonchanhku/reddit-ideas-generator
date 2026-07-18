import { randomUUID } from "crypto";

import OpenAI from "openai";
import { jsonrepair } from "jsonrepair";
import { z } from "zod";

import { getServerEnv } from "@/lib/env";
import { getDb } from "@/lib/db";
import type { ResearchSearch } from "@/lib/research";
import type { FocusMode, ResearchResults, SaasIdea, StructuredRedditData, TimeRange } from "@/lib/types";

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

const researchResultsSchema = z.object({
  market_size: z.string().trim().min(1),
  niche_size: z.string().trim().min(1),
  competitors: z
    .array(
      z.object({
        name: z.string().trim().min(1),
        strengths: coercedString,
        pricing: coercedString,
        gap: coercedString,
      }),
    )
    .min(1),
  competitive_gap: z.string().trim().min(1),
  adjacent_trends: z.string().trim().min(1),
  beachhead_sizing: z.string().trim().min(1),
  key_risks: z.array(coercedString).min(1),
  monetisation_angles: z.array(coercedString).min(1),
  summary: z.string().trim().min(1),
  sources: z
    .array(
      z.object({
        title: z.string().trim().min(1),
        url: z.string().trim().url(),
      }),
    )
    .min(1),
});

const RESEARCH_SYSTEM_PROMPT = `You are a market research analyst producing an investment-grade brief for a SaaS idea.

You are given: (1) the idea's data mined from Reddit, and (2) fresh web search results (title, url, snippet per result).

Synthesise BOTH into a structured research brief. Ground every claim in the web snippets where possible.

REQUIREMENTS:

- market_size: total market size and growth for the relevant category (TAM, CAGR). Market figures vary by research firm — present them as directional midpoints, never false precision (e.g. "roughly $4–6B growing ~12% CAGR").
- niche_size: the specific sub-segment / niche size and momentum this idea targets.
- competitors: name REAL competitors found in the search results or idea data. For each: what they are good at (strengths), their pricing, and where their gap is.
- competitive_gap: the single most exploitable gap across the landscape.
- adjacent_trends: any trend the idea rides — new hardware, platform shift, regulation, demographic change.
- beachhead_sizing: size the chosen beachhead — how many reachable people, willingness-to-pay signals.
- key_risks: the 2-5 biggest risks to this idea.
- monetisation_angles: 2-5 concrete monetisation approaches with pricing logic.
- summary: a 3-5 sentence synthesis verdict on the idea's validation status.
- sources: cite ONLY urls that appear in the provided search results. Include every source you relied on.

OUTPUT STRICT JSON:

{
  "market_size": "",
  "niche_size": "",
  "competitors": [
    { "name": "", "strengths": "", "pricing": "", "gap": "" }
  ],
  "competitive_gap": "",
  "adjacent_trends": "",
  "beachhead_sizing": "",
  "key_risks": [],
  "monetisation_angles": [],
  "summary": "",
  "sources": [
    { "title": "", "url": "https://..." }
  ]
}

Do NOT return text outside JSON.`;

export function parseJsonArray(raw: string): SaasIdea[] {
  const withoutCodeFence = raw.replace(/```json|```/gi, "").trim();
  const start = withoutCodeFence.indexOf("[");
  const end = withoutCodeFence.lastIndexOf("]");

  if (start === -1 || end === -1 || end < start) {
    throw new Error("AI response did not include a JSON array.");
  }

  const candidate = withoutCodeFence.slice(start, end + 1);

  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch {
    try {
      parsed = JSON.parse(jsonrepair(candidate));
    } catch (repairError) {
      throw new Error(
        repairError instanceof Error
          ? `Failed to parse AI JSON: ${repairError.message}`
          : "Failed to parse AI JSON.",
      );
    }
  }

  const full = ideaArraySchema.safeParse(parsed);
  if (full.success) {
    return full.data;
  }

  // A completion truncated by max_tokens leaves a half-written final object that
  // jsonrepair closes early; keep the ideas that came through complete.
  if (Array.isArray(parsed)) {
    const salvaged = parsed
      .map((item) => ideaSchema.safeParse(item))
      .filter((result) => result.success)
      .map((result) => result.data)
      .slice(0, 10);

    if (salvaged.length > 0) {
      console.warn(
        `   ⚠️  Dropped ${parsed.length - salvaged.length} incomplete idea(s) from AI response (likely truncated output)`,
      );
      return salvaged;
    }
  }

  throw new Error(`Failed to parse AI JSON: ${full.error.message}`);
}

function parseResearchObject(raw: string): z.infer<typeof researchResultsSchema> {
  const withoutCodeFence = raw.replace(/```json|```/gi, "").trim();
  const start = withoutCodeFence.indexOf("{");
  const end = withoutCodeFence.lastIndexOf("}");

  if (start === -1 || end === -1 || end < start) {
    throw new Error("AI research response did not include a JSON object.");
  }

  const candidate = withoutCodeFence.slice(start, end + 1);

  try {
    return researchResultsSchema.parse(JSON.parse(candidate));
  } catch {
    try {
      return researchResultsSchema.parse(JSON.parse(jsonrepair(candidate)));
    } catch (repairError) {
      throw new Error(
        repairError instanceof Error
          ? `Failed to parse AI research JSON: ${repairError.message}`
          : "Failed to parse AI research JSON.",
      );
    }
  }
}

export async function runResearchAnalysis(
  idea: SaasIdea,
  searches: ResearchSearch[],
): Promise<ResearchResults> {
  const env = getServerEnv();

  const client = new OpenAI({
    apiKey: env.openaiApiKey,
    baseURL: env.openaiBaseUrl,
    timeout: env.openaiTimeoutMs,
  });

  // Strip fields the model doesn't need (and any previous research run)
  const { research_results: _previous, run_id: _runId, ...ideaForPrompt } = idea;
  void _previous;
  void _runId;

  const totalResults = searches.reduce((sum, s) => sum + s.results.length, 0);
  console.log(`\n🧪 [RESEARCH AI] Synthesising "${idea.idea_name}" from ${totalResults} search results | Model: ${env.openaiModel}`);

  const requestStart = Date.now();
  const response = await client.chat.completions.create({
    model: env.openaiModel,
    temperature: 0.2,
    max_tokens: 6000,
    messages: [
      { role: "system", content: RESEARCH_SYSTEM_PROMPT },
      { role: "user", content: JSON.stringify({ idea: ideaForPrompt, web_searches: searches }) },
    ],
  });

  console.log(`   ⏱️  [RESEARCH AI] Response: ${Date.now() - requestStart}ms`);

  if (response.choices[0]?.finish_reason === "length") {
    console.warn(`   ⚠️  [RESEARCH AI] Completion hit the max_tokens cap — output may be truncated`);
  }

  const rawContent = response.choices[0]?.message?.content ?? "";
  const parsed = parseResearchObject(rawContent);

  console.log(`   ✅ [RESEARCH AI] Parsed research: ${parsed.competitors.length} competitors, ${parsed.sources.length} sources`);

  return { ...parsed, researched_at: new Date().toISOString() };
}

const PRD_SYSTEM_PROMPT = `You are a senior product manager writing an exhaustive Product Requirements Document (PRD) for a SaaS idea.

The PRD will be handed VERBATIM to AI coding and design agents (Claude Code, Claude Design) as their only specification. It must be super detailed and fully self-contained — no external references, no "see above", no placeholders. Assume the reader has zero context beyond this document.

You are given the idea's data mined from Reddit plus deep market research results (market sizing, competitors, pricing, gaps, risks). Ground every section in that data — quote competitor names, pricing points, and market figures wherever relevant.

REQUIRED STRUCTURE (Markdown, in this order):

# <Product Name> — Product Requirements Document
## 1. Executive Summary — the product in one paragraph, the wedge, and why now
## 2. Problem Statement — the validated pain, who feels it, evidence from the source data
## 3. Target Users & Personas — 2-4 concrete personas with goals, frustrations, willingness-to-pay signals
## 4. Feature List
### 4.1 MVP Features — each as a user story with numbered acceptance criteria, detailed enough to implement without follow-up questions
### 4.2 Post-MVP Roadmap — later phases, briefly
## 5. Success Metrics — activation, retention, and revenue metrics with concrete targets
## 6. Technical Considerations — suggested stack, data model sketch (entities + key fields), API surface (endpoints with methods), third-party integrations
## 7. Competitive Positioning — incumbents, their pricing, the exploitable gap, and how this product wins
## 8. Go-to-Market Notes — beachhead audience, first channels, pricing strategy with tiers
## 9. Risks & Mitigations

Write in full sentences with specifics. Prefer depth over brevity — this document's quality directly determines the quality of the code and designs generated from it.

OUTPUT: pure Markdown only. Do NOT wrap the document in code fences. Do NOT return JSON or commentary outside the document.`;

function stripWrappingCodeFence(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/);
  return match ? match[1].trim() : trimmed;
}

export async function generatePRD(idea: SaasIdea): Promise<string> {
  const env = getServerEnv();

  const client = new OpenAI({
    apiKey: env.openaiApiKey,
    baseURL: env.openaiBaseUrl,
    // High-effort reasoning + long output can far exceed the default request timeout
    timeout: Math.max(env.openaiTimeoutMs, 240_000),
  });

  const { run_id: _runId, prd_content: _previousPrd, ...ideaForPrompt } = idea;
  void _runId;
  void _previousPrd;

  console.log(`\n📝 [PRD AI] Generating PRD for "${idea.idea_name}" | Model: ${env.openaiModel} | reasoning_effort: high`);

  // Streaming is required here: high-effort reasoning models think silently for
  // minutes before the first output token, and idle non-streaming connections
  // get terminated by intermediate gateways.
  const baseParams: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
    model: env.openaiModel,
    max_tokens: 8000,
    stream: true,
    messages: [
      { role: "system", content: PRD_SYSTEM_PROMPT },
      { role: "user", content: JSON.stringify({ idea: ideaForPrompt }) },
    ],
  };

  // Adapted from the DeepSeek reference: reasoning_effort="high" +
  // extra_body={"thinking": {"type": "enabled"}}. The SDK passes the extra
  // `thinking` key through at runtime; the cast is only for TypeScript.
  const reasoningParams = {
    ...baseParams,
    reasoning_effort: "high",
    thinking: { type: "enabled" },
  } as OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming;

  async function collectStream(
    params: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming,
  ): Promise<{ content: string; finishReason: string | null }> {
    const stream = await client.chat.completions.create(params);
    let content = "";
    let finishReason: string | null = null;
    for await (const chunk of stream) {
      const choice = chunk.choices[0];
      if (choice?.delta?.content) content += choice.delta.content;
      if (choice?.finish_reason) finishReason = choice.finish_reason;
    }
    return { content, finishReason };
  }

  const requestStart = Date.now();
  let result: { content: string; finishReason: string | null };
  try {
    result = await collectStream(reasoningParams);
  } catch (error) {
    // Providers without reasoning support (e.g. OpenAI gpt-4o-mini) reject the
    // extra params with a 400 — retry once without them.
    if (error instanceof OpenAI.BadRequestError) {
      console.warn(`   ⚠️  [PRD AI] Provider rejected reasoning params (${error.message}) — retrying without them`);
      result = await collectStream(baseParams);
    } else {
      throw error;
    }
  }

  console.log(`   ⏱️  [PRD AI] Response: ${Date.now() - requestStart}ms`);

  if (result.finishReason === "length") {
    console.warn(`   ⚠️  [PRD AI] Completion hit the max_tokens cap — PRD may be truncated`);
  }

  const prd = stripWrappingCodeFence(result.content);

  if (!prd) {
    throw new Error("AI returned an empty PRD.");
  }

  console.log(`   ✅ [PRD AI] Generated PRD: ${prd.length} chars`);

  return prd;
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
    max_tokens: 6000,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: JSON.stringify(compactData) },
    ],
  });

  const elapsed = Date.now() - requestStart;
  console.log(`   ⏱️  [${focusMode}] Response: ${elapsed}ms`);

  if (response.choices[0]?.finish_reason === "length") {
    console.warn(`   ⚠️  [${focusMode}] Completion hit the max_tokens cap — output may be truncated`);
  }

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
): Promise<{ ideas: SaasIdea[]; runId: string | null }> {
  if (!mongodbUri) {
    console.log(`\n💾 [STORAGE] No MONGODB_URI configured, skipping persistence`);
    return { ideas, runId: null };
  }

  if (ideas.length === 0) {
    console.log(`\n💾 [STORAGE] No ideas to store`);
    return { ideas, runId: null };
  }

  console.log(`\n💾 [STORAGE] Persisting ${ideas.length} ideas to ${dbName}.${collection}`);

  try {
    const db = await getDb(mongodbUri, dbName);
    const analyzed_at = new Date().toISOString();

    const ideasWithIds = ideas.map((idea) => ({
      ...idea,
      idea_id: randomUUID(),
      is_favourite: false,
      stage: "discovery",
    }));

    const result = await db.collection(collection).insertOne({
      subreddits,
      focusModes,
      timeRange,
      ideas: ideasWithIds,
      analyzed_at,
    });

    console.log(`   ✅ Successfully stored ${ideasWithIds.length} ideas`);
    return { ideas: ideasWithIds, runId: result.insertedId.toString() };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error(`   ⚠️  Storage failed (non-blocking): ${errorMsg}`);
    return { ideas, runId: null };
  }
}

export async function analyzeWithAI(
  data: StructuredRedditData,
  focusModes: FocusMode[] = ["pain-points"],
  timeRange: TimeRange = "week",
): Promise<{ ideas: SaasIdea[]; runId: string | null }> {
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

  const { ideas: finalIdeas, runId } = await maybeStoreIdeas(
    env.mongodbUri,
    env.mongodbDbName,
    env.mongodbCollection,
    data.subreddits,
    focusModes,
    timeRange,
    merged,
  );

  return { ideas: finalIdeas, runId };
}
