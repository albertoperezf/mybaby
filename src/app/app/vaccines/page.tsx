"use client";

import { Download, Plus, Printer, Syringe } from "lucide-react";
import { useMemo, useState } from "react";
import { useApp, useNow } from "@/components/app-context";
import { HealthTabs } from "@/components/health-tabs";
import { Button, Card, PageTitle, SectionTitle, Switch, useToast } from "@/components/ui";
import { setSetting } from "@/db/settings";
import { useVaccines } from "@/db/hooks";
import type { Vaccine } from "@/db/types";
import { CustomVaccineSheet, DoseSheet } from "@/features/vaccines/dose-sheet";
import { DoseRow } from "@/features/vaccines/dose-row";
import { doseLabel } from "@/features/vaccines/labels";
import { doseStatus, groupDoses, indexByCode, summarize } from "@/features/vaccines/logic";
import { markGiven, unmarkGiven } from "@/features/vaccines/repo";
import { ScheduleChooser } from "@/features/vaccines/schedule-chooser";
import { SCHEDULES } from "@/features/vaccines/schedule-data";
import { useLocale, useT } from "@/i18n";
import { formatDate, toDateInput } from "@/lib/time";
import { isPreterm } from "@/lib/who";

function ageHeading(months: number, t: ReturnType<typeof useT>): string {
  if (months < 0) return t("vaccine.age.other");
  if (months === 0) return t("vaccine.age.birth");
  if (months < 24) return t("vaccine.age.months", { n: months });
  const y = Math.floor(months / 12);
  const m = months % 12;
  return m === 0 ? t("vaccine.age.years", { n: y }) : t("vaccine.age.yearsMonths", { y, m });
}

export default function VaccinesPage() {
  const { baby, settings } = useApp();
  const t = useT();
  const locale = useLocale();
  const toast = useToast();
  const now = useNow(60_000);
  const today = toDateInput(now);
  const doses = useVaccines(baby.id);
  const [open, setOpen] = useState<Vaccine | null>(null);
  const [adding, setAdding] = useState(false);
  const [changing, setChanging] = useState(false);

  const byCode = useMemo(() => indexByCode(doses ?? []), [doses]);
  const groups = useMemo(() => groupDoses(doses ?? [], baby.birthDate), [doses, baby.birthDate]);
  const summary = useMemo(() => summarize(doses ?? [], today), [doses, today]);
  const schedule = baby.vaccineSchedule && baby.vaccineSchedule !== "none" ? SCHEDULES[baby.vaccineSchedule] : null;

  if (!doses) return <HealthTabs />;

  if (!baby.vaccineSchedule || changing) {
    return (
      <div>
        <HealthTabs />
        <ScheduleChooser baby={baby} onDone={() => setChanging(false)} />
      </div>
    );
  }

  async function quickGive(d: Vaccine) {
    await markGiven(d.id, { givenOn: today });
    toast.show({ message: t("vaccine.savedGiven"), actionLabel: t("common.undo"), onAction: () => unmarkGiven(d.id) });
  }

  async function exportCsv() {
    const [{ buildCsv, backupFilename }, { saveFile }] = await Promise.all([import("@/features/backup/export"), import("@/features/backup/save-file")]);
    await saveFile(backupFilename("csv", "mybabylog-vaccines"), await buildCsv("vaccines"), "text/csv");
  }

  const headline =
    summary.dueNow.length > 0
      ? t("vaccine.headline.due", { n: summary.dueNow.length })
      : summary.past.length > 0
        ? t("vaccine.headline.past", { n: summary.past.length })
        : summary.expected > 0
          ? t("vaccine.headline.ok")
          : t("vaccine.headline.none");
  const pct = summary.expected > 0 ? Math.round((summary.expectedGiven / summary.expected) * 100) : 0;
  const statusOf = (d: Vaccine) => doseStatus(d, byCode, today);

  return (
    <div>
      <HealthTabs />
      <PageTitle
        action={
          <Button variant="primary" className="print:hidden" onClick={() => setAdding(true)}>
            <Plus aria-hidden className="size-5" />
            {t("vaccine.addOther")}
          </Button>
        }
      >
        {t("nav.vaccines")}
      </PageTitle>

      <p className="mb-3 hidden text-lg font-bold print:block">
        {baby.name} · {formatDate(baby.birthDate, locale)}
      </p>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="flex flex-col gap-5 lg:order-1">
          {groups.length === 0 && (
            <Card className="flex flex-col items-center gap-3 py-8 text-center">
              <Syringe aria-hidden className="size-10 text-diaper" />
              <p className="max-w-xs text-muted">{t("vaccine.empty")}</p>
              <Button variant="primary" onClick={() => setChanging(true)}>
                {t("vaccine.chooseSchedule")}
              </Button>
            </Card>
          )}
          {groups.map((g) => (
            <section key={g.ageMonths} aria-label={ageHeading(g.ageMonths, t)}>
              <SectionTitle>{ageHeading(g.ageMonths, t)}</SectionTitle>
              <ul className="overflow-hidden rounded-[1.75rem] border border-line bg-surface shadow-soft">
                {g.doses.map((d) => (
                  <DoseRow key={d.id} dose={d} status={statusOf(d)} byCode={byCode} onOpen={() => setOpen(d)} onQuickGive={() => quickGive(d)} />
                ))}
              </ul>
            </section>
          ))}
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:order-2 print:order-first">
          <Card className="flex flex-col gap-3 !bg-diaper-tint !text-diaper-ink">
            <p className="text-sm font-bold uppercase tracking-wide opacity-85">{t("vaccine.summary")}</p>
            <p className="text-2xl font-extrabold leading-tight">{headline}</p>
            {summary.expected > 0 && (
              <>
                <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={t("vaccine.progress")} className="h-3 overflow-hidden rounded-full bg-surface/70">
                  <div className="h-full rounded-full bg-diaper transition-all" style={{ width: `${pct}%` }} />
                </div>
                <p className="text-sm font-semibold">{t("vaccine.progressText", { given: summary.expectedGiven, expected: summary.expected })}</p>
              </>
            )}
            {summary.next && (
              <p className="text-sm font-semibold">
                {t("vaccine.next", {
                  name: doseLabel(summary.next, locale),
                  date: formatDate(summary.next.windowFrom ?? summary.next.dueOn ?? today, locale),
                })}
              </p>
            )}
            {isPreterm(baby.gestationalWeeks) && <p className="text-xs font-semibold">{t("vaccine.preterm")}</p>}
          </Card>

          <Card className="flex flex-col gap-3 print:hidden">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-bold">{t("vaccine.remindersTitle")}</p>
                <p className="text-sm text-muted">{t("vaccine.remindersBody")}</p>
              </div>
              <Switch checked={settings.vaccineReminders} onChange={(v) => setSetting("vaccineReminders", v)} label={t("vaccine.remindersTitle")} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => window.print()}>
                <Printer aria-hidden className="size-5" />
                {t("vaccine.print")}
              </Button>
              <Button onClick={exportCsv}>
                <Download aria-hidden className="size-5" />
                CSV
              </Button>
            </div>
            <Button variant="ghost" onClick={() => setChanging(true)}>
              {t("vaccine.changeSchedule")}
            </Button>
          </Card>

          <Card className="flex flex-col gap-2 text-sm">
            {schedule && (
              <p>
                <span className="font-bold">{schedule.name[locale]}.</span> {schedule.source[locale]}.{" "}
                <a href={schedule.url} target="_blank" rel="noopener noreferrer" className="font-semibold underline">
                  {t("vaccine.viewSource")}
                </a>
              </p>
            )}
            {schedule?.notes.map((n) => (
              <p key={n.en} className="text-muted">
                {n[locale]}
              </p>
            ))}
            <p className="text-muted">{t("vaccine.disclaimer")}</p>
          </Card>
        </aside>
      </div>

      <DoseSheet dose={open} status={open ? statusOf(open) : "upcoming"} byCode={byCode} onClose={() => setOpen(null)} />
      <CustomVaccineSheet open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}
