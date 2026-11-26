import { addDays, addMonths, format } from "date-fns";
import type { Base, Vaccine } from "@/db/types";
import type { DoseTemplate, ScheduleDef } from "./schedule-data";

export type NewDose = Omit<Vaccine, keyof Base>;
export type DoseStatus = "given" | "skipped" | "due" | "upcoming" | "past";

const parse = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const fmt = (d: Date) => format(d, "yyyy-MM-dd");

/** Calendar date `months` after birth; halves of a month count as 15 days. */
export function monthsToDate(birthDate: string, months: number): string {
  const whole = Math.floor(months);
  const base = addMonths(parse(birthDate), whole);
  return fmt(addDays(base, Math.round((months - whole) * 30)));
}

export function datesFor(t: DoseTemplate, birthDate: string) {
  const from = monthsToDate(birthDate, t.from);
  return { dueOn: from, windowFrom: from, windowTo: monthsToDate(birthDate, t.to) };
}

/** Dose rows for a baby (without ids/stamps); the vaccine name comes from the vaccine key at display time. */
export function buildDoses(def: ScheduleDef, birthDate: string): NewDose[] {
  return def.doses.map((t) => ({
    code: t.code,
    vaccine: t.vaccine,
    dose: t.dose,
    scheduleId: def.id,
    name: "",
    ...datesFor(t, birthDate),
    afterCode: t.after,
    minGapDays: t.minGapDays,
    optional: t.optional,
  }));
}

/** Earliest sensible date: the window start, pushed later if the previous dose was given recently. */
export function earliestOn(v: Vaccine, byCode: Map<string, Vaccine>): string | undefined {
  const base = v.windowFrom ?? v.dueOn;
  const prev = v.afterCode ? byCode.get(v.afterCode) : undefined;
  if (prev?.givenOn && v.minGapDays) {
    const gap = fmt(addDays(parse(prev.givenOn), v.minGapDays));
    return !base || gap > base ? gap : base;
  }
  return base;
}

export function doseStatus(v: Vaccine, byCode: Map<string, Vaccine>, today: string): DoseStatus {
  if (v.givenOn) return "given";
  if (v.skippedOn) return "skipped";
  const from = earliestOn(v, byCode);
  if (from && today < from) return "upcoming";
  if (v.windowTo && today > v.windowTo) return "past";
  return "due";
}

export const indexByCode = (doses: Vaccine[]) => new Map(doses.map((d) => [d.code, d]));

export interface DoseGroup {
  /** Recommended age in months of the first dose in the group; -1 for custom entries. */
  ageMonths: number;
  doses: Vaccine[];
}

/** Groups doses by recommended age; custom entries (no window) go last, ordered by date. */
export function groupDoses(doses: Vaccine[], birthDate: string): DoseGroup[] {
  const birth = parse(birthDate);
  const monthsAt = (iso: string) => {
    const d = parse(iso);
    return (d.getFullYear() - birth.getFullYear()) * 12 + (d.getMonth() - birth.getMonth()) + (d.getDate() >= birth.getDate() ? 0 : -1);
  };
  const map = new Map<number, Vaccine[]>();
  for (const v of doses) {
    const key = v.windowFrom ? Math.max(0, monthsAt(v.windowFrom)) : -1;
    map.set(key, [...(map.get(key) ?? []), v]);
  }
  return [...map.entries()]
    .sort(([a], [b]) => (a === -1 ? 1 : b === -1 ? -1 : a - b))
    .map(([ageMonths, list]) => ({
      ageMonths,
      doses: list.sort((a, b) => (a.optional ? 1 : 0) - (b.optional ? 1 : 0) || (a.dueOn ?? "").localeCompare(b.dueOn ?? "") || a.code.localeCompare(b.code)),
    }));
}

export interface VaccineSummary {
  given: number;
  total: number;
  /** Required doses whose recommended window has already started. */
  expected: number;
  expectedGiven: number;
  past: Vaccine[];
  dueNow: Vaccine[];
  next?: Vaccine;
}

/** Progress counts only required (non-optional) doses; optional ones are shown but never "overdue". */
export function summarize(doses: Vaccine[], today: string): VaccineSummary {
  const byCode = indexByCode(doses);
  const required = doses.filter((d) => !d.optional && d.scheduleId !== "custom");
  const status = (d: Vaccine) => doseStatus(d, byCode, today);
  const open = doses.filter((d) => !d.givenOn && !d.skippedOn);
  const upcomingOrDue = open
    .filter((d) => status(d) !== "past" || !d.optional)
    .sort((a, b) => (earliestOn(a, byCode) ?? "9999").localeCompare(earliestOn(b, byCode) ?? "9999"));
  const expectedList = required.filter((d) => (d.windowFrom ?? d.dueOn ?? "9999") <= today && !d.skippedOn);
  return {
    given: doses.filter((d) => d.givenOn).length,
    total: required.length,
    expected: expectedList.length,
    expectedGiven: expectedList.filter((d) => d.givenOn).length,
    past: required.filter((d) => status(d) === "past"),
    dueNow: open.filter((d) => !d.optional && status(d) === "due"),
    next: upcomingOrDue.find((d) => !d.optional) ?? upcomingOrDue[0],
  };
}

/** Re-anchors every untouched dose to a new birth date; given or skipped doses keep their dates. */
export function rebaseDoses(doses: Vaccine[], def: ScheduleDef | undefined, birthDate: string): Map<string, Pick<Vaccine, "dueOn" | "windowFrom" | "windowTo">> {
  const out = new Map<string, Pick<Vaccine, "dueOn" | "windowFrom" | "windowTo">>();
  if (!def) return out;
  const templates = new Map(def.doses.map((t) => [t.code, t]));
  for (const v of doses) {
    const t = v.scheduleId === def.id ? templates.get(v.code) : undefined;
    if (t && !v.givenOn && !v.skippedOn) out.set(v.id, datesFor(t, birthDate));
  }
  return out;
}
