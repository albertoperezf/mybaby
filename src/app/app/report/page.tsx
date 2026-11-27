"use client";

import { ArrowLeft, Printer } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useApp, useNow } from "@/components/app-context";
import { Button, Card, PageTitle, Segmented } from "@/components/ui";
import {
  useDiapers,
  useFeedings,
  useMeasurements,
  useMedications,
  useSleeps,
  useVaccines,
  useVisits,
} from "@/db/hooks";
import { formatDose, translateMedUnit } from "@/features/medications/logic";
import { buildDailyReport } from "@/features/report/summary";
import { formatDurationShort } from "@/features/timers/timer-store";
import { doseLabel } from "@/features/vaccines/labels";
import { doseStatus, indexByCode, summarize } from "@/features/vaccines/logic";
import { splitVisits } from "@/features/visits/logic";
import { useLocale, useT, type MessageKey } from "@/i18n";
import { formatAge } from "@/lib/age";
import { BRAND } from "@/lib/brand";
import { trackFeature } from "@/lib/telemetry";
import {
  MIN,
  addLogicalDays,
  deviceTz,
  formatDate,
  formatDayTime,
  formatElapsed,
  startOfLogicalDay,
  toDateInput,
} from "@/lib/time";
import { formatLength, formatVolume, formatWeight } from "@/lib/units";
import { ageInDays, isPreterm, loadWho, ordinal, percentileOf, type WhoData } from "@/lib/who";

type SectionKey = "daily" | "growth" | "vaccines" | "meds" | "visits";

const SECTION_KEYS: SectionKey[] = ["daily", "growth", "vaccines", "meds", "visits"];

export default function ReportPage() {
  const { baby, settings } = useApp();
  const t = useT();
  const locale = useLocale();
  const now = useNow(60_000);
  const tz = deviceTz();

  const [days, setDays] = useState<7 | 14 | 30>(14);
  const [sections, setSections] = useState<Record<SectionKey, boolean>>({
    daily: true,
    growth: true,
    vaccines: true,
    meds: true,
    visits: true,
  });
  const [who, setWho] = useState<WhoData | null>(null);

  useEffect(() => {
    let alive = true;
    loadWho().then((d) => alive && setWho(d));
    return () => {
      alive = false;
    };
  }, []);

  const since = addLogicalDays(startOfLogicalDay(now, tz, settings.dayStartHour), tz, -(days - 1));
  const todayIso = toDateInput(now);

  const feedings = useFeedings(baby.id, since);
  const diapers = useDiapers(baby.id, since);
  const sleeps = useSleeps(baby.id, since);
  const measurements = useMeasurements(baby.id);
  const vaccines = useVaccines(baby.id);
  const medications = useMedications(baby.id, since);
  const visits = useVisits(baby.id);

  const daily = useMemo(
    () =>
      feedings && diapers && sleeps
        ? buildDailyReport(feedings, diapers, sleeps, { days, tz, dayStartHour: settings.dayStartHour, now })
        : null,
    [feedings, diapers, sleeps, days, tz, settings.dayStartHour, now],
  );

  const activeRows = useMemo(
    () => (daily ? daily.rows.filter((r) => r.feedings > 0 || r.diapers > 0 || r.sleepSec > 0 || r.pumpCount > 0) : []),
    [daily],
  );

  const vaccineData = useMemo(() => {
    const list = vaccines ?? [];
    const byCode = indexByCode(list);
    const summary = summarize(list, todayIso);
    const given = list
      .filter((d) => d.givenOn)
      .sort((a, b) => (b.givenOn ?? "").localeCompare(a.givenOn ?? ""));
    const upcoming = list
      .filter((d) => !d.givenOn && !d.skippedOn)
      .map((d) => ({ dose: d, status: doseStatus(d, byCode, todayIso) }))
      .filter(({ status }) => status === "past" || status === "due" || status === "upcoming")
      .sort((a, b) => (a.dose.dueOn ?? "9999").localeCompare(b.dose.dueOn ?? "9999"))
      .slice(0, 12);
    return { summary, given, upcoming };
  }, [vaccines, todayIso]);

  const { upcoming: upcomingVisits, past: pastVisits } = useMemo(
    () => splitVisits(visits ?? [], todayIso),
    [visits, todayIso],
  );

  const preterm = isPreterm(baby.gestationalWeeks);
  const actualAgeDays = ageInDays(baby.birthDate, todayIso);
  const correctedAgeDays = preterm ? ageInDays(baby.birthDate, todayIso, baby.gestationalWeeks, true) : null;

  function toggleSection(key: SectionKey) {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function handlePrint() {
    trackFeature("report_printed");
    window.print();
  }

  function pctLabel(indicator: "weight" | "length" | "head", measuredOn: string, value?: number): string {
    if (!value || !who || !baby.sex) return "";
    const d = ageInDays(baby.birthDate, measuredOn, baby.gestationalWeeks, preterm);
    const res = percentileOf(who, indicator, baby.sex, d, value);
    return res ? ` (${ordinal(res.percentile, locale)})` : "";
  }

  const dec = (n: number | null) => (n === null ? "-" : String(Math.round(n * 10) / 10));

  return (
    <div className="flex flex-col gap-5">
      {/* Screen-only controls */}
      <div className="flex flex-col gap-4 print:hidden">
        <Link href="/app/visits" className="inline-flex w-fit items-center gap-1.5 text-sm font-bold text-primary hover:underline">
          <ArrowLeft aria-hidden className="size-4" />
          {t("report.back")}
        </Link>

        <PageTitle
          action={
            <Button variant="primary" onClick={handlePrint}>
              <Printer aria-hidden className="size-5" />
              {t("report.print")}
            </Button>
          }
        >
          {t("report.title")}
        </PageTitle>

        <Card className="flex flex-col gap-4">
          <Segmented
            label={t("report.range")}
            value={days}
            onChange={(v) => setDays(v as 7 | 14 | 30)}
            options={[
              { value: 7, label: t("report.days", { n: 7 }) },
              { value: 14, label: t("report.days", { n: 14 }) },
              { value: 30, label: t("report.days", { n: 30 }) },
            ]}
          />

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-semibold text-muted">{t("report.sections")}</legend>
            <div className="flex flex-wrap gap-2">
              {SECTION_KEYS.map((key) => (
                <label
                  key={key}
                  className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full border border-line bg-surface2 px-3.5 py-1.5 text-sm font-semibold"
                >
                  <input
                    type="checkbox"
                    checked={sections[key]}
                    onChange={() => toggleSection(key)}
                    className="size-4 accent-[var(--primary)]"
                  />
                  <span>{t(`report.sec.${key}` as MessageKey)}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <p className="text-xs text-muted">{t("report.printHint")}</p>
        </Card>
      </div>

      {/* Printable clinical summary */}
      <article className="flex flex-col gap-6 rounded-[1.75rem] border border-line bg-surface p-5 shadow-soft sm:p-8 print:rounded-none print:border-0 print:p-0 print:shadow-none">
        {/* Header & baby details */}
        <header className="flex flex-col gap-3 border-b border-line pb-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-wider text-muted">{BRAND.name}</p>
              <h2 className="text-2xl font-extrabold tracking-tight">{baby.name}</h2>
            </div>
            <p className="text-sm text-muted">
              {t("report.generated", { date: formatDate(todayIso, locale), n: days })}
            </p>
          </div>

          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{t("report.dob")}</dt>
              <dd className="font-bold">{formatDate(baby.birthDate, locale)}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{t("report.age")}</dt>
              <dd className="font-bold">{actualAgeDays >= 0 ? formatAge(actualAgeDays, t) : "-"}</dd>
            </div>
            {correctedAgeDays !== null && (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{t("report.correctedAge")}</dt>
                <dd className="font-bold">{correctedAgeDays >= 0 ? formatAge(correctedAgeDays, t) : "-"}</dd>
              </div>
            )}
            {baby.birthWeightG && (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{t("report.birthWeight")}</dt>
                <dd className="font-bold">{formatWeight(baby.birthWeightG, settings.measureUnit)}</dd>
              </div>
            )}
          </dl>
        </header>

        {/* 1. Feeding, Diaper & Sleep */}
        {sections.daily && daily && (
          <section className="print-avoid-break flex flex-col gap-3">
            <h3 className="text-lg font-extrabold">{t("report.sec.daily")}</h3>

            {activeRows.length === 0 ? (
              <p className="text-sm text-muted">{t("report.noDaily")}</p>
            ) : (
              <>
                <dl className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  <div className="rounded-2xl border border-line bg-surface2 p-3">
                    <dt className="text-xs font-semibold text-muted">{t("report.avgFeeds")}</dt>
                    <dd className="text-xl font-extrabold tabular-nums">{dec(daily.avgFeedingsPerDay)}</dd>
                    {daily.avgIntervalMin !== null && (
                      <dd className="text-xs text-muted">
                        {t("stats.avgInterval")}: {formatElapsed(daily.avgIntervalMin * MIN)}
                      </dd>
                    )}
                  </div>
                  <div className="rounded-2xl border border-line bg-surface2 p-3">
                    <dt className="text-xs font-semibold text-muted">{t("report.avgVolume")}</dt>
                    <dd className="text-xl font-extrabold tabular-nums">
                      {daily.avgBottleMlPerDay !== null ? formatVolume(daily.avgBottleMlPerDay, settings.volumeUnit) : "-"}
                    </dd>
                  </div>
                  <div className="rounded-2xl border border-line bg-surface2 p-3">
                    <dt className="text-xs font-semibold text-muted">{t("report.avgDiapers")}</dt>
                    <dd className="text-xl font-extrabold tabular-nums">{dec(daily.avgDiapersPerDay)}</dd>
                    {daily.avgWetPerDay !== null && (
                      <dd className="text-xs text-muted">{t("report.avgWet", { n: dec(daily.avgWetPerDay) })}</dd>
                    )}
                  </div>
                  <div className="rounded-2xl border border-line bg-surface2 p-3">
                    <dt className="text-xs font-semibold text-muted">{t("report.avgSleep")}</dt>
                    <dd className="text-xl font-extrabold tabular-nums">
                      {daily.avgSleepSecPerDay !== null ? formatDurationShort(daily.avgSleepSecPerDay) : "-"}
                    </dd>
                  </div>
                </dl>

                <div className="overflow-x-auto" tabIndex={0}>
                  <table className="w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
                        <th className="py-2 pr-3">{t("report.col.date")}</th>
                        <th className="py-2 pr-3">{t("report.col.feeds")}</th>
                        <th className="py-2 pr-3">{t("report.col.volume")}</th>
                        <th className="py-2 pr-3">{t("report.col.breast")}</th>
                        <th className="py-2 pr-3">{t("report.col.diapers")}</th>
                        <th className="py-2">{t("report.col.sleep")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeRows.map((r) => (
                        <tr key={r.key} className="border-b border-line/60 last:border-b-0">
                          <td className="whitespace-nowrap py-2 pr-3 font-semibold">{formatDate(r.key, locale)}</td>
                          <td className="py-2 pr-3 tabular-nums">{r.feedings || "-"}</td>
                          <td className="whitespace-nowrap py-2 pr-3 tabular-nums">
                            {r.bottleMl > 0 ? formatVolume(r.bottleMl, settings.volumeUnit) : "-"}
                          </td>
                          <td className="whitespace-nowrap py-2 pr-3 tabular-nums">
                            {r.breastCount > 0 ? `${r.breastCount} (${formatDurationShort(r.breastSec)})` : "-"}
                          </td>
                          <td className="whitespace-nowrap py-2 pr-3 tabular-nums">
                            {r.diapers > 0 ? `${r.diapers} (${r.wet + r.both}/${r.dirty + r.both})` : "-"}
                          </td>
                          <td className="whitespace-nowrap py-2 tabular-nums">
                            {r.sleepSec > 0 ? formatDurationShort(r.sleepSec) : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        )}

        {/* 2. Growth & WHO percentiles */}
        {sections.growth && (
          <section className="print-avoid-break flex flex-col gap-3 border-t border-line pt-4">
            <h3 className="text-lg font-extrabold">{t("report.sec.growth")}</h3>
            {!measurements || measurements.length === 0 ? (
              <p className="text-sm text-muted">{t("report.noGrowth")}</p>
            ) : (
              <div className="overflow-x-auto" tabIndex={0}>
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
                      <th className="py-2 pr-3">{t("report.col.date")}</th>
                      <th className="py-2 pr-3">{t("report.col.age")}</th>
                      <th className="py-2 pr-3">{t("report.col.weight")}</th>
                      <th className="py-2 pr-3">{t("report.col.length")}</th>
                      <th className="py-2 pr-3">{t("report.col.head")}</th>
                      <th className="py-2">{t("report.col.note")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...measurements].reverse().map((m) => {
                      const d = ageInDays(baby.birthDate, m.measuredOn);
                      return (
                        <tr key={m.id} className="border-b border-line/60 last:border-b-0">
                          <td className="whitespace-nowrap py-2 pr-3 font-semibold">{formatDate(m.measuredOn, locale)}</td>
                          <td className="whitespace-nowrap py-2 pr-3">{d >= 0 ? formatAge(d, t) : "-"}</td>
                          <td className="whitespace-nowrap py-2 pr-3 tabular-nums">
                            {m.weightG !== undefined
                              ? `${formatWeight(m.weightG, settings.measureUnit)}${pctLabel("weight", m.measuredOn, m.weightG)}`
                              : "-"}
                          </td>
                          <td className="whitespace-nowrap py-2 pr-3 tabular-nums">
                            {m.lengthMm !== undefined
                              ? `${formatLength(m.lengthMm, settings.measureUnit)}${pctLabel("length", m.measuredOn, m.lengthMm)}`
                              : "-"}
                          </td>
                          <td className="whitespace-nowrap py-2 pr-3 tabular-nums">
                            {m.headMm !== undefined
                              ? `${formatLength(m.headMm, settings.measureUnit)}${pctLabel("head", m.measuredOn, m.headMm)}`
                              : "-"}
                          </td>
                          <td className="py-2 text-muted">{m.note ?? ""}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* 3. Vaccines */}
        {sections.vaccines && (
          <section className="print-avoid-break flex flex-col gap-3 border-t border-line pt-4">
            <h3 className="text-lg font-extrabold">{t("report.sec.vaccines")}</h3>
            {!vaccines || vaccines.length === 0 ? (
              <p className="text-sm text-muted">{t("report.noVaccines")}</p>
            ) : (
              <div className="flex flex-col gap-4">
                <p className="text-sm text-muted">
                  {t("vaccine.progressText", {
                    given: vaccineData.summary.expectedGiven,
                    expected: vaccineData.summary.expected,
                  })}
                </p>

                {vaccineData.given.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <h4 className="text-xs font-extrabold uppercase tracking-wide text-muted">{t("report.vaccinesGiven")}</h4>
                    <div className="overflow-x-auto" tabIndex={0}>
                      <table className="w-full border-collapse text-left text-sm">
                        <thead>
                          <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
                            <th className="py-1.5 pr-3">{t("report.col.vaccine")}</th>
                            <th className="py-1.5 pr-3">{t("report.col.date")}</th>
                            <th className="py-1.5">{t("report.col.details")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {vaccineData.given.map((d) => (
                            <tr key={d.id} className="border-b border-line/60 last:border-b-0">
                              <td className="py-1.5 pr-3 font-semibold">{doseLabel(d, locale)}</td>
                              <td className="whitespace-nowrap py-1.5 pr-3">
                                {d.givenOn ? formatDate(d.givenOn, locale) : "-"}
                              </td>
                              <td className="py-1.5 text-muted">
                                {[d.lot, d.provider, d.note].filter(Boolean).join(" · ")}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {vaccineData.upcoming.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    <h4 className="text-xs font-extrabold uppercase tracking-wide text-muted">{t("report.vaccinesUpcoming")}</h4>
                    <div className="overflow-x-auto" tabIndex={0}>
                      <table className="w-full border-collapse text-left text-sm">
                        <thead>
                          <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
                            <th className="py-1.5 pr-3">{t("report.col.vaccine")}</th>
                            <th className="py-1.5 pr-3">{t("report.col.status")}</th>
                            <th className="py-1.5">{t("report.col.date")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {vaccineData.upcoming.map(({ dose, status }) => (
                            <tr key={dose.id} className="border-b border-line/60 last:border-b-0">
                              <td className="py-1.5 pr-3 font-semibold">{doseLabel(dose, locale)}</td>
                              <td className="whitespace-nowrap py-1.5 pr-3">{t(`vaccine.status.${status}` as MessageKey)}</td>
                              <td className="whitespace-nowrap py-1.5">
                                {dose.dueOn ? formatDate(dose.dueOn, locale) : "-"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* 4. Medications */}
        {sections.meds && (
          <section className="print-avoid-break flex flex-col gap-3 border-t border-line pt-4">
            <h3 className="text-lg font-extrabold">{t("report.sec.meds")}</h3>
            {!medications || medications.length === 0 ? (
              <p className="text-sm text-muted">{t("report.noMeds")}</p>
            ) : (
              <div className="overflow-x-auto" tabIndex={0}>
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
                      <th className="py-2 pr-3">{t("report.col.date")}</th>
                      <th className="py-2 pr-3">{t("report.col.medicine")}</th>
                      <th className="py-2 pr-3">{t("report.col.dose")}</th>
                      <th className="py-2">{t("report.col.note")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {medications.map((m) => (
                      <tr key={m.id} className="border-b border-line/60 last:border-b-0">
                        <td className="whitespace-nowrap py-2 pr-3">{formatDayTime(m.at, locale)}</td>
                        <td className="py-2 pr-3 font-semibold">{m.name}</td>
                        <td className="whitespace-nowrap py-2 pr-3 tabular-nums">
                          {formatDose(m.dose, translateMedUnit(m.unit, t))}
                        </td>
                        <td className="py-2 text-muted">{m.note ?? ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* 5. Doctor visits & questions */}
        {sections.visits && (
          <section className="print-avoid-break flex flex-col gap-3 border-t border-line pt-4">
            <h3 className="text-lg font-extrabold">{t("report.sec.visits")}</h3>
            {upcomingVisits.length === 0 && pastVisits.length === 0 ? (
              <p className="text-sm text-muted">{t("report.noVisits")}</p>
            ) : (
              <div className="flex flex-col gap-3">
                {[...upcomingVisits, ...pastVisits.slice(0, 6)].map((v) => (
                  <div key={v.id} className="rounded-2xl border border-line p-3.5">
                    <p className="font-bold">
                      {v.reason}
                      <span className="ml-2 font-normal text-muted">
                        {formatDate(v.visitedOn, locale)}
                        {v.provider ? ` · ${v.provider}` : ""}
                      </span>
                    </p>
                    {v.questions.length > 0 && (
                      <ul className="mt-2 flex flex-col gap-1 text-sm">
                        {v.questions.map((q) => (
                          <li key={q.id}>
                            <span className="mr-1.5 font-mono">{q.done ? "[x]" : "[ ]"}</span>
                            <span>{q.text}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {v.summary && <p className="mt-2 whitespace-pre-line text-sm text-muted">{v.summary}</p>}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        <footer className="border-t border-line pt-4 text-xs text-muted">{t("report.disclaimer")}</footer>
      </article>
    </div>
  );
}
