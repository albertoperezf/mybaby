"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useMemo } from "react";
import { ulid } from "ulid";
import { db } from "./schema";
import type { Locale, SettingKey, SettingsValues } from "./types";

const IMPERIAL_REGIONS = new Set(["US", "LR", "MM"]);

export function detectLocale(): Locale {
  const lang = typeof navigator === "undefined" ? "en" : navigator.language;
  return lang.toLowerCase().startsWith("es") ? "es" : "en";
}

export function detectImperial(): boolean {
  const lang = typeof navigator === "undefined" ? "en-US" : navigator.language;
  const region = lang.split("-")[1]?.toUpperCase();
  return region ? IMPERIAL_REGIONS.has(region) : lang.toLowerCase() === "en";
}

export function defaultSettings(): SettingsValues {
  const imperial = detectImperial();
  return {
    deviceId: "",
    locale: detectLocale(),
    theme: "system",
    volumeUnit: imperial ? "oz" : "ml",
    measureUnit: imperial ? "imperial" : "metric",
    defaultIntervalMin: 180,
    quietHours: { enabled: false, start: "22:00", end: "07:00" },
    dayStartHour: 0,
    activeBabyId: null,
    disclaimerAcceptedAt: null,
    lastBackupAt: null,
    installHintDismissedAt: null,
    backupNudgeSnoozedAt: null,
    pushEnabled: false,
    nightAuto: false,
    vaccineReminders: false,
  };
}

export async function setSetting<K extends SettingKey>(key: K, value: SettingsValues[K]): Promise<void> {
  await db.settings.put({ key, value });
  if (key === "theme" && typeof localStorage !== "undefined") localStorage.setItem("theme", String(value));
  if (key === "nightAuto" && typeof localStorage !== "undefined") localStorage.setItem("nightAuto", value ? "1" : "0");
}

export async function getSetting<K extends SettingKey>(key: K): Promise<SettingsValues[K] | undefined> {
  const row = await db.settings.get(key);
  return row?.value as SettingsValues[K] | undefined;
}

/** Stable per-install id; stamped on every record so a future sync can attribute writes. */
export async function ensureDeviceId(): Promise<string> {
  const existing = await getSetting("deviceId");
  if (existing) return existing;
  const id = ulid();
  await setSetting("deviceId", id);
  return id;
}

let cachedDeviceId: string | undefined;
export async function deviceId(): Promise<string> {
  cachedDeviceId ??= await ensureDeviceId();
  return cachedDeviceId;
}

/** Returns merged settings once loaded, `undefined` while the first read is pending. */
export function useSettings(): SettingsValues | undefined {
  const rows = useLiveQuery(() => db.settings.toArray(), []);
  return useMemo(() => {
    if (!rows) return undefined;
    const merged = defaultSettings();
    for (const row of rows) (merged as unknown as Record<string, unknown>)[row.key] = row.value;
    return merged;
  }, [rows]);
}
