import { z } from "zod";
import { EXPORT_SCHEMA_VERSION } from "@/db/schema";

const id = z.string().min(1).max(64);
const ts = z.number().int().nonnegative();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const tz = z.string().min(1).max(64);
const note = z.string().max(2000).optional();

const record = {
  createdAt: ts,
  updatedAt: ts,
  deletedAt: ts.optional(),
  deviceId: z.string().max(64).optional(),
};
const owned = { id, babyId: id, ...record };

export const babySchema = z.object({
  id,
  name: z.string().min(1).max(80),
  birthDate: isoDate,
  sex: z.enum(["female", "male"]).optional(),
  gestationalWeeks: z.number().min(20).max(45).optional(),
  birthWeightG: z.number().positive().max(10000).optional(),
  color: z.string().max(20),
  avatar: z.string().max(16).optional(),
  archivedAt: ts.optional(),
  ...record,
});

export const feedingSchema = z.object({
  ...owned,
  kind: z.enum(["bottle", "breast", "pump", "solid"]),
  at: ts,
  tz,
  amountMl: z.number().nonnegative().max(2000).optional(),
  enteredUnit: z.enum(["oz", "ml"]).optional(),
  milk: z.enum(["formula", "breastmilk", "mixed"]).optional(),
  side: z.enum(["left", "right", "both"]).optional(),
  durationSec: z.number().nonnegative().optional(),
  note,
});

export const diaperSchema = z.object({
  ...owned,
  at: ts,
  tz,
  type: z.enum(["wet", "dirty", "both", "dry"]),
  note,
});

export const measurementSchema = z.object({
  ...owned,
  measuredOn: isoDate,
  weightG: z.number().positive().max(100000).optional(),
  lengthMm: z.number().positive().max(2000).optional(),
  headMm: z.number().positive().max(1000).optional(),
  source: z.enum(["doctor", "home"]),
  note,
});

export const sleepSchema = z.object({ ...owned, startedAt: ts, endedAt: ts.optional(), tz, note });

export const medicationSchema = z.object({
  ...owned,
  name: z.string().min(1).max(120),
  dose: z.number().nonnegative(),
  unit: z.string().max(20),
  at: ts,
  tz,
  reminderId: id.optional(),
  note,
});

export const vaccineSchema = z.object({
  ...owned,
  code: z.string().max(40),
  name: z.string().max(120),
  dueOn: isoDate.optional(),
  givenOn: isoDate.optional(),
  lot: z.string().max(60).optional(),
  note,
});

const hm = z.string().regex(/^\d{2}:\d{2}$/);
export const scheduleSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("once"), at: ts }),
  z.object({ type: z.literal("interval"), everyMin: z.number().int().positive().max(7 * 24 * 60) }),
  z.object({ type: z.literal("daily"), times: z.array(hm).max(24) }),
  z.object({ type: z.literal("weekly"), days: z.array(z.number().int().min(0).max(6)).max(7), times: z.array(hm).max(24) }),
]);

export const reminderSchema = z.object({
  id,
  babyId: id.optional(),
  kind: z.enum(["feeding-interval", "medication", "vitamin", "appointment", "custom"]),
  title: z.string().max(200),
  schedule: scheduleSchema,
  enabled: z.boolean(),
  respectQuietHours: z.boolean(),
  nextFireAt: ts.optional(),
  notifiedFor: ts.optional(),
  lastDismissedAt: ts.optional(),
  ...record,
});

export const exportedSettingsSchema = z
  .object({
    locale: z.enum(["en", "es"]),
    theme: z.enum(["system", "light", "dark", "night"]),
    volumeUnit: z.enum(["oz", "ml"]),
    measureUnit: z.enum(["imperial", "metric"]),
    defaultIntervalMin: z.number().int().positive(),
    quietHours: z.object({ enabled: z.boolean(), start: hm, end: hm }),
    dayStartHour: z.number().int().min(0).max(23),
  })
  .partial();

export const dataSchema = z.object({
  babies: z.array(babySchema).default([]),
  feedings: z.array(feedingSchema).default([]),
  diapers: z.array(diaperSchema).default([]),
  measurements: z.array(measurementSchema).default([]),
  sleeps: z.array(sleepSchema).default([]),
  medications: z.array(medicationSchema).default([]),
  vaccines: z.array(vaccineSchema).default([]),
  reminders: z.array(reminderSchema).default([]),
});

export const backupSchema = z.object({
  app: z.literal("mybaby"),
  schemaVersion: z.number().int().min(1).max(EXPORT_SCHEMA_VERSION),
  exportedAt: ts,
  settings: exportedSettingsSchema.optional(),
  data: dataSchema,
});

export type BackupFile = z.infer<typeof backupSchema>;
export type BackupData = z.infer<typeof dataSchema>;
