"use client";

import { ChevronDown, Eye, Minus, Plus, Sparkles, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { normalizeStyle, type Delivery, type Newsletter, type Profile, type ReaderMemory, type Style } from "@/lib/core/types";
import { StylePicker } from "./StylePicker";
import { DAY_NAMES, deliveryOf } from "@/lib/core/schedule";
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
  onboarding,
  renderActions,
  onDelete,
}: {
  onDelete?: () => Promise<void>;
  newsletter: Newsletter;
  /** Setting up a new newsletter: nothing learned yet, so no Memory section. */
  onboarding?: boolean;
  /** Replaces the floating save bar (the setup flow saves on "Next"). */
  renderActions?: (save: () => Promise<void>, dirty: boolean, saving: boolean) => ReactNode;
  onSave: (profile: Partial<Profile>, memory: MemoryPatch, delivery: Delivery) => Promise<void>;
}) {
  const initial = { ...newsletter.profile, blockedDomains: newsletter.profile.blockedDomains ?? [], style: normalizeStyle(newsletter.profile.style) };
  const initialDelivery = deliveryOf(newsletter);
  const [delivery, setDelivery] = useState<Delivery>(initialDelivery);
  const initialMemory: MemoryPatch = {
    likes: newsletter.memory.likes,
    dislikes: newsletter.memory.dislikes,
    notes: newsletter.memory.notes,
    covered: newsletter.memory.covered,
  };
  const [p, setP] = useState<Profile>(initial);
  const [mem, setMem] = useState<MemoryPatch>(initialMemory);
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(p) !== JSON.stringify(initial) || JSON.stringify(mem) !== JSON.stringify(initialMemory) || JSON.stringify(delivery) !== JSON.stringify(initialDelivery);
  const style = normalizeStyle(p.style);
  const setStyle = (patch: Partial<Style>) => setP((x) => ({ ...x, style: { ...normalizeStyle(x.style), ...patch } }));
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
    await onSave(p, mem, delivery);
    setSaving(false);
  }

  const learnedCount = mem.likes.length + mem.dislikes.length;

  return (
    <div className="pb-28">
      <Section title="Name" text="What the newsletter is called. Everything else about it was drafted from your description.">
        <div className="max-w-md">
          <input className={field} value={p.name} onChange={(e) => set("name", e.target.value)} aria-label="Name" />
        </div>
      </Section>

      <Section title="Delivery" text="Which days and at what time an issue arrives, how long it is, and in which language. To stop for a while without losing anything, use Pause at the top.">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={`Days (${delivery.days.length} a week)`} help="Pick the days an issue arrives. Each issue covers everything since the previous one, so fewer days means fuller issues." wide>
            <DayPicker value={delivery.days} onChange={(days) => setDelivery((d) => ({ ...d, days }))} />
          </Field>
          <Field label="At">
            <div className="flex gap-2">
              <div className="relative w-28 shrink-0">
                <select className={`${field} appearance-none pr-9`} value={delivery.hour} onChange={(e) => setDelivery((d) => ({ ...d, hour: Number(e.target.value) }))} aria-label="Hour">
                  {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>)}
                </select>
                <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-stone-500" />
              </div>
              <div className="relative min-w-0 flex-1">
                <select className={`${field} appearance-none pr-9`} value={delivery.timezone} onChange={(e) => setDelivery((d) => ({ ...d, timezone: e.target.value }))} aria-label="Time zone">
                  {zones(delivery.timezone).map((z) => <option key={z} value={z}>{z.replace(/_/g, " ")}</option>)}
                </select>
                <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-stone-500" />
              </div>
            </div>
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

      <Section title="Style" text="How long each story is and how it sounds. Facts never change with the style: same sources, told differently.">
        <StylePicker style={style} onChange={setStyle} />
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Switch checked={style.jokes && style.preset !== "rundown"} onChange={(v) => setStyle({ jokes: v })} label="A joke per story" help="One short, good-natured line under each story. It never adds facts. Not with Rundown." />
          <Switch checked={style.mindMap} onChange={(v) => setStyle({ mindMap: v })} label="Mind map of the issue" help="Stories grouped by theme in a map at the top of the issue." />
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

      {!onboarding && <Section title="Memory" text="What is kept between issues. Stories already sent are never repeated, even when another site covers the same news." last>
        <Field label="Notes about you">
          <textarea
            className={`${field} h-auto min-h-24 py-2.5 leading-relaxed`}
            value={mem.notes}
            placeholder="Nothing yet. Notes appear here as it learns from your votes."
            onChange={(e) => setMem((m) => ({ ...m, notes: e.target.value }))}
          />
        </Field>
        <ReadingSignals reads={newsletter.memory.reads ?? []} />
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
      </Section>}

      {!onboarding && onDelete && <DangerZone name={newsletter.profile.name} onDelete={onDelete} />}

      {renderActions?.(save, dirty, saving)}

      {/* Save bar: only when something changed */}
      {!renderActions && dirty && (
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

export function Switch({ checked, onChange, label, help }: { checked: boolean; onChange: (v: boolean) => void; label: string; help?: string }) {
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

export function Chips({ values, onChange, placeholder, tone, prefix = "", split = "space" }: { values: string[]; onChange: (v: string[]) => void; placeholder: string; tone?: "good" | "bad"; prefix?: string; split?: "space" | "comma" }) {
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


function DayPicker({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  // Monday first, as most of the world reads a week.
  const order = [1, 2, 3, 4, 5, 6, 0];
  const toggle = (d: number) => {
    const next = value.includes(d) ? value.filter((x) => x !== d) : [...value, d];
    if (next.length) onChange(next.sort());
  };
  const quick: [string, number[]][] = [["Every day", [0, 1, 2, 3, 4, 5, 6]], ["Weekdays", [1, 2, 3, 4, 5]], ["3 a week", [1, 3, 5]], ["Weekly", [1]], ["Weekend read", [6]]];
  return (
    <div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Delivery days">
        {order.map((d) => (
          <button
            key={d}
            aria-pressed={value.includes(d)}
            onClick={() => toggle(d)}
            className={`h-11 w-14 rounded-lg border text-[15px] font-medium transition-colors ${value.includes(d) ? "border-stamp bg-stamp text-white" : "border-rule bg-paper text-stone-600 hover:border-stone-400 dark:text-stone-400"}`}
          >
            {DAY_NAMES[d]}
          </button>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {quick.map(([label, days]) => (
          <button key={label} onClick={() => onChange(days)} className="rounded-full border border-rule px-2.5 py-0.5 text-xs text-stone-600 hover:border-stone-400 dark:text-stone-400">{label}</button>
        ))}
      </div>
    </div>
  );
}

const COMMON_ZONES = ["Europe/Madrid", "Europe/London", "Europe/Athens", "Europe/Berlin", "America/New_York", "America/Chicago", "America/Los_Angeles", "America/Mexico_City", "America/Sao_Paulo", "Asia/Tokyo", "Asia/Singapore", "Australia/Sydney", "UTC"];
function zones(current: string) {
  let local = "";
  try {
    local = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    // no browser time zone
  }
  return [...new Set([current, local, ...COMMON_ZONES].filter(Boolean))];
}

/** What the reader opens, from clicks on story links. Read-only: it updates itself. */
function ReadingSignals({ reads }: { reads: NonNullable<ReaderMemory["reads"]> }) {
  const themes = reads.filter((r) => r.by === "theme");
  const pubs = reads.filter((r) => r.by === "publisher");
  return (
    <div className="mt-7">
      <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
        <Eye size={15} />
        <Tip text="Counted from the stories you open (links go through a short redirect that records the click). The planner and the editor read this every issue: more searches where you read, fewer where you never do. It is weaker evidence than your votes.">
          What you actually read
        </Tip>
      </div>
      {reads.length ? (
        <div className="grid gap-5 sm:grid-cols-2">
          {[["By theme", themes], ["By source", pubs]].map(([label, rows]) => (
            <div key={label as string}>
              <p className="mb-1.5 text-xs text-stone-500">{label as string}</p>
              <ul className="space-y-1.5">
                {(rows as typeof reads).slice(0, 6).map((r) => (
                  <li key={r.name} className="grid grid-cols-[1fr_96px_44px] items-center gap-3 text-[15px]">
                    <span className="truncate">{r.name}</span>
                    <span className="h-1.5 overflow-hidden rounded-full bg-stone-100 dark:bg-stone-800"><span className="block h-full rounded-full bg-stamp" style={{ width: `${(r.opened / r.shown) * 100}%` }} /></span>
                    <span className="text-right text-sm tabular-nums text-stone-500">{r.opened}/{r.shown}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[15px] text-stone-500">Nothing yet. Open a few stories and it starts learning what you read.</p>
      )}
    </div>
  );
}

/** Deleting is permanent, so it takes two clicks and says what goes with it. */
function DangerZone({ name, onDelete }: { name: string; onDelete: () => Promise<void> }) {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <section className="mt-4 rounded-2xl border border-red-300 p-6 dark:border-red-900">
      <h3 className="text-lg font-bold text-red-700 dark:text-red-400">Danger zone</h3>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-xl text-[15px] text-stone-600 dark:text-stone-400">
          Delete &ldquo;{name}&rdquo; with all its issues, what it learned about you and the sources you follow. This cannot be undone.
          To stop it for a while instead, use Pause.
        </p>
        {!armed ? (
          <button onClick={() => setArmed(true)} className="btn border border-red-300 text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950">Delete this newsletter</button>
        ) : (
          <div className="flex gap-2">
            <button onClick={() => setArmed(false)} disabled={busy} className="btn btn-secondary">Keep it</button>
            <button
              onClick={async () => { setBusy(true); await onDelete(); }}
              disabled={busy}
              className="btn bg-red-600 text-white hover:bg-red-700"
            >
              {busy ? "Deleting…" : "Yes, delete it forever"}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
