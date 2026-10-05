"use client";

import { Smile } from "lucide-react";
import type { Style, StylePreset, Voice } from "@/lib/core/types";

const LENGTHS: { value: StylePreset; label: string; hint: string }[] = [
  { value: "rundown", label: "Rundown", hint: "Headlines and links. Scan it in 30 seconds." },
  { value: "straight", label: "Straight", hint: "Two or three sentences per story." },
  { value: "dense", label: "Dense", hint: "More facts per line, no filler." },
  { value: "deep", label: "In depth", hint: "Context, background and what to watch next." },
];

/** One example story told every way, so the reader picks by seeing, not by reading labels. */
const SAMPLE: Record<Voice, Record<StylePreset, { headline: string; summary?: string; why?: string }> & { joke: string }> = {
  neutral: {
    rundown: { headline: "Final Cut Pro 12.1 makes exports up to twice as fast" },
    straight: {
      headline: "Final Cut Pro 12.1 makes exports up to twice as fast",
      summary: "Apple released Final Cut Pro 12.1 with a new export engine for Apple silicon. Long timelines finish up to twice as fast, and the update is free for current owners.",
      why: "Your weekly exports could take half the time without new hardware.",
    },
    dense: {
      headline: "Final Cut Pro 12.1: exports up to 2x faster, free update",
      summary: "Version 12.1 replaces the export engine on M-series Macs: up to 2x faster on timelines over 30 minutes, HEVC 10-bit hardware encoding on M3 and later, and parallel exports to several formats. Free for current owners; requires macOS 15.4.",
      why: "Batch exports of your long videos are where you save the most.",
    },
    deep: {
      headline: "Final Cut Pro 12.1 rebuilds exporting around Apple silicon",
      summary: "Apple released Final Cut Pro 12.1 with a rewritten export engine for M-series chips. On timelines over 30 minutes exports finish up to twice as fast, and several formats can now render in parallel. It is the first large change to exporting since version 10.6, which had been the main complaint in Apple's own forums. Apple says more of the pipeline will move to the GPU in later updates, so watch for plugin compatibility notes before upgrading mid-project.",
      why: "If exports are your bottleneck, this is the update to plan a free afternoon around.",
    },
    joke: "Your render bar just lost its favourite excuse for a coffee break.",
  },
  playful: {
    rundown: { headline: "Final Cut Pro 12.1: exports stop dawdling" },
    straight: {
      headline: "Final Cut Pro 12.1 finally tells exports to hurry up",
      summary: "Apple shipped Final Cut Pro 12.1 with a new export engine for Apple silicon, and long timelines now finish up to twice as fast. It costs nothing if you already own it, which is Apple's favourite price when it's apologising.",
      why: "Half the waiting, same Mac. Your evenings say thanks.",
    },
    dense: {
      headline: "Final Cut Pro 12.1: 2x exports, zero euros",
      summary: "New export engine on M-series Macs: up to 2x faster on 30+ minute timelines, 10-bit HEVC in hardware on M3 and up, and several formats at once. Free for owners, needs macOS 15.4, and no, it still won't pick your thumbnail.",
      why: "Batch exports are where the time comes back.",
    },
    deep: {
      headline: "Final Cut Pro 12.1 rebuilds exporting, and about time",
      summary: "Apple rewrote Final Cut Pro's export engine for its own chips in 12.1. Long timelines finish up to twice as fast and formats render in parallel. It's the biggest change to exporting since 10.6, which the forums had been politely screaming about for years. Apple hints more of the pipeline moves to the GPU later, so check your plugins before upgrading in the middle of a project.",
      why: "If exports are your bottleneck, block a free afternoon and enjoy.",
    },
    joke: "Your render bar just lost its favourite excuse for a coffee break.",
  },
};

export function StylePicker({ style, onChange }: { style: Style; onChange: (patch: Partial<Style>) => void }) {
  const voice = style.voice ?? "neutral";
  const sample = SAMPLE[voice][style.preset];
  const showJoke = style.jokes && style.preset !== "rundown";
  const tab = (active: boolean) =>
    `-mb-px min-h-11 border-b-2 px-4 text-[15px] transition-colors ${active ? "border-stamp font-semibold text-ink" : "border-transparent text-stone-500 hover:text-ink"}`;

  return (
    <div>
      <div role="tablist" aria-label="Length" className="flex flex-wrap border-b border-rule">
        {LENGTHS.map((l) => (
          <button key={l.value} role="tab" aria-selected={style.preset === l.value} onClick={() => onChange({ preset: l.value })} className={tab(style.preset === l.value)}>
            {l.label}
          </button>
        ))}
      </div>
      <p className="mt-3 text-sm text-stone-500">{LENGTHS.find((l) => l.value === style.preset)?.hint}</p>

      {/* The example story, rendered the way the issue renders it */}
      <article aria-label="Example story" className="mt-3 rounded-xl border border-rule bg-paper p-5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">Example</p>
        <h4 className={`font-serif font-semibold leading-snug ${style.preset === "rundown" ? "text-lg" : "text-xl"}`}>
          <span className="decoration-stamp decoration-2 underline-offset-4 hover:underline">{sample.headline}</span>
          {style.preset === "rundown" && <span className="ml-2 font-sans text-sm font-normal text-stone-500">apple.com</span>}
        </h4>
        {sample.summary && <p className="mt-3 font-serif text-[16px] leading-7 text-stone-700 dark:text-stone-300">{sample.summary}</p>}
        {sample.why && (
          <p className="mt-4 border-l-2 border-stamp pl-4 font-serif text-[16px] leading-7">
            <span className="mb-0.5 block font-sans text-xs font-semibold text-stone-500">Why it matters to you</span>
            {sample.why}
          </p>
        )}
        {showJoke && (
          <p className="mt-4 flex items-start gap-2 text-[15px] italic text-stone-600 dark:text-stone-400"><Smile size={16} className="mt-1 shrink-0" /> {SAMPLE[voice].joke}</p>
        )}
      </article>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <span className="text-sm font-semibold">Voice</span>
        <div role="radiogroup" aria-label="Voice" className="inline-flex h-10 rounded-lg border border-rule bg-paper p-1">
          {([["neutral", "Neutral"], ["playful", "Playful"]] as const).map(([v, label]) => (
            <button key={v} role="radio" aria-checked={voice === v} onClick={() => onChange({ voice: v })} className={`rounded-md px-4 text-sm font-medium ${voice === v ? "bg-sheet text-ink shadow-sm ring-1 ring-rule" : "text-stone-500 hover:text-ink"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
