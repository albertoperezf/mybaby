"use client";

import { ExternalLink, Syringe } from "lucide-react";
import { useState } from "react";
import { Button, Card } from "@/components/ui";
import type { Baby, VaccineScheduleId } from "@/db/types";
import { useLocale, useT } from "@/i18n";
import { trackFeature } from "@/lib/telemetry";
import { applySchedule } from "./repo";
import { SCHEDULES } from "./schedule-data";

/** Best guess of the user's country from the browser language, only used to highlight a choice. */
function suggested(): VaccineScheduleId | null {
  const region = (typeof navigator !== "undefined" ? navigator.language : "").split("-")[1]?.toUpperCase();
  return region === "ES" ? "es" : region === "US" ? "us" : null;
}

export function ScheduleChooser({ baby, onDone }: { baby: Baby; onDone?: () => void }) {
  const t = useT();
  const locale = useLocale();
  const [busy, setBusy] = useState(false);
  const hint = suggested();

  async function choose(id: VaccineScheduleId | "none") {
    setBusy(true);
    await applySchedule(baby, id);
    trackFeature("vaccine_schedule");
    setBusy(false);
    onDone?.();
  }

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-diaper-tint text-diaper-ink">
          <Syringe aria-hidden className="size-6" />
        </span>
        <div>
          <h2 className="text-xl font-extrabold">{t("vaccine.chooseTitle", { name: baby.name })}</h2>
          <p className="text-sm text-muted">{t("vaccine.chooseBody")}</p>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {(Object.values(SCHEDULES) as (typeof SCHEDULES)[VaccineScheduleId][]).map((s) => (
          <div key={s.id} className="flex flex-col gap-2 rounded-3xl border border-line bg-surface2 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="font-extrabold">{s.name[locale]}</p>
              {hint === s.id && <span className="rounded-full bg-feed-tint px-2.5 py-0.5 text-xs font-bold text-feed-ink">{t("vaccine.suggested")}</span>}
            </div>
            <p className="text-sm text-muted">{s.source[locale]}</p>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="primary" disabled={busy} onClick={() => choose(s.id)}>
                {t("vaccine.useSchedule")}
              </Button>
              <a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold underline">
                {t("vaccine.viewSource")}
                <ExternalLink aria-hidden className="size-4" />
              </a>
            </div>
          </div>
        ))}
        <Button variant="ghost" disabled={busy} onClick={() => choose("none")}>
          {t("vaccine.startEmpty")}
        </Button>
      </div>
      <p className="text-xs text-muted">{t("vaccine.disclaimer")}</p>
    </Card>
  );
}
