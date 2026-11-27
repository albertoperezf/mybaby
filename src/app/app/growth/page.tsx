"use client";

import { FileText, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/components/app-context";
import { Button, Card, PageTitle, Segmented, Switch, useToast } from "@/components/ui";
import { EmptyState, SproutIllustration } from "@/components/illustrations";
import { HealthTabs } from "@/components/health-tabs";
import { useMeasurements } from "@/db/hooks";
import { restore, softDelete } from "@/db/repo";
import type { Measurement, Sex } from "@/db/types";
import { GrowthChart } from "@/features/growth/growth-chart";
import { MeasurementSheet } from "@/features/growth/measurement-sheet";
import { useLocale, useT } from "@/i18n";
import { formatAge } from "@/lib/age";
import { toDateInput, formatDate } from "@/lib/time";
import { formatLength, formatWeight } from "@/lib/units";
import {
  DAYS_PER_MONTH,
  ageInDays,
  isPreterm,
  loadWho,
  ordinal,
  percentileOf,
  type Indicator,
  type WhoData,
} from "@/lib/who";

const RANGES = [6, 12, 24, 60] as const;

function valueFor(m: Measurement, indicator: Indicator): number | undefined {
  return indicator === "weight" ? m.weightG : indicator === "length" ? m.lengthMm : m.headMm;
}

export default function GrowthPage() {
  const { baby, settings } = useApp();
  const t = useT();
  const locale = useLocale();
  const toast = useToast();
  const measurements = useMeasurements(baby.id);
  const imperial = settings.measureUnit === "imperial";

  const [who, setWho] = useState<WhoData | null>(null);
  const [indicator, setIndicator] = useState<Indicator>("weight");
  const [sexPick, setSexPick] = useState<Sex>("male");
  const sex: Sex = baby.sex ?? sexPick;
  const [corrected, setCorrected] = useState(true);
  const [sheet, setSheet] = useState<{ open: boolean; editing?: Measurement }>({ open: false });

  const preterm = isPreterm(baby.gestationalWeeks);
  const [range, setRange] = useState<(typeof RANGES)[number]>(() => {
    const ageMonths = ageInDays(baby.birthDate, toDateInput(Date.now())) / DAYS_PER_MONTH;
    return RANGES.find((r) => ageMonths + 1 <= r) ?? 60;
  });

  useEffect(() => {
    let alive = true;
    loadWho().then((d) => alive && setWho(d));
    return () => {
      alive = false;
    };
  }, []);

  const points = useMemo(
    () =>
      (measurements ?? [])
        .map((m) => ({ days: ageInDays(baby.birthDate, m.measuredOn, baby.gestationalWeeks, corrected), value: valueFor(m, indicator) }))
        .filter((p): p is { days: number; value: number } => p.value !== undefined),
    [measurements, baby.birthDate, baby.gestationalWeeks, corrected, indicator],
  );

  const indicatorLabel = (i: Indicator) => t(`growth.${i}` as "growth.weight");
  const list = [...(measurements ?? [])].reverse();

  async function remove(m: Measurement) {
    await softDelete("measurements", [m.id]);
    toast.show({ message: t("common.deleted"), actionLabel: t("common.undo"), onAction: () => restore("measurements", [m.id]) });
  }

  function summary(m: Measurement) {
    const age = ageInDays(baby.birthDate, m.measuredOn, baby.gestationalWeeks, corrected);
    const parts: { key: Indicator; text: string; pct?: string }[] = [];
    (["weight", "length", "head"] as Indicator[]).forEach((i) => {
      const v = valueFor(m, i);
      if (v === undefined) return;
      const res = who ? percentileOf(who, i, sex, age, v) : null;
      parts.push({
        key: i,
        text: i === "weight" ? formatWeight(v, settings.measureUnit) : formatLength(v, settings.measureUnit),
        pct: res ? ordinal(res.percentile, locale) : undefined,
      });
    });
    return { age, parts };
  }

  return (
    <div>
      <HealthTabs />
      <PageTitle
        action={
          <div className="flex items-center gap-2">
            <Link
              href="/app/report"
              aria-label={t("report.open")}
              className="inline-flex min-h-12 items-center gap-2 rounded-2xl border border-line bg-surface2 px-4 text-sm font-semibold text-fg transition active:scale-[0.97]"
            >
              <FileText aria-hidden className="size-4" />
              <span className="hidden sm:inline">{t("report.open")}</span>
            </Link>
            <Button variant="primary" onClick={() => setSheet({ open: true })}>
              <Plus aria-hidden className="size-5" />
              {t("growth.add")}
            </Button>
          </div>
        }
      >
        {t("nav.growth")}
      </PageTitle>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card className="flex flex-col gap-4">
          <Segmented
            label={t("growth.measure")}
            value={indicator}
            onChange={setIndicator}
            options={(["weight", "length", "head"] as Indicator[]).map((i) => ({ value: i, label: indicatorLabel(i) }))}
          />
          {who ? (
            <GrowthChart who={who} sex={sex} indicator={indicator} imperial={imperial} points={points} maxMonths={range} locale={locale} />
          ) : (
            <div className="grid aspect-[640/380] place-items-center text-muted">{t("common.loading")}</div>
          )}
          <Segmented
            label={t("growth.range")}
            value={range}
            onChange={setRange}
            options={RANGES.map((r) => ({ value: r, label: r < 12 ? t("growth.rangeM", { n: r }) : t("growth.rangeY", { n: r / 12 }) }))}
          />
          {!baby.sex && (
            <Segmented
              label={t("growth.curvesFor")}
              value={sex}
              onChange={setSexPick}
              options={[
                { value: "female", label: t("sex.girl") },
                { value: "male", label: t("sex.boy") },
              ]}
            />
          )}
          {preterm && (
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-surface2 p-3">
              <span className="text-sm">{t("growth.corrected", { weeks: baby.gestationalWeeks as number })}</span>
              <Switch checked={corrected} onChange={setCorrected} label={t("growth.correctedLabel")} />
            </div>
          )}
          <p className="text-xs text-muted">{t("growth.disclaimer")}</p>
        </Card>

        <section aria-label={t("growth.history")} className="flex flex-col gap-3">
          {measurements && list.length === 0 && (
            <Card>
              <EmptyState art={<SproutIllustration />} text={t("growth.empty")} />
            </Card>
          )}
          {list.map((m) => {
            const s = summary(m);
            return (
              <Card key={m.id} className="flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{formatDate(m.measuredOn, locale)}</p>
                    <p className="text-sm text-muted">
                      {formatAge(s.age, t)} · {m.source === "doctor" ? t("growth.doctor") : t("growth.home")}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      aria-label={t("common.edit")}
                      className="grid size-12 place-items-center rounded-full hover:bg-surface2"
                      onClick={() => setSheet({ open: true, editing: m })}
                    >
                      <Pencil aria-hidden className="size-5" />
                    </button>
                    <button
                      type="button"
                      aria-label={t("common.delete")}
                      className="grid size-12 place-items-center rounded-full hover:bg-surface2"
                      onClick={() => remove(m)}
                    >
                      <Trash2 aria-hidden className="size-5" />
                    </button>
                  </div>
                </div>
                <ul className="grid grid-cols-3 gap-2 text-sm">
                  {s.parts.map((p) => (
                    <li key={p.key} className="rounded-2xl bg-growth-tint p-2.5 text-growth-ink">
                      <span className="block text-xs font-semibold opacity-85">{indicatorLabel(p.key)}</span>
                      <span className="block font-extrabold tabular-nums">{p.text}</span>
                      {p.pct && <span className="block text-xs font-semibold opacity-85">{p.pct} {t("growth.percentile")}</span>}
                    </li>
                  ))}
                </ul>
                {m.note && <p className="text-sm">{m.note}</p>}
              </Card>
            );
          })}
        </section>
      </div>

      <MeasurementSheet open={sheet.open} editing={sheet.editing} onClose={() => setSheet({ open: false })} />
    </div>
  );
}
