import { hostOf, type LLM, type SearchHit, type Subscriptions } from "./ports";
import type { ExtractedItem, InboxItem, Profile } from "./types";

/**
 * The reader's own subscriptions become candidates next to the web results, so the same
 * pipeline scores them, checks them against memory and merges them with everything else:
 * a launch covered by two newsletters, a podcast and a blog becomes one story that says so.
 */

const SYSTEM = `You split what a reader received from one of their subscriptions into separate
pieces of news, so a personal newsletter can merge them with other sources.

You receive one item: an email newsletter, a podcast episode (its transcript or show notes) or
a post, plus the links found in it, numbered.

Rules:
- One entry per distinct piece of news, announcement, release, finding or opinion worth
  knowing. A digest newsletter usually has many; a podcast episode discusses a few topics.
- Skip sponsors, ads, job posts, housekeeping ("thanks for subscribing"), referral programs,
  and anything that is not about the topic given.
- "title": specific, like a headline. "summary": 1 to 3 sentences, only facts stated in the item.
  For a podcast, say what the hosts said or concluded ("the hosts argue...").
- "linkId": the number of the link that points to the original source of THAT piece of news,
  or null when there is none. Never a link to the newsletter itself, a sponsor, social
  sharing, or account settings.
- Write in the item's own language. Never invent facts.

Return JSON: {"items": [{"title": string, "summary": string, "linkId": number|null}]}`;

const MAX_CHARS = 60_000; // about 15K tokens: a long digest or most of an episode transcript
const MAX_ITEMS = 15;

/** Links that are never a source: account and list management, sharing, the sender's own app. */
/** Images and CDN assets are never a source either (Substack wraps header images in links). */
const ASSET_LINK = /\.(png|jpe?g|gif|webp|svg|avif)(\?|$)|substackcdn\.com\/image|\/image\/fetch\//i;
const JUNK_LINK = /unsubscribe|manage.*(subscription|preferences)|preferences|email-settings|view.*(browser|online)|\/share|twitter\.com\/intent|facebook\.com\/sharer|linkedin\.com\/share|mailto:|\/app-link|\/redirect\/app|apps\.apple\.com|play\.google\.com/i;

export async function extractItems(llm: LLM, profile: Profile, item: InboxItem): Promise<ExtractedItem[]> {
  // A blog or news post is already one piece of news: no model needed.
  if (item.kind === "feed") return [{ title: item.title, summary: item.content.slice(0, 1200), url: item.url }];

  const links = item.links.filter((l) => !JUNK_LINK.test(l.url) && !JUNK_LINK.test(l.text) && !ASSET_LINK.test(l.url)).slice(0, 120);
  const out = await llm.json<{ items: { title: string; summary: string; linkId: number | null }[] }>(
    "extract",
    [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: JSON.stringify({
          topic: profile.topic,
          kind: item.kind === "podcast" ? `podcast episode (${item.contentKind})` : "email newsletter",
          from: item.sourceName,
          title: item.title,
          date: item.publishedAt,
          text: item.content.slice(0, MAX_CHARS),
          links: links.map((l, i) => ({ id: i, text: l.text.slice(0, 80), url: l.url.slice(0, 200) })),
        }),
      },
    ],
    { maxTokens: 6000, thinking: false, note: `split ${item.kind} "${item.title.slice(0, 40)}"` },
  );
  const ownHost = item.url ? hostOf(item.url) : undefined;
  return (out.items ?? [])
    .filter((x) => x.title && x.summary)
    .slice(0, MAX_ITEMS)
    .map((x) => {
      // Links come from the item itself, never from the model. A link back to the publisher's
      // own site is not a source: cite the item instead.
      const link = x.linkId !== null ? links[Number(x.linkId)]?.url : undefined;
      return { title: String(x.title), summary: String(x.summary), url: link && hostOf(link) !== ownHost ? link : item.url };
    });
}

/**
 * Collects the window's subscription items, splits each into news (cached per item) and turns
 * them into search-hit-shaped candidates. Failures degrade to fewer candidates, never a failed issue.
 */
export async function subscriptionCandidates(
  llm: LLM,
  profile: Profile,
  subs: Subscriptions,
  since: string,
): Promise<{ hits: SearchHit[]; items: InboxItem[]; errors: string[] }> {
  const { items, errors } = await subs.collect(since);
  const hits: SearchHit[] = [];
  await Promise.all(items.map(async (item) => {
    let extracted = item.extracted;
    if (!extracted) {
      try {
        extracted = await extractItems(llm, profile, item);
        await subs.saveExtraction(item.id, extracted);
      } catch (err) {
        errors.push(`${item.sourceName}: could not read "${item.title}" (${(err as Error).message.slice(0, 80)})`);
        return;
      }
    }
    extracted.forEach((x, k) => {
      hits.push({
        // Several news items can share one link (a podcast episode): the fragment keeps them apart.
        url: x.url && x.url !== item.url ? x.url : `${item.url ?? `/inbox/${item.id}`}#item-${k}`,
        title: x.title,
        content: x.summary,
        publishedDate: item.publishedAt,
        origin: item.kind,
        via: item.sourceName,
      });
    });
  }));
  return { hits, items, errors };
}
