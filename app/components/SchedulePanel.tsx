"use client";

import Link from "next/link";
import { CalendarClock, Play, Wallet } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Tip, shortDate } from "./ui";

type Schedule = {
  today: string;
  budget: { capEur: number; spentEur: number; leftEur: number; issueEstimateEur: number };
  newsletters: { id: string; name: string; cadence: string; autoIssues: boolean; nextIssueDate: string; due: boolean }[];
  runs: { id: number; startedAt: string; finishedAt?: string; trigger: string; status: string; summary?: string }[];
};

const TRIGGER: Record<string, string> = { web: "from this page", cli: "from the command line", "nebius-job": "by the Nebius Job" };

/** Budget and schedule at a glance: what runs automatically, when, and what it costs today. */
export function SchedulePanel() {
  const [data, setData] = useState<Schedule | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/schedule", { cache: "no-store" });
    if (res.ok) setData(await res.json());
  }, []);

  const running = data?.runs[0]?.status === "running";

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [running, load]);

  async function runNow() {
    setStarting(true);
    setError(null);
    const res = await fetch("/api/schedule/run", { method: "POST" });
    if (!res.ok) setError((await res.json()).error);
    setStarting(false);
    await load();
  }

  if (!data) return <div className="h-40 animate-pulse rounded-2xl border border-rule bg-sheet" />;

  const { budget } = data;
  const pct = Math.min(100, (budget.spentEur / budget.capEur) * 100);
  const auto = data.newsletters.filter((n) => n.autoIssues);
  const last = data.runs[0];

  return (
    <section aria-label="Automatic issues" className="grid gap-6 rounded-2xl border border-rule bg-sheet p-6 lg:grid-cols-[1fr_1.3fr]">
      <div>
        <h2 className="flex items-center gap-2 font-semibold">
          <Wallet size={17} />
          <Tip text={`Everything that costs money (writing issues, briefs, learning from votes) counts towards a daily cap of €${budget.capEur}. Work that would go over it doesn't start. Resets at midnight, Madrid time.`}>
            Spending today
          </Tip>
        </h2>
        <p className="mt-3 text-3xl font-extrabold tabular-nums tracking-tight">
          €{budget.spentEur.toFixed(2)} <span className="text-base font-medium text-stone-500">of €{budget.capEur.toFixed(2)}</span>
        </p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-stone-100 dark:bg-stone-800" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
          <div className={`h-full rounded-full ${pct > 85 ? "bg-red-500" : pct > 60 ? "bg-amber-500" : "bg-stamp"}`} style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 text-sm text-stone-500">
          Room for about {Math.floor(budget.leftEur / budget.issueEstimateEur)} more issues today (€{budget.issueEstimateEur.toFixed(2)} each, estimated).
        </p>
      </div>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-semibold">
            <CalendarClock size={17} />
            <Tip text="Newsletters with automatic issues on are written by the scheduled worker when their next issue is due. In production a Nebius Serverless Job runs it on a schedule; here you can run it by hand.">
              Automatic issues
            </Tip>
          </h2>
          <button onClick={runNow} disabled={starting || running} className="btn btn-secondary !min-h-10">
            <Play size={15} /> {running ? "Running…" : "Run due issues now"}
          </button>
        </div>

        {auto.length ? (
          <ul className="mt-3 divide-y divide-rule text-[15px]">
            {auto.map((n) => (
              <li key={n.id} className="flex items-center justify-between gap-3 py-2">
                <Link href={`/newsletters/${n.id}`} className="truncate font-medium hover:underline">{n.name}</Link>
                <span className={`shrink-0 text-sm ${n.due ? "font-semibold text-stamp" : "text-stone-500"}`}>
                  {n.due ? "Due now" : `Next ${shortDate(n.nextIssueDate)}`}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-[15px] text-stone-500">None yet. Turn on automatic issues in a newsletter&apos;s Settings.</p>
        )}

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        {last && (
          <details className="mt-3 text-sm" open={running}>
            <summary className="cursor-pointer text-stone-500">
              Last run {TRIGGER[last.trigger] ?? last.trigger}, {new Date(last.startedAt).toLocaleString()}:{" "}
              <span className={last.status === "failed" ? "text-red-600" : last.status === "running" ? "text-stamp" : ""}>{last.status}</span>
            </summary>
            {last.summary && <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-paper p-3 font-sans text-sm text-stone-600 dark:text-stone-400">{last.summary}</pre>}
          </details>
        )}
      </div>
    </section>
  );
}
