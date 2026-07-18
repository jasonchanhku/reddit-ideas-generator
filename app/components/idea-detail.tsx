"use client";

import type { FocusMode, ResearchResults } from "@/lib/types";

export const FOCUS_MODE_LABELS: Record<FocusMode, string> = {
  "pain-points": "Pain Points",
  "revenue-first": "Revenue-First",
  "better-mousetrap": "Better Mousetrap",
  "emerging-trends": "Emerging Trends",
};

export const FOCUS_MODE_COLORS: Record<FocusMode, string> = {
  "pain-points": "border-rose-200 bg-rose-50 text-rose-700",
  "revenue-first": "border-emerald-200 bg-emerald-50 text-emerald-700",
  "better-mousetrap": "border-sky-200 bg-sky-50 text-sky-700",
  "emerging-trends": "border-violet-200 bg-violet-50 text-violet-700",
};

export function scoreTone(score: number): string {
  if (score >= 8) return "border-emerald-300 bg-emerald-50 text-emerald-700";
  if (score >= 5) return "border-amber-300 bg-amber-50 text-amber-700";
  return "border-rose-300 bg-rose-50 text-rose-700";
}

export function Field({ label, value }: { label: string; value: string | string[] }) {
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

export function LinkField({ label, items }: { label: string; items: Array<{ title: string; thread_url: string }> }) {
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

export function ResearchResultsSection({ results }: { results: ResearchResults }) {
  const researchedDate = new Date(results.researched_at).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return (
    <div className="glass-panel rounded-[28px] border border-orange-200 p-7 sm:p-9">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-mono text-[0.72rem] uppercase tracking-[0.28em] text-orange-600">
            Deep Research
          </p>
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-slate-400">
            Researched {researchedDate}
          </p>
        </div>

        <p className="text-base leading-7 text-slate-700">{results.summary}</p>

        <Field label="Market Size" value={results.market_size} />
        <Field label="Niche Size & Momentum" value={results.niche_size} />

        <div className="space-y-2">
          <p className="font-mono text-[0.72rem] uppercase tracking-[0.24em] text-slate-500">
            Competitive Landscape
          </p>
          <div className="space-y-2">
            {results.competitors.map((c) => (
              <div key={c.name} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6">
                <p className="font-semibold text-slate-900">{c.name}</p>
                <p className="text-slate-600"><span className="font-medium text-slate-700">Strengths:</span> {c.strengths}</p>
                <p className="text-slate-600"><span className="font-medium text-slate-700">Pricing:</span> {c.pricing}</p>
                <p className="text-slate-600"><span className="font-medium text-orange-700">Gap:</span> {c.gap}</p>
              </div>
            ))}
          </div>
        </div>

        <Field label="Competitive Gap" value={results.competitive_gap} />
        <Field label="Adjacent Trends" value={results.adjacent_trends} />
        <Field label="Beachhead Sizing" value={results.beachhead_sizing} />
        <Field label="Key Risks" value={results.key_risks} />
        <Field label="Monetisation Angles" value={results.monetisation_angles} />

        <div className="space-y-2 border-t border-slate-200 pt-4">
          <p className="font-mono text-[0.72rem] uppercase tracking-[0.24em] text-slate-500">Sources</p>
          <ol className="space-y-1 text-sm leading-6">
            {results.sources.map((source, index) => (
              <li key={`${source.url}-${index}`} className="flex gap-2">
                <span className="shrink-0 font-mono text-[0.72rem] text-slate-400">[{index + 1}]</span>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-slate-600 underline decoration-slate-300 underline-offset-2 transition hover:text-orange-700"
                >
                  {source.title}
                </a>
              </li>
            ))}
          </ol>
          <p className="text-xs text-slate-400">
            Market figures are directional midpoints — estimates vary by research firm.
          </p>
        </div>
      </div>
    </div>
  );
}

export function Spinner({ className = "h-4 w-4 animate-spin" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  );
}
