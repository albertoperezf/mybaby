import type { Locale, Vaccine } from "@/db/types";
import { VACCINES } from "./schedule-data";

export const vaccineName = (v: Pick<Vaccine, "vaccine" | "name">, locale: Locale): string =>
  (v.vaccine ? VACCINES[v.vaccine]?.name[locale] : undefined) ?? v.name;

/** "DTaP #3" for schedule doses; the plain name for custom entries. */
export function doseLabel(v: Pick<Vaccine, "vaccine" | "name" | "dose" | "scheduleId">, locale: Locale): string {
  const name = vaccineName(v, locale);
  return v.dose && v.scheduleId !== "custom" ? `${name} #${v.dose}` : name;
}

export const vaccineProtects = (v: Pick<Vaccine, "vaccine">, locale: Locale): string | undefined =>
  v.vaccine ? VACCINES[v.vaccine]?.protects[locale] : undefined;
