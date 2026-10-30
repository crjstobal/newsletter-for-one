"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { Issue } from "@/lib/core/types";

const KEY = "n41.howItWasMade.dismissed";

/**
 * One-time hint for first-time visitors (judges included): nobody pasted anything, the issue was
 * researched and written on its own. Dismissal is remembered per browser; storage may be blocked,
 * in which case the hint simply shows again.
 */
export function HowItWasMade({ issue, onOpenTrace }: { issue: Issue; onOpenTrace: () => void }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpen(localStorage.getItem(KEY) !== "1");
    } catch {
      // no storage: show it
      setOpen(true);
    }
  }, []);
  if (!open) return null;

  const dismiss = () => {
    setOpen(false);
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      // no storage
    }
  };
  const tr = issue.trace;
  // Issues before 2026-10-30 were scored by Nano (retired by Token Factory); newer ones by Lightning.
  const scorer = tr.steps.find((s) => s.key === "triage")?.tool.includes("Nano") ? "Nemotron 3 Nano" : "Nemotron 3.5 Lightning";

  return (
    <aside className="relative rounded-lg border border-stamp/30 bg-stamp-soft px-4 py-3 pr-10 text-[15px]">
      <p>
        <b>Nobody pasted anything into this.</b> On delivery days a Nebius Serverless Job researches and writes each issue on
        its own. For this one, Tavily ran {tr.searches.length} live web searches, {scorer} scored {tr.candidates.length}{" "}
        results, every date was checked on the page, and Nemotron 3 Ultra wrote the {issue.stories.length} stories that
        survived.{" "}
        <button onClick={onOpenTrace} className="font-semibold text-stamp underline-offset-4 hover:underline">
          See every step
        </button>
      </p>
      <button onClick={dismiss} aria-label="Dismiss" className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full text-stone-500 hover:bg-white/60 hover:text-ink">
        <X size={15} />
      </button>
    </aside>
  );
}
