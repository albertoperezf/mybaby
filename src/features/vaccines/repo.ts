import { ulid } from "ulid";
import { db } from "@/db/schema";
import { stamp, updateBaby } from "@/db/repo";
import type { Baby, ID, Vaccine, VaccineScheduleId } from "@/db/types";
import { buildDoses, rebaseDoses } from "./logic";
import { SCHEDULES } from "./schedule-data";

const live = (babyId: ID) => db.vaccines.where("babyId").equals(babyId).filter((v) => !v.deletedAt).toArray();

/**
 * Chooses (or switches) a baby's schedule. Doses already given, skipped or added by hand are kept;
 * untouched doses of the previous schedule are replaced.
 */
export async function applySchedule(baby: Pick<Baby, "id" | "birthDate">, schedule: VaccineScheduleId | "none"): Promise<void> {
  await updateBaby(baby.id, { vaccineSchedule: schedule });
  const existing = await live(baby.id);
  const keep = existing.filter((v) => v.givenOn || v.skippedOn || v.scheduleId === "custom");
  const now = Date.now();
  const drop = existing.filter((v) => !keep.includes(v));
  if (drop.length) await db.vaccines.bulkUpdate(drop.map((v) => ({ key: v.id, changes: { deletedAt: now, updatedAt: now } })));
  if (schedule === "none") return;

  const taken = new Set(keep.map((v) => v.code));
  const base = await stamp();
  const rows: Vaccine[] = buildDoses(SCHEDULES[schedule], baby.birthDate)
    .filter((d) => !taken.has(d.code))
    .map((d) => ({ id: ulid(), babyId: baby.id, ...d, ...base }));
  await db.vaccines.bulkAdd(rows);
}

export interface GivenInput {
  givenOn: string;
  lot?: string;
  provider?: string;
  note?: string;
}

export async function markGiven(id: ID, input: GivenInput): Promise<void> {
  await db.vaccines.update(id, {
    givenOn: input.givenOn,
    skippedOn: undefined,
    lot: input.lot?.trim() || undefined,
    provider: input.provider?.trim() || undefined,
    note: input.note?.trim() || undefined,
    updatedAt: Date.now(),
  });
}

export async function unmarkGiven(id: ID): Promise<void> {
  await db.vaccines.update(id, { givenOn: undefined, lot: undefined, provider: undefined, updatedAt: Date.now() });
}

export async function skipDose(id: ID, skippedOn: string, note?: string): Promise<void> {
  await db.vaccines.update(id, { skippedOn, givenOn: undefined, note: note?.trim() || undefined, updatedAt: Date.now() });
}

export async function unskipDose(id: ID): Promise<void> {
  await db.vaccines.update(id, { skippedOn: undefined, updatedAt: Date.now() });
}

export async function setDueDate(id: ID, dueOn: string | undefined): Promise<void> {
  await db.vaccines.update(id, { dueOn, updatedAt: Date.now() });
}

export interface CustomInput {
  name: string;
  dueOn?: string;
  givenOn?: string;
  lot?: string;
  provider?: string;
  note?: string;
}

export async function addCustomDose(babyId: ID, input: CustomInput): Promise<Vaccine> {
  const row: Vaccine = {
    id: ulid(),
    babyId,
    code: `custom-${ulid()}`,
    scheduleId: "custom",
    name: input.name.trim(),
    dueOn: input.dueOn || undefined,
    givenOn: input.givenOn || undefined,
    lot: input.lot?.trim() || undefined,
    provider: input.provider?.trim() || undefined,
    note: input.note?.trim() || undefined,
    ...(await stamp()),
  };
  await db.vaccines.add(row);
  return row;
}

export async function deleteCustomDose(id: ID): Promise<void> {
  const now = Date.now();
  await db.vaccines.update(id, { deletedAt: now, updatedAt: now });
}

export async function restoreDose(id: ID): Promise<void> {
  await db.vaccines.update(id, { deletedAt: undefined, updatedAt: Date.now() });
}

/** After a birth-date change: moves untouched doses to match. */
export async function rebaseForBaby(baby: Pick<Baby, "id" | "birthDate" | "vaccineSchedule">): Promise<void> {
  if (!baby.vaccineSchedule || baby.vaccineSchedule === "none") return;
  const changes = rebaseDoses(await live(baby.id), SCHEDULES[baby.vaccineSchedule], baby.birthDate);
  const now = Date.now();
  await db.vaccines.bulkUpdate([...changes.entries()].map(([key, c]) => ({ key, changes: { ...c, updatedAt: now } })));
}
