"use client";

import clsx from "clsx";
import { useApp, useNow } from "@/components/app-context";
import { BabyAvatar } from "@/components/baby-avatar";
import { BottleIllustration } from "@/components/illustrations";
import { useLastFeeding, useReminders } from "@/db/hooks";
import { useLocale, useT } from "@/i18n";
import { formatAge } from "@/lib/age";
import { MIN, formatClock, formatElapsed, toDateInput } from "@/lib/time";
import { formatVolume } from "@/lib/units";
import { ageInDays } from "@/lib/who";
import { dayPart, feedRatio, feedState, type FeedState } from "./progress";

const R = 72;
const C = 2 * Math.PI * R;

const STATE_STROKE: Record<FeedState, string> = {
  fresh: "var(--feed)",
  soon: "var(--warn)",
  due: "var(--danger)",
  overdue: "var(--danger)",
};

function Ring({ ratio, state, children, label }: { ratio: number | null; state: FeedState; children: React.ReactNode; label: string }) {
  const progress = ratio === null ? 0 : Math.min(ratio, 1);
  return (
    <div role="img" aria-label={label} className="relative grid size-36 shrink-0 place-items-center sm:size-44">
      <svg viewBox="0 0 176 176" aria-hidden className="absolute inset-0 size-full -rotate-90">
        <circle cx="88" cy="88" r={R} fill="none" stroke="var(--surface)" strokeOpacity={0.75} strokeWidth="14" strokeDasharray={ratio === null ? "2 12" : undefined} strokeLinecap="round" />
        {ratio !== null && (
          <circle
            cx="88"
            cy="88"
            r={R}
            fill="none"
            stroke={STATE_STROKE[state]}
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - progress)}
            style={{ transition: "stroke-dashoffset 700ms cubic-bezier(0.2, 0.8, 0.2, 1)" }}
          />
        )}
      </svg>
      <div className="relative flex w-full flex-col items-center px-4 text-center sm:px-5">{children}</div>
    </div>
  );
}

/** The one number a 3 AM parent needs: time since the last feed, as a ring filling toward the next one. */
export function Hero() {
  const { baby, settings } = useApp();
  const t = useT();
  const locale = useLocale();
  const last = useLastFeeding(baby.id);
  const now = useNow(15_000, last?.id);
  const reminders = useReminders();

  const reminder = reminders?.find((r) => r.babyId === baby.id && r.kind === "feeding-interval" && r.enabled);
  const next = reminder?.nextFireAt;
  const intervalMin = reminder?.schedule.type === "interval" ? reminder.schedule.everyMin : settings.defaultIntervalMin;

  const ratio = last ? feedRatio(now - last.at, intervalMin) : null;
  const state = ratio === null ? "fresh" : feedState(ratio);
  const age = formatAge(ageInDays(baby.birthDate, toDateInput(now)), t);
  const elapsed = last ? formatElapsed(now - last.at) : "";

  return (
    <section
      aria-label={t("home.lastFed")}
      className="animate-rise overflow-hidden rounded-[2rem] border border-line p-5 shadow-soft"
      style={{ background: "linear-gradient(145deg, var(--hero-from), var(--hero-to))" }}
    >
      <div className="flex items-center gap-3">
        <BabyAvatar baby={baby} size="md" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-muted">{t(`greet.${dayPart(new Date(now).getHours())}`)}</p>
          <h1 className="truncate text-2xl font-extrabold leading-tight tracking-tight">{baby.name}</h1>
        </div>
        <span className="ml-auto shrink-0 rounded-full bg-surface/70 px-3 py-1 text-sm font-bold text-feed-ink">{age}</span>
      </div>

      <div className="mt-4 flex items-center gap-4 sm:gap-6">
        <Ring ratio={ratio} state={state} label={last ? t("home.agoLabel", { x: elapsed }) : t("home.noFeedings")}>
          {last === undefined ? null : last === null ? (
            <BottleIllustration className="!size-16 sm:!size-20" />
          ) : (
            <>
              <span
                key={last.id}
                className={clsx(
                  "animate-pop whitespace-nowrap font-extrabold leading-none tabular-nums text-feed-ink",
                  elapsed.length >= 8
                    ? "text-base sm:text-xl"
                    : elapsed.length >= 6
                      ? "text-xl sm:text-2xl"
                      : "text-2xl sm:text-3xl",
                )}
              >
                {elapsed}
              </span>
              <span className="mt-1 max-w-20 text-center text-[0.625rem] font-bold uppercase leading-tight tracking-wide text-muted sm:max-w-28 sm:text-xs">
                {t("hero.sinceLast")}
              </span>
            </>
          )}
        </Ring>

        <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
          {last === null ? (
            <>
              <p className="text-xl font-extrabold">{t("home.noFeedings")}</p>
              <p className="text-muted">{t("hero.emptyHint")}</p>
            </>
          ) : last ? (
            <>
              <p className="text-sm font-bold uppercase tracking-wide text-muted">{t("home.lastFed")}</p>
              <p className="text-xl font-extrabold">
                {last.amountMl !== undefined ? `${formatVolume(last.amountMl, settings.volumeUnit)} · ` : ""}
                {formatClock(last.at, locale)}
              </p>
              <p
                className={clsx(
                  "inline-flex rounded-full px-3 py-1 text-sm font-extrabold",
                  state === "fresh" && "bg-feed-tint text-feed-ink",
                  state === "soon" && "bg-surface text-warn",
                  (state === "due" || state === "overdue") && "bg-surface text-danger",
                )}
              >
                {t(`hero.state.${state}`)}
              </p>
              {next !== undefined && (
                <p className="text-muted">
                  {next <= now
                    ? t("home.overdue", { x: formatElapsed(now - next) })
                    : t("home.nextIn", { x: formatElapsed(next - now + MIN - 1), at: formatClock(next, locale) })}
                </p>
              )}
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}
