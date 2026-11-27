import type { Medication } from "@/db/types";
import type { MessageKey } from "@/i18n";
import { dayKey } from "@/lib/time";

export const MED_UNITS = ["ml", "drops", "IU", "mg", "tsp", "puffs"] as const;
export type MedUnit = (typeof MED_UNITS)[number];

export function translateMedUnit(unit: string, t: (key: MessageKey) => string): string {
  return (MED_UNITS as readonly string[]).includes(unit) ? t(`med.unit.${unit}` as MessageKey) : unit;
}

export interface RecentMedicine {
  key: string;
  name: string;
  dose: number;
  unit: string;
  lastAt: number;
  countToday: number;
}

export function normalizeMedName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Clean dose display without trailing zeroes (e.g. 2.5 ml, 400 IU). */
export function formatDose(dose: number, unit: string): string {
  const rounded = Math.round(dose * 100) / 100;
  return unit ? `${rounded} ${unit}` : String(rounded);
}

/** Distinct medicines ordered by most recent dose, with how many doses were given since `dayStart`. */
export function recentMedicines(meds: Medication[], dayStart: number, limit = 6): RecentMedicine[] {
  const sorted = [...meds].sort((a, b) => b.at - a.at);
  const map = new Map<string, RecentMedicine>();
  for (const m of sorted) {
    const key = normalizeMedName(m.name);
    if (!key) continue;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        key,
        name: m.name,
        dose: m.dose,
        unit: m.unit,
        lastAt: m.at,
        countToday: m.at >= dayStart ? 1 : 0,
      });
    } else if (m.at >= dayStart) {
      existing.countToday += 1;
    }
  }
  return [...map.values()].slice(0, limit);
}

export function groupMedicationsByDay(meds: Medication[], dayStartHour: number): [string, Medication[]][] {
  const sorted = [...meds].sort((a, b) => b.at - a.at);
  const map = new Map<string, Medication[]>();
  for (const m of sorted) {
    const key = dayKey(m.at, m.tz, dayStartHour);
    map.set(key, [...(map.get(key) ?? []), m]);
  }
  return [...map.entries()];
}
