import type { Delivery, Newsletter } from "./types";

/**
 * When issues are due. A newsletter is delivered on chosen days of the week at a chosen hour
 * in the reader's time zone, at most one issue per day. Pure functions: the worker, the API and
 * the pipeline (to size the search window) all use them.
 */

export const DEFAULT_TZ = "Europe/Madrid";
export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** Newsletters created before delivery settings existed keep behaving like their cadence. */
export function deliveryOf(nl: Pick<Newsletter, "delivery" | "profile">): Delivery {
  if (nl.delivery?.days?.length) return nl.delivery;
  return nl.profile.cadence === "daily"
    ? { days: [0, 1, 2, 3, 4, 5, 6], hour: 8, timezone: DEFAULT_TZ }
    : { days: [1], hour: 8, timezone: DEFAULT_TZ };
}

/** Accepts only sane values; anything else falls back to Monday 08:00 Madrid. */
export function cleanDelivery(d: Partial<Delivery>): Delivery {
  const days = [...new Set((d.days ?? []).map(Number).filter((x) => Number.isInteger(x) && x >= 0 && x <= 6))].sort();
  const hour = Number.isInteger(Number(d.hour)) ? Math.min(23, Math.max(0, Number(d.hour))) : 8;
  let timezone = DEFAULT_TZ;
  try {
    if (d.timezone) {
      new Intl.DateTimeFormat("en-US", { timeZone: d.timezone });
      timezone = d.timezone;
    }
  } catch {
    // unknown time zone: keep the default
  }
  return { days: days.length ? days : [1], hour, timezone };
}

/** Longest gap between two deliveries, in days: how far back the first issue should search. */
export function gapDays(d: Delivery): number {
  const days = [...d.days].sort();
  if (days.length === 1) return 7;
  let gap = 0;
  for (let i = 0; i < days.length; i++) gap = Math.max(gap, ((days[(i + 1) % days.length] - days[i] + 7) % 7) || 7);
  return gap;
}

/** Issues per week, for labels. */
export const perWeek = (d: Delivery) => d.days.length;

/** YYYY-MM-DD in a time zone. */
export function dateIn(tz: string, at = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
}

function offsetMs(tz: string, at: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return asUtc - at.getTime();
}

/** The instant of `hour`:00 on `date` (YYYY-MM-DD) in `tz`. */
export function slotAt(date: string, hour: number, tz: string): Date {
  const guess = new Date(`${date}T${String(hour).padStart(2, "0")}:00:00Z`);
  return new Date(guess.getTime() - offsetMs(tz, guess));
}

const addDays = (date: string, n: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const weekday = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();

/**
 * The next delivery slot. After an issue: the first delivery day strictly after it. Before
 * the first issue: the first delivery day from today (today's slot may already be past: due).
 */
export function nextSlot(nl: Pick<Newsletter, "delivery" | "profile" | "lastIssueDate">, now = new Date()): Date {
  const d = deliveryOf(nl);
  const today = dateIn(d.timezone, now);
  let day = nl.lastIssueDate ? addDays(nl.lastIssueDate, 1) : today;
  for (let i = 0; i < 8 && !d.days.includes(weekday(day)); i++) day = addDays(day, 1);
  return slotAt(day, d.hour, d.timezone);
}

export const isPaused = (nl: Pick<Newsletter, "pausedAt" | "pausedUntil">, now = new Date()) =>
  Boolean(nl.pausedAt) && !(nl.pausedUntil && nl.pausedUntil <= dateIn(DEFAULT_TZ, now));

/** Due: automatic, not paused, and its next slot has arrived. */
export const isDue = (nl: Newsletter, now = new Date()) =>
  Boolean(nl.autoIssues) && !isPaused(nl, now) && nextSlot(nl, now).getTime() <= now.getTime();

/** "Mon, Wed, Fri at 08:00" */
export function describeDelivery(d: Delivery) {
  const days = d.days.length === 7 ? "Every day" : d.days.length === 5 && !d.days.includes(0) && !d.days.includes(6) ? "Weekdays" : d.days.map((x) => DAY_NAMES[x]).join(", ");
  return `${days} at ${String(d.hour).padStart(2, "0")}:00`;
}

export { addDays };
