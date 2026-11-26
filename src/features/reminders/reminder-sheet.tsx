"use client";

import clsx from "clsx";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useApp } from "@/components/app-context";
import { Button, Field, Segmented, Sheet, Switch, inputClass } from "@/components/ui";
import type { Reminder, ReminderKind, Schedule } from "@/db/types";
import { useLocale, useT, type MessageKey } from "@/i18n";
import { fromLocalInput, toLocalInput } from "@/lib/time";
import { saveCustomReminder, type CustomReminderInput } from "./actions";

type CustomKind = Exclude<ReminderKind, "feeding-interval">;
const KINDS: CustomKind[] = ["vitamin", "medication", "appointment", "custom"];
type Repeat = "once" | "daily" | "weekly";

interface Props {
  open: boolean;
  onClose: () => void;
  editing?: Reminder;
}

const ALL_DAYS = [1, 2, 3, 4, 5, 6, 0];

function ReminderForm({ onClose, editing }: Omit<Props, "open">) {
  const t = useT();
  const locale = useLocale();
  const { baby } = useApp();

  // Mounted fresh on every open, so initial values come straight from `editing`.
  const existing = editing && editing.kind !== "feeding-interval" ? editing : undefined;
  const s = existing?.schedule;
  const [kind, setKind] = useState<CustomKind>(existing && existing.kind !== "feeding-interval" ? existing.kind : "vitamin");
  const [title, setTitle] = useState(existing?.title ?? t("reminder.kind.vitamin"));
  const [repeat, setRepeat] = useState<Repeat>(s?.type === "once" || s?.type === "weekly" ? s.type : "daily");
  const [at, setAt] = useState(() => toLocalInput(s?.type === "once" ? s.at : Date.now() + 3_600_000));
  const [times, setTimes] = useState<string[]>(s && (s.type === "daily" || s.type === "weekly") ? s.times : ["09:00"]);
  const [days, setDays] = useState<number[]>(s?.type === "weekly" ? s.days : ALL_DAYS);
  const [quiet, setQuiet] = useState(existing?.respectQuietHours ?? false);
  const [error, setError] = useState<MessageKey | null>(null);

  const weekday = new Intl.DateTimeFormat(locale, { weekday: "short" });
  // 2024-01-07 is a Sunday, so index i maps to JS getDay() = i.
  const dayLabel = (d: number) => weekday.format(new Date(2024, 0, 7 + d));

  function pickKind(next: CustomKind) {
    const previousDefault = t(`reminder.kind.${kind}` as MessageKey);
    setKind(next);
    if (!title.trim() || title === previousDefault) setTitle(t(`reminder.kind.${next}` as MessageKey));
    if (next === "appointment") setRepeat("once");
  }

  async function save() {
    if (!title.trim()) return setError("reminder.needTitle");
    let schedule: Schedule;
    if (repeat === "once") {
      const ms = fromLocalInput(at);
      if (!Number.isFinite(ms)) return setError("reminder.needTime");
      schedule = { type: "once", at: ms };
    } else if (repeat === "daily") {
      schedule = { type: "daily", times: [...new Set(times.filter(Boolean))].sort() };
    } else {
      if (days.length === 0) return setError("reminder.needDay");
      schedule = { type: "weekly", days: [...days].sort(), times: [...new Set(times.filter(Boolean))].sort() };
    }
    if (schedule.type !== "once" && schedule.times.length === 0) return setError("reminder.needTime");
    const input: CustomReminderInput = { babyId: baby.id, kind, title: title.trim(), schedule, respectQuietHours: quiet };
    await saveCustomReminder(input, editing?.id);
    onClose();
  }

  return (
    <>
      <Segmented
        label={t("reminder.type")}
        value={kind}
        onChange={pickKind}
        options={KINDS.map((k) => ({ value: k, label: t(`reminder.kind.${k}` as MessageKey) }))}
      />
      <Field label={t("reminder.title")}>
        {(id) => <input id={id} className={inputClass} value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} />}
      </Field>
      <Segmented
        label={t("reminder.repeat")}
        value={repeat}
        onChange={setRepeat}
        options={[
          { value: "once", label: t("reminder.once") },
          { value: "daily", label: t("reminder.daily") },
          { value: "weekly", label: t("reminder.weekly") },
        ]}
      />

      {repeat === "once" ? (
        <Field label={t("reminder.when")}>
          {(id) => <input id={id} type="datetime-local" className={inputClass} value={at} onChange={(e) => setAt(e.target.value)} />}
        </Field>
      ) : (
        <>
          {repeat === "weekly" && (
            <fieldset>
              <legend className="mb-1 text-sm font-medium">{t("reminder.days")}</legend>
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5, 6, 0].map((d) => {
                  const on = days.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setDays(on ? days.filter((x) => x !== d) : [...days, d])}
                      className={clsx(
                        "min-h-11 min-w-12 rounded-full border px-3 text-sm font-medium",
                        on ? "border-primary bg-primary text-primary-fg" : "border-line bg-surface2",
                      )}
                    >
                      {dayLabel(d)}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">{t("reminder.times")}</legend>
            {times.map((time, i) => (
              <div key={i} className="flex gap-2">
                <input
                  type="time"
                  aria-label={`${t("reminder.times")} ${i + 1}`}
                  className={inputClass}
                  value={time}
                  onChange={(e) => setTimes(times.map((x, j) => (j === i ? e.target.value : x)))}
                />
                {times.length > 1 && (
                  <Button variant="ghost" aria-label={t("common.delete")} onClick={() => setTimes(times.filter((_, j) => j !== i))}>
                    ✕
                  </Button>
                )}
              </div>
            ))}
            {times.length < 6 && (
              <Button variant="ghost" className="self-start" onClick={() => setTimes([...times, "12:00"])}>
                <Plus aria-hidden className="size-4" />
                {t("reminder.addTime")}
              </Button>
            )}
          </fieldset>
        </>
      )}

      <div className="flex items-center justify-between gap-3">
        <span className="text-sm">{t("reminder.respectQuiet")}</span>
        <Switch checked={quiet} onChange={setQuiet} label={t("reminder.respectQuiet")} />
      </div>

      {error && (
        <p role="alert" className="text-sm font-medium text-danger">
          {t(error)}
        </p>
      )}
      <Button variant="primary" size="lg" onClick={save}>
        {t("common.save")}
      </Button>
    </>
  );
}

export function ReminderSheet({ open, onClose, editing }: Props) {
  const t = useT();
  return (
    <Sheet open={open} onClose={onClose} title={editing ? t("reminder.edit") : t("reminder.add")}>
      <ReminderForm onClose={onClose} editing={editing} />
    </Sheet>
  );
}
