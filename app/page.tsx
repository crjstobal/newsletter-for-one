import Link from "next/link";
import { connection } from "next/server";
import { fileStore } from "@/lib/store";
import type { Issue, Newsletter } from "@/lib/core/types";
import { DEFAULT_MODELS } from "@/lib/adapters/nebius";
import { HeroForm } from "./components/HeroForm";
import { Stamp } from "./components/ui";

/** The most convincing real issue on disk: most stories, all dated. */
async function showcase(): Promise<{ issue: Issue; newsletter: Newsletter } | null> {
  const newsletters = await fileStore.listNewsletters();
  let best: { issue: Issue; newsletter: Newsletter; rank: number } | null = null;
  for (const newsletter of newsletters) {
    for (const issue of await fileStore.listIssues(newsletter.id)) {
      if (!issue.trace || issue.quiet) continue;
      const dated = issue.stories.filter((s) => s.dateFrom === "page" || s.dateFrom === "search").length;
      const rank = dated * 10 + new Set(issue.stories.map((s) => s.source)).size;
      if (!best || rank > best.rank) best = { issue, newsletter, rank };
    }
  }
  return best;
}

const model = (id: string) => id.replace(/^nvidia\//, "");

export default async function Home() {
  await connection();
  const demo = await showcase();
  const tr = demo?.issue.trace;
  const step = (key: string) => tr?.steps.find((s) => s.key === key);
  const learned = (await fileStore.listNewsletters()).find((n) => n.memory.likes.length || n.memory.dislikes.length)?.memory;

  const HOW = [
    {
      title: "Plan",
      body: "Reads your brief, your past reactions and every story you already got, then decides what to look for since the last issue.",
      tool: `${model(DEFAULT_MODELS.planner)}`,
      figure: step("plan")?.summary,
    },
    {
      title: "Search",
      body: "Runs those searches on the live web: news, blogs, official sites, Reddit, YouTube and the sources you trust.",
      tool: "Tavily",
      figure: step("search")?.summary,
    },
    {
      title: "Score",
      body: "Reads every result and scores how much it matters to you. Articles about the same event are grouped.",
      tool: model(DEFAULT_MODELS.triage),
      figure: step("triage")?.summary,
    },
    {
      title: "Check dates",
      body: "Opens each promising page and reads when it was really published. No date, no story.",
      tool: "Page metadata, no AI",
      figure: step("dates")?.summary,
    },
    {
      title: "Filter",
      body: "Drops anything old, weak, blocked or already sent, and keeps any one site from taking over.",
      tool: "Plain rules, no AI",
      figure: step("filter")?.summary.split(" · ")[0],
    },
    {
      title: "Write",
      body: "Writes the issue in your language from those sources only. Every link comes from the search, never from the model.",
      tool: model(DEFAULT_MODELS.editor),
      figure: step("edit")?.summary,
    },
  ];

  return (
    <main>
      {/* Hero */}
      <section className="mx-auto grid max-w-6xl items-start gap-12 px-5 pb-20 pt-14 lg:grid-cols-[1.05fr_1fr] lg:pt-20">
        <div className="max-w-xl">
          <h1 className="text-[2.6rem] font-extrabold leading-[1.05] tracking-[-0.03em] sm:text-6xl">
            The newsletter you wish existed, written for you every week.
          </h1>
          <p className="mt-6 max-w-[34rem] text-lg leading-relaxed text-stone-600 dark:text-stone-400">
            Describe your niche in a sentence. It searches the web for what&apos;s new, checks when every source was
            published, and sends you only what you haven&apos;t seen. React to a story and the next issue adjusts.
          </p>
          <div className="mt-8">
            <HeroForm />
          </div>
        </div>

        {demo && tr ? (
          <figure className="relative">
            <div className="rounded-xl border border-rule bg-sheet p-6 shadow-[0_24px_48px_-24px_rgba(22,24,29,0.25)] sm:p-8">
              <p className="text-sm text-stone-500">{demo.newsletter.profile.name}, issue of {demo.issue.date}</p>
              <p className="mt-2 font-serif text-2xl font-semibold leading-snug">{demo.issue.subject}</p>
              <ol className="mt-6 space-y-5">
                {demo.issue.stories.slice(0, 3).map((s, i) => (
                  <li key={s.url} className="border-t border-rule pt-4" style={{ ["--d" as string]: `${300 + i * 180}ms` }}>
                    <div className="mb-1.5 flex items-center gap-3">
                      <Stamp date={s.publishedDate} from={s.dateFrom} since={tr.window.since} animate className="[animation-delay:var(--d)]" />
                      <span className="text-xs text-stone-500">{s.source}</span>
                    </div>
                    <p className="font-serif text-[17px] font-semibold leading-snug">
                      {s.headline}
                    </p>
                    <p className="mt-1 line-clamp-2 font-serif text-[15px] leading-relaxed text-stone-600 dark:text-stone-400">{s.summary}</p>
                  </li>
                ))}
              </ol>
            </div>
            <figcaption className="mt-3 text-sm text-stone-500">
              A real issue it wrote. Each stamp is a publication date read from the source itself.
            </figcaption>
          </figure>
        ) : (
          <div className="rounded-xl border border-dashed border-rule p-8 text-stone-500">Generate an issue to see it here.</div>
        )}
      </section>

      {/* How */}
      <section id="how" className="scroll-mt-16 border-t border-rule bg-sheet">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <h2 className="max-w-2xl text-3xl font-extrabold tracking-tight sm:text-4xl">What happens between your sentence and your inbox</h2>
          <p className="mt-4 max-w-2xl text-stone-600 dark:text-stone-400">
            Six steps, every issue. Figures are from the issue above.
          </p>
          <ol className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {HOW.map((h, i) => (
              <li key={h.title} className="relative border-l-2 border-rule pl-5">
                <span className="absolute -left-[9px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-paper text-[10px] font-bold text-stone-500 ring-2 ring-rule">
                  {i + 1}
                </span>
                <h3 className="text-lg font-bold">{h.title}</h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-stone-600 dark:text-stone-400">{h.body}</p>
                <p className="mt-3 text-sm text-stone-500">{h.tool}</p>
                {h.figure && <p className="mt-0.5 text-sm font-semibold text-ink">{h.figure}</p>}
              </li>
            ))}
          </ol>
          {tr && (
            <p className="mt-12 text-stone-600 dark:text-stone-400">
              That issue took {Math.round(tr.totals.ms / 1000)} seconds and cost ${tr.totals.costUsd.toFixed(2)}: $
              {tr.totals.tavilyUsd.toFixed(2)} of web search and ${tr.totals.nebiusUsd.toFixed(3)} of Nemotron.{" "}
              <Link href="/newsletters" className="font-semibold text-stamp underline-offset-4 hover:underline">
                Every issue shows its full trace.
              </Link>
            </p>
          )}
        </div>
      </section>

      {/* Dates */}
      <section id="dates" className="scroll-mt-16">
        <div className="mx-auto grid max-w-6xl gap-12 px-5 py-20 lg:grid-cols-2">
          <div className="max-w-xl">
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Every story is provably recent</h2>
            <div className="mt-5 space-y-4 text-[17px] leading-relaxed text-stone-600 dark:text-stone-400">
              <p>
                Search engines happily return a plugin page from 2016 for a query about this week. An AI writer will then
                call it &ldquo;new&rdquo;. That is how automated newsletters lose your trust.
              </p>
              <p>
                Newsletter for One opens every promising source and reads its real publication date: the upload date of a video, the
                published time in an article&apos;s metadata. If a date can&apos;t be verified, the story doesn&apos;t
                ship.
              </p>
            </div>
          </div>
          <dl className="grid content-start gap-5 self-center">
            {[
              { stamp: <Stamp date="2026-09-24" from="page" since="2026-09-20" />, text: "Verified on the source itself. The only kind of date that makes it into your issue." },
              { stamp: <Stamp date="2026-09-24" from="model" since="2026-09-20" />, text: "Only mentioned in the text. Shown as unverified." },
              { stamp: <Stamp from="window" since="2026-09-20" />, text: "Reddit posts: no exact date without Reddit's API, but search only returns posts from this window." },
              { stamp: <Stamp date="2016-09-15" from="page" since="2026-09-20" />, text: "Published before the window. Dropped." },
              { stamp: <Stamp since="2026-09-20" />, text: "No date anywhere. Dropped." },
            ].map((r, i) => (
              <div key={i} className="grid grid-cols-[8.5rem_1fr] items-center gap-4">
                <dt>{r.stamp}</dt>
                <dd className="text-[15px] text-stone-600 dark:text-stone-400">{r.text}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Learns + control */}
      <section className="border-y border-rule bg-sheet">
        <div className="mx-auto grid max-w-6xl gap-16 px-5 py-20 lg:grid-cols-2">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight">It learns what you mean</h2>
            <p className="mt-4 max-w-lg text-[17px] leading-relaxed text-stone-600 dark:text-stone-400">
              Mark a story useful or not and say why in a few words. It turns that into lasting preferences that steer
              what it searches for and what it keeps.
            </p>
            <div className="mt-8 space-y-3 text-[15px]">
              <p className="rounded-lg border border-rule px-4 py-3">
                <span className="mr-2">👎</span>&ldquo;preset packs are basically ads&rdquo;
              </p>
              <p className="pl-4 text-stone-500">becomes</p>
              <ul className="space-y-1.5 rounded-lg bg-stamp-soft px-4 py-3">
                {(learned?.dislikes.length ? learned.dislikes.slice(0, 2) : ["Preset packs that read like ads rather than useful tools"]).map((d) => (
                  <li key={d}>Avoid: {d}</li>
                ))}
                {(learned?.likes.length ? learned.likes.slice(0, 1) : []).map((d) => (
                  <li key={d}>More of: {d}</li>
                ))}
              </ul>
            </div>
          </div>
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight">You decide where it looks</h2>
            <dl className="mt-6 space-y-6 text-[15px] leading-relaxed">
              <div>
                <dt className="font-bold">Sources you trust</dt>
                <dd className="text-stone-600 dark:text-stone-400">Get a search of their own every issue.</dd>
              </div>
              <div>
                <dt className="font-bold">Sources you don&apos;t</dt>
                <dd className="text-stone-600 dark:text-stone-400">Are excluded from every search, with one click from any story.</dd>
              </div>
              <div>
                <dt className="font-bold">Search in one language, read in another</dt>
                <dd className="text-stone-600 dark:text-stone-400">
                  Most sources for a niche are in English. It searches where the sources are and writes in the language
                  you read.
                </dd>
              </div>
              <div>
                <dt className="font-bold">Never the same story twice</dt>
                <dd className="text-stone-600 dark:text-stone-400">It remembers every piece of news it sent you, not just every link.</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      {/* Stack */}
      <section id="stack" className="scroll-mt-16">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Built with</h2>
          <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-stone-600 dark:text-stone-400">
            Every model is an open NVIDIA Nemotron model served by Nebius Token Factory, picked for its job: the cheapest
            one where volume is high, the largest one where you read the result.
          </p>
          <div className="mt-8 overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-[15px]">
              <thead className="text-sm text-stone-500">
                <tr className="border-b border-rule">
                  <th className="py-2 pr-6 font-medium">Job</th>
                  <th className="py-2 pr-6 font-medium">Runs on</th>
                  <th className="py-2 font-medium">Why this one</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Planning searches, learning from feedback", model(DEFAULT_MODELS.planner), "1M-token context at the lowest price: sees your whole history"],
                  ["Scoring every search result", model(DEFAULT_MODELS.triage), "Cheapest and fast; runs on dozens of results per issue"],
                  ["Writing the issue", model(DEFAULT_MODELS.editor), "NVIDIA's largest model, where quality is visible; about a cent per issue"],
                  ["Searching the web", "Tavily", "Search built for agents, with date and domain filters"],
                  ["Checking dates", "Page metadata", "Facts, not guesses: no model involved"],
                ].map(([job, runs, why]) => (
                  <tr key={job} className="border-b border-rule align-top">
                    <td className="py-3 pr-6 font-semibold">{job}</td>
                    <td className="py-3 pr-6">{runs}</td>
                    <td className="py-3 text-stone-600 dark:text-stone-400">{why}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Close */}
      <section className="mx-auto max-w-6xl px-5">
        <div className="flex flex-col items-start gap-5 rounded-2xl bg-ink px-8 py-12 text-paper sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-xl text-2xl font-bold leading-snug">Start with one sentence about what you want to follow.</p>
          <Link href="/newsletters/new" className="btn btn-primary btn-lg">
            Start a newsletter
          </Link>
        </div>
      </section>
    </main>
  );
}
