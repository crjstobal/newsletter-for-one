import Link from "next/link";
import { connection } from "next/server";
import { store } from "@/lib/store";


export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-sans text-lg font-extrabold leading-none tracking-tight ${className}`}>
      <span aria-hidden className="inline-flex h-6 w-6 -rotate-6 items-center justify-center rounded-full border-2 border-stamp text-[11px] font-black text-stamp">1</span>
      Newsletter for One
    </span>
  );
}

const LINKS = [
  { href: "/#how", label: "How it works" },
  { href: "/#dates", label: "Verified dates" },
  { href: "/#stack", label: "Built with" },
  { href: "/pricing", label: "Pricing" },
];

export async function SiteNav() {
  await connection();
  const count = (await store.listNewsletters()).length;

  return (
    <header className="sticky top-0 z-40 border-b border-rule bg-paper/90 backdrop-blur supports-[backdrop-filter]:bg-paper/75">
      <nav className="mx-auto flex max-w-6xl items-center gap-4 px-5 py-2.5 sm:gap-7" aria-label="Main">
        <Link href="/" aria-label="Newsletter for One home"><Wordmark /></Link>
        <ul className="hidden gap-6 text-[15px] text-stone-600 lg:flex dark:text-stone-400">
          {LINKS.map((l) => (
            <li key={l.href}><Link href={l.href} className="hover:text-ink">{l.label}</Link></li>
          ))}
        </ul>
        <div className="ml-auto flex items-center gap-2">
          <Link href="/newsletters" className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-[15px] font-medium hover:bg-stone-100 dark:hover:bg-stone-800">
            Your newsletters
            {count > 0 && <span className="rounded-full bg-stone-200 px-1.5 text-xs tabular-nums text-stone-600 dark:bg-stone-700 dark:text-stone-300">{count}</span>}
          </Link>
          <Link href="/newsletters/new" className="btn btn-primary hidden sm:inline-flex">
            Start a newsletter
          </Link>
        </div>
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-rule">
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-10 text-sm text-stone-600 md:grid-cols-[1.4fr_1fr_1fr] dark:text-stone-400">
        <div className="max-w-sm space-y-2">
          <Wordmark />
          <p>Personal newsletters researched and written by an agent that checks every date and learns what you care about.</p>
          <p className="text-xs text-stone-500">Built for the Nebius x NVIDIA Global AI Hackathon, Best Apps and Agents track. Open source.</p>
        </div>
        <div>
          <p className="mb-2 font-semibold text-ink">Product</p>
          <ul className="space-y-1.5">
            <li><Link href="/#how" className="hover:text-ink">How it works</Link></li>
            <li><Link href="/#dates" className="hover:text-ink">Verified dates</Link></li>
            <li><Link href="/newsletters" className="hover:text-ink">Your newsletters</Link></li>
            <li><Link href="/pricing" className="hover:text-ink">Pricing</Link></li>
            <li><Link href="/admin" className="hover:text-ink">Spending and schedule</Link></li>
          </ul>
        </div>
        <div>
          <p className="mb-2 font-semibold text-ink">Built with</p>
          <ul className="space-y-1.5">
            <li><a href="https://tokenfactory.nebius.com" className="hover:text-ink">Nebius Token Factory</a></li>
            <li><a href="https://www.nvidia.com/en-us/ai-data-science/foundation-models/nemotron/" className="hover:text-ink">NVIDIA Nemotron</a></li>
            <li><a href="https://tavily.com" className="hover:text-ink">Tavily</a></li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
