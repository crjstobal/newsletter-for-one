"use client";

import { Ban, Check, ExternalLink, MoreHorizontal, ShieldCheck, ThumbsDown, ThumbsUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Story } from "@/lib/core/types";

type Vote = "up" | "down";

/**
 * Reader feedback on one story. A vote is sent as soon as it's clicked; a reason can follow.
 * Kept visually separate from source management (SourceMenu), which is about sites, not stories.
 */
export function StoryFeedback({ story, onVote }: { story: Story; onVote: (vote: Vote, note?: string) => Promise<void> }) {
  const [vote, setVote] = useState<Vote | undefined>(story.feedback);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [noteSent, setNoteSent] = useState(false);

  async function cast(v: Vote) {
    if (busy || vote === v) return;
    setVote(v);
    setBusy(true);
    await onVote(v);
    setBusy(false);
  }

  async function sendNote() {
    if (!vote || !note.trim()) return;
    setBusy(true);
    await onVote(vote, note.trim());
    setBusy(false);
    setNoteSent(true);
  }

  const btn = (v: Vote, Icon: typeof ThumbsUp, label: string) => (
    <button
      onClick={() => cast(v)}
      disabled={busy}
      aria-pressed={vote === v}
      aria-label={label}
      title={label}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-full border transition-colors disabled:cursor-wait ${
        vote === v ? "border-ink bg-ink text-paper" : "border-rule text-stone-500 hover:border-stone-400 hover:text-ink"
      }`}
    >
      <Icon size={17} strokeWidth={2} />
    </button>
  );

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-sm text-stone-500">{vote ? (busy ? "Learning…" : vote === "up" ? "Marked useful" : "Marked not useful") : "Useful?"}</span>
      {btn("up", ThumbsUp, "Useful")}
      {btn("down", ThumbsDown, "Not useful")}
      {vote && !busy && !noteSent && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendNote();
          }}
          className="flex min-w-60 flex-1 items-center gap-2"
        >
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Why? A few words teach it more"
            className="h-10 flex-1 rounded-full border border-rule bg-transparent px-4 text-sm outline-none focus:border-stamp"
          />
          {note.trim() && (
            <button type="submit" className="btn btn-secondary !min-h-10 !rounded-full !px-4 text-sm">Send</button>
          )}
        </form>
      )}
      {noteSent && (
        <span className="inline-flex items-center gap-1 text-sm text-stone-500"><Check size={15} /> Reason noted</span>
      )}
    </div>
  );
}

/** Actions about the site a story came from. Neutral styling: this is not a rating. */
export function SourceMenu({ story, onDomain }: { story: Story; onDomain: (domain: string, list: "domains" | "blockedDomains") => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const item = "flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm hover:bg-stone-100 dark:hover:bg-stone-800";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={`Options for ${story.source}`}
        aria-expanded={open}
        className="inline-flex h-10 w-10 items-center justify-center rounded-full text-stone-500 hover:bg-stone-100 hover:text-ink dark:hover:bg-stone-800"
      >
        <MoreHorizontal size={18} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-64 overflow-hidden rounded-xl border border-rule bg-sheet py-1 shadow-[0_18px_40px_-18px_rgba(22,24,29,0.4)]">
          <p className="px-3.5 pb-1.5 pt-2 text-xs text-stone-500">{story.source}</p>
          <a href={story.url} target="_blank" rel="noreferrer" className={item}><ExternalLink size={15} /> Open the source</a>
          <button onClick={() => { onDomain(story.source, "domains"); setOpen(false); }} className={item}><ShieldCheck size={15} /> Trust this site: search it every issue</button>
          <button onClick={() => { onDomain(story.source, "blockedDomains"); setOpen(false); }} className={`${item} text-red-700 dark:text-red-400`}><Ban size={15} /> Never use this site</button>
        </div>
      )}
    </div>
  );
}
