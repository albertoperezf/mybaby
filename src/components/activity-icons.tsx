import type { DiaperType } from "@/db/types";

/**
 * Baby bottle icon whose inner milk fill height reflects the amount.
 * `level` is 0..1 (e.g. 2 oz ≈ 0.3, 3 oz ≈ 0.55, 4 oz ≈ 0.8).
 */
export function BottleIcon({ level = 0.55, className = "size-6" }: { level?: number; className?: string }) {
  const clamped = Math.max(0.15, Math.min(0.95, level));
  // Bottle body interior spans y = 10 to y = 21 (height 11).
  const fillH = Math.round(clamped * 11 * 10) / 10;
  const fillY = Math.round((21 - fillH) * 10) / 10;
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      {/* Milk fill */}
      <rect x="7" y={fillY} width="10" height={fillH} rx="1.5" fill="currentColor" fillOpacity="0.45" />
      {/* Nipple & collar */}
      <path
        d="M10.5 2.5h3v2.2c0 .5.4.8.9.8h.6a1 1 0 0 1 1 1V8H8V6.5a1 1 0 0 1 1-1h.6c.5 0 .9-.3.9-.8V2.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      {/* Bottle body */}
      <rect x="6.5" y="8" width="11" height="13.5" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
      {/* Measurement ticks */}
      <path d="M14.5 12h2M14.5 15h2M14.5 18h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/** Maps a volume in ml to a 0..1 bottle fill level (60 ml ≈ 0.30, 90 ml ≈ 0.55, 120 ml ≈ 0.80). */
export function bottleFillLevel(ml?: number): number {
  if (!ml || ml <= 0) return 0.45;
  return Math.max(0.2, Math.min(0.95, (ml - 20) / 130));
}

/** Distinct icon for each diaper state: wet (droplet), dirty (swirl), both (droplet + swirl), dry (sparkle/check). */
export function DiaperIcon({ type, className = "size-6" }: { type: DiaperType; className?: string }) {
  if (type === "wet") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
        <path
          d="M12 3.2C12 3.2 6.5 9.6 6.5 14a5.5 5.5 0 0 0 11 0c0-4.4-5.5-10.8-5.5-10.8Z"
          fill="currentColor"
          fillOpacity="0.22"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinejoin="round"
        />
        <path d="M9.6 14.2a2.4 2.4 0 0 0 2.4 2.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  if (type === "dirty") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
        {/* Friendly clean poop-swirl silhouette */}
        <path
          d="M12.2 4.5c.3 1.4-.4 2.3-1.4 2.9 2.4 0 4.2 1.2 4.2 2.9 0 .5-.1.9-.4 1.3 1.7.4 3 1.6 3 3.1 0 .6-.2 1.1-.5 1.5 1.1.5 1.9 1.4 1.9 2.5 0 1.6-1.4 2.8-3.3 2.8H8.3C6.4 21.5 5 20.3 5 18.7c0-1.1.8-2 1.9-2.5-.3-.4-.5-.9-.5-1.5 0-1.5 1.3-2.7 3-3.1-.3-.4-.4-.8-.4-1.3 0-1.5 1.4-2.7 3.4-2.9-.5-.8-.6-1.9-.2-2.9Z"
          fill="currentColor"
          fillOpacity="0.22"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (type === "both") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
        {/* Left: water droplet */}
        <path
          d="M7.2 5.5C7.2 5.5 3.5 10 3.5 12.8a3.7 3.7 0 0 0 7.4 0c0-2.8-3.7-7.3-3.7-7.3Z"
          fill="currentColor"
          fillOpacity="0.22"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        {/* Right: compact swirl */}
        <path
          d="M16.2 9.5c1.7 0 2.9.9 2.9 2.1 0 .4-.1.7-.3 1 1.2.4 2 1.3 2 2.4 0 1.3-1.1 2.4-2.6 2.4h-4.4c-1.5 0-2.6-1.1-2.6-2.4 0-1.1.8-2 2-2.4-.2-.3-.3-.6-.3-1 0-1.2 1.2-2.1 2.9-2.1h.4Z"
          fill="currentColor"
          fillOpacity="0.22"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  // dry: clean check inside soft diaper badge
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.8" strokeDasharray="3 2.5" />
      <path d="M8.5 12.2 11 14.7 15.8 9.6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
