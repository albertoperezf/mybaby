"use client";

import { useState } from "react";
import { Button, Field, Segmented, Sheet, inputClass } from "@/components/ui";
import { BABY_AVATARS, BABY_COLORS, type BabyInput } from "@/db/repo";
import type { Baby } from "@/db/types";
import { useT } from "@/i18n";
import { toDateInput } from "@/lib/time";

interface FormProps {
  initial?: Baby;
  submitLabel: string;
  onSubmit: (input: BabyInput) => void | Promise<void>;
  disabled?: boolean;
}

type SexChoice = "female" | "male" | "none";

export function BabyForm({ initial, submitLabel, onSubmit, disabled }: FormProps) {
  const t = useT();
  const [today] = useState(() => toDateInput(Date.now()));
  const [name, setName] = useState(initial?.name ?? "");
  const [birthDate, setBirthDate] = useState(initial?.birthDate ?? today);
  const [sex, setSex] = useState<SexChoice>(initial?.sex ?? "none");
  const [weeks, setWeeks] = useState(initial?.gestationalWeeks ? String(initial.gestationalWeeks) : "");
  const [avatar, setAvatar] = useState(initial?.avatar ?? BABY_AVATARS[0]);
  const [color, setColor] = useState(initial?.color ?? BABY_COLORS[0]);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const gw = weeks.trim() === "" ? undefined : Number(weeks);
    if (!name.trim() || !birthDate) return setError(t("baby.needName"));
    if (gw !== undefined && !(gw >= 22 && gw <= 45)) return setError(t("baby.badWeeks"));
    setError(null);
    await onSubmit({
      name: name.trim(),
      birthDate,
      sex: sex === "none" ? undefined : sex,
      gestationalWeeks: gw !== undefined && gw < 40 ? gw : undefined,
      birthWeightG: initial?.birthWeightG,
      avatar,
      color,
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-2xl bg-surface2 p-3">
        <div role="radiogroup" aria-label={t("baby.avatar")} className="flex flex-wrap gap-2">
          {BABY_AVATARS.map((e) => (
            <button
              key={e}
              type="button"
              role="radio"
              aria-checked={avatar === e}
              aria-label={e}
              onClick={() => setAvatar(e)}
              className={`grid size-12 place-items-center rounded-full border-2 text-2xl transition ${avatar === e ? "border-primary bg-surface" : "border-transparent"}`}
            >
              {e}
            </button>
          ))}
        </div>
        <div role="radiogroup" aria-label={t("baby.color")} className="flex flex-wrap gap-3">
          {BABY_COLORS.map((c, i) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={color === c}
              aria-label={`${t("baby.color")} ${i + 1}`}
              onClick={() => setColor(c)}
              style={{ background: c }}
              className={`size-9 rounded-full border-2 transition ${color === c ? "border-fg ring-2 ring-surface" : "border-transparent"}`}
            />
          ))}
        </div>
      </div>
      <Field label={t("baby.name")}>
        {(id) => <input id={id} className={inputClass} value={name} maxLength={60} autoComplete="off" onChange={(e) => setName(e.target.value)} />}
      </Field>
      <Field label={t("baby.birthDate")}>
        {(id) => <input id={id} type="date" className={inputClass} value={birthDate} max={today} onChange={(e) => setBirthDate(e.target.value)} />}
      </Field>
      <div>
        <p className="mb-1.5 text-sm font-medium">{t("baby.sex")}</p>
        <Segmented
          label={t("baby.sex")}
          value={sex}
          onChange={setSex}
          options={[
            { value: "female", label: t("sex.girl") },
            { value: "male", label: t("sex.boy") },
            { value: "none", label: t("sex.unspecified") },
          ]}
        />
        <p className="mt-1.5 text-xs text-muted">{t("baby.sexHint")}</p>
      </div>
      <Field label={t("baby.gestation")} hint={t("baby.gestationHint")}>
        {(id) => <input id={id} inputMode="numeric" className={inputClass} value={weeks} placeholder="40" onChange={(e) => setWeeks(e.target.value)} />}
      </Field>
      {error && (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
      <Button type="submit" variant="primary" size="lg" disabled={disabled}>
        {submitLabel}
      </Button>
    </form>
  );
}

export function BabySheet({ open, onClose, editing, onSubmit }: { open: boolean; onClose: () => void; editing?: Baby; onSubmit: (i: BabyInput) => Promise<void> }) {
  const t = useT();
  return (
    <Sheet open={open} onClose={onClose} title={editing ? t("baby.edit") : t("baby.add")}>
      <BabyForm
        initial={editing}
        submitLabel={t("common.save")}
        onSubmit={async (i) => {
          await onSubmit(i);
          onClose();
        }}
      />
    </Sheet>
  );
}
