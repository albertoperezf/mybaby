"use client";

import { Droplets, Milk, Plus } from "lucide-react";
import { useApp } from "@/components/app-context";
import { Button, Card, SectionTitle } from "@/components/ui";
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

  const lastOz = last ? volumeNumber(last.amountMl, unit) : null;
  const presetMl = PRESETS[unit].map((v) => toMl(v, unit));

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <SectionTitle>{t("home.logFeed")}</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          {presetMl.map((ml) => (
            <Button
              key={ml}
              size="lg"
              onClick={() => logFeeding([baby.id], { at: Date.now(), amountMl: ml, enteredUnit: unit })}
              aria-label={t("home.logAmount", { amount: formatVolume(ml, unit) })}
            >
              <Milk aria-hidden className="size-5" />
              {formatVolume(ml, unit)}
            </Button>
          ))}
          {last && lastOz !== null && !PRESETS[unit].some((p) => p === lastOz) ? (
            <Button
              size="lg"
              variant="primary"
              onClick={() => logFeeding([baby.id], { at: Date.now(), amountMl: last.amountMl, enteredUnit: unit })}
              aria-label={t("home.logLast", { amount: formatVolume(last.amountMl, unit) })}
            >
              <Milk aria-hidden className="size-5" />
              <span className="flex flex-col items-start leading-tight">
                <span className="text-xs font-medium opacity-80">{t("quick.last")}</span>
                {formatVolume(last.amountMl, unit)}
              </span>
            </Button>
          ) : (
            <Button size="lg" variant="ghost" className="border border-dashed border-line" onClick={() => openQuickLog({ tab: "feed" })}>
              <Plus aria-hidden className="size-5" />
              {t("home.other")}
            </Button>
          )}
        </div>
      </div>

      <div>
        <SectionTitle>{t("home.logDiaper")}</SectionTitle>
        <div className="grid grid-cols-3 gap-2">
          {(["wet", "dirty", "both"] as DiaperType[]).map((type) => (
            <Button key={type} size="lg" className="!text-lg" onClick={() => logDiaper([baby.id], type)}>
              <Droplets aria-hidden className="size-5" />
              {t(`diaper.${type}` as MessageKey)}
            </Button>
          ))}
        </div>
      </div>

      <Button variant="ghost" onClick={() => openQuickLog({ tab: "feed" })}>
        {t("home.moreOptions")}
      </Button>
    </Card>
  );
}
