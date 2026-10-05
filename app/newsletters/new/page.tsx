"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PenLine } from "lucide-react";
import { TOPICS } from "../../components/examples";
import { Gummy } from "../../components/Gummy";
import { SetupSteps } from "../../components/SetupSteps";
import { UnlockForm } from "../../components/UnlockForm";

/** The "write it myself" choice: an empty box instead of a starting text. */
const OWN = "__own__";

/** Step 1 of setting up a newsletter: what it is about. Sources and settings follow. */
export default function NewNewsletter() {
  const router = useRouter();
  const [description, setDescription] = useState("");
  const [topic, setTopic] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    // Arriving from the homepage with a description already written.
    const pre = new URLSearchParams(window.location.search).get("describe");
    if (pre) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDescription(pre);
      setTopic(OWN);
    }
  }, []);

  /** Clicking the selected choice again clears it and hides the box. */
  function pick(next: string, text: string) {
    if (topic === next) {
      setTopic(null);
      setDescription("");
      return;
    }
    setTopic(next);
    setDescription(text);
  }

  async function create() {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/newsletters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // No language picker: issues are written in the language the reader wrote in.
        body: JSON.stringify({ description }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLocked(Boolean(data.locked));
        throw new Error(data.error);
      }
      router.push(`/newsletters/${data.id}/setup`);
      router.refresh();
    } catch (err) {
      setError(`Couldn't create the newsletter: ${(err as Error).message}`);
      setCreating(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <SetupSteps current={0} />
      <h1 className="mt-8 text-4xl font-extrabold tracking-tight">What should it be about?</h1>
      <p className="mt-3 text-lg text-stone-600 dark:text-stone-400">Start from a topic, or describe exactly the newsletter you wish existed.</p>

      <button
        type="button"
        aria-pressed={topic === OWN}
        onClick={() => pick(OWN, "")}
        className={`mt-8 flex w-full items-center gap-4 rounded-xl border-2 p-5 text-left transition-all duration-150 hover:-translate-y-0.5 motion-reduce:hover:translate-y-0 ${
          topic === OWN ? "border-stamp bg-stamp-soft" : "border-stamp/50 bg-sheet hover:border-stamp hover:shadow-sm"
        }`}
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-stamp text-white"><PenLine size={19} /></span>
        <span>
          <span className="block text-lg font-bold">Write it myself</span>
          <span className="block text-[15px] text-stone-600 dark:text-stone-400">Describe it in your own words: who you are, what you want, what to skip.</span>
        </span>
      </button>

      <fieldset className="mt-6">
        <legend className="mb-2 text-sm font-semibold text-stone-600 dark:text-stone-400">Or start from a topic</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {TOPICS.map((t) => (
            <button
              key={t.label}
              type="button"
              aria-pressed={topic === t.label}
              onClick={() => pick(t.label, t.text)}
              className={`flex h-12 items-center rounded-xl border px-4 text-left text-[15px] font-medium transition-all duration-150 hover:-translate-y-0.5 motion-reduce:hover:translate-y-0 ${
                topic === t.label ? "border-stamp bg-stamp-soft ring-1 ring-stamp" : "border-rule bg-sheet hover:border-stone-400 hover:shadow-sm"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </fieldset>

      {topic && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (description.trim() && !creating) create();
          }}
          className="mt-8 space-y-5 rounded-2xl border border-rule bg-sheet p-6"
        >
          <div>
            <label htmlFor="describe" className="mb-1.5 block text-sm font-semibold">
              {topic === OWN ? "Describe your newsletter" : "Make it yours"}
            </label>
            <textarea
              id="describe"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              autoFocus
              placeholder="I edit YouTube videos in Final Cut Pro. I want new plugins, app updates and good tutorials, not beginner basics."
              className="w-full rounded-lg border border-rule bg-paper p-3 text-[15px] leading-relaxed"
            />
            <p className="mt-1.5 text-sm text-stone-500">
              {topic === OWN ? "" : "A starting point: add who you are and what to skip (“I'm a beginner”, “no rumors”). "}
              Don&apos;t worry, you can change all of this later.
            </p>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
              {error}
              {locked && <UnlockForm onUnlocked={() => { setError(null); setLocked(false); }} />}
            </div>
          )}

          {creating ? (
            <Gummy message="Nemotron is looking for sources" detail="Reading your description, picking the sites, communities and names worth following. About 20 seconds." />
          ) : (
            <button type="submit" disabled={!description.trim()} className="btn btn-primary btn-lg">Next: sources</button>
          )}
        </form>
      )}
    </main>
  );
}
