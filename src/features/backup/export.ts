import { db, EXPORT_SCHEMA_VERSION } from "@/db/schema";
import { getSetting, setSetting } from "@/db/settings";
import type { Baby, ID } from "@/db/types";
import { mlToOz } from "@/lib/units";
import { toCsv } from "./csv";
import type { BackupFile } from "@/db/zod";

export type CsvKind = "feedings" | "diapers" | "measurements";

export async function buildBackup(): Promise<BackupFile> {
  const [babies, feedings, diapers, measurements, sleeps, medications, vaccines, reminders] = await Promise.all([
    db.babies.toArray(),
    db.feedings.toArray(),
    db.diapers.toArray(),
    db.measurements.toArray(),
    db.sleeps.toArray(),
    db.medications.toArray(),
    db.vaccines.toArray(),
    db.reminders.toArray(),
  ]);
  const [locale, theme, volumeUnit, measureUnit, defaultIntervalMin, quietHours, dayStartHour] = await Promise.all([
    getSetting("locale"),
    getSetting("theme"),
    getSetting("volumeUnit"),
    getSetting("measureUnit"),
    getSetting("defaultIntervalMin"),
    getSetting("quietHours"),
    getSetting("dayStartHour"),
  ]);
  return {
    app: "mybaby",
    schemaVersion: EXPORT_SCHEMA_VERSION,
    exportedAt: Date.now(),
    settings: { locale, theme, volumeUnit, measureUnit, defaultIntervalMin, quietHours, dayStartHour },
    data: { babies, feedings, diapers, measurements, sleeps, medications, vaccines, reminders },
  };
}

export const backupFilename = (ext: "json" | "csv", stem = "mybaby-backup") =>
  `${stem}-${new Date().toISOString().slice(0, 10)}.${ext}`;

export async function backupJson(): Promise<string> {
  return JSON.stringify(await buildBackup(), null, 2);
}

const isoTime = (ms: number) => new Date(ms).toISOString();

export async function buildCsv(kind: CsvKind): Promise<string> {
  const babies = new Map<ID, Baby>((await db.babies.toArray()).map((b) => [b.id, b]));
  const name = (id: ID) => babies.get(id)?.name ?? "";

  if (kind === "feedings") {
    const rows = (await db.feedings.toArray())
      .filter((f) => !f.deletedAt)
      .sort((a, b) => a.at - b.at)
      .map((f) => ({
        id: f.id,
        baby_id: f.babyId,
        baby_name: name(f.babyId),
        time_iso: isoTime(f.at),
        tz: f.tz,
        kind: f.kind,
        amount_ml: f.amountMl !== undefined ? Math.round(f.amountMl * 10) / 10 : "",
        amount_oz: f.amountMl !== undefined ? Math.round(mlToOz(f.amountMl) * 100) / 100 : "",
        entered_unit: f.enteredUnit ?? "",
        milk: f.milk ?? "",
        note: f.note ?? "",
      }));
    return toCsv(
      ["id", "baby_id", "baby_name", "time_iso", "tz", "kind", "amount_ml", "amount_oz", "entered_unit", "milk", "note"],
      rows,
      ["baby_name", "note"],
    );
  }

  if (kind === "diapers") {
    const rows = (await db.diapers.toArray())
      .filter((d) => !d.deletedAt)
      .sort((a, b) => a.at - b.at)
      .map((d) => ({
        id: d.id,
        baby_id: d.babyId,
        baby_name: name(d.babyId),
        time_iso: isoTime(d.at),
        tz: d.tz,
        type: d.type,
        note: d.note ?? "",
      }));
    return toCsv(["id", "baby_id", "baby_name", "time_iso", "tz", "type", "note"], rows, ["baby_name", "note"]);
  }

  const rows = (await db.measurements.toArray())
    .filter((m) => !m.deletedAt)
    .sort((a, b) => a.measuredOn.localeCompare(b.measuredOn))
    .map((m) => ({
      id: m.id,
      baby_id: m.babyId,
      baby_name: name(m.babyId),
      date: m.measuredOn,
      weight_g: m.weightG ?? "",
      length_mm: m.lengthMm ?? "",
      head_mm: m.headMm ?? "",
      source: m.source,
      note: m.note ?? "",
    }));
  return toCsv(
    ["id", "baby_id", "baby_name", "date", "weight_g", "length_mm", "head_mm", "source", "note"],
    rows,
    ["baby_name", "note"],
  );
}

export async function markBackedUp() {
  await setSetting("lastBackupAt", Date.now());
}
