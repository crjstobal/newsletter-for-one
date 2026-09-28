import Link from "next/link";
import { connection } from "next/server";
import { fileStore } from "@/lib/store";
import type { Issue, Newsletter } from "@/lib/core/types";
import { Collage, IssueBars } from "../components/visuals";
import { themesOf } from "../components/themes";
import { LANGUAGE_NAMES } from "../components/examples";

export const metadata = { title: "Your newsletters | Newsletter for One" };

type Row = { nl: Newsletter; issues: Issue[] };

export default async function Newsletters() {
  await connection();
  const rows: Row[] = await Promise.all(
    (await fileStore.listNewsletters()).map(async (nl) => ({ nl, issues: await fileStore.listIssues(nl.id) })),
  );
  rows.sort((a, b) => (b.issues[0]?.id ?? b.nl.createdAt).localeCompare(a.issues[0]?.id ?? a.nl.createdAt));

  return (
    <main className="mx-auto max-w-6xl px-5 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight">Your newsletters</h1>
          <p className="mt-2 text-stone-600 dark:text-stone-400">
            {rows.length ? `${rows.length} newsletters, ${rows.reduce((n, r) => n + r.issues.length, 0)} issues so far.` : "Nothing here yet."}
          </p>
        </div>
        <Link href="/newsletters/new" className="btn btn-primary">
          Start a newsletter
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-rule p-12 text-center">
          <p className="text-lg font-semibold">Describe the first newsletter you want to read.</p>
          <p className="mt-1 text-stone-500">One sentence is enough. You review the brief before anything is written.</p>
          <Link href="/newsletters/new" className="btn btn-primary mt-5">
            Start a newsletter
          </Link>
        </div>
      ) : (
        <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map(({ nl, issues }) => {
            const last = issues[0];
            const themes = last ? themesOf(last.stories).filter((t) => t !== "Stories") : [];
            const learned = nl.memory.likes.length + nl.memory.dislikes.length;
            return (
              <li key={nl.id}>
                <Link href={`/newsletters/${nl.id}`} className="group block overflow-hidden rounded-xl border border-rule bg-sheet transition-shadow hover:shadow-[0_18px_36px_-20px_rgba(22,24,29,0.35)]">
                  {last ? (
                    <Collage stories={last.stories} className="aspect-[16/9]" />
                  ) : (
                    <div className="flex aspect-[16/9] items-center justify-center bg-stone-100 text-sm text-stone-500 dark:bg-stone-800">No issue yet</div>
                  )}
                  <div className="p-5">
                    <h2 className="text-xl font-bold tracking-tight group-hover:underline">{nl.profile.name}</h2>
                    <p className="mt-1 line-clamp-2 text-sm text-stone-600 dark:text-stone-400">{nl.profile.topic}</p>

                    {last && (
                      <p className="mt-3 line-clamp-2 font-serif text-[15px] leading-snug">
                        <span className="font-sans text-xs text-stone-500">Latest: </span>
                        {last.subject}
                      </p>
                    )}

                    {themes.length > 0 && (
                      <ul className="mt-3 flex flex-wrap gap-1.5">
                        {themes.map((t) => <li key={t} className="rounded-full border border-rule px-2 py-0.5 text-xs text-stone-600 dark:text-stone-400">{t}</li>)}
                      </ul>
                    )}

                    <div className="mt-4 flex items-end justify-between gap-4 border-t border-rule pt-4">
                      <dl className="grid grid-cols-3 gap-4 text-sm">
                        <div><dt className="text-xs text-stone-500">Issues</dt><dd className="font-semibold tabular-nums">{issues.length}</dd></div>
                        <div><dt className="text-xs text-stone-500">Stories</dt><dd className="font-semibold tabular-nums">{nl.memory.covered.length}</dd></div>
                        <div><dt className="text-xs text-stone-500">Learned</dt><dd className="font-semibold tabular-nums">{learned}</dd></div>
                      </dl>
                      {issues.length > 1 && <IssueBars issues={issues} />}
                    </div>
                    <p className="mt-3 text-xs text-stone-500">
                      {nl.profile.cadence === "daily" ? "Daily" : "Weekly"}, written in {LANGUAGE_NAMES[nl.profile.language] ?? nl.profile.language}
                      {last ? `, last issue ${last.date}` : ""}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
