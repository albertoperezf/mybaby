"use client";

import clsx from "clsx";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { BottleIcon, DiaperIcon, bottleFillLevel } from "@/components/activity-icons";
import { useApp } from "@/components/app-context";
import { Button, Field, Segmented, Sheet, inputClass } from "@/components/ui";
import { db } from "@/db/schema";
import { useLastAmount } from "@/db/hooks";
import { updateFeeding, updateSleep } from "@/db/repo";
import type { DiaperType, Feeding, ID, MilkType, Sleep } from "@/db/types";
import { rescheduleFeedingReminder } from "@/features/reminders/actions";
import { useLogging } from "./use-logging";
import { useT, type MessageKey } from "@/i18n";
import { formatVolume, toMl, volumeNumber } from "@/lib/units";
import { MIN, fromLocalInput, toLocalInput } from "@/lib/time";

const PRESETS = { oz: [2, 3, 4], ml: [60, 90, 120] } as const;
const FALLBACK_FOURTH = { oz: 5, ml: 150 } as const;
const OFFSETS = [0, 5, 15, 30] as const;

type When = { offsetMin: number } | { custom: string };
const resolveAt = (w: When) => ("custom" in w ? fromLocalInput(w.custom) || Date.now() : Date.now() - w.offsetMin * MIN);

function WhenPicker({ value, onChange }: { value: When; onChange: (w: When) => void }) {
  const t = useT();
  const isCustom = "custom" in value;
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium">{t("quick.when")}</legend>
      <div className="flex flex-wrap gap-2">
        {OFFSETS.map((m) => {
          const active = !isCustom && value.offsetMin === m;
          return (
            <button
              key={m}
              type="button"
              aria-pressed={active}
              onClick={() => onChange({ offsetMin: m })}
              className={clsx(
                "min-h-11 rounded-full border px-4 text-sm font-medium",
                active ? "border-primary bg-primary text-primary-fg" : "border-line bg-surface2",
              )}
            >
              {m === 0 ? t("quick.now") : t("quick.minAgo", { n: m })}
            </button>
          );
        })}
        <button
          type="button"
          aria-pressed={isCustom}
          onClick={() => onChange({ custom: toLocalInput(Date.now()) })}
          className={clsx(
            "min-h-11 rounded-full border px-4 text-sm font-medium",
            isCustom ? "border-primary bg-primary text-primary-fg" : "border-line bg-surface2",
          )}
        >
          {t("quick.custom")}
        </button>
      </div>
      {isCustom && (
        <input
          type="datetime-local"
          aria-label={t("quick.when")}
          className={inputClass}
          value={value.custom}
          onChange={(e) => onChange({ custom: e.target.value })}
        />
      )}
    </fieldset>
  );
}

function BabyChips({ selected, onChange }: { selected: ID[]; onChange: (ids: ID[]) => void }) {
  const { babies } = useApp();
  const t = useT();
  if (babies.length < 2) return null;
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium">{t("quick.for")}</legend>
      <div className="flex flex-wrap gap-2">
        {babies.map((b) => {
          const active = selected.includes(b.id);
          return (
            <button
              key={b.id}
              type="button"
              aria-pressed={active}
              onClick={() => {
                const next = active ? selected.filter((id) => id !== b.id) : [...selected, b.id];
                if (next.length > 0) onChange(next);
              }}
              className={clsx(
                "min-h-11 rounded-full border px-4 text-sm font-medium",
                active ? "border-primary bg-primary text-primary-fg" : "border-line bg-surface2",
              )}
            >
              {b.name}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
  initialTab: "feed" | "diaper" | "sleep";
  editFeedingId?: ID;
  editSleepId?: ID;
}

function QuickLogForm({
  onClose,
  initialTab,
  editing: feeding,
  editingSleep: sleep,
}: {
  onClose: () => void;
  initialTab: "feed" | "diaper" | "sleep";
  editing?: Feeding;
  editingSleep?: Sleep;
}) {
  const t = useT();
  const { baby, settings } = useApp();
  const { logFeeding: addFeeding, logDiaper: addDiaper, logSleep: addSleep } = useLogging();
  const unit = settings.volumeUnit;
  const last = useLastAmount(baby.id);
  const editFeedingId = feeding?.id;
  const editSleepId = sleep?.id;
  const editUnit = feeding?.enteredUnit ?? unit;

  // The sheet unmounts this form when closed, so state starts fresh from `feeding` / `sleep` on every open.
  const [tab, setTab] = useState<"feed" | "diaper" | "sleep">(sleep ? "sleep" : initialTab);
  const [feedKind, setFeedKind] = useState<"bottle" | "breast" | "pump">(
    feeding?.kind === "breast" || feeding?.kind === "pump" ? feeding.kind : "bottle",
  );
  const [when, setWhen] = useState<When>(feeding ? { custom: toLocalInput(feeding.at) } : { offsetMin: 0 });
  const [targets, setTargets] = useState<ID[]>([baby.id]);
  const [amount, setAmount] = useState(feeding?.amountMl !== undefined ? String(volumeNumber(feeding.amountMl, editUnit)) : "");
  const [formUnit, setFormUnit] = useState<"oz" | "ml">(editUnit);
  const [milk, setMilk] = useState<MilkType | "">(feeding?.milk ?? "");
  const [side, setSide] = useState<"left" | "right" | "both">(feeding?.side ?? "both");
  const [durationMin, setDurationMin] = useState(
    feeding?.durationSec ? String(Math.max(1, Math.round(feeding.durationSec / 60))) : "15",
  );
  const [note, setNote] = useState(feeding?.note ?? sleep?.note ?? "");
  const [showMore, setShowMore] = useState(Boolean(feeding));

  const [sleepStart, setSleepStart] = useState(() => toLocalInput(sleep?.startedAt ?? Date.now() - 30 * MIN));
  const [sleepEnd, setSleepEnd] = useState(() => toLocalInput(sleep?.endedAt ?? Date.now()));
  const [sleepError, setSleepError] = useState("");

  const editing = Boolean(feeding || sleep);

  const presets = useMemo(() => {
    const base: { label: string; value: number; ml: number }[] = PRESETS[unit].map((v) => ({
      label: formatVolume(toMl(v, unit), unit),
      value: v,
      ml: toMl(v, unit),
    }));
    const lastMl = last?.amountMl;
    const fourth =
      lastMl !== undefined
        ? { label: `${t("quick.last")} ${formatVolume(lastMl, unit)}`, value: volumeNumber(lastMl, unit), ml: lastMl }
        : { label: formatVolume(toMl(FALLBACK_FOURTH[unit], unit), unit), value: FALLBACK_FOURTH[unit], ml: toMl(FALLBACK_FOURTH[unit], unit) };
    return [...base, fourth];
  }, [unit, last, t]);

  async function logFeeding(ml: number | undefined, enteredUnit: "oz" | "ml") {
    const at = resolveAt(when);
    const parsedDur = Number(durationMin.replace(",", "."));
    const durationSec =
      feedKind !== "bottle" && Number.isFinite(parsedDur) && parsedDur > 0 ? Math.round(parsedDur * 60) : undefined;
    const resolvedMilk = feedKind === "bottle" ? milk || undefined : "breastmilk";
    const resolvedSide = feedKind === "bottle" ? undefined : side;

    if (editFeedingId) {
      await updateFeeding(editFeedingId, {
        at,
        kind: feedKind,
        amountMl: feedKind === "breast" ? undefined : ml,
        enteredUnit: feedKind === "breast" ? undefined : enteredUnit,
        milk: resolvedMilk,
        side: resolvedSide,
        durationSec,
        note: note.trim() || undefined,
      });
      await rescheduleFeedingReminder(baby.id);
      onClose();
      return;
    }
    onClose();
    await addFeeding(targets, {
      at,
      kind: feedKind,
      amountMl: feedKind === "breast" ? undefined : ml,
      enteredUnit: feedKind === "breast" ? undefined : enteredUnit,
      milk: resolvedMilk,
      side: resolvedSide,
      durationSec,
      note: note.trim() || undefined,
    });
  }

  async function logDiaper(type: DiaperType) {
    onClose();
    await addDiaper(targets, type, resolveAt(when), note.trim() || undefined);
  }

  async function saveSleep() {
    const startedAt = fromLocalInput(sleepStart);
    const endedAt = fromLocalInput(sleepEnd);
    if (!startedAt || !endedAt || endedAt <= startedAt) {
      setSleepError(t("timer.sleepInvalid"));
      return;
    }
    setSleepError("");
    if (editSleepId) {
      await updateSleep(editSleepId, { startedAt, endedAt, note: note.trim() || undefined });
      onClose();
      return;
    }
    onClose();
    await addSleep(targets, { startedAt, endedAt, note: note.trim() || undefined });
  }

  const parsedAmount = Number(amount.replace(",", "."));
  const hasAmount = amount.trim() !== "" && Number.isFinite(parsedAmount) && parsedAmount > 0;
  const parsedDur = Number(durationMin.replace(",", "."));
  const hasDur = durationMin.trim() !== "" && Number.isFinite(parsedDur) && parsedDur > 0;

  return (
    <>
      {!editing && (
        <Segmented
          label={t("quick.title")}
          value={tab}
          onChange={setTab}
          options={[
            { value: "feed", label: t("quick.feed") },
            { value: "diaper", label: t("quick.diaper") },
            { value: "sleep", label: t("quick.sleep") },
          ]}
        />
      )}

      {!editing && <BabyChips selected={targets} onChange={setTargets} />}

      {tab === "feed" ? (
        <>
          <Segmented
            label={t("quick.feedKind")}
            value={feedKind}
            onChange={setFeedKind}
            options={[
              { value: "bottle", label: t("timer.bottle") },
              { value: "breast", label: t("timer.breast") },
              { value: "pump", label: t("timer.pump") },
            ]}
          />

          {feedKind === "bottle" ? (
            <>
              {!editing && (
                <div>
                  <p className="mb-2 text-sm font-medium">{t("quick.tapToLog")}</p>
                  <div className="grid grid-cols-4 gap-2">
                    {presets.map((p, i) => (
                      <Button
                        key={i}
                        variant={i === 3 && last ? "primary" : "secondary"}
                        size="lg"
                        className="flex-col !px-1 !text-base leading-tight"
                        onClick={() => logFeeding(p.ml, unit)}
                      >
                        <BottleIcon level={bottleFillLevel(p.ml)} className="size-6" />
                        <span>{p.label}</span>
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              <Field label={editing ? t("quick.amount") : t("quick.otherAmount")}>
                {(id) => (
                  <div className="flex gap-2">
                    <input
                      id={id}
                      inputMode="decimal"
                      className={inputClass}
                      value={amount}
                      placeholder={formUnit === "oz" ? "3.5" : "100"}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                    <Segmented
                      label={t("settings.volumeUnit")}
                      value={formUnit}
                      onChange={setFormUnit}
                      options={[
                        { value: "oz", label: "oz" },
                        { value: "ml", label: "ml" },
                      ]}
                      className="w-32 shrink-0"
                    />
                  </div>
                )}
              </Field>

              <WhenPicker value={when} onChange={setWhen} />

              <button
                type="button"
                className="inline-flex min-h-11 items-center gap-2 self-start rounded-xl border border-line bg-surface2 px-3.5 text-sm font-semibold text-fg transition active:scale-[0.98]"
                aria-expanded={showMore}
                onClick={() => setShowMore((v) => !v)}
              >
                {t("quick.moreOptions")}
                {showMore ? <ChevronUp aria-hidden className="size-4 text-muted" /> : <ChevronDown aria-hidden className="size-4 text-muted" />}
              </button>
              {showMore && (
                <div className="flex flex-col gap-3">
                  <Segmented
                    label={t("quick.milkType")}
                    value={milk}
                    onChange={(v) => setMilk(v === milk ? "" : v)}
                    options={[
                      { value: "formula", label: t("quick.formula") },
                      { value: "breastmilk", label: t("quick.breastmilk") },
                      { value: "mixed", label: t("quick.mixed") },
                    ]}
                  />
                  <Field label={t("common.note")}>
                    {(id) => <input id={id} className={inputClass} value={note} maxLength={280} onChange={(e) => setNote(e.target.value)} />}
                  </Field>
                </div>
              )}

              <Button
                variant="primary"
                size="lg"
                disabled={editing ? false : !hasAmount}
                onClick={() => logFeeding(hasAmount ? toMl(parsedAmount, formUnit) : undefined, formUnit)}
              >
                {editing ? t("common.save") : t("quick.logFeeding")}
              </Button>
              {!editing && !hasAmount && (
                <Button variant="secondary" onClick={() => logFeeding(undefined, unit)}>
                  {t("quick.logNoAmount")}
                </Button>
              )}
            </>
          ) : (
            <>
              <Segmented
                label={t("timer.side")}
                value={side}
                onChange={setSide}
                options={[
                  { value: "left", label: t("timer.left") },
                  { value: "right", label: t("timer.right") },
                  { value: "both", label: t("timer.both") },
                ]}
              />
              <Field label={t("timer.durationMin")}>
                {(id) => (
                  <input
                    id={id}
                    inputMode="decimal"
                    className={inputClass}
                    value={durationMin}
                    onChange={(e) => setDurationMin(e.target.value)}
                  />
                )}
              </Field>
              {feedKind === "pump" && (
                <Field label={t("timer.pumpAmount")}>
                  {(id) => (
                    <div className="flex gap-2">
                      <input
                        id={id}
                        inputMode="decimal"
                        className={inputClass}
                        value={amount}
                        placeholder={formUnit === "oz" ? "3.5" : "100"}
                        onChange={(e) => setAmount(e.target.value)}
                      />
                      <Segmented
                        label={t("settings.volumeUnit")}
                        value={formUnit}
                        onChange={setFormUnit}
                        options={[
                          { value: "oz", label: "oz" },
                          { value: "ml", label: "ml" },
                        ]}
                        className="w-32 shrink-0"
                      />
                    </div>
                  )}
                </Field>
              )}
              <WhenPicker value={when} onChange={setWhen} />
              <Field label={t("common.note")}>
                {(id) => <input id={id} className={inputClass} value={note} maxLength={280} onChange={(e) => setNote(e.target.value)} />}
              </Field>
              <Button
                variant="primary"
                size="lg"
                disabled={!hasDur && !(feedKind === "pump" && hasAmount)}
                onClick={() => logFeeding(hasAmount ? toMl(parsedAmount, formUnit) : undefined, formUnit)}
              >
                {t("common.save")}
              </Button>
            </>
          )}
        </>
      ) : tab === "diaper" ? (
        <>
          <div>
            <p className="mb-2 text-sm font-medium">{t("quick.tapToLog")}</p>
            <div className="grid grid-cols-2 gap-2">
              {(["wet", "dirty", "both", "dry"] as const).map((type) => (
                <Button key={type} size="lg" onClick={() => logDiaper(type)}>
                  <DiaperIcon type={type} className="size-6 text-diaper" />
                  {t(`diaper.${type}` as MessageKey)}
                </Button>
              ))}
            </div>
          </div>
          <WhenPicker value={when} onChange={setWhen} />
          <Field label={t("common.note")}>
            {(id) => <input id={id} className={inputClass} value={note} maxLength={280} onChange={(e) => setNote(e.target.value)} />}
          </Field>
        </>
      ) : (
        <>
          <Field label={t("timer.sleepStart")}>
            {(id) => (
              <input
                id={id}
                type="datetime-local"
                className={inputClass}
                value={sleepStart}
                onChange={(e) => setSleepStart(e.target.value)}
              />
            )}
          </Field>
          <Field label={t("timer.sleepEnd")}>
            {(id) => (
              <input
                id={id}
                type="datetime-local"
                className={inputClass}
                value={sleepEnd}
                onChange={(e) => setSleepEnd(e.target.value)}
              />
            )}
          </Field>
          <Field label={t("common.note")}>
            {(id) => <input id={id} className={inputClass} value={note} maxLength={280} onChange={(e) => setNote(e.target.value)} />}
          </Field>
          {sleepError && <p className="text-sm font-semibold text-danger">{sleepError}</p>}
          <Button variant="primary" size="lg" onClick={saveSleep}>
            {editing ? t("common.save") : t("timer.logSleep")}
          </Button>
        </>
      )}
    </>
  );
}

export function QuickLogSheet({ open, onClose, initialTab, editFeedingId, editSleepId }: Props) {
  const t = useT();
  const title = editFeedingId
    ? t("quick.editFeeding")
    : editSleepId
      ? t("timer.editSleep")
      : t("quick.title");
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <QuickLogLoader onClose={onClose} initialTab={initialTab} editFeedingId={editFeedingId} editSleepId={editSleepId} />
    </Sheet>
  );
}

/** For edits, waits for the feeding or sleep to load so the form can start with the right values. */
function QuickLogLoader({ onClose, initialTab, editFeedingId, editSleepId }: Omit<Props, "open">) {
  const feeding = useLiveQuery(async () => (editFeedingId ? ((await db.feedings.get(editFeedingId)) ?? null) : null), [editFeedingId]);
  const sleep = useLiveQuery(async () => (editSleepId ? ((await db.sleeps.get(editSleepId)) ?? null) : null), [editSleepId]);
  if (editFeedingId && !feeding) return null;
  if (editSleepId && !sleep) return null;
  return <QuickLogForm onClose={onClose} initialTab={initialTab} editing={feeding ?? undefined} editingSleep={sleep ?? undefined} />;
}

