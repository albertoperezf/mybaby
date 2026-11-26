"use client";

import clsx from "clsx";
import { Check, CircleDashed, Clock, Minus, TriangleAlert } from "lucide-react";
import { useLocale, useT, type MessageKey } from "@/i18n";
import { formatDate } from "@/lib/time";
import type { Vaccine } from "@/db/types";
import { earliestOn, type DoseStatus } from "./logic";
import { doseLabel, vaccineProtects } from "./labels";

const CHIP: Record<DoseStatus, string> = {
  given: "bg-growth-tint text-growth-ink",
  due: "bg-feed-tint text-feed-ink",
  upcoming: "bg-surface2 text-muted",
  past: "border border-warn bg-surface text-warn",
  skipped: "bg-surface2 text-muted",
};

const ICON = { given: Check, due: Clock, upcoming: CircleDashed, past: TriangleAlert, skipped: Minus } as const;

export function StatusChip({ status }: { status: DoseStatus }) {
  const t = useT();
  const Icon = ICON[status];
  return (
    <span className={clsx("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-extrabold", CHIP[status])}>
      <Icon aria-hidden className="size-3.5" />
      {t(`vaccine.status.${status}` as MessageKey)}
    </span>
  );
}

interface RowProps {
  dose: Vaccine;
  status: DoseStatus;
  byCode: Map<string, Vaccine>;
  onOpen: () => void;
  onQuickGive: () => void;
}

export function DoseRow({ dose, status, byCode, onOpen, onQuickGive }: RowProps) {
  const t = useT();
  const locale = useLocale();
  const label = doseLabel(dose, locale);
  const protects = vaccineProtects(dose, locale);
  const earliest = earliestOn(dose, byCode);
  const when =
    status === "given" && dose.givenOn
      ? t("vaccine.givenOn", { date: formatDate(dose.givenOn, locale) })
      : dose.windowFrom && dose.windowTo
        ? t("vaccine.window", { from: formatDate(earliest ?? dose.windowFrom, locale), to: formatDate(dose.windowTo, locale) })
        : dose.dueOn
          ? t("vaccine.dueOn", { date: formatDate(dose.dueOn, locale) })
          : t("vaccine.noDate");

  return (
    <li className="flex items-center gap-3 border-b border-line p-3 last:border-b-0 print:break-inside-avoid">
      <button
        type="button"
        aria-label={status === "given" ? t("vaccine.edit", { name: label }) : t("vaccine.markToday", { name: label })}
        onClick={status === "given" ? onOpen : onQuickGive}
        className={clsx(
          "grid size-12 shrink-0 place-items-center rounded-full border-2 transition active:scale-95 print:hidden",
          status === "given" ? "border-growth bg-growth-tint text-growth-ink" : "border-line bg-surface2 text-muted",
        )}
      >
        <Check aria-hidden className={clsx("size-6", status !== "given" && "opacity-40")} strokeWidth={3} />
      </button>
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 rounded-xl py-1 text-left">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-extrabold">{label}</span>
          {dose.optional && <span className="rounded-full bg-remind-tint px-2 py-0.5 text-[0.7rem] font-bold text-remind-ink">{t("vaccine.optional")}</span>}
        </span>
        {protects && <span className="block truncate text-sm text-muted">{protects}</span>}
        <span className="block text-sm font-semibold">{when}</span>
      </button>
      <StatusChip status={status} />
    </li>
  );
}
