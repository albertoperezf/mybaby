"use client";

import { useState } from "react";
import { useApp } from "@/components/app-context";
import { Button, Field, Sheet, inputClass, useToast } from "@/components/ui";
import type { Vaccine } from "@/db/types";
import { useLocale, useT } from "@/i18n";
import { formatDate, toDateInput } from "@/lib/time";
import { doseLabel, vaccineProtects } from "./labels";
import { earliestOn, type DoseStatus } from "./logic";
import { StatusChip } from "./dose-row";
import { addCustomDose, deleteCustomDose, markGiven, restoreDose, setDueDate, skipDose, unmarkGiven, unskipDose } from "./repo";

interface Props {
  dose: Vaccine | null;
  status: DoseStatus;
  byCode: Map<string, Vaccine>;
  onClose: () => void;
}

function DoseForm({ dose, status, byCode, onClose }: { dose: Vaccine; status: DoseStatus; byCode: Map<string, Vaccine>; onClose: () => void }) {
  const t = useT();
  const locale = useLocale();
  const toast = useToast();
  const [today] = useState(() => toDateInput(Date.now()));
  const [givenOn, setGivenOn] = useState(dose.givenOn ?? today);
  const [lot, setLot] = useState(dose.lot ?? "");
  const [provider, setProvider] = useState(dose.provider ?? "");
  const [note, setNote] = useState(dose.note ?? "");
  const [dueOn, setDueOn] = useState(dose.dueOn ?? "");

  const custom = dose.scheduleId === "custom";
  const protects = vaccineProtects(dose, locale);
  const earliest = earliestOn(dose, byCode);
  const shifted = earliest && dose.windowFrom && earliest > dose.windowFrom;
  const given = status === "given";

  async function save() {
    await markGiven(dose.id, { givenOn, lot, provider, note });
    onClose();
    toast.show({ message: t("vaccine.savedGiven"), actionLabel: given ? undefined : t("common.undo"), onAction: given ? undefined : () => unmarkGiven(dose.id) });
  }

  async function remove() {
    await deleteCustomDose(dose.id);
    onClose();
    toast.show({ message: t("common.deleted"), actionLabel: t("common.undo"), onAction: () => restoreDose(dose.id) });
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        <StatusChip status={status} />
        {protects && <p className="text-sm">{protects}</p>}
        {dose.windowFrom && dose.windowTo && (
          <p className="text-sm text-muted">{t("vaccine.recommended", { from: formatDate(dose.windowFrom, locale), to: formatDate(dose.windowTo, locale) })}</p>
        )}
        {shifted && !given && <p className="text-sm font-semibold text-warn">{t("vaccine.earliest", { date: formatDate(earliest, locale) })}</p>}
        {dose.skippedOn && <p className="text-sm text-muted">{t("vaccine.skippedOn", { date: formatDate(dose.skippedOn, locale) })}</p>}
      </div>

      <Field label={t("vaccine.dateGiven")}>
        {(id) => <input id={id} type="date" className={inputClass} value={givenOn} max={today} onChange={(e) => setGivenOn(e.target.value)} />}
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("vaccine.lot")}>
          {(id) => <input id={id} className={inputClass} value={lot} maxLength={60} onChange={(e) => setLot(e.target.value)} />}
        </Field>
        <Field label={t("vaccine.provider")}>
          {(id) => <input id={id} className={inputClass} value={provider} maxLength={120} onChange={(e) => setProvider(e.target.value)} />}
        </Field>
      </div>
      <Field label={t("common.note")}>
        {(id) => <textarea id={id} rows={2} maxLength={1000} className={`${inputClass} py-2`} value={note} onChange={(e) => setNote(e.target.value)} />}
      </Field>

      <Button variant="primary" size="lg" disabled={!givenOn} onClick={save}>
        {given ? t("common.save") : t("vaccine.markGiven")}
      </Button>

      {given ? (
        <Button
          variant="ghost"
          onClick={async () => {
            await unmarkGiven(dose.id);
            onClose();
          }}
        >
          {t("vaccine.markNotGiven")}
        </Button>
      ) : (
        <>
          <Field label={t("vaccine.scheduledFor")} hint={t("vaccine.scheduledHint")}>
            {(id) => (
              <div className="flex gap-2">
                <input id={id} type="date" className={inputClass} value={dueOn} onChange={(e) => setDueOn(e.target.value)} />
                <Button disabled={!dueOn || dueOn === dose.dueOn} onClick={async () => { await setDueDate(dose.id, dueOn); onClose(); }}>
                  {t("common.save")}
                </Button>
              </div>
            )}
          </Field>
          {!custom &&
            (dose.skippedOn ? (
              <Button variant="ghost" onClick={async () => { await unskipDose(dose.id); onClose(); }}>
                {t("vaccine.unskip")}
              </Button>
            ) : (
              <Button variant="ghost" onClick={async () => { await skipDose(dose.id, today, note); onClose(); }}>
                {t("vaccine.skip")}
              </Button>
            ))}
        </>
      )}
      {custom && (
        <Button variant="ghost" className="!text-danger" onClick={remove}>
          {t("common.delete")}
        </Button>
      )}
    </>
  );
}

export function DoseSheet({ dose, status, byCode, onClose }: Props) {
  const locale = useLocale();
  return (
    <Sheet open={dose !== null} onClose={onClose} title={dose ? doseLabel(dose, locale) : ""}>
      {dose && <DoseForm key={dose.id} dose={dose} status={status} byCode={byCode} onClose={onClose} />}
    </Sheet>
  );
}

export function CustomVaccineSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  return (
    <Sheet open={open} onClose={onClose} title={t("vaccine.addOther")}>
      <CustomForm onClose={onClose} />
    </Sheet>
  );
}

function CustomForm({ onClose }: { onClose: () => void }) {
  const t = useT();
  const { baby } = useApp();
  const [today] = useState(() => toDateInput(Date.now()));
  const [name, setName] = useState("");
  const [state, setState] = useState<"given" | "planned">("given");
  const [date, setDate] = useState(today);
  const [lot, setLot] = useState("");
  const [error, setError] = useState(false);

  async function save() {
    if (!name.trim() || !date) return setError(true);
    await addCustomDose(baby.id, {
      name,
      ...(state === "given" ? { givenOn: date } : { dueOn: date }),
      lot,
    });
    onClose();
  }

  return (
    <>
      <Field label={t("vaccine.name")}>
        {(id) => <input id={id} className={inputClass} value={name} maxLength={120} placeholder={t("vaccine.namePlaceholder")} onChange={(e) => setName(e.target.value)} />}
      </Field>
      <div role="radiogroup" aria-label={t("vaccine.stateLabel")} className="flex gap-2">
        {(["given", "planned"] as const).map((s) => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={state === s}
            onClick={() => setState(s)}
            className={`min-h-11 flex-1 rounded-full border px-4 text-sm font-bold ${state === s ? "border-primary bg-primary text-primary-fg" : "border-line bg-surface2"}`}
          >
            {t(s === "given" ? "vaccine.alreadyGiven" : "vaccine.planned")}
          </button>
        ))}
      </div>
      <Field label={state === "given" ? t("vaccine.dateGiven") : t("vaccine.scheduledFor")}>
        {(id) => <input id={id} type="date" className={inputClass} value={date} max={state === "given" ? today : undefined} onChange={(e) => setDate(e.target.value)} />}
      </Field>
      <Field label={t("vaccine.lot")}>
        {(id) => <input id={id} className={inputClass} value={lot} maxLength={60} onChange={(e) => setLot(e.target.value)} />}
      </Field>
      {error && (
        <p role="alert" className="text-sm font-semibold text-danger">
          {t("vaccine.needName")}
        </p>
      )}
      <Button variant="primary" size="lg" onClick={save}>
        {t("common.save")}
      </Button>
    </>
  );
}
