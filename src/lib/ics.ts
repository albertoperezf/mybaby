import type { Reminder } from "@/db/types";
import { nextOccurrence } from "@/features/reminders/schedule";
import { parseHm } from "./time";

const pad = (n: number) => String(n).padStart(2, "0");
const utc = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const floating = (d: Date) =>
  `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;

export const escapeIcs = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** RFC 5545 line folding at 75 octets. */
export function foldLine(line: string): string {
  const bytes = new TextEncoder();
  if (bytes.encode(line).length <= 75) return line;
  const out: string[] = [];
  let current = "";
  let size = 0;
  for (const ch of line) {
    const n = bytes.encode(ch).length;
    if (size + n > (out.length === 0 ? 75 : 74)) {
      out.push(current);
      current = "";
      size = 0;
    }
    current += ch;
    size += n;
  }
  out.push(current);
  return out.join("\r\n ");
}

const BYDAY = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

function events(r: Reminder, title: string, now: number): string[][] {
  const base = (suffix: string): string[] => [
    "BEGIN:VEVENT",
    `UID:${r.id}-${suffix}@mybaby.local`,
    `DTSTAMP:${utc(now)}`,
    `SUMMARY:${escapeIcs(title)}`,
  ];
  const alarm = ["BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${escapeIcs(title)}`, "TRIGGER:PT0S", "END:VALARM", "END:VEVENT"];
  const { schedule } = r;

  if (schedule.type === "once") return [[...base("0"), `DTSTART:${utc(schedule.at)}`, "DURATION:PT15M", ...alarm]];
  if (schedule.type === "interval") {
    return r.nextFireAt ? [[...base("0"), `DTSTART:${utc(r.nextFireAt)}`, "DURATION:PT15M", ...alarm]] : [];
  }
  return schedule.times.flatMap((time, i) => {
    const first = nextOccurrence({ ...schedule, times: [time] }, now);
    if (first === undefined) return [];
    const { h, m } = parseHm(time);
    const start = new Date(first);
    start.setHours(h, m, 0, 0);
    const rule =
      schedule.type === "daily" ? "RRULE:FREQ=DAILY" : `RRULE:FREQ=WEEKLY;BYDAY=${schedule.days.map((d) => BYDAY[d]).join(",")}`;
    return [[...base(String(i)), `DTSTART:${floating(start)}`, "DURATION:PT15M", rule, ...alarm]];
  });
}

export function buildIcs(reminders: Reminder[], titleOf: (r: Reminder) => string, now = Date.now()): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MyBaby//Reminders//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...reminders.filter((r) => r.enabled && !r.deletedAt).flatMap((r) => events(r, titleOf(r), now).flat()),
    "END:VCALENDAR",
  ];
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
