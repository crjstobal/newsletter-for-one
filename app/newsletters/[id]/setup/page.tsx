"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Mail, Send } from "lucide-react";
import type { Newsletter, Profile } from "@/lib/core/types";
import { SetupSteps } from "../../../components/SetupSteps";
import { SourcesPanel } from "../../../components/SourcesPanel";
import { Settings } from "../../../components/Settings";
import { UnlockForm } from "../../../components/UnlockForm";

const json = { "Content-Type": "application/json" };

/**
 * Steps 2 and 3 of a new newsletter: review the sources Nemotron picked, then delivery and
 * style. Both are the same panels as the Sources and Settings tabs, so nothing here is final.
 */
export default function Setup() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [nl, setNl] = useState<Newsletter | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [problem, setProblem] = useState<{ message: string; locked?: boolean } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/newsletters/${id}`, { cache: "no-store" });
    if (res.ok) setNl((await res.json()).newsletter);
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  async function send(url: string, method: string, body: unknown) {
    const res = await fetch(url, { method, headers: json, body: JSON.stringify(body) });
    if (res.ok) return true;
    const err = await res.json().catch(() => ({}));
    setProblem({ message: err.error ?? "Something went wrong", locked: err.locked });
    return false;
  }

  async function patchProfile(patch: Partial<Profile>) {
    await send(`/api/newsletters/${id}/profile`, "PATCH", patch);
    await load();
  }

  const go = (s: 1 | 2) => {
    setStep(s);
    window.scrollTo({ top: 0 });
  };

  if (!nl) return <main className="mx-auto max-w-6xl px-5 py-12"><div className="h-60 animate-pulse rounded-2xl border border-rule bg-sheet" /></main>;

  return (
    <main className="mx-auto max-w-6xl px-5 py-12">
      {toast && <div role="status" className="fixed bottom-4 right-4 z-50 rounded-md bg-ink px-4 py-2 text-sm text-paper shadow-lg">{toast}</div>}
      <SetupSteps current={step} />

      <header className="mt-8 max-w-3xl">
        <p className="text-sm font-semibold text-stamp">{nl.profile.name}</p>
        <h1 className="mt-1 text-4xl font-extrabold tracking-tight">{step === 1 ? "Where should it look?" : "When and how should it arrive?"}</h1>
        <p className="mt-3 text-lg text-stone-600 dark:text-stone-400">
          {step === 1
            ? "Nemotron picked these from your description. Add the sites and channels you like, remove what you don't. It searches the rest of the web anyway."
            : "Pick the days and the time, how long each issue is, and the style."}{" "}
          You can change all of this later in the newsletter&apos;s {step === 1 ? "Sources" : "Settings"} tab.
        </p>
      </header>

      {problem && (
        <div className="mt-6 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {problem.message}
          {problem.locked && <UnlockForm onUnlocked={() => setProblem(null)} />}
        </div>
      )}

      <div className="mt-8">
        {step === 1 ? (
          <>
            <SourcesPanel newsletter={nl} onPatch={patchProfile} onError={(message, locked) => setProblem({ message, locked })} onToast={setToast} />
            <div className="flex items-center justify-between gap-4 border-t border-rule pt-6">
              <span className="text-sm text-stone-500">Changes here are saved as you make them.</span>
              <button onClick={() => go(2)} className="btn btn-primary btn-lg">Next: settings</button>
            </div>
          </>
        ) : (
          <Settings
            key={JSON.stringify(nl.profile) + JSON.stringify(nl.delivery ?? null)}
            newsletter={nl}
            onboarding
            onSave={async (profile, memory, delivery) => {
              if (!(await send(`/api/newsletters/${id}/delivery`, "PATCH", delivery))) return;
              await patchProfile(profile);
            }}
            renderActions={(save, dirty, saving) => (
              <div className="mt-2 space-y-4 border-t border-rule pt-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <button onClick={() => go(1)} className="btn btn-secondary"><ArrowLeft size={16} /> Back to sources</button>
                  <button
                    disabled={saving}
                    onClick={async () => {
                      if (dirty) await save();
                      router.push(`/newsletters/${id}?write=1`);
                    }}
                    className="btn btn-primary btn-lg"
                  >
                    <Send size={17} /> {saving ? "Saving…" : "Send me my first issue"}
                  </button>
                </div>
                <p className="ml-auto flex w-fit items-center gap-2.5 rounded-lg border border-red-300 bg-red-50 px-4 py-2.5 text-[15px] font-medium text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
                  <Mail size={17} className="shrink-0" />
                  We&apos;re working on email delivery. For now, issues are read here on the web.
                </p>
              </div>
            )}
          />
        )}
      </div>
    </main>
  );
}
