"use client";

import clsx from "clsx";
import { Calendar, Download, Pencil, Plus, Printer, Stethoscope, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useApp, useNow } from "@/components/app-context";
import { HealthTabs } from "@/components/health-tabs";
import { EmptyState, MoonIllustration } from "@/components/illustrations";
import { Button, Card, PageTitle, SectionTitle, useToast } from "@/components/ui";
import { useVisits } from "@/db/hooks";
import { restore, softDelete, toggleVisitQuestion } from "@/db/repo";
import type { DoctorVisit } from "@/db/types";
import { backupFilename, buildCsv } from "@/features/backup/export";
import { saveFile } from "@/features/backup/save-file";
import { lastProvider, questionProgress, splitVisits } from "@/features/visits/logic";
import { VisitSheet } from "@/features/visits/visit-sheet";
import { useLocale, useT } from "@/i18n";
import { formatAge } from "@/lib/age";
import { formatDate, toDateInput } from "@/lib/time";
import { ageInDays } from "@/lib/who";

export default function VisitsPage() {
  const { baby } = useApp();
  const t = useT();
  const locale = useLocale();
  const toast = useToast();
  const now = useNow(60_000);
  const visits = useVisits(baby.id);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<DoctorVisit | undefined>();

  const today = toDateInput(now);
  const { upcoming, past } = useMemo(() => splitVisits(visits ?? [], today), [visits, today]);
  const defaultProvider = useMemo(() => lastProvider(visits ?? []), [visits]);

  async function remove(v: DoctorVisit) {
    await softDelete("visits", [v.id]);
    toast.show({
      message: t("common.deleted"),
      actionLabel: t("common.undo"),
      onAction: () => restore("visits", [v.id]),
    });
  }

  async function exportCsv() {
    await saveFile(backupFilename("csv", "mybabylog-visits"), await buildCsv("visits"), "text/csv");
  }

  function renderVisitCard(v: DoctorVisit, highlight = false) {
    const ageDays = ageInDays(baby.birthDate, v.visitedOn);
    const ageLabel = ageDays >= 0 ? formatAge(ageDays, t) : "";
    const { done, total } = questionProgress(v.questions);

    return (
      <Card
        key={v.id}
        className={clsx("flex flex-col gap-3", highlight && "!border-growth/40 !bg-growth-tint/40")}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-growth-tint text-growth-ink">
              <Stethoscope aria-hidden className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="font-extrabold leading-snug">{v.reason}</p>
              <p className="text-sm text-muted">
                {formatDate(v.visitedOn, locale)}
                {ageLabel ? ` · ${ageLabel}` : ""}
                {v.provider ? ` · ${v.provider}` : ""}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center print:hidden">
            <button
              type="button"
              aria-label={t("common.edit")}
              className="grid size-11 place-items-center rounded-full hover:bg-surface2"
              onClick={() => {
                setEditing(v);
                setSheetOpen(true);
              }}
            >
              <Pencil aria-hidden className="size-5" />
            </button>
            <button
              type="button"
              aria-label={t("common.delete")}
              className="grid size-11 place-items-center rounded-full hover:bg-surface2"
              onClick={() => remove(v)}
            >
              <Trash2 aria-hidden className="size-5" />
            </button>
          </div>
        </div>

        {v.questions.length > 0 && (
          <div className="flex flex-col gap-1.5 rounded-2xl border border-line bg-surface p-3">
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wide text-muted">
              <span>{t("visit.questions")}</span>
              <span>{t("visit.questionsCount", { done, total })}</span>
            </div>
            <ul className="flex flex-col gap-1">
              {v.questions.map((q) => (
                <li key={q.id}>
                  <label className="flex min-h-9 cursor-pointer items-center gap-2.5 text-sm">
                    <input
                      type="checkbox"
                      checked={q.done}
                      onChange={() => void toggleVisitQuestion(v.id, q.id)}
                      className="size-5 shrink-0 accent-[var(--primary)]"
                    />
                    <span className={clsx(q.done && "text-muted line-through")}>{q.text}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )}

        {v.summary && <p className="whitespace-pre-line text-sm leading-relaxed">{v.summary}</p>}

        {v.followUpOn && (
          <p className="inline-flex w-fit items-center gap-1.5 rounded-full bg-surface2 px-3 py-1 text-xs font-bold text-fg">
            <Calendar aria-hidden className="size-3.5 text-primary" />
            {t("visit.followUpBadge", { date: formatDate(v.followUpOn, locale) })}
          </p>
        )}
      </Card>
    );
  }

  return (
    <div>
      <HealthTabs />
      <PageTitle
        action={
          <Button
            variant="primary"
            className="print:hidden"
            onClick={() => {
              setEditing(undefined);
              setSheetOpen(true);
            }}
          >
            <Plus aria-hidden className="size-5" />
            {t("visit.add")}
          </Button>
        }
      >
        {t("visit.title")}
      </PageTitle>

      {visits && visits.length === 0 && (
        <Card>
          <EmptyState art={<MoonIllustration />} text={t("visit.empty")}>
            <Button
              variant="primary"
              className="mt-2"
              onClick={() => {
                setEditing(undefined);
                setSheetOpen(true);
              }}
            >
              {t("visit.add")}
            </Button>
          </EmptyState>
        </Card>
      )}

      {visits && visits.length > 0 && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
          <div className="flex flex-col gap-5">
            {upcoming.length > 0 && (
              <section aria-label={t("visit.upcoming")} className="flex flex-col gap-3">
                <SectionTitle>{t("visit.upcoming")}</SectionTitle>
                {upcoming.map((v, i) => renderVisitCard(v, i === 0))}
              </section>
            )}

            {past.length > 0 && (
              <section aria-label={t("visit.past")} className="flex flex-col gap-3">
                <SectionTitle>{t("visit.past")}</SectionTitle>
                {past.map((v) => renderVisitCard(v))}
              </section>
            )}
          </div>

          <div className="flex flex-col gap-4 print:hidden">
            <Card className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={() => window.print()}>
                  <Printer aria-hidden className="size-4" />
                  {t("visit.print")}
                </Button>
                <Button onClick={exportCsv}>
                  <Download aria-hidden className="size-4" />
                  {t("backup.csvVisits")}
                </Button>
              </div>
              <p className="text-xs leading-relaxed text-muted">{t("visit.disclaimer")}</p>
            </Card>
          </div>
        </div>
      )}

      <VisitSheet
        open={sheetOpen}
        editing={editing}
        defaultProvider={defaultProvider}
        onClose={() => setSheetOpen(false)}
      />
    </div>
  );
}
