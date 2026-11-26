"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import { applyTheme } from "@/lib/theme";

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

const getSnapshot = () => document.documentElement.dataset.theme ?? "light";
const getServerSnapshot = () => "light";

interface Props {
  toDarkLabel: string;
  toLightLabel: string;
  className?: string;
}

/** Light/dark switch. Persists to localStorage (read before first paint) and to the app settings. */
export function ThemeToggle({ toDarkLabel, toLightLabel, className }: Props) {
  const current = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const isLight = current === "light";

  function toggle() {
    const next = isLight ? "dark" : "light";
    applyTheme(next);
    localStorage.setItem("theme", next);
    // Loaded on demand so static pages don't ship the database layer up front.
    void import("@/db/settings").then((m) => m.setSetting("theme", next));
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isLight ? toDarkLabel : toLightLabel}
      className={`grid size-12 place-items-center rounded-full border border-line bg-surface2 transition active:scale-95 ${className ?? ""}`}
    >
      {isLight ? <Moon aria-hidden className="size-5" /> : <Sun aria-hidden className="size-5" />}
    </button>
  );
}
