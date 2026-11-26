import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";

export const MIN = 60_000;
export const HOUR = 60 * MIN;
export const DAY = 24 * HOUR;

export const deviceTz = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/**
 * Calendar-day bucket for a timestamp, in the zone it was recorded in.
 * The day starts at `dayStartHour` (e.g. 6 groups a 2 AM feed with the previous evening).
 */
export function dayKey(at: number, tz: string, dayStartHour = 0): string {
  const shifted = new TZDate(at, tz);
  shifted.setHours(shifted.getHours() - dayStartHour);
  return format(shifted, "yyyy-MM-dd");
}

/** Epoch ms of the start of the logical day containing `now`, in `tz`. */
export function startOfLogicalDay(now: number, tz: string, dayStartHour = 0): number {
  const d = new TZDate(now, tz);
  if (d.getHours() < dayStartHour) d.setDate(d.getDate() - 1);
  d.setHours(dayStartHour, 0, 0, 0);
  return d.getTime();
}

export function addLogicalDays(dayStart: number, tz: string, days: number): number {
  const d = new TZDate(dayStart, tz);
  d.setDate(d.getDate() + days);
  return d.getTime();
}

/** Value for <input type="datetime-local"> in device-local time. */
export function toLocalInput(at: number): string {
  return format(new Date(at), "yyyy-MM-dd'T'HH:mm");
}

export function fromLocalInput(value: string): number {
  return new Date(value).getTime();
}

export const toDateInput = (at: number) => format(new Date(at), "yyyy-MM-dd");

/** Language-neutral compact duration: "12m", "2h 05m". */
export function formatElapsed(ms: number): string {
  const totalMin = Math.max(0, Math.floor(ms / MIN));
  if (totalMin < 1) return "<1m";
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h === 0 ? `${m}m` : `${h}h ${String(m).padStart(2, "0")}m`;
}

export function formatClock(at: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(at);
}

export function formatDayTime(at: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(at);
}

export function formatDate(isoDate: string, locale: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Intl.DateTimeFormat(locale, { year: "numeric", month: "short", day: "numeric" }).format(
    new Date(y, m - 1, d),
  );
}

export function formatDayHeading(key: string, locale: string, now = Date.now()): string {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const diffDays = Math.round((date.getTime() - new Date(new Date(now).setHours(0, 0, 0, 0)).getTime()) / DAY);
  if (diffDays >= -1 && diffDays <= 0) return rtf.format(diffDays, "day").replace(/^./, (c) => c.toUpperCase());
  return new Intl.DateTimeFormat(locale, { weekday: "long", month: "short", day: "numeric" }).format(date);
}

export function parseIsoDate(isoDate: string): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Whole days between a birth date and a measurement date (both YYYY-MM-DD). */
export function daysBetween(fromIso: string, toIso: string): number {
  const utcDay = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((utcDay(toIso) - utcDay(fromIso)) / DAY);
}

export function parseHm(value: string): { h: number; m: number } {
  const [h, m] = value.split(":").map(Number);
  return { h: h || 0, m: m || 0 };
}
