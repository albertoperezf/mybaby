"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { Baby, ID, SettingsValues } from "@/db/types";

export interface AppContextValue {
  settings: SettingsValues;
  babies: Baby[];
  /** Currently selected baby (always defined once onboarding is done). */
  baby: Baby;
  setActiveBaby: (id: ID) => void;
  openQuickLog: (opts?: { tab?: "feed" | "diaper"; editFeedingId?: ID }) => void;
}

const AppContext = createContext<AppContextValue | null>(null);
export const AppContextProvider = AppContext.Provider;

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside the app shell");
  return ctx;
}

/**
 * Re-renders every `everyMs` so relative times ("12m ago") stay live.
 * Pass a `resetKey` that changes with the data being shown so the clock catches up right away.
 */
export function useNow(everyMs = 30_000, resetKey?: unknown): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const id = setInterval(tick, everyMs);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [everyMs]);

  useEffect(() => {
    const id = setTimeout(() => setNow(Date.now()), 0);
    return () => clearTimeout(id);
  }, [resetKey]);
  return now;
}
