import { ulid } from "ulid";
import { db } from "@/db/schema";
import { deviceId, getSetting } from "@/db/settings";
import type { ID, Reminder, ReminderKind, Schedule } from "@/db/types";
import { MIN } from "@/lib/time";
import { applyQuietHours, nextFeedingFire, nextOccurrence } from "./schedule";

export const SNOOZE_OPTIONS_MIN = [5, 10, 15, 30] as const;

const defaultQuiet = { enabled: false, start: "22:00", end: "07:00" };
const quiet = async () => (await getSetting("quietHours")) ?? defaultQuiet;

export async function getFeedingReminder(babyId: ID): Promise<Reminder | undefined> {
  return db.reminders
    .where("babyId")
    .equals(babyId)
    .filter((r) => r.kind === "feeding-interval" && !r.deletedAt)
    .first();
}

async function lastFeedingAt(babyId: ID): Promise<number | undefined> {
  const last = await db.feedings
    .where("[babyId+at]")
    .between([babyId, 0], [babyId, Number.MAX_SAFE_INTEGER])
    .filter((f) => !f.deletedAt && f.kind !== "pump")
    .last();
  return last?.at;
}

/** Re-derives the "next feeding" alert from the latest feeding; call after any feeding add/edit/undo. */
export async function rescheduleFeedingReminder(babyId: ID): Promise<void> {
  const r = await getFeedingReminder(babyId);
  if (!r || !r.enabled || r.schedule.type !== "interval") return;
  const last = await lastFeedingAt(babyId);
  await db.reminders.update(r.id, {
    nextFireAt:
      last === undefined
        ? undefined
        : nextFeedingFire(last, r.schedule.everyMin, r.respectQuietHours ? await quiet() : undefined),
    notifiedFor: undefined,
    updatedAt: Date.now(),
  });
}

export async function configureFeedingReminder(babyId: ID, opts: { enabled: boolean; everyMin: number; respectQuietHours: boolean }) {
  const existing = await getFeedingReminder(babyId);
  const schedule: Schedule = { type: "interval", everyMin: opts.everyMin };
  const now = Date.now();
  const last = await lastFeedingAt(babyId);
  const q = opts.respectQuietHours ? await quiet() : undefined;
  const nextFireAt = opts.enabled && last !== undefined ? nextFeedingFire(last, opts.everyMin, q) : undefined;
  if (existing) {
    await db.reminders.update(existing.id, {
      schedule,
      enabled: opts.enabled,
      respectQuietHours: opts.respectQuietHours,
      nextFireAt,
      notifiedFor: undefined,
      updatedAt: now,
    });
    return;
  }
  await db.reminders.add({
    id: ulid(),
    babyId,
    kind: "feeding-interval",
    title: "",
    schedule,
    enabled: opts.enabled,
    respectQuietHours: opts.respectQuietHours,
    nextFireAt,
    createdAt: now,
    updatedAt: now,
    deviceId: await deviceId(),
  });
}

export interface CustomReminderInput {
  babyId?: ID;
  kind: Exclude<ReminderKind, "feeding-interval">;
  title: string;
  schedule: Schedule;
  respectQuietHours: boolean;
}

async function firstFire(schedule: Schedule, respectQuietHours: boolean): Promise<number | undefined> {
  const at = nextOccurrence(schedule, Date.now());
  if (at === undefined) return undefined;
  return respectQuietHours ? applyQuietHours(at, await quiet()) : at;
}

export async function saveCustomReminder(input: CustomReminderInput, id?: ID): Promise<void> {
  const now = Date.now();
  const nextFireAt = await firstFire(input.schedule, input.respectQuietHours);
  if (id) {
    await db.reminders.update(id, { ...input, enabled: true, nextFireAt, notifiedFor: undefined, updatedAt: now });
    return;
  }
  await db.reminders.add({
    id: ulid(),
    ...input,
    enabled: true,
    nextFireAt,
    createdAt: now,
    updatedAt: now,
    deviceId: await deviceId(),
  });
}

export async function setReminderEnabled(r: Reminder, enabled: boolean): Promise<void> {
  const nextFireAt = enabled
    ? r.kind === "feeding-interval"
      ? undefined
      : await firstFire(r.schedule, r.respectQuietHours)
    : undefined;
  await db.reminders.update(r.id, { enabled, nextFireAt, notifiedFor: undefined, updatedAt: Date.now() });
}

export async function deleteReminder(id: ID): Promise<void> {
  const now = Date.now();
  await db.reminders.update(id, { deletedAt: now, enabled: false, updatedAt: now });
}

export async function snoozeReminder(id: ID, minutes: number): Promise<void> {
  await db.reminders.update(id, { nextFireAt: Date.now() + minutes * MIN, updatedAt: Date.now() });
}

/** Dismiss: recurring reminders roll to their next occurrence; one-offs and feeding timers clear. */
export async function dismissReminder(r: Reminder): Promise<void> {
  const now = Date.now();
  let nextFireAt: number | undefined;
  let enabled = r.enabled;
  if (r.schedule.type === "daily" || r.schedule.type === "weekly") {
    nextFireAt = nextOccurrence(r.schedule, now);
    if (nextFireAt !== undefined && r.respectQuietHours) nextFireAt = applyQuietHours(nextFireAt, await quiet());
  } else if (r.schedule.type === "once") {
    enabled = false;
  }
  await db.reminders.update(r.id, { nextFireAt, enabled, lastDismissedAt: now, notifiedFor: undefined, updatedAt: now });
}

export async function markNotified(id: ID, fireAt: number): Promise<void> {
  await db.reminders.update(id, { notifiedFor: fireAt });
}
