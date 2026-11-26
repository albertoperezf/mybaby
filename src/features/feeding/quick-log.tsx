"use client";

import clsx from "clsx";
import { Droplets, Milk } from "lucide-react";
import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useApp } from "@/components/app-context";
import { Button, Field, Segmented, Sheet, inputClass } from "@/components/ui";
import { db } from "@/db/schema";
import { useLastAmount } from "@/db/hooks";
import { updateFeeding } from "@/db/repo";
import type { DiaperType, Feeding, ID, MilkType } from "@/db/types";
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
  initialTab: "feed" | "diaper";
  editFeedingId?: ID;
}

function QuickLogForm({ onClose, initialTab, editing: feeding }: { onClose: () => void; initialTab: "feed" | "diaper"; editing?: Feeding }) {
  const t = useT();
  const { baby, settings } = useApp();
  const { logFeeding: addFeeding, logDiaper: addDiaper } = useLogging();
  const unit = settings.volumeUnit;
  const last = useLastAmount(baby.id);
  const editFeedingId = feeding?.id;
  const editUnit = feeding?.enteredUnit ?? unit;

  // The sheet unmounts this form when closed, so state starts fresh from `feeding` on every open.
  const [tab, setTab] = useState<"feed" | "diaper">(initialTab);
  const [when, setWhen] = useState<When>(feeding ? { custom: toLocalInput(feeding.at) } : { offsetMin: 0 });
  const [targets, setTargets] = useState<ID[]>([baby.id]);
  const [amount, setAmount] = useState(feeding?.amountMl !== undefined ? String(volumeNumber(feeding.amountMl, editUnit)) : "");
  const [formUnit, setFormUnit] = useState<"oz" | "ml">(editUnit);
  const [milk, setMilk] = useState<MilkType | "">(feeding?.milk ?? "");
  const [note, setNote] = useState(feeding?.note ?? "");
  const [showMore, setShowMore] = useState(Boolean(feeding));

  const editing = Boolean(feeding);

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
    if (editFeedingId) {
      await updateFeeding(editFeedingId, {
        at,
        amountMl: ml,
        enteredUnit,
        milk: milk || undefined,
        note: note.trim() || undefined,
      });
      await rescheduleFeedingReminder(baby.id);
      onClose();
      return;
    }
    onClose();
    await addFeeding(targets, {
      at,
      amountMl: ml,
      enteredUnit,
      milk: milk || undefined,
      note: note.trim() || undefined,
    });
  }

  async function logDiaper(type: DiaperType) {
    onClose();
    await addDiaper(targets, type, resolveAt(when), note.trim() || undefined);
  }

  const parsedAmount = Number(amount.replace(",", "."));
  const hasAmount = amount.trim() !== "" && Number.isFinite(parsedAmount) && parsedAmount > 0;

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
          ]}
        />
      )}

      <BabyChips selected={targets} onChange={setTargets} />

      {tab === "feed" ? (
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
                    <Milk aria-hidden className="size-5" />
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
            className="min-h-11 self-start text-sm font-medium text-primary underline"
            aria-expanded={showMore}
            onClick={() => setShowMore((v) => !v)}
          >
            {t("quick.moreOptions")}
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
            <Button variant="ghost" onClick={() => logFeeding(undefined, unit)}>
              {t("quick.logNoAmount")}
            </Button>
          )}
        </>
      ) : (
        <>
          <div>
            <p className="mb-2 text-sm font-medium">{t("quick.tapToLog")}</p>
            <div className="grid grid-cols-2 gap-2">
              {(["wet", "dirty", "both", "dry"] as const).map((type) => (
                <Button key={type} size="lg" onClick={() => logDiaper(type)}>
                  <Droplets aria-hidden className="size-5" />
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
      )}
    </>
  );
}

export function QuickLogSheet({ open, onClose, initialTab, editFeedingId }: Props) {
  const t = useT();
  return (
    <Sheet open={open} onClose={onClose} title={editFeedingId ? t("quick.editFeeding") : t("quick.title")}>
      <QuickLogLoader onClose={onClose} initialTab={initialTab} editFeedingId={editFeedingId} />
    </Sheet>
  );
}

/** For edits, waits for the feeding to load so the form can start with the right values. */
function QuickLogLoader({ onClose, initialTab, editFeedingId }: Omit<Props, "open">) {
  const feeding = useLiveQuery(async () => (editFeedingId ? ((await db.feedings.get(editFeedingId)) ?? null) : null), [editFeedingId]);
  if (editFeedingId && !feeding) return null;
  return <QuickLogForm onClose={onClose} initialTab={initialTab} editing={feeding ?? undefined} />;
}

