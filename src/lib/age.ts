import type { TFn } from "@/i18n";
import { DAYS_PER_MONTH } from "@/lib/who";

export function formatAge(days: number, t: TFn): string {
  if (days < 14) return t("age.days", { n: Math.max(0, days) });
  if (days < 91) return t("age.weeks", { n: Math.floor(days / 7) });
  const months = Math.floor(days / DAYS_PER_MONTH);
  if (months < 24) return t("age.months", { n: months });
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return rest === 0 ? t("age.years", { n: years }) : t("age.yearsMonths", { y: years, m: rest });
}
