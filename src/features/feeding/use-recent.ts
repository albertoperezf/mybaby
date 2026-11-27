"use client";

import { useMemo } from "react";
import { useNow, useApp } from "@/components/app-context";
import { useDiapers, useFeedings, useSleeps } from "@/db/hooks";
import { addLogicalDays, deviceTz, startOfLogicalDay } from "@/lib/time";
import { summarizeDays } from "./stats";

/** Feedings, diapers, sleeps and per-day summaries for the last `days` logical days. */
export function useRecent(days: number) {
  const { baby, settings } = useApp();
  const now = useNow(60_000);
  const tz = deviceTz();

  const since = addLogicalDays(startOfLogicalDay(now, tz, settings.dayStartHour), tz, -(days - 1));

  const feedings = useFeedings(baby.id, since);
  const diapers = useDiapers(baby.id, since);
  const sleeps = useSleeps(baby.id, since);

  const summary = useMemo(
    () =>
      feedings && diapers
        ? summarizeDays(feedings, diapers, { days, tz, dayStartHour: settings.dayStartHour, now })
        : undefined,
    [feedings, diapers, days, tz, settings.dayStartHour, now],
  );

  return { feedings, diapers, sleeps, summary, now, since };
}
