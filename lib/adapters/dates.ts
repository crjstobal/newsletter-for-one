import { hostOf, onDomain, toIsoDate, type DateResolver, type ResolvedDate } from "../core/ports";

/**
 * Finds a page's real publication date, one request per URL, no model involved.
 * - YouTube: the upload date published in the public watch page.
 * - Reddit: never contacted (see redditDate).
 * - Everything else: the page's own structured metadata (JSON-LD, Open Graph, schema.org).
 */
const UA = "Mozilla/5.0 (compatible; NewsletterForOne/0.1; +https://github.com/)";
const TIMEOUT_MS = 8000;
const MAX_BYTES = 1_500_000;

const SOCIAL = ["facebook.com", "instagram.com", "x.com", "twitter.com", "tiktok.com", "linkedin.com", "threads.net"];

async function fetchHtml(url: string, extraHeaders: Record<string, string> = {}): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept-Language": "en", ...extraHeaders },
    redirect: "follow",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  return text.slice(0, MAX_BYTES);
}

const first = (html: string, patterns: RegExp[]) => {
  for (const p of patterns) {
    const m = html.match(p);
    if (m?.[1]) return { value: m[1], via: p };
  }
  return null;
};

// Ordered by reliability. Only publication dates: modified/updated dates are ignored on purpose.
const WEB_PATTERNS: [RegExp, string][] = [
  [/"datePublished"\s*:\s*"([^"]+)"/, "JSON-LD datePublished"],
  [/<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["']/i, "article:published_time"],
  [/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']article:published_time["']/i, "article:published_time"],
  [/<meta[^>]+itemprop=["']datePublished["'][^>]+content=["']([^"']+)["']/i, "schema.org datePublished"],
  [/<meta[^>]+name=["'](?:pubdate|publish-date|date|dc\.date)["'][^>]+content=["']([^"']+)["']/i, "meta date"],
];

const IMAGE_PATTERNS = [
  /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
  /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
];

function previewImage(html: string, pageUrl: string): string | undefined {
  const raw = first(html, IMAGE_PATTERNS)?.value?.replace(/&amp;/g, "&");
  if (!raw) return undefined;
  try {
    const abs = new URL(raw, pageUrl);
    return abs.protocol === "https:" ? abs.toString() : undefined;
  } catch {
    return undefined;
  }
}

async function webDate(url: string): Promise<ResolvedDate> {
  const html = await fetchHtml(url);
  const image = previewImage(html, url);
  for (const [re, label] of WEB_PATTERNS) {
    const m = html.match(re);
    const date = toIsoDate(m?.[1]);
    if (date) return { date, note: `page metadata (${label})`, image };
  }
  return { note: "page has no publication date in its metadata", image };
}

function youtubeId(u: URL) {
  if (u.hostname === "youtu.be") return u.pathname.slice(1);
  if (u.pathname.startsWith("/shorts/")) return u.pathname.split("/")[2];
  return u.searchParams.get("v") ?? undefined;
}

async function youtubeDate(url: string): Promise<ResolvedDate> {
  const u = new URL(url);
  const isVideo = u.pathname === "/watch" || u.pathname.startsWith("/shorts/") || u.hostname === "youtu.be";
  if (!isVideo) return { note: "YouTube page is not a single video (channel, playlist or search)" };
  // The consent cookie avoids the EU cookie wall, which has no video metadata.
  const html = await fetchHtml(url, { Cookie: "SOCS=CAI; CONSENT=YES+" });
  const m = first(html, [/itemprop="uploadDate" content="([^"]+)"/, /itemprop="datePublished" content="([^"]+)"/, /"uploadDate"\s*:\s*"([^"]+)"/, /"publishDate"\s*:\s*"([^"]+)"/]);
  const date = toIsoDate(m?.value);
  const id = youtubeId(u);
  const image = id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : undefined;
  const channel = first(html, [/"ownerChannelName"\s*:\s*"([^"]+)"/, /<link itemprop="name" content="([^"]+)"/])?.value;
  const publisher = channel ? `${channel} (YouTube)` : undefined;
  return date ? { date, note: "YouTube upload date", image, publisher } : { note: "YouTube page did not expose an upload date", image, publisher };
}

/**
 * Reddit blocks automated access without an API key (JSON returns 403, the RSS feed rate-limits
 * and then blocks the IP), so we never contact Reddit. Tavily's search only returns posts
 * published or active inside the window, and that is the guarantee we report.
 */
function redditDate(url: string): ResolvedDate {
  if (!/reddit\.com\/r\/[^/]+\/comments\//i.test(url)) return { note: "Reddit page is not a single post (subreddit or listing)" };
  const sub = url.match(/reddit\.com\/r\/([^/]+)/i)?.[1];
  return { publisher: sub ? `r/${sub}` : undefined, withinWindow: true, note: "Reddit: exact date not available without Reddit's API; the search only returns posts published or active inside the window" };
}

export function pageDates(): DateResolver {
  const cache = new Map<string, Promise<ResolvedDate>>();
  return {
    resolve(url: string): Promise<ResolvedDate> {
      if (!cache.has(url)) cache.set(url, inspect(url));
      return cache.get(url)!;
    },
  };
}

async function inspect(url: string): Promise<ResolvedDate> {
  try {
    if (SOCIAL.some((d) => onDomain(url, d))) return { note: `${hostOf(url)} pages can't be read without logging in` };
    if (onDomain(url, "youtube.com") || onDomain(url, "youtu.be")) return await youtubeDate(url);
    if (onDomain(url, "reddit.com")) return redditDate(url);
    return await webDate(url);
  } catch (err) {
    return { note: `could not open the page (${(err as Error).message})` };
  }
}
