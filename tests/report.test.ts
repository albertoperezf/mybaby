import { describe, expect, it } from "vitest";
import { buildDailyReport } from "@/features/report/summary";
import type { Diaper, Feeding, Sleep } from "@/db/types";

describe("pediatrician daily report summary", () => {
  it("aggregates feedings, breast, pump, diapers, and clipped sleep per logical day", () => {
    const now = Date.UTC(2026, 5, 10, 18, 0, 0);
    const base = { babyId: "b1", tz: "UTC", createdAt: 0, updatedAt: 0 };

    const feedings: Feeding[] = [
      // Today: 1 bottle (120 ml), 1 breast (15m), 1 pump (90 ml - excluded from baby feedings)
      { ...base, id: "f1", kind: "bottle", at: Date.UTC(2026, 5, 10, 8, 0), amountMl: 120 },
      { ...base, id: "f2", kind: "breast", at: Date.UTC(2026, 5, 10, 11, 0), durationSec: 900, side: "both" },
      { ...base, id: "f3", kind: "pump", at: Date.UTC(2026, 5, 10, 12, 0), amountMl: 90, durationSec: 600 },
      // Yesterday: 1 bottle (90 ml)
      { ...base, id: "f4", kind: "bottle", at: Date.UTC(2026, 5, 9, 10, 0), amountMl: 90 },
    ];

    const diapers: Diaper[] = [
      { ...base, id: "d1", at: Date.UTC(2026, 5, 10, 9, 0), type: "wet" },
      { ...base, id: "d2", at: Date.UTC(2026, 5, 10, 13, 0), type: "both" },
      { ...base, id: "d3", at: Date.UTC(2026, 5, 9, 11, 0), type: "dirty" },
    ];

    const sleeps: Sleep[] = [
      // Spans midnight: 22:00 June 9 -> 06:00 June 10 (2h yesterday, 6h today)
      {
        ...base,
        id: "s1",
        startedAt: Date.UTC(2026, 5, 9, 22, 0),
        endedAt: Date.UTC(2026, 5, 10, 6, 0),
      },
    ];

    const report = buildDailyReport(feedings, diapers, sleeps, {
      days: 7,
      tz: "UTC",
      dayStartHour: 0,
      now,
    });

    expect(report.rows).toHaveLength(7);
    expect(report.activeDays).toBe(2);

    const today = report.rows[0];
    expect(today.key).toBe("2026-06-10");
    expect(today.feedings).toBe(2);
    expect(today.bottleMl).toBe(120);
    expect(today.breastCount).toBe(1);
    expect(today.breastSec).toBe(900);
    expect(today.pumpCount).toBe(1);
    expect(today.pumpMl).toBe(90);
    expect(today.diapers).toBe(2);
    expect(today.wet).toBe(1);
    expect(today.both).toBe(1);
    expect(today.sleepSec).toBe(6 * 3600);

    const yesterday = report.rows[1];
    expect(yesterday.key).toBe("2026-06-09");
    expect(yesterday.feedings).toBe(1);
    expect(yesterday.bottleMl).toBe(90);
    expect(yesterday.dirty).toBe(1);
    expect(yesterday.sleepSec).toBe(2 * 3600);

    expect(report.avgFeedingsPerDay).toBe(1.5);
    expect(report.avgBottleMlPerDay).toBe(105);
    expect(report.avgDiapersPerDay).toBe(1.5);
    expect(report.avgWetPerDay).toBe(1); // (2 wet/both today + 0 yesterday) / 2
    expect(report.avgSleepSecPerDay).toBe(4 * 3600);
  });

  it("returns null averages when there is no data", () => {
    const report = buildDailyReport([], [], [], {
      days: 7,
      tz: "UTC",
      dayStartHour: 0,
      now: Date.UTC(2026, 5, 10, 12, 0),
    });
    expect(report.activeDays).toBe(0);
    expect(report.avgFeedingsPerDay).toBeNull();
    expect(report.avgBottleMlPerDay).toBeNull();
    expect(report.avgSleepSecPerDay).toBeNull();
  });
});
