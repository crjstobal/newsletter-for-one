import Link from "next/link";
import { PricingPlans } from "../components/PricingPlans";

export const metadata = { title: "Pricing | Newsletter for One" };

const FAQ = [
  { q: "What does the free start include?", a: "Your first three issues, on any plan, with no card. You only pick a plan if you want to keep going." },
  { q: "What counts as a source?", a: "A site you trust, a YouTube channel or a community you add. It also searches the rest of the web for you every issue: that never counts against your limit." },
  { q: "What happens when I pause?", a: "Nothing is written or sent and nothing is lost. When you come back you choose: catch up on the best of what you missed, or start fresh." },
  { q: "Why not just read the newsletters I already have?", a: "Because seven of them will tell you about the same launch. Newsletter for One reads everything once, tells each piece of news once, and says who else covered it." },
];

export default function Pricing() {
  return (
    <main className="mx-auto max-w-6xl px-5 py-14">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">One newsletter, written for you. From $4.</h1>
        <p className="mt-4 text-lg text-stone-600 dark:text-stone-400">
          Your first three issues are free. No card, no setup call: pick a topic and read your first issue in minutes.
        </p>
        <p className="mt-4 inline-flex rounded-full bg-stamp-soft px-4 py-1.5 text-sm font-medium text-stamp">
          In beta: everything is free while we build checkout. Early readers keep their price.
        </p>
      </div>

      <PricingPlans />

      <section className="mx-auto mt-20 max-w-3xl">
        <h2 className="text-2xl font-bold">Questions</h2>
        <dl className="mt-6 divide-y divide-rule border-y border-rule">
          {FAQ.map((f) => (
            <div key={f.q} className="py-5">
              <dt className="font-semibold">{f.q}</dt>
              <dd className="mt-1.5 text-[15px] leading-relaxed text-stone-600 dark:text-stone-400">{f.a}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-8 text-center">
          <Link href="/newsletters/new" className="btn btn-primary btn-lg">Start your first newsletter</Link>
        </p>
      </section>
    </main>
  );
}
