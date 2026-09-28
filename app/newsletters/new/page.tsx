"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { EXAMPLES, LANGUAGES } from "../../components/examples";

const NEXT = [
  { title: "It writes a brief", body: "Who the newsletter is for, what to cover, what to skip, which sites and communities to watch." },
  { title: "You review it", body: "Change anything: sources you trust or block, language, how many stories, how often." },
  { title: "You get the first issue", body: "Researched and written in a couple of minutes, with every source dated." },
];

export default function NewNewsletter() {
  const router = useRouter();
  const [description, setDescription] = useState("");
  const [language, setLanguage] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Arriving from the homepage with a description already written.
    const pre = new URLSearchParams(window.location.search).get("describe");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (pre) setDescription(pre);
  }, []);

  async function create() {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/newsletters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description, language }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.push(`/newsletters/${data.id}?tab=settings&new=1`);
      router.refresh();
    } catch (err) {
      setError(`Couldn't create the newsletter: ${(err as Error).message}`);
      setCreating(false);
    }
  }

  return (
    <main className="mx-auto grid max-w-6xl gap-14 px-5 py-12 lg:grid-cols-[1.3fr_1fr]">
      <div>
        <h1 className="text-4xl font-extrabold tracking-tight">Start a newsletter</h1>
        <p className="mt-3 max-w-xl text-lg text-stone-600 dark:text-stone-400">
          Say what you want to follow and who you are. The more specific, the better the first issue.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (description.trim() && !creating) create();
          }}
          className="mt-8 space-y-5"
        >
          <div>
            <label htmlFor="describe" className="mb-1.5 block text-sm font-semibold">What should it cover?</label>
            <textarea
              id="describe"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={6}
              placeholder="I edit YouTube videos in Final Cut Pro. I want new plugins, app updates and good tutorials, not beginner basics."
              className="w-full rounded-lg border border-rule bg-sheet p-3 text-[15px] leading-relaxed"
            />
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-stone-500">Or start from:</span>
              {EXAMPLES.map((ex) => (
                <button key={ex.label} type="button" onClick={() => setDescription(ex.text)} className="rounded-full border border-rule px-2.5 py-0.5 text-xs text-stone-600 hover:border-stone-400 dark:text-stone-400">
                  {ex.label}
                </button>
              ))}
            </div>
          </div>

          <div className="max-w-xs">
            <label htmlFor="lang" className="mb-1.5 block text-sm font-semibold">Write it in</label>
            <select id="lang" value={language} onChange={(e) => setLanguage(e.target.value)} className="w-full rounded-lg border border-rule bg-sheet p-2 text-sm">
              <option value="">The language I wrote in</option>
              {LANGUAGES.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
            </select>
            <p className="mt-1.5 text-xs text-stone-500">Searches still run wherever the best sources are, usually in English.</p>
          </div>

          {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">{error}</p>}

          <button type="submit" disabled={creating || !description.trim()} className="btn btn-primary btn-lg">
            {creating ? "Writing the brief…" : "Create the brief"}
          </button>
        </form>
      </div>

      <aside className="lg:pt-20">
        <h2 className="font-semibold">What happens next</h2>
        <ol className="mt-4 space-y-6">
          {NEXT.map((n, i) => (
            <li key={n.title} className="grid grid-cols-[2rem_1fr] gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full border border-rule text-sm font-bold text-stone-500">{i + 1}</span>
              <div>
                <p className="font-semibold">{n.title}</p>
                <p className="mt-0.5 text-[15px] text-stone-600 dark:text-stone-400">{n.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </aside>
    </main>
  );
}
