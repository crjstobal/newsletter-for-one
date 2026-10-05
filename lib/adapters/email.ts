/**
 * Inbound email: every newsletter has its own address, and the reader subscribes to other
 * newsletters with it. Any inbound-email service can deliver to /api/inbound/email; this
 * normalizes the common payload shapes (Postmark, SendGrid / Mailgun parse, Cloudflare Email
 * Workers forwarding JSON, or a plain {to, from, subject, html, text}).
 */

export type InboundEmail = {
  to: string[];
  from: string; // address
  fromName: string;
  subject: string;
  html?: string;
  text?: string;
  date?: string; // YYYY-MM-DD
  messageId?: string;
};

type Payload = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : v === undefined || v === null ? "" : String(v));

/** "Ben Thompson <ben@stratechery.com>" -> { name, address } */
export function parseAddress(raw: string): { name: string; address: string } {
  const m = raw.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1].trim(), address: m[2].trim().toLowerCase() };
  return { name: "", address: raw.trim().toLowerCase() };
}

const addresses = (v: unknown): string[] => {
  if (Array.isArray(v)) return v.flatMap((x) => addresses(typeof x === "object" && x ? (x as Payload).Email ?? (x as Payload).address : x));
  return str(v).split(",").map((a) => parseAddress(a).address).filter(Boolean);
};

export function parseInbound(p: Payload): InboundEmail {
  // Postmark uses capitalized keys; most others are lowercase.
  const get = (...keys: string[]) => keys.map((k) => p[k]).find((v) => v !== undefined && v !== "");
  const fromRaw = str(get("From", "from", "sender"));
  const from = parseAddress(fromRaw);
  const date = new Date(str(get("Date", "date")) || Date.now());
  const headers = (p.Headers as { Name: string; Value: string }[] | undefined) ?? [];
  return {
    to: addresses(get("ToFull", "To", "to", "recipient", "envelope_to")),
    from: from.address,
    fromName: str(get("FromName", "from_name")) || from.name || from.address.split("@")[0],
    subject: str(get("Subject", "subject")).trim() || "(no subject)",
    html: str(get("HtmlBody", "html", "body-html", "body_html")) || undefined,
    text: str(get("TextBody", "text", "body-plain", "body_plain", "plain")) || undefined,
    date: Number.isNaN(date.getTime()) ? undefined : date.toISOString().slice(0, 10),
    messageId: str(get("MessageID", "message_id", "Message-Id", "messageId")) || headers.find((h) => /^message-id$/i.test(h.Name))?.Value || undefined,
  };
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'", mdash: ", ", ndash: "-", hellip: "...", rsquo: "'", lsquo: "'", rdquo: '"', ldquo: '"' };
export const decode = (s: string) =>
  s.replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });

/**
 * HTML to readable text, keeping every link (numbered for the model to cite by id, so links in
 * the issue always come from the email itself). Tracking pixels, styles and scripts are dropped.
 */
export function htmlToText(html: string): { text: string; links: { text: string; url: string }[] } {
  const links: { text: string; url: string }[] = [];
  const seen = new Set<string>();
  let s = html
    .replace(/<(script|style|head|title)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<img[^>]*>/gi, " ");
  s = s.replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_m, href: string, inner: string) => {
    const label = decode(inner.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
    const url = decode(href).trim();
    if (/^https?:\/\//i.test(url) && !seen.has(url)) {
      seen.add(url);
      links.push({ text: label || url, url });
    }
    return label ? ` ${label} ` : " ";
  });
  s = s
    .replace(/<(br|\/p|\/div|\/h\d|\/li|\/tr|hr)[^>]*>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<[^>]+>/g, " ");
  const text = decode(s)
    .split("\n")
    .map((l) => l.replace(/[ \t ]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
  return { text, links };
}

/** Plain-text emails: links are bare URLs. */
export function linksInText(text: string): { text: string; url: string }[] {
  return [...new Set(text.match(/https?:\/\/[^\s<>()"']+/g) ?? [])].map((url) => ({ text: url, url }));
}
