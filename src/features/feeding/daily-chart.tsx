"use client";

import { Card, SectionTitle } from "@/components/ui";
import { useApp } from "@/components/app-context";
import { useLocale, useT } from "@/i18n";
import { formatVolume, volumeNumber } from "@/lib/units";
import type { DaySummary } from "./stats";

/** Bars of total volume per day. Pure SVG: no chart library on the home route. */
export function DailyTotalsChart({ days }: { days: DaySummary[] }) {
  const { settings } = useApp();
  const t = useT();
  const locale = useLocale();
  const unit = settings.volumeUnit;
  const values = days.map((d) => volumeNumber(d.ml, unit));
  const max = Math.max(1, ...values);

  const W = 320;
  const H = 140;
  const pad = { l: 4, r: 4, t: 16, b: 22 };
  const slot = (W - pad.l - pad.r) / days.length;
  const barW = Math.min(28, slot * 0.62);
  const weekday = new Intl.DateTimeFormat(locale, { weekday: "narrow" });

  return (
    <Card>
      <SectionTitle>{t("stats.dailyTotals")}</SectionTitle>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t("stats.dailyTotals")} className="h-auto w-full">
        <line x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} stroke="var(--border)" />
        {days.map((d, i) => {
          const h = ((H - pad.t - pad.b) * values[i]) / max;
          const x = pad.l + slot * i + (slot - barW) / 2;
          const isToday = i === days.length - 1;
          return (
            <g key={d.key}>
              <rect
                x={x}
                y={H - pad.b - h}
                width={barW}
                height={Math.max(h, d.ml > 0 ? 2 : 0)}
                rx={4}
                fill="var(--feed)"
                opacity={isToday ? 1 : 0.55}
              />
              {d.ml > 0 && (
                <text x={x + barW / 2} y={H - pad.b - h - 4} textAnchor="middle" fontSize="9" fill="var(--muted)">
                  {values[i]}
                </text>
              )}
              <text x={x + barW / 2} y={H - 7} textAnchor="middle" fontSize="10" fill="var(--muted)">
                {weekday.format(d.start)}
              </text>
            </g>
          );
        })}
      </svg>
      <table className="sr-only">
        <caption>{t("stats.dailyTotals")}</caption>
        <tbody>
          {days.map((d) => (
            <tr key={d.key}>
              <th scope="row">{d.key}</th>
              <td>{formatVolume(d.ml, unit)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
