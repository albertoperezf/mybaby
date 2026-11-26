"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useEffect } from "react";
import { useApp } from "@/components/app-context";
import { db } from "@/db/schema";
import { useLocale, useT } from "@/i18n";
import { formatDate } from "@/lib/time";
import { doseLabel } from "./labels";
import { syncVaccineReminders } from "./reminders";

/** Keeps vaccine visit reminders in step with the checklist while the setting is on. */
export function VaccineReminderSync() {
  const { babies, settings } = useApp();
  const t = useT();
  const locale = useLocale();
  const doses = useLiveQuery(() => db.vaccines.filter((v) => !v.deletedAt).toArray(), []);
  const enabled = settings.vaccineReminders;

  useEffect(() => {
    if (!doses) return;
    const id = setTimeout(() => {
      for (const baby of babies) {
        void syncVaccineReminders(
          baby,
          doses.filter((d) => d.babyId === baby.id),
          enabled,
          (visit) => {
            const names = visit.doses.map((d) => doseLabel(d, locale));
            const shown = names.slice(0, 3).join(", ") + (names.length > 3 ? ` +${names.length - 3}` : "");
            return t("vaccine.reminderTitle", { date: formatDate(visit.dueOn, locale), names: shown });
          },
        );
      }
    }, 800);
    return () => clearTimeout(id);
  }, [doses, enabled, babies, locale, t]);

  return null;
}
