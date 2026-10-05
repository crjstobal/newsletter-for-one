"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { useState } from "react";

type Plan = {
  name: string;
  monthly: number;
  pitch: string;
  features: string[];
  cta: string;
  featured?: boolean;
};

const PLANS: Plan[] = [
  {
    name: "Starter",
    monthly: 4,
    pitch: "One newsletter you actually read. Less than a coffee a month.",
    features: ["1 newsletter", "Weekly", "Up to 5 stories per issue", "Up to 10 sources you choose", "Never the same news twice", "Pause any time"],
    cta: "Start free",
  },
  {
    name: "Plus",
    monthly: 15,
    pitch: "Replace the pile of newsletters you never finish.",
    features: ["3 newsletters", "Up to 3 issues a week each", "Up to 8 stories per issue", "Up to 25 sources, YouTube channels included", "Every length and voice, jokes and mind map", "Learns from what you open"],
    cta: "Start free",
    featured: true,
  },
  {
    name: "Advanced",
    monthly: 39,
    pitch: "For people whose work depends on knowing first.",
    features: ["5 newsletters", "Every day, weekends included", "Up to 10 stories per issue", "Unlimited sources", "Everything in Plus", "Written at the hour you pick"],
    cta: "Start free",
  },
  {
    name: "Max",
    monthly: 129,
    pitch: "Every beat you follow, covered daily.",
    features: ["20 newsletters", "Every day, weekends included", "Up to 10 stories per issue", "Unlimited sources", "Everything in Advanced", "First access to new features"],
    cta: "Start free",
  },
];

/** Yearly billing: two months free. */
const yearlyPerMonth = (m: number) => Math.round(((m * 10) / 12) * 100) / 100;

export function PricingPlans() {
  const [yearly, setYearly] = useState(true);
  return (
    <>
      <div className="mt-8 flex justify-center">
        <div role="radiogroup" aria-label="Billing" className="inline-flex h-11 items-center rounded-full border border-rule bg-sheet p-1">
          {([[false, "Monthly"], [true, "Yearly"]] as const).map(([v, label]) => (
            <button key={label} role="radio" aria-checked={yearly === v} onClick={() => setYearly(v)} className={`h-9 rounded-full px-5 text-[15px] font-medium ${yearly === v ? "bg-ink text-paper" : "text-stone-500 hover:text-ink"}`}>
              {label}
              {v && <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-semibold ${yearly ? "bg-stamp text-white" : "bg-stamp-soft text-stamp"}`}>2 months free</span>}
            </button>
          ))}
        </div>
      </div>

      <ul className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {PLANS.map((p) => (
          <li key={p.name} className={`relative flex flex-col rounded-2xl border bg-sheet p-6 ${p.featured ? "border-stamp shadow-[0_24px_48px_-28px_rgba(91,63,196,0.55)] ring-1 ring-stamp" : "border-rule"}`}>
            {p.featured && <span className="absolute -top-3 left-6 rounded-full bg-stamp px-3 py-1 text-xs font-bold text-white">Most popular</span>}
            <h2 className="text-xl font-bold">{p.name}</h2>
            <p className="mt-1 min-h-[4.5rem] text-[15px] text-stone-600 dark:text-stone-400">{p.pitch}</p>
            <p className="mt-5">
              <span className="text-4xl font-extrabold tabular-nums tracking-tight">${yearly ? yearlyPerMonth(p.monthly).toFixed(2).replace(/\.00$/, "") : p.monthly}</span>
              <span className="text-stone-500"> / month</span>
            </p>
            <p className="mt-1 h-5 text-sm text-stone-500">{yearly ? `$${p.monthly * 10} billed yearly` : "Billed monthly"}</p>
            <ul className="mt-6 flex-1 space-y-2.5 text-[15px]">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-2.5"><Check size={17} className="mt-0.5 shrink-0 text-stamp" /> {f}</li>
              ))}
            </ul>
            <Link href="/newsletters/new" className={`btn mt-8 w-full justify-center ${p.featured ? "btn-primary" : "btn-secondary"}`}>
              {p.cta}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
