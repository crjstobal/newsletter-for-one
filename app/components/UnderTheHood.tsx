"use client";

import { useMemo, useState } from "react";
import type { CandidateStatus, Issue } from "@/lib/core/types";
import { HELP } from "./glossary";
import { Card, DateBadge, H3, STATUS, StatusBadge, Tip, secs, usd } from "./ui";

const STEP_HELP: Record<string, string> = { plan: HELP.plan, search: HELP.search, triage: HELP.triage, dates: HELP.dates, filter: HELP.filter, memory: HELP.memory, edit: HELP.edit };
const ORDER: CandidateStatus[] = ["used", "shortlisted", "already-sent", "duplicate", "too-old", "no-date", "wrong-language", "low-score", "blocked", "unscored"];

const shortModel = (m: string) => m.replace(/^nvidia\//, "");

export function UnderTheHood({ issue, onDomain }: { issue: Issue; onDomain: (domain: string, list: "domains" | "blockedDomains") => void }) {
  const tr = issue.trace;
  const [filter, setFilter] = useState<CandidateStatus | "all">("all");

  const counts = useMemo(() => {
    const c = new Map<CandidateStatus, number>();
    for (const x of tr.candidates) c.set(x.status, (c.get(x.status) ?? 0) + 1);
    return c;
  }, [tr.candidates]);

  const rows = useMemo(
    () =>
      tr.candidates
        .filter((c) => filter === "all" || c.status === filter)
        .sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status) || (b.score ?? -1) - (a.score ?? -1)),
    [tr.candidates, filter],
  );

  const stories = issue.stories.length || 1;

  return (
    <div className="space-y-6">
      {/* Totals */}
      <Card>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          <Stat label={<Tip text={HELP.cost}>Total cost</Tip>} value={usd(tr.totals.costUsd)} sub={`${usd(tr.totals.costUsd / stories)} per story`} />
          <Stat label="Nebius (Nemotron)" value={usd(tr.totals.nebiusUsd)} sub={`${tr.totals.promptTokens.toLocaleString()} in / ${tr.totals.completionTokens.toLocaleString()} out`} />
          <Stat label="Tavily" value={usd(tr.totals.tavilyUsd)} sub={`${tr.totals.tavilyCredits} credits, ${tr.searches.length} searches`} />
          <Stat label="Time" value={secs(tr.totals.ms)} sub={`${tr.llmCalls.length} model calls`} />
          <Stat label={<Tip text={HELP.window}>Window</Tip>} value={tr.window.since.slice(5)} sub={`to ${tr.window.until}`} />
        </div>
      </Card>

      {/* Flow */}
      <Card>
        <H3>Pipeline</H3>
        <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {tr.steps.map((s, i) => (
            <li key={s.key} className="relative rounded-md border border-stone-200 p-3 text-sm dark:border-stone-800">
              <div className="flex items-center justify-between gap-2">
                <Tip text={STEP_HELP[s.key]}>
                  <span className="font-semibold">{i + 1}. {s.label}</span>
                </Tip>
              </div>
              <div className="mt-1 truncate font-mono text-[11px] text-stone-500" title={s.tool}>{shortModel(s.tool)}</div>
              <div className="mt-2 text-xs">{s.summary}</div>
              <div className="mt-2 flex justify-between font-mono text-[11px] text-stone-500">
                <span>{secs(s.ms)}</span>
                <span>{usd(s.costUsd)}</span>
              </div>
            </li>
          ))}
        </ol>
      </Card>

      {/* Quality */}
      <Card>
        <H3><Tip text={HELP.checks}>Quality checks</Tip></H3>
        <ul className="space-y-1 text-sm">
          {tr.checks.map((c, i) => (
            <li key={i} className="flex gap-2">
              <span>{c.level === "ok" ? "🟢" : c.level === "warn" ? "🟡" : "🔴"}</span>
              <span>{c.message}</span>
            </li>
          ))}
        </ul>
      </Card>

      {/* Searches */}
      <Card>
        <H3><Tip text={HELP.search}>Searches (Tavily)</Tip></H3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-stone-500">
              <tr className="border-b border-stone-200 dark:border-stone-800">
                <th className="py-1.5 pr-2">#</th><th className="pr-2">Kind</th><th className="pr-2">Query</th><th className="pr-2">Domains</th>
                <th className="pr-2 text-right">Hits</th><th className="pr-2 text-right">Used</th><th className="pr-2 text-right">Cost</th><th className="text-right">Time</th>
              </tr>
            </thead>
            <tbody>
              {tr.searches.map((s, i) => {
                const used = tr.candidates.filter((c) => c.status === "used" && c.foundBy.includes(i)).length;
                return (
                  <tr key={i} className="border-b border-stone-100 align-top dark:border-stone-800/50">
                    <td className="py-1.5 pr-2 font-mono text-stone-400">{i + 1}</td>
                    <td className="pr-2"><span className="rounded bg-stone-100 px-1.5 py-0.5 font-mono dark:bg-stone-800">{s.kind}</span></td>
                    <td className="pr-2">
                      <div className="font-medium">{s.query}</div>
                      <div className="text-stone-500">{s.why}</div>
                      {s.error && <div className="text-red-600">{s.error}</div>}
                    </td>
                    <td className="pr-2 font-mono text-[11px] text-stone-500">
                      {s.params.language && <div>language: {s.params.language}</div>}
                      {s.params.includeDomains.length > 0 && <div>only: {s.params.includeDomains.join(", ")}</div>}
                      {s.params.excludeDomains.length > 0 && <div title={s.params.excludeDomains.join(", ")}>not: {s.params.excludeDomains.length} sites</div>}
                      <div>{s.params.topic} · {s.params.depth} · since {s.params.since}</div>
                    </td>
                    <td className="pr-2 text-right font-mono">{s.hits}</td>
                    <td className={`pr-2 text-right font-mono ${used ? "text-emerald-600" : "text-stone-400"}`}>{used}</td>
                    <td className="pr-2 text-right font-mono">{usd(s.costUsd)}</td>
                    <td className="text-right font-mono">{secs(s.ms)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Candidates */}
      <Card>
        <H3><Tip text={HELP.candidates}>Every result and what happened to it</Tip></H3>
        <div className="mb-3 flex flex-wrap gap-1.5 text-xs">
          <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>all {tr.candidates.length}</FilterChip>
          {ORDER.filter((s) => counts.get(s)).map((s) => (
            <FilterChip key={s} active={filter === s} onClick={() => setFilter(s)} title={STATUS[s].help}>
              {STATUS[s].label} {counts.get(s)}
            </FilterChip>
          ))}
          <span className="ml-auto text-stone-500"><Tip text={HELP.dateOrigin}>Dates</Tip></span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-stone-500">
              <tr className="border-b border-stone-200 dark:border-stone-800">
                <th className="py-1.5 pr-2">Status</th>
                <th className="pr-2 text-right"><Tip text={HELP.score}>Score</Tip></th>
                <th className="pr-2">Date</th>
                <th className="pr-2">Result</th>
                <th className="pr-2"><Tip text={HELP.foundBy}>Found by</Tip></th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-b border-stone-100 align-top dark:border-stone-800/50">
                  <td className="py-1.5 pr-2">
                    <StatusBadge status={c.status} />
                    {c.storyIndex !== undefined && <div className="mt-0.5 text-[10px] text-stone-500">story {c.storyIndex + 1}</div>}
                  </td>
                  <td className="pr-2 text-right font-mono">{c.score ?? "–"}</td>
                  <td className="pr-2">
                    <DateBadge date={c.publishedDate} from={c.dateFrom} note={c.dateNote} since={tr.window.since} until={tr.window.until} />
                    {c.dateNote && c.dateFrom !== "search" && <div className="mt-0.5 max-w-44 text-[10px] leading-tight text-stone-400">{c.dateNote}</div>}
                  </td>
                  <td className="max-w-md pr-2">
                    <a href={c.url} target="_blank" rel="noreferrer" className="hover:underline">{c.title || c.url}</a>
                    {c.sameAs && <div className="mt-0.5 text-[11px] text-sky-700 dark:text-sky-300">same news as: {c.sameAs}</div>}
                    {c.eventKey && <div className="font-mono text-[10px] text-stone-400">event: {c.eventKey}</div>}
                  </td>
                  <td className="pr-2 font-mono text-stone-500">{c.foundBy.map((i) => i + 1).join(", ")}</td>
                  <td className="whitespace-nowrap">
                    <div className="text-stone-600 dark:text-stone-400">{c.source}{c.lang ? <span className="ml-1.5 rounded bg-stone-100 px-1 text-[10px] uppercase text-stone-500 dark:bg-stone-800">{c.lang}</span> : null}</div>
                    <div className="mt-0.5 flex gap-1">
                      <button onClick={() => onDomain(c.source, "domains")} className="text-[10px] text-emerald-700 hover:underline dark:text-emerald-400">prefer</button>
                      <button onClick={() => onDomain(c.source, "blockedDomains")} className="text-[10px] text-red-700 hover:underline dark:text-red-400">block</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* LLM calls */}
      <Card>
        <H3><Tip text={HELP.llmCalls}>Model calls (Nebius Token Factory)</Tip></H3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-stone-500">
              <tr className="border-b border-stone-200 dark:border-stone-800">
                <th className="py-1.5 pr-2">Role</th><th className="pr-2">Model</th><th className="pr-2">What</th>
                <th className="pr-2 text-right">Tokens in</th><th className="pr-2 text-right">Tokens out</th><th className="pr-2 text-right">Cost</th><th className="text-right">Time</th>
              </tr>
            </thead>
            <tbody>
              {tr.llmCalls.map((c, i) => (
                <tr key={i} className="border-b border-stone-100 dark:border-stone-800/50">
                  <td className="py-1.5 pr-2">{c.role}</td>
                  <td className="pr-2 font-mono">{shortModel(c.model)}</td>
                  <td className="pr-2 text-stone-500">{c.note}</td>
                  <td className="pr-2 text-right font-mono">{c.promptTokens.toLocaleString()}</td>
                  <td className="pr-2 text-right font-mono">{c.completionTokens.toLocaleString()}</td>
                  <td className="pr-2 text-right font-mono">{usd(c.costUsd)}</td>
                  <td className="text-right font-mono">{secs(c.ms)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value, sub }: { label: React.ReactNode; value: string; sub: string }) {
  return (
    <div>
      <div className="text-xs text-stone-500">{label}</div>
      <div className="font-mono text-xl font-semibold">{value}</div>
      <div className="text-[11px] text-stone-500">{sub}</div>
    </div>
  );
}

function FilterChip({ active, onClick, children, title }: { active: boolean; onClick: () => void; children: React.ReactNode; title?: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`rounded-full border px-2.5 py-0.5 ${active ? "border-stone-900 bg-stone-900 text-white dark:border-stone-100 dark:bg-stone-100 dark:text-stone-900" : "border-stone-300 dark:border-stone-700"}`}
    >
      {children}
    </button>
  );
}
