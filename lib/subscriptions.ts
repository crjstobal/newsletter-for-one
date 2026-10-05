import { createHash } from "crypto";
import { q } from "./db";
import { FEATURES } from "./features";
import { discoverFeed, fetchFeed, fetchTranscript } from "./adapters/feeds";
import { htmlToText, linksInText, parseAddress, type InboundEmail } from "./adapters/email";
import type { Subscriptions } from "./core/ports";
import type { ExtractedItem, InboxItem, ReadingSignal, Subscription, SubscriptionKind } from "./core/types";

/**
 * The reader's subscriptions, stored in Postgres: newsletters that arrive by email, podcasts
 * and feeds. Reading them costs nothing until an issue is written (splitting a long email into
 * separate news is the only model call, and it is cached per item).
 */

/** Domain of the inbox addresses. Mail for <token>@INBOX_DOMAIN must reach /api/inbound/email. */
export const INBOX_DOMAIN = process.env.INBOX_DOMAIN ?? "inbox.newsletterforone.app";
export const inboxAddress = (token: string) => `${token}@${INBOX_DOMAIN}`;

const MAX_CONTENT = 200_000;
const REFRESH_EVERY_MS = 60 * 60 * 1000;
const TRANSCRIPTS_PER_REFRESH = 3;

const hash = (s: string) => createHash("sha1").update(s).digest("hex").slice(0, 12);

type SubRow = {
  id: string; newsletter_id: string; kind: SubscriptionKind; name: string; url: string | null; sender: string | null;
  site: string | null; image: string | null; added_at: Date; last_fetched_at: Date | null; last_error: string | null; item_count?: string;
};
const toSub = (r: SubRow): Subscription => ({
  id: r.id, newsletterId: r.newsletter_id, kind: r.kind, name: r.name, url: r.url ?? undefined, sender: r.sender ?? undefined,
  site: r.site ?? undefined, image: r.image ?? undefined, addedAt: r.added_at.toISOString(),
  lastFetchedAt: r.last_fetched_at?.toISOString(), lastError: r.last_error ?? undefined, itemCount: r.item_count ? Number(r.item_count) : 0,
});

type ItemRow = {
  id: string; newsletter_id: string; subscription_id: string | null; kind: SubscriptionKind; source_name: string; guid: string;
  title: string; url: string | null; content: string; content_kind: InboxItem["contentKind"]; links: InboxItem["links"];
  published_at: string; received_at: Date; extracted: ExtractedItem[] | null;
};
const ITEM_COLS = "id, newsletter_id, subscription_id, kind, source_name, guid, title, url, content, content_kind, links, to_char(published_at, 'YYYY-MM-DD') as published_at, received_at, extracted";
const toItem = (r: ItemRow): InboxItem => ({
  id: r.id, newsletterId: r.newsletter_id, subscriptionId: r.subscription_id ?? undefined, kind: r.kind, sourceName: r.source_name,
  guid: r.guid, title: r.title, url: r.url ?? undefined, content: r.content, contentKind: r.content_kind, links: r.links,
  publishedAt: r.published_at, receivedAt: r.received_at.toISOString(), extracted: r.extracted ?? undefined,
});

export async function listSubscriptions(newsletterId: string): Promise<Subscription[]> {
  const r = await q<SubRow>(
    `select s.*, (select count(*) from inbox_items i where i.subscription_id = s.id) as item_count
       from subscriptions s where newsletter_id = $1 order by added_at`,
    [newsletterId],
  );
  return r.rows.map(toSub);
}

export async function removeSubscription(newsletterId: string, id: string) {
  await q("delete from subscriptions where id = $1 and newsletter_id = $2", [id, newsletterId]);
}

async function insertItem(it: Omit<InboxItem, "id" | "receivedAt">): Promise<boolean> {
  const r = await q(
    `insert into inbox_items (id, newsletter_id, subscription_id, kind, source_name, guid, title, url, content, content_kind, links, published_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     on conflict (newsletter_id, guid) do nothing`,
    [
      `${it.newsletterId.slice(0, 24)}-${hash(it.guid)}`, it.newsletterId, it.subscriptionId ?? null, it.kind, it.sourceName, it.guid,
      it.title.slice(0, 500), it.url ?? null, it.content.slice(0, MAX_CONTENT), it.contentKind, JSON.stringify(it.links.slice(0, 200)), it.publishedAt,
    ],
  );
  return (r.rowCount ?? 0) > 0;
}

/**
 * Follow a site, newsletter archive (Substack, Beehiiv, Ghost...) or podcast by URL. The feed
 * is found from the page if needed. The latest items are stored right away; they are only
 * used by issues whose window they fall in.
 */
export async function addFeed(newsletterId: string, input: string, hint?: SubscriptionKind): Promise<Subscription> {
  const url = await discoverFeed(input.trim());
  const feed = await fetchFeed(url);
  const kind: SubscriptionKind = hint === "newsletter" ? "newsletter" : feed.isPodcast || hint === "podcast" ? "podcast" : "feed";
  const id = `${kind}-${hash(newsletterId + url)}`;
  await q(
    `insert into subscriptions (id, newsletter_id, kind, name, url, site, image, last_fetched_at)
     values ($1, $2, $3, $4, $5, $6, $7, now())
     on conflict (newsletter_id, url) do update set name = excluded.name, kind = excluded.kind, image = excluded.image, last_error = null`,
    [id, newsletterId, kind, feed.title.slice(0, 200), url, feed.site ?? null, feed.image ?? null],
  );
  await storeFeedItems({ id, newsletterId, kind, name: feed.title, url }, feed.items);
  return (await listSubscriptions(newsletterId)).find((s) => s.url === url)!;
}

async function storeFeedItems(sub: { id: string; newsletterId: string; kind: SubscriptionKind; name: string; url: string }, items: Awaited<ReturnType<typeof fetchFeed>>["items"]) {
  let transcripts = 0;
  for (const it of items.slice(0, 15)) {
    let content = it.content;
    let contentKind = it.contentKind;
    // Podcasts: the publisher's own transcript when the feed has one (newest episodes first).
    if (sub.kind === "podcast" && it.transcriptUrl && transcripts < TRANSCRIPTS_PER_REFRESH) {
      const exists = await q("select 1 from inbox_items where newsletter_id = $1 and guid = $2", [sub.newsletterId, it.guid]);
      if (!exists.rowCount) {
        transcripts++;
        try {
          const t = await fetchTranscript(it.transcriptUrl);
          if (t.length > 500) {
            content = t;
            contentKind = "transcript";
          }
        } catch {
          // keep the show notes
        }
      }
    }
    await insertItem({
      newsletterId: sub.newsletterId, subscriptionId: sub.id, kind: sub.kind, sourceName: sub.name, guid: it.guid, title: it.title,
      url: it.url, content: content || it.title, contentKind, links: it.links, publishedAt: it.date ?? new Date().toISOString().slice(0, 10),
    });
  }
}

/** Fetches every feed not fetched in the last hour. Errors are recorded per subscription. */
export async function refreshFeeds(newsletterId: string, force = false): Promise<string[]> {
  const subs = (await listSubscriptions(newsletterId)).filter((s) => s.url && (s.kind === "feed" || (s.kind === "podcast" ? FEATURES.podcasts : FEATURES.newsletters)));
  const errors: string[] = [];
  await Promise.all(subs.map(async (s) => {
    if (!force && s.lastFetchedAt && Date.now() - Date.parse(s.lastFetchedAt) < REFRESH_EVERY_MS) return;
    try {
      const feed = await fetchFeed(s.url!);
      await storeFeedItems({ id: s.id, newsletterId, kind: s.kind, name: s.name, url: s.url! }, feed.items);
      await q("update subscriptions set last_fetched_at = now(), last_error = null where id = $1", [s.id]);
    } catch (err) {
      errors.push(`${s.name}: ${(err as Error).message}`);
      await q("update subscriptions set last_fetched_at = now(), last_error = $2 where id = $1", [s.id, (err as Error).message.slice(0, 200)]);
    }
  }));
  return errors;
}

/** An email to a newsletter's inbox address. Unknown senders become a newsletter subscription. */
export async function ingestEmail(email: InboundEmail): Promise<{ newsletterId: string; itemId: string; stored: boolean } | null> {
  const tokens = email.to.map((a) => a.split("@")[0].split("+").pop()!).filter(Boolean);
  const nl = (await q<{ id: string }>("select id from newsletters where inbox_token = any($1)", [tokens])).rows[0];
  if (!nl) return null;
  const sender = email.from || "unknown@unknown";
  const subId = `newsletter-${hash(nl.id + sender)}`;
  await q(
    `insert into subscriptions (id, newsletter_id, kind, name, sender, site) values ($1, $2, 'newsletter', $3, $4, $5)
     on conflict (newsletter_id, sender) do nothing`,
    [subId, nl.id, email.fromName.slice(0, 200), sender, sender.split("@")[1] ?? null],
  );
  const sub = (await q<{ id: string; name: string }>("select id, name from subscriptions where newsletter_id = $1 and sender = $2", [nl.id, sender])).rows[0];
  const fromHtml = email.html ? htmlToText(email.html) : null;
  const text = fromHtml?.text || email.text || "";
  const links = fromHtml?.links.length ? fromHtml.links : linksInText(email.text ?? "");
  const guid = email.messageId || `${sender}|${email.subject}|${email.date}`;
  const item = {
    newsletterId: nl.id, subscriptionId: sub.id, kind: "newsletter" as const, sourceName: sub.name, guid, title: email.subject,
    url: undefined, content: text, contentKind: "text" as const, links, publishedAt: email.date ?? new Date().toISOString().slice(0, 10),
  };
  const stored = await insertItem(item);
  return { newsletterId: nl.id, itemId: `${nl.id.slice(0, 24)}-${hash(guid)}`, stored };
}

export async function listInbox(newsletterId: string, limit = 40): Promise<InboxItem[]> {
  const r = await q<ItemRow>(`select ${ITEM_COLS} from inbox_items where newsletter_id = $1 order by published_at desc, received_at desc limit $2`, [newsletterId, limit]);
  return r.rows.map(toItem);
}

export async function getInboxItem(id: string): Promise<InboxItem | null> {
  const r = await q<ItemRow>(`select ${ITEM_COLS} from inbox_items where id = $1`, [id]);
  return r.rows[0] ? toItem(r.rows[0]) : null;
}

/** The pipeline's view of one newsletter's subscriptions. */
export function pgSubscriptions(newsletterId: string): Subscriptions {
  return {
    async collect(since) {
      const errors = await refreshFeeds(newsletterId);
      // Kinds not offered yet stay out of issues, even if items exist from testing.
      const kinds = ["feed", ...(FEATURES.newsletters ? ["newsletter"] : []), ...(FEATURES.podcasts ? ["podcast"] : [])];
      const r = await q<ItemRow>(
        `select ${ITEM_COLS} from inbox_items where newsletter_id = $1 and published_at >= $2 and kind = any($3) order by published_at desc limit 60`,
        [newsletterId, since, kinds],
      );
      return { items: r.rows.map(toItem), errors };
    },
    async saveExtraction(itemId, items) {
      await q("update inbox_items set extracted = $2 where id = $1", [itemId, JSON.stringify(items)]);
    },
  };
}

// ---------------------------------------------------------------- clicks

export async function recordClick(newsletterId: string, issueId: string, storyIndex: number) {
  await q("insert into clicks (newsletter_id, issue_id, story_index) values ($1, $2, $3)", [newsletterId, issueId, storyIndex]);
}

/**
 * Opened vs shown per theme and per publisher, over the last 10 issues. A story counts as
 * opened once however many times it was clicked. Only entries seen at least twice are kept.
 */
export async function readingSignals(newsletterId: string): Promise<ReadingSignal[]> {
  const issues = (await q<{ id: string; stories: { theme?: string; publisher?: string; source: string; via?: string }[] }>(
    "select id, stories from issues where newsletter_id = $1 order by number desc limit 10",
    [newsletterId],
  )).rows;
  if (!issues.length) return [];
  const opened = new Set(
    (await q<{ k: string }>("select distinct issue_id || ':' || story_index as k from clicks where newsletter_id = $1", [newsletterId])).rows.map((r) => r.k),
  );
  if (!opened.size) return [];
  const tally = new Map<string, ReadingSignal>();
  const add = (by: ReadingSignal["by"], name: string | undefined, was: boolean) => {
    if (!name) return;
    const k = `${by}:${name}`;
    const t = tally.get(k) ?? { by, name, shown: 0, opened: 0 };
    t.shown++;
    if (was) t.opened++;
    tally.set(k, t);
  };
  for (const issue of issues) {
    issue.stories.forEach((s, i) => {
      const was = opened.has(`${issue.id}:${i}`);
      add("theme", s.theme, was);
      add("publisher", s.via ?? s.publisher ?? s.source, was);
    });
  }
  return [...tally.values()].filter((t) => t.shown >= 2).sort((a, b) => b.opened / b.shown - a.opened / a.shown || b.shown - a.shown).slice(0, 16);
}

export { parseAddress };
