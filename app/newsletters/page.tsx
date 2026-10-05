import { connection } from "next/server";
import { store } from "@/lib/store";
import { LANGUAGE_NAMES } from "../components/examples";
import { themesOf } from "../components/themes";
import { NewslettersBrowser, type NewsletterCard } from "../components/NewslettersBrowser";
import { describeDelivery, deliveryOf, isPaused } from "@/lib/core/schedule";

export const metadata = { title: "Your newsletters | Newsletter for One" };

export default async function Newsletters() {
  await connection();
  const cards: NewsletterCard[] = await Promise.all(
    (await store.listNewsletters()).map(async (nl) => {
      const issues = await store.listIssues(nl.id);
      const last = issues[0];
      return {
        id: nl.id,
        name: nl.profile.name,
        topic: nl.profile.topic,
        createdAt: nl.createdAt,
        lastIssueDate: last?.date,
        lastSubject: last?.subject,
        lastStories: last?.stories.slice(0, 4) ?? [],
        themes: last ? themesOf(last.stories).filter((t) => t !== "Stories") : [],
        issueCount: issues.length,
        storyCount: nl.memory.covered.length,
        learned: nl.memory.likes.length + nl.memory.dislikes.length,
        bars: issues.map((i) => ({ id: i.id, date: i.date, stories: i.stories.length })),
        delivery: describeDelivery(deliveryOf(nl)),
        paused: isPaused(nl),
        language: LANGUAGE_NAMES[nl.profile.language] ?? nl.profile.language,
      };
    }),
  );

  return (
    <main className="mx-auto max-w-6xl px-5 py-12">
      <h1 className="text-4xl font-extrabold tracking-tight">Your newsletters</h1>
      <p className="mt-2 text-stone-600 dark:text-stone-400">
        {cards.length ? `${cards.length} newsletters, ${cards.reduce((n, c) => n + c.issueCount, 0)} issues so far.` : "Nothing here yet."}
      </p>
      <NewslettersBrowser cards={cards} />
    </main>
  );
}
