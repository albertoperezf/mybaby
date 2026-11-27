"use client";

import clsx from "clsx";
import {
  ArrowRight,
  Bell,
  Check,
  Clock,
  Droplets,
  Lock,
  Milk,
  Moon,
  Pill,
  ShieldCheck,
  Smartphone,
  Syringe,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import type { Locale } from "@/db/types";
import { BRAND } from "@/lib/brand";
import { LANDING_COPY } from "./landing-content";
import { PhonePreview } from "./phone-preview";

function WhoCurveGraphic() {
  return (
    <svg viewBox="0 0 280 96" aria-hidden className="mt-3 h-24 w-full">
      {/* Shaded WHO 15th-85th percentile band */}
      <path
        d="M8 78 Q 85 52, 165 34 T 272 14 L 272 44 Q 185 60, 105 74 T 8 90 Z"
        fill="var(--growth)"
        fillOpacity={0.18}
      />
      {/* Median curve */}
      <path
        d="M8 84 Q 90 58, 170 42 T 272 26"
        fill="none"
        stroke="var(--growth)"
        strokeOpacity={0.45}
        strokeWidth="2"
        strokeDasharray="4 4"
      />
      {/* Baby's recorded line */}
      <path
        d="M16 82 L 72 64 L 136 48 L 204 35 L 256 24"
        fill="none"
        stroke="var(--growth)"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {[
        [16, 82],
        [72, 64],
        [136, 48],
        [204, 35],
        [256, 24],
      ].map(([cx, cy]) => (
        <circle key={cx} cx={cx} cy={cy} r="5" fill="var(--surface)" stroke="var(--growth)" strokeWidth="3" />
      ))}
    </svg>
  );
}

export function LandingPage() {
  const [locale, setLocale] = useState<Locale>("en");
  const c = LANDING_COPY[locale];

  return (
    <div className="min-h-dvh bg-bg text-fg">
      {/* Top navigation */}
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-5 py-5">
        <span className="flex items-center gap-2.5 text-xl font-extrabold tracking-tight">
          <span
            aria-hidden
            className="grid size-10 place-items-center rounded-2xl text-lg shadow-soft"
            style={{ background: "linear-gradient(135deg, #e8803f, #c2492b)", color: "#fff3e6" }}
          >
            ☾
          </span>
          {BRAND.name}
        </span>

        <div className="flex items-center gap-2">
          <div role="radiogroup" aria-label="Language" className="inline-flex rounded-full border border-line bg-surface p-0.5">
            {(["en", "es"] as const).map((lang) => (
              <button
                key={lang}
                type="button"
                role="radio"
                aria-checked={locale === lang}
                onClick={() => setLocale(lang)}
                className={clsx(
                  "min-h-9 min-w-10 rounded-full px-2.5 text-xs font-extrabold uppercase transition",
                  locale === lang ? "bg-primary text-primary-fg" : "text-muted hover:text-fg",
                )}
              >
                {lang}
              </button>
            ))}
          </div>
          <ThemeToggle toDarkLabel={c.toDark} toLightLabel={c.toLight} />
        </div>
      </header>

      <main className="mx-auto flex max-w-5xl flex-col gap-14 px-5 pb-16 pt-2">
        {/* Hero */}
        <section
          className="animate-rise relative overflow-hidden rounded-[2.25rem] border border-line p-6 shadow-soft sm:p-10"
          style={{ background: "linear-gradient(145deg, var(--hero-from), var(--hero-to))" }}
        >
          {/* Decorative soft floating sparkles */}
          <span aria-hidden className="animate-drift pointer-events-none absolute right-8 top-6 hidden text-2xl opacity-45 lg:block">
            ✦
          </span>

          <div className="grid items-center gap-10 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="flex flex-col items-start gap-5">
              <span className="inline-flex items-center gap-2 rounded-full bg-surface/85 px-3.5 py-1.5 text-xs font-extrabold text-feed-ink shadow-soft">
                <ShieldCheck aria-hidden className="size-4 text-feed" />
                {c.badge}
              </span>

              <h1 className="text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl">
                {c.headline}
              </h1>

              <p className="max-w-xl text-base leading-relaxed text-muted sm:text-lg">{c.subtitle}</p>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Link
                  href="/app"
                  className="inline-flex min-h-14 items-center gap-2 rounded-2xl bg-primary px-7 text-base font-extrabold text-primary-fg shadow-soft transition active:scale-[0.98]"
                >
                  {c.openApp}
                  <ArrowRight aria-hidden className="size-5" />
                </Link>
                <Link
                  href="/privacy"
                  className="inline-flex min-h-14 items-center rounded-2xl border border-line bg-surface/85 px-6 text-base font-bold text-fg transition hover:bg-surface"
                >
                  {c.privacy}
                </Link>
              </div>

              <ul className="flex flex-wrap gap-2 pt-1">
                {c.trust.map((item) => (
                  <li
                    key={item}
                    className="inline-flex items-center gap-1.5 rounded-full bg-surface/75 px-3 py-1 text-xs font-bold text-fg"
                  >
                    <Check aria-hidden className="size-3.5 text-ok" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <PhonePreview locale={locale} />
          </div>
        </section>

        {/* Bento Feature Grid */}
        <section aria-labelledby="features-heading" className="flex flex-col gap-5">
          <div className="max-w-2xl">
            <h2 id="features-heading" className="text-2xl font-extrabold tracking-tight sm:text-3xl">
              {c.sectionHeading}
            </h2>
            <p className="mt-1 text-muted">{c.sectionSub}</p>
          </div>

          <div className="grid gap-4 md:grid-cols-6">
            {/* 1. Feeding & Diapers */}
            <article className="flex flex-col justify-between gap-4 rounded-[1.75rem] border border-line bg-surface p-6 shadow-soft md:col-span-3">
              <div>
                <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-feed-tint text-feed-ink">
                  <Milk aria-hidden className="size-5 text-feed" />
                </span>
                <h3 className="mt-3 text-lg font-extrabold">{c.bento.feedingTitle}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">{c.bento.feedingBody}</p>
              </div>
              <div className="flex flex-wrap gap-2" aria-hidden>
                {c.preview.presets.map((p) => (
                  <span key={p} className="rounded-xl bg-feed-tint px-3 py-1.5 text-xs font-extrabold text-feed-ink">
                    {p}
                  </span>
                ))}
                <span className="inline-flex items-center gap-1 rounded-xl bg-diaper-tint px-3 py-1.5 text-xs font-extrabold text-diaper-ink">
                  <Droplets className="size-3.5 text-diaper" />
                  Wet / Dirty
                </span>
              </div>
            </article>

            {/* 2. Sleep, Breast & Pump Timers */}
            <article className="flex flex-col justify-between gap-4 rounded-[1.75rem] border border-line bg-surface p-6 shadow-soft md:col-span-3">
              <div>
                <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-sleep-tint text-sleep-ink">
                  <Moon aria-hidden className="size-5 text-sleep" />
                </span>
                <h3 className="mt-3 text-lg font-extrabold">{c.bento.timersTitle}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">{c.bento.timersBody}</p>
              </div>
              <div className="flex flex-wrap gap-2" aria-hidden>
                <span className="inline-flex items-center gap-1.5 rounded-xl bg-sleep-tint px-3 py-1.5 text-xs font-extrabold text-sleep-ink tabular-nums">
                  <Moon className="size-3.5 text-sleep" /> 01:24:10
                </span>
                <span className="rounded-xl bg-feed-tint px-3 py-1.5 text-xs font-extrabold text-feed-ink tabular-nums">
                  L 08:15 · R 06:40
                </span>
                <span className="rounded-xl bg-remind-tint px-3 py-1.5 text-xs font-extrabold text-remind-ink">
                  Pump · L+R
                </span>
              </div>
            </article>

            {/* 3. Growth WHO curves */}
            <article className="flex flex-col justify-between rounded-[1.75rem] border border-line bg-surface p-6 shadow-soft md:col-span-4">
              <div>
                <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-growth-tint text-growth-ink">
                  <TrendingUp aria-hidden className="size-5 text-growth" />
                </span>
                <h3 className="mt-3 text-lg font-extrabold">{c.bento.growthTitle}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">{c.bento.growthBody}</p>
              </div>
              <WhoCurveGraphic />
            </article>

            {/* 4. Vaccines & Medications */}
            <article className="flex flex-col justify-between gap-4 rounded-[1.75rem] border border-line bg-surface p-6 shadow-soft md:col-span-2">
              <div>
                <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-diaper-tint text-diaper-ink">
                  <Syringe aria-hidden className="size-5 text-diaper" />
                </span>
                <h3 className="mt-3 text-lg font-extrabold">{c.bento.healthTitle}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">{c.bento.healthBody}</p>
              </div>
              <div className="flex flex-col gap-2" aria-hidden>
                <span className="inline-flex items-center gap-1.5 rounded-xl bg-growth-tint px-3 py-1.5 text-xs font-extrabold text-growth-ink">
                  <Check className="size-3.5" /> DTaP #1 · CDC / AEP
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-xl bg-remind-tint px-3 py-1.5 text-xs font-extrabold text-remind-ink">
                  <Pill className="size-3.5 text-remind" /> Vitamin D · 400 IU
                </span>
              </div>
            </article>

            {/* 5. Reminders & Night mode */}
            <article className="flex flex-col justify-between gap-4 rounded-[1.75rem] border border-line bg-surface p-6 shadow-soft md:col-span-3">
              <div>
                <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-remind-tint text-remind-ink">
                  <Bell aria-hidden className="size-5 text-remind" />
                </span>
                <h3 className="mt-3 text-lg font-extrabold">{c.bento.remindersTitle}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">{c.bento.remindersBody}</p>
              </div>
              <div className="flex flex-wrap gap-2" aria-hidden>
                <span className="inline-flex items-center gap-1.5 rounded-xl bg-remind-tint px-3 py-1.5 text-xs font-extrabold text-remind-ink">
                  <Clock className="size-3.5 text-remind" /> 21:00 – 06:00
                </span>
                <span className="rounded-xl bg-surface2 px-3 py-1.5 text-xs font-bold text-fg">.ics · Web Push</span>
              </div>
            </article>

            {/* 6. Private & Offline */}
            <article className="flex flex-col justify-between gap-4 rounded-[1.75rem] border border-line bg-surface p-6 shadow-soft md:col-span-3">
              <div>
                <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-surface2 text-fg">
                  <Lock aria-hidden className="size-5 text-primary" />
                </span>
                <h3 className="mt-3 text-lg font-extrabold">{c.bento.privateTitle}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">{c.bento.privateBody}</p>
              </div>
              <div className="flex flex-wrap gap-2" aria-hidden>
                <span className="rounded-xl bg-surface2 px-3 py-1.5 text-xs font-bold text-fg">IndexedDB</span>
                <span className="rounded-xl bg-surface2 px-3 py-1.5 text-xs font-bold text-fg">JSON / CSV</span>
                <span className="rounded-xl bg-surface2 px-3 py-1.5 text-xs font-bold text-fg">EN / ES</span>
              </div>
            </article>
          </div>
        </section>

        {/* Install as PWA + final CTA */}
        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-[1.75rem] border border-line bg-surface p-6 shadow-soft">
            <div className="flex items-center gap-2.5">
              <Smartphone aria-hidden className="size-5 text-primary" />
              <h2 className="text-lg font-extrabold">{c.installTitle}</h2>
            </div>
            <p className="mt-1 text-sm text-muted">{c.installSub}</p>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-surface2 p-3.5">
                <dt className="text-xs font-extrabold uppercase tracking-wide text-muted">{c.iosTitle}</dt>
                <dd className="mt-1 text-sm font-semibold">{c.iosStep}</dd>
              </div>
              <div className="rounded-2xl bg-surface2 p-3.5">
                <dt className="text-xs font-extrabold uppercase tracking-wide text-muted">{c.androidTitle}</dt>
                <dd className="mt-1 text-sm font-semibold">{c.androidStep}</dd>
              </div>
            </dl>
          </div>

          <div
            className="flex flex-col justify-between gap-4 rounded-[1.75rem] border border-line p-6 shadow-soft"
            style={{ background: "linear-gradient(145deg, var(--hero-from), var(--hero-to))" }}
          >
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight">{c.ctaTitle}</h2>
              <p className="mt-1 text-sm text-muted">{c.ctaBody}</p>
            </div>
            <div>
              <Link
                href="/app"
                className="inline-flex min-h-14 items-center gap-2 rounded-2xl bg-primary px-7 text-base font-extrabold text-primary-fg shadow-soft transition active:scale-[0.98]"
              >
                {c.openApp}
                <ArrowRight aria-hidden className="size-5" />
              </Link>
            </div>
          </div>
        </section>

        <footer className="flex flex-col gap-2 border-t border-line pt-6 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-2xl">{c.disclaimer}</p>
          <Link href="/privacy" className="shrink-0 font-bold text-primary underline">
            {c.privacy}
          </Link>
        </footer>
      </main>
    </div>
  );
}
