"use client";

import { DailyTotalsChart } from "@/features/feeding/daily-chart";
import { Hero } from "@/features/feeding/hero";
import { QuickActions } from "@/features/feeding/quick-actions";
import { StatTiles } from "@/features/feeding/stat-tiles";
import { TodayTimeline } from "@/features/feeding/timeline";
import { useRecent } from "@/features/feeding/use-recent";
import { BackupNudge, InstallHint } from "@/features/nudges";
import { TimersCard } from "@/features/timers/timers-card";
import { useT } from "@/i18n";

export default function HomePage() {
  const t = useT();
  const { feedings, diapers, sleeps, summary, now } = useRecent(8);
  const ready = summary && feedings && diapers && sleeps;

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="flex flex-col gap-5">
        <Hero />
        <TimersCard />
        <QuickActions />
      </div>
      <div className="flex flex-col gap-5">
        {ready ? (
          <>
            <StatTiles days={summary} feedings={feedings} sleeps={sleeps} now={now} />
            <TodayTimeline
              feedings={feedings}
              diapers={diapers}
              sleeps={sleeps}
              dayStart={summary[summary.length - 1].start}
            />
            <DailyTotalsChart days={summary.slice(-7)} />
          </>
        ) : (
          <div className="h-40" aria-label={t("common.loading")} />
        )}
      </div>
      <div className="flex flex-col gap-4 lg:col-span-2">
        <BackupNudge />
        <InstallHint />
      </div>
    </div>
  );
}
