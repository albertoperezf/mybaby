"use client";

import clsx from "clsx";
import { Droplets, Milk, Timer } from "lucide-react";
import { useApp } from "@/components/app-context";
import { Card } from "@/components/ui";
import type { Feeding } from "@/db/types";
import { useT, type MessageKey } from "@/i18n";
import { MIN, formatElapsed } from "@/lib/time";
import { formatVolume } from "@/lib/units";
import { averageDailyMl, averageIntervalMin, type DaySummary } from "./stats";

type Tone = "feed" | "diaper";

const TONES: Record<Tone, string> = {
  feed: "bg-feed-tint text-feed-ink",
  diaper: "bg-diaper-tint text-diaper-ink",
};

function Tile({ label, value, sub, tone, icon }: { label: string; value: string; sub?: string; tone: Tone; icon: React.ReactNode }) {
  return (
    <div className={clsx("flex flex-col gap-0.5 rounded-3xl p-3.5", TONES[tone])}>
      <span className="flex items-center gap-1.5 text-xs font-bold opacity-90">
        {icon}
        {label}
      </span>
      <span className="text-2xl font-extrabold tabular-nums">{value}</span>
      {sub && <span className="text-xs font-semibold opacity-85">{sub}</span>}
    </div>
  );
}

export function StatTiles({ days, feedings }: { days: DaySummary[]; feedings: Feeding[] }) {
  const { settings, baby } = useApp();
  const t = useT();
  const unit = settings.volumeUnit;
  const today = days[days.length - 1];
  const prior = days.slice(-8, -1);
  const priorAvg = averageDailyMl(prior);
  const interval = averageIntervalMin(feedings);
  const delta = priorAvg && today.ml > 0 ? Math.round(((today.ml - priorAvg) / priorAvg) * 100) : null;

  const encouragement: MessageKey =
    today.feedings === 0 ? "home.cheer.none" : today.feedings < 4 ? "home.cheer.few" : "home.cheer.many";

  return (
    <Card className="flex flex-col gap-3">
      <p className="text-lg font-extrabold">{t(encouragement, { n: today.feedings, name: baby.name })}</p>
      <div className="grid grid-cols-2 gap-3">
        <Tile
          tone="feed"
          icon={<Milk aria-hidden className="size-3.5" />}
          label={t("stats.todayTotal")}
          value={today.ml > 0 ? formatVolume(today.ml, unit) : "-"}
          sub={delta !== null ? t("stats.vsAverage", { pct: `${delta > 0 ? "+" : ""}${delta}` }) : undefined}
        />
        <Tile tone="feed" icon={<Milk aria-hidden className="size-3.5" />} label={t("stats.feedings")} value={String(today.feedings)} />
        <Tile
          tone="feed"
          icon={<Timer aria-hidden className="size-3.5" />}
          label={t("stats.avgInterval")}
          value={interval ? formatElapsed(interval * MIN) : "-"}
          sub={t("stats.last7days")}
        />
        <Tile tone="diaper" icon={<Droplets aria-hidden className="size-3.5" />} label={t("stats.diapers")} value={String(today.diapers)} />
      </div>
    </Card>
  );
}
