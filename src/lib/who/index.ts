// WHO Child Growth Standards (0-5 years), LMS method. Data: who-lms.json (see scripts/build-who-data.py).
import type { Sex } from "@/db/types";
import { daysBetween } from "@/lib/time";

export type Indicator = "weight" | "length" | "head";
export const INDICATORS: Indicator[] = ["weight", "length", "head"];

export interface LmsTable {
  days: number[];
  L: number[];
  M: number[];
  S: number[];
}
export type WhoData = Record<"wfa" | "lhfa" | "hcfa", Record<"boys" | "girls", LmsTable>>;

const TABLE_KEY = { weight: "wfa", length: "lhfa", head: "hcfa" } as const;
/** WHO tables are in kg / cm; the app stores grams / millimetres. */
const TO_BASE = { weight: 1000, length: 10, head: 10 } as const;

export const MAX_AGE_DAYS = 1856;
export const DAYS_PER_MONTH = 30.4375;

export const CURVES = [
  { percentile: 3, z: -1.8808 },
  { percentile: 15, z: -1.0364 },
  { percentile: 50, z: 0 },
  { percentile: 85, z: 1.0364 },
  { percentile: 97, z: 1.8808 },
] as const;

let loading: Promise<WhoData> | undefined;
/** Lazy: the ~40 KB table only downloads when the growth page needs it. */
export function loadWho(): Promise<WhoData> {
  loading ??= import("./who-lms.json").then((m) => m.default as unknown as WhoData);
  return loading;
}

const tableFor = (data: WhoData, indicator: Indicator, sex: Sex) =>
  data[TABLE_KEY[indicator]][sex === "female" ? "girls" : "boys"];

export function lmsAt(table: LmsTable, ageDays: number): { L: number; M: number; S: number } | null {
  if (ageDays < 0 || ageDays > table.days[table.days.length - 1]) return null;
  const step = table.days[1] - table.days[0];
  let i = Math.min(Math.floor(ageDays / step), table.days.length - 2);
  while (i < table.days.length - 2 && table.days[i + 1] <= ageDays) i++;
  const span = table.days[i + 1] - table.days[i];
  const f = span === 0 ? 0 : (ageDays - table.days[i]) / span;
  const lerp = (a: number[]) => a[i] + (a[i + 1] - a[i]) * f;
  return { L: lerp(table.L), M: lerp(table.M), S: lerp(table.S) };
}

export function zScore(value: number, { L, M, S }: { L: number; M: number; S: number }): number {
  return L === 0 ? Math.log(value / M) / S : (Math.pow(value / M, L) - 1) / (L * S);
}

export function valueAtZ({ L, M, S }: { L: number; M: number; S: number }, z: number): number {
  return L === 0 ? M * Math.exp(S * z) : M * Math.pow(1 + L * S * z, 1 / L);
}

/** Standard normal CDF (Abramowitz & Stegun 7.1.26, error < 1.5e-7). */
export function normalCdf(z: number): number {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const erf = 1 - poly * Math.exp(-x * x);
  return 0.5 * (1 + (z < 0 ? -erf : erf));
}

export interface PercentileResult {
  z: number;
  percentile: number;
}

/** `value` in grams (weight) or millimetres (length/head). */
export function percentileOf(
  data: WhoData,
  indicator: Indicator,
  sex: Sex,
  ageDays: number,
  value: number,
): PercentileResult | null {
  const lms = lmsAt(tableFor(data, indicator, sex), ageDays);
  if (!lms) return null;
  const z = zScore(value / TO_BASE[indicator], lms);
  return { z, percentile: normalCdf(z) * 100 };
}

/** Curve for one z-line, sampled every `stepDays`, in grams / millimetres. */
export function curvePoints(
  data: WhoData,
  indicator: Indicator,
  sex: Sex,
  z: number,
  toDay: number,
  stepDays = 14,
): { days: number; value: number }[] {
  const table = tableFor(data, indicator, sex);
  const out: { days: number; value: number }[] = [];
  for (let d = 0; d <= Math.min(toDay, MAX_AGE_DAYS); d += stepDays) {
    const lms = lmsAt(table, d);
    if (lms) out.push({ days: d, value: valueAtZ(lms, z) * TO_BASE[indicator] });
  }
  return out;
}

/** Age in days for plotting; corrected for babies born before 37 weeks until ~2 years. */
export function ageInDays(birthDate: string, on: string, gestationalWeeks?: number, useCorrected = true): number {
  const chronological = daysBetween(birthDate, on);
  if (!useCorrected || !gestationalWeeks || gestationalWeeks >= 37) return chronological;
  const correction = Math.round((40 - gestationalWeeks) * 7);
  return chronological < 730 + correction ? Math.max(0, chronological - correction) : chronological;
}

export function isPreterm(gestationalWeeks?: number): boolean {
  return Boolean(gestationalWeeks && gestationalWeeks < 37);
}

export function ordinal(n: number, locale: string): string {
  const es = locale.startsWith("es");
  if (n < 1) return es ? "P<1" : "<1%";
  if (n > 99) return es ? "P>99" : ">99%";
  const rounded = Math.round(n);
  return es ? `P${rounded}` : `${rounded}${suffix(rounded)}`;
}

function suffix(n: number): string {
  if (n % 100 >= 11 && n % 100 <= 13) return "th";
  return ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
}
