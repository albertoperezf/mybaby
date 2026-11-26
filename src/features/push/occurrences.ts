import type { QuietHours, Reminder } from "@/db/types";
import { DAY } from "@/lib/time";
import { applyQuietHours, nextOccurrence } from "@/features/reminders/schedule";

/** Scheduling more than this ahead isn't supported by the free tier of the delivery queue. */
export const PUSH_HORIZON_MS = 6 * DAY;
export const MAX_ITEMS_PER_REQUEST = 40;

/** Future fire times to deliver as pushes: the pending alert plus recurring occurrences within the horizon. */
export function upcomingFireTimes(r: Reminder, now: number, quiet: QuietHours): number[] {
  if (!r.enabled || r.deletedAt) return [];
  const horizon = now + PUSH_HORIZON_MS;
  const times = new Set<number>();
  const add = (t: number) => {
    if (t > now + 5_000 && t <= horizon) times.add(t);
  };

  if (r.nextFireAt !== undefined) add(r.nextFireAt);

  const s = r.schedule;
  if (s.type === "daily" || s.type === "weekly") {
    let cursor = now;
    for (let i = 0; i < MAX_ITEMS_PER_REQUEST - 1; i++) {
      const next = nextOccurrence(s, cursor);
      if (next === undefined || next > horizon) break;
      add(r.respectQuietHours ? applyQuietHours(next, quiet) : next);
      cursor = next;
    }
  }
  return [...times].sort((a, b) => a - b).slice(0, MAX_ITEMS_PER_REQUEST);
}
