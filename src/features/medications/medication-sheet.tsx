"use client";

import clsx from "clsx";
import { useState } from "react";
import { useApp } from "@/components/app-context";
import { Button, Field, Sheet, inputClass, useToast } from "@/components/ui";
import { addMedication, updateMedication } from "@/db/repo";
import type { Medication } from "@/db/types";
import { useT, type MessageKey } from "@/i18n";
import { trackFeature } from "@/lib/telemetry";
import { fromLocalInput, toLocalInput } from "@/lib/time";
import { MED_UNITS, type MedUnit } from "./logic";

const PRESETS: { key: MessageKey; unit: MedUnit }[] = [
  { key: "med.preset.vitD", unit: "drops" },
  { key: "med.preset.acetaminophen", unit: "ml" },
  { key: "med.preset.ibuprofen", unit: "ml" },
  { key: "med.preset.saline", unit: "drops" },
  { key: "med.preset.probiotic", unit: "drops" },
];

interface Props {
  open: boolean;
  onClose: () => void;
  editing?: Medication;
}

function MedicationForm({ onClose, editing }: Omit<Props, "open">) {
  const { baby } = useApp();
  const t = useT();
  const toast = useToast();

  // Sheet unmounts children when closed, so state initializes cleanly on every open.
  const [name, setName] = useState(editing?.name ?? "");
  const [dose, setDose] = useState(editing ? String(editing.dose) : "");
  const [unit, setUnit] = useState<string>(editing?.unit ?? "ml");
  const [when, setWhen] = useState(() => toLocalInput(editing?.at ?? Date.now()));
  const [note, setNote] = useState(editing?.note ?? "");
  const [error, setError] = useState(false);

  async function save() {
    const parsed = Number(dose.replace(",", "."));
    const at = fromLocalInput(when) || Date.now();
    if (!name.trim() || dose.trim() === "" || !Number.isFinite(parsed) || parsed <= 0) {
      setError(true);
      return;
    }
    setError(false);
    if (editing) {
      await updateMedication(editing.id, { name, dose: parsed, unit, at, note });
      toast.show({ message: t("med.updated") });
    } else {
      await addMedication(baby.id, { name, dose: parsed, unit, at, note });
      trackFeature("medication_logged");
      toast.show({ message: t("med.saved") });
    }
    onClose();
  }

  return (
    <>
      {!editing && (
        <div>
          <p className="mb-1.5 text-sm font-medium">{t("med.common")}</p>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => {
              const label = t(p.key);
              const active = name.trim().toLowerCase() === label.toLowerCase();
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => {
                    setName(label);
                    setUnit(p.unit);
                  }}
                  className={clsx(
                    "min-h-10 rounded-full border px-3.5 text-sm font-semibold transition",
                    active ? "border-primary bg-primary text-primary-fg" : "border-line bg-surface2 text-fg",
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <Field label={t("med.name")}>
        {(id) => (
          <input
            id={id}
            className={inputClass}
            value={name}
            maxLength={120}
            placeholder={t("med.namePlaceholder")}
            onChange={(e) => setName(e.target.value)}
          />
        )}
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label={t("med.dose")}>
          {(id) => (
            <input
              id={id}
              inputMode="decimal"
              className={inputClass}
              value={dose}
              placeholder="2.5"
              onChange={(e) => setDose(e.target.value)}
            />
          )}
        </Field>

        <Field label={t("med.unit")}>
          {(id) => (
            <select id={id} className={inputClass} value={unit} onChange={(e) => setUnit(e.target.value)}>
              {MED_UNITS.map((u) => (
                <option key={u} value={u}>
                  {t(`med.unit.${u}` as MessageKey)}
                </option>
              ))}
              {!MED_UNITS.includes(unit as MedUnit) && <option value={unit}>{unit}</option>}
            </select>
          )}
        </Field>
      </div>

      <Field label={t("med.when")}>
        {(id) => (
          <input id={id} type="datetime-local" className={inputClass} value={when} onChange={(e) => setWhen(e.target.value)} />
        )}
      </Field>

      <Field label={t("common.note")}>
        {(id) => <input id={id} className={inputClass} value={note} maxLength={280} onChange={(e) => setNote(e.target.value)} />}
      </Field>

      <p className="text-xs text-muted">{t("med.disclaimer")}</p>
      {error && <p className="text-sm font-semibold text-danger">{t("med.needFields")}</p>}

      <Button variant="primary" size="lg" onClick={save}>
        {t("common.save")}
      </Button>
    </>
  );
}

export function MedicationSheet({ open, onClose, editing }: Props) {
  const t = useT();
  return (
    <Sheet open={open} onClose={onClose} title={editing ? t("med.edit") : t("med.add")}>
      <MedicationForm onClose={onClose} editing={editing} />
    </Sheet>
  );
}
