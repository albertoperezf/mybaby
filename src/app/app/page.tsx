"use client";

import { useApp } from "@/components/app-context";
import { PageTitle } from "@/components/ui";
import { DailyTotalsChart } from "@/features/feeding/daily-chart";
import { LastFedCard } from "@/features/feeding/last-fed-card";
import { QuickActions } from "@/features/feeding/quick-actions";
import { StatTiles } from "@/features/feeding/stat-tiles";
import { useRecent } from "@/features/feeding/use-recent";
import { BackupNudge, InstallHint } from "@/features/nudges";
import { useT } from "@/i18n";

export default function HomePage() {
  const { baby } = useApp();
  const t = useT();
  const { feedings, summary } = useRecent(8);

  return (
    <div>
      <PageTitle>{baby.name}</PageTitle>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <LastFedCard />
          <QuickActions />
        </div>
        <div className="flex flex-col gap-4">
          {summary && feedings ? (
            <>
              <StatTiles days={summary} feedings={feedings} />
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
    </div>
  );
}
