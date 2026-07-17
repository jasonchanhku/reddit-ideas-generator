export type TimeRange = "week" | "month" | "year" | "all";

export type FocusMode = "pain-points" | "revenue-first" | "better-mousetrap" | "emerging-trends";

export interface RedditPost {
  title: string;
  comments: string[];
  permalink: string;
  threadUrl: string;
}

export interface SourceThread {
  title: string;
  thread_url: string;
}

export interface StructuredRedditData {
  subreddits: string[];
  scrapedAt: string;
  posts: RedditPost[];
}

export interface SaasIdea {
  idea_name: string;
  problem: string;
  demand_level: "Low" | "Medium" | "High";
  existing_solutions: string[];
  similar_competitors: string[];
  user_complaints: string[];
  opportunity: string;
  monetization_model: string;
  pricing_hint: string;
  revenue_potential: string;
  go_to_market: string;
  score: number;
  verdict: "Weak" | "Decent" | "Strong";
  source_threads: SourceThread[];
  focus_mode?: FocusMode;
  idea_id?: string;
  is_favourite?: boolean;
  stage?: string;
  run_id?: string;
}

export interface AnalyzeIdeasResponse {
  subreddits: string[];
  source: StructuredRedditData;
  ideas: SaasIdea[];
  runId?: string;
}

export interface RunSummary {
  _id: string;
  subreddits: string[];
  focusModes: FocusMode[];
  timeRange: TimeRange | null;
  analyzed_at: string;
}

export interface RunDocument extends RunSummary {
  ideas: SaasIdea[];
}
