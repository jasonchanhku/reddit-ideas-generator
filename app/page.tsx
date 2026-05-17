"use client";

import { useEffect, useRef, useState } from "react";

import type { AnalyzeIdeasResponse, FocusMode, RunDocument, RunSummary, SaasIdea, TimeRange } from "@/lib/types";

const EXAMPLE_SUBREDDITS = [
  "SaaS",
  "microsaas",
  "SaasDevelopers",
  "SaaSSolopreneurs",
  "saasbuild",
  "SaasSelection",
  "SaaSMarketing",
  "micro_saas",
  "ShowsYourSaaS",
  "SaaSStartups",
  "AppBusiness",
  "SaaSSales",
  "smallbusiness",
  "freelance",
  "vibecoding",
  "AskVibecoders",
  "AI_Agents",
  "AgentsOfAI",
  "AiBuilders",
  "AIAssisted",
  "ClaudeAI",
  "ClaudeCode",
  "cursor",
  "SideProject",
  "webdev",
  "indiehackers",
  "buildinpublic",
  "lovable"
];

const TIME_RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "year", label: "This Year" },
  { value: "all", label: "All Time" },
];

const FOCUS_MODE_OPTIONS: { value: FocusMode; label: string; description: string }[] = [
  { value: "pain-points", label: "Pain Points", description: "Surface repeated user frustrations" },
  { value: "revenue-first", label: "Revenue-First", description: "Find where users already pay" },
  { value: "better-mousetrap", label: "Better Mousetrap", description: "Beat incumbents on one axis" },
  { value: "emerging-trends", label: "Emerging Trends", description: "Catch category-defining moments" },
];

const FOCUS_MODE_COLORS: Record<FocusMode, string> = {
  "pain-points": "border-rose-200 bg-rose-50 text-rose-700",
  "revenue-first": "border-emerald-200 bg-emerald-50 text-emerald-700",
  "better-mousetrap": "border-sky-200 bg-sky-50 text-sky-700",
  "emerging-trends": "border-violet-200 bg-violet-50 text-violet-700",
};

const TIME_RANGE_LABELS: Record<string, string> = {
  week: "week",
  month: "month",
  year: "year",
  all: "all time",
};

function formatRunLabel(run: RunSummary): string {
  const date = new Date(run.analyzed_at);
  const dateStr = date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const subredditStr = run.subreddits.map((s) => `r/${s}`).join(" + ");
  const rangeStr = run.timeRange ? ` · ${TIME_RANGE_LABELS[run.timeRange] ?? run.timeRange}` : "";
  return `${dateStr} — ${subredditStr}${rangeStr}`;
}

const LOADING_PHASES = [
  "Scraping top Reddit threads for the selected time range.",
  "Opening the strongest discussions and extracting comment signal.",
  "Grouping complaints into repeatable product opportunities.",
  "Scoring ideas and packaging the final market gaps.",
];
const FINAL_PHASE_BREAKDOWN = [
  "Ranking problems by urgency and buyer pain.",
  "Matching adjacent competitors and weak spots.",
  "Estimating pricing, revenue potential, and go-to-market.",
  "Linking each idea back to source Reddit threads.",
];

type RunConfig = { subreddits: string[]; timeRange: TimeRange; focusModes: FocusMode[] };

function scoreTone(score: number): string {
  if (score >= 8) return "border-emerald-300 bg-emerald-50 text-emerald-700";
  if (score >= 5) return "border-amber-300 bg-amber-50 text-amber-700";
  return "border-rose-300 bg-rose-50 text-rose-700";
}

// ── Subreddit dropdown multiselect ──────────────────────────────────────────

function SubredditMultiSelect({
  selected,
  onChange,
  options,
  max = 5,
}: {
  selected: string[];
  onChange: (value: string[]) => void;
  options: string[];
  max?: number;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const normalizedQuery = query.trim().replace(/^r\//i, "");
  const filtered = options.filter((o) =>
    o.toLowerCase().includes(normalizedQuery.toLowerCase()),
  );
  const showCustomAdd =
    normalizedQuery.length > 0 &&
    !options.some((o) => o.toLowerCase() === normalizedQuery.toLowerCase()) &&
    !selected.some((s) => s.toLowerCase() === normalizedQuery.toLowerCase());

  function toggle(sub: string) {
    const normalized = sub.trim().replace(/^r\//i, "");
    if (selected.map((s) => s.toLowerCase()).includes(normalized.toLowerCase())) {
      onChange(selected.filter((s) => s.toLowerCase() !== normalized.toLowerCase()));
    } else if (selected.length < max) {
      onChange([...selected, normalized]);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if ((e.key === "Enter" || e.key === ",") && normalizedQuery) {
      e.preventDefault();
      toggle(normalizedQuery);
      setQuery("");
    }
    if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
    }
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-base transition focus:outline-none focus:ring-4 focus:ring-orange-100 data-[open]:border-orange-400"
        data-open={open || undefined}
      >
        <span className={selected.length === 0 ? "text-slate-400" : "text-slate-900"}>
          {selected.length === 0
            ? "Select subreddits…"
            : selected.map((s) => `r/${s}`).join(", ")}
        </span>
        <svg
          className={`ml-2 h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute z-50 mt-1.5 w-full rounded-2xl border border-slate-200 bg-white shadow-xl">
          {/* Search input */}
          <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2.5">
            <svg className="h-4 w-4 shrink-0 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
            </svg>
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search or type a subreddit…"
              className="flex-1 text-sm text-slate-900 outline-none placeholder:text-slate-400"
            />
          </div>

          {/* Options list */}
          <ul className="max-h-56 overflow-y-auto py-1">
            {filtered.map((sub) => {
              const isSelected = selected.map((s) => s.toLowerCase()).includes(sub.toLowerCase());
              const isDisabled = !isSelected && selected.length >= max;
              return (
                <li key={sub}>
                  <button
                    type="button"
                    onClick={() => { if (!isDisabled) { toggle(sub); } }}
                    disabled={isDisabled}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-sm transition ${
                      isSelected
                        ? "bg-orange-50 text-orange-800"
                        : isDisabled
                        ? "cursor-not-allowed text-slate-300"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] font-bold ${
                        isSelected
                          ? "border-orange-400 bg-orange-400 text-white"
                          : "border-slate-300 text-transparent"
                      }`}
                    >
                      ✓
                    </span>
                    r/{sub}
                  </button>
                </li>
              );
            })}

            {/* Custom entry option */}
            {showCustomAdd && selected.length < max && (
              <li>
                <button
                  type="button"
                  onClick={() => { toggle(normalizedQuery); setQuery(""); }}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-orange-700 hover:bg-orange-50"
                >
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-orange-300 text-[10px] font-bold text-orange-400">
                    +
                  </span>
                  Add r/{normalizedQuery}
                </button>
              </li>
            )}

            {filtered.length === 0 && !showCustomAdd && (
              <li className="px-4 py-3 text-sm text-slate-400">No results for "{query}"</li>
            )}
          </ul>

          {/* Footer count */}
          <div className="border-t border-slate-100 px-4 py-2 text-xs text-slate-400">
            {selected.length}/{max} selected
          </div>
        </div>
      )}

      {/* Selected chips */}
      {selected.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {selected.map((sub) => (
            <span
              key={sub}
              className="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-sm font-medium text-orange-800"
            >
              r/{sub}
              <button
                type="button"
                aria-label={`Remove r/${sub}`}
                onClick={() => toggle(sub)}
                className="ml-0.5 rounded-full text-orange-400 transition hover:text-orange-700"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Past runs dropdown ──────────────────────────────────────────────────────

function PastRunsDropdown({
  runs,
  selectedId,
  loading,
  onSelect,
}: {
  runs: RunSummary[];
  selectedId: string | null;
  loading: boolean;
  onSelect: (id: string) => void;
}) {
  if (!loading && runs.length === 0) return null;

  return (
    <div className="space-y-2">
      <span className="font-mono text-[0.72rem] uppercase tracking-[0.24em] text-slate-500">
        Past Runs
      </span>
      <select
        value={selectedId ?? ""}
        onChange={(e) => onSelect(e.target.value)}
        disabled={loading}
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 focus:outline-none focus:ring-4 focus:ring-orange-100 disabled:text-slate-400"
      >
        <option value="">
          {loading ? "Loading past runs…" : "Load a past run…"}
        </option>
        {runs.map((run) => (
          <option key={run._id} value={run._id}>
            {formatRunLabel(run)}
          </option>
        ))}
      </select>
    </div>
  );
}

// ── Loaded run banner ───────────────────────────────────────────────────────

function LoadedRunBanner({
  run,
  onDismiss,
}: {
  run: RunDocument;
  onDismiss: () => void;
}) {
  const date = new Date(run.analyzed_at).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return (
    <div className="glass-panel mt-6 flex items-start justify-between gap-4 rounded-[28px] border border-sky-200 bg-sky-50/60 px-5 py-4">
      <div className="space-y-1">
        <p className="font-mono text-[0.68rem] uppercase tracking-[0.22em] text-sky-600">
          Viewing Past Run — {date}
        </p>
        <p className="text-sm text-slate-700">
          <span className="font-semibold">{run.subreddits.map((s) => `r/${s}`).join(" + ")}</span>
          {run.timeRange && (
            <span className="ml-2 text-slate-500">
              · {TIME_RANGE_LABELS[run.timeRange] ?? run.timeRange}
            </span>
          )}
          {" · "}
          {run.focusModes.map((m) => FOCUS_MODE_OPTIONS.find((o) => o.value === m)?.label ?? m).join(", ")}
        </p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="mt-0.5 shrink-0 text-sm font-semibold text-sky-700 hover:text-sky-900"
      >
        Clear ×
      </button>
    </div>
  );
}

// ── Idea card ───────────────────────────────────────────────────────────────

function Field({ label, value }: { label: string; value: string | string[] }) {
  const values = Array.isArray(value) ? value.filter(Boolean) : [value];
  if (values.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="font-mono text-[0.72rem] uppercase tracking-[0.24em] text-slate-500">{label}</p>
      <div className="flex flex-wrap gap-2 text-sm leading-6 text-slate-700">
        {Array.isArray(value)
          ? values.map((item) => (
              <span key={`${label}-${item}`} className="rounded-full border border-slate-200 bg-white px-3 py-1">
                {item}
              </span>
            ))
          : <p>{value}</p>}
      </div>
    </div>
  );
}

function LinkField({ label, items }: { label: string; items: Array<{ title: string; thread_url: string }> }) {
  if (items.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="font-mono text-[0.72rem] uppercase tracking-[0.24em] text-slate-500">{label}</p>
      <div className="space-y-2 text-sm leading-6 text-slate-700">
        {items.map((item, index) => (
          <a
            key={`${item.thread_url}-${index}`}
            href={item.thread_url}
            target="_blank"
            rel="noreferrer"
            className="block rounded-2xl border border-slate-200 bg-white px-4 py-3 transition hover:border-slate-300 hover:bg-slate-50"
            title={item.title}
          >
            <span className="line-clamp-2 font-medium text-slate-800">{item.title}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

function IdeaCard({ idea }: { idea: SaasIdea }) {
  const focusModeLabel = FOCUS_MODE_OPTIONS.find((o) => o.value === idea.focus_mode)?.label;

  return (
    <article className="glass-panel rounded-[28px] p-6 sm:p-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-mono text-[0.72rem] uppercase tracking-[0.24em] text-slate-500">
              {idea.verdict} Signal
            </p>
            {focusModeLabel && idea.focus_mode && (
              <span className={`rounded-full border px-2 py-0.5 font-mono text-[0.65rem] uppercase tracking-[0.18em] ${FOCUS_MODE_COLORS[idea.focus_mode]}`}>
                {focusModeLabel}
              </span>
            )}
          </div>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">{idea.idea_name}</h2>
        </div>
        <div className={`inline-flex items-center rounded-full border px-4 py-2 text-sm font-semibold ${scoreTone(idea.score)}`}>
          Score {idea.score}/10
        </div>
      </div>

      <div className="mt-6 grid gap-5">
        <Field label="Problem" value={idea.problem} />
        <Field label="Demand" value={idea.demand_level} />
        <Field label="Existing Solutions" value={idea.existing_solutions} />
        <Field label="Similar Competitors" value={idea.similar_competitors} />
        <Field label="User Complaints" value={idea.user_complaints} />
        <Field label="Opportunity" value={idea.opportunity} />
        <Field label="Monetization" value={idea.monetization_model} />
        <Field label="Pricing Hint" value={idea.pricing_hint} />
        <Field label="Revenue Potential" value={idea.revenue_potential} />
        <Field label="Go To Market" value={idea.go_to_market} />
        <LinkField label="Source Threads" items={idea.source_threads} />
      </div>
    </article>
  );
}

function SourcePill({ title, url }: { title: string; url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="block rounded-2xl border border-slate-200 bg-white px-4 py-3 transition hover:border-slate-300 hover:bg-slate-50"
      title={title}
    >
      <span className="line-clamp-2 text-sm font-medium leading-6 text-slate-800">{title}</span>
    </a>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────

export default function Home() {
  const [subreddits, setSubreddits] = useState<string[]>(["SaaS"]);
  const [timeRange, setTimeRange] = useState<TimeRange>("week");
  const [focusModes, setFocusModes] = useState<FocusMode[]>(["pain-points"]);
  const [lastConfig, setLastConfig] = useState<RunConfig>({
    subreddits: ["SaaS"],
    timeRange: "week",
    focusModes: ["pain-points"],
  });

  const [pastRuns, setPastRuns] = useState<RunSummary[]>([]);
  const [loadingRuns, setLoadingRuns] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [loadedRun, setLoadedRun] = useState<RunDocument | null>(null);
  const [loadingRunDetail, setLoadingRunDetail] = useState(false);

  const [result, setResult] = useState<AnalyzeIdeasResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [finalPhaseStep, setFinalPhaseStep] = useState(0);
  const [loadingSubreddits, setLoadingSubreddits] = useState<string[]>([]);

  useEffect(() => {
    async function fetchRuns() {
      setLoadingRuns(true);
      try {
        const res = await fetch("/api/runs");
        if (res.ok) {
          const data = (await res.json()) as { runs: RunSummary[] };
          setPastRuns(data.runs ?? []);
        }
      } catch {
        // non-critical — silently ignore
      } finally {
        setLoadingRuns(false);
      }
    }
    fetchRuns();
  }, []);

  useEffect(() => {
    if (!loading) {
      setLoadingStep(0);
      setElapsedSeconds(0);
      return;
    }

    const startedAt = Date.now();
    const interval = window.setInterval(() => {
      const seconds = Math.floor((Date.now() - startedAt) / 1000);
      setElapsedSeconds(seconds);
      setLoadingStep(Math.min(LOADING_PHASES.length - 1, Math.floor(seconds / 4)));
      if (seconds >= 12) {
        setFinalPhaseStep(Math.min(FINAL_PHASE_BREAKDOWN.length - 1, Math.floor((seconds - 12) / 3)));
      }
    }, 800);

    return () => window.clearInterval(interval);
  }, [loading]);

  function toggleFocusMode(mode: FocusMode) {
    setFocusModes((prev) => {
      if (prev.includes(mode)) {
        // Prevent deselecting the last mode
        return prev.length > 1 ? prev.filter((m) => m !== mode) : prev;
      }
      return [...prev, mode];
    });
  }

  async function loadRun(id: string) {
    if (!id) {
      setSelectedRunId(null);
      setLoadedRun(null);
      return;
    }
    setSelectedRunId(id);
    setLoadingRunDetail(true);
    setError(null);
    try {
      const res = await fetch(`/api/runs/${id}`);
      if (!res.ok) throw new Error("Failed to load run.");
      const data = (await res.json()) as { run: RunDocument };
      setLoadedRun(data.run);
      setResult(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load run.");
      setLoadedRun(null);
      setSelectedRunId(null);
    } finally {
      setLoadingRunDetail(false);
    }
  }

  async function runAnalysis(config: RunConfig = { subreddits, timeRange, focusModes }) {
    if (config.subreddits.length === 0) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setLoadingSubreddits(config.subreddits);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subreddits: config.subreddits,
          timeRange: config.timeRange,
          focusModes: config.focusModes,
        }),
      });

      const payload = (await response.json()) as AnalyzeIdeasResponse & { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Request failed.");
      }

      setResult(payload);
      setLastConfig(config);
      setLoadedRun(null);
      setSelectedRunId(null);
      try {
        const runsRes = await fetch("/api/runs");
        if (runsRes.ok) {
          const runsData = (await runsRes.json()) as { runs: RunSummary[] };
          setPastRuns(runsData.runs ?? []);
        }
      } catch { /* non-critical */ }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unexpected request error.");
    } finally {
      setLoading(false);
    }
  }

  const displaySubreddits = loadingSubreddits.length > 0
    ? loadingSubreddits.map((s) => `r/${s}`).join(", ")
    : subreddits.map((s) => `r/${s}`).join(", ") || "r/SaaS";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-8 sm:px-8 lg:px-10">
      <section className="glass-panel relative overflow-hidden rounded-[36px] px-6 py-7 sm:px-8 sm:py-9 lg:px-10">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-orange-500 via-amber-400 to-sky-500" />
        <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
          <div className="space-y-5">
            <p className="font-mono text-[0.72rem] uppercase tracking-[0.28em] text-slate-500">
              Reddit Scraping + AI Validation
            </p>
            <div className="space-y-4">
              <h1 className="max-w-3xl text-4xl font-semibold tracking-[-0.04em] text-slate-900 sm:text-5xl lg:text-6xl">
                Turn noisy Reddit threads into validated SaaS bets.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
                Validly scrapes Reddit discussions with Decodo, structures the strongest complaints, and sends them through AI to surface market gaps, demand, and stronger product angles.
              </p>
            </div>
          </div>

          <div className="rounded-[30px] border border-white/70 bg-[var(--surface-strong)] p-5 shadow-[0_18px_48px_rgba(51,38,21,0.08)]">
            <div className="space-y-5">

              {/* Past runs dropdown — hidden when MongoDB is not configured */}
              <PastRunsDropdown
                runs={pastRuns}
                selectedId={selectedRunId}
                loading={loadingRuns}
                onSelect={loadRun}
              />

              {/* Subreddit multiselect dropdown */}
              <div className="space-y-2">
                <span className="font-mono text-[0.72rem] uppercase tracking-[0.24em] text-slate-500">
                  Subreddits (up to 5)
                </span>
                <SubredditMultiSelect
                  selected={subreddits}
                  onChange={setSubreddits}
                  options={EXAMPLE_SUBREDDITS}
                  max={5}
                />
              </div>

              {/* Time range */}
              <div className="space-y-2">
                <span className="font-mono text-[0.72rem] uppercase tracking-[0.24em] text-slate-500">
                  Time Range
                </span>
                <div className="flex flex-wrap gap-2">
                  {TIME_RANGE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setTimeRange(opt.value)}
                      className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                        timeRange === opt.value
                          ? "border-orange-400 bg-orange-50 text-orange-700"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Focus modes — multi-select */}
              <div className="space-y-2">
                <span className="font-mono text-[0.72rem] uppercase tracking-[0.24em] text-slate-500">
                  Focus Modes (select multiple)
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {FOCUS_MODE_OPTIONS.map((opt) => {
                    const isSelected = focusModes.includes(opt.value);
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => toggleFocusMode(opt.value)}
                        className={`rounded-[18px] border px-3 py-3 text-left transition ${
                          isSelected
                            ? "border-orange-400 bg-orange-50"
                            : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                        }`}
                      >
                        <p className={`text-sm font-semibold ${isSelected ? "text-orange-800" : "text-slate-800"}`}>
                          {opt.label}
                        </p>
                        <p className="mt-0.5 text-xs leading-5 text-slate-500">{opt.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => runAnalysis()}
                  disabled={loading || subreddits.length === 0}
                  className="inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {loading ? "Analyzing Reddit signal..." : "Analyze Ideas"}
                </button>

                <button
                  type="button"
                  onClick={() => runAnalysis(lastConfig)}
                  disabled={loading}
                  className="inline-flex items-center justify-center rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Retry Last Run
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        {[
          "Decodo scrapes the top subreddit posts across your selected time range.",
          "Cheerio structures titles plus top 2–3 comments from up to 8 higher-signal posts per subreddit.",
          "AI scores each opportunity using your chosen focus modes and returns strict JSON.",
        ].map((item) => (
          <div key={item} className="glass-panel rounded-[24px] px-5 py-4 text-sm leading-6 text-slate-600">
            {item}
          </div>
        ))}
      </section>

      {error ? (
        <section className="glass-panel mt-6 rounded-[28px] border border-rose-200 bg-rose-50/80 p-5 text-rose-700">
          <p className="font-semibold">Analysis failed</p>
          <p className="mt-2 text-sm leading-6">{error}</p>
        </section>
      ) : null}

      {loading ? (
        <section className="glass-panel mt-6 rounded-[30px] p-6 sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <p className="font-mono text-[0.72rem] uppercase tracking-[0.24em] text-slate-500">
                Analysis In Flight
              </p>
              <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                Working through {displaySubreddits}
              </h2>
              <p className="max-w-2xl text-base leading-7 text-slate-600">
                {LOADING_PHASES[loadingStep]}
              </p>
            </div>
            <div className="rounded-[24px] border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600">
              <p className="font-mono text-[0.68rem] uppercase tracking-[0.22em] text-slate-500">Elapsed</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{elapsedSeconds}s</p>
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-2 rounded-full bg-gradient-to-r from-orange-500 via-amber-400 to-sky-500 transition-all duration-700"
              style={{ width: `${Math.min(92, 24 + loadingStep * 22 + elapsedSeconds * 2)}%` }}
            />
          </div>

          <div className="mt-6 grid gap-3 lg:grid-cols-4">
            {LOADING_PHASES.map((phase, index) => {
              const active = index <= loadingStep;
              return (
                <div
                  key={phase}
                  className={`rounded-[22px] border px-4 py-4 text-sm leading-6 transition ${
                    active ? "border-orange-200 bg-orange-50 text-slate-700" : "border-slate-200 bg-white text-slate-400"
                  }`}
                >
                  <p className="font-mono text-[0.68rem] uppercase tracking-[0.22em]">Step {index + 1}</p>
                  <p className="mt-2">{phase}</p>
                </div>
              );
            })}
          </div>

          <div className="mt-5 rounded-[24px] border border-slate-200 bg-white p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-[0.68rem] uppercase tracking-[0.22em] text-slate-500">Step 4 Breakdown</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  The last step still does a lot of work, so this breaks it down into smaller visible tasks.
                </p>
              </div>
              <div className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">
                {loadingStep < 3 ? "Queued" : "Running"}
              </div>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {FINAL_PHASE_BREAKDOWN.map((item, index) => {
                const active = loadingStep > 3 || (loadingStep === 3 && index <= finalPhaseStep);
                return (
                  <div
                    key={item}
                    className={`rounded-[20px] border px-4 py-4 text-sm leading-6 transition ${
                      active ? "border-orange-200 bg-orange-50 text-slate-700" : "border-slate-200 bg-slate-50 text-slate-400"
                    }`}
                  >
                    <p className="font-mono text-[0.68rem] uppercase tracking-[0.22em]">4.{index + 1}</p>
                    <p className="mt-2">{item}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}

      {loadingRunDetail ? (
        <section className="glass-panel mt-6 rounded-[28px] p-6 text-sm leading-7 text-slate-600">
          Loading past run…
        </section>
      ) : loadedRun ? (
        <>
          <LoadedRunBanner
            run={loadedRun}
            onDismiss={() => { setLoadedRun(null); setSelectedRunId(null); }}
          />
          <section className="mt-6 space-y-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="font-mono text-[0.72rem] uppercase tracking-[0.24em] text-slate-500">Results</p>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
                  r/{loadedRun.subreddits.join(" + ")} produced {loadedRun.ideas.length} validated ideas
                </h2>
              </div>
            </div>
            <div className="grid gap-5 xl:grid-cols-2">
              {loadedRun.ideas.map((idea) => (
                <IdeaCard key={`${idea.idea_name}-${idea.problem}`} idea={idea} />
              ))}
            </div>
          </section>
        </>
      ) : result ? (
        <section className="mt-6 space-y-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="font-mono text-[0.72rem] uppercase tracking-[0.24em] text-slate-500">Results</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
                r/{result.subreddits.join(" + ")} produced {result.ideas.length} validated ideas
              </h2>
            </div>
            <p className="text-sm text-slate-500">
              Analyzed {result.source.posts.length} deduplicated source threads and their strongest comments.
            </p>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            {result.ideas.map((idea) => (
              <IdeaCard key={`${idea.idea_name}-${idea.problem}`} idea={idea} />
            ))}
          </div>

          <div className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="font-mono text-[0.72rem] uppercase tracking-[0.24em] text-slate-500">Source Threads</p>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
                  Review the original Reddit discussions
                </h2>
              </div>
              <p className="text-sm text-slate-500">
                Open the original threads to validate the signal and dig deeper before building.
              </p>
            </div>

            <div className="grid gap-4 xl:grid-cols-3">
              {result.source.posts.map((post, index) => (
                <SourcePill key={`${post.permalink}-${index}`} title={post.title} url={post.threadUrl} />
              ))}
            </div>
          </div>
        </section>
      ) : (
        <section className="glass-panel mt-6 rounded-[28px] p-6 text-sm leading-7 text-slate-600">
          Select up to 5 subreddits, choose a time range and one or more focus modes, then run the workflow to get concise SaaS opportunities grounded in real Reddit conversations.
        </section>
      )}
    </main>
  );
}
