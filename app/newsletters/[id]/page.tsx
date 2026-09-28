"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { Issue, Newsletter, Profile } from "@/lib/core/types";
import { IssueView } from "../../components/IssueView";
import { UnderTheHood } from "../../components/UnderTheHood";
import { Settings } from "../../components/Settings";
import { HELP } from "../../components/glossary";
import { LANGUAGE_NAMES } from "../../components/examples";
import { Tip, usd } from "../../components/ui";

type Tab = "issue" | "hood" | "settings";

const PIPELINE = [
  { key: "plan", label: "Plan", help: HELP.plan },
  { key: "search", label: "Search", help: HELP.search },
  { key: "triage", label: "Score", help: HELP.triage },
  { key: "dates", label: "Verify dates", help: HELP.dates },
  { key: "memory", label: "Check memory", help: HELP.memory },
  { key: "edit", label: "Write", help: HELP.edit },
] as const;

export default function NewsletterPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [current, setCurrent] = useState<{ newsletter: Newsletter; issues: Issue[] } | null>(null);
  const [missing, setMissing] = useState(false);
  const [issueIdx, setIssueIdx] = useState(0);
  const [tab, setTab] = useState<Tab>("issue");
  const [justCreated, setJustCreated] = useState(false);

  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<{ t: string; step: string; detail?: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/newsletters/${id}`);
    if (res.status === 404) return setMissing(true);
    setCurrent(await res.json());
  }, [id]);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (q.get("tab") === "settings") setTab("settings");
    setJustCreated(q.get("new") === "1");
    load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  async function generate() {
    setRunning(true);
    setError(null);
    setLog([]);
    setTab("issue");
    setJustCreated(false);
    const started = Date.now();
    try {
      const res = await fetch(`/api/newsletters/${id}/issues`, { method: "POST" });
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const ev = JSON.parse(line);
          const t = `${((Date.now() - started) / 1000).toFixed(0)}s`;
          if (ev.type === "progress") setLog((l) => [...l, { t, step: ev.step, detail: ev.detail }]);
          if (ev.type === "error") throw new Error(ev.message);
        }
      }
      await load();
      router.refresh(); // the top menu shows the new last-issue date
      setIssueIdx(0);
    } catch (err) {
      setError(`The issue couldn't be finished: ${(err as Error).message}`);
    } finally {
      setRunning(false);
    }
  }

  async function patchProfile(patch: Partial<Profile>) {
    const res = await fetch(`/api/newsletters/${id}/profile`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) setError((await res.json()).error);
    await load();
  }

  async function addDomain(domain: string, list: "domains" | "blockedDomains") {
    if (!current) return;
    const p = current.newsletter.profile;
    const other = list === "domains" ? "blockedDomains" : "domains";
    await patchProfile({
      [list]: [...new Set([...(p[list] ?? []), domain])],
      [other]: (p[other] ?? []).filter((d) => d !== domain),
    });
    setToast(list === "domains" ? `${domain} added to your trusted sources` : `${domain} blocked`);
  }

  async function vote(storyIndex: number, v: "up" | "down", note?: string) {
    if (!issue) return;
    const res = await fetch(`/api/issues/${issue.id}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ votes: [{ storyIndex, vote: v, note }] }),
    });
    if (!res.ok) {
      setError(`Your vote couldn't be saved: ${(await res.json()).error}`);
      return;
    }
    const updated = (await res.json()) as Newsletter;
    setCurrent((c) => (c ? { ...c, newsletter: updated } : c));
    setToast(note ? "Reason noted" : "Noted. The next issue will use this.");
  }

  async function reset() {
    if (!confirm("Forget everything learned from your votes and which stories it already sent?")) return;
    await fetch(`/api/newsletters/${id}/reset`, { method: "POST" });
    await load();
  }

  if (missing) {
    return (
      <main className="mx-auto max-w-6xl px-5 py-16">
        <p className="text-lg font-semibold">This newsletter doesn&apos;t exist.</p>
        <Link href="/newsletters" className="mt-2 inline-block text-stamp hover:underline">See your newsletters</Link>
      </main>
    );
  }

  const nl = current?.newsletter;
  const issue = current?.issues[issueIdx];
  const lastStep = log.at(-1)?.step;

  return (
    <main className="mx-auto max-w-6xl px-5 py-8">
      {toast && <div role="status" className="fixed bottom-4 right-4 z-50 rounded-md bg-ink px-4 py-2 text-sm text-paper shadow-lg">{toast}</div>}

      <nav aria-label="Breadcrumb" className="text-sm text-stone-500">
        <Link href="/newsletters" className="hover:text-ink">Your newsletters</Link>
        <span className="mx-2">/</span>
        <span className="text-ink">{nl?.profile.name ?? "…"}</span>
      </nav>

      {error && <div className="mt-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">{error}</div>}

      {nl && (
        <div className="mt-4 space-y-6">
          <header className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 max-w-3xl">
              <h1 className="text-4xl font-extrabold tracking-tight">{nl.profile.name}</h1>
              <p className="mt-1 text-stone-600 dark:text-stone-400">{nl.profile.topic}</p>
              <p className="mt-2 text-sm text-stone-500">
                {nl.profile.cadence === "daily" ? "Daily" : "Weekly"}, up to {nl.profile.storyCount} stories, written in{" "}
                {LANGUAGE_NAMES[nl.profile.language] ?? nl.profile.language}, searched in{" "}
                {(nl.profile.searchLanguages ?? ["en"]).map((l) => LANGUAGE_NAMES[l] ?? l).join(" and ")}
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={reset} disabled={running} title="Forget votes and already-sent stories. Handy while testing." className="btn btn-secondary">
                Reset memory
              </button>
              <button onClick={generate} disabled={running} className="btn btn-primary">
                {running ? "Researching…" : current?.issues.length ? "Write the next issue" : "Write the first issue"}
              </button>
            </div>
          </header>

          {justCreated && (
            <div className="rounded-lg bg-stamp-soft px-4 py-3 text-[15px]">
              Your description is now this brief. Check the sources and topics below, then write the first issue.
            </div>
          )}

          {(running || log.length > 0) && (
            <div className="rounded-lg border border-rule bg-sheet p-4">
              <ol className="flex flex-wrap items-center gap-2 text-sm">
                {PIPELINE.map((p, i) => {
                  const idx = PIPELINE.findIndex((x) => x.key === lastStep);
                  const state = !running && log.length ? "done" : i < idx ? "done" : i === idx ? "active" : "todo";
                  return (
                    <li key={p.key} className="flex items-center gap-2">
                      <span className={`rounded-full px-3 py-1 ${state === "done" ? "bg-stamp-soft text-stamp" : state === "active" ? "animate-pulse bg-ink text-paper" : "bg-stone-100 text-stone-400 dark:bg-stone-800"}`}>
                        <Tip text={p.help}>{p.label}</Tip>
                      </span>
                      {i < PIPELINE.length - 1 && <span aria-hidden className="h-px w-4 bg-stone-300" />}
                    </li>
                  );
                })}
              </ol>
              <pre className="mt-3 max-h-40 overflow-auto rounded bg-stone-950 p-3 text-xs text-stone-200">
                {log.map((l) => `${l.t.padStart(4)}  ${l.step}${l.detail ? `: ${l.detail}` : ""}`).join("\n")}
                {running ? "\n   …" : ""}
              </pre>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-1 border-b border-rule">
            {([["issue", "Issue"], ["hood", "Under the hood"], ["settings", "Settings"]] as const).map(([k, label]) => (
              <button key={k} onClick={() => setTab(k)} className={`-mb-px min-h-11 border-b-2 px-4 py-2.5 text-[15px] ${tab === k ? "border-ink font-semibold" : "border-transparent text-stone-500 hover:text-ink"}`}>
                {label}
              </button>
            ))}
            {current && current.issues.length > 0 && tab === "hood" && (
              <select value={issueIdx} onChange={(e) => setIssueIdx(Number(e.target.value))} aria-label="Issue" className="ml-auto max-w-sm rounded-md border border-rule bg-sheet p-1.5 text-xs">
                {current.issues.map((i, idx) => (
                  <option key={i.id} value={idx}>Issue {i.number ?? current.issues.length - idx}, {i.date}, {usd(i.trace.totals.costUsd)}</option>
                ))}
              </select>
            )}
          </div>

          {tab === "settings" && (
            <Settings
              key={nl.id + JSON.stringify(nl.profile) + JSON.stringify(nl.memory)}
              newsletter={nl}
              onSave={async (profile, memory) => {
                await fetch(`/api/newsletters/${id}/memory`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(memory),
                });
                await patchProfile(profile);
                setToast("Settings saved. They apply from the next issue.");
              }}
            />
          )}
          {tab !== "settings" && !issue && !running && (
            <p className="text-stone-500">No issues yet. Check the brief in Settings, then write the first issue.</p>
          )}
          {tab === "issue" && issue && current && (
            <IssueView
              key={issue.id}
              issue={issue}
              newsletter={nl}
              nav={{
                number: issue.number ?? current.issues.length - issueIdx,
                total: current.issues.length,
                // issues are newest first
                prev: issueIdx < current.issues.length - 1 ? () => setIssueIdx(issueIdx + 1) : undefined,
                next: issueIdx > 0 ? () => setIssueIdx(issueIdx - 1) : undefined,
              }}
              onVote={vote}
              onDomain={addDomain}
              onOpenTrace={() => setTab("hood")}
            />
          )}
          {tab === "hood" && issue && <UnderTheHood issue={issue} onDomain={addDomain} />}
        </div>
      )}
    </main>
  );
}
