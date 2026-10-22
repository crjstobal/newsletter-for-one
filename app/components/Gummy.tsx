/** Who works on each pipeline step, as the sign shows it, and in words for the line below. */
const SIGN: Record<string, { who: string; doing: string; name: string }> = {
  plan: { who: "LIGHTNING", doing: "PLANNING", name: "Nemotron 3.5 Lightning is planning the searches" },
  search: { who: "TAVILY", doing: "SEARCHING", name: "Tavily is searching the live web" },
  "search-error": { who: "TAVILY", doing: "SEARCHING", name: "Tavily is searching the live web" },
  subscriptions: { who: "NANO", doing: "READING FEEDS", name: "Nemotron 3 Nano is reading your sources" },
  triage: { who: "NANO", doing: "SCORING", name: "Nemotron 3 Nano is scoring every result" },
  dates: { who: "NO AI", doing: "DATE CHECK", name: "Opening each page to read its real date" },
  memory: { who: "LIGHTNING", doing: "MEMORY CHECK", name: "Nemotron 3.5 Lightning is checking what you already got" },
  edit: { who: "ULTRA", doing: "WRITING", name: "Nemotron 3 Ultra is writing" },
};

/** One line on what is happening now, for the step a progress event reports. */
export const nowLine = (step?: string, detail?: string) =>
  step && SIGN[step] ? `${SIGN[step].name}${detail ? `: ${detail}` : ""}` : undefined;

/**
 * The mascot that keeps the reader company while Nemotron works: a purple gummy bouncing with
 * a sign that names whoever is working on the current step. Pure SVG and CSS; it holds still for
 * people who prefer reduced motion.
 */
export function Gummy({ message, detail, step, now }: { message: string; detail?: string; step?: string; now?: string }) {
  const sign = (step && SIGN[step]) || { who: "NEMOTRON", doing: "IS ON IT" };
  return (
    <div className="flex flex-col items-center py-6 text-center" role="status" aria-live="polite">
      <div className="relative h-44 w-56">
        {/* shadow squashes as the gummy lands */}
        <span className="gummy-shadow absolute bottom-1 left-1/2 h-3 w-24 -translate-x-1/2 rounded-full bg-stamp/25 blur-[2px]" />
        <svg viewBox="0 0 160 150" className="gummy absolute bottom-3 left-1/2 h-36 w-auto -translate-x-1/2 overflow-visible" aria-hidden>
          {/* sign on a stick */}
          <g className="gummy-sign">
            <rect x="96" y="6" width="3" height="58" rx="1.5" fill="#8a6d3b" />
            <rect x="74" y="2" width="82" height="34" rx="6" fill="#fffbea" stroke="#5b3fc4" strokeWidth="2.5" />
            <text x="115" y="17" textAnchor="middle" fontSize="9.5" fontWeight="800" fill="#5b3fc4" fontFamily="var(--font-sans), sans-serif">{sign.who}</text>
            <text x="115" y="29" textAnchor="middle" fontSize={sign.doing.length > 10 ? 7.5 : 8.5} fontWeight="600" fill="#5b3fc4" fontFamily="var(--font-sans), sans-serif">{sign.doing}</text>
          </g>
          {/* body: a translucent purple jelly bear */}
          <defs>
            <radialGradient id="gummyBody" cx="38%" cy="30%" r="75%">
              <stop offset="0%" stopColor="#c4b5ff" />
              <stop offset="55%" stopColor="#7c5cf0" />
              <stop offset="100%" stopColor="#4b2fb3" />
            </radialGradient>
          </defs>
          <circle cx="44" cy="52" r="11" fill="url(#gummyBody)" />
          <circle cx="86" cy="52" r="11" fill="url(#gummyBody)" />
          <path d="M65 48c22 0 34 16 34 38 0 14-6 24-14 30 6 4 8 10 8 16 0 8-10 12-28 12s-28-4-28-12c0-6 2-12 8-16-8-6-14-16-14-30 0-22 12-38 34-38z" fill="url(#gummyBody)" />
          {/* arm holding the stick */}
          <path d="M92 92c6-6 8-16 6-28" stroke="#6a4be0" strokeWidth="9" strokeLinecap="round" fill="none" />
          {/* face */}
          <ellipse cx="54" cy="78" rx="4" ry="5" fill="#1d1340" />
          <ellipse cx="76" cy="78" rx="4" ry="5" fill="#1d1340" />
          <circle cx="55.5" cy="76" r="1.4" fill="#fff" />
          <circle cx="77.5" cy="76" r="1.4" fill="#fff" />
          <path d="M58 90c4 4 10 4 14 0" stroke="#1d1340" strokeWidth="2.6" strokeLinecap="round" fill="none" />
          <ellipse cx="47" cy="88" rx="5" ry="3" fill="#ff8fc7" opacity="0.55" />
          <ellipse cx="83" cy="88" rx="5" ry="3" fill="#ff8fc7" opacity="0.55" />
          {/* shine */}
          <path d="M46 60c4-6 10-9 16-9" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" opacity="0.55" fill="none" />
        </svg>
      </div>
      <p className="mt-2 text-lg font-bold">{message}</p>
      {now && <p className="mt-1 max-w-md text-[15px] font-semibold text-stamp">Now: {now}</p>}
      {detail && <p className="mt-1 max-w-md text-[15px] text-stone-500">{detail}</p>}
    </div>
  );
}
