import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/schema";
import { addBaby, addFeedings, restore, softDelete, startSleep, stopSleep } from "@/db/repo";
import { buildCsv } from "@/features/backup/export";
import { importCsvText } from "@/features/backup/import";
import { averageIntervalMin, summarizeDays, summarizeSleepToday } from "@/features/feeding/stats";
import {
  breastElapsed,
  breastSummarySide,
  formatDurationShort,
  formatStopwatch,
  pauseBreast,
  pausePump,
  pumpElapsed,
  setPumpSide,
  startOrResumePump,
  toggleBreastSide,
} from "@/features/timers/timer-store";
import type { Feeding, Sleep } from "@/db/types";

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe("timer formatting", () => {
  it("formats stopwatches with and without hours", () => {
    expect(formatStopwatch(0)).toBe("00:00");
    expect(formatStopwatch(65)).toBe("01:05");
    expect(formatStopwatch(3661)).toBe("1:01:01");
  });

  it("formats short durations", () => {
    expect(formatDurationShort(10)).toBe("< 1m");
    expect(formatDurationShort(600)).toBe("10m");
    expect(formatDurationShort(3600)).toBe("1h");
    expect(formatDurationShort(5400)).toBe("1h 30m");
  });
});

describe("breast timer state", () => {
  it("accumulates time across side switches and pauses", () => {
    const t0 = 1_000_000;
    let s = toggleBreastSide(null, "b1", "left", t0);
    expect(s.activeSide).toBe("left");
    // 120s on left, then switch to right
    s = toggleBreastSide(s, "b1", "right", t0 + 120_000);
    expect(s.activeSide).toBe("right");
    expect(s.leftSec).toBe(120);
    // 90s on right, then pause
    s = pauseBreast(s, t0 + 210_000);
    expect(s.activeSide).toBeNull();
    const res = breastElapsed(s, t0 + 300_000);
    expect(res).toEqual({ leftSec: 120, rightSec: 90, totalSec: 210 });
    expect(breastSummarySide(res.leftSec, res.rightSec)).toBe("both");
  });

  it("tapping the active side pauses it", () => {
    const t0 = 1_000_000;
    let s = toggleBreastSide(null, "b1", "right", t0);
    s = toggleBreastSide(s, "b1", "right", t0 + 45_000);
    expect(s.activeSide).toBeNull();
    expect(s.rightSec).toBe(45);
    expect(breastSummarySide(s.leftSec, s.rightSec)).toBe("right");
  });
});

describe("pump timer state", () => {
  it("tracks running, paused, and resumed elapsed seconds", () => {
    const t0 = 2_000_000;
    let p = startOrResumePump(null, "b1", "both", t0);
    expect(pumpElapsed(p, t0 + 30_000)).toBe(30);
    p = pausePump(p, t0 + 30_000);
    expect(pumpElapsed(p, t0 + 90_000)).toBe(30);
    p = setPumpSide(p, "left");
    p = startOrResumePump(p, "b1", "left", t0 + 90_000);
    expect(pumpElapsed(p, t0 + 110_000)).toBe(50);
    expect(p.side).toBe("left");
  });
});

describe("sleep and feeding stats", () => {
  it("clips sleep intervals to today and counts ongoing sleep", () => {
    const dayStart = Date.UTC(2026, 5, 10, 4, 0, 0);
    const now = Date.UTC(2026, 5, 10, 12, 0, 0);
    const sleeps: Sleep[] = [
      // Started 1h before dayStart, ended 2h after -> 2h counts today
      { id: "s1", babyId: "b1", startedAt: dayStart - 3_600_000, endedAt: dayStart + 7_200_000, tz: "UTC", createdAt: 0, updatedAt: 0 },
      // Ongoing sleep started 30m ago
      { id: "s2", babyId: "b1", startedAt: now - 1_800_000, tz: "UTC", createdAt: 0, updatedAt: 0 },
    ];
    const res = summarizeSleepToday(sleeps, dayStart, now);
    expect(res.count).toBe(2);
    expect(res.totalSec).toBe(9000); // 2h 30m
  });

  it("excludes pump sessions from baby feeding totals and intervals while keeping breast feeds", () => {
    const now = Date.UTC(2026, 5, 10, 15, 0, 0);
    const base = { babyId: "b1", tz: "UTC", createdAt: 0, updatedAt: 0 };
    const feedings: Feeding[] = [
      { ...base, id: "f1", kind: "bottle", at: now - 180 * 60_000, amountMl: 90 },
      { ...base, id: "f2", kind: "pump", at: now - 120 * 60_000, amountMl: 120, durationSec: 900 },
      { ...base, id: "f3", kind: "breast", at: now - 60 * 60_000, side: "both", durationSec: 900 },
    ];
    const days = summarizeDays(feedings, [], { days: 1, tz: "UTC", dayStartHour: 0, now });
    expect(days[0].feedings).toBe(2);
    expect(days[0].ml).toBe(90);
    expect(averageIntervalMin(feedings)).toBe(120);
  });
});

describe("sleep repo and CSV round-trip", () => {
  it("starts, stops, soft-deletes, restores, and round-trips sleeps & breast/pump CSV", async () => {
    const baby = await addBaby({ name: "Ada", birthDate: "2026-05-01" });
    const startedAt = Date.UTC(2026, 5, 10, 8, 0, 0);
    const endedAt = Date.UTC(2026, 5, 10, 9, 30, 0);
    const sleep = await startSleep(baby.id, startedAt, "morning nap");
    expect(sleep.endedAt).toBeUndefined();
    await stopSleep(sleep.id, endedAt);

    await softDelete("sleeps", [sleep.id]);
    expect((await db.sleeps.get(sleep.id))?.deletedAt).toBeDefined();
    await restore("sleeps", [sleep.id]);
    expect((await db.sleeps.get(sleep.id))?.deletedAt).toBeUndefined();

    await addFeedings([baby.id], { at: endedAt + 60_000, kind: "breast", side: "left", durationSec: 600, milk: "breastmilk" });

    const sleepCsv = await buildCsv("sleeps");
    const feedCsv = await buildCsv("feedings");
    expect(sleepCsv).toContain("morning nap");
    expect(feedCsv).toContain("breast");
    expect(feedCsv).toContain("left");
    expect(feedCsv).toContain("600");

    await db.sleeps.clear();
    await db.feedings.clear();
    const sRes = await importCsvText(sleepCsv, baby.id);
    const fRes = await importCsvText(feedCsv, baby.id);
    expect(sRes).toMatchObject({ kind: "sleeps", added: 1, invalid: 0 });
    expect(fRes).toMatchObject({ kind: "feedings", added: 1, invalid: 0 });

    const restoredSleep = await db.sleeps.get(sleep.id);
    expect(restoredSleep?.startedAt).toBe(startedAt);
    expect(restoredSleep?.endedAt).toBe(endedAt);
    const [restoredFeed] = await db.feedings.toArray();
    expect(restoredFeed.kind).toBe("breast");
    expect(restoredFeed.side).toBe("left");
    expect(restoredFeed.durationSec).toBe(600);
  });
});
