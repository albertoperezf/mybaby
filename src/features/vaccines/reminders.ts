import { ulid } from "ulid";
import { db } from "@/db/schema";
import { deviceId } from "@/db/settings";
import type { Baby, Vaccine } from "@/db/types";
import { deleteReminder } from "@/features/reminders/actions";
import { DAY } from "@/lib/time";
import { doseStatus, earliestOn, indexByCode } from "./logic";

export interface PlannedVisit {
  key: string;
  dueOn: string;
  doses: Vaccine[];
  at: number;
}

const parse = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};

function nineAm(date: Date): number {
  const d = new Date(date);
  d.setHours(9, 0, 0, 0);
  return d.getTime();
}

/**
 * One reminder per upcoming visit date (required and custom doses only): a week ahead at 9 AM,
 * or the next 9 AM if that moment has passed. The key carries the date, so moving a dose creates a new reminder.
 */
export function plannedVisits(babyId: string, doses: Vaccine[], today: string, now: number): PlannedVisit[] {
  const byCode = indexByCode(doses);
  const groups = new Map<string, Vaccine[]>();
  for (const v of doses) {
    if (v.givenOn || v.skippedOn || v.optional || v.deletedAt) continue;
    const status = doseStatus(v, byCode, today);
    if (status === "past") continue;
    // Pushed later by a recent previous dose? Remind for the date the dose can actually happen.
    const earliest = earliestOn(v, byCode);
    const date = v.scheduleId === "custom" ? v.dueOn : earliest && v.dueOn && earliest > v.dueOn ? earliest : (v.dueOn ?? earliest);
    if (!date || date < today) continue;
    groups.set(date, [...(groups.get(date) ?? []), v]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dueOn, list]) => {
      const week = nineAm(new Date(parse(dueOn).getTime() - 7 * DAY));
      let at = week;
      if (at <= now) {
        const next = nineAm(new Date(now));
        at = next > now ? next : next + DAY;
      }
      return { key: `vaccine:${babyId}:${dueOn}`, dueOn, doses: list, at };
    });
}

/** Makes the stored vaccine reminders match what is planned (or removes them all when disabled). */
export async function syncVaccineReminders(
  baby: Pick<Baby, "id">,
  doses: Vaccine[],
  enabled: boolean,
  titleFor: (visit: PlannedVisit) => string,
  now = Date.now(),
): Promise<void> {
  const today = new Date(now);
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const desired = enabled ? plannedVisits(baby.id, doses, todayIso, now) : [];
  const prefix = `vaccine:${baby.id}:`;
  const existing = (await db.reminders.toArray()).filter((r) => r.autoKey?.startsWith(prefix) && !r.deletedAt);

  for (const visit of desired) {
    const title = titleFor(visit);
    const current = existing.find((r) => r.autoKey === visit.key);
    if (!current) {
      await db.reminders.add({
        id: ulid(),
        babyId: baby.id,
        kind: "vaccine",
        title,
        schedule: { type: "once", at: visit.at },
        enabled: true,
        respectQuietHours: false,
        nextFireAt: visit.at,
        autoKey: visit.key,
        createdAt: now,
        updatedAt: now,
        deviceId: await deviceId(),
      });
    } else if (current.title !== title) {
      await db.reminders.update(current.id, { title, updatedAt: now });
    }
  }
  for (const r of existing) if (!desired.some((v) => v.key === r.autoKey)) await deleteReminder(r.id);
}
