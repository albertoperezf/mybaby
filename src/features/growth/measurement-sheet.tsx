"use client";

import { useState } from "react";
import { useApp } from "@/components/app-context";
import { Button, Field, Segmented, Sheet, inputClass, useToast } from "@/components/ui";
import { addMeasurement, updateMeasurement, type MeasurementInput } from "@/db/repo";
import type { Measurement } from "@/db/types";
import { useT } from "@/i18n";
import { toDateInput } from "@/lib/time";
import { cmToMm, gToLbOz, inToMm, kgToG, lbOzToG, lengthValue } from "@/lib/units";

interface Props {
  open: boolean;
  onClose: () => void;
  editing?: Measurement;
}

const parse = (v: string) => {
  const n = Number(v.replace(",", "."));
  return v.trim() !== "" && Number.isFinite(n) && n > 0 ? n : undefined;
};

function MeasurementForm({ onClose, editing }: Omit<Props, "open">) {
  const t = useT();
  const toast = useToast();
  const { baby, settings } = useApp();
  const imperial = settings.measureUnit === "imperial";

  // Mounted fresh on every open, so initial values come straight from `editing`.
  const [today] = useState(() => toDateInput(Date.now()));
  const [date, setDate] = useState(editing?.measuredOn ?? today);
  const [kg, setKg] = useState(editing?.weightG && !imperial ? String(Number((editing.weightG / 1000).toFixed(3))) : "");
  const [lb, setLb] = useState(editing?.weightG && imperial ? String(gToLbOz(editing.weightG).lb) : "");
  const [oz, setOz] = useState(editing?.weightG && imperial ? String(gToLbOz(editing.weightG).oz) : "");
  const [length, setLength] = useState(editing?.lengthMm ? String(lengthValue(editing.lengthMm, settings.measureUnit)) : "");
  const [head, setHead] = useState(editing?.headMm ? String(lengthValue(editing.headMm, settings.measureUnit)) : "");
  const [source, setSource] = useState<"doctor" | "home">(editing?.source ?? "doctor");
  const [note, setNote] = useState(editing?.note ?? "");
  const [error, setError] = useState(false);

  async function save() {
    const weightG = imperial
      ? parse(lb) !== undefined || parse(oz) !== undefined
        ? lbOzToG(parse(lb) ?? 0, parse(oz) ?? 0)
        : undefined
      : parse(kg) !== undefined
        ? kgToG(parse(kg) as number)
        : undefined;
    const len = parse(length);
    const hd = parse(head);
    const toMm = imperial ? inToMm : cmToMm;
    const input: MeasurementInput = {
      measuredOn: date,
      weightG,
      lengthMm: len !== undefined ? toMm(len) : undefined,
      headMm: hd !== undefined ? toMm(hd) : undefined,
      source,
      note: note.trim() || undefined,
    };
    if (!date || (weightG === undefined && input.lengthMm === undefined && input.headMm === undefined)) {
      setError(true);
      return;
    }
    if (editing) await updateMeasurement(editing.id, input);
    else await addMeasurement(baby.id, input);
    onClose();
    toast.show({ message: t("growth.saved") });
  }

  const lenUnit = imperial ? "in" : "cm";

  return (
    <>
      <Field label={t("growth.date")}>
        {(id) => <input id={id} type="date" className={inputClass} value={date} max={today} onChange={(e) => setDate(e.target.value)} />}
      </Field>

      {imperial ? (
        <div className="grid grid-cols-2 gap-3">
          <Field label={`${t("growth.weight")} (lb)`}>
            {(id) => <input id={id} inputMode="decimal" className={inputClass} value={lb} onChange={(e) => setLb(e.target.value)} />}
          </Field>
          <Field label={`${t("growth.weight")} (oz)`}>
            {(id) => <input id={id} inputMode="decimal" className={inputClass} value={oz} onChange={(e) => setOz(e.target.value)} />}
          </Field>
        </div>
      ) : (
        <Field label={`${t("growth.weight")} (kg)`}>
          {(id) => <input id={id} inputMode="decimal" className={inputClass} value={kg} onChange={(e) => setKg(e.target.value)} />}
        </Field>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label={`${t("growth.length")} (${lenUnit})`}>
          {(id) => <input id={id} inputMode="decimal" className={inputClass} value={length} onChange={(e) => setLength(e.target.value)} />}
        </Field>
        <Field label={`${t("growth.head")} (${lenUnit})`}>
          {(id) => <input id={id} inputMode="decimal" className={inputClass} value={head} onChange={(e) => setHead(e.target.value)} />}
        </Field>
      </div>

      <Segmented
        label={t("growth.source")}
        value={source}
        onChange={setSource}
        options={[
          { value: "doctor", label: t("growth.doctor") },
          { value: "home", label: t("growth.home") },
        ]}
      />

      <Field label={t("common.note")}>
        {(id) => <textarea id={id} rows={2} maxLength={1000} className={`${inputClass} py-2`} value={note} onChange={(e) => setNote(e.target.value)} />}
      </Field>

      {error && (
        <p role="alert" className="text-sm font-medium text-danger">
          {t("growth.needOne")}
        </p>
      )}
      <Button variant="primary" size="lg" onClick={save}>
        {t("common.save")}
      </Button>
    </>
  );
}

export function MeasurementSheet({ open, onClose, editing }: Props) {
  const t = useT();
  return (
    <Sheet open={open} onClose={onClose} title={editing ? t("growth.edit") : t("growth.add")}>
      <MeasurementForm onClose={onClose} editing={editing} />
    </Sheet>
  );
}
