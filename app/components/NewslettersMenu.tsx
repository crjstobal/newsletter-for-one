"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export type MenuItem = { id: string; name: string; lastIssue?: string; cadence: string };

/** "Your newsletters" in the top bar: opens a list of every newsletter to jump straight in. */
export function NewslettersMenu({ items }: { items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    // Close after navigating.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const active = pathname.startsWith("/newsletters") && pathname !== "/newsletters/new";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        className={`inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-[15px] font-medium hover:bg-stone-100 dark:hover:bg-stone-800 ${active ? "text-ink" : "text-stone-600 dark:text-stone-300"}`}
      >
        Your newsletters
        {items.length > 0 && <span className="rounded-full bg-stone-200 px-1.5 text-xs tabular-nums text-stone-700 dark:bg-stone-700 dark:text-stone-200">{items.length}</span>}
        <svg aria-hidden width="12" height="12" viewBox="0 0 12 12" className={`transition-transform ${open ? "rotate-180" : ""}`}>
          <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-rule bg-sheet shadow-[0_18px_40px_-18px_rgba(22,24,29,0.4)]">
          {items.length === 0 ? (
            <p className="px-4 py-4 text-sm text-stone-500">No newsletters yet.</p>
          ) : (
            <ul className="max-h-[60vh] overflow-y-auto py-1.5">
              {items.map((n) => (
                <li key={n.id}>
                  <Link
                    href={`/newsletters/${n.id}`}
                    className={`block px-4 py-2.5 hover:bg-stone-100 dark:hover:bg-stone-800 ${pathname === `/newsletters/${n.id}` ? "bg-stamp-soft" : ""}`}
                  >
                    <span className="block font-semibold">{n.name}</span>
                    <span className="block text-xs text-stone-500">
                      {n.cadence === "daily" ? "Daily" : "Weekly"}
                      {n.lastIssue ? `, last issue ${n.lastIssue}` : ", no issue yet"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <div className="flex border-t border-rule text-sm">
            <Link href="/newsletters" className="flex-1 px-4 py-3 font-medium hover:bg-stone-100 dark:hover:bg-stone-800">See all</Link>
            <Link href="/newsletters/new" className="flex-1 border-l border-rule px-4 py-3 font-medium text-stamp hover:bg-stone-100 dark:hover:bg-stone-800">New newsletter</Link>
          </div>
        </div>
      )}
    </div>
  );
}
