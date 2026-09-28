"use client";

import { ChevronLeft, ChevronRight, Gauge } from "lucide-react";
import type { Issue, Newsletter } from "@/lib/core/types";
import { Postmark } from "./Postmark";
import { SourceMenu, StoryFeedback } from "./StoryActions";
import { Stamp, Tip, secs, shortDate, usd } from "./ui";
import { FreshnessTimeline, IssueMap, SourceMix, StoryImage, themeColor, themesOf } from "./visuals";

export type IssueNav = { number: number; total: number; prev?: () => void; next?: () => void };

export function IssueView({
  issue,
  newsletter,
  nav,
  onVote,
  onDomain,
  onOpenTrace,
}: {
  issue: Issue;
  newsletter: Newsletter;
  nav: IssueNav;
  onVote: (storyIndex: number, vote: "up" | "down", note?: string) => Promise<void>;
  onDomain: (domain: string, list: "domains" | "blockedDomains") => void;
  onOpenTrace: () => void;
}) {
  const tr = issue.trace;
  const problems = tr.checks.filter((c) => c.level !== "ok");
  const bad = tr.checks.some((c) => c.level === "bad");
  const themes = themesOf(issue.stories);
  const year = tr.window.until.slice(0, 4);

  return (
    <div className="space-y-10">
      {/* Masthead: which issue, which dates */}
      <header className="rounded-2xl border border-rule bg-sheet px-6 py-8 sm:px-10 sm:py-10">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4 text-sm">
          <div className="flex items-center gap-1">
            <button onClick={nav.prev} disabled={!nav.prev} aria-label="Previous issue" className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-rule disabled:opacity-30">
              <ChevronLeft size={16} />
            </button>
            <span className="px-2 tabular-nums text-stone-600 dark:text-stone-400">Issue {nav.number} of {nav.total}</span>
            <button onClick={nav.next} disabled={!nav.next} aria-label="Next issue" className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-rule disabled:opacity-30">
              <ChevronRight size={16} />
            </button>
          </div>
          <button onClick={onOpenTrace} className="inline-flex items-center gap-2 rounded-full border border-dashed border-rule px-3 py-1.5 text-stone-600 hover:border-stone-400 dark:text-stone-400">
            <Gauge size={15} />
            <span>{usd(tr.totals.costUsd)}, {secs(tr.totals.ms)}</span>
            <span className={`h-2 w-2 rounded-full ${bad ? "bg-red-500" : problems.length ? "bg-amber-500" : "bg-emerald-500"}`} />
            <span>{problems.length ? `${problems.length} to review` : "checks passed"}</span>
          </button>
        </div>

        <div className="flex flex-col gap-8 sm:flex-row sm:items-center">
          <Postmark number={nav.number} since={tr.window.since} until={tr.window.until} name={newsletter.profile.name} />
          <div className="min-w-0">
            <p className="text-sm text-stone-500">
              Issue {nav.number}, covering {shortDate(tr.window.since)} to {shortDate(tr.window.until)} {year}
            </p>
            <h2 className="mt-2 font-serif text-3xl font-semibold leading-tight sm:text-[2.1rem]">{issue.subject}</h2>
            <p className="mt-3 max-w-2xl font-serif text-lg leading-relaxed text-stone-600 dark:text-stone-400">{issue.intro}</p>
          </div>
        </div>

        {/* Freshness and sources: the two things to check before reading */}
        <div className="mt-10 grid gap-8 border-t border-rule pt-8 md:grid-cols-[1fr_260px] md:gap-12">
          <div>
            <h3 className="mb-2 text-sm font-semibold">
              <Tip text={`Each numbered dot is a story placed on its publication date. Filled: date verified on the source. Dashed: date only mentioned in the text. Everything should sit between ${tr.window.since} and ${tr.window.until}.`}>How fresh it is</Tip>
            </h3>
            <FreshnessTimeline issue={issue} />
          </div>
          <div>
            <h3 className="mb-3 text-sm font-semibold">
              <Tip text="Who the stories come from: sites, YouTube channels and Reddit communities. No publisher can supply more than 2 stories per issue.">Where it comes from</Tip>
            </h3>
            <SourceMix stories={issue.stories} />
          </div>
        </div>

        {problems.length > 0 && (
          <ul className="mt-8 space-y-1 border-t border-rule pt-5 text-sm text-stone-600 dark:text-stone-400">
            {problems.map((c, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${c.level === "bad" ? "bg-red-500" : "bg-amber-500"}`} />
                {c.message}
              </li>
            ))}
          </ul>
        )}
      </header>

      <section aria-label="Map of this issue" className="rounded-2xl border border-rule bg-sheet p-6">
        <h3 className="mb-4 font-semibold">
          <Tip text="Stories grouped by theme. Nemotron labels each story and writes the short titles; the map is drawn from those. Click a story to jump to it.">Map of this issue</Tip>
        </h3>
        <IssueMap issue={issue} name={newsletter.profile.name} />
      </section>

      {/* Stories */}
      <ol className="rounded-2xl border border-rule bg-sheet px-6 sm:px-10">
        {issue.stories.map((s, i) => {
          const color = themeColor(themes, s.theme);
          return (
            <li key={s.url} id={`story-${i}`} className="scroll-mt-24 border-b border-rule py-10 last:border-b-0">
              <div className="grid gap-7 md:grid-cols-[1fr_260px]">
                <div className="min-w-0">
                  <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: color }}>{i + 1}</span>
                    {s.theme && <span className="font-semibold" style={{ color: `color-mix(in srgb, ${color} 60%, var(--color-ink))` }}>{s.theme}</span>}
                    <Stamp date={s.publishedDate} from={s.dateFrom} since={tr.window.since} />
                  </div>
                  <h3 className="font-serif text-2xl font-semibold leading-snug">
                    <a href={s.url} target="_blank" rel="noreferrer" className="decoration-stamp decoration-2 underline-offset-4 hover:underline">{s.headline}</a>
                  </h3>
                  <p className="mt-3 font-serif text-[17px] leading-8 text-stone-700 dark:text-stone-300">{s.summary}</p>
                  <p className="mt-4 border-l-2 pl-4 font-serif text-[17px] leading-8" style={{ borderColor: color }}>
                    <span className="mb-0.5 block font-sans text-xs font-semibold text-stone-500">Why it matters to you</span>
                    {s.whyItMatters}
                  </p>
                </div>
                <a href={s.url} target="_blank" rel="noreferrer" tabIndex={-1} aria-hidden className="order-first block md:order-none">
                  <StoryImage story={s} color={color} className="aspect-video w-full rounded-xl" />
                  <span className="mt-2 block text-sm text-stone-500">{s.publisher ?? s.source}</span>
                </a>
              </div>
              <div className="mt-6 flex items-center justify-between gap-4">
                <StoryFeedback story={s} onVote={(vote, note) => onVote(i, vote, note)} />
                <SourceMenu story={s} onDomain={onDomain} />
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
