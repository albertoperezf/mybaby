import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/schema";
import { addBaby, addVisit, restore, softDelete, toggleVisitQuestion, updateVisit } from "@/db/repo";
import { backupJson, buildCsv } from "@/features/backup/export";
import { importBackupText, importCsvText } from "@/features/backup/import";
import { dayBeforeMorningAt, lastProvider, questionProgress, splitVisits } from "@/features/visits/logic";
import { bottleFillLevel } from "@/components/activity-icons";
import type { DoctorVisit } from "@/db/types";

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe("visit logic and icon helpers", () => {
  it("splits upcoming and past visits in the right order", () => {
    const base = { babyId: "b1", questions: [], createdAt: 0, updatedAt: 0 };
    const visits: DoctorVisit[] = [
      { ...base, id: "v1", visitedOn: "2026-06-01", reason: "1-month checkup" },
      { ...base, id: "v2", visitedOn: "2026-06-15", reason: "2-month checkup" },
      { ...base, id: "v3", visitedOn: "2026-06-10", reason: "Today check" },
      { ...base, id: "v4", visitedOn: "2026-05-15", reason: "Newborn visit" },
    ];
    const { upcoming, past } = splitVisits(visits, "2026-06-10");
    expect(upcoming.map((v) => v.id)).toEqual(["v3", "v2"]);
    expect(past.map((v) => v.id)).toEqual(["v1", "v4"]);
  });

  it("finds last provider and computes question progress", () => {
    const base = { babyId: "b1", reason: "Checkup", questions: [], createdAt: 0, updatedAt: 0 };
    const visits: DoctorVisit[] = [
      { ...base, id: "v1", visitedOn: "2026-05-01", provider: "Clinic A" },
      { ...base, id: "v2", visitedOn: "2026-06-01", provider: "Dr. Patel" },
      { ...base, id: "v3", visitedOn: "2026-06-10" },
    ];
    expect(lastProvider(visits)).toBe("Dr. Patel");
    expect(
      questionProgress([
        { id: "q1", text: "Vitamin D?", done: true },
        { id: "q2", text: "Sleep?", done: false },
      ]),
    ).toEqual({ done: 1, total: 2 });
  });

  it("computes day-before 9 AM timestamp only for future dates", () => {
    const now = new Date(2026, 5, 10, 10, 0, 0).getTime();
    expect(dayBeforeMorningAt("2026-06-10", now)).toBeNull();
    const ts = dayBeforeMorningAt("2026-06-15", now);
    expect(ts).not.toBeNull();
    const d = new Date(ts as number);
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 5, 14, 9]);
  });

  it("scales bottle fill levels monotonically with volume", () => {
    expect(bottleFillLevel(60)).toBeLessThan(bottleFillLevel(90));
    expect(bottleFillLevel(90)).toBeLessThan(bottleFillLevel(120));
    expect(bottleFillLevel(250)).toBeLessThanOrEqual(0.95);
    expect(bottleFillLevel(10)).toBeGreaterThanOrEqual(0.2);
  });
});

describe("visit repo, CSV, and v1/v2 JSON backup round-trip", () => {
  it("adds, toggles questions, updates, soft-deletes, restores, and round-trips CSV & JSON", async () => {
    const baby = await addBaby({ name: "Ada", birthDate: "2026-05-01" });
    const v = await addVisit(baby.id, {
      visitedOn: "2026-06-15",
      reason: "2-month checkup",
      provider: "Dr. Patel",
      questions: [
        { id: "q1", text: "Tummy time?", done: false },
        { id: "q2", text: "Vitamin D drops?", done: true },
      ],
      summary: "Growing well, keep feeding on demand.",
      followUpOn: "2026-08-15",
    });

    await toggleVisitQuestion(v.id, "q1");
    expect((await db.visits.get(v.id))?.questions.find((q) => q.id === "q1")?.done).toBe(true);

    await updateVisit(v.id, { provider: "City Pediatrics" });
    expect((await db.visits.get(v.id))?.provider).toBe("City Pediatrics");

    await softDelete("visits", [v.id]);
    expect((await db.visits.get(v.id))?.deletedAt).toBeDefined();
    await restore("visits", [v.id]);
    expect((await db.visits.get(v.id))?.deletedAt).toBeUndefined();

    // CSV round-trip
    const csv = await buildCsv("visits");
    expect(csv).toContain("2-month checkup");
    expect(csv).toContain("City Pediatrics");
    expect(csv).toContain("[x] Tummy time?");

    await db.visits.clear();
    const csvRes = await importCsvText(csv, baby.id);
    expect(csvRes).toMatchObject({ kind: "visits", added: 1, invalid: 0 });
    const [restoredCsv] = await db.visits.toArray();
    expect(restoredCsv.reason).toBe("2-month checkup");
    expect(restoredCsv.questions).toHaveLength(2);
    expect(restoredCsv.questions[0]).toMatchObject({ text: "Tummy time?", done: true });

    // JSON v2 round-trip + v1 compatibility
    const json = await backupJson();
    await db.visits.clear();
    await importBackupText(json, "merge", false);
    expect(await db.visits.count()).toBe(1);

    const v1Payload = JSON.parse(json);
    v1Payload.schemaVersion = 1;
    delete v1Payload.data.visits;
    await importBackupText(JSON.stringify(v1Payload), "merge", false);
    expect(await db.visits.count()).toBe(1);
  });
});
