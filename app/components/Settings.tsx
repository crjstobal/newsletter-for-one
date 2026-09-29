"use client";

import { Ban, ChevronDown, Minus, Plus, ShieldCheck, Sparkles, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { Newsletter, Profile, ReaderMemory } from "@/lib/core/types";
import { HELP } from "./glossary";
import { Tip } from "./ui";
import { LANGUAGES } from "./examples";

const field =
  "h-11 w-full rounded-lg border border-rule bg-paper px-3.5 text-[15px] outline-none transition-colors focus:border-stamp focus:ring-2 focus:ring-stamp/20";

type Item = { text: string; learned: boolean };
type MemoryPatch = Pick<ReaderMemory, "likes" | "dislikes" | "notes" | "covered">;

const merge = (mine: string[], learned: string[]): Item[] => [
  ...mine.map((text) => ({ text, learned: false })),
  ...learned.map((text) => ({ text, learned: true })),
];
const split = (items: Item[]) => ({
  mine: items.filter((i) => !i.learned).map((i) => i.text.trim()).filter(Boolean),
  learned: items.filter((i) => i.learned).map((i) => i.text.trim()).filter(Boolean),
});

export function Settings({
  newsletter,
  onSave,
  onAutoIssues,
}: {
  newsletter: Newsletter;
  onSave: (profile: Partial<Profile>, memory: MemoryPatch) => Promise<void>;
  onAutoIssues: (on: boolean) => Promise<void>;
}) {
  const initial = { ...newsletter.profile, blockedDomains: newsletter.profile.blockedDomains ?? [] };
  const initialMemory: MemoryPatch = {
    likes: newsletter.memory.likes,
    dislikes: newsletter.memory.dislikes,
    notes: newsletter.memory.notes,
    covered: newsletter.memory.covered,
  };
  const [p, setP] = useState<Profile>(initial);
  const [mem, setMem] = useState<MemoryPatch>(initialMemory);
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(p) !== JSON.stringify(initial) || JSON.stringify(mem) !== JSON.stringify(initialMemory);
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setP((x) => ({ ...x, [k]: v }));

  const cover = merge(p.mustCover, mem.likes);
  const skip = merge(p.avoid, mem.dislikes);
  const setCover = (items: Item[]) => {
    const { mine, learned } = split(items);
    setP((x) => ({ ...x, mustCover: mine }));
    setMem((m) => ({ ...m, likes: learned }));
  };
  const setSkip = (items: Item[]) => {
    const { mine, learned } = split(items);
    setP((x) => ({ ...x, avoid: mine }));
    setMem((m) => ({ ...m, dislikes: learned }));
  };

  async function save() {
    setSaving(true);
    await onSave(p, mem);
    setSaving(false);
  }

  const learnedCount = mem.likes.length + mem.dislikes.length;

  return (
    <div className="pb-28">
      <Section title="Basics" text="What the newsletter is and who it's for. Drafted from your description.">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Name"><input className={field} value={p.name} onChange={(e) => set("name", e.target.value)} /></Field>
          <Field label="Written for"><input className={field} value={p.audience} onChange={(e) => set("audience", e.target.value)} /></Field>
          <Field label="Topic" wide><input className={field} value={p.topic} onChange={(e) => set("topic", e.target.value)} /></Field>
          <Field label="Tone" wide><input className={field} value={p.tone} onChange={(e) => set("tone", e.target.value)} /></Field>
        </div>
      </Section>

      <Section title="Delivery" text="How often an issue is written, how long it is, and in which language.">
        <div className="mb-6 rounded-lg bg-paper p-4">
          <Switch
            checked={Boolean(newsletter.autoIssues)}
            onChange={(v) => onAutoIssues(v)}
            label="Write issues automatically"
            help="When on, the scheduled worker writes the next issue when it's due (every day or every week, from the last issue). It counts towards the daily spending cap like everything else. Saved immediately."
          />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="How often">
            <Segmented
              value={p.cadence}
              options={[["weekly", "Weekly"], ["daily", "Daily"]]}
              onChange={(v) => set("cadence", v as Profile["cadence"])}
            />
          </Field>
          <Field label="Stories per issue" help={HELP.storyCount}>
            <Stepper value={p.storyCount} min={1} max={10} onChange={(v) => set("storyCount", v)} />
          </Field>
          <Field label="Written in">
            <div className="relative">
              <select className={`${field} appearance-none pr-10`} value={p.language} onChange={(e) => set("language", e.target.value)}>
                {LANGUAGES.map(([c, l]) => <option key={c} value={c}>{l}</option>)}
              </select>
              <ChevronDown size={16} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-500" />
            </div>
          </Field>
          <Field label="Searches in" help={HELP.searchLanguages}>
            <Chips values={p.searchLanguages ?? ["en"]} onChange={(v) => set("searchLanguages", v)} placeholder="Add a language code, e.g. es" />
          </Field>
        </div>
      </Section>

      <Section
        title="Coverage"
        text={`What you want and what wastes your time. The planner, the scorer and the editor all read this.${learnedCount ? ` Items marked "learned" come from your votes on stories; edit or remove them like any other.` : ""}`}
      >
        <div className="grid gap-7 lg:grid-cols-2">
          <Field label="Cover" help={HELP.mustCover}>
            <ListEditor values={cover} onChange={setCover} placeholder="Add something to cover" />
          </Field>
          <Field label="Skip" help={HELP.avoid}>
            <ListEditor values={skip} onChange={setSkip} placeholder="Add something to skip" />
          </Field>
        </div>
      </Section>

      <Section title="Sources" text="Where it looks. Sites you trust get their own search every issue; blocked sites are never used.">
        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="Watchlist" help={HELP.watchlist} wide>
            <Chips values={p.watchlist ?? []} onChange={(v) => set("watchlist", v)} placeholder="Add a company, product or creator" split="comma" />
          </Field>
          <Field label="Subject in a few words" help={HELP.coreQuery}>
            <input className={field} value={p.coreQuery ?? ""} onChange={(e) => set("coreQuery", e.target.value)} placeholder={p.name} />
          </Field>
          <div className="hidden sm:block" />
          <Field label="Trusted sites" help={HELP.preferred} icon={<ShieldCheck size={15} className="text-fresh" />}>
            <Chips values={p.domains} onChange={(v) => set("domains", v)} placeholder="Add a site, e.g. apple.com" tone="good" />
          </Field>
          <Field label="Blocked sites" help={HELP.blocked} icon={<Ban size={15} className="text-red-600" />}>
            <Chips values={p.blockedDomains} onChange={(v) => set("blockedDomains", v)} placeholder="Add a site to block" tone="bad" />
          </Field>
          <Field label="Reddit communities" help={HELP.subreddits}>
            <Chips values={p.subreddits} onChange={(v) => set("subreddits", v)} placeholder="Add a subreddit" prefix="r/" />
          </Field>
          <div className="space-y-4 sm:pt-7">
            <Switch checked={p.youtube} onChange={(v) => set("youtube", v)} label="Look for new YouTube videos" help={HELP.youtube} />
            <Switch checked={Boolean(p.allowUndated)} onChange={(v) => set("allowUndated", v)} label="Keep results without a verifiable date" help={HELP.allowUndated} />
          </div>
        </div>
      </Section>

      <Section title="Memory" text="What is kept between issues. Stories already sent are never repeated, even when another site covers the same news." last>
        <Field label="Notes about you">
          <textarea
            className={`${field} h-auto min-h-24 py-2.5 leading-relaxed`}
            value={mem.notes}
            placeholder="Nothing yet. Notes appear here as it learns from your votes."
            onChange={(e) => setMem((m) => ({ ...m, notes: e.target.value }))}
          />
        </Field>
        <div className="mt-7">
          <div className="mb-2 text-sm font-semibold">
            <Tip text="Every story you received. Before writing an issue, Nemotron compares new results against all of these and drops the same news. Forget one to allow it again.">
              Already sent ({mem.covered.length})
            </Tip>
          </div>
          {mem.covered.length ? (
            <ul className="max-h-80 divide-y divide-rule overflow-y-auto rounded-lg border border-rule">
              {[...mem.covered].reverse().map((c) => (
                <li key={c.key} className="flex items-center gap-3 px-3.5 py-2.5 text-[15px]">
                  <span className="w-24 shrink-0 text-sm tabular-nums text-stone-500">{c.date}</span>
                  <span className="min-w-0 flex-1 truncate" title={c.headline}>{c.headline}</span>
                  <button
                    onClick={() => setMem((m) => ({ ...m, covered: m.covered.filter((x) => x.key !== c.key) }))}
                    aria-label={`Forget ${c.headline}`}
                    title="Forget: this news may be sent again"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-stone-400 hover:bg-stone-100 hover:text-ink dark:hover:bg-stone-800"
                  >
                    <X size={15} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[15px] text-stone-500">No stories sent yet.</p>
          )}
        </div>
        <p className="mt-8 text-sm text-stone-500">Your original description: &ldquo;{newsletter.description}&rdquo;</p>
      </Section>

      {/* Save bar: only when something changed */}
      {dirty && (
        <div className="fixed inset-x-0 bottom-5 z-40 flex justify-center px-4">
          <div className="flex items-center gap-3 rounded-full border border-rule bg-sheet py-2 pl-5 pr-2 shadow-[0_18px_40px_-16px_rgba(22,24,29,0.45)]">
            <span className="text-sm">You have unsaved changes</span>
            <button onClick={() => { setP(initial); setMem(initialMemory); }} className="btn btn-secondary !min-h-10 !rounded-full">Discard</button>
            <button onClick={save} disabled={saving} className="btn btn-primary !min-h-10 !rounded-full">{saving ? "Saving…" : "Save changes"}</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, text, children, last }: { title: string; text: string; children: ReactNode; last?: boolean }) {
  return (
    <section className={`grid gap-6 py-10 md:grid-cols-[240px_1fr] md:gap-12 ${last ? "" : "border-b border-rule"}`}>
      <div>
        <h3 className="text-lg font-bold">{title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-stone-600 dark:text-stone-400">{text}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

function Field({ label, help, wide, icon, children }: { label: string; help?: string; wide?: boolean; icon?: ReactNode; children: ReactNode }) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
        {icon}
        {help ? <Tip text={help}>{label}</Tip> : label}
      </div>
      {children}
    </div>
  );
}

function Segmented({ value, options, onChange }: { value: string; options: [string, string][]; onChange: (v: string) => void }) {
  return (
    <div role="radiogroup" className="inline-flex h-11 rounded-lg border border-rule bg-paper p-1">
      {options.map(([v, label]) => (
        <button
          key={v}
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={`rounded-md px-5 text-[15px] font-medium transition-colors ${value === v ? "bg-sheet text-ink shadow-sm ring-1 ring-rule" : "text-stone-500 hover:text-ink"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function Stepper({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (v: number) => void }) {
  const b = "flex h-11 w-11 items-center justify-center text-stone-600 hover:text-ink disabled:opacity-30 dark:text-stone-400";
  return (
    <div className="inline-flex items-center rounded-lg border border-rule bg-paper">
      <button onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label="Fewer stories" className={b}><Minus size={16} /></button>
      <span className="w-10 text-center text-[15px] font-semibold tabular-nums">{value}</span>
      <button onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label="More stories" className={b}><Plus size={16} /></button>
    </div>
  );
}

function Switch({ checked, onChange, label, help }: { checked: boolean; onChange: (v: boolean) => void; label: string; help?: string }) {
  return (
    <div className="flex items-center gap-3">
      <button
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? "bg-stamp" : "bg-stone-300 dark:bg-stone-700"}`}
      >
        <span className={`absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-[22px]" : "translate-x-0.5"}`} />
      </button>
      <span className="text-[15px]">{help ? <Tip text={help}>{label}</Tip> : label}</span>
    </div>
  );
}

function ListEditor({ values, onChange, placeholder }: { values: Item[]; onChange: (v: Item[]) => void; placeholder: string }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    if (!draft.trim()) return;
    const mine = values.filter((v) => !v.learned);
    onChange([...mine, { text: draft.trim(), learned: false }, ...values.filter((v) => v.learned)]);
    setDraft("");
  };
  return (
    <ul className="space-y-2">
      {values.map((v, i) => (
        <li key={i} className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              className={`${field} bg-sheet ${v.learned ? "pr-24" : ""}`}
              value={v.text}
              onChange={(e) => onChange(values.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
            />
            {v.learned && (
              <span title="Learned from your votes on stories" className="pointer-events-none absolute right-2 top-1/2 inline-flex -translate-y-1/2 items-center gap-1 rounded-full bg-stamp-soft px-2 py-0.5 text-xs font-medium text-stamp">
                <Sparkles size={12} /> learned
              </span>
            )}
          </div>
          <button onClick={() => onChange(values.filter((_, j) => j !== i))} aria-label={`Remove ${v.text}`} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-stone-400 hover:bg-stone-100 hover:text-ink dark:hover:bg-stone-800">
            <X size={16} />
          </button>
        </li>
      ))}
      <li className="flex items-center gap-2">
        <input
          className={`${field} border-dashed`}
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <button onClick={add} disabled={!draft.trim()} aria-label="Add" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-rule text-stone-500 hover:text-ink disabled:opacity-30">
          <Plus size={16} />
        </button>
      </li>
    </ul>
  );
}

function Chips({ values, onChange, placeholder, tone, prefix = "", split = "space" }: { values: string[]; onChange: (v: string[]) => void; placeholder: string; tone?: "good" | "bad"; prefix?: string; split?: "space" | "comma" }) {
  const [draft, setDraft] = useState("");
  const cls =
    tone === "good" ? "bg-fresh/10 text-fresh" :
    tone === "bad" ? "bg-red-500/10 text-red-700 dark:text-red-400" :
    "bg-stone-100 text-ink dark:bg-stone-800";
  const add = () => {
    // Names like "Pixel Film Studios" contain spaces, so the watchlist only splits on commas.
    const parts = draft.split(split === "comma" ? /,+/ : /[,\s]+/).map((s) => s.trim().replace(/^r\//, "")).filter(Boolean);
    if (parts.length) onChange([...new Set([...values, ...parts])]);
    setDraft("");
  };
  return (
    <div className="flex min-h-11 flex-wrap items-center gap-1.5 rounded-lg border border-rule bg-paper p-1.5 focus-within:border-stamp focus-within:ring-2 focus-within:ring-stamp/20">
      {values.map((v) => (
        <span key={v} className={`inline-flex h-8 items-center gap-1 rounded-md pl-2.5 pr-1 text-sm font-medium ${cls}`}>
          {prefix}{v}
          <button onClick={() => onChange(values.filter((x) => x !== v))} aria-label={`Remove ${v}`} className="flex h-6 w-6 items-center justify-center rounded opacity-60 hover:opacity-100">
            <X size={13} />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add();
          }
        }}
        onBlur={add}
        placeholder={placeholder}
        className="h-8 min-w-40 flex-1 bg-transparent px-1.5 text-sm outline-none"
      />
    </div>
  );
}
