import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/schema";
import { addBaby, addMedication, restore, softDelete, updateMedication } from "@/db/repo";
import { buildCsv } from "@/features/backup/export";
import { importCsvText } from "@/features/backup/import";
import { formatDose, groupMedicationsByDay, normalizeMedName, recentMedicines } from "@/features/medications/logic";
import type { Medication } from "@/db/types";

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe("medication logic", () => {
  it("formats doses cleanly", () => {
    expect(formatDose(2.5, "ml")).toBe("2.5 ml");
    expect(formatDose(400, "IU")).toBe("400 IU");
    expect(formatDose(1.256, "ml")).toBe("1.26 ml");
  });

  it("normalizes names and deduplicates recent medicines with today counts", () => {
    expect(normalizeMedName("  Vitamin   D ")).toBe("vitamin d");
    const dayStart = Date.UTC(2026, 5, 10, 4, 0, 0);
    const base = { babyId: "b1", tz: "UTC", createdAt: 0, updatedAt: 0 };
    const meds: Medication[] = [
      { ...base, id: "m1", name: "Vitamin D", dose: 400, unit: "IU", at: dayStart - 3_600_000 },
      { ...base, id: "m2", name: "Acetaminophen", dose: 2.5, unit: "ml", at: dayStart + 1_000 },
      { ...base, id: "m3", name: "acetaminophen ", dose: 3, unit: "ml", at: dayStart + 20_000 },
    ];
    const recent = recentMedicines(meds, dayStart);
    expect(recent).toHaveLength(2);
    expect(recent[0]).toMatchObject({ name: "acetaminophen ", dose: 3, unit: "ml", countToday: 2 });
    expect(recent[1]).toMatchObject({ name: "Vitamin D", dose: 400, unit: "IU", countToday: 0 });
  });

  it("groups medications by logical day newest first", () => {
    const base = { babyId: "b1", tz: "UTC", createdAt: 0, updatedAt: 0 };
    const meds: Medication[] = [
      { ...base, id: "m1", name: "Vit D", dose: 1, unit: "drops", at: Date.UTC(2026, 5, 9, 10, 0) },
      { ...base, id: "m2", name: "Vit D", dose: 1, unit: "drops", at: Date.UTC(2026, 5, 10, 10, 0) },
    ];
    const groups = groupMedicationsByDay(meds, 0);
    expect(groups.map(([k]) => k)).toEqual(["2026-06-10", "2026-06-09"]);
  });
});

describe("medication repo and CSV round-trip", () => {
  it("adds, updates, soft-deletes, restores, and round-trips CSV", async () => {
    const baby = await addBaby({ name: "Ada", birthDate: "2026-05-01" });
    const at = Date.UTC(2026, 5, 10, 14, 30, 0);
    const row = await addMedication(baby.id, { name: "Vitamin D", dose: 400, unit: "IU", at, note: "with feed" });
    await updateMedication(row.id, { dose: 500 });
    expect((await db.medications.get(row.id))?.dose).toBe(500);

    await softDelete("medications", [row.id]);
    expect((await db.medications.get(row.id))?.deletedAt).toBeDefined();
    await restore("medications", [row.id]);
    expect((await db.medications.get(row.id))?.deletedAt).toBeUndefined();

    const csv = await buildCsv("medications");
    expect(csv).toContain("Vitamin D");
    expect(csv).toContain("500");
    expect(csv).toContain("IU");
    expect(csv).toContain("with feed");

    await db.medications.clear();
    const res = await importCsvText(csv, baby.id);
    expect(res).toMatchObject({ kind: "medications", added: 1, invalid: 0 });
    const [restored] = await db.medications.toArray();
    expect(restored).toMatchObject({ name: "Vitamin D", dose: 500, unit: "IU", at, note: "with feed" });
  });
});
