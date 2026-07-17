"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { use } from "react";

import type { FocusMode, SaasIdea } from "@/lib/types";

const FOCUS_MODE_LABELS: Record<FocusMode, string> = {
  "pain-points": "Pain Points",
  "revenue-first": "Revenue-First",
  "better-mousetrap": "Better Mousetrap",
  "emerging-trends": "Emerging Trends",
};

const FOCUS_MODE_COLORS: Record<FocusMode, string> = {
  "pain-points": "border-rose-200 bg-rose-50 text-rose-700",
  "revenue-first": "border-emerald-200 bg-emerald-50 text-emerald-700",
  "better-mousetrap": "border-sky-200 bg-sky-50 text-sky-700",
  "emerging-trends": "border-violet-200 bg-violet-50 text-violet-700",
};

function scoreTone(score: number): string {
  if (score >= 8) return "border-emerald-300 bg-emerald-50 text-emerald-700";
  if (score >= 5) return "border-amber-300 bg-amber-50 text-amber-700";
  return "border-rose-300 bg-rose-50 text-rose-700";
}

function Field({ label, value }: { label: string; value: string | string[] }) {
  const values = Array.isArray(value) ? value.filter(Boolean) : [value];
  if (values.length === 0 || (values.length === 1 && !values[0])) return null;

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
  if (!items || items.length === 0) return null;

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

export default function IdeaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [idea, setIdea] = useState<SaasIdea | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/ideas/${id}`);
        if (res.status === 404) throw new Error("Idea not found.");
        if (!res.ok) throw new Error("Failed to load idea.");
        const data = await res.json() as { idea: SaasIdea };
        setIdea(data.idea);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [id]);

  return (
    <main className="mx-auto max-w-4xl px-5 py-12 sm:px-8 lg:px-10">
      {/* Breadcrumb */}
      <nav className="mb-8 flex items-center gap-2 text-sm text-slate-500">
        <Link href="/research" className="hover:text-slate-900 transition-colors">
          Research
        </Link>
        <span>/</span>
        <span className="text-slate-900 font-medium line-clamp-1">
          {loading ? "Loading…" : (idea?.idea_name ?? "Not found")}
        </span>
      </nav>

      {loading && (
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          Loading idea…
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
          {error}
        </div>
      )}

      {!loading && !error && idea && (
        <div className="space-y-8">
          {/* Header */}
          <div className="glass-panel rounded-[28px] p-7 sm:p-9">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-2 py-0.5 font-mono text-[0.65rem] uppercase tracking-[0.18em] ${scoreTone(idea.score)}`}>
                    Score {idea.score}/10
                  </span>
                  <span className="font-mono text-[0.72rem] uppercase tracking-[0.18em] text-slate-500">
                    {idea.verdict} Signal
                  </span>
                  {idea.focus_mode && (
                    <span className={`rounded-full border px-2 py-0.5 font-mono text-[0.65rem] uppercase tracking-[0.18em] ${FOCUS_MODE_COLORS[idea.focus_mode]}`}>
                      {FOCUS_MODE_LABELS[idea.focus_mode]}
                    </span>
                  )}
                  {idea.demand_level && (
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[0.65rem] uppercase tracking-[0.18em] text-slate-600">
                      {idea.demand_level} Demand
                    </span>
                  )}
                </div>
                <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                  {idea.idea_name}
                </h1>
                <p className="text-base leading-7 text-slate-700">{idea.problem}</p>
              </div>
            </div>
          </div>

          {/* Core fields */}
          <div className="glass-panel rounded-[28px] p-7 sm:p-9">
            <div className="space-y-6">
              <Field label="Opportunity" value={idea.opportunity} />
              <Field label="Monetisation Model" value={idea.monetization_model} />
              <Field label="Pricing Hint" value={idea.pricing_hint} />
              <Field label="Revenue Potential" value={idea.revenue_potential} />
              <Field label="Go-to-Market" value={idea.go_to_market} />
            </div>
          </div>

          {/* Lists */}
          <div className="glass-panel rounded-[28px] p-7 sm:p-9">
            <div className="space-y-6">
              <Field label="Existing Solutions" value={idea.existing_solutions} />
              <Field label="Similar Competitors" value={idea.similar_competitors} />
              <Field label="User Complaints" value={idea.user_complaints} />
            </div>
          </div>

          {/* Source threads */}
          {idea.source_threads && idea.source_threads.length > 0 && (
            <div className="glass-panel rounded-[28px] p-7 sm:p-9">
              <LinkField label="Source Threads" items={idea.source_threads} />
            </div>
          )}

          {/* Actions */}
          <div className="glass-panel rounded-[28px] p-7 sm:p-9">
            <div className="space-y-3">
              <p className="font-mono text-[0.72rem] uppercase tracking-[0.24em] text-slate-500">
                Next Steps
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled
                  title="Deep Research is coming in a future update."
                  className="rounded-full bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white opacity-50 cursor-not-allowed"
                >
                  Perform Research
                </button>
                {idea.stage === "researched" && (
                  <button
                    type="button"
                    disabled
                    className="rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 opacity-50 cursor-not-allowed"
                  >
                    Move to PoC
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Deep Research (web search + AI synthesis) is coming in a future update.
              </p>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
