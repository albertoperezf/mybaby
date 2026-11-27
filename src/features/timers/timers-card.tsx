"use client";

import clsx from "clsx";
import { Check, Droplet, Heart, Moon, Pause, Play, Square, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useApp } from "@/components/app-context";
import { Button, Card, SectionTitle, Segmented, inputClass, useToast } from "@/components/ui";
import { useActiveSleep } from "@/db/hooks";
import { softDelete, startSleep, stopSleep, updateSleep } from "@/db/repo";
import { useLogging } from "@/features/feeding/use-logging";
import { useLocale, useT } from "@/i18n";
import { trackFeature } from "@/lib/telemetry";
import { formatClock } from "@/lib/time";
import { toMl } from "@/lib/units";
import {
  breastElapsed,
  breastSummarySide,
  formatDurationShort,
  formatStopwatch,
  pauseBreast,
  pausePump,
  pumpElapsed,
  setBreastTimer,
  setPumpSide,
  setPumpTimer,
  startOrResumePump,
  toggleBreastSide,
  useActiveTimers,
} from "./timer-store";

/** Sleep, breast and pump live timers for the home screen. */
export function TimersCard() {
  const { baby, settings } = useApp();
  const t = useT();
  const locale = useLocale();
  const toast = useToast();
  const { logFeeding } = useLogging();

  const activeSleep = useActiveSleep(baby.id);
  const { breast, pump } = useActiveTimers(baby.id);

  const [pumpAmount, setPumpAmount] = useState("");
  const [pumpUnit, setPumpUnit] = useState<"oz" | "ml">(settings.volumeUnit);

  const isAnyRunning = Boolean(activeSleep || breast?.activeSide || pump?.runningSince !== null && pump !== null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!isAnyRunning) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isAnyRunning]);

  const sleepSec = activeSleep ? Math.max(0, Math.floor((now - activeSleep.startedAt) / 1000)) : 0;
  const breastTimes = breast ? breastElapsed(breast, now) : null;
  const pumpSec = pump ? pumpElapsed(pump, now) : 0;

  async function handleStartSleep() {
    await startSleep(baby.id, Date.now());
    setNow(Date.now());
    trackFeature("sleep_timer");
  }

  async function handleWakeUp() {
    if (!activeSleep) return;
    const endedAt = Date.now();
    const id = activeSleep.id;
    const dur = formatDurationShort((endedAt - activeSleep.startedAt) / 1000);
    await stopSleep(id, endedAt);
    toast.show({
      message: t("timer.loggedSleep", { duration: dur }),
      actionLabel: t("common.undo"),
      onAction: () => updateSleep(id, { endedAt: undefined }),
    });
  }

  async function handleDiscardSleep() {
    if (!activeSleep) return;
    await softDelete("sleeps", [activeSleep.id]);
  }

  async function handleSaveBreast() {
    if (!breast) return;
    const ts = Date.now();
    const { leftSec, rightSec, totalSec } = breastElapsed(breast, ts);
    const side = breastSummarySide(leftSec, rightSec);
    setBreastTimer(baby.id, null);
    trackFeature("breast_timer");
    await logFeeding([baby.id], {
      at: breast.startedAt,
      kind: "breast",
      side,
      durationSec: Math.max(1, totalSec),
      milk: "breastmilk",
    });
  }

  async function handleSavePump() {
    if (!pump) return;
    const ts = Date.now();
    const durationSec = Math.max(1, pumpElapsed(pump, ts));
    const parsed = Number(pumpAmount.replace(",", "."));
    const hasAmount = pumpAmount.trim() !== "" && Number.isFinite(parsed) && parsed > 0;
    const side = pump.side;
    const startedAt = pump.startedAt;
    setPumpTimer(baby.id, null);
    setPumpAmount("");
    trackFeature("pump_timer");
    await logFeeding([baby.id], {
      at: startedAt,
      kind: "pump",
      side,
      durationSec,
      amountMl: hasAmount ? toMl(parsed, pumpUnit) : undefined,
      enteredUnit: hasAmount ? pumpUnit : undefined,
      milk: "breastmilk",
    });
  }

  return (
    <section aria-label={t("timer.section")} className="flex flex-col gap-3">
      <SectionTitle>{t("timer.section")}</SectionTitle>

      {/* Live sleep timer */}
      {activeSleep && (
        <Card className="flex flex-col gap-3 !border-sleep/40 !bg-sleep-tint text-sleep-ink">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide">
              <Moon aria-hidden className="size-4 text-sleep" />
              {t("timer.sleeping")}
            </span>
            <span className="text-sm font-semibold opacity-90">
              {t("timer.startedAt", { at: formatClock(activeSleep.startedAt, locale) })}
            </span>
          </div>
          <p className="text-4xl font-extrabold tabular-nums tracking-tight">{formatStopwatch(sleepSec)}</p>
          <div className="flex gap-2">
            <Button variant="primary" size="md" className="flex-1" onClick={handleWakeUp}>
              <Square aria-hidden className="size-4 fill-current" />
              {t("timer.wakeUp")}
            </Button>
            <Button
              variant="secondary"
              size="md"
              onClick={handleDiscardSleep}
              aria-label={t("timer.discard")}
            >
              <X aria-hidden className="size-5" />
            </Button>
          </div>
        </Card>
      )}

      {/* Live breast timer */}
      {breast && breastTimes && (
        <Card className="flex flex-col gap-3 !border-feed/40 !bg-feed-tint text-feed-ink">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide">
              <Heart aria-hidden className="size-4 text-feed" />
              {t("timer.breast")}
            </span>
            <span className="text-2xl font-extrabold tabular-nums">{formatStopwatch(breastTimes.totalSec)}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(["left", "right"] as const).map((side) => {
              const active = breast.activeSide === side;
              const sec = side === "left" ? breastTimes.leftSec : breastTimes.rightSec;
              return (
                <button
                  key={side}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    const ts = Date.now();
                    setBreastTimer(baby.id, toggleBreastSide(breast, baby.id, side, ts));
                    setNow(ts);
                  }}
                  className={clsx(
                    "flex min-h-16 flex-col items-center justify-center rounded-2xl border-2 px-3 py-2 transition active:scale-[0.97]",
                    active
                      ? "border-primary bg-primary text-primary-fg shadow-soft"
                      : "border-feed/30 bg-surface text-fg",
                  )}
                >
                  <span className="text-xs font-bold uppercase tracking-wide">
                    {t(side === "left" ? "timer.left" : "timer.right")}
                  </span>
                  <span className="text-xl font-extrabold tabular-nums">{formatStopwatch(sec)}</span>
                </button>
              );
            })}
          </div>
          <div className="flex gap-2">
            {breast.activeSide && (
              <Button
                variant="secondary"
                size="md"
                onClick={() => {
                  const ts = Date.now();
                  setBreastTimer(baby.id, pauseBreast(breast, ts));
                  setNow(ts);
                }}
              >
                <Pause aria-hidden className="size-4" />
                {t("timer.pause")}
              </Button>
            )}
            <Button variant="primary" size="md" className="flex-1" onClick={handleSaveBreast}>
              <Check aria-hidden className="size-4" />
              {t("timer.save")}
            </Button>
            <Button
              variant="secondary"
              size="md"
              onClick={() => setBreastTimer(baby.id, null)}
              aria-label={t("timer.discard")}
            >
              <X aria-hidden className="size-5" />
            </Button>
          </div>
        </Card>
      )}

      {/* Live pump timer */}
      {pump && (
        <Card className="flex flex-col gap-3 !border-remind/40 !bg-remind-tint text-remind-ink">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2 text-sm font-extrabold uppercase tracking-wide">
              <Droplet aria-hidden className="size-4 text-remind" />
              {t("timer.pump")}
            </span>
            <span className="text-2xl font-extrabold tabular-nums">{formatStopwatch(pumpSec)}</span>
          </div>
          <Segmented
            label={t("timer.side")}
            value={pump.side}
            onChange={(side) => setPumpTimer(baby.id, setPumpSide(pump, side))}
            options={[
              { value: "left", label: t("timer.left") },
              { value: "right", label: t("timer.right") },
              { value: "both", label: t("timer.both") },
            ]}
          />
          <div className="flex gap-2">
            <input
              inputMode="decimal"
              aria-label={t("timer.pumpAmount")}
              className={clsx(inputClass, "!bg-surface")}
              value={pumpAmount}
              placeholder={t("timer.pumpAmount")}
              onChange={(e) => setPumpAmount(e.target.value)}
            />
            <Segmented
              label={t("settings.volumeUnit")}
              value={pumpUnit}
              onChange={setPumpUnit}
              options={[
                { value: "oz", label: "oz" },
                { value: "ml", label: "ml" },
              ]}
              className="w-28 shrink-0 !bg-surface"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="md"
              onClick={() => {
                const ts = Date.now();
                setPumpTimer(
                  baby.id,
                  pump.runningSince !== null ? pausePump(pump, ts) : startOrResumePump(pump, baby.id, pump.side, ts),
                );
                setNow(ts);
              }}
            >
              {pump.runningSince !== null ? <Pause aria-hidden className="size-4" /> : <Play aria-hidden className="size-4" />}
              {pump.runningSince !== null ? t("timer.pause") : t("timer.resume")}
            </Button>
            <Button variant="primary" size="md" className="flex-1" onClick={handleSavePump}>
              <Check aria-hidden className="size-4" />
              {t("timer.save")}
            </Button>
            <Button
              variant="secondary"
              size="md"
              onClick={() => {
                setPumpTimer(baby.id, null);
                setPumpAmount("");
              }}
              aria-label={t("timer.discard")}
            >
              <X aria-hidden className="size-5" />
            </Button>
          </div>
        </Card>
      )}

      {/* Quick-start buttons for whichever timers are not currently active */}
      {(!activeSleep || !breast || !pump) && (
        <div className="grid grid-cols-3 gap-3">
          {!activeSleep && (
            <Button
              variant="sleep"
              size="lg"
              className="flex-col gap-1 rounded-[1.75rem] !px-2 !text-base"
              onClick={handleStartSleep}
            >
              <Moon aria-hidden className="size-6 text-sleep" />
              {t("timer.sleep")}
            </Button>
          )}
          {!breast && (
            <Button
              variant="feed"
              size="lg"
              className="flex-col gap-1 rounded-[1.75rem] !px-2 !text-base"
              onClick={() => {
                const ts = Date.now();
                setBreastTimer(baby.id, toggleBreastSide(null, baby.id, "left", ts));
                setNow(ts);
              }}
            >
              <Heart aria-hidden className="size-6 text-feed" />
              {t("timer.breast")}
            </Button>
          )}
          {!pump && (
            <Button
              variant="secondary"
              size="lg"
              className="flex-col gap-1 rounded-[1.75rem] !border-remind/30 !bg-remind-tint !px-2 !text-base !font-bold !text-remind-ink"
              onClick={() => {
                const ts = Date.now();
                setPumpUnit(settings.volumeUnit);
                setPumpTimer(baby.id, startOrResumePump(null, baby.id, "both", ts));
                setNow(ts);
              }}
            >
              <Droplet aria-hidden className="size-6 text-remind" />
              {t("timer.pump")}
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
