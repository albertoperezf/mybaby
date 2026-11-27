"use client";

import { Download, Pencil, Pill, Plus, Printer, RotateCw, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useApp, useNow } from "@/components/app-context";
import { HealthTabs } from "@/components/health-tabs";
import { EmptyState, MoonIllustration } from "@/components/illustrations";
import { Button, Card, PageTitle, SectionTitle, useToast } from "@/components/ui";
import { useMedications } from "@/db/hooks";
import { addMedication, restore, softDelete } from "@/db/repo";
import type { Medication } from "@/db/types";
import { backupFilename, buildCsv } from "@/features/backup/export";
import { saveFile } from "@/features/backup/save-file";
import { MedicationSheet } from "@/features/medications/medication-sheet";
import { formatDose, groupMedicationsByDay, recentMedicines, type RecentMedicine } from "@/features/medications/logic";
import { useLocale, useT, type MessageKey } from "@/i18n";
import { trackFeature } from "@/lib/telemetry";
import { deviceTz, formatClock, formatDayHeading, formatElapsed, startOfLogicalDay } from "@/lib/time";

export default function MedicationsPage() {
  const { baby, settings } = useApp();
  const t = useT();
  const locale = useLocale();
  const toast = useToast();
  const now = useNow(30_000);
  const meds = useMedications(baby.id);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Medication | undefined>();

  const dayStart = startOfLogicalDay(now, deviceTz(), settings.dayStartHour);

  const recent = useMemo(() => (meds ? recentMedicines(meds, dayStart) : []), [meds, dayStart]);
  const groups = useMemo(() => (meds ? groupMedicationsByDay(meds, settings.dayStartHour) : undefined), [meds, settings.dayStartHour]);

  function unitLabel(unit: string) {
    const key = `med.unit.${unit}` as MessageKey;
    return ["ml", "drops", "IU", "mg", "tsp", "puffs"].includes(unit) ? t(key) : unit;
  }

  async function giveAgain(item: RecentMedicine) {
    const row = await addMedication(baby.id, { name: item.name, dose: item.dose, unit: item.unit });
    trackFeature("medication_logged");
    toast.show({
      message: `${item.name} · ${formatDose(item.dose, unitLabel(item.unit))}`,
      actionLabel: t("common.undo"),
      onAction: () => softDelete("medications", [row.id]),
    });
  }

  async function remove(m: Medication) {
    await softDelete("medications", [m.id]);
    toast.show({
      message: t("common.deleted"),
      actionLabel: t("common.undo"),
      onAction: () => restore("medications", [m.id]),
    });
  }

  async function exportCsv() {
    await saveFile(backupFilename("csv", "mybabylog-medications"), await buildCsv("medications"), "text/csv");
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
            {t("med.add")}
          </Button>
        }
      >
        {t("med.title")}
      </PageTitle>

      {groups && groups.length === 0 && (
        <Card>
          <EmptyState art={<MoonIllustration />} text={t("med.empty")}>
            <Button
              variant="primary"
              className="mt-2"
              onClick={() => {
                setEditing(undefined);
                setSheetOpen(true);
              }}
            >
              {t("med.add")}
            </Button>
          </EmptyState>
        </Card>
      )}

      {groups && groups.length > 0 && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
          <div className="flex flex-col gap-5">
            {recent.length > 0 && (
              <section aria-label={t("med.recent")} className="print:hidden">
                <SectionTitle>{t("med.recent")}</SectionTitle>
                <div className="grid gap-3 sm:grid-cols-2">
                  {recent.map((item) => {
                    const doseText = formatDose(item.dose, unitLabel(item.unit));
                    return (
                      <Card key={item.key} className="flex items-center justify-between gap-3 !p-4">
                        <div className="min-w-0">
                          <p className="truncate font-extrabold">{item.name}</p>
                          <p className="text-sm font-semibold text-remind-ink">{doseText}</p>
                          <p className="text-xs text-muted">
                            {t("med.lastAgo", { x: formatElapsed(now - item.lastAt) })}
                            {item.countToday > 0 ? ` · ${t("med.todayCount", { n: item.countToday })}` : ""}
                          </p>
                        </div>
                        <Button
                          variant="secondary"
                          className="shrink-0 !rounded-full !border-remind/30 !bg-remind-tint !px-3.5 !text-sm !font-bold !text-remind-ink"
                          aria-label={t("med.giveAgainAria", { name: item.name, dose: doseText })}
                          onClick={() => giveAgain(item)}
                        >
                          <RotateCw aria-hidden className="size-4 text-remind" />
                          {t("med.giveAgain")}
                        </Button>
                      </Card>
                    );
                  })}
                </div>
              </section>
            )}

            <section aria-label={t("med.history")} className="flex flex-col gap-5">
              {groups.map(([key, rows]) => (
                <div key={key}>
                  <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
                    {formatDayHeading(key, locale, now)}
                  </h2>
                  <ul className="overflow-hidden rounded-[1.75rem] border border-line bg-surface shadow-soft">
                    {rows.map((m) => (
                      <li key={m.id} className="flex items-center gap-3 border-b border-line p-3 last:border-b-0">
                        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-remind-tint text-remind-ink">
                          <Pill aria-hidden className="size-5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold">
                            {m.name} · {formatDose(m.dose, unitLabel(m.unit))}
                            <span className="ml-2 font-normal text-muted">{formatClock(m.at, locale)}</span>
                          </p>
                          {m.note && <p className="truncate text-sm text-muted">{m.note}</p>}
                        </div>
                        <button
                          type="button"
                          aria-label={t("common.edit")}
                          className="grid size-12 place-items-center rounded-full hover:bg-surface2 print:hidden"
                          onClick={() => {
                            setEditing(m);
                            setSheetOpen(true);
                          }}
                        >
                          <Pencil aria-hidden className="size-5" />
                        </button>
                        <button
                          type="button"
                          aria-label={t("common.delete")}
                          className="grid size-12 place-items-center rounded-full hover:bg-surface2 print:hidden"
                          onClick={() => remove(m)}
                        >
                          <Trash2 aria-hidden className="size-5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          </div>

          <div className="flex flex-col gap-4 print:hidden">
            <Card className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={() => window.print()}>
                  <Printer aria-hidden className="size-4" />
                  {t("med.print")}
                </Button>
                <Button onClick={exportCsv}>
                  <Download aria-hidden className="size-4" />
                  {t("backup.csvMeds")}
                </Button>
              </div>
              <p className="text-xs leading-relaxed text-muted">{t("med.disclaimer")}</p>
            </Card>
          </div>
        </div>
      )}

      <MedicationSheet open={sheetOpen} editing={editing} onClose={() => setSheetOpen(false)} />
    </div>
  );
}
