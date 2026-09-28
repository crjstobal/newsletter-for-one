"use client";

/* eslint-disable @next/next/no-img-element -- source images are external and unknown in advance */

import { useState } from "react";
import type { Issue, Story } from "@/lib/core/types";
import { shortDate } from "./ui";
import { themeColor, themesOf } from "./themes";

export { themeColor, themesOf };

/** The source's own preview image, or a quiet tile in the story's theme color when there is none. */
export function StoryImage({ story, color, className = "" }: { story: Story; color: string; className?: string }) {
  const [broken, setBroken] = useState(false);
  if (story.image && !broken) {
    return (
      <img
        src={story.image}
        alt=""
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
        className={`bg-stone-100 object-cover dark:bg-stone-800 ${className}`}
      />
    );
  }
  return (
    <div className={`flex items-end p-2.5 ${className}`} style={{ background: `color-mix(in srgb, ${color} 22%, var(--color-sheet))` }}>
      <span className="text-sm font-bold leading-none" style={{ color: `color-mix(in srgb, ${color} 55%, var(--color-ink))` }}>{story.source}</span>
    </div>
  );
}

const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/**
 * Mind map of the issue: newsletter, then themes, then stories. Drawn left to right so every
 * headline stays readable; each story links to its place in the issue.
 */
export function IssueMap({ issue, name }: { issue: Issue; name: string }) {
  const themes = themesOf(issue.stories);
  const rows = themes.flatMap((t) => issue.stories.map((s, i) => ({ s, i })).filter((x) => (x.s.theme ?? "Stories") === t));
  const ROW = 44;
  const PAD = 18;
  const H = Math.max(rows.length * ROW + PAD * 2, 140);
  const X_ROOT = 12;
  const X_THEME = 220;
  const X_STORY = 470;
  const THEME_W = 200;
  const y = (row: number) => PAD + row * ROW + ROW / 2;
  const rootY = H / 2;

  const counts = themes.map((t) => rows.filter((r) => (r.s.theme ?? "Stories") === t).length);
  const themeNodes = themes.map((t, k) => {
    const from = counts.slice(0, k).reduce((a, b) => a + b, 0);
    return { t, y: (y(from) + y(from + counts[k] - 1)) / 2, count: counts[k] };
  });

  const curve = (x1: number, y1: number, x2: number, y2: number) => {
    const mx = (x1 + x2) / 2;
    return `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
  };

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 960 ${H}`} className="block w-full min-w-[640px]" role="img" aria-label={`Map of this issue: ${themes.length} themes, ${issue.stories.length} stories`}>
        {themeNodes.map((n) => (
          <path key={`r-${n.t}`} d={curve(X_ROOT + 150, rootY, X_THEME, n.y)} fill="none" stroke="var(--color-rule)" strokeWidth={2} />
        ))}
        {rows.map((r, row) => {
          const n = themeNodes.find((x) => x.t === (r.s.theme ?? "Stories"))!;
          return <path key={`l-${r.i}`} d={curve(X_THEME + THEME_W, n.y, X_STORY, y(row))} fill="none" stroke={themeColor(themes, r.s.theme)} strokeOpacity={0.45} strokeWidth={1.5} />;
        })}

        <g>
          <rect x={X_ROOT} y={rootY - 22} width={150} height={44} rx={10} fill="var(--color-ink)" />
          <text x={X_ROOT + 75} y={rootY + 5} textAnchor="middle" fill="var(--color-paper)" fontSize={14} fontWeight={700}>
            {truncate(name, 18)}
          </text>
        </g>

        {themeNodes.map((n) => {
          const c = themeColor(themes, n.t);
          return (
            <g key={n.t}>
              <rect x={X_THEME} y={n.y - 17} width={THEME_W} height={34} rx={17} fill={`color-mix(in srgb, ${c} 16%, var(--color-sheet))`} stroke={c} strokeWidth={1.5} />
              <text x={X_THEME + THEME_W / 2} y={n.y + 5} textAnchor="middle" fill={`color-mix(in srgb, ${c} 55%, var(--color-ink))`} fontSize={13} fontWeight={700}>
                {truncate(n.t, 22)} ({n.count})
              </text>
            </g>
          );
        })}

        {rows.map((r, row) => {
          const c = themeColor(themes, r.s.theme);
          return (
            <a key={r.i} href={`#story-${r.i}`}>
              <g className="cursor-pointer [&:hover_text]:underline">
                <circle cx={X_STORY + 12} cy={y(row)} r={12} fill={c} />
                <text x={X_STORY + 12} y={y(row) + 4} textAnchor="middle" fill="#fff" fontSize={11} fontWeight={700}>{r.i + 1}</text>
                <text x={X_STORY + 32} y={y(row) + 5} fill="var(--color-ink)" fontSize={13.5}>
                  {r.s.shortTitle ?? truncate(r.s.headline, 58)}
                </text>
              </g>
            </a>
          );
        })}
      </svg>
    </div>
  );
}

/**
 * Where every story sits inside the issue's window. The at-a-glance proof that the issue is
 * made of recent material: every dot should land between the two ends of the axis.
 */
export function FreshnessTimeline({ issue }: { issue: Issue }) {
  const { since, until } = issue.trace.window;
  const day = 86_400_000;
  const start = Date.parse(since);
  const days = Math.max(1, Math.round((Date.parse(until) - start) / day));
  const W = 560;
  const L = 24;
  const R = 24;
  const AXIS = 70;
  const x = (iso: string) => L + ((Date.parse(iso) - start) / day / days) * (W - L - R);

  const placed: Record<string, number> = {};
  const dated = issue.stories.map((s, i) => ({ s, i })).filter((d) => d.s.publishedDate && d.s.publishedDate >= since);
  const undated = issue.stories.map((s, i) => ({ s, i })).filter((d) => !d.s.publishedDate);
  const old = issue.stories.filter((s) => s.publishedDate && s.publishedDate < since).length;

  return (
    <div>
      <svg viewBox={`0 0 ${W} 104`} className="block w-full" role="img" aria-label={`${dated.length} stories dated inside the window ${since} to ${until}`}>
        <line x1={L} x2={W - R} y1={AXIS} y2={AXIS} stroke="var(--color-rule)" strokeWidth={2} />
        {Array.from({ length: days + 1 }, (_, d) => {
          const iso = new Date(start + d * day).toISOString().slice(0, 10);
          const edge = d === 0 || d === days;
          return (
            <g key={d}>
              <line x1={x(iso)} x2={x(iso)} y1={AXIS - (edge ? 7 : 4)} y2={AXIS + (edge ? 7 : 4)} stroke="var(--color-stone-400)" strokeWidth={edge ? 2 : 1} />
              {(edge || days <= 10) && (
                <text x={x(iso)} y={AXIS + 22} textAnchor="middle" fontSize={11} fill="var(--color-stone-500)" fontWeight={edge ? 700 : 400}>
                  {shortDate(iso)}
                </text>
              )}
            </g>
          );
        })}
        {dated.map(({ s, i }) => {
          const key = s.publishedDate!;
          const stack = (placed[key] = (placed[key] ?? 0) + 1) - 1;
          const cx = Math.min(W - R, x(key));
          const cy = AXIS - 16 - stack * 24;
          const verified = s.dateFrom === "page" || s.dateFrom === "search";
          return (
            <a key={i} href={`#story-${i}`}>
              <circle cx={cx} cy={cy} r={10} fill={verified ? "var(--color-stamp)" : "var(--color-sheet)"} stroke="var(--color-stamp)" strokeWidth={1.5} strokeDasharray={verified ? undefined : "3 2"} />
              <text x={cx} y={cy + 4} textAnchor="middle" fontSize={10} fontWeight={700} fill={verified ? "#fff" : "var(--color-stamp)"}>{i + 1}</text>
            </a>
          );
        })}
      </svg>
      <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
        {dated.length} of {issue.stories.length} stories dated inside the window
        {undated.length > 0 && `, ${undated.length} without exact date (${undated.map((u) => `#${u.i + 1}`).join(", ")})`}
        {old > 0 && <span className="text-red-600">, {old} older</span>}.
      </p>
    </div>
  );
}

/** Which sites the issue drew on, as one proportional bar. */
export function SourceMix({ stories }: { stories: Story[] }) {
  const counts = new Map<string, number>();
  const domainOf = new Map<string, string>();
  for (const s of stories) {
    const label = s.publisher ?? s.source;
    counts.set(label, (counts.get(label) ?? 0) + 1);
    domainOf.set(label, s.source);
  }
  const entries = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const tones = ["var(--color-ink)", "var(--color-stone-500)", "var(--color-stone-400)", "var(--color-stone-300)", "var(--color-stone-200)"];
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full">
        {entries.map(([site, n], i) => (
          <div key={site} title={`${site}: ${n}`} style={{ width: `${(n / stories.length) * 100}%`, background: tones[Math.min(i, tones.length - 1)] }} />
        ))}
      </div>
      <ul className="mt-3 space-y-1.5 text-sm">
        {entries.map(([site, n], i) => (
          <li key={site} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: tones[Math.min(i, tones.length - 1)] }} />
            <img src={`https://www.google.com/s2/favicons?domain=${domainOf.get(site)}&sz=32`} alt="" className="h-4 w-4" referrerPolicy="no-referrer" />
            <span className="flex-1 truncate">{site}</span>
            <span className="tabular-nums text-stone-500">{n}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Up to four story images from an issue, as a cover. */
export function Collage({ stories, className = "" }: { stories: Story[]; className?: string }) {
  const themes = themesOf(stories);
  const pick = [...stories].sort((a, b) => Number(Boolean(b.image)) - Number(Boolean(a.image))).slice(0, 4);
  if (!pick.length) return <div className={`bg-stone-100 dark:bg-stone-800 ${className}`} />;
  const layout = pick.length >= 3 ? "grid-cols-2 grid-rows-2" : pick.length === 2 ? "grid-cols-2" : "grid-cols-1";
  return (
    <div className={`grid gap-0.5 overflow-hidden ${layout} ${className}`}>
      {pick.map((s, i) => (
        <StoryImage key={s.url} story={s} color={themeColor(themes, s.theme)} className={`h-full w-full ${pick.length === 3 && i === 0 ? "row-span-2" : ""}`} />
      ))}
    </div>
  );
}

/** Stories per issue, oldest to newest. */
export function IssueBars({ issues }: { issues: Issue[] }) {
  const last = [...issues].reverse().slice(-10);
  const max = Math.max(1, ...last.map((i) => i.stories.length));
  return (
    <div className="flex h-8 items-end gap-1" aria-label="Stories per issue">
      {last.map((i) => (
        <div key={i.id} title={`${i.date}: ${i.stories.length} stories`} className="w-2 rounded-sm bg-stone-300 dark:bg-stone-600" style={{ height: `${Math.max(12, (i.stories.length / max) * 100)}%` }} />
      ))}
    </div>
  );
}
