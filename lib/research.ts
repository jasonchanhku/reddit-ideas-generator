import type { SaasIdea } from "@/lib/types";

const SERPAPI_BASE_URL = "https://serpapi.com/search.json";
const SEARCH_TIMEOUT_MS = 15000;
const RESULTS_PER_QUERY = 8;

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface ResearchSearch {
  query: string;
  results: SearchResult[];
}

// Trims an idea name/problem down to a compact search phrase.
function compactPhrase(text: string, maxWords: number): string {
  return text
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, maxWords)
    .join(" ");
}

export function buildResearchQueries(idea: SaasIdea): string[] {
  const domain = compactPhrase(idea.idea_name, 6);
  const problem = compactPhrase(idea.problem, 8);
  const year = new Date().getFullYear();

  const queries = [
    `${domain} market size TAM CAGR growth`,
    `${problem} software tools ${year}`,
    `${domain} industry trends ${year}`,
  ];

  const competitors = idea.similar_competitors
    .map((c) => compactPhrase(c, 3))
    .filter(Boolean)
    .slice(0, 3);
  if (competitors.length > 0) {
    queries.push(`${competitors.join(" vs ")} pricing comparison`);
  }

  return queries;
}

export async function searchWeb(query: string, apiKey: string): Promise<SearchResult[]> {
  const url = new URL(SERPAPI_BASE_URL);
  url.searchParams.set("engine", "google");
  url.searchParams.set("q", query);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("num", String(RESULTS_PER_QUERY));

  console.log(`🔎 [SERPAPI] Searching: "${query}"`);

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS) });

    if (!response.ok) {
      console.error(`   ⚠️  [SERPAPI] HTTP ${response.status} for "${query}"`);
      return [];
    }

    const data = (await response.json()) as {
      organic_results?: Array<{ title?: string; link?: string; snippet?: string }>;
    };

    const results = (data.organic_results ?? [])
      .filter((r) => r.title && r.link)
      .map((r) => ({
        title: r.title as string,
        url: r.link as string,
        snippet: r.snippet ?? "",
      }));

    console.log(`   ✅ [SERPAPI] ${results.length} results for "${query}"`);
    return results;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`   ⚠️  [SERPAPI] Failed "${query}": ${message}`);
    return [];
  }
}

export async function runResearchSearches(
  idea: SaasIdea,
  apiKey: string,
): Promise<ResearchSearch[]> {
  const queries = buildResearchQueries(idea);

  console.log(`\n🔬 [RESEARCH] Running ${queries.length} web searches for "${idea.idea_name}"`);

  const all = await Promise.all(
    queries.map(async (query) => ({ query, results: await searchWeb(query, apiKey) })),
  );

  const nonEmpty = all.filter((s) => s.results.length > 0);

  if (nonEmpty.length === 0) {
    throw new Error("All web searches failed or returned no results.");
  }

  return nonEmpty;
}
