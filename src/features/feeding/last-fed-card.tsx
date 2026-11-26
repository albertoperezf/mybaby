"use client";

import { useApp, useNow } from "@/components/app-context";
import { Card } from "@/components/ui";
import { useLastFeeding, useReminders } from "@/db/hooks";
import { useLocale, useT } from "@/i18n";
import { MIN, formatClock, formatElapsed } from "@/lib/time";
import { formatVolume } from "@/lib/units";

export function LastFedCard() {
  const { baby, settings } = useApp();
  const t = useT();
  const locale = useLocale();
  const last = useLastFeeding(baby.id);
  const now = useNow(15_000, last?.id);
  const reminders = useReminders();
  const next = reminders?.find((r) => r.babyId === baby.id && r.kind === "feeding-interval" && r.enabled)?.nextFireAt;

  return (
    <Card className="flex flex-col gap-1">
      <p className="text-sm font-medium text-muted">{t("home.lastFed")}</p>
      {last === undefined ? (
        <div className="h-12" aria-hidden />
      ) : last === null ? (
        <p className="text-2xl font-bold">{t("home.noFeedings")}</p>
      ) : (
        <>
          <p className="text-4xl font-bold tabular-nums" aria-label={t("home.agoLabel", { x: formatElapsed(now - last.at) })}>
            {t("common.ago", { x: formatElapsed(now - last.at) })}
          </p>
          <p className="text-muted">
            {last.amountMl !== undefined ? `${formatVolume(last.amountMl, settings.volumeUnit)} · ` : ""}
            {formatClock(last.at, locale)}
          </p>
        </>
      )}
      {next !== undefined && (
        <p className={next <= now ? "mt-2 font-semibold text-danger" : "mt-2 text-muted"}>
          {next <= now
            ? t("home.overdue", { x: formatElapsed(now - next) })
            : t("home.nextIn", { x: formatElapsed(next - now + MIN - 1), at: formatClock(next, locale) })}
        </p>
      )}
    </Card>
  );
}
