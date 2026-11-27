"use client";

import Dexie from "dexie";
import { useLiveQuery } from "dexie-react-hooks";
import { useMemo } from "react";
import { db } from "./schema";
import type { Baby, Diaper, Feeding, ID, Measurement, Medication, Reminder, Sleep, Vaccine } from "./types";

const FOREVER = Number.MAX_SAFE_INTEGER;

export function useBabies(includeArchived = false): Baby[] | undefined {
  return useLiveQuery(async () => {
    const all = await db.babies.toArray();
    return all
      .filter((b) => !b.deletedAt && (includeArchived || !b.archivedAt))
      .sort((a, b) => a.createdAt - b.createdAt);
  }, [includeArchived]);
}

/** Feedings for a baby since `since` (epoch ms), newest first. Pass a stable `since`. */
export function useFeedings(babyId: ID | null | undefined, since = 0): Feeding[] | undefined {
  return useLiveQuery(
    async () =>
      babyId
        ? (
            await db.feedings
              .where("[babyId+at]")
              .between([babyId, since], [babyId, FOREVER])
              .filter((f) => !f.deletedAt)
              .toArray()
          ).reverse()
        : [],
    [babyId, since],
  );
}

export function useDiapers(babyId: ID | null | undefined, since = 0): Diaper[] | undefined {
  return useLiveQuery(
    async () =>
      babyId
        ? (
            await db.diapers
              .where("[babyId+at]")
              .between([babyId, since], [babyId, FOREVER])
              .filter((d) => !d.deletedAt)
              .toArray()
          ).reverse()
        : [],
    [babyId, since],
  );
}

export function useLastFeeding(babyId: ID | null | undefined): Feeding | null | undefined {
  return useLiveQuery(async () => {
    if (!babyId) return null;
    const last = await db.feedings
      .where("[babyId+at]")
      .between([babyId, Dexie.minKey], [babyId, Dexie.maxKey])
      .filter((f) => !f.deletedAt && f.kind !== "pump")
      .last();
    return last ?? null;
  }, [babyId]);
}

/** Most recent bottle amount, used for the "last used" quick-add preset. */
export function useLastAmount(babyId: ID | null | undefined): { amountMl: number } | null | undefined {
  return useLiveQuery(async () => {
    if (!babyId) return null;
    const last = await db.feedings
      .where("[babyId+at]")
      .between([babyId, Dexie.minKey], [babyId, Dexie.maxKey])
      .filter((f) => !f.deletedAt && f.kind === "bottle" && f.amountMl !== undefined)
      .last();
    return last?.amountMl !== undefined ? { amountMl: last.amountMl } : null;
  }, [babyId]);
}

export function useSleeps(babyId: ID | null | undefined, since = 0): Sleep[] | undefined {
  return useLiveQuery(
    async () => {
      if (!babyId) return [];
      const rows = await db.sleeps
        .where("[babyId+startedAt]")
        .between([babyId, Math.max(0, since - 24 * 60 * 60 * 1000)], [babyId, FOREVER])
        .filter((s) => !s.deletedAt && (s.endedAt === undefined || s.endedAt >= since || s.startedAt >= since))
        .toArray();
      return rows.reverse();
    },
    [babyId, since],
  );
}

export function useActiveSleep(babyId: ID | null | undefined): Sleep | null | undefined {
  return useLiveQuery(async () => {
    if (!babyId) return null;
    const rows = await db.sleeps
      .where("babyId")
      .equals(babyId)
      .filter((s) => !s.deletedAt && s.endedAt === undefined)
      .toArray();
    rows.sort((a, b) => b.startedAt - a.startedAt);
    return rows[0] ?? null;
  }, [babyId]);
}

export function useMeasurements(babyId: ID | null | undefined): Measurement[] | undefined {
  return useLiveQuery(
    async () =>
      babyId
        ? (await db.measurements.where("babyId").equals(babyId).filter((m) => !m.deletedAt).toArray()).sort((a, b) =>
            a.measuredOn.localeCompare(b.measuredOn),
          )
        : [],
    [babyId],
  );
}

export function useVaccines(babyId: ID | null | undefined): Vaccine[] | undefined {
  return useLiveQuery(
    async () => (babyId ? await db.vaccines.where("babyId").equals(babyId).filter((v) => !v.deletedAt).toArray() : []),
    [babyId],
  );
}

export function useMedications(babyId: ID | null | undefined, since = 0): Medication[] | undefined {
  return useLiveQuery(
    async () =>
      babyId
        ? (
            await db.medications
              .where("[babyId+at]")
              .between([babyId, since], [babyId, FOREVER])
              .filter((m) => !m.deletedAt)
              .toArray()
          ).reverse()
        : [],
    [babyId, since],
  );
}

export function useReminders(): Reminder[] | undefined {
  return useLiveQuery(async () => (await db.reminders.toArray()).filter((r) => !r.deletedAt), []);
}

/** Counts of records, used for backup nudges. */
export function useEntryCount(): number | undefined {
  return useLiveQuery(
    async () =>
      (await db.feedings.count()) +
      (await db.diapers.count()) +
      (await db.measurements.count()) +
      (await db.sleeps.count()) +
      (await db.medications.count()),
    [],
  );
}

export function useActiveBaby(babies: Baby[] | undefined, activeId: ID | null | undefined): Baby | undefined {
  return useMemo(() => babies?.find((b) => b.id === activeId) ?? babies?.[0], [babies, activeId]);
}
