"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Newsletter } from "@/lib/core/types";
import { addDays, dateIn, isPaused } from "@/lib/core/schedule";
import { shortDate } from "./ui";

type Action = "pause" | "resume";

/**
 * Pause stops writing and sending without touching anything else: the brief, the memory and
 * the subscriptions stay, and newsletters keep arriving in the inbox.
 */
export function PauseControl({ newsletter, onChange }: { newsletter: Newsletter; onChange: (a: Action, opts?: { until?: string; catchUp?: boolean }) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const today = dateIn(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [until, setUntil] = useState(addDays(today, 7));

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  if (isPaused(newsletter)) return null; // the banner offers the ways to resume

  async function go(u?: string) {
    setBusy(true);
    await onChange("pause", { until: u });
    setBusy(false);
    setOpen(false);
  }

  const opt = "flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-[15px] hover:bg-stone-100 dark:hover:bg-stone-800";
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="btn btn-secondary">
        <Pause size={15} /> Pause
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-80 overflow-hidden rounded-xl border border-rule bg-sheet py-1 shadow-[0_18px_40px_-18px_rgba(22,24,29,0.4)]">
          <p className="px-4 pb-1 pt-2.5 text-sm text-stone-500">Nothing is written or sent while paused. Your brief, memory and subscriptions stay as they are.</p>
          <button disabled={busy} onClick={() => go(addDays(today, 7))} className={opt}>For a week <span className="text-sm text-stone-500">until {shortDate(addDays(today, 7))}</span></button>
          <button disabled={busy} onClick={() => go(addDays(today, 14))} className={opt}>For two weeks <span className="text-sm text-stone-500">until {shortDate(addDays(today, 14))}</span></button>
          <div className={`${opt} hover:bg-transparent`}>
            <span>Until</span>
            <span className="flex items-center gap-2">
              <input type="date" min={addDays(today, 1)} value={until} onChange={(e) => setUntil(e.target.value)} className="h-9 rounded-md border border-rule bg-paper px-2 text-sm" />
              <button disabled={busy || !until} onClick={() => go(until)} className="btn btn-secondary !min-h-9 !px-3 text-sm">Pause</button>
            </span>
          </div>
          <button disabled={busy} onClick={() => go()} className={`${opt} border-t border-rule`}>Until I resume it</button>
        </div>
      )}
    </div>
  );
}

export function PausedBanner({ newsletter, onResume }: { newsletter: Newsletter; onResume: (catchUp: boolean) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const go = async (catchUp: boolean) => {
    setBusy(true);
    await onResume(catchUp);
    setBusy(false);
  };
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-caution/40 bg-caution/10 px-5 py-4">
      <div className="flex items-start gap-3">
        <Pause size={18} className="mt-0.5 shrink-0 text-caution" />
        <div>
          <p className="font-semibold">
            Paused{newsletter.pausedAt ? ` since ${shortDate(newsletter.pausedAt.slice(0, 10))}` : ""}
            {newsletter.pausedUntil ? `, resumes by itself on ${shortDate(newsletter.pausedUntil)}` : ""}
          </p>
          <p className="text-[15px] text-stone-600 dark:text-stone-400">Nothing is written or sent. Your subscriptions keep arriving in the inbox, so nothing is lost.</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button disabled={busy} onClick={() => go(true)} className="btn btn-primary" title="The next issue covers everything since your last one, and keeps only the best of it">
          <Play size={15} /> Resume and catch me up
        </button>
        <button disabled={busy} onClick={() => go(false)} className="btn btn-secondary" title="Skip what you missed: the next issue only covers the usual window before today">
          Resume from today
        </button>
      </div>
    </div>
  );
}
