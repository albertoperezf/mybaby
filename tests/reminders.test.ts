import { describe, expect, it } from "vitest";
import type { Reminder } from "@/db/types";
import { applyQuietHours, isDue, isInQuietHours, nextFeedingFire, nextOccurrence } from "@/features/reminders/schedule";
import { buildIcs, escapeIcs, foldLine } from "@/lib/ics";

const at = (iso: string) => new Date(iso).getTime(); // TZ=UTC in vitest config
const quiet = { enabled: true, start: "22:00", end: "07:00" };

describe("quiet hours", () => {
  it("detects windows that wrap midnight", () => {
    expect(isInQuietHours(at("2026-01-01T23:30:00Z"), quiet)).toBe(true);
    expect(isInQuietHours(at("2026-01-02T03:00:00Z"), quiet)).toBe(true);
    expect(isInQuietHours(at("2026-01-02T07:00:00Z"), quiet)).toBe(false);
    expect(isInQuietHours(at("2026-01-02T12:00:00Z"), quiet)).toBe(false);
    expect(isInQuietHours(at("2026-01-02T03:00:00Z"), { ...quiet, enabled: false })).toBe(false);
  });

  it("pushes an alert in the window to the window end", () => {
    expect(applyQuietHours(at("2026-01-01T23:30:00Z"), quiet)).toBe(at("2026-01-02T07:00:00Z"));
    expect(applyQuietHours(at("2026-01-02T03:00:00Z"), quiet)).toBe(at("2026-01-02T07:00:00Z"));
    expect(applyQuietHours(at("2026-01-02T12:00:00Z"), quiet)).toBe(at("2026-01-02T12:00:00Z"));
  });

  it("handles same-day windows", () => {
    const nap = { enabled: true, start: "13:00", end: "15:00" };
    expect(applyQuietHours(at("2026-01-01T14:00:00Z"), nap)).toBe(at("2026-01-01T15:00:00Z"));
  });
});

describe("feeding interval", () => {
  it("adds the interval to the last feeding", () => {
    expect(nextFeedingFire(at("2026-01-01T12:00:00Z"), 180)).toBe(at("2026-01-01T15:00:00Z"));
  });
  it("defers into the quiet window end when requested", () => {
    expect(nextFeedingFire(at("2026-01-01T20:00:00Z"), 180, quiet)).toBe(at("2026-01-02T07:00:00Z"));
  });
});

describe("nextOccurrence", () => {
  it("one-off in the past has no next time", () => {
    expect(nextOccurrence({ type: "once", at: 1000 }, 2000)).toBeUndefined();
    expect(nextOccurrence({ type: "once", at: 3000 }, 2000)).toBe(3000);
  });

  it("daily picks the earliest time still ahead, else tomorrow", () => {
    const s = { type: "daily" as const, times: ["08:00", "20:00"] };
    expect(nextOccurrence(s, at("2026-01-01T09:00:00Z"))).toBe(at("2026-01-01T20:00:00Z"));
    expect(nextOccurrence(s, at("2026-01-01T21:00:00Z"))).toBe(at("2026-01-02T08:00:00Z"));
  });

  it("weekly honours the day list (2026-01-01 is a Thursday)", () => {
    const s = { type: "weekly" as const, days: [1], times: ["09:00"] }; // Mondays
    expect(nextOccurrence(s, at("2026-01-01T10:00:00Z"))).toBe(at("2026-01-05T09:00:00Z"));
    expect(nextOccurrence({ type: "weekly", days: [], times: ["09:00"] }, 0)).toBeUndefined();
  });
});

describe("isDue", () => {
  const base: Reminder = {
    id: "r1",
    kind: "custom",
    title: "x",
    schedule: { type: "once", at: 0 },
    enabled: true,
    respectQuietHours: false,
    nextFireAt: 1000,
    createdAt: 0,
    updatedAt: 0,
  };
  it("is due once nextFireAt has passed", () => {
    expect(isDue(base, 999)).toBe(false);
    expect(isDue(base, 1000)).toBe(true);
  });
  it("is never due when disabled, deleted or unscheduled", () => {
    expect(isDue({ ...base, enabled: false }, 5000)).toBe(false);
    expect(isDue({ ...base, deletedAt: 1 }, 5000)).toBe(false);
    expect(isDue({ ...base, nextFireAt: undefined }, 5000)).toBe(false);
  });
});

describe("ICS export", () => {
  const r = (over: Partial<Reminder>): Reminder => ({
    id: "abc",
    kind: "vitamin",
    title: "Vitamin D, drops; 1 ml",
    schedule: { type: "daily", times: ["09:00"] },
    enabled: true,
    respectQuietHours: false,
    createdAt: 0,
    updatedAt: 0,
    ...over,
  });
  const now = at("2026-01-01T10:00:00Z");

  it("escapes text", () => {
    expect(escapeIcs("a,b;c\\d\ne")).toBe("a\\,b\\;c\\\\d\\ne");
  });

  it("folds long lines at 75 octets", () => {
    const folded = foldLine("SUMMARY:" + "x".repeat(200));
    for (const line of folded.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(folded.replace(/\r\n /g, "")).toBe("SUMMARY:" + "x".repeat(200));
  });

  it("emits a recurring floating event with an alarm", () => {
    const ics = buildIcs([r({})], (x) => x.title, now);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("RRULE:FREQ=DAILY");
    expect(ics).toContain("DTSTART:20260102T090000");
    expect(ics).toContain("SUMMARY:Vitamin D\\, drops\\; 1 ml");
    expect(ics).toContain("BEGIN:VALARM");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });

  it("emits UTC for one-offs, weekly BYDAY, and skips disabled", () => {
    const once = buildIcs([r({ schedule: { type: "once", at: at("2026-02-03T15:30:00Z") } })], (x) => x.title, now);
    expect(once).toContain("DTSTART:20260203T153000Z");
    const weekly = buildIcs([r({ schedule: { type: "weekly", days: [1, 3], times: ["08:00"] } })], (x) => x.title, now);
    expect(weekly).toContain("RRULE:FREQ=WEEKLY;BYDAY=MO,WE");
    expect(buildIcs([r({ enabled: false })], (x) => x.title, now)).not.toContain("VEVENT");
  });
});
