"use client";

import { Droplet, Droplets, Heart, Milk, Moon } from "lucide-react";
import { useApp } from "@/components/app-context";
import { Card, SectionTitle } from "@/components/ui";
import type { Diaper, Feeding, Sleep } from "@/db/types";
import { formatDurationShort } from "@/features/timers/timer-store";
import { useLocale, useT, type MessageKey } from "@/i18n";
import { formatClock } from "@/lib/time";
import { formatVolume } from "@/lib/units";

type TileKind = "feed" | "breast" | "pump" | "diaper" | "sleep";

const TILE_STYLE: Record<TileKind, string> = {
  feed: "bg-feed-tint text-feed-ink",
  breast: "bg-feed-tint text-feed-ink",
  pump: "bg-remind-tint text-remind-ink",
  diaper: "bg-diaper-tint text-diaper-ink",
  sleep: "bg-sleep-tint text-sleep-ink",
};

/** Today's feedings, diapers and sleeps as a scrollable strip, newest first. */
export function TodayTimeline({
  feedings,
  diapers,
  sleeps = [],
  dayStart,
}: {
  feedings: Feeding[];
  diapers: Diaper[];
  sleeps?: Sleep[];
  dayStart: number;
}) {
  const { settings } = useApp();
  const t = useT();
  const locale = useLocale();

  const entries = [
    ...feedings
      .filter((f) => f.at >= dayStart)
      .map((f) => {
        if (f.kind === "breast") {
          return {
            kind: "breast" as TileKind,
            at: f.at,
            id: f.id,
            label: f.durationSec ? formatDurationShort(f.durationSec) : t("timer.breastLabel"),
          };
        }
        if (f.kind === "pump") {
          const amt = f.amountMl !== undefined ? formatVolume(f.amountMl, f.enteredUnit ?? settings.volumeUnit) : "";
          const dur = f.durationSec ? formatDurationShort(f.durationSec) : "";
          return {
            kind: "pump" as TileKind,
            at: f.at,
            id: f.id,
            label: amt || dur || t("timer.pumpLabel"),
          };
        }
        return {
          kind: "feed" as TileKind,
          at: f.at,
          id: f.id,
          label: f.amountMl !== undefined ? formatVolume(f.amountMl, settings.volumeUnit) : t("log.feeding"),
        };
      }),
    ...diapers
      .filter((d) => d.at >= dayStart)
      .map((d) => ({ kind: "diaper" as TileKind, at: d.at, id: d.id, label: t(`diaper.${d.type}` as MessageKey) })),
    ...sleeps
      .filter((s) => s.startedAt >= dayStart || (s.endedAt ?? Number.MAX_SAFE_INTEGER) >= dayStart)
      .map((s) => ({
        kind: "sleep" as TileKind,
        at: s.startedAt,
        id: s.id,
        label: s.endedAt ? formatDurationShort((s.endedAt - s.startedAt) / 1000) : t("timer.activeSleep"),
      })),
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
            className={`flex min-w-24 shrink-0 snap-start flex-col items-center gap-1 rounded-3xl px-3 py-2.5 ${TILE_STYLE[e.kind]}`}
          >
            {e.kind === "feed" && <Milk aria-hidden className="size-5 text-feed" />}
            {e.kind === "breast" && <Heart aria-hidden className="size-5 text-feed" />}
            {e.kind === "pump" && <Droplet aria-hidden className="size-5 text-remind" />}
            {e.kind === "diaper" && <Droplets aria-hidden className="size-5 text-diaper" />}
            {e.kind === "sleep" && <Moon aria-hidden className="size-5 text-sleep" />}
            <span className="text-sm font-extrabold tabular-nums">{e.label}</span>
            <span className="text-xs font-semibold opacity-85">{formatClock(e.at, locale)}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
