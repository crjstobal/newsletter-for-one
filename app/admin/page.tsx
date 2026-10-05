import { SchedulePanel } from "../components/SchedulePanel";

export const metadata = { title: "Spending and schedule | Newsletter for One" };

/** Operator view: today's spend against the daily cap, and what the scheduled worker will write. */
export default function Admin() {
  return (
    <main className="mx-auto max-w-6xl px-5 py-12">
      <h1 className="text-3xl font-extrabold tracking-tight">Spending and schedule</h1>
      <p className="mt-2 text-stone-600 dark:text-stone-400">Not part of the reader&apos;s product: what the whole app spent today and what is due.</p>
      <div className="mt-8"><SchedulePanel /></div>
    </main>
  );
}
