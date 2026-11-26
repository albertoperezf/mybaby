"use client";

import { Card } from "@/components/ui";
import { useApp } from "@/components/app-context";
import { useT } from "@/i18n";
import { MIN, formatElapsed } from "@/lib/time";
import { formatVolume } from "@/lib/units";
import { averageDailyMl, averageIntervalMin, type DaySummary } from "./stats";
import type { Feeding } from "@/db/types";

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-2xl bg-surface2 p-3">
      <span className="text-xs font-medium text-muted">{label}</span>
      <span className="text-xl font-bold tabular-nums">{value}</span>
      {sub && <span className="text-xs text-muted">{sub}</span>}
    </div>
  );
}

export function StatTiles({ days, feedings }: { days: DaySummary[]; feedings: Feeding[] }) {
  const { settings } = useApp();
  const t = useT();
  const unit = settings.volumeUnit;
  const today = days[days.length - 1];
  const prior = days.slice(-8, -1);
  const priorAvg = averageDailyMl(prior);
  const interval = averageIntervalMin(feedings);

  const delta =
    priorAvg && today.ml > 0 ? Math.round(((today.ml - priorAvg) / priorAvg) * 100) : null;

  return (
    <Card>
      <div className="grid grid-cols-2 gap-2">
        <Tile
          label={t("stats.todayTotal")}
          value={today.ml > 0 ? formatVolume(today.ml, unit) : "-"}
          sub={delta !== null ? t("stats.vsAverage", { pct: `${delta > 0 ? "+" : ""}${delta}` }) : undefined}
        />
        <Tile label={t("stats.feedings")} value={String(today.feedings)} />
        <Tile
          label={t("stats.avgInterval")}
          value={interval ? formatElapsed(interval * MIN) : "-"}
          sub={t("stats.last7days")}
        />
        <Tile label={t("stats.diapers")} value={String(today.diapers)} />
      </div>
    </Card>
  );
}
