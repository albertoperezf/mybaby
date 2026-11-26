"use client";

import { Bell, BellOff, CalendarPlus, Minus, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useApp } from "@/components/app-context";
import { Button, Card, Field, PageTitle, SectionTitle, Switch, inputClass, useToast } from "@/components/ui";
import { useReminders } from "@/db/hooks";
import { setSetting } from "@/db/settings";
import type { QuietHours, Reminder } from "@/db/types";
import {
  configureFeedingReminder,
  deleteReminder,
  setReminderEnabled,
} from "@/features/reminders/actions";
import { reminderTitle } from "@/features/reminders/engine";
import { ReminderSheet } from "@/features/reminders/reminder-sheet";
import { PushCard } from "@/features/push/push-card";
import { useLocale, useT, type MessageKey, type TFn } from "@/i18n";
import { buildIcs } from "@/lib/ics";
import { formatDayTime } from "@/lib/time";
import { isIos, isStandalone } from "@/lib/pwa";

function describe(r: Reminder, t: TFn, locale: string): string {
  const s = r.schedule;
  if (s.type === "once") return formatDayTime(s.at, locale);
  if (s.type === "interval") return t("reminder.everyH", { n: s.everyMin / 60 });
  const times = s.times.join(", ");
  if (s.type === "daily") return `${t("reminder.daily")} · ${times}`;
  const wd = new Intl.DateTimeFormat(locale, { weekday: "short" });
  return `${s.days.map((d) => wd.format(new Date(2024, 0, 7 + d))).join(" ")} · ${times}`;
}

export default function RemindersPage() {
  const { baby, babies, settings } = useApp();
  const t = useT();
  const locale = useLocale();
  const toast = useToast();
  const reminders = useReminders();
  const [sheet, setSheet] = useState<{ open: boolean; editing?: Reminder }>({ open: false });
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">(() =>
    typeof Notification === "undefined" ? "unsupported" : Notification.permission,
  );

  const feeding = reminders?.find((r) => r.babyId === baby.id && r.kind === "feeding-interval");
  const custom = (reminders ?? [])
    .filter((r) => r.kind !== "feeding-interval" && (r.babyId === baby.id || r.babyId === undefined))
    .sort((a, b) => (a.nextFireAt ?? Infinity) - (b.nextFireAt ?? Infinity));

  const intervalMin = feeding?.schedule.type === "interval" ? feeding.schedule.everyMin : settings.defaultIntervalMin;
  const feedingEnabled = feeding?.enabled ?? false;
  const feedingQuiet = feeding?.respectQuietHours ?? true;

  const saveFeeding = (patch: Partial<{ enabled: boolean; everyMin: number; respectQuietHours: boolean }>) =>
    configureFeedingReminder(baby.id, {
      enabled: feedingEnabled,
      everyMin: intervalMin,
      respectQuietHours: feedingQuiet,
      ...patch,
    });

  async function bumpInterval(delta: number) {
    const next = Math.min(8 * 60, Math.max(30, intervalMin + delta));
    await saveFeeding({ everyMin: next });
    await setSetting("defaultIntervalMin", next);
  }

  async function enableNotifications() {
    if (typeof Notification === "undefined") return;
    setPerm(await Notification.requestPermission());
  }

  async function exportIcs() {
    const { saveFile } = await import("@/features/backup/save-file");
    const ics = buildIcs(reminders ?? [], (r) => reminderTitle(r, babies, t));
    await saveFile("mybaby-reminders.ics", ics, "text/calendar");
  }

  async function remove(r: Reminder) {
    await deleteReminder(r.id);
    toast.show({ message: t("common.deleted") });
  }

  const quiet = settings.quietHours;
  const setQuiet = (patch: Partial<QuietHours>) => setSetting("quietHours", { ...quiet, ...patch });

  return (
    <div>
      <PageTitle
        action={
          <Button variant="primary" onClick={() => setSheet({ open: true })}>
            <Plus aria-hidden className="size-5" />
            {t("reminder.add")}
          </Button>
        }
      >
        {t("nav.reminders")}
      </PageTitle>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <Card className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">{t("reminder.nextFeeding")}</h2>
                <p className="text-sm text-muted">{t("reminder.nextFeedingHint", { name: baby.name })}</p>
              </div>
              <Switch checked={feedingEnabled} onChange={(enabled) => saveFeeding({ enabled })} label={t("reminder.nextFeeding")} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium">{t("reminder.interval")}</span>
              <div className="flex items-center gap-2">
                <Button aria-label={t("reminder.shorter")} className="!px-0 w-12" onClick={() => bumpInterval(-30)}>
                  <Minus aria-hidden className="size-5" />
                </Button>
                <output aria-live="polite" className="w-16 text-center text-lg font-bold tabular-nums">
                  {intervalMin / 60} h
                </output>
                <Button aria-label={t("reminder.longer")} className="!px-0 w-12" onClick={() => bumpInterval(30)}>
                  <Plus aria-hidden className="size-5" />
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm">{t("reminder.respectQuiet")}</span>
              <Switch checked={feedingQuiet} onChange={(respectQuietHours) => saveFeeding({ respectQuietHours })} label={t("reminder.respectQuiet")} />
            </div>
            {feeding?.nextFireAt && feedingEnabled && (
              <p className="text-sm text-muted">{t("reminder.nextAt", { at: formatDayTime(feeding.nextFireAt, locale) })}</p>
            )}
          </Card>

          <Card className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">{t("reminder.quietHours")}</h2>
                <p className="text-sm text-muted">{t("reminder.quietHint")}</p>
              </div>
              <Switch checked={quiet.enabled} onChange={(enabled) => setQuiet({ enabled })} label={t("reminder.quietHours")} />
            </div>
            {quiet.enabled && (
              <div className="grid grid-cols-2 gap-3">
                <Field label={t("reminder.from")}>
                  {(id) => <input id={id} type="time" className={inputClass} value={quiet.start} onChange={(e) => setQuiet({ start: e.target.value })} />}
                </Field>
                <Field label={t("reminder.to")}>
                  {(id) => <input id={id} type="time" className={inputClass} value={quiet.end} onChange={(e) => setQuiet({ end: e.target.value })} />}
                </Field>
              </div>
            )}
          </Card>

          <Card className="flex flex-col gap-3">
            <div className="flex items-start gap-3">
              {perm === "granted" ? <Bell aria-hidden className="mt-0.5 size-6 text-ok" /> : <BellOff aria-hidden className="mt-0.5 size-6 text-muted" />}
              <div className="flex-1">
                <h2 className="font-semibold">{t("reminder.notifications")}</h2>
                <p className="text-sm text-muted">
                  {perm === "granted"
                    ? t("reminder.notifOn")
                    : perm === "denied"
                      ? t("reminder.notifDenied")
                      : perm === "unsupported"
                        ? isIos() && !isStandalone()
                          ? t("reminder.notifIos")
                          : t("reminder.notifUnsupported")
                        : t("reminder.notifOff")}
                </p>
              </div>
            </div>
            {perm === "default" && <Button variant="primary" onClick={enableNotifications}>{t("reminder.enableNotif")}</Button>}
            <p className="text-xs text-muted">{t("reminder.limits")}</p>
          </Card>

          <PushCard />
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <SectionTitle>{t("reminder.others")}</SectionTitle>
            <Button variant="ghost" onClick={exportIcs}>
              <CalendarPlus aria-hidden className="size-5" />
              {t("reminder.exportIcs")}
            </Button>
          </div>
          {reminders && custom.length === 0 && (
            <Card className="text-center text-muted">{t("reminder.empty")}</Card>
          )}
          {custom.map((r) => (
            <Card key={r.id} className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{r.title}</p>
                <p className="text-sm text-muted">
                  <span className="mr-1 rounded-full bg-surface2 px-2 py-0.5 text-xs">{t(`reminder.kind.${r.kind}` as MessageKey)}</span>
                  {describe(r, t, locale)}
                </p>
                {r.enabled && r.nextFireAt && r.schedule.type !== "once" && (
                  <p className="text-xs text-muted">{t("reminder.nextAt", { at: `${formatDayTime(r.nextFireAt, locale)}` })}</p>
                )}
                {!r.enabled && <p className="text-xs text-muted">{t("reminder.off")}</p>}
              </div>
              <Switch checked={r.enabled} onChange={(enabled) => setReminderEnabled(r, enabled)} label={r.title} />
              <button
                type="button"
                aria-label={t("common.edit")}
                className="grid size-12 shrink-0 place-items-center rounded-full hover:bg-surface2"
                onClick={() => setSheet({ open: true, editing: r })}
              >
                <Pencil aria-hidden className="size-5" />
              </button>
              <button
                type="button"
                aria-label={t("common.delete")}
                className="grid size-12 shrink-0 place-items-center rounded-full hover:bg-surface2"
                onClick={() => remove(r)}
              >
                <Trash2 aria-hidden className="size-5" />
              </button>
            </Card>
          ))}
          <p className="text-xs text-muted">{t("reminder.icsHint")}</p>
        </div>
      </div>

      <ReminderSheet open={sheet.open} editing={sheet.editing} onClose={() => setSheet({ open: false })} />
    </div>
  );
}
