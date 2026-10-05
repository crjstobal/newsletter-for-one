"use client";

import Link from "next/link";
import { Ban, ChevronDown, Mail, MessagesSquare, Mic, Plus, Rss, ShieldCheck, Users, X, SquarePlay } from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { Newsletter, Profile, Subscription } from "@/lib/core/types";
import { HELP } from "./glossary";
import { Chips, Switch } from "./Settings";
import { Tip, shortDate } from "./ui";

type Data = { inboxAddress: string; subscriptions: Subscription[]; features: { newsletters: boolean; podcasts: boolean } };
type InboxRow = { id: string; sourceName: string; title: string; publishedAt: string; kind: string };

const field =
  "h-11 w-full rounded-lg border border-rule bg-paper px-3.5 text-[15px] outline-none transition-colors focus:border-stamp focus:ring-2 focus:ring-stamp/20";

const isYouTube = (s: Subscription) => Boolean(s.url?.includes("youtube.com"));
const hostOf = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return u;
  }
};

/**
 * Where every issue looks. One place for everything: sites you trust or block, YouTube,
 * Reddit, names to watch, and (soon) your own newsletters and podcasts. Changes save at once.
 */
export function SourcesPanel({
  newsletter,
  onPatch,
  onError,
  onToast,
}: {
  newsletter: Newsletter;
  onPatch: (patch: Partial<Profile>) => Promise<void>;
  onError: (message: string, locked?: boolean) => void;
  onToast: (m: string) => void;
}) {
  const id = newsletter.id;
  const p = newsletter.profile;
  const [data, setData] = useState<Data | null>(null);
  const [latest, setLatest] = useState<InboxRow[]>([]);

  const load = useCallback(async () => {
    const [s, i] = await Promise.all([
      fetch(`/api/newsletters/${id}/subscriptions`, { cache: "no-store" }).then((r) => r.json()),
      fetch(`/api/newsletters/${id}/inbox`, { cache: "no-store" }).then((r) => r.json()),
    ]);
    setData(s);
    setLatest((i as InboxRow[]).filter((x) => x.kind === "feed").slice(0, 8));
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function call(url: string, init: RequestInit, ok: string) {
    const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return onError(body.error ?? "Something went wrong", body.locked), false;
    onToast(ok);
    await onPatch({}); // reload the newsletter
    await load();
    return true;
  }

  /** Chips report the whole list: send only what changed. */
  async function sites(list: "domains" | "blockedDomains", next: string[]) {
    const before = (list === "domains" ? p.domains : p.blockedDomains) ?? [];
    for (const site of next.filter((x) => !before.includes(x))) {
      await call(`/api/newsletters/${id}/sites`, { method: "POST", body: JSON.stringify({ site, list }) }, list === "domains" ? `${site} added: searched every issue` : `${site} blocked`);
    }
    for (const site of before.filter((x) => !next.includes(x))) {
      await call(`/api/newsletters/${id}/sites?site=${encodeURIComponent(site)}`, { method: "DELETE" }, `${site} removed`);
    }
  }

  const feeds = data?.subscriptions.filter((s) => s.kind === "feed") ?? [];
  const channels = feeds.filter(isYouTube);
  const followedHosts = new Set(feeds.filter((s) => !isYouTube(s)).map((s) => hostOf(s.url ?? "")));

  return (
    <div className="space-y-6 pb-16">
      <p className="max-w-3xl text-[15px] leading-relaxed text-stone-600 dark:text-stone-400">
        Where every issue looks. It searches the web for you anyway; this is how you point it at what you like and away from what you don&apos;t.
        Changes are saved at once and apply from the next issue.
      </p>

      <Block icon={<ShieldCheck size={17} className="text-fresh" />} title="Sites you trust" help="Searched directly every issue, on top of the planned searches. When the site publishes a feed (most blogs, Substack and news sites do), its new posts are also read straight from it.">
        <Chips values={p.domains} onChange={(v) => sites("domains", v)} placeholder="Add a site, e.g. theverge.com" tone="good" />
        {p.domains.some((d) => followedHosts.has(d)) && (
          <p className="mt-2 flex items-center gap-1.5 text-sm text-stone-500">
            <Rss size={13} /> Also reading the feed of {p.domains.filter((d) => followedHosts.has(d)).join(", ")}.
          </p>
        )}
      </Block>

      <Block icon={<Ban size={17} className="text-red-600" />} title="Sites you never want" help={HELP.blocked}>
        <Chips values={p.blockedDomains ?? []} onChange={(v) => sites("blockedDomains", v)} placeholder="Add a site to block" tone="bad" />
      </Block>

      <div className="grid gap-6 lg:grid-cols-2">
        <Block icon={<SquarePlay size={17} />} title="YouTube">
          <Switch checked={p.youtube} onChange={(v) => onPatch({ youtube: v }).then(() => onToast(v ? "It will look for new videos" : "No more YouTube searches"))} label="Find new videos on YouTube" help={HELP.youtube} />
          <p className="mb-2 mt-5 text-sm font-semibold">Channels you follow</p>
          <p className="mb-2 text-sm text-stone-500">Their new videos are always read, even with the search above off.</p>
          <ChannelList
            channels={channels}
            onAdd={(url) => call(`/api/newsletters/${id}/subscriptions`, { method: "POST", body: JSON.stringify({ url, kind: "feed" }) }, "Channel followed")}
            onRemove={(s) => call(`/api/newsletters/${id}/subscriptions/${s.id}`, { method: "DELETE" }, `Stopped following ${s.name}`)}
          />
        </Block>

        <div className="space-y-6">
          <Block icon={<MessagesSquare size={17} />} title="Reddit communities" help={HELP.subreddits}>
            <Chips values={p.subreddits} onChange={(v) => onPatch({ subreddits: v })} placeholder="Add a subreddit" prefix="r/" />
          </Block>
          <Block icon={<Users size={17} />} title="Names to watch" help={HELP.watchlist}>
            <Chips values={p.watchlist ?? []} onChange={(v) => onPatch({ watchlist: v })} placeholder="A company, product or creator" split="comma" />
          </Block>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ComingSoon icon={<Mail size={17} />} title="Other newsletters" on={data?.features.newsletters}>
          Subscribe to the newsletters you already read with this newsletter&apos;s own address. Seven newsletters about the same launch become one story,
          that says who else covered it.
          {data?.features.newsletters && <code className="mt-3 block truncate rounded-lg border border-rule bg-paper px-3 py-2 text-sm">{data.inboxAddress}</code>}
        </ComingSoon>
        <ComingSoon icon={<Mic size={17} />} title="Podcasts" on={data?.features.podcasts}>
          Follow your podcasts. Each episode is read from its transcript, and what the hosts discussed is merged with everything else, so a launch
          talked about on three shows is told once.
        </ComingSoon>
      </div>

      {latest.length > 0 && (
        <details className="rounded-2xl border border-rule bg-sheet p-6">
          <summary className="cursor-pointer font-semibold">Latest from what you follow</summary>
          <ul className="mt-3 divide-y divide-rule">
            {latest.map((it) => (
              <li key={it.id} className="py-2.5 text-[15px]">
                <Link href={`/inbox/${it.id}`} className="hover:underline">{it.title}</Link>
                <span className="text-sm text-stone-500"> · {it.sourceName}, {shortDate(it.publishedAt)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

    </div>
  );
}

function Block({ icon, title, help, children }: { icon: ReactNode; title: string; help?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-rule bg-sheet p-6">
      <h3 className="mb-3 flex items-center gap-2 font-semibold">{icon}{help ? <Tip text={help}>{title}</Tip> : title}</h3>
      {children}
    </section>
  );
}

function ComingSoon({ icon, title, on, children }: { icon: ReactNode; title: string; on?: boolean; children: ReactNode }) {
  return (
    <section className={`rounded-2xl border border-dashed border-rule p-6 ${on ? "bg-sheet" : "bg-transparent"}`}>
      <h3 className="flex items-center gap-2 font-semibold text-stone-600 dark:text-stone-400">
        {icon}{title}
        {!on && <span className="rounded-full bg-stamp-soft px-2.5 py-0.5 text-xs font-semibold text-stamp">Coming soon</span>}
      </h3>
      <div className="mt-2 text-[15px] leading-relaxed text-stone-500">{children}</div>
    </section>
  );
}

function ChannelList({ channels, onAdd, onRemove }: { channels: Subscription[]; onAdd: (url: string) => Promise<boolean | void>; onRemove: (s: Subscription) => Promise<boolean | void> }) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  async function add() {
    setBusy(true);
    const raw = url.trim();
    const ok = await onAdd(raw.startsWith("@") ? `https://www.youtube.com/${raw}` : raw);
    setBusy(false);
    if (ok) setUrl("");
  }
  return (
    <div>
      {channels.length > 0 && (
        <ul className="mb-2 space-y-1.5">
          {channels.map((c) => (
            <li key={c.id} className="flex items-center gap-2 rounded-lg border border-rule px-3 py-2">
              <SquarePlay size={15} className="shrink-0 text-red-600" />
              <span className="min-w-0 flex-1 truncate text-[15px]">{c.name}</span>
              <button onClick={() => onRemove(c)} aria-label={`Stop following ${c.name}`} className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-400 hover:bg-stone-100 hover:text-ink dark:hover:bg-stone-800"><X size={15} /></button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={(e) => { e.preventDefault(); if (url.trim() && !busy) add(); }} className="flex gap-2">
        <input className={field} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="@mkbhd or a channel link" />
        <button type="submit" disabled={!url.trim() || busy} aria-label="Follow channel" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-rule text-stone-500 hover:text-ink disabled:opacity-30">
          {busy ? <ChevronDown size={16} className="animate-spin" /> : <Plus size={16} />}
        </button>
      </form>
    </div>
  );
}
