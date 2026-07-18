"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  FOCUS_MODE_COLORS,
  FOCUS_MODE_LABELS,
  Spinner,
  scoreTone,
} from "@/app/components/idea-detail";
import type { SaasIdea } from "@/lib/types";

function PocCard({ idea }: { idea: SaasIdea }) {
  const focusLabel = idea.focus_mode ? FOCUS_MODE_LABELS[idea.focus_mode] : null;
  const focusColor = idea.focus_mode ? FOCUS_MODE_COLORS[idea.focus_mode] : "";
  const hasPrd = Boolean(idea.prd_content);

  return (
    <Link
      href={`/poc/${idea.idea_id}`}
      className="glass-panel group block rounded-[28px] p-6 transition hover:shadow-md"
    >
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full border px-2 py-0.5 font-mono text-[0.65rem] uppercase tracking-[0.18em] ${scoreTone(idea.score)}`}>
            Score {idea.score}/10
          </span>
          {focusLabel && idea.focus_mode && (
            <span className={`rounded-full border px-2 py-0.5 font-mono text-[0.65rem] uppercase tracking-[0.18em] ${focusColor}`}>
              {focusLabel}
            </span>
          )}
        </div>
        <h2 className="text-lg font-semibold tracking-tight text-slate-900 group-hover:text-indigo-700 transition-colors">
          {idea.idea_name}
        </h2>
        <p className="line-clamp-2 text-sm leading-6 text-slate-600">{idea.problem}</p>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span
            className={`rounded-full border px-2 py-0.5 font-mono text-[0.65rem] uppercase tracking-[0.18em] ${
              hasPrd
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-slate-200 bg-slate-50 text-slate-500"
            }`}
          >
            {hasPrd ? "PRD ✓" : "PRD —"}
          </span>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[0.65rem] uppercase tracking-[0.18em] text-slate-500">
            Mockups —
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function PocPage() {
  const [ideas, setIdeas] = useState<SaasIdea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/ideas?stage=poc");
        if (!res.ok) throw new Error("Failed to load PoC ideas.");
        const data = await res.json() as { ideas: SaasIdea[] };
        setIdeas(data.ideas);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  return (
    <main className="mx-auto max-w-7xl px-5 py-12 sm:px-8 lg:px-10">
      <div className="mb-8 space-y-2">
        <p className="font-mono text-[0.72rem] uppercase tracking-[0.28em] text-slate-500">
          Build Pipeline
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-slate-900">PoC</h1>
        <p className="max-w-xl text-base leading-7 text-slate-600">
          Ideas you&apos;re actively building towards. Generate a PRD for each and take it from
          validated concept to proof of concept.
        </p>
      </div>

      {loading && (
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <Spinner />
          Loading PoC ideas…
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
          {error}
        </div>
      )}

      {!loading && !error && ideas.length === 0 && (
        <div className="glass-panel rounded-[28px] px-8 py-12 text-center">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-4 h-10 w-10 text-slate-300">
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
          </svg>
          <p className="font-semibold text-slate-700">No ideas in PoC yet</p>
          <p className="mt-1 text-sm text-slate-500">
            <Link href="/research" className="font-medium text-orange-600 hover:text-orange-700 underline">
              Research
            </Link>
            {" "}an idea and move it here when ready.
          </p>
        </div>
      )}

      {!loading && !error && ideas.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ideas.map((idea) => (
            <PocCard key={idea.idea_id ?? idea.idea_name} idea={idea} />
          ))}
        </div>
      )}
    </main>
  );
}
