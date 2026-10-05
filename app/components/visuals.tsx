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
  return <SourceTile story={story} color={color} className={className} />;
}

const REDDIT_PATH =
  "M12 0C5.373 0 0 5.373 0 12c0 3.314 1.343 6.314 3.515 8.485l-2.286 2.286C.775 23.225 1.097 24 1.738 24H12c6.627 0 12-5.373 12-12S18.627 0 12 0Zm4.388 3.199c1.104 0 1.999.895 1.999 1.999 0 1.105-.895 2-1.999 2-.946 0-1.739-.657-1.947-1.539v.002c-1.147.162-2.032 1.15-2.032 2.341v.007c1.776.067 3.4.567 4.686 1.363.473-.363 1.064-.58 1.707-.58 1.547 0 2.802 1.254 2.802 2.802 0 1.117-.655 2.081-1.601 2.531-.088 3.256-3.637 5.876-7.997 5.876-4.361 0-7.905-2.617-7.998-5.87-.954-.447-1.614-1.415-1.614-2.538 0-1.548 1.255-2.802 2.803-2.802.645 0 1.239.218 1.712.585 1.275-.79 2.881-1.291 4.64-1.365v-.01c0-1.663 1.263-3.034 2.88-3.207.188-.911.993-1.595 1.959-1.595Zm-8.085 8.376c-.784 0-1.459.78-1.506 1.797-.047 1.016.64 1.429 1.426 1.429.786 0 1.371-.369 1.418-1.385.047-1.017-.553-1.841-1.338-1.841Zm7.406 0c-.786 0-1.385.824-1.338 1.841.047 1.017.634 1.385 1.418 1.385.785 0 1.473-.413 1.426-1.429-.046-1.017-.721-1.797-1.506-1.797Zm-3.703 4.013c-.974 0-1.907.048-2.77.135-.147.015-.241.168-.183.305.483 1.154 1.622 1.964 2.953 1.964 1.33 0 2.47-.81 2.953-1.964.057-.137-.037-.29-.184-.305-.863-.087-1.795-.135-2.769-.135Z";

/**
 * When a source publishes no image: Reddit gets its own mark, anything else a large initial
 * on a gradient in the story's theme color ("H" for home-barista.com). Sizes with the container.
 */
function SourceTile({ story, color, className }: { story: Story; color: string; className: string }) {
  const name = story.publisher ?? story.via ?? story.source;
  if (/(^|\.)reddit\.com$/.test(story.source)) {
    return (
      <div className={`@container relative flex items-center justify-center overflow-hidden ${className}`} style={{ background: "linear-gradient(135deg, #ff5700, #ff4500 55%, #d93a00)" }}>
        <svg viewBox="0 0 24 24" aria-hidden className="h-[38%] max-h-24 w-auto fill-white drop-shadow-sm"><path d={REDDIT_PATH} /></svg>
        <span className="absolute bottom-2 left-2.5 right-2.5 hidden truncate text-xs font-bold text-white/90 @[9rem]:block">{name.replace(/ \(Reddit\)$/, "")}</span>
      </div>
    );
  }
  const initial = (story.source.replace(/^(www|m|blog|news)\./, "").match(/[a-z0-9]/i)?.[0] ?? "?").toUpperCase();
  return (
    <div
      className={`@container relative flex items-center justify-center overflow-hidden ${className}`}
      style={{ background: `radial-gradient(120% 120% at 15% 10%, color-mix(in srgb, ${color} 30%, var(--color-sheet)), color-mix(in srgb, ${color} 62%, var(--color-sheet)))` }}
    >
      <span className="font-serif text-[clamp(1.25rem,28cqw,5rem)] font-semibold leading-none" style={{ color: `color-mix(in srgb, ${color} 35%, var(--color-sheet))` }}>{initial}</span>
      <span className="absolute bottom-2 left-2.5 right-2.5 hidden truncate text-xs font-bold @[9rem]:block" style={{ color: `color-mix(in srgb, ${color} 70%, var(--color-ink))` }}>{name}</span>
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
          const verified = s.dateFrom === "page" || s.dateFrom === "search" || s.dateFrom === "received";
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
export function IssueBars({ issues }: { issues: { id: string; date: string; stories: number }[] }) {
  const last = [...issues].reverse().slice(-10);
  const max = Math.max(1, ...last.map((i) => i.stories));
  return (
    <div className="flex h-8 items-end gap-1" aria-label="Stories per issue">
      {last.map((i) => (
        <div key={i.id} title={`${i.date}: ${i.stories} stories`} className="w-2 rounded-sm bg-stone-300 dark:bg-stone-600" style={{ height: `${Math.max(12, (i.stories / max) * 100)}%` }} />
      ))}
    </div>
  );
}
