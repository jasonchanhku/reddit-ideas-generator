"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

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

function ResearchCard({
  idea,
  onUnfavourite,
}: {
  idea: SaasIdea;
  onUnfavourite: (ideaId: string) => void;
}) {
  const [pending, setPending] = useState(false);
  const focusLabel = idea.focus_mode ? FOCUS_MODE_LABELS[idea.focus_mode] : null;
  const focusColor = idea.focus_mode ? FOCUS_MODE_COLORS[idea.focus_mode] : "";

  async function handleUnfavourite(e: React.MouseEvent) {
    e.preventDefault();
    if (!idea.run_id || !idea.idea_id || pending) return;
    setPending(true);
    try {
      const res = await fetch(`/api/ideas/${idea.run_id}/favourite`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea_id: idea.idea_id }),
      });
      if (res.ok) onUnfavourite(idea.idea_id!);
    } finally {
      setPending(false);
    }
  }

  return (
    <Link
      href={`/research/${idea.idea_id}`}
      className="glass-panel group block rounded-[28px] p-6 transition hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
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
          <h2 className="text-lg font-semibold tracking-tight text-slate-900 group-hover:text-orange-700 transition-colors">
            {idea.idea_name}
          </h2>
          <p className="line-clamp-2 text-sm leading-6 text-slate-600">{idea.problem}</p>
        </div>
        {idea.run_id && idea.idea_id && (
          <button
            type="button"
            onClick={handleUnfavourite}
            disabled={pending}
            aria-label="Remove from favourites"
            className="mt-1 shrink-0 rounded-full p-1.5 text-rose-500 transition-colors hover:text-rose-300 disabled:opacity-50"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
              <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
            </svg>
          </button>
        )}
      </div>
    </Link>
  );
}

export default function ResearchPage() {
  const [ideas, setIdeas] = useState<SaasIdea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/ideas?is_favourite=true");
        if (!res.ok) throw new Error("Failed to load favourited ideas.");
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

  function handleUnfavourite(ideaId: string) {
    setIdeas((prev) => prev.filter((i) => i.idea_id !== ideaId));
  }

  return (
    <main className="mx-auto max-w-7xl px-5 py-12 sm:px-8 lg:px-10">
      <div className="mb-8 space-y-2">
        <p className="font-mono text-[0.72rem] uppercase tracking-[0.28em] text-slate-500">
          Saved Ideas
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-slate-900">Research</h1>
        <p className="max-w-xl text-base leading-7 text-slate-600">
          Your favourited ideas, ready for deep validation. Click any idea to explore it further.
        </p>
      </div>

      {loading && (
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          Loading your favourited ideas…
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
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
          </svg>
          <p className="font-semibold text-slate-700">No favourited ideas yet</p>
          <p className="mt-1 text-sm text-slate-500">
            Go to{" "}
            <Link href="/discover" className="font-medium text-orange-600 hover:text-orange-700 underline">
              Discover
            </Link>
            {" "}and heart the ideas you want to explore further.
          </p>
        </div>
      )}

      {!loading && !error && ideas.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ideas.map((idea) => (
            <ResearchCard
              key={idea.idea_id ?? idea.idea_name}
              idea={idea}
              onUnfavourite={handleUnfavourite}
            />
          ))}
        </div>
      )}
    </main>
  );
}
