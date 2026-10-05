"use client";

import type { ReactNode } from "react";
import type { CandidateStatus, DateOrigin } from "@/lib/core/types";

/** Hover/focus tooltip with a small info mark. */
export function Tip({ text, children }: { text: ReactNode; children?: ReactNode }) {
  return (
    <span className="group relative inline-flex items-center gap-1 align-middle">
      {children}
      <span
        tabIndex={0}
        className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-stone-400 text-[10px] font-semibold leading-none text-stone-500 outline-none dark:border-stone-600"
        aria-label="More info"
      >
        i
      </span>
      <span className="pointer-events-none absolute left-0 top-full z-50 mt-1 hidden w-72 rounded-md bg-stone-900 p-2.5 text-xs font-normal normal-case leading-relaxed tracking-normal text-stone-100 shadow-lg group-focus-within:block group-hover:block dark:bg-stone-100 dark:text-stone-900">
        {text}
      </span>
    </span>
  );
}

export const usd = (n: number) => (n === 0 ? "$0" : n < 0.01 ? `$${n.toFixed(4)}` : `$${n.toFixed(3)}`);
export const secs = (ms: number) => `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)}s`;

function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}

/** Date badge coloured by freshness relative to the issue window. */
const ORIGIN: Record<DateOrigin, string> = {
  search: "from the search engine",
  page: "verified on the page itself",
  received: "the day it arrived from your subscription",
  window: "inside the window according to the search engine's date filter",
  model: "read from the text by the model, not verified",
  none: "",
};

export function DateBadge({ date, from, note, since, until }: { date?: string; from?: DateOrigin; note?: string; since: string; until: string }) {
  if (!date && from === "window") {
    return (
      <span title={note} className="rounded bg-sky-100 px-1.5 py-0.5 font-mono text-[11px] text-sky-800 dark:bg-sky-950 dark:text-sky-300">
        ≈ in window
      </span>
    );
  }
  if (!date) {
    return (
      <span title={`No publication date. ${note ?? ""}`} className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-[11px] text-amber-800 dark:bg-amber-950 dark:text-amber-300">
        no date
      </span>
    );
  }
  const old = date < since;
  const age = daysBetween(date, until);
  const cls = old
    ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
    : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300";
  const origin = ` (${ORIGIN[from ?? "search"]}${note && from === "page" ? `: ${note}` : ""})`;
  return (
    <span title={`Published ${date}${origin}${old ? `. Older than the window start ${since}.` : ""}`} className={`rounded px-1.5 py-0.5 font-mono text-[11px] ${cls} ${from === "model" ? "border border-dashed border-current" : ""}`}>
      {from === "page" ? "✓ " : ""}{date} · {age <= 0 ? "today" : `${age}d ago`}
    </span>
  );
}

export const STATUS: Record<CandidateStatus, { label: string; cls: string; help: string }> = {
  used: { label: "used", cls: "bg-emerald-600 text-white", help: "Became a story in this issue." },
  shortlisted: { label: "shortlisted", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300", help: "Passed every filter and was shown to the editor, who chose not to use it (duplicate event, weaker source, or not enough room)." },
  "low-score": { label: "low score", cls: "bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300", help: "The triage model scored it below the threshold: off topic, evergreen, SEO filler, or minor." },
  "too-old": { label: "too old", cls: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300", help: "Published before the start of this issue's window." },
  "already-sent": { label: "already sent", cls: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300", help: "The same news as a story you received in a past issue, even if worded differently. Nemotron compared it with your whole history." },
  duplicate: { label: "duplicate", cls: "bg-sky-50 text-sky-700 ring-1 ring-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:ring-sky-900", help: "The same news as another result in this issue; only the best source is kept." },
  "no-date": { label: "no date", cls: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300", help: "Neither the search engine nor the page itself gives a publication date, so there is no way to know it is recent. Dropped unless you allow undated results in Settings." },
  "wrong-language": { label: "wrong language", cls: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300", help: "The source is in a language this newsletter doesn't search in (for a video, its spoken language). Dropped." },
  blocked: { label: "blocked", cls: "bg-stone-800 text-white dark:bg-stone-300 dark:text-stone-900", help: "The domain is on your block list." },
  unscored: { label: "unscored", cls: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300", help: "The triage model skipped it (usually a malformed response). Treated as rejected." },
};

export function StatusBadge({ status }: { status: CandidateStatus }) {
  const s = STATUS[status];
  return <span title={s.help} className={`whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-medium ${s.cls}`}>{s.label}</span>;
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-lg border border-rule bg-sheet p-5  ${className}`}>{children}</section>;
}

export function H3({ children }: { children: ReactNode }) {
  return <h3 className="mb-3 text-sm font-semibold text-ink">{children}</h3>;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const shortDate = (iso: string) => `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}`;

/**
 * The reader-facing date: a violet rubber stamp for a verified date inside the window.
 * Anything weaker is drawn differently, so an unverified date never looks like a verified one.
 */
export function Stamp({ date, from, note, since, animate = false, className = "" }: { date?: string; from?: DateOrigin; note?: string; since: string; animate?: boolean; className?: string }) {
  const base = `stamp ${animate ? "stamp-land" : ""} ${className}`;
  if (!date && from === "window") return <span className={base} style={{ color: "var(--color-stone-500)" }} title={note}>≈ this window</span>;
  if (!date) return <span className={base} style={{ color: "var(--color-caution)" }} title={note ?? "No publication date"}>no date</span>;
  if (date < since) return <span className={base} style={{ color: "#c0392b" }} title={`Published ${date}, before this issue's window`}>{shortDate(date)} · old</span>;
  const verified = from === "page" || from === "search" || from === "received";
  return (
    <span className={base} style={verified ? undefined : { color: "var(--color-stone-500)", borderStyle: "dashed" }} title={`Published ${date}. ${ORIGIN[from ?? "search"]}${note && from === "page" ? ` (${note})` : ""}`}>
      {verified && <span aria-hidden>✓</span>}
      {shortDate(date)}
    </span>
  );
}
