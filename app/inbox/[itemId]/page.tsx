import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getInboxItem } from "@/lib/subscriptions";

const KIND = { newsletter: "Newsletter", podcast: "Podcast episode", feed: "Post" } as const;
const CONTENT = { text: "", transcript: "Read from the publisher's transcript", "show-notes": "Read from the show notes (this podcast publishes no transcript)" } as const;

/** One thing received from a subscription, as it was read. Stories without their own link point here. */
export default async function InboxItemPage(props: PageProps<"/inbox/[itemId]">) {
  await connection();
  const { itemId } = await props.params;
  const item = await getInboxItem(itemId);
  if (!item) notFound();
  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <nav className="text-sm text-stone-500">
        <Link href={`/newsletters/${item.newsletterId}?tab=subscriptions`} className="hover:text-ink">Your subscriptions</Link>
        <span className="mx-2">/</span>
        <span className="text-ink">{item.sourceName}</span>
      </nav>
      <p className="mt-6 text-sm text-stone-500">{KIND[item.kind]} from {item.sourceName}, {item.publishedAt}</p>
      <h1 className="mt-1 font-serif text-3xl font-semibold leading-tight">{item.title}</h1>
      {CONTENT[item.contentKind] && <p className="mt-2 text-sm text-stone-500">{CONTENT[item.contentKind]}</p>}
      {item.url && <a href={item.url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-stamp hover:underline">Open the original</a>}
      {item.extracted?.length ? (
        <section className="mt-8 rounded-xl border border-rule bg-sheet p-5">
          <h2 className="text-sm font-semibold">Split into {item.extracted.length} pieces of news</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-[15px]">
            {item.extracted.map((x, i) => (
              <li key={i}>
                <span className="font-medium">{x.title}</span>
                <span className="text-stone-600 dark:text-stone-400"> {x.summary}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
      <article className="mt-8 whitespace-pre-wrap font-serif text-[17px] leading-8 text-stone-700 dark:text-stone-300">{item.content}</article>
    </main>
  );
}
