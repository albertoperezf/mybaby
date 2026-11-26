"use client";

import { useMemo } from "react";
import type { Sex } from "@/db/types";
import { useT } from "@/i18n";
import { CURVES, DAYS_PER_MONTH, curvePoints, ordinal, type Indicator, type WhoData } from "@/lib/who";

export interface ChartPoint {
  days: number;
  value: number; // grams or millimetres
}

interface Props {
  who: WhoData;
  sex: Sex;
  indicator: Indicator;
  imperial: boolean;
  points: ChartPoint[];
  maxMonths: number;
  locale: string;
}

const W = 640;
const H = 380;
const M = { l: 48, r: 44, t: 14, b: 44 };

function toDisplay(indicator: Indicator, imperial: boolean, base: number): number {
  if (indicator === "weight") return imperial ? base / 453.59237 : base / 1000;
  return imperial ? base / 25.4 : base / 10;
}

function niceStep(range: number, target = 6): number {
  const raw = range / target;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  for (const m of [1, 2, 2.5, 5, 10]) if (raw <= m * pow) return m * pow;
  return 10 * pow;
}

export function GrowthChart({ who, sex, indicator, imperial, points, maxMonths, locale }: Props) {
  const t = useT();
  const maxDays = maxMonths * DAYS_PER_MONTH;

  const geometry = useMemo(() => {
    const lines = CURVES.map((c) => ({
      ...c,
      pts: curvePoints(who, indicator, sex, c.z, maxDays, maxMonths <= 12 ? 7 : 14).map((p) => ({
        x: p.days,
        y: toDisplay(indicator, imperial, p.value),
      })),
    }));
    const visible = points.filter((p) => p.days <= maxDays).map((p) => ({ x: p.days, y: toDisplay(indicator, imperial, p.value) }));
    const ys = [...lines.flatMap((l) => l.pts.map((p) => p.y)), ...visible.map((p) => p.y)];
    const step = niceStep(Math.max(...ys) - Math.min(...ys));
    const yMin = Math.floor(Math.min(...ys) / step) * step;
    const yMax = Math.ceil(Math.max(...ys) / step) * step;
    return { lines, visible, step, yMin, yMax };
  }, [who, indicator, sex, imperial, points, maxDays, maxMonths]);

  const { lines, visible, step, yMin, yMax } = geometry;
  const x = (days: number) => M.l + (days / maxDays) * (W - M.l - M.r);
  const y = (v: number) => H - M.b - ((v - yMin) / (yMax - yMin)) * (H - M.t - M.b);
  const path = (pts: { x: number; y: number }[]) => pts.map((p, i) => `${i ? "L" : "M"}${x(p.x).toFixed(1)},${y(p.y).toFixed(1)}`).join(" ");

  const yTicks: number[] = [];
  for (let v = yMin; v <= yMax + step / 2; v += step) yTicks.push(Number(v.toFixed(4)));
  const xStep = maxMonths <= 12 ? 1 : maxMonths <= 24 ? 3 : 6;
  const xTicks: number[] = [];
  for (let m = 0; m <= maxMonths; m += xStep) xTicks.push(m);

  const p3 = lines[0].pts;
  const p97 = lines[lines.length - 1].pts;
  const band = `${path(p97)} ${[...p3].reverse().map((p) => `L${x(p.x).toFixed(1)},${y(p.y).toFixed(1)}`).join(" ")} Z`;
  const unitLabel = indicator === "weight" ? (imperial ? "lb" : "kg") : imperial ? "in" : "cm";

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t("growth.chartLabel")} className="h-auto w-full">
      {yTicks.map((v) => (
        <g key={v}>
          <line x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} stroke="var(--border)" strokeDasharray="3 4" />
          <text x={M.l - 6} y={y(v) + 4} textAnchor="end" fontSize="12" fill="var(--muted)">
            {Number(v.toFixed(1))}
          </text>
        </g>
      ))}
      {xTicks.map((m) => (
        <text key={m} x={x(m * DAYS_PER_MONTH)} y={H - M.b + 18} textAnchor="middle" fontSize="12" fill="var(--muted)">
          {m}
        </text>
      ))}
      <text x={M.l} y={M.t - 2} fontSize="12" fill="var(--muted)">
        {unitLabel}
      </text>
      <text x={(M.l + W - M.r) / 2} y={H - 4} textAnchor="middle" fontSize="12" fill="var(--muted)">
        {t("growth.months")}
      </text>

      <path d={band} fill="var(--surface-2)" opacity={0.9} />
      {lines.map((l) => (
        <g key={l.percentile}>
          <path
            d={path(l.pts)}
            fill="none"
            stroke={l.percentile === 50 ? "var(--fg)" : "var(--muted)"}
            strokeWidth={l.percentile === 50 ? 1.8 : 1}
            strokeDasharray={l.percentile === 50 ? undefined : "5 4"}
          />
          {l.pts.length > 0 && (
            <text x={W - M.r + 4} y={y(l.pts[l.pts.length - 1].y) + 4} fontSize="11" fill="var(--muted)">
              {ordinal(l.percentile, locale)}
            </text>
          )}
        </g>
      ))}

      {visible.length > 1 && <path d={path(visible)} fill="none" stroke="var(--primary)" strokeWidth={3} strokeLinejoin="round" />}
      {visible.map((p, i) => (
        <circle key={i} cx={x(p.x)} cy={y(p.y)} r={5.5} fill="var(--primary)" stroke="var(--surface)" strokeWidth={2} />
      ))}
    </svg>
  );
}
