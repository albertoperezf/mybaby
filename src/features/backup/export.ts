import { db, EXPORT_SCHEMA_VERSION } from "@/db/schema";
import { getSetting, setSetting } from "@/db/settings";
import type { Baby, ID } from "@/db/types";
import { mlToOz } from "@/lib/units";
import { trackFeature } from "@/lib/telemetry";
import { vaccineName } from "@/features/vaccines/labels";
import { toCsv } from "./csv";
import type { BackupFile } from "@/db/zod";

export type CsvKind = "feedings" | "diapers" | "measurements" | "vaccines" | "sleeps" | "medications" | "visits";

export interface BackupOptions {
  /** Limit export to a single baby (used for caregiver share-by-file). */
  babyId?: ID;
  /** Omit device preferences (theme, language, quiet hours) when sharing with another caregiver. */
  includeSettings?: boolean;
  /** Optional lower-bound timestamp (epoch ms) for time-series entries. */
  since?: number;
}

export async function buildBackup(opts: BackupOptions = {}): Promise<BackupFile> {
  const { babyId, includeSettings = true, since } = opts;
  const sinceIso = since !== undefined ? new Date(since).toISOString().slice(0, 10) : undefined;

  const [allBabies, allFeedings, allDiapers, allMeasurements, allSleeps, allMeds, allVaccines, allVisits, allReminders] =
    await Promise.all([
      db.babies.toArray(),
      db.feedings.toArray(),
      db.diapers.toArray(),
      db.measurements.toArray(),
      db.sleeps.toArray(),
      db.medications.toArray(),
      db.vaccines.toArray(),
      db.visits.toArray(),
      db.reminders.toArray(),
    ]);

  const byBaby = <T extends { babyId?: ID }>(rows: T[]) => (babyId ? rows.filter((r) => r.babyId === babyId) : rows);

  const babies = babyId ? allBabies.filter((b) => b.id === babyId) : allBabies;
  const feedings = byBaby(allFeedings).filter((f) => since === undefined || f.at >= since);
  const diapers = byBaby(allDiapers).filter((d) => since === undefined || d.at >= since);
  const measurements = byBaby(allMeasurements).filter((m) => sinceIso === undefined || m.measuredOn >= sinceIso);
  const sleeps = byBaby(allSleeps).filter(
    (s) => since === undefined || s.startedAt >= since || s.endedAt === undefined || s.endedAt >= since,
  );
  const medications = byBaby(allMeds).filter((m) => since === undefined || m.at >= since);
  const vaccines = byBaby(allVaccines);
  const visits = byBaby(allVisits).filter((v) => sinceIso === undefined || v.visitedOn >= sinceIso);
  const reminders = byBaby(allReminders);

  const settings = includeSettings
    ? await (async () => {
        const [locale, theme, volumeUnit, measureUnit, defaultIntervalMin, quietHours, dayStartHour] = await Promise.all([
          getSetting("locale"),
          getSetting("theme"),
          getSetting("volumeUnit"),
          getSetting("measureUnit"),
          getSetting("defaultIntervalMin"),
          getSetting("quietHours"),
          getSetting("dayStartHour"),
        ]);
        return { locale, theme, volumeUnit, measureUnit, defaultIntervalMin, quietHours, dayStartHour };
      })()
    : undefined;

  return {
    app: "mybaby",
    schemaVersion: EXPORT_SCHEMA_VERSION,
    exportedAt: Date.now(),
    ...(settings ? { settings } : {}),
    data: {
      babies,
      feedings,
      diapers,
      measurements,
      sleeps,
      medications,
      vaccines,
      visits,
      // Push bookkeeping belongs to this device only.
      reminders: reminders.map((r) => {
        const copy = { ...r };
        delete copy.pushJobs;
        delete copy.pushEndpoint;
        return copy;
      }),
    },
  };
}

export const backupFilename = (ext: "json" | "csv" | "enc.json", stem = "mybabylog-backup") =>
  `${stem}-${new Date().toISOString().slice(0, 10)}.${ext}`;

export async function backupJson(opts?: BackupOptions): Promise<string> {
  return JSON.stringify(await buildBackup(opts), null, 2);
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
        side: f.side ?? "",
        duration_sec: f.durationSec ?? "",
        note: f.note ?? "",
      }));
    return toCsv(
      ["id", "baby_id", "baby_name", "time_iso", "tz", "kind", "amount_ml", "amount_oz", "entered_unit", "milk", "side", "duration_sec", "note"],
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

  if (kind === "vaccines") {
    const rows = (await db.vaccines.toArray())
      .filter((v) => !v.deletedAt)
      .sort((a, b) => (a.dueOn ?? "").localeCompare(b.dueOn ?? "") || a.code.localeCompare(b.code))
      .map((v) => ({
        id: v.id,
        baby_id: v.babyId,
        baby_name: name(v.babyId),
        code: v.code,
        vaccine: v.vaccine ?? "",
        dose: v.dose ?? "",
        name: vaccineName(v, "en"),
        schedule: v.scheduleId ?? "",
        due_on: v.dueOn ?? "",
        window_from: v.windowFrom ?? "",
        window_to: v.windowTo ?? "",
        given_on: v.givenOn ?? "",
        skipped_on: v.skippedOn ?? "",
        lot: v.lot ?? "",
        provider: v.provider ?? "",
        optional: v.optional ? "yes" : "",
        note: v.note ?? "",
      }));
    return toCsv(
      ["id", "baby_id", "baby_name", "code", "vaccine", "dose", "name", "schedule", "due_on", "window_from", "window_to", "given_on", "skipped_on", "lot", "provider", "optional", "note"],
      rows,
      ["baby_name", "name", "lot", "provider", "note"],
    );
  }

  if (kind === "sleeps") {
    const rows = (await db.sleeps.toArray())
      .filter((s) => !s.deletedAt)
      .sort((a, b) => a.startedAt - b.startedAt)
      .map((s) => ({
        id: s.id,
        baby_id: s.babyId,
        baby_name: name(s.babyId),
        started_iso: isoTime(s.startedAt),
        ended_iso: s.endedAt !== undefined ? isoTime(s.endedAt) : "",
        duration_min: s.endedAt !== undefined ? Math.round(((s.endedAt - s.startedAt) / 60_000) * 10) / 10 : "",
        tz: s.tz,
        note: s.note ?? "",
      }));
    return toCsv(["id", "baby_id", "baby_name", "started_iso", "ended_iso", "duration_min", "tz", "note"], rows, ["baby_name", "note"]);
  }

  if (kind === "medications") {
    const rows = (await db.medications.toArray())
      .filter((m) => !m.deletedAt)
      .sort((a, b) => a.at - b.at)
      .map((m) => ({
        id: m.id,
        baby_id: m.babyId,
        baby_name: name(m.babyId),
        time_iso: isoTime(m.at),
        tz: m.tz,
        name: m.name,
        dose: m.dose,
        unit: m.unit,
        note: m.note ?? "",
      }));
    return toCsv(["id", "baby_id", "baby_name", "time_iso", "tz", "name", "dose", "unit", "note"], rows, [
      "baby_name",
      "name",
      "unit",
      "note",
    ]);
  }

  if (kind === "visits") {
    const rows = (await db.visits.toArray())
      .filter((v) => !v.deletedAt)
      .sort((a, b) => a.visitedOn.localeCompare(b.visitedOn))
      .map((v) => ({
        id: v.id,
        baby_id: v.babyId,
        baby_name: name(v.babyId),
        visited_on: v.visitedOn,
        reason: v.reason,
        provider: v.provider ?? "",
        questions: v.questions.map((q) => `${q.done ? "[x]" : "[ ]"} ${q.text}`).join(" | "),
        summary: v.summary ?? "",
        follow_up_on: v.followUpOn ?? "",
      }));
    return toCsv(
      ["id", "baby_id", "baby_name", "visited_on", "reason", "provider", "questions", "summary", "follow_up_on"],
      rows,
      ["baby_name", "reason", "provider", "questions", "summary"],
    );
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
  trackFeature("backup_export");
}
