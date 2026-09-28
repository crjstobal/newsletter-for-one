"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { EXAMPLES } from "./examples";

export function HeroForm() {
  const router = useRouter();
  const [text, setText] = useState("");

  function start() {
    router.push(`/newsletters/new?describe=${encodeURIComponent(text.trim())}`);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (text.trim()) start();
      }}
      className="rounded-xl border border-rule bg-sheet p-3 shadow-[0_1px_0_var(--color-rule)]"
    >
      <label htmlFor="describe" className="sr-only">Describe your newsletter</label>
      <textarea
        id="describe"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder="I edit YouTube videos in Final Cut Pro and want to know about new plugins, updates and good tutorials…"
        className="w-full resize-none bg-transparent px-2 py-1.5 text-[15px] leading-relaxed outline-none placeholder:text-stone-400"
      />
      <div className="flex flex-wrap items-center gap-2 border-t border-rule pt-3">
        <span className="text-xs text-stone-500">Try:</span>
        {EXAMPLES.map((ex) => (
          <button key={ex.label} type="button" onClick={() => setText(ex.text)} className="rounded-full border border-rule px-2.5 py-0.5 text-xs text-stone-600 hover:border-stone-400 dark:text-stone-400">
            {ex.label}
          </button>
        ))}
        <button type="submit" disabled={!text.trim()} className="btn btn-primary ml-auto">
          Write my newsletter
        </button>
      </div>
    </form>
  );
}
