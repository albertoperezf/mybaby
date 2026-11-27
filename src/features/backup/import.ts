import { ulid } from "ulid";
import { db } from "@/db/schema";
import { getSetting, deviceId, setSetting } from "@/db/settings";
import { DATA_TABLES, type DataTableName, type ID, type Reminder, type VaccineScheduleId } from "@/db/types";
import {
  backupSchema,
  diaperSchema,
  feedingSchema,
  measurementSchema,
  medicationSchema,
  sleepSchema,
  vaccineSchema,
  type BackupData,
  type BackupFile,
} from "@/db/zod";
import { SCHEDULES } from "@/features/vaccines/schedule-data";
import { applyQuietHours, nextOccurrence } from "@/features/reminders/schedule";
import { deviceTz } from "@/lib/time";
import { trackFeature } from "@/lib/telemetry";
import { ozToMl } from "@/lib/units";
import { csvToObjects, unguardText } from "./csv";
import type { CsvKind } from "./export";

export class ImportError extends Error {}

export interface ImportSummary {
  added: number;
  updated: number;
  skipped: number;
  invalid: number;
}

const MAX_BYTES = 50 * 1024 * 1024;
const emptySummary = (): ImportSummary => ({ added: 0, updated: 0, skipped: 0, invalid: 0 });

type Strategy = "newer-wins" | "add-only";
type Row = { id: string; updatedAt?: number; babyId?: string };

async function mergeTable(name: DataTableName, rows: Row[], strategy: Strategy, summary: ImportSummary, babyIds: Set<ID>) {
  const table = db.table<Row, string>(name);
  const usable = rows.filter((r) => {
    const needsBaby = name !== "babies" && !(name === "reminders" && r.babyId === undefined);
    const ok = !needsBaby || (r.babyId !== undefined && babyIds.has(r.babyId));
    if (!ok) summary.invalid++;
    return ok;
  });
  const existing = await table.bulkGet(usable.map((r) => r.id));
  const toPut: Row[] = [];
  usable.forEach((row, i) => {
    const current = existing[i];
    if (!current) {
      summary.added++;
      toPut.push(row);
    } else if (strategy === "newer-wins" && (row.updatedAt ?? 0) > (current.updatedAt ?? 0)) {
      summary.updated++;
      toPut.push(row);
    } else summary.skipped++;
  });
  await table.bulkPut(toPut);
}

/** A restored reminder must not fire immediately just because its saved time has passed. */
async function normalizeReminder(r: Reminder, now: number): Promise<Reminder> {
  if (r.nextFireAt === undefined || r.nextFireAt > now) return { ...r, notifiedFor: undefined };
  const { schedule } = r;
  if (schedule.type === "daily" || schedule.type === "weekly") {
    let next = nextOccurrence(schedule, now);
    if (next !== undefined && r.respectQuietHours) {
      const q = await getSetting("quietHours");
      if (q) next = applyQuietHours(next, q);
    }
    return { ...r, nextFireAt: next, notifiedFor: undefined };
  }
  return { ...r, nextFireAt: undefined, enabled: schedule.type === "once" ? false : r.enabled, notifiedFor: undefined };
}

export async function mergeData(data: BackupData, mode: "merge" | "replace", strategy: Strategy = "newer-wins"): Promise<ImportSummary> {
  const summary = emptySummary();
  const now = Date.now();
  const reminders = await Promise.all(data.reminders.map((r) => normalizeReminder(r as Reminder, now)));
  const tables = DATA_TABLES.map((n) => db.table(n));

  await db.transaction("rw", tables, async () => {
    if (mode === "replace") await Promise.all(tables.map((t) => t.clear()));
    const babyIds = new Set<ID>((await db.babies.toCollection().primaryKeys()) as ID[]);
    data.babies.forEach((b) => babyIds.add(b.id));
    const payload: Record<DataTableName, Row[]> = { ...data, reminders } as unknown as Record<DataTableName, Row[]>;
    for (const name of DATA_TABLES) await mergeTable(name, payload[name], strategy, summary, babyIds);
  });
  return summary;
}

export async function importBackupText(text: string, mode: "merge" | "replace", applySettings: boolean): Promise<ImportSummary> {
  if (text.length > MAX_BYTES) throw new ImportError("file-too-large");
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new ImportError("not-json");
  }
  const parsed = backupSchema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new ImportError(`invalid:${issue.path.join(".")}: ${issue.message}`);
  }
  const file: BackupFile = parsed.data;
  const summary = await mergeData(file.data, mode);
  if (applySettings && file.settings) {
    for (const [key, value] of Object.entries(file.settings)) {
      if (value !== undefined) await setSetting(key as never, value as never);
    }
  }
  if (!(await getSetting("activeBabyId"))) {
    const first = await db.babies.toCollection().first();
    if (first) await setSetting("activeBabyId", first.id);
  }
  await deviceId();
  trackFeature("backup_import");
  return summary;
}

export function detectCsvKind(header: string[]): CsvKind | null {
  const h = new Set(header);
  if (h.has("started_iso")) return "sleeps";
  if (h.has("code") && (h.has("given_on") || h.has("due_on"))) return "vaccines";
  if (h.has("time_iso") && h.has("dose") && h.has("unit")) return "medications";
  if (h.has("time_iso") && h.has("type")) return "diapers";
  if (h.has("time_iso") && (h.has("amount_ml") || h.has("amount_oz") || h.has("kind"))) return "feedings";
  if (h.has("date") && (h.has("weight_g") || h.has("weight_kg") || h.has("length_mm") || h.has("head_mm"))) return "measurements";
  return null;
}

const num = (v: string | undefined) => (v !== undefined && v !== "" && Number.isFinite(Number(v)) ? Number(v) : undefined);

export async function importCsvText(text: string, fallbackBabyId: ID): Promise<ImportSummary & { kind: CsvKind }> {
  if (text.length > MAX_BYTES) throw new ImportError("file-too-large");
  const rows = csvToObjects(text);
  const kind = rows[0] ? detectCsvKind(Object.keys(rows[0])) : null;
  if (!kind) throw new ImportError("unknown-csv");

  const babies = await db.babies.toArray();
  const known = new Set(babies.map((b) => b.id));
  const byName = new Map(babies.map((b) => [b.name.toLowerCase(), b.id]));
  const resolveBaby = (r: Record<string, string>) =>
    (r.baby_id && known.has(r.baby_id) ? r.baby_id : undefined) ?? byName.get((r.baby_name ?? "").toLowerCase()) ?? fallbackBabyId;

  const now = Date.now();
  const device = await deviceId();
  const base = { createdAt: now, updatedAt: now, deviceId: device };
  const invalid: number[] = [];
  const records: Row[] = [];

  rows.forEach((r, i) => {
    const common = { id: r.id || ulid(), babyId: resolveBaby(r), ...base };
    let result;
    if (kind === "feedings") {
      const at = Date.parse(r.time_iso);
      const ml = num(r.amount_ml) ?? (num(r.amount_oz) !== undefined ? ozToMl(num(r.amount_oz) as number) : undefined);
      result = feedingSchema.safeParse({
        ...common,
        kind: r.kind || "bottle",
        at,
        tz: r.tz || deviceTz(),
        amountMl: ml,
        enteredUnit: r.entered_unit === "oz" || r.entered_unit === "ml" ? r.entered_unit : undefined,
        milk: r.milk || undefined,
        side: r.side === "left" || r.side === "right" || r.side === "both" ? r.side : undefined,
        durationSec: num(r.duration_sec),
        note: r.note ? unguardText(r.note) : undefined,
      });
    } else if (kind === "sleeps") {
      result = sleepSchema.safeParse({
        ...common,
        startedAt: Date.parse(r.started_iso),
        endedAt: r.ended_iso ? Date.parse(r.ended_iso) : undefined,
        tz: r.tz || deviceTz(),
        note: r.note ? unguardText(r.note) : undefined,
      });
    } else if (kind === "vaccines") {
      const template = SCHEDULES[r.schedule as VaccineScheduleId]?.doses.find((d) => d.code === r.code);
      result = vaccineSchema.safeParse({
        ...common,
        code: r.code,
        vaccine: r.vaccine || undefined,
        dose: num(r.dose),
        scheduleId: r.schedule || undefined,
        name: unguardText(r.name ?? ""),
        dueOn: r.due_on || undefined,
        windowFrom: r.window_from || undefined,
        windowTo: r.window_to || undefined,
        afterCode: template?.after,
        minGapDays: template?.minGapDays,
        optional: r.optional === "yes" ? true : undefined,
        givenOn: r.given_on || undefined,
        skippedOn: r.skipped_on || undefined,
        lot: r.lot ? unguardText(r.lot) : undefined,
        provider: r.provider ? unguardText(r.provider) : undefined,
        note: r.note ? unguardText(r.note) : undefined,
      });
    } else if (kind === "medications") {
      result = medicationSchema.safeParse({
        ...common,
        name: unguardText(r.name ?? ""),
        dose: num(r.dose),
        unit: unguardText(r.unit ?? ""),
        at: Date.parse(r.time_iso),
        tz: r.tz || deviceTz(),
        note: r.note ? unguardText(r.note) : undefined,
      });
    } else if (kind === "diapers") {
      result = diaperSchema.safeParse({
        ...common,
        at: Date.parse(r.time_iso),
        tz: r.tz || deviceTz(),
        type: r.type,
        note: r.note ? unguardText(r.note) : undefined,
      });
    } else {
      const weightG = num(r.weight_g) ?? (num(r.weight_kg) !== undefined ? Math.round((num(r.weight_kg) as number) * 1000) : undefined);
      result = measurementSchema.safeParse({
        ...common,
        measuredOn: r.date,
        weightG,
        lengthMm: num(r.length_mm),
        headMm: num(r.head_mm),
        source: r.source === "home" ? "home" : "doctor",
        note: r.note ? unguardText(r.note) : undefined,
      });
    }
    if (result.success) records.push(result.data as Row);
    else invalid.push(i);
  });

  const summary = emptySummary();
  summary.invalid = invalid.length;
  const babyIds = new Set<ID>(known);
  await db.transaction("rw", db.table(kind), async () => {
    await mergeTable(kind, records, "add-only", summary, babyIds);
  });
  return { ...summary, kind };
}
