"use client";

import clsx from "clsx";
import { Bell, ClipboardList, House, Plus, Settings, TrendingUp, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useEntryCount, useActiveBaby, useBabies } from "@/db/hooks";
import { ensureDeviceId, setSetting, useSettings } from "@/db/settings";
import type { Baby, ID, ThemeSetting } from "@/db/types";
import { Onboarding } from "@/features/onboarding";
import { QuickLogSheet } from "@/features/feeding/quick-log";
import { DueBanner, ReminderEngine } from "@/features/reminders/engine";
import { PushSync } from "@/features/push/push-sync";
import { I18nProvider, useT, type MessageKey } from "@/i18n";
import { BRAND } from "@/lib/brand";
import { requestPersistence } from "@/lib/pwa";
import { applyTheme } from "@/lib/theme";
import { AppContextProvider } from "./app-context";
import { BabyAvatar } from "./baby-avatar";
import { ThemeToggle } from "./theme-toggle";
import { ToastProvider } from "./ui";

const NAV: { href: string; label: MessageKey; icon: LucideIcon }[] = [
  { href: "/app", label: "nav.home", icon: House },
  { href: "/app/log", label: "nav.log", icon: ClipboardList },
  { href: "/app/growth", label: "nav.growth", icon: TrendingUp },
  { href: "/app/reminders", label: "nav.reminders", icon: Bell },
  { href: "/app/settings", label: "nav.settings", icon: Settings },
];

const isNightHours = (d = new Date()) => d.getHours() >= 21 || d.getHours() < 6;

function useThemeSync(theme: ThemeSetting | undefined, nightAuto: boolean) {
  const [night, setNight] = useState(() => isNightHours());

  useEffect(() => {
    if (!nightAuto) return;
    const id = setInterval(() => setNight(isNightHours()), 60_000);
    return () => clearInterval(id);
  }, [nightAuto]);

  useEffect(() => {
    if (!theme) return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      if (theme === "system") applyTheme(nightAuto && night ? "night" : media.matches ? "dark" : "light");
      else applyTheme(theme);
    };
    apply();
    localStorage.setItem("theme", theme);
    if (theme !== "system") return;
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme, nightAuto, night]);
}

function BrandMark() {
  return (
    <span className="flex items-center gap-2 text-xl font-extrabold tracking-tight">
      <span
        aria-hidden
        className="grid size-9 place-items-center rounded-xl text-lg"
        style={{ background: "linear-gradient(135deg, #e8803f, #c2492b)", color: "#fff3e6" }}
      >
        ☾
      </span>
      {BRAND.name}
    </span>
  );
}

function BabySwitcher({ babies, activeId, onSelect, label }: { babies: Baby[]; activeId: ID; onSelect: (id: ID) => void; label: string }) {
  if (babies.length < 2) return null;
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-2">
      {babies.map((b) => {
        const active = b.id === activeId;
        return (
          <button
            key={b.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onSelect(b.id)}
            className={clsx(
              "flex min-h-12 shrink-0 items-center gap-2 rounded-full border-2 py-1 pl-1.5 pr-4 font-bold transition",
              active ? "border-primary bg-surface shadow-soft" : "border-transparent bg-surface2",
            )}
          >
            <BabyAvatar baby={b} size="sm" />
            {b.name}
          </button>
        );
      })}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const settings = useSettings();
  const babies = useBabies();
  const baby = useActiveBaby(babies, settings?.activeBabyId);
  const count = useEntryCount();

  useThemeSync(settings?.theme, settings?.nightAuto ?? false);

  useEffect(() => {
    if (settings) void ensureDeviceId();
  }, [settings]);

  useEffect(() => {
    if (settings) document.documentElement.lang = settings.locale;
  }, [settings]);

  // Ask for durable storage once there is something worth protecting.
  useEffect(() => {
    if (count && count > 0) void requestPersistence();
  }, [count]);

  if (!settings || !babies) return <div className="min-h-dvh" aria-busy="true" />;

  return (
    <I18nProvider locale={settings.locale}>
      <ToastProvider>
        {!baby || settings.disclaimerAcceptedAt === null ? (
          <Onboarding settings={settings} />
        ) : (
          <Frame settings={settings} babies={babies} baby={baby}>
            {children}
          </Frame>
        )}
      </ToastProvider>
    </I18nProvider>
  );
}

type FrameProps = {
  settings: NonNullable<ReturnType<typeof useSettings>>;
  babies: NonNullable<ReturnType<typeof useBabies>>;
  baby: NonNullable<ReturnType<typeof useActiveBaby>>;
  children: ReactNode;
};

function Frame({ settings, babies, baby, children }: FrameProps) {
  const t = useT();
  const pathname = usePathname();
  const [quick, setQuick] = useState<{ open: boolean; tab: "feed" | "diaper"; editFeedingId?: ID }>(() => {
    // Home-screen / Siri Shortcut deep links: /app?quick=feed or ?quick=diaper
    const q = new URLSearchParams(window.location.search).get("quick");
    return { open: q === "feed" || q === "diaper", tab: q === "diaper" ? "diaper" : "feed" };
  });

  const openQuickLog = useCallback((opts?: { tab?: "feed" | "diaper"; editFeedingId?: ID }) => {
    setQuick({ open: true, tab: opts?.tab ?? "feed", editFeedingId: opts?.editFeedingId });
  }, []);

  useEffect(() => {
    if (window.location.search.includes("quick=")) window.history.replaceState(null, "", window.location.pathname);
  }, []);

  const value = useMemo(
    () => ({ settings, babies, baby, setActiveBaby: (id: ID) => void setSetting("activeBabyId", id), openQuickLog }),
    [settings, babies, baby, openQuickLog],
  );

  const isActive = (href: string) => (href === "/app" ? pathname === "/app" : pathname.startsWith(href));

  const switcher = (
    <BabySwitcher
      babies={babies}
      activeId={baby.id}
      onSelect={value.setActiveBaby}
      label={t("nav.switchBaby")}
    />
  );

  return (
    <AppContextProvider value={value}>
      <ReminderEngine />
      <PushSync />
      <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
        <aside className="sticky top-0 hidden h-dvh flex-col gap-6 border-r border-line bg-surface p-5 lg:flex">
          <div className="flex items-center justify-between gap-2">
            <BrandMark />
            <ThemeToggle toDarkLabel={t("theme.toDark")} toLightLabel={t("theme.toLight")} />
          </div>
          {switcher}
          <nav aria-label={t("nav.main")} className="flex flex-col gap-1">
            {NAV.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                aria-current={isActive(href) ? "page" : undefined}
                className={clsx(
                  "flex min-h-12 items-center gap-3 rounded-2xl px-4 font-semibold",
                  isActive(href) ? "bg-feed-tint font-extrabold text-feed-ink" : "hover:bg-surface2",
                )}
              >
                <Icon aria-hidden className="size-5" />
                {t(label)}
              </Link>
            ))}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-col">
          <header className="flex items-center justify-between gap-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] lg:hidden">
            <div className="min-w-0 flex-1 overflow-x-auto">{babies.length > 1 ? switcher : <BrandMark />}</div>
            <ThemeToggle toDarkLabel={t("theme.toDark")} toLightLabel={t("theme.toLight")} />
          </header>
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-44 pt-4 lg:p-8 lg:pb-28">
            <div>
              <DueBanner />
              {children}
            </div>
          </main>
        </div>
      </div>

      <nav
        aria-label={t("nav.main")}
        className="fixed inset-x-0 bottom-0 z-30 rounded-t-[1.75rem] border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] shadow-soft lg:hidden"
      >
        <ul className="mx-auto grid max-w-xl grid-cols-5">
          {NAV.map(({ href, label, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                aria-current={isActive(href) ? "page" : undefined}
                className={clsx(
                  "flex min-h-16 flex-col items-center justify-center gap-0.5 text-xs",
                  isActive(href) ? "font-extrabold text-fg" : "font-semibold text-muted",
                )}
              >
                <span
                  className={clsx(
                    "grid h-8 w-14 place-items-center rounded-full transition",
                    isActive(href) && "bg-feed-tint text-feed-ink",
                  )}
                >
                  <Icon aria-hidden className="size-6" />
                </span>
                {t(label)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* Thumb-zone quick action, reachable one-handed from any screen. */}
      <button
        type="button"
        aria-label={t("quick.title")}
        onClick={() => openQuickLog()}
        className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-4 z-40 grid size-16 place-items-center rounded-full bg-primary text-primary-fg shadow-xl ring-4 ring-bg transition active:scale-95 lg:bottom-8 lg:right-8"
      >
        <Plus aria-hidden className="size-8" />
      </button>

      <QuickLogSheet
        open={quick.open}
        initialTab={quick.tab}
        editFeedingId={quick.editFeedingId}
        onClose={() => setQuick((q) => ({ ...q, open: false }))}
      />
    </AppContextProvider>
  );
}
