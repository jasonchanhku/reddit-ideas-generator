"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { use } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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

function kebabCase(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function PocDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [idea, setIdea] = useState<SaasIdea | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [prdError, setPrdError] = useState<string | null>(null);

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

  async function generatePrd() {
    if (generating) return;
    setGenerating(true);
    setPrdError(null);
    try {
      const res = await fetch(`/api/ideas/${id}/generate-prd`, { method: "POST" });
      const data = await res.json() as { idea?: SaasIdea; error?: string };
      if (!res.ok || !data.idea) {
        throw new Error(data.error ?? "PRD generation failed.");
      }
      setIdea(data.idea);
    } catch (err) {
      setPrdError(err instanceof Error ? err.message : "PRD generation failed.");
    } finally {
      setGenerating(false);
    }
  }

  function downloadPrd() {
    if (!idea?.prd_content) return;
    const blob = new Blob([idea.prd_content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${kebabCase(idea.idea_name)}-prd.md`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="mx-auto max-w-4xl px-5 py-12 sm:px-8 lg:px-10">
      {/* Breadcrumb */}
      <nav className="mb-8 flex items-center gap-2 text-sm text-slate-500">
        <Link href="/poc" className="hover:text-slate-900 transition-colors">
          PoC
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
                <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 font-mono text-[0.65rem] uppercase tracking-[0.18em] text-indigo-700">
                  PoC
                </span>
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                {idea.idea_name}
              </h1>
              <p className="text-base leading-7 text-slate-700">{idea.problem}</p>
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

          {/* PRD */}
          <div className="glass-panel rounded-[28px] border border-indigo-200 p-7 sm:p-9">
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-mono text-[0.72rem] uppercase tracking-[0.28em] text-indigo-600">
                  Product Requirements Document
                </p>
                {idea.prd_content && !generating && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={downloadPrd}
                      className="flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                      </svg>
                      Download .md
                    </button>
                    <button
                      type="button"
                      onClick={generatePrd}
                      className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                    >
                      Re-generate PRD
                    </button>
                  </div>
                )}
              </div>

              {!idea.prd_content && !generating && (
                <div className="space-y-3">
                  <p className="text-sm leading-6 text-slate-600">
                    Generate a detailed, self-contained PRD synthesised from this idea&apos;s data and
                    research results — ready to hand to Claude Code and Claude Design.
                  </p>
                  <button
                    type="button"
                    onClick={generatePrd}
                    className="flex items-center gap-2 rounded-full bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-500"
                  >
                    Generate PRD
                  </button>
                </div>
              )}

              {generating && (
                <div className="space-y-2">
                  <div className="flex items-center gap-3 text-sm text-slate-600">
                    <Spinner />
                    Generating PRD…
                  </div>
                  <p className="text-xs text-slate-500">
                    High-reasoning generation — this can take a few minutes.
                  </p>
                </div>
              )}

              {prdError && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {prdError}
                </div>
              )}

              {idea.prd_content && !generating && (
                <article className="prose prose-slate max-w-none rounded-2xl border border-slate-200 bg-white px-6 py-5 prose-headings:tracking-tight">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{idea.prd_content}</ReactMarkdown>
                </article>
              )}
            </div>
          </div>

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
                  title="Mockup generation is coming in a future update."
                  className="rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 opacity-50 cursor-not-allowed"
                >
                  Generate Mockups
                </button>
              </div>
              <p className="text-xs text-slate-400">
                UI mockup generation arrives in the next update — generate and download the PRD in the
                meantime.
              </p>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
