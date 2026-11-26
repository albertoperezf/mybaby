import type { QuietHours, Reminder, Schedule } from "@/db/types";
import { MIN, parseHm } from "@/lib/time";

const minutesOfDay = (d: Date) => d.getHours() * 60 + d.getMinutes();

export function isInQuietHours(at: number, q: QuietHours): boolean {
  if (!q.enabled) return false;
  const s = parseHm(q.start);
  const e = parseHm(q.end);
  const start = s.h * 60 + s.m;
  const end = e.h * 60 + e.m;
  if (start === end) return false;
  const m = minutesOfDay(new Date(at));
  return start < end ? m >= start && m < end : m >= start || m < end;
}

/** Pushes `at` to the end of the quiet window if it falls inside one. */
export function applyQuietHours(at: number, q: QuietHours): number {
  if (!isInQuietHours(at, q)) return at;
  const { h, m } = parseHm(q.end);
  const d = new Date(at);
  d.setHours(h, m, 0, 0);
  if (d.getTime() <= at) d.setDate(d.getDate() + 1);
  return d.getTime();
}

/** Next local-time occurrence strictly after `after` for recurring schedules; `at` for one-offs. */
export function nextOccurrence(schedule: Schedule, after: number): number | undefined {
  if (schedule.type === "once") return schedule.at > after ? schedule.at : undefined;
  if (schedule.type === "interval") return after + schedule.everyMin * MIN;
  if (schedule.times.length === 0) return undefined;
  const days = schedule.type === "weekly" ? new Set(schedule.days) : null;
  if (days && days.size === 0) return undefined;
  let best: number | undefined;
  for (let offset = 0; offset <= 7; offset++) {
    for (const time of schedule.times) {
      const { h, m } = parseHm(time);
      const d = new Date(after);
      d.setDate(d.getDate() + offset);
      d.setHours(h, m, 0, 0);
      if (d.getTime() <= after) continue;
      if (days && !days.has(d.getDay())) continue;
      if (best === undefined || d.getTime() < best) best = d.getTime();
    }
    if (best !== undefined) break;
  }
  return best;
}

export function nextFeedingFire(lastFeedingAt: number, everyMin: number, quiet?: QuietHours): number {
  const at = lastFeedingAt + everyMin * MIN;
  return quiet ? applyQuietHours(at, quiet) : at;
}

export function isDue(r: Reminder, now: number): boolean {
  return r.enabled && !r.deletedAt && r.nextFireAt !== undefined && r.nextFireAt <= now;
}
