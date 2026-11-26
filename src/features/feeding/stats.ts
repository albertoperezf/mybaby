import type { Diaper, Feeding } from "@/db/types";
import { MIN, addLogicalDays, dayKey, startOfLogicalDay } from "@/lib/time";

export interface DaySummary {
  key: string;
  start: number;
  ml: number;
  feedings: number;
  diapers: number;
}

/** One entry per logical day, oldest first, ending with the day containing `now`. */
export function summarizeDays(
  feedings: Feeding[],
  diapers: Diaper[],
  opts: { days: number; tz: string; dayStartHour: number; now: number },
): DaySummary[] {
  const todayStart = startOfLogicalDay(opts.now, opts.tz, opts.dayStartHour);
  const out: DaySummary[] = [];
  for (let i = opts.days - 1; i >= 0; i--) {
    const start = addLogicalDays(todayStart, opts.tz, -i);
    out.push({ key: dayKey(start, opts.tz, opts.dayStartHour), start, ml: 0, feedings: 0, diapers: 0 });
  }
  const byKey = new Map(out.map((d) => [d.key, d]));
  for (const f of feedings) {
    const d = byKey.get(dayKey(f.at, f.tz, opts.dayStartHour));
    if (!d) continue;
    d.feedings += 1;
    d.ml += f.amountMl ?? 0;
  }
  for (const x of diapers) {
    const d = byKey.get(dayKey(x.at, x.tz, opts.dayStartHour));
    if (d) d.diapers += 1;
  }
  return out;
}

/** Mean gap between consecutive feedings, ignoring gaps longer than `maxGapMin` (e.g. a missed log). */
export function averageIntervalMin(feedings: Feeding[], maxGapMin = 12 * 60): number | null {
  const times = feedings.map((f) => f.at).sort((a, b) => a - b);
  const gaps: number[] = [];
  for (let i = 1; i < times.length; i++) {
    const gap = (times[i] - times[i - 1]) / MIN;
    if (gap > 0 && gap <= maxGapMin) gaps.push(gap);
  }
  return gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : null;
}

/** Average daily volume across days that have data. */
export function averageDailyMl(days: DaySummary[]): number | null {
  const withData = days.filter((d) => d.ml > 0);
  return withData.length ? withData.reduce((a, d) => a + d.ml, 0) / withData.length : null;
}
