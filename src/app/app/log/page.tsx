"use client";

import { Droplet, Droplets, Heart, Milk, Moon, Pencil, Pill, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useApp } from "@/components/app-context";
import { Button, Card, PageTitle, useToast } from "@/components/ui";
import { EmptyState, MoonIllustration } from "@/components/illustrations";
import { useHasOlderLogs } from "@/db/hooks";
import { restore, softDelete } from "@/db/repo";
import type { Diaper, Feeding, Medication, Sleep } from "@/db/types";
import { rescheduleFeedingReminder } from "@/features/reminders/actions";
import { DailyTotalsChart } from "@/features/feeding/daily-chart";
import { StatTiles } from "@/features/feeding/stat-tiles";
import { useRecent } from "@/features/feeding/use-recent";
import { formatDose } from "@/features/medications/logic";
import { MedicationSheet } from "@/features/medications/medication-sheet";
import { formatDurationShort } from "@/features/timers/timer-store";
import { useLocale, useT, type MessageKey } from "@/i18n";
import { dayKey, formatClock, formatDayHeading } from "@/lib/time";
import { formatVolume } from "@/lib/units";

type Entry =
  | { kind: "feed"; at: number; tz: string; row: Feeding }
  | { kind: "diaper"; at: number; tz: string; row: Diaper }
  | { kind: "sleep"; at: number; tz: string; row: Sleep }
  | { kind: "med"; at: number; tz: string; row: Medication };

export default function LogPage() {
  const { baby, settings, openQuickLog } = useApp();
  const t = useT();
  const locale = useLocale();
  const toast = useToast();
  const [days, setDays] = useState(14);
  const [editingMed, setEditingMed] = useState<Medication | undefined>();
  const { feedings, diapers, sleeps, medications, summary, now, since } = useRecent(days);
  const hasOlder = useHasOlderLogs(baby.id, since);

  const groups = useMemo(() => {
    if (!feedings || !diapers || !sleeps || !medications) return undefined;
    const entries: Entry[] = [
      ...feedings.map((row) => ({ kind: "feed" as const, at: row.at, tz: row.tz, row })),
      ...diapers.map((row) => ({ kind: "diaper" as const, at: row.at, tz: row.tz, row })),
      ...sleeps.map((row) => ({ kind: "sleep" as const, at: row.startedAt, tz: row.tz, row })),
      ...medications.map((row) => ({ kind: "med" as const, at: row.at, tz: row.tz, row })),
    ].sort((a, b) => b.at - a.at);
    const map = new Map<string, Entry[]>();
    for (const e of entries) {
      const key = dayKey(e.at, e.tz, settings.dayStartHour);
      map.set(key, [...(map.get(key) ?? []), e]);
    }
    return [...map.entries()];
  }, [feedings, diapers, sleeps, medications, settings.dayStartHour]);

  async function remove(e: Entry) {
    const table =
      e.kind === "feed" ? "feedings" : e.kind === "diaper" ? "diapers" : e.kind === "sleep" ? "sleeps" : "medications";
    await softDelete(table, [e.row.id]);
    if (e.kind === "feed" && e.row.kind !== "pump") await rescheduleFeedingReminder(baby.id);
    toast.show({
      message: t("common.deleted"),
      actionLabel: t("common.undo"),
      onAction: async () => {
        await restore(table, [e.row.id]);
        if (e.kind === "feed" && e.row.kind !== "pump") await rescheduleFeedingReminder(baby.id);
      },
    });
  }

  function feedingTitle(f: Feeding) {
    if (f.kind === "breast") {
      const side = f.side ? ` (${t(`timer.sideShort.${f.side}` as MessageKey)})` : "";
      const dur = f.durationSec ? ` · ${formatDurationShort(f.durationSec)}` : "";
      return `${t("timer.breastLabel")}${side}${dur}`;
    }
    if (f.kind === "pump") {
      const side = f.side ? ` (${t(`timer.sideShort.${f.side}` as MessageKey)})` : "";
      const parts = [
        f.amountMl !== undefined ? formatVolume(f.amountMl, f.enteredUnit ?? settings.volumeUnit) : "",
        f.durationSec ? formatDurationShort(f.durationSec) : "",
      ].filter(Boolean);
      return `${t("timer.pumpLabel")}${side}${parts.length ? ` · ${parts.join(" · ")}` : ""}`;
    }
    return f.amountMl !== undefined ? formatVolume(f.amountMl, f.enteredUnit ?? settings.volumeUnit) : t("log.feeding");
  }

  const recent = summary?.slice(-8);

  return (
    <div>
      <PageTitle>{t("nav.log")}</PageTitle>
      {recent && feedings && sleeps && (
        <div className="mb-4 grid gap-4 lg:grid-cols-2">
          <StatTiles days={recent} feedings={feedings.filter((f) => f.at >= now - 7 * 86_400_000)} sleeps={sleeps} now={now} />
          <DailyTotalsChart days={recent.slice(-7)} />
        </div>
      )}

      {groups && groups.length === 0 && (
        <Card>
          <EmptyState art={<MoonIllustration />} text={t("log.empty")}>
            <Button variant="primary" className="mt-2" onClick={() => openQuickLog({ tab: "feed" })}>
              {t("quick.logFeeding")}
            </Button>
          </EmptyState>
        </Card>
      )}

      <div className="flex flex-col gap-5">
        {groups?.map(([key, entries]) => {
          const ml = entries.reduce((a, e) => a + (e.kind === "feed" && e.row.kind !== "pump" ? (e.row.amountMl ?? 0) : 0), 0);
          const count = entries.filter((e) => e.kind === "feed" && e.row.kind !== "pump").length;
          return (
            <section key={key} aria-labelledby={`day-${key}`}>
              <div className="mb-2 flex items-baseline justify-between">
                <h2 id={`day-${key}`} className="text-sm font-semibold uppercase tracking-wide text-muted">
                  {formatDayHeading(key, locale, now)}
                </h2>
                <p className="text-sm text-muted">
                  {count} {t("stats.feedings").toLowerCase()}
                  {ml > 0 ? ` · ${formatVolume(ml, settings.volumeUnit)}` : ""}
                </p>
              </div>
              <ul className="overflow-hidden rounded-[1.75rem] border border-line bg-surface shadow-soft">
                {entries.map((e) => {
                  const iconStyle =
                    e.kind === "sleep"
                      ? "bg-sleep-tint text-sleep-ink"
                      : e.kind === "diaper"
                        ? "bg-diaper-tint text-diaper-ink"
                        : e.kind === "med" || e.row.kind === "pump"
                          ? "bg-remind-tint text-remind-ink"
                          : "bg-feed-tint text-feed-ink";
                  return (
                    <li key={e.row.id} className="flex items-center gap-3 border-b border-line p-3 last:border-b-0">
                      <span className={`grid size-11 shrink-0 place-items-center rounded-full ${iconStyle}`}>
                        {e.kind === "sleep" && <Moon aria-hidden className="size-5" />}
                        {e.kind === "diaper" && <Droplets aria-hidden className="size-5" />}
                        {e.kind === "med" && <Pill aria-hidden className="size-5" />}
                        {e.kind === "feed" && e.row.kind === "breast" && <Heart aria-hidden className="size-5" />}
                        {e.kind === "feed" && e.row.kind === "pump" && <Droplet aria-hidden className="size-5" />}
                        {e.kind === "feed" && e.row.kind !== "breast" && e.row.kind !== "pump" && <Milk aria-hidden className="size-5" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">
                          {e.kind === "feed"
                            ? feedingTitle(e.row)
                            : e.kind === "diaper"
                              ? t(`diaper.${e.row.type}` as MessageKey)
                              : e.kind === "med"
                                ? `${e.row.name} · ${formatDose(e.row.dose, e.row.unit)}`
                                : e.row.endedAt
                                  ? `${t("timer.sleepLabel")} · ${formatDurationShort((e.row.endedAt - e.row.startedAt) / 1000)}`
                                  : t("timer.activeSleep")}
                          <span className="ml-2 font-normal text-muted">
                            {e.kind === "sleep" && e.row.endedAt
                              ? `${formatClock(e.row.startedAt, locale)} – ${formatClock(e.row.endedAt, locale)}`
                              : formatClock(e.at, locale)}
                          </span>
                        </p>
                        {(e.row.note || (e.kind === "feed" && e.row.kind === "bottle" && e.row.milk)) && (
                          <p className="truncate text-sm text-muted">
                            {e.kind === "feed" && e.row.kind === "bottle" && e.row.milk
                              ? `${t(`quick.${e.row.milk}` as MessageKey)}${e.row.note ? " · " : ""}`
                              : ""}
                            {e.row.note}
                          </p>
                        )}
                      </div>
                      {(e.kind === "feed" || e.kind === "sleep" || e.kind === "med") && (
                        <button
                          type="button"
                          aria-label={t("common.edit")}
                          className="grid size-12 place-items-center rounded-full hover:bg-surface2"
                          onClick={() =>
                            e.kind === "feed"
                              ? openQuickLog({ editFeedingId: e.row.id })
                              : e.kind === "sleep"
                                ? openQuickLog({ editSleepId: e.row.id })
                                : setEditingMed(e.row)
                          }
                        >
                          <Pencil aria-hidden className="size-5" />
                        </button>
                      )}
                      <button
                        type="button"
                        aria-label={t("common.delete")}
                        className="grid size-12 place-items-center rounded-full hover:bg-surface2"
                        onClick={() => remove(e)}
                      >
                        <Trash2 aria-hidden className="size-5" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      {hasOlder && (
        <Button className="mt-5 w-full" onClick={() => setDays((d) => d + 14)}>
          {t("log.loadMore")}
        </Button>
      )}
      <MedicationSheet open={Boolean(editingMed)} editing={editingMed} onClose={() => setEditingMed(undefined)} />
    </div>
  );
}
