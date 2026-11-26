import { beforeEach, describe, expect, it } from "vitest";
import { buildCsv, backupJson } from "@/features/backup/export";
import { ImportError, importBackupText, importCsvText } from "@/features/backup/import";
import { addBaby, addDiapers, addFeedings, addMeasurement, deleteBabyForever, restore, softDelete } from "@/db/repo";
import { db } from "@/db/schema";
import { getSetting } from "@/db/settings";
import {
  configureFeedingReminder,
  dismissReminder,
  getFeedingReminder,
  rescheduleFeedingReminder,
  saveCustomReminder,
  snoozeReminder,
} from "@/features/reminders/actions";
import { ozToMl } from "@/lib/units";

async function reset() {
  await Promise.all(db.tables.map((t) => t.clear()));
}

const HOUR = 3_600_000;

describe("repo", () => {
  beforeEach(reset);

  it("first baby becomes active; records are stamped for sync", async () => {
    const baby = await addBaby({ name: "Ada", birthDate: "2026-01-01" });
    expect(await getSetting("activeBabyId")).toBe(baby.id);
    const [f] = await addFeedings([baby.id], { at: 1000, amountMl: ozToMl(3), enteredUnit: "oz" });
    expect(f.id).toHaveLength(26); // ULID
    expect(f.deviceId).toBeTruthy();
    expect(f.updatedAt).toBeGreaterThan(0);
    expect(f.tz).toBeTruthy();
  });

  it("logs the same feeding for twins in one call", async () => {
    const a = await addBaby({ name: "A", birthDate: "2026-01-01" });
    const b = await addBaby({ name: "B", birthDate: "2026-01-01" });
    const rows = await addFeedings([a.id, b.id], { at: 1000, amountMl: 90 });
    expect(rows.map((r) => r.babyId).sort()).toEqual([a.id, b.id].sort());
    expect(await db.feedings.count()).toBe(2);
  });

  it("soft delete + restore (undo)", async () => {
    const baby = await addBaby({ name: "Ada", birthDate: "2026-01-01" });
    const [f] = await addFeedings([baby.id], { at: 1000, amountMl: 90 });
    await softDelete("feedings", [f.id]);
    expect((await db.feedings.get(f.id))?.deletedAt).toBeTypeOf("number");
    await restore("feedings", [f.id]);
    expect((await db.feedings.get(f.id))?.deletedAt).toBeUndefined();
  });

  it("deleting a baby removes their data and moves the active baby", async () => {
    const a = await addBaby({ name: "A", birthDate: "2026-01-01" });
    const b = await addBaby({ name: "B", birthDate: "2026-01-01" });
    await addFeedings([a.id, b.id], { at: 1000, amountMl: 90 });
    await addDiapers([a.id], "wet");
    await addMeasurement(a.id, { measuredOn: "2026-02-01", weightG: 4000, source: "doctor" });
    await deleteBabyForever(a.id);
    expect(await db.feedings.count()).toBe(1);
    expect(await db.diapers.count()).toBe(0);
    expect(await db.measurements.count()).toBe(0);
    expect(await getSetting("activeBabyId")).toBe(b.id);
  });
});

describe("reminders", () => {
  beforeEach(reset);

  it("feeding reminder tracks the latest feeding and clears when there is none", async () => {
    const baby = await addBaby({ name: "Ada", birthDate: "2026-01-01" });
    await configureFeedingReminder(baby.id, { enabled: true, everyMin: 180, respectQuietHours: false });
    expect((await getFeedingReminder(baby.id))?.nextFireAt).toBeUndefined();

    const [f] = await addFeedings([baby.id], { at: 10 * HOUR, amountMl: 90 });
    await rescheduleFeedingReminder(baby.id);
    expect((await getFeedingReminder(baby.id))?.nextFireAt).toBe(13 * HOUR);

    // Undoing the only feeding must not leave a stale (past-due) alert behind.
    await softDelete("feedings", [f.id]);
    await rescheduleFeedingReminder(baby.id);
    expect((await getFeedingReminder(baby.id))?.nextFireAt).toBeUndefined();
  });

  it("snooze moves the alert; dismiss rolls recurring ones forward and retires one-offs", async () => {
    await saveCustomReminder({ kind: "vitamin", title: "Vit D", schedule: { type: "daily", times: ["09:00"] }, respectQuietHours: false });
    await saveCustomReminder({ kind: "appointment", title: "Doctor", schedule: { type: "once", at: Date.now() + HOUR }, respectQuietHours: false });
    const [daily, once] = (await db.reminders.toArray()).sort((a, b) => a.createdAt - b.createdAt || a.title.localeCompare(b.title));
    const dailyR = daily.title === "Vit D" ? daily : once;
    const onceR = daily.title === "Vit D" ? once : daily;

    const before = Date.now();
    await snoozeReminder(onceR.id, 10);
    const snoozed = await db.reminders.get(onceR.id);
    expect(snoozed!.nextFireAt!).toBeGreaterThanOrEqual(before + 10 * 60_000);

    await dismissReminder(onceR);
    expect((await db.reminders.get(onceR.id))!.enabled).toBe(false);

    await dismissReminder(dailyR);
    const rolled = await db.reminders.get(dailyR.id);
    expect(rolled!.enabled).toBe(true);
    expect(rolled!.nextFireAt!).toBeGreaterThan(Date.now());
  });
});

describe("backup", () => {
  beforeEach(reset);

  async function seed() {
    const baby = await addBaby({ name: "Ada", birthDate: "2026-01-01", sex: "female", gestationalWeeks: 34 });
    await addFeedings([baby.id], { at: 1_700_000_000_000, amountMl: 90, enteredUnit: "ml", note: "=cmd" });
    await addDiapers([baby.id], "both", 1_700_000_100_000);
    await addMeasurement(baby.id, { measuredOn: "2026-02-01", weightG: 4200, lengthMm: 540, headMm: 370, source: "doctor", note: "ok" });
    await saveCustomReminder({ kind: "vitamin", title: "Vit D", schedule: { type: "daily", times: ["09:00"] }, respectQuietHours: false, babyId: baby.id });
    return baby;
  }

  it("JSON export -> wipe -> import restores everything", async () => {
    await seed();
    const json = await backupJson();
    await reset();
    const summary = await importBackupText(json, "replace", true);
    expect(summary.invalid).toBe(0);
    expect(await db.babies.count()).toBe(1);
    expect(await db.feedings.count()).toBe(1);
    expect(await db.diapers.count()).toBe(1);
    expect(await db.measurements.count()).toBe(1);
    expect(await db.reminders.count()).toBe(1);
    expect(await getSetting("activeBabyId")).toBeTruthy();
    expect((await db.babies.toArray())[0].gestationalWeeks).toBe(34);
  });

  it("importing the same file again is idempotent (merge)", async () => {
    await seed();
    const json = await backupJson();
    const second = await importBackupText(json, "merge", false);
    expect(second.added).toBe(0);
    expect(second.updated).toBe(0);
    expect(second.skipped).toBeGreaterThan(0);
    expect(await db.feedings.count()).toBe(1);
  });

  it("merge keeps the most recently edited copy and respects tombstones", async () => {
    const baby = await seed();
    const exported = JSON.parse(await backupJson());
    // Pretend the other device edited the feeding later and deleted the diaper.
    exported.data.feedings[0].amountMl = 120;
    exported.data.feedings[0].updatedAt += 5000;
    exported.data.diapers[0].deletedAt = Date.now();
    exported.data.diapers[0].updatedAt += 5000;
    const summary = await importBackupText(JSON.stringify(exported), "merge", false);
    expect(summary.updated).toBe(2);
    expect((await db.feedings.toArray())[0].amountMl).toBe(120);
    expect((await db.diapers.toArray())[0].deletedAt).toBeTypeOf("number");

    // An older copy must not overwrite newer local data.
    exported.data.feedings[0].amountMl = 30;
    exported.data.feedings[0].updatedAt -= 10_000;
    await importBackupText(JSON.stringify(exported), "merge", false);
    expect((await db.feedings.toArray())[0].amountMl).toBe(120);
    expect(baby.id).toBeTruthy();
  });

  it("rejects garbage, wrong app, newer schema, and counts orphans as invalid", async () => {
    await expect(importBackupText("not json", "merge", false)).rejects.toBeInstanceOf(ImportError);
    await expect(importBackupText(JSON.stringify({ app: "other" }), "merge", false)).rejects.toBeInstanceOf(ImportError);
    const future = { app: "mybaby", schemaVersion: 999, exportedAt: 1, data: {} };
    await expect(importBackupText(JSON.stringify(future), "merge", false)).rejects.toBeInstanceOf(ImportError);

    const orphan = {
      app: "mybaby",
      schemaVersion: 1,
      exportedAt: 1,
      data: {
        feedings: [{ id: "f1", babyId: "missing", kind: "bottle", at: 1, tz: "UTC", createdAt: 1, updatedAt: 1 }],
      },
    };
    const summary = await importBackupText(JSON.stringify(orphan), "merge", false);
    expect(summary.invalid).toBe(1);
    expect(await db.feedings.count()).toBe(0);
  });

  it("CSV export -> import into another baby profile is idempotent and un-guards text", async () => {
    const baby = await seed();
    const csv = await buildCsv("feedings");
    expect(csv).toContain("'=cmd"); // formula guard on export

    const again = await importCsvText(csv, baby.id);
    expect(again.kind).toBe("feedings");
    expect(again.added).toBe(0);
    expect(again.skipped).toBe(1);

    await db.feedings.clear();
    const restored = await importCsvText(csv, baby.id);
    expect(restored.added).toBe(1);
    expect((await db.feedings.toArray())[0].note).toBe("=cmd");

    const growth = await buildCsv("measurements");
    await db.measurements.clear();
    expect((await importCsvText(growth, baby.id)).added).toBe(1);
    expect((await db.measurements.toArray())[0].weightG).toBe(4200);

    const diapers = await buildCsv("diapers");
    await db.diapers.clear();
    expect((await importCsvText(diapers, baby.id)).added).toBe(1);
  });

  it("CSV rows with bad data are skipped, unknown CSV is rejected", async () => {
    const baby = await seed();
    const bad = "time_iso,amount_ml,kind\nnot-a-date,90,bottle\n2026-01-01T00:00:00Z,90,bottle\n";
    const res = await importCsvText(bad, baby.id);
    expect(res.invalid).toBe(1);
    expect(res.added).toBe(1);
    await expect(importCsvText("foo,bar\n1,2\n", baby.id)).rejects.toBeInstanceOf(ImportError);
  });
});
