import { shortDate } from "./ui";

/**
 * A round postal cancellation stamp: the issue number and the dates it covers, in stamp violet,
 * slightly rotated like it was inked by hand. Extends the date-stamp motif to the whole issue.
 */
export function Postmark({ number, since, until, name, size = 148 }: { number: number; since: string; until: string; name: string; size?: number }) {
  const year = until.slice(0, 4);
  const range = `${shortDate(since)} to ${shortDate(until)}`;
  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      role="img"
      aria-label={`Issue ${number}, covering ${range} ${year}`}
      className="shrink-0 -rotate-[7deg] text-stamp"
      style={{ opacity: 0.93 }}
    >
      <defs>
        <path id="pm-top" d="M 40 100 A 60 60 0 0 1 160 100" />
        <path id="pm-bottom" d="M 36 108 A 64 64 0 0 0 164 108" />
      </defs>
      <circle cx="100" cy="100" r="94" fill="none" stroke="currentColor" strokeWidth="4" />
      <circle cx="100" cy="100" r="84" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <text fontSize="15" fontWeight="700" fill="currentColor" letterSpacing="1">
        <textPath href="#pm-top" startOffset="50%" textAnchor="middle">{name.length > 20 ? `${name.slice(0, 19)}…` : name}</textPath>
      </text>
      <text fontSize="15" fontWeight="600" fill="currentColor" letterSpacing="1">
        <textPath href="#pm-bottom" startOffset="50%" textAnchor="middle">{year}</textPath>
      </text>
      <line x1="46" y1="80" x2="154" y2="80" stroke="currentColor" strokeWidth="1.5" />
      <line x1="44" y1="138" x2="156" y2="138" stroke="currentColor" strokeWidth="1.5" />
      <text x="100" y="112" textAnchor="middle" fontSize="44" fontWeight="800" fill="currentColor">No. {number}</text>
      <text x="100" y="130" textAnchor="middle" fontSize="14" fontWeight="600" fill="currentColor">{range}</text>
    </svg>
  );
}
