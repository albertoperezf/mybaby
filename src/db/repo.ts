import { ulid } from "ulid";
import { db } from "./schema";
import { deviceId, getSetting, setSetting } from "./settings";
import type { Baby, Diaper, DiaperType, Feeding, ID, Measurement, Sleep } from "./types";
import { deviceTz } from "@/lib/time";

export const BABY_COLORS = ["#e07a5f", "#f2a65a", "#81b29a", "#8e7dbe", "#e56b9a", "#4fa3b8"];
export const BABY_AVATARS = ["🐣", "🧸", "🌙", "⭐", "🐻", "🦊", "🐰", "🌼"];

export async function stamp() {
  const now = Date.now();
  return { createdAt: now, updatedAt: now, deviceId: await deviceId() };
}

// ---- babies ----------------------------------------------------------------

export type BabyInput = Pick<Baby, "name" | "birthDate" | "sex" | "gestationalWeeks" | "birthWeightG" | "avatar"> & {
  color?: string;
};

export async function addBaby(input: BabyInput): Promise<Baby> {
  const count = await db.babies.count();
  const baby: Baby = {
    id: ulid(),
    ...input,
    color: input.color ?? BABY_COLORS[count % BABY_COLORS.length],
    ...(await stamp()),
  };
  await db.babies.add(baby);
  if (!(await getSetting("activeBabyId"))) await setSetting("activeBabyId", baby.id);
  return baby;
}

export async function updateBaby(id: ID, input: Partial<BabyInput> & Pick<Partial<Baby>, "vaccineSchedule">): Promise<void> {
  await db.babies.update(id, { ...input, updatedAt: Date.now() });
}

export async function setBabyArchived(id: ID, archived: boolean): Promise<void> {
  await db.babies.update(id, { archivedAt: archived ? Date.now() : undefined, updatedAt: Date.now() });
}

/** Permanently removes a baby and every record that belongs to them. */
export async function deleteBabyForever(id: ID): Promise<void> {
  await db.transaction(
    "rw",
    [db.babies, db.feedings, db.diapers, db.measurements, db.sleeps, db.medications, db.vaccines, db.reminders, db.settings],
    async () => {
      for (const table of [db.feedings, db.diapers, db.measurements, db.sleeps, db.medications, db.vaccines]) {
        await table.where("babyId").equals(id).delete();
      }
      await db.reminders.where("babyId").equals(id).delete();
      await db.babies.delete(id);
      if ((await getSetting("activeBabyId")) === id) {
        const next = (await db.babies.toArray()).find((b) => !b.archivedAt && !b.deletedAt);
        await setSetting("activeBabyId", next?.id ?? null);
      }
    },
  );
}

// ---- feedings --------------------------------------------------------------

export interface FeedingInput {
  at: number;
  kind?: Feeding["kind"];
  amountMl?: number;
  enteredUnit?: "oz" | "ml";
  milk?: Feeding["milk"];
  side?: Feeding["side"];
  durationSec?: number;
  note?: string;
}

/** Logs the same feeding for one or more babies (twins). Returns created ids for undo. */
export async function addFeedings(babyIds: ID[], input: FeedingInput): Promise<Feeding[]> {
  const base = await stamp();
  const rows: Feeding[] = babyIds.map((babyId) => ({
    id: ulid(),
    babyId,
    kind: input.kind ?? "bottle",
    tz: deviceTz(),
    ...input,
    ...base,
  }));
  await db.feedings.bulkAdd(rows);
  return rows;
}

export async function updateFeeding(
  id: ID,
  patch: Partial<Pick<Feeding, "at" | "kind" | "amountMl" | "enteredUnit" | "milk" | "side" | "durationSec" | "note">>,
) {
  await db.feedings.update(id, { ...patch, updatedAt: Date.now() });
}

// ---- sleeps ----------------------------------------------------------------

export async function startSleep(babyId: ID, startedAt = Date.now(), note?: string): Promise<Sleep> {
  const row: Sleep = { id: ulid(), babyId, startedAt, tz: deviceTz(), note, ...(await stamp()) };
  await db.sleeps.add(row);
  return row;
}

export async function stopSleep(id: ID, endedAt = Date.now(), note?: string): Promise<void> {
  const patch: Partial<Sleep> = { endedAt, updatedAt: Date.now() };
  if (note !== undefined) patch.note = note;
  await db.sleeps.update(id, patch);
}

export async function addSleeps(babyIds: ID[], input: { startedAt: number; endedAt?: number; note?: string }): Promise<Sleep[]> {
  const base = await stamp();
  const rows: Sleep[] = babyIds.map((babyId) => ({
    id: ulid(),
    babyId,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    tz: deviceTz(),
    note: input.note,
    ...base,
  }));
  await db.sleeps.bulkAdd(rows);
  return rows;
}

export async function updateSleep(id: ID, patch: Partial<Pick<Sleep, "startedAt" | "endedAt" | "note">>): Promise<void> {
  await db.sleeps.update(id, { ...patch, updatedAt: Date.now() });
}

// ---- diapers ---------------------------------------------------------------

export async function addDiapers(babyIds: ID[], type: DiaperType, at = Date.now(), note?: string): Promise<Diaper[]> {
  const base = await stamp();
  const rows: Diaper[] = babyIds.map((babyId) => ({ id: ulid(), babyId, type, at, tz: deviceTz(), note, ...base }));
  await db.diapers.bulkAdd(rows);
  return rows;
}

// ---- measurements ----------------------------------------------------------

export type MeasurementInput = Pick<Measurement, "measuredOn" | "weightG" | "lengthMm" | "headMm" | "source" | "note">;

export async function addMeasurement(babyId: ID, input: MeasurementInput): Promise<Measurement> {
  const row: Measurement = { id: ulid(), babyId, ...input, ...(await stamp()) };
  await db.measurements.add(row);
  return row;
}

export async function updateMeasurement(id: ID, input: MeasurementInput): Promise<void> {
  await db.measurements.update(id, { ...input, updatedAt: Date.now() });
}

// ---- generic soft delete / undo -------------------------------------------

type SoftTable = "feedings" | "diapers" | "measurements" | "sleeps";

export async function softDelete(table: SoftTable, ids: ID[]): Promise<void> {
  const now = Date.now();
  await db.table(table).bulkUpdate(ids.map((id) => ({ key: id, changes: { deletedAt: now, updatedAt: now } })));
}

export async function restore(table: SoftTable, ids: ID[]): Promise<void> {
  const now = Date.now();
  await db.table(table).bulkUpdate(ids.map((id) => ({ key: id, changes: { deletedAt: undefined, updatedAt: now } })));
}
