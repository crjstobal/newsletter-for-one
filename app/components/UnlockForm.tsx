"use client";

import { KeyRound } from "lucide-react";
import { useState } from "react";

/** Shown when a paid action is refused on the public demo. The code is in the submission. */
export function UnlockForm({ onUnlocked }: { onUnlocked: () => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  async function unlock() {
    const res = await fetch("/api/access", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
    if (!res.ok) return setError((await res.json()).error);
    onUnlocked();
  }
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (code.trim()) unlock(); }} className="mt-3 flex flex-wrap items-center gap-2">
      <KeyRound size={16} className="text-stone-500" />
      <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Access code" className="h-10 w-48 rounded-lg border border-rule bg-sheet px-3 text-sm outline-none focus:border-stamp" />
      <button type="submit" disabled={!code.trim()} className="btn btn-primary !min-h-10">Unlock</button>
      {error && <span className="text-sm text-red-700">{error}</span>}
    </form>
  );
}
