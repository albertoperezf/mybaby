"use client";

import { BellRing } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useApp, useNow } from "@/components/app-context";
import { Button } from "@/components/ui";
import { useReminders } from "@/db/hooks";
import type { Baby, Reminder } from "@/db/types";
import { useT, type TFn } from "@/i18n";
import { dismissReminder, markNotified, snoozeReminder, SNOOZE_OPTIONS_MIN } from "./actions";
import { isDue } from "./schedule";

export function reminderTitle(r: Reminder, babies: Baby[], t: TFn): string {
  if (r.kind !== "feeding-interval") return r.title;
  const name = babies.find((b) => b.id === r.babyId)?.name ?? "";
  return t("reminder.feedingTitle", { name });
}

async function showNotification(title: string, body: string, tag: string) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  const options: NotificationOptions = {
    body,
    tag,
    icon: "/icons/icon-192.png",
    badge: "/icons/favicon-32.png",
    data: { url: "/app" },
  };
  const reg = await navigator.serviceWorker?.getRegistration();
  if (reg) await reg.showNotification(title, options);
  else new Notification(title, options);
}

/**
 * In-app alarm loop. Browsers cannot fire scheduled local notifications while the app is
 * closed, so this runs while the app is open/backgrounded (and on return to the foreground).
 */
export function ReminderEngine() {
  const { babies } = useApp();
  const t = useT();
  const reminders = useReminders();
  const now = useNow(15_000);
  const [, setTick] = useState(0);

  // Wake exactly when the next reminder is due instead of waiting for the poll.
  useEffect(() => {
    const upcoming = (reminders ?? [])
      .filter((r) => r.enabled && r.nextFireAt !== undefined && r.nextFireAt > Date.now())
      .map((r) => r.nextFireAt as number);
    if (upcoming.length === 0) return;
    const delay = Math.min(Math.min(...upcoming) - Date.now() + 250, 2 ** 31 - 1);
    const id = setTimeout(() => setTick((n) => n + 1), delay);
    return () => clearTimeout(id);
  }, [reminders, now]);

  useEffect(() => {
    if (!reminders) return;
    const current = Date.now();
    const due = reminders.filter((r) => isDue(r, current));
    for (const r of due) {
      if (r.notifiedFor === r.nextFireAt) continue;
      void markNotified(r.id, r.nextFireAt as number);
      void showNotification(reminderTitle(r, babies, t), t("reminder.tapToOpen"), r.id);
    }
    const badge = (navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> });
    if (due.length > 0) void badge.setAppBadge?.(due.length).catch(() => undefined);
    else void badge.clearAppBadge?.().catch(() => undefined);
  }, [reminders, babies, t, now]);

  return null;
}

/** Banner(s) for reminders that are due right now, with snooze and dismiss. */
export function DueBanner() {
  const { babies, openQuickLog } = useApp();
  const t = useT();
  const reminders = useReminders();
  const now = useNow(15_000);
  const dueList = (reminders ?? []).filter((r) => isDue(r, now));
  const onDismiss = useCallback((r: Reminder) => dismissReminder(r), []);

  if (dueList.length === 0) return null;
  return (
    <section aria-label={t("reminder.dueNow")} className="mb-4 flex flex-col gap-3">
      {dueList.map((r) => (
        <div key={r.id} role="alert" className="rounded-3xl border-2 border-primary bg-surface p-4">
          <div className="flex items-center gap-3">
            <BellRing aria-hidden className="size-6 shrink-0 text-primary" />
            <p className="text-lg font-bold">{reminderTitle(r, babies, t)}</p>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {r.kind === "feeding-interval" && (
              <Button variant="primary" onClick={() => openQuickLog({ tab: "feed" })}>
                {t("reminder.logFeeding")}
              </Button>
            )}
            <Button onClick={() => onDismiss(r)}>{t("reminder.dismiss")}</Button>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2" role="group" aria-label={t("reminder.snooze")}>
            <span className="text-sm text-muted">{t("reminder.snooze")}</span>
            {SNOOZE_OPTIONS_MIN.map((m) => (
              <Button key={m} variant="secondary" className="!min-h-11 !px-4 text-sm" onClick={() => snoozeReminder(r.id, m)}>
                {t("reminder.snoozeMin", { n: m })}
              </Button>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
