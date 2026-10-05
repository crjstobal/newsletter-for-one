import { Check } from "lucide-react";

export const SETUP_STEPS = ["Topic", "Sources", "Settings"] as const;

/** Where the reader is in setting up a new newsletter. Everything can be changed later. */
export function SetupSteps({ current }: { current: 0 | 1 | 2 }) {
  return (
    <ol className="flex flex-wrap items-center gap-2 text-sm" aria-label="Setup steps">
      {SETUP_STEPS.map((label, i) => (
        <li key={label} className="flex items-center gap-2" aria-current={i === current ? "step" : undefined}>
          <span
            className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
              i < current ? "bg-stamp text-white" : i === current ? "border-2 border-stamp text-stamp" : "border border-rule text-stone-400"
            }`}
          >
            {i < current ? <Check size={14} /> : i + 1}
          </span>
          <span className={i === current ? "font-semibold text-ink" : "text-stone-500"}>{label}</span>
          {i < SETUP_STEPS.length - 1 && <span aria-hidden className="mx-1 h-px w-8 bg-rule" />}
        </li>
      ))}
    </ol>
  );
}
