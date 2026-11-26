"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/i18n";

/** Growth and Vaccines share the "Health" tab in the main navigation. */
export function HealthTabs() {
  const t = useT();
  const pathname = usePathname();
  const tabs = [
    { href: "/app/growth", label: t("nav.growth") },
    { href: "/app/vaccines", label: t("nav.vaccines") },
  ];
  return (
    <nav aria-label={t("nav.health")} className="mb-4 flex gap-1 rounded-2xl bg-surface2 p-1 print:hidden">
      {tabs.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "flex min-h-11 flex-1 items-center justify-center rounded-xl px-3 text-sm font-bold transition",
              active ? "bg-primary text-primary-fg" : "text-fg",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
