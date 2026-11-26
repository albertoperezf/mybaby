"use client";

import { Droplets, Milk, Pencil, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useApp } from "@/components/app-context";
import { Button, Card, PageTitle, useToast } from "@/components/ui";
import { restore, softDelete } from "@/db/repo";
import type { Diaper, Feeding } from "@/db/types";
import { rescheduleFeedingReminder } from "@/features/reminders/actions";
import { DailyTotalsChart } from "@/features/feeding/daily-chart";
import { StatTiles } from "@/features/feeding/stat-tiles";
import { useRecent } from "@/features/feeding/use-recent";
import { useLocale, useT, type MessageKey } from "@/i18n";
import { dayKey, formatClock, formatDayHeading } from "@/lib/time";
import { formatVolume } from "@/lib/units";

type Entry = { kind: "feed"; row: Feeding } | { kind: "diaper"; row: Diaper };

export default function LogPage() {
  const { baby, settings, openQuickLog } = useApp();
  const t = useT();
  const locale = useLocale();
  const toast = useToast();
  const [days, setDays] = useState(14);
  const { feedings, diapers, summary, now } = useRecent(days);

  const groups = useMemo(() => {
    if (!feedings || !diapers) return undefined;
    const entries: Entry[] = [
      ...feedings.map((row) => ({ kind: "feed" as const, row })),
      ...diapers.map((row) => ({ kind: "diaper" as const, row })),
    ].sort((a, b) => b.row.at - a.row.at);
    const map = new Map<string, Entry[]>();
    for (const e of entries) {
      const key = dayKey(e.row.at, e.row.tz, settings.dayStartHour);
      map.set(key, [...(map.get(key) ?? []), e]);
    }
    return [...map.entries()];
  }, [feedings, diapers, settings.dayStartHour]);

  async function remove(e: Entry) {
    const table = e.kind === "feed" ? "feedings" : "diapers";
    await softDelete(table, [e.row.id]);
    if (e.kind === "feed") await rescheduleFeedingReminder(baby.id);
    toast.show({
      message: t("common.deleted"),
      actionLabel: t("common.undo"),
      onAction: async () => {
        await restore(table, [e.row.id]);
        if (e.kind === "feed") await rescheduleFeedingReminder(baby.id);
      },
    });
  }

  const recent = summary?.slice(-8);

  return (
    <div>
      <PageTitle>{t("nav.log")}</PageTitle>
      {recent && feedings && (
        <div className="mb-4 grid gap-4 lg:grid-cols-2">
          <StatTiles days={recent} feedings={feedings.filter((f) => f.at >= now - 7 * 86_400_000)} />
          <DailyTotalsChart days={recent.slice(-7)} />
        </div>
      )}

      {groups && groups.length === 0 && (
        <Card className="text-center">
          <p className="text-muted">{t("log.empty")}</p>
          <Button variant="primary" className="mt-3" onClick={() => openQuickLog({ tab: "feed" })}>
            {t("quick.logFeeding")}
          </Button>
        </Card>
      )}

      <div className="flex flex-col gap-5">
        {groups?.map(([key, entries]) => {
          const ml = entries.reduce((a, e) => a + (e.kind === "feed" ? (e.row.amountMl ?? 0) : 0), 0);
          const count = entries.filter((e) => e.kind === "feed").length;
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
              <ul className="overflow-hidden rounded-3xl border border-line bg-surface">
                {entries.map((e) => (
                  <li key={e.row.id} className="flex items-center gap-3 border-b border-line p-3 last:border-b-0">
                    <span className="grid size-11 shrink-0 place-items-center rounded-full bg-surface2 text-primary">
                      {e.kind === "feed" ? <Milk aria-hidden className="size-5" /> : <Droplets aria-hidden className="size-5" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">
                        {e.kind === "feed"
                          ? e.row.amountMl !== undefined
                            ? formatVolume(e.row.amountMl, e.row.enteredUnit ?? settings.volumeUnit)
                            : t("log.feeding")
                          : t(`diaper.${e.row.type}` as MessageKey)}
                        <span className="ml-2 font-normal text-muted">{formatClock(e.row.at, locale)}</span>
                      </p>
                      {(e.row.note || (e.kind === "feed" && e.row.milk)) && (
                        <p className="truncate text-sm text-muted">
                          {e.kind === "feed" && e.row.milk ? `${t(`quick.${e.row.milk}` as MessageKey)}${e.row.note ? " · " : ""}` : ""}
                          {e.row.note}
                        </p>
                      )}
                    </div>
                    {e.kind === "feed" && (
                      <button
                        type="button"
                        aria-label={t("common.edit")}
                        className="grid size-12 place-items-center rounded-full hover:bg-surface2"
                        onClick={() => openQuickLog({ editFeedingId: e.row.id })}
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
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      {groups && groups.length > 0 && (
        <Button className="mt-5 w-full" onClick={() => setDays((d) => d + 14)}>
          {t("log.loadMore")}
        </Button>
      )}
    </div>
  );
}
