"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { use } from "react";

import {
  FOCUS_MODE_COLORS,
  FOCUS_MODE_LABELS,
  Field,
  LinkField,
  ResearchResultsSection,
  Spinner,
  scoreTone,
} from "@/app/components/idea-detail";
import type { SaasIdea } from "@/lib/types";

export default function IdeaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [idea, setIdea] = useState<SaasIdea | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [researchEnabled, setResearchEnabled] = useState(false);
  const [researching, setResearching] = useState(false);
  const [researchError, setResearchError] = useState<string | null>(null);
  const [movingToPoc, setMovingToPoc] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/ideas/${id}`);
        if (res.status === 404) throw new Error("Idea not found.");
        if (!res.ok) throw new Error("Failed to load idea.");
        const data = await res.json() as { idea: SaasIdea; research_enabled?: boolean };
        setIdea(data.idea);
        setResearchEnabled(data.research_enabled ?? false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [id]);

  async function performResearch() {
    if (!researchEnabled || researching) return;
    setResearching(true);
    setResearchError(null);
    try {
      const res = await fetch(`/api/ideas/${id}/research`, { method: "POST" });
      const data = await res.json() as { idea?: SaasIdea; error?: string };
      if (!res.ok || !data.idea) {
        throw new Error(data.error ?? "Research failed.");
      }
      setIdea(data.idea);
    } catch (err) {
      setResearchError(err instanceof Error ? err.message : "Research failed.");
    } finally {
      setResearching(false);
    }
  }

  async function moveToPoc() {
    if (movingToPoc) return;
    setMovingToPoc(true);
    setMoveError(null);
    try {
      const res = await fetch(`/api/ideas/${id}/move-to-poc`, { method: "POST" });
      const data = await res.json() as { idea?: SaasIdea; error?: string };
      if (!res.ok || !data.idea) {
        throw new Error(data.error ?? "Failed to move idea to PoC.");
      }
      setIdea(data.idea);
    } catch (err) {
      setMoveError(err instanceof Error ? err.message : "Failed to move idea to PoC.");
    } finally {
      setMovingToPoc(false);
    }
  }

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
          <Spinner />
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
                  {idea.stage === "poc" && (
                    <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 font-mono text-[0.65rem] uppercase tracking-[0.18em] text-indigo-700">
                      PoC
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

          {/* Research results */}
          {idea.research_results && <ResearchResultsSection results={idea.research_results} />}

          {/* Actions */}
          <div className="glass-panel rounded-[28px] p-7 sm:p-9">
            <div className="space-y-3">
              <p className="font-mono text-[0.72rem] uppercase tracking-[0.24em] text-slate-500">
                Next Steps
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={performResearch}
                  disabled={!researchEnabled || researching}
                  title={
                    !researchEnabled
                      ? "Set SERPH_API_KEY to enable Deep Research."
                      : undefined
                  }
                  className={
                    idea.research_results
                      ? "flex items-center gap-2 rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      : "flex items-center gap-2 rounded-full bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-50"
                  }
                >
                  {researching && <Spinner />}
                  {researching
                    ? "Researching…"
                    : idea.research_results
                      ? "Re-run Research"
                      : "Perform Research"}
                </button>
                {idea.stage === "researched" && (
                  <button
                    type="button"
                    onClick={moveToPoc}
                    disabled={movingToPoc}
                    className="flex items-center gap-2 rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {movingToPoc && <Spinner />}
                    {movingToPoc ? "Moving…" : "Move to PoC"}
                  </button>
                )}
                {idea.stage === "poc" && idea.idea_id && (
                  <Link
                    href={`/poc/${idea.idea_id}`}
                    className="rounded-full border border-indigo-300 bg-indigo-50 px-5 py-2.5 text-sm font-semibold text-indigo-700 transition hover:border-indigo-400 hover:bg-indigo-100"
                  >
                    View in PoC →
                  </Link>
                )}
              </div>
              {researching && (
                <p className="text-xs text-slate-500">
                  Running web searches and synthesising market analysis — this can take up to a minute.
                </p>
              )}
              {researchError && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {researchError}
                </div>
              )}
              {moveError && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {moveError}
                </div>
              )}
              {!researchEnabled && (
                <p className="text-xs text-slate-400">
                  Deep Research requires a SERPH_API_KEY to be configured.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
