"use client";

import { useEffect } from "react";
import { useApp } from "@/components/app-context";
import { useReminders } from "@/db/hooks";
import { syncPush } from "./client";

/** Keeps scheduled pushes in step with reminders whenever they, quiet hours or connectivity change. */
export function PushSync() {
  const { settings } = useApp();
  const reminders = useReminders();
  const quietKey = JSON.stringify(settings.quietHours);

  useEffect(() => {
    if (!settings.pushEnabled || !reminders) return;
    const run = () => void syncPush().catch(() => undefined);
    const id = setTimeout(run, 1500);
    window.addEventListener("online", run);
    return () => {
      clearTimeout(id);
      window.removeEventListener("online", run);
    };
  }, [settings.pushEnabled, reminders, quietKey]);

  return null;
}
