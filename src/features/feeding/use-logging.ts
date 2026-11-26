"use client";

import { useCallback } from "react";
import { useToast } from "@/components/ui";
import { addDiapers, addFeedings, softDelete, type FeedingInput } from "@/db/repo";
import type { DiaperType, ID } from "@/db/types";
import { rescheduleFeedingReminder } from "@/features/reminders/actions";
import { useT, type MessageKey } from "@/i18n";
import { formatVolume } from "@/lib/units";

/** Shared by the home presets and the quick-log sheet: write, reschedule, toast with undo. */
export function useLogging() {
  const t = useT();
  const toast = useToast();

  const logFeeding = useCallback(
    async (babyIds: ID[], input: FeedingInput) => {
      const rows = await addFeedings(babyIds, input);
      await Promise.all(babyIds.map((id) => rescheduleFeedingReminder(id)));
      toast.show({
        message:
          input.amountMl !== undefined
            ? t("quick.loggedFeed", { amount: formatVolume(input.amountMl, input.enteredUnit ?? "oz") })
            : t("quick.loggedFeedNoAmount"),
        actionLabel: t("common.undo"),
        onAction: async () => {
          await softDelete("feedings", rows.map((r) => r.id));
          await Promise.all(babyIds.map((id) => rescheduleFeedingReminder(id)));
        },
      });
    },
    [t, toast],
  );

  const logDiaper = useCallback(
    async (babyIds: ID[], type: DiaperType, at = Date.now(), note?: string) => {
      const rows = await addDiapers(babyIds, type, at, note);
      toast.show({
        message: t("quick.loggedDiaper", { type: t(`diaper.${type}` as MessageKey) }),
        actionLabel: t("common.undo"),
        onAction: () => softDelete("diapers", rows.map((r) => r.id)),
      });
    },
    [t, toast],
  );

  return { logFeeding, logDiaper };
}
