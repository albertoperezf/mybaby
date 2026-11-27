"use client";

import clsx from "clsx";
import { Check, Droplet, Heart, Milk, Moon } from "lucide-react";
import { useState } from "react";
import type { Locale } from "@/db/types";
import { LANDING_COPY } from "./landing-content";

type PreviewTheme = "light" | "dark" | "night";

const R = 52;
const C = 2 * Math.PI * R;

export function PhonePreview({ locale }: { locale: Locale }) {
  const copy = LANDING_COPY[locale].preview;
  const [theme, setTheme] = useState<PreviewTheme>("light");
  const [fedNow, setFedNow] = useState(false);
  const [lastAmount, setLastAmount] = useState<string | null>(null);
  const [sleeping, setSleeping] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [pulseKey, setPulseKey] = useState(0);

  const ratio = fedNow ? 0.06 : 0.62;
  const elapsed = fedNow ? "<1m" : "1h 45m";
  const shownAmount = lastAmount ?? copy.presets[1];

  function triggerFeed(amount: string) {
    setFedNow(true);
    setLastAmount(amount);
    setPulseKey((k) => k + 1);
    setToast(copy.loggedToast.replace("{amount}", amount));
  }

  function toggleSleep() {
    setSleeping((prev) => {
      const next = !prev;
      setToast(next ? copy.sleepToast : copy.wakeToast);
      return next;
    });
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Theme switcher for the live preview */}
      <div
        role="radiogroup"
        aria-label={copy.themeLabel}
        className="inline-flex gap-1 rounded-full border border-line bg-surface p-1 shadow-soft"
      >
        {(
          [
            ["light", copy.light],
            ["dark", copy.dark],
            ["night", copy.night],
          ] as const
        ).map(([val, label]) => (
          <button
            key={val}
            type="button"
            role="radio"
            aria-checked={theme === val}
            onClick={() => setTheme(val)}
            className={clsx(
              "min-h-9 rounded-full px-3.5 text-xs font-bold transition",
              theme === val ? "bg-primary text-primary-fg" : "text-muted hover:text-fg",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Phone shell */}
      <div
        data-theme={theme}
        className="relative w-full max-w-[320px] overflow-hidden rounded-[2.5rem] border-[6px] border-line bg-bg p-3.5 text-fg shadow-soft transition-colors duration-300"
      >
        {/* Dynamic island pill */}
        <div aria-hidden className="mx-auto mb-3 h-4 w-24 rounded-full bg-fg/15" />

        {/* Mini hero card */}
        <div
          className="rounded-[1.5rem] border border-line p-3.5 shadow-soft"
          style={{ background: "linear-gradient(145deg, var(--hero-from), var(--hero-to))" }}
        >
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden
              className="grid size-9 shrink-0 place-items-center rounded-full bg-surface text-base shadow-soft"
            >
              🐻
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-muted">{copy.greeting}</p>
              <p className="truncate text-base font-extrabold leading-tight">Leo</p>
            </div>
            <span className="ml-auto rounded-full bg-surface/80 px-2.5 py-0.5 text-xs font-bold text-feed-ink">
              {copy.babyAge}
            </span>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <div className="relative grid size-24 shrink-0 place-items-center">
              <svg viewBox="0 0 124 124" aria-hidden className="absolute inset-0 size-full -rotate-90">
                <circle
                  cx="62"
                  cy="62"
                  r={R}
                  fill="none"
                  stroke="var(--surface)"
                  strokeOpacity={0.75}
                  strokeWidth="10"
                />
                <circle
                  cx="62"
                  cy="62"
                  r={R}
                  fill="none"
                  stroke="var(--feed)"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={C}
                  strokeDashoffset={C * (1 - ratio)}
                  style={{ transition: "stroke-dashoffset 600ms cubic-bezier(0.2, 0.8, 0.2, 1)" }}
                />
              </svg>
              <div className="relative flex flex-col items-center px-2 text-center">
                <span key={pulseKey} className="animate-pop text-base font-extrabold leading-none tabular-nums text-feed-ink">
                  {elapsed}
                </span>
                <span className="mt-1 max-w-16 text-[8px] font-bold uppercase leading-tight text-muted">
                  {copy.sinceLast}
                </span>
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted">{copy.lastFed}</p>
              <p className="text-base font-extrabold tabular-nums">{shownAmount}</p>
              <span className="mt-1 inline-flex rounded-full bg-feed-tint px-2.5 py-0.5 text-[11px] font-extrabold text-feed-ink">
                {fedNow ? copy.justFed : copy.onTrack}
              </span>
            </div>
          </div>
        </div>

        {/* Mini timers row */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={toggleSleep}
            className={clsx(
              "flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-2xl border px-1 text-xs font-bold transition active:scale-[0.96]",
              sleeping
                ? "border-primary bg-primary text-primary-fg shadow-soft"
                : "border-sleep/30 bg-sleep-tint text-sleep-ink",
            )}
          >
            <Moon aria-hidden className={clsx("size-4", !sleeping && "text-sleep")} />
            <span>{sleeping ? copy.wakeUp : copy.sleep}</span>
          </button>
          <div className="flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-2xl border border-feed/30 bg-feed-tint px-1 text-xs font-bold text-feed-ink">
            <Heart aria-hidden className="size-4 text-feed" />
            <span>{copy.breast}</span>
          </div>
          <div className="flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-2xl border border-remind/30 bg-remind-tint px-1 text-xs font-bold text-remind-ink">
            <Droplet aria-hidden className="size-4 text-remind" />
            <span>{copy.pump}</span>
          </div>
        </div>

        {/* Interactive bottle presets */}
        <div className="mt-2.5 grid grid-cols-3 gap-2">
          {copy.presets.map((amount) => (
            <button
              key={amount}
              type="button"
              onClick={() => triggerFeed(amount)}
              className="flex min-h-11 items-center justify-center gap-1 rounded-2xl border border-feed/30 bg-feed-tint px-2 text-sm font-extrabold text-feed-ink transition active:scale-[0.96]"
            >
              <Milk aria-hidden className="size-3.5 text-feed" />
              {amount}
            </button>
          ))}
        </div>

        {/* Mini toast feedback */}
        <div className="mt-2.5 flex min-h-8 items-center justify-center">
          {toast ? (
            <span
              key={toast + pulseKey + String(sleeping)}
              className="animate-pop inline-flex items-center gap-1.5 rounded-full bg-fg px-3 py-1 text-xs font-bold text-bg"
            >
              <Check aria-hidden className="size-3.5" />
              {toast}
            </span>
          ) : (
            <span className="text-[11px] font-semibold text-muted">{LANDING_COPY[locale].tryHint}</span>
          )}
        </div>
      </div>
    </div>
  );
}
