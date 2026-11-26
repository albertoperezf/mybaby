"use client";

import { Droplets, Milk } from "lucide-react";
import { useApp } from "@/components/app-context";
import { Card, SectionTitle } from "@/components/ui";
import type { Diaper, Feeding } from "@/db/types";
import { useLocale, useT, type MessageKey } from "@/i18n";
import { formatClock } from "@/lib/time";
import { formatVolume } from "@/lib/units";

/** Today's feedings and diapers as a scrollable strip, newest first. */
export function TodayTimeline({ feedings, diapers, dayStart }: { feedings: Feeding[]; diapers: Diaper[]; dayStart: number }) {
  const { settings } = useApp();
  const t = useT();
  const locale = useLocale();

  const entries = [
    ...feedings.filter((f) => f.at >= dayStart).map((f) => ({ kind: "feed" as const, at: f.at, id: f.id, label: f.amountMl !== undefined ? formatVolume(f.amountMl, settings.volumeUnit) : t("log.feeding") })),
    ...diapers.filter((d) => d.at >= dayStart).map((d) => ({ kind: "diaper" as const, at: d.at, id: d.id, label: t(`diaper.${d.type}` as MessageKey) })),
  ].sort((a, b) => b.at - a.at);

  if (entries.length === 0) return null;

  return (
    <Card className="!px-0">
      <div className="px-4 sm:px-5">
        <SectionTitle>{t("home.today")}</SectionTitle>
      </div>
      <ul className="flex snap-x gap-3 overflow-x-auto px-4 pb-1 sm:px-5" aria-label={t("home.today")}>
        {entries.map((e) => (
          <li
            key={e.id}
            className={`flex min-w-24 shrink-0 snap-start flex-col items-center gap-1 rounded-3xl px-3 py-2.5 ${e.kind === "feed" ? "bg-feed-tint text-feed-ink" : "bg-diaper-tint text-diaper-ink"}`}
          >
            {e.kind === "feed" ? <Milk aria-hidden className="size-5 text-feed" /> : <Droplets aria-hidden className="size-5 text-diaper" />}
            <span className="text-sm font-extrabold tabular-nums">{e.label}</span>
            <span className="text-xs font-semibold opacity-85">{formatClock(e.at, locale)}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
