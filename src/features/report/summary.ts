import type { Diaper, Feeding, Sleep } from "@/db/types";
import { averageIntervalMin } from "@/features/feeding/stats";
import { addLogicalDays, dayKey, startOfLogicalDay } from "@/lib/time";

export interface DayReportRow {
  key: string;
  start: number;
  end: number;
  feedings: number;
  bottleMl: number;
  breastCount: number;
  breastSec: number;
  pumpCount: number;
  pumpMl: number;
  wet: number;
  dirty: number;
  both: number;
  dry: number;
  diapers: number;
  sleepSec: number;
  sleepCount: number;
}

export interface DailyReportSummary {
  rows: DayReportRow[];
  activeDays: number;
  avgFeedingsPerDay: number | null;
  avgBottleMlPerDay: number | null;
  avgDiapersPerDay: number | null;
  avgWetPerDay: number | null;
  avgSleepSecPerDay: number | null;
  avgIntervalMin: number | null;
}

/** Builds per-logical-day totals and averages for the pediatrician report (newest day first). */
export function buildDailyReport(
  feedings: Feeding[],
  diapers: Diaper[],
  sleeps: Sleep[],
  opts: { days: number; tz: string; dayStartHour: number; now: number },
): DailyReportSummary {
  const todayStart = startOfLogicalDay(opts.now, opts.tz, opts.dayStartHour);
  const rows: DayReportRow[] = [];

  for (let i = 0; i < opts.days; i++) {
    const start = addLogicalDays(todayStart, opts.tz, -i);
    const end = i === 0 ? opts.now : addLogicalDays(todayStart, opts.tz, -(i - 1));
    rows.push({
      key: dayKey(start, opts.tz, opts.dayStartHour),
      start,
      end,
      feedings: 0,
      bottleMl: 0,
      breastCount: 0,
      breastSec: 0,
      pumpCount: 0,
      pumpMl: 0,
      wet: 0,
      dirty: 0,
      both: 0,
      dry: 0,
      diapers: 0,
      sleepSec: 0,
      sleepCount: 0,
    });
  }

  const byKey = new Map(rows.map((r) => [r.key, r]));
  const windowStart = rows[rows.length - 1]?.start ?? todayStart;

  for (const f of feedings) {
    const row = byKey.get(dayKey(f.at, f.tz, opts.dayStartHour));
    if (!row) continue;
    if (f.kind === "pump") {
      row.pumpCount += 1;
      row.pumpMl += f.amountMl ?? 0;
    } else {
      row.feedings += 1;
      if (f.kind === "breast") {
        row.breastCount += 1;
        row.breastSec += f.durationSec ?? 0;
      } else {
        row.bottleMl += f.amountMl ?? 0;
      }
    }
  }

  for (const d of diapers) {
    const row = byKey.get(dayKey(d.at, d.tz, opts.dayStartHour));
    if (!row) continue;
    row.diapers += 1;
    row[d.type] += 1;
  }

  for (const s of sleeps) {
    const sleepEnd = s.endedAt ?? opts.now;
    if (sleepEnd <= windowStart || s.startedAt >= opts.now) continue;
    for (const row of rows) {
      const clampedStart = Math.max(s.startedAt, row.start);
      const clampedEnd = Math.min(sleepEnd, row.end);
      if (clampedEnd > clampedStart) {
        row.sleepSec += Math.round((clampedEnd - clampedStart) / 1000);
        row.sleepCount += 1;
      }
    }
  }

  const active = rows.filter((r) => r.feedings > 0 || r.diapers > 0 || r.sleepSec > 0 || r.pumpCount > 0);
  const feedDays = rows.filter((r) => r.feedings > 0);
  const bottleDays = rows.filter((r) => r.bottleMl > 0);
  const diaperDays = rows.filter((r) => r.diapers > 0);
  const sleepDays = rows.filter((r) => r.sleepSec > 0);

  const avg = (list: DayReportRow[], pick: (r: DayReportRow) => number) =>
    list.length ? list.reduce((sum, r) => sum + pick(r), 0) / list.length : null;

  return {
    rows,
    activeDays: active.length,
    avgFeedingsPerDay: avg(feedDays, (r) => r.feedings),
    avgBottleMlPerDay: avg(bottleDays, (r) => r.bottleMl),
    avgDiapersPerDay: avg(diaperDays, (r) => r.diapers),
    avgWetPerDay: avg(diaperDays, (r) => r.wet + r.both),
    avgSleepSecPerDay: avg(sleepDays, (r) => r.sleepSec),
    avgIntervalMin: averageIntervalMin(feedings.filter((f) => f.at >= windowStart)),
  };
}
