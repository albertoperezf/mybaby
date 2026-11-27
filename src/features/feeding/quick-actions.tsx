"use client";

import { ChevronRight, Droplets, Milk, Plus, SlidersHorizontal } from "lucide-react";
import { useApp } from "@/components/app-context";
import { Button, SectionTitle } from "@/components/ui";
import { useLastAmount } from "@/db/hooks";
import type { DiaperType } from "@/db/types";
import { useT, type MessageKey } from "@/i18n";
import { formatVolume, toMl, volumeNumber } from "@/lib/units";
import { useLogging } from "./use-logging";

const PRESETS = { oz: [2, 3, 4], ml: [60, 90, 120] } as const;

/** One-tap feeding presets and diaper buttons for the home screen. */
export function QuickActions() {
  const { baby, settings, openQuickLog } = useApp();
  const t = useT();
  const unit = settings.volumeUnit;
  const last = useLastAmount(baby.id);
  const { logFeeding, logDiaper } = useLogging();

  const lastValue = last ? volumeNumber(last.amountMl, unit) : null;
  const presetMl = PRESETS[unit].map((v) => toMl(v, unit));

  return (
    <div className="flex flex-col gap-5">
      <section aria-label={t("home.logFeed")}>
        <SectionTitle>{t("home.logFeed")}</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          {presetMl.map((ml) => (
            <Button
              key={ml}
              variant="feed"
              size="lg"
              className="rounded-[1.75rem] text-2xl"
              onClick={() => logFeeding([baby.id], { at: Date.now(), amountMl: ml, enteredUnit: unit })}
              aria-label={t("home.logAmount", { amount: formatVolume(ml, unit) })}
            >
              <Milk aria-hidden className="size-6 text-feed" />
              {formatVolume(ml, unit)}
            </Button>
          ))}
          {last && lastValue !== null && !PRESETS[unit].some((p) => p === lastValue) ? (
            <Button
              size="lg"
              variant="primary"
              className="rounded-[1.75rem]"
              onClick={() => logFeeding([baby.id], { at: Date.now(), amountMl: last.amountMl, enteredUnit: unit })}
              aria-label={t("home.logLast", { amount: formatVolume(last.amountMl, unit) })}
            >
              <Milk aria-hidden className="size-6" />
              <span className="flex flex-col items-start leading-tight">
                <span className="text-xs font-semibold opacity-85">{t("quick.last")}</span>
                <span className="text-xl">{formatVolume(last.amountMl, unit)}</span>
              </span>
            </Button>
          ) : (
            <Button size="lg" variant="ghost" className="rounded-[1.75rem] border-2 border-dashed border-line" onClick={() => openQuickLog({ tab: "feed" })}>
              <Plus aria-hidden className="size-6" />
              {t("home.other")}
            </Button>
          )}
        </div>
      </section>

      <section aria-label={t("home.logDiaper")}>
        <SectionTitle>{t("home.logDiaper")}</SectionTitle>
        <div className="grid grid-cols-3 gap-3">
          {(["wet", "dirty", "both"] as DiaperType[]).map((type) => (
            <Button key={type} variant="diaper" size="lg" className="flex-col gap-1 rounded-[1.75rem] !px-2 !text-base" onClick={() => logDiaper([baby.id], type)}>
              <Droplets aria-hidden className="size-6 text-diaper" />
              {t(`diaper.${type}` as MessageKey)}
            </Button>
          ))}
        </div>
      </section>

      <Button
        variant="secondary"
        className="w-full justify-between rounded-2xl px-4 shadow-soft"
        onClick={() => openQuickLog({ tab: "feed" })}
      >
        <span className="inline-flex items-center gap-2.5">
          <SlidersHorizontal aria-hidden className="size-4 text-primary" />
          {t("home.moreOptions")}
        </span>
        <ChevronRight aria-hidden className="size-5 text-muted" />
      </Button>
    </div>
  );
}
