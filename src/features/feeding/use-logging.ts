"use client";

import { useCallback } from "react";
import { useToast } from "@/components/ui";
import { addDiapers, addFeedings, addSleeps, softDelete, type FeedingInput } from "@/db/repo";
import type { DiaperType, ID } from "@/db/types";
import { rescheduleFeedingReminder } from "@/features/reminders/actions";
import { formatDurationShort } from "@/features/timers/timer-store";
import { useT, type MessageKey } from "@/i18n";
import { formatVolume } from "@/lib/units";

/** Shared by the home presets, timers and quick-log sheet: write, reschedule, toast with undo. */
export function useLogging() {
  const t = useT();
  const toast = useToast();

  const logFeeding = useCallback(
    async (babyIds: ID[], input: FeedingInput) => {
      const rows = await addFeedings(babyIds, input);
      const isPump = input.kind === "pump";
      if (!isPump) await Promise.all(babyIds.map((id) => rescheduleFeedingReminder(id)));
      const message = isPump
        ? t("timer.loggedPump")
        : input.kind === "breast"
          ? t("timer.loggedBreast", { duration: formatDurationShort(input.durationSec ?? 0) })
          : input.amountMl !== undefined
            ? t("quick.loggedFeed", { amount: formatVolume(input.amountMl, input.enteredUnit ?? "oz") })
            : t("quick.loggedFeedNoAmount");
      toast.show({
        message,
        actionLabel: t("common.undo"),
        onAction: async () => {
          await softDelete("feedings", rows.map((r) => r.id));
          if (!isPump) await Promise.all(babyIds.map((id) => rescheduleFeedingReminder(id)));
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

  const logSleep = useCallback(
    async (babyIds: ID[], input: { startedAt: number; endedAt?: number; note?: string }) => {
      const rows = await addSleeps(babyIds, input);
      const dur = input.endedAt ? formatDurationShort((input.endedAt - input.startedAt) / 1000) : "";
      toast.show({
        message: dur ? t("timer.loggedSleep", { duration: dur }) : t("timer.sleepStarted"),
        actionLabel: t("common.undo"),
        onAction: () => softDelete("sleeps", rows.map((r) => r.id)),
      });
    },
    [t, toast],
  );

  return { logFeeding, logDiaper, logSleep };
}
