// Small decorative scenes for empty states. Colours come from the theme tokens, so they adapt to every theme.

const base = "size-24 shrink-0";

export function MoonIllustration({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 96 96" aria-hidden className={`${base} animate-drift ${className}`}>
      <circle cx="48" cy="48" r="40" fill="var(--feed-tint)" />
      <path d="M58 22a26 26 0 1 0 16 44A22 22 0 0 1 58 22Z" fill="var(--feed)" />
      <circle cx="70" cy="30" r="2.5" fill="var(--feed-ink)" />
      <circle cx="78" cy="46" r="1.8" fill="var(--feed-ink)" />
      <circle cx="30" cy="22" r="1.8" fill="var(--feed-ink)" />
    </svg>
  );
}

export function BottleIllustration({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 96 96" aria-hidden className={`${base} ${className}`}>
      <rect x="39" y="6" width="18" height="18" rx="9" fill="var(--feed)" />
      <rect x="32" y="22" width="32" height="9" rx="4" fill="var(--feed-ink)" opacity="0.75" />
      <rect x="27" y="30" width="42" height="58" rx="15" fill="var(--surface)" stroke="var(--feed)" strokeWidth="3" />
      <rect x="30" y="52" width="36" height="33" rx="12" fill="var(--feed-tint)" />
      <path d="M36 42h9M36 62h12" stroke="var(--feed)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function SproutIllustration({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 96 96" aria-hidden className={`${base} ${className}`}>
      <circle cx="48" cy="48" r="40" fill="var(--growth-tint)" />
      <path d="M48 76V46" stroke="var(--growth)" strokeWidth="4" strokeLinecap="round" />
      <path d="M48 52c-14 0-20-8-20-18 12 0 20 6 20 18Z" fill="var(--growth)" />
      <path d="M48 44c0-12 8-18 20-18 0 10-6 18-20 18Z" fill="var(--growth)" opacity="0.7" />
      <ellipse cx="48" cy="78" rx="16" ry="4" fill="var(--growth)" opacity="0.25" />
    </svg>
  );
}

export function BellIllustration({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 96 96" aria-hidden className={`${base} ${className}`}>
      <circle cx="48" cy="48" r="40" fill="var(--remind-tint)" />
      <path d="M32 62V46a16 16 0 0 1 32 0v16l6 6H26l6-6Z" fill="var(--remind)" />
      <circle cx="48" cy="72" r="5" fill="var(--remind-ink)" />
      <circle cx="48" cy="26" r="3.5" fill="var(--remind)" />
    </svg>
  );
}

export function EmptyState({ art, title, text, children }: { art: React.ReactNode; title?: string; text: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 py-4 text-center">
      {art}
      {title && <p className="text-lg font-extrabold">{title}</p>}
      <p className="max-w-xs text-muted">{text}</p>
      {children}
    </div>
  );
}
