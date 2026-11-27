"use client";

import clsx from "clsx";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { ulid } from "ulid";
import { useApp } from "@/components/app-context";
import { Button, Field, Sheet, inputClass, useToast } from "@/components/ui";
import { addVisit, updateVisit } from "@/db/repo";
import type { DoctorVisit, VisitQuestion } from "@/db/types";
import { saveCustomReminder } from "@/features/reminders/actions";
import { useT, type MessageKey } from "@/i18n";
import { trackFeature } from "@/lib/telemetry";
import { toDateInput } from "@/lib/time";
import { dayBeforeMorningAt } from "./logic";

const PRESETS: MessageKey[] = [
  "visit.preset.wellChild",
  "visit.preset.sick",
  "visit.preset.specialist",
  "visit.preset.followUp",
];

interface Props {
  open: boolean;
  onClose: () => void;
  editing?: DoctorVisit;
  defaultProvider?: string;
}

function VisitForm({ onClose, editing, defaultProvider }: Omit<Props, "open">) {
  const { baby } = useApp();
  const t = useT();
  const toast = useToast();

  // Sheet unmounts children when closed, so state initializes cleanly on every open.
  const [visitedOn, setVisitedOn] = useState(() => editing?.visitedOn ?? toDateInput(Date.now()));
  const [reason, setReason] = useState(editing?.reason ?? "");
  const [provider, setProvider] = useState(editing?.provider ?? defaultProvider ?? "");
  const [questions, setQuestions] = useState<VisitQuestion[]>(editing?.questions ?? []);
  const [draftQuestion, setDraftQuestion] = useState("");
  const [summary, setSummary] = useState(editing?.summary ?? "");
  const [followUpOn, setFollowUpOn] = useState(editing?.followUpOn ?? "");
  const [createReminder, setCreateReminder] = useState(false);
  const [error, setError] = useState(false);

  const reminderTargetDate = followUpOn || visitedOn;
  const canRemind = Boolean(reminderTargetDate && dayBeforeMorningAt(reminderTargetDate) !== null);

  function addDraftQuestion() {
    const text = draftQuestion.trim();
    if (!text) return;
    setQuestions((prev) => [...prev, { id: ulid(), text, done: false }]);
    setDraftQuestion("");
  }

  async function save() {
    if (!visitedOn || !reason.trim()) {
      setError(true);
      return;
    }
    setError(false);
    // Include any unsent draft question so parents don't lose what they just typed.
    const allQuestions = draftQuestion.trim()
      ? [...questions, { id: ulid(), text: draftQuestion.trim(), done: false }]
      : questions;

    if (editing) {
      await updateVisit(editing.id, {
        visitedOn,
        reason,
        provider,
        questions: allQuestions,
        summary,
        followUpOn: followUpOn || undefined,
      });
      toast.show({ message: t("visit.updated") });
    } else {
      await addVisit(baby.id, {
        visitedOn,
        reason,
        provider,
        questions: allQuestions,
        summary,
        followUpOn: followUpOn || undefined,
      });
      trackFeature("visit_logged");
      toast.show({ message: t("visit.saved") });
    }

    if (createReminder && reminderTargetDate) {
      const fireAt = dayBeforeMorningAt(reminderTargetDate);
      if (fireAt !== null) {
        await saveCustomReminder({
          babyId: baby.id,
          kind: "appointment",
          title: t("visit.reminderTitle", { reason: reason.trim() }),
          schedule: { type: "once", at: fireAt },
          respectQuietHours: true,
        });
      }
    }

    onClose();
  }

  return (
    <>
      <Field label={t("visit.date")}>
        {(id) => (
          <input id={id} type="date" className={inputClass} value={visitedOn} onChange={(e) => setVisitedOn(e.target.value)} />
        )}
      </Field>

      {!editing && (
        <div>
          <p className="mb-1.5 text-sm font-medium">{t("visit.quickTypes")}</p>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((key) => {
              const label = t(key);
              const active = reason.trim().toLowerCase() === label.toLowerCase();
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setReason(label)}
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

      <Field label={t("visit.reason")}>
        {(id) => (
          <input
            id={id}
            className={inputClass}
            value={reason}
            maxLength={160}
            placeholder={t("visit.reasonPlaceholder")}
            onChange={(e) => setReason(e.target.value)}
          />
        )}
      </Field>

      <Field label={t("visit.provider")}>
        {(id) => (
          <input
            id={id}
            className={inputClass}
            value={provider}
            maxLength={120}
            placeholder={t("visit.providerPlaceholder")}
            onChange={(e) => setProvider(e.target.value)}
          />
        )}
      </Field>

      <div className="flex flex-col gap-2">
        <label htmlFor="visit-question-input" className="text-sm font-medium">
          {t("visit.questions")}
        </label>
        <div className="flex gap-2">
          <input
            id="visit-question-input"
            className={inputClass}
            value={draftQuestion}
            maxLength={300}
            placeholder={t("visit.questionPlaceholder")}
            onChange={(e) => setDraftQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addDraftQuestion();
              }
            }}
          />
          <Button variant="secondary" onClick={addDraftQuestion} className="shrink-0">
            <Plus aria-hidden className="size-4" />
            {t("visit.addQuestion")}
          </Button>
        </div>
        {questions.length > 0 && (
          <ul className="flex flex-col gap-1.5">
            {questions.map((q) => (
              <li key={q.id} className="flex items-center gap-2 rounded-xl border border-line bg-surface2 px-3 py-2">
                <input
                  type="checkbox"
                  checked={q.done}
                  aria-label={q.text}
                  onChange={() =>
                    setQuestions((prev) => prev.map((item) => (item.id === q.id ? { ...item, done: !item.done } : item)))
                  }
                  className="size-5 shrink-0 accent-[var(--primary)]"
                />
                <span className={clsx("min-w-0 flex-1 text-sm", q.done && "text-muted line-through")}>{q.text}</span>
                <button
                  type="button"
                  aria-label={t("common.delete")}
                  onClick={() => setQuestions((prev) => prev.filter((item) => item.id !== q.id))}
                  className="grid size-8 shrink-0 place-items-center rounded-full hover:bg-surface"
                >
                  <Trash2 aria-hidden className="size-4 text-muted" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Field label={t("visit.summary")}>
        {(id) => (
          <textarea
            id={id}
            rows={4}
            maxLength={4000}
            className={clsx(inputClass, "min-h-24 py-2.5")}
            value={summary}
            placeholder={t("visit.summaryPlaceholder")}
            onChange={(e) => setSummary(e.target.value)}
          />
        )}
      </Field>

      <Field label={t("visit.followUp")}>
        {(id) => (
          <input id={id} type="date" className={inputClass} value={followUpOn} onChange={(e) => setFollowUpOn(e.target.value)} />
        )}
      </Field>

      {canRemind && (
        <label className="flex min-h-11 items-center gap-3 rounded-xl border border-line bg-surface2 px-3.5 py-2">
          <input
            type="checkbox"
            checked={createReminder}
            onChange={(e) => setCreateReminder(e.target.checked)}
            className="size-5 shrink-0 accent-[var(--primary)]"
          />
          <span className="text-sm font-medium">{t("visit.createReminder")}</span>
        </label>
      )}

      {error && <p className="text-sm font-semibold text-danger">{t("visit.needReason")}</p>}

      <Button variant="primary" size="lg" onClick={save}>
        {t("common.save")}
      </Button>
    </>
  );
}

export function VisitSheet({ open, onClose, editing, defaultProvider }: Props) {
  const t = useT();
  return (
    <Sheet open={open} onClose={onClose} title={editing ? t("visit.edit") : t("visit.add")}>
      <VisitForm onClose={onClose} editing={editing} defaultProvider={defaultProvider} />
    </Sheet>
  );
}
