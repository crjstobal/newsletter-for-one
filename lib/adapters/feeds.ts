import { XMLParser } from "fast-xml-parser";
import { decode, htmlToText } from "./email";

/**
 * RSS / Atom feeds and podcasts. Free and key-less: blogs, Substack and Beehiiv newsletters
 * (they all publish a feed), and podcast feeds found through the public Apple Podcasts search.
 *
 * Podcasts: Token Factory has no speech-to-text model, so episodes are read from the transcript
 * the publisher ships with the feed (Podcasting 2.0 <podcast:transcript>), falling back to the
 * show notes. Both are labelled, so the reader knows which one a story came from.
 */

const UA = "Mozilla/5.0 (compatible; NewsletterForOne/1.0; +https://github.com/)";
const TIMEOUT_MS = 15_000;

export type FeedItem = {
  guid: string;
  title: string;
  url?: string;
  date?: string; // YYYY-MM-DD
  content: string;
  contentKind: "text" | "transcript" | "show-notes";
  links: { text: string; url: string }[];
  transcriptUrl?: string;
};

export type Feed = { title: string; site?: string; image?: string; isPodcast: boolean; items: FeedItem[] };

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  isArray: (name) => ["item", "entry", "link", "podcast:transcript", "category"].includes(name),
});

async function get(url: string, accept = "*/*") {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: accept }, signal: AbortSignal.timeout(TIMEOUT_MS), redirect: "follow" });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res;
}

const text = (v: unknown): string => {
  if (v === undefined || v === null) return "";
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (typeof v === "object" && "#text" in (v as Record<string, unknown>)) return String((v as Record<string, unknown>)["#text"]);
  return "";
};
/** Titles often carry HTML entities (&#8217;) even after XML parsing. */
const title = (v: unknown) => decode(text(v)).replace(/\s+/g, " ").trim();

const isoDate = (v: unknown) => {
  const d = new Date(text(v));
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10);
};

type Node = Record<string, unknown>;

export async function fetchFeed(url: string): Promise<Feed> {
  const xml = await (await get(url, "application/rss+xml, application/atom+xml, application/xml, text/xml")).text();
  const doc = parser.parse(xml) as Node;
  const rss = (doc.rss as Node | undefined)?.channel as Node | undefined;
  if (rss) {
    const items = ((rss.item as Node[]) ?? []).slice(0, 30).map((it): FeedItem => {
      const html = text(it["content:encoded"]) || text(it.description) || text(it["itunes:summary"]);
      const { text: body, links } = htmlToText(html);
      const enclosure = it.enclosure as Node | undefined;
      const transcript = ((it["podcast:transcript"] as Node[]) ?? []).sort((a, b) => rankTranscript(b) - rankTranscript(a))[0];
      const link = text((it.link as unknown[] | undefined)?.[0]) || undefined;
      return {
        guid: text(it.guid) || link || text(enclosure?.["@_url"]) || text(it.title),
        title: title(it.title) || "(untitled)",
        url: link || text(enclosure?.["@_url"]) || undefined,
        date: isoDate(it.pubDate ?? it["dc:date"]),
        content: body,
        contentKind: enclosure ? "show-notes" : "text",
        links,
        transcriptUrl: transcript ? text(transcript["@_url"]) : undefined,
      };
    });
    const image = text((rss.image as Node | undefined)?.url) || text((rss["itunes:image"] as Node | undefined)?.["@_href"]) || undefined;
    const site = text((rss.link as unknown[] | undefined)?.find((l) => typeof l === "string")) || undefined;
    return { title: title(rss.title) || url, site, image, isPodcast: items.some((i) => i.contentKind === "show-notes"), items };
  }
  const atom = doc.feed as Node | undefined;
  if (atom) {
    const hrefOf = (links: unknown) => {
      const arr = (links as Node[] | undefined) ?? [];
      return text((arr.find((l) => !l["@_rel"] || l["@_rel"] === "alternate") ?? arr[0])?.["@_href"]) || undefined;
    };
    const items = ((atom.entry as Node[]) ?? []).slice(0, 30).map((e): FeedItem => {
      // YouTube channel feeds put the video description in media:group.
      const media = text((e["media:group"] as Node | undefined)?.["media:description"]);
      const { text: body, links } = htmlToText(text(e.content) || text(e.summary) || media.replace(/\n/g, "<br>"));
      const link = hrefOf(e.link);
      return { guid: text(e.id) || link || text(e.title), title: title(e.title) || "(untitled)", url: link, date: isoDate(e.published ?? e.updated), content: body, contentKind: "text", links };
    });
    return { title: title(atom.title) || url, site: hrefOf(atom.link), image: text(atom.icon) || undefined, isPodcast: false, items };
  }
  throw new Error("Not an RSS or Atom feed");
}

/** Prefer plain text transcripts, then subtitles, then HTML, then JSON. */
const rankTranscript = (t: Node) => {
  const type = text(t["@_type"]);
  return type.includes("plain") ? 4 : type.includes("vtt") || type.includes("srt") ? 3 : type.includes("html") ? 2 : 1;
};

/** The transcript as plain text: subtitles lose their timestamps, JSON its segments. */
export async function fetchTranscript(url: string): Promise<string> {
  const res = await get(url);
  const type = res.headers.get("content-type") ?? "";
  const raw = await res.text();
  if (type.includes("json") || raw.trimStart().startsWith("{")) {
    try {
      const j = JSON.parse(raw) as { segments?: { body?: string; speaker?: string }[] };
      return (j.segments ?? []).map((s) => s.body ?? "").join(" ").replace(/\s+/g, " ").trim();
    } catch {
      // fall through to text handling
    }
  }
  if (type.includes("html") || /<\/?(p|div|span|br)\b/i.test(raw)) return htmlToText(raw).text;
  return raw
    .split("\n")
    .filter((l) => l.trim() && !/^\d+$/.test(l.trim()) && !/-->/.test(l) && !/^WEBVTT/.test(l) && !/^NOTE\b/.test(l))
    .join(" ")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * A page URL to its feed URL: feeds pass through, Substack gets /feed, Apple Podcasts links are
 * looked up, anything else is searched for <link rel="alternate" type="application/rss+xml">.
 */
export async function discoverFeed(input: string): Promise<string> {
  const url = new URL(/^https?:\/\//.test(input) ? input : `https://${input}`);
  const apple = url.hostname.endsWith("podcasts.apple.com") && url.pathname.match(/id(\d+)/)?.[1];
  if (apple) {
    const r = (await (await get(`https://itunes.apple.com/lookup?id=${apple}&entity=podcast`)).json()) as { results: { feedUrl?: string }[] };
    if (r.results[0]?.feedUrl) return r.results[0].feedUrl;
    throw new Error("Apple Podcasts has no public feed for this show");
  }
  if (url.hostname.endsWith(".substack.com") && !url.pathname.startsWith("/feed")) return `${url.origin}/feed`;

  const res = await get(url.toString(), "text/html, application/rss+xml, application/xml");
  const type = res.headers.get("content-type") ?? "";
  const body = await res.text();
  if (/xml|rss|atom/.test(type) || /^\s*<\?xml|<rss\b|<feed\b/.test(body.slice(0, 500))) return res.url || url.toString();
  const tag = body.match(/<link[^>]+type=["']application\/(rss|atom)\+xml["'][^>]*>/i)?.[0];
  const href = tag?.match(/href=["']([^"']+)["']/i)?.[1];
  if (href) return new URL(href, res.url || url).toString();
  // Common locations, last resort.
  for (const path of ["/feed", "/rss", "/feed.xml", "/rss.xml", "/atom.xml", "/index.xml"]) {
    try {
      const probe = await get(new URL(path, url).toString(), "application/rss+xml, application/xml");
      if (/xml|rss|atom/.test(probe.headers.get("content-type") ?? "")) return probe.url;
    } catch {
      // try the next one
    }
  }
  throw new Error("No feed found on that page");
}

export type PodcastResult = { name: string; author: string; feedUrl: string; image?: string; site?: string };

/** Public Apple Podcasts directory search: no key, returns each show's own RSS feed. */
export async function searchPodcasts(term: string, country = "us"): Promise<PodcastResult[]> {
  const r = (await (await get(`https://itunes.apple.com/search?media=podcast&entity=podcast&limit=8&country=${country}&term=${encodeURIComponent(term)}`)).json()) as {
    results: { collectionName: string; artistName: string; feedUrl?: string; artworkUrl100?: string; collectionViewUrl?: string }[];
  };
  return r.results
    .filter((p) => p.feedUrl)
    .map((p) => ({ name: p.collectionName, author: p.artistName, feedUrl: p.feedUrl!, image: p.artworkUrl100, site: p.collectionViewUrl }));
}
