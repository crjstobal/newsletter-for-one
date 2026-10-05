"use client";

import Link from "next/link";
import { LayoutGrid, List, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import type { Story } from "@/lib/core/types";
import { Collage, IssueBars } from "./visuals";
import { shortDate } from "./ui";

export type NewsletterCard = {
  id: string;
  name: string;
  topic: string;
  createdAt: string;
  lastIssueDate?: string;
  lastSubject?: string;
  lastStories: Story[];
  themes: string[];
  issueCount: number;
  storyCount: number;
  learned: number;
  bars: { id: string; date: string; stories: number }[];
  delivery: string;
  paused: boolean;
  language: string;
};

type Sort = "latest" | "created" | "name" | "issues";
type View = "grid" | "list";

const SORTS: [Sort, string][] = [["latest", "Latest issue"], ["created", "Newest first"], ["name", "Name"], ["issues", "Most issues"]];

const compare: Record<Sort, (a: NewsletterCard, b: NewsletterCard) => number> = {
  latest: (a, b) => (b.lastIssueDate ?? "").localeCompare(a.lastIssueDate ?? "") || b.createdAt.localeCompare(a.createdAt),
  created: (a, b) => b.createdAt.localeCompare(a.createdAt),
  name: (a, b) => a.name.localeCompare(b.name),
  issues: (a, b) => b.issueCount - a.issueCount || a.name.localeCompare(b.name),
};

/** Sort and view are remembered per browser. */
const KEY = "n41-newsletters-view";

export function NewslettersBrowser({ cards }: { cards: NewsletterCard[] }) {
  const [sort, setSort] = useState<Sort>("latest");
  const [view, setView] = useState<View>("grid");

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? "{}") as { sort?: Sort; view?: View };
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved.sort && compare[saved.sort]) setSort(saved.sort);
      if (saved.view === "grid" || saved.view === "list") setView(saved.view);
    } catch {
      // no storage: defaults
    }
  }, []);

  const remember = (next: { sort?: Sort; view?: View }) => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ sort, view, ...next }));
    } catch {
      // no storage
    }
  };

  const sorted = [...cards].sort(compare[sort]);

  return (
    <>
      {cards.length > 1 && (
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm text-stone-600 dark:text-stone-400">
            Sort by
            <select
              value={sort}
              onChange={(e) => { const s = e.target.value as Sort; setSort(s); remember({ sort: s }); }}
              className="h-10 rounded-lg border border-rule bg-sheet px-3 text-sm text-ink"
            >
              {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <div role="radiogroup" aria-label="View" className="inline-flex h-10 rounded-lg border border-rule bg-sheet p-1">
            {([["grid", LayoutGrid, "Cards"], ["list", List, "List"]] as const).map(([v, Icon, label]) => (
              <button
                key={v}
                role="radio"
                aria-checked={view === v}
                aria-label={label}
                title={label}
                onClick={() => { setView(v); remember({ view: v }); }}
                className={`flex w-10 items-center justify-center rounded-md ${view === v ? "bg-paper text-ink ring-1 ring-rule" : "text-stone-500 hover:text-ink"}`}
              >
                <Icon size={16} />
              </button>
            ))}
          </div>
        </div>
      )}

      {view === "grid" ? (
        <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((c) => <GridCard key={c.id} c={c} />)}
          <li>
            <Link href="/newsletters/new" className="flex h-full min-h-72 flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-rule p-8 text-center text-stone-600 transition-all duration-200 hover:-translate-y-1 hover:border-stamp hover:bg-stamp-soft/40 motion-reduce:hover:translate-y-0 hover:text-stamp dark:text-stone-400">
              <span className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-current"><Plus size={22} /></span>
              <span className="text-lg font-bold">Start a newsletter</span>
              <span className="max-w-56 text-sm text-stone-500">Pick a topic or describe it. One sentence is enough.</span>
            </Link>
          </li>
        </ul>
      ) : (
        <ul className="mt-6 divide-y divide-rule overflow-hidden rounded-xl border border-rule bg-sheet">
          {sorted.map((c) => <ListRow key={c.id} c={c} />)}
          <li>
            <Link href="/newsletters/new" className="flex items-center gap-4 px-5 py-4 font-semibold text-stone-600 hover:bg-stamp-soft hover:text-stamp dark:text-stone-400">
              <span className="flex h-12 w-16 shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-current"><Plus size={18} /></span>
              Start a newsletter
            </Link>
          </li>
        </ul>
      )}
    </>
  );
}

function Meta({ c }: { c: NewsletterCard }) {
  return (
    <>
      {c.paused && <span className="font-semibold text-caution">Paused · </span>}
      {c.delivery}, in {c.language}
      {c.lastIssueDate ? ` · last issue ${shortDate(c.lastIssueDate)}` : ""}
    </>
  );
}

function GridCard({ c }: { c: NewsletterCard }) {
  return (
    <li>
      <Link
        href={`/newsletters/${c.id}`}
        className="group block h-full overflow-hidden rounded-xl border border-rule bg-sheet transition-all duration-200 hover:-translate-y-1 hover:border-stone-300 hover:shadow-[0_22px_40px_-22px_rgba(22,24,29,0.45)] motion-reduce:hover:translate-y-0 dark:hover:border-stone-700"
      >
        <div className="overflow-hidden">
          {c.lastStories.length ? (
            <Collage stories={c.lastStories} className="aspect-[16/9] transition-transform duration-500 group-hover:scale-[1.04] motion-reduce:group-hover:scale-100" />
          ) : (
            <div className="relative flex aspect-[16/9] items-center justify-center bg-[radial-gradient(120%_120%_at_15%_10%,var(--color-stamp-soft),color-mix(in_srgb,var(--color-stamp)_30%,var(--color-sheet)))]">
              <span className="font-serif text-6xl font-semibold text-stamp/50">{c.name.match(/[a-z0-9]/i)?.[0]?.toUpperCase()}</span>
              <span className="absolute bottom-2.5 left-3 text-xs font-semibold text-stamp">No issue yet</span>
            </div>
          )}
        </div>
        <div className="p-5">
          <h2 className="text-xl font-bold tracking-tight group-hover:underline">{c.name}</h2>
          <p className="mt-1 line-clamp-2 text-sm text-stone-600 dark:text-stone-400">{c.topic}</p>
          {c.lastSubject && (
            <p className="mt-3 line-clamp-2 font-serif text-[15px] leading-snug">
              <span className="font-sans text-xs text-stone-500">Latest: </span>
              {c.lastSubject}
            </p>
          )}
          {c.themes.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {c.themes.map((t) => <li key={t} className="rounded-full border border-rule px-2 py-0.5 text-xs text-stone-600 dark:text-stone-400">{t}</li>)}
            </ul>
          )}
          <div className="mt-4 flex items-end justify-between gap-4 border-t border-rule pt-4">
            <dl className="grid grid-cols-3 gap-4 text-sm">
              <div><dt className="text-xs text-stone-500">Issues</dt><dd className="font-semibold tabular-nums">{c.issueCount}</dd></div>
              <div><dt className="text-xs text-stone-500">Stories</dt><dd className="font-semibold tabular-nums">{c.storyCount}</dd></div>
              <div><dt className="text-xs text-stone-500">Learned</dt><dd className="font-semibold tabular-nums">{c.learned}</dd></div>
            </dl>
            {c.bars.length > 1 && <IssueBars issues={c.bars} />}
          </div>
          <p className="mt-3 text-xs text-stone-500"><Meta c={c} /></p>
        </div>
      </Link>
    </li>
  );
}

function ListRow({ c }: { c: NewsletterCard }) {
  return (
    <li>
      <Link href={`/newsletters/${c.id}`} className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-paper">
        {c.lastStories.length ? (
          <Collage stories={c.lastStories} className="h-12 w-16 shrink-0 rounded-lg transition-transform duration-300 group-hover:scale-105" />
        ) : (
          <span className="h-12 w-16 shrink-0 rounded-lg bg-stone-100 dark:bg-stone-800" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold group-hover:underline">{c.name}</p>
          <p className="truncate text-sm text-stone-500">{c.lastSubject ? `Latest: ${c.lastSubject}` : c.topic}</p>
        </div>
        <p className="hidden shrink-0 text-right text-sm text-stone-500 md:block"><Meta c={c} /></p>
        <span className="hidden w-20 shrink-0 text-right text-sm tabular-nums text-stone-500 sm:block">{c.issueCount} {c.issueCount === 1 ? "issue" : "issues"}</span>
      </Link>
    </li>
  );
}
