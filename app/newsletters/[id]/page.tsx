"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Wrench } from "lucide-react";
import type { Issue, Newsletter, Profile } from "@/lib/core/types";
import { describeDelivery, deliveryOf, isPaused, nextSlot } from "@/lib/core/schedule";
import { PauseControl, PausedBanner } from "../../components/PauseControl";
import { SourcesPanel } from "../../components/SourcesPanel";
import { IssueView } from "../../components/IssueView";
import { UnderTheHood } from "../../components/UnderTheHood";
import { Settings } from "../../components/Settings";
import { UnlockForm } from "../../components/UnlockForm";
import { Gummy } from "../../components/Gummy";
import { HELP } from "../../components/glossary";
import { LANGUAGE_NAMES } from "../../components/examples";
import { Tip, usd } from "../../components/ui";

/**
 * Reader tabs (Issue, Sources, Settings) are the product. "Under the hood" is set apart: how
 * each issue was made, what it cost, and the brief Nemotron wrote. It is there for the
 * hackathon jury and would become an internal tool later.
 */
type Tab = "issue" | "sources" | "settings" | "hood";
type Problem = { message: string; locked?: boolean };

const PIPELINE = [
  { key: "plan", label: "Plan", help: HELP.plan },
  { key: "search", label: "Search", help: HELP.search },
  { key: "triage", label: "Score", help: HELP.triage },
  { key: "dates", label: "Verify dates", help: HELP.dates },
  { key: "memory", label: "Check memory", help: HELP.memory },
  { key: "edit", label: "Write", help: HELP.edit },
] as const;

const json = { "Content-Type": "application/json" };

export default function NewsletterPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [current, setCurrent] = useState<{ newsletter: Newsletter; issues: Issue[] } | null>(null);
  const [missing, setMissing] = useState(false);
  const [issueIdx, setIssueIdx] = useState(0);
  const [tab, setTab] = useState<Tab>("issue");
  const [justCreated, setJustCreated] = useState(false);
  const autoWrite = useRef(false);

  const [running, setRunning] = useState(false);
  const [queued, setQueued] = useState(false);
  const [log, setLog] = useState<{ t: string; step: string; detail?: string }[]>([]);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/newsletters/${id}`, { cache: "no-store" });
    if (res.status === 404) return setMissing(true);
    setCurrent(await res.json());
  }, [id]);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const t = q.get("tab");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (t === "settings" || t === "sources" || t === "hood") setTab(t);
    // Coming from the setup flow's "Send me my first issue".
    if (q.get("write") === "1") {
      setJustCreated(true);
      autoWrite.current = true;
      window.history.replaceState(null, "", window.location.pathname);
    }
    load();
  }, [load]);

  useEffect(() => {
    if (!autoWrite.current || !current) return;
    autoWrite.current = false;
    if (current.issues.length === 0) generate();
  }, [current]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  /** Every write goes through here: a refused one shows why, and the unlock form when locked. */
  async function send(url: string, method: string, body?: unknown) {
    const res = await fetch(url, { method, headers: json, body: body === undefined ? undefined : JSON.stringify(body) });
    if (res.ok) return res;
    const err = await res.json().catch(() => ({}));
    setProblem({ message: err.error ?? `Request failed (${res.status})`, locked: err.locked });
    return null;
  }

  async function generate() {
    setRunning(true);
    setProblem(null);
    setLog([]);
    setTab("issue");
    setJustCreated(false);
    const started = Date.now();
    try {
      const before = current?.issues.length ?? 0;
      const res = await send(`/api/newsletters/${id}/issues`, "POST");
      if (!res) return;
      // Production: a Nebius job writes it. Poll until the new issue shows up.
      if (res.headers.get("content-type")?.includes("application/json")) {
        setQueued(true);
        setLog([{ t: "0s", step: "nebius", detail: "handed to a Nebius Serverless Job" }]);
        const deadline = Date.now() + 20 * 60_000;
        while (Date.now() < deadline) {
          await new Promise((r) => setTimeout(r, 15_000));
          const r = await fetch(`/api/newsletters/${id}`, { cache: "no-store" });
          if (!r.ok) continue;
          const data = (await r.json()) as { newsletter: Newsletter; issues: Issue[] };
          if (data.issues.length > before) {
            setCurrent(data);
            setIssueIdx(0);
            router.refresh();
            return;
          }
        }
        throw new Error("the Nebius job is taking longer than usual. Come back in a few minutes: the issue will be here.");
      }
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
      router.refresh();
      setIssueIdx(0);
    } catch (err) {
      setProblem({ message: `The issue couldn't be finished: ${(err as Error).message}` });
    } finally {
      setRunning(false);
      setQueued(false);
    }
  }

  async function patchProfile(patch: Partial<Profile>) {
    await send(`/api/newsletters/${id}/profile`, "PATCH", patch);
    await load();
  }

  async function addDomain(site: string, list: "domains" | "blockedDomains") {
    if (await send(`/api/newsletters/${id}/sites`, "POST", { site, list })) {
      setToast(list === "domains" ? `${site} added to the sites you trust` : `${site} blocked`);
      await load();
    }
  }

  async function vote(storyIndex: number, v: "up" | "down", note?: string) {
    if (!issue) return;
    const res = await send(`/api/issues/${issue.id}/feedback`, "POST", { votes: [{ storyIndex, vote: v, note }] });
    if (!res) return;
    const updated = (await res.json()) as Newsletter;
    setCurrent((c) => (c ? { ...c, newsletter: updated } : c));
    setToast(note ? "Reason noted" : "Noted. The next issue will use this.");
  }

  async function reset() {
    if (!confirm("Forget everything learned from your votes and which stories it already sent?")) return;
    if (await send(`/api/newsletters/${id}/reset`, "POST")) await load();
  }

  async function pauseOrResume(action: "pause" | "resume", opts?: { until?: string; catchUp?: boolean }) {
    if (!(await send(`/api/newsletters/${id}/${action}`, "POST", opts ?? {}))) return;
    await load();
    router.refresh();
    setToast(
      action === "pause" ? "Paused. Nothing will be written or sent until you resume."
        : opts?.catchUp ? "Resumed. The next issue catches you up on the best of what you missed."
          : "Resumed from today. The next issue starts fresh.",
    );
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
  const paused = nl ? isPaused(nl) : false;

  return (
    <main className="mx-auto max-w-6xl px-5 py-8">
      {toast && <div role="status" className="fixed bottom-4 right-4 z-50 rounded-md bg-ink px-4 py-2 text-sm text-paper shadow-lg">{toast}</div>}

      <nav aria-label="Breadcrumb" className="text-sm text-stone-500">
        <Link href="/newsletters" className="hover:text-ink">Your newsletters</Link>
        <span className="mx-2">/</span>
        <span className="text-ink">{nl?.profile.name ?? "…"}</span>
      </nav>

      {problem && (
        <div className="mt-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {problem.message}
          {problem.locked && <UnlockForm onUnlocked={() => { setProblem(null); setToast("Unlocked. Try again."); }} />}
        </div>
      )}

      {nl && (
        <div className="mt-4 space-y-6">
          <header className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 max-w-3xl">
              <h1 className="text-4xl font-extrabold tracking-tight">{nl.profile.name}</h1>
              <p className="mt-1 text-stone-600 dark:text-stone-400">{nl.profile.topic}</p>
              <p className="mt-2 text-sm text-stone-500">
                {describeDelivery(deliveryOf(nl))}, up to {nl.profile.storyCount} stories, in {LANGUAGE_NAMES[nl.profile.language] ?? nl.profile.language}
                {" · "}
                {paused ? <span className="font-semibold text-caution">Paused</span> : (
                  <>Next issue {nextSlot(nl).toLocaleString("en-GB", { weekday: "long", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: deliveryOf(nl).timezone })}</>
                )}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <PauseControl newsletter={nl} onChange={pauseOrResume} />
              <button onClick={generate} disabled={running} className="btn btn-primary" title="Don't wait for the next delivery day">
                {running ? "Researching…" : current?.issues.length ? "Write one now" : "Write the first issue"}
              </button>
            </div>
          </header>

          {paused && <PausedBanner newsletter={nl} onResume={(catchUp) => pauseOrResume("resume", { catchUp })} />}

          {justCreated && (
            <div className="rounded-lg bg-stamp-soft px-4 py-3 text-[15px]">
              Your first issue is being researched and written. It takes a few minutes; you can watch each step below.
              Email delivery is coming: for now, issues are read here.
            </div>
          )}

          {(running || log.length > 0) && (
            <div className="rounded-lg border border-rule bg-sheet p-4">
              {running && (
                <Gummy
                  message={current?.issues.length ? "Nemotron is writing your next issue" : "Nemotron is writing your first issue"}
                  detail={queued
                    ? "It runs on a Nebius Serverless Job: searching the web, checking every date and dropping repeats. About 6 minutes. This page updates by itself, and you can close it and come back."
                    : "Searching the web, checking every date and dropping repeats. A few minutes: it's a newsletter, not a chat."}
                />
              )}
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
              <details className="mt-3 text-sm text-stone-500">
                <summary className="cursor-pointer">What it is doing</summary>
                <pre className="mt-2 max-h-40 overflow-auto rounded bg-stone-950 p-3 text-xs text-stone-200">
                  {log.map((l) => `${l.t.padStart(4)}  ${l.step}${l.detail ? `: ${l.detail}` : ""}`).join("\n")}
                  {running ? "\n   …" : ""}
                </pre>
              </details>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-1 border-b border-rule">
            {([["issue", "Issue"], ["sources", "Sources"], ["settings", "Settings"]] as const).map(([k, label]) => (
              <button key={k} onClick={() => setTab(k)} className={`-mb-px min-h-11 border-b-2 px-4 py-2.5 text-[15px] ${tab === k ? "border-ink font-semibold" : "border-transparent text-stone-500 hover:text-ink"}`}>
                {label}
              </button>
            ))}
            <button
              onClick={() => setTab("hood")}
              title="How each issue was made, what it cost, and the brief: for the jury"
              className={`-mb-px ml-auto inline-flex min-h-11 items-center gap-2 border-b-2 px-4 py-2.5 text-[15px] ${tab === "hood" ? "border-stamp font-semibold text-stamp" : "border-transparent text-stone-500 hover:text-stamp"}`}
            >
              <Wrench size={15} /> Under the hood
            </button>
          </div>

          {tab === "issue" && !issue && !running && (
            <p className="text-stone-500">No issues yet. The first one arrives on the next delivery day, or write it now.</p>
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

          {tab === "sources" && (
            <SourcesPanel newsletter={nl} onPatch={patchProfile} onError={(message, locked) => setProblem({ message, locked })} onToast={setToast} />
          )}

          {tab === "settings" && (
            <Settings
              key={nl.id + JSON.stringify(nl.profile) + JSON.stringify(nl.memory) + JSON.stringify(nl.delivery ?? null)}
              newsletter={nl}
              onDelete={async () => {
                if (await send(`/api/newsletters/${id}`, "DELETE")) {
                  router.push("/newsletters");
                  router.refresh();
                }
              }}
              onSave={async (profile, memory, delivery) => {
                if (!(await send(`/api/newsletters/${id}/delivery`, "PATCH", delivery))) return;
                await send(`/api/newsletters/${id}/memory`, "PATCH", memory);
                await patchProfile(profile);
                setToast("Settings saved. They apply from the next issue.");
              }}
            />
          )}

          {tab === "hood" && (
            <div className="space-y-6">
              <section className="grid gap-6 rounded-2xl border border-dashed border-stamp/40 bg-stamp-soft/40 p-6 md:grid-cols-[1fr_auto]">
                <div>
                  <h2 className="font-semibold">The brief Nemotron wrote</h2>
                  <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
                    From your description, &ldquo;{nl.description}&rdquo;. The planner, the scorer and the editor read it every issue.
                  </p>
                  <dl className="mt-4 grid gap-x-8 gap-y-3 text-[15px] sm:grid-cols-2">
                    <div><dt className="text-xs text-stone-500">Topic</dt><dd>{nl.profile.topic}</dd></div>
                    <div><dt className="text-xs text-stone-500">Written for</dt><dd>{nl.profile.audience}</dd></div>
                    <div><dt className="text-xs text-stone-500">Tone</dt><dd>{nl.profile.tone}</dd></div>
                    <div><dt className="text-xs text-stone-500">Searches in</dt><dd>{(nl.profile.searchLanguages ?? ["en"]).map((l) => LANGUAGE_NAMES[l] ?? l).join(", ")}</dd></div>
                  </dl>
                </div>
                <div className="flex flex-col items-start gap-2 md:items-end">
                  <button onClick={reset} disabled={running} title="Forget votes and already-sent stories. Handy while testing." className="btn btn-secondary">Reset memory</button>
                  {current && current.issues.length > 0 && (
                    <select value={issueIdx} onChange={(e) => setIssueIdx(Number(e.target.value))} aria-label="Issue" className="max-w-xs rounded-md border border-rule bg-sheet p-2 text-sm">
                      {current.issues.map((i, idx) => (
                        <option key={i.id} value={idx}>Issue {i.number ?? current.issues.length - idx}, {i.date}, {usd(i.trace.totals.costUsd)}</option>
                      ))}
                    </select>
                  )}
                </div>
              </section>
              {issue ? <UnderTheHood issue={issue} onDomain={addDomain} /> : <p className="text-stone-500">No issue yet: the trace appears after the first one.</p>}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
