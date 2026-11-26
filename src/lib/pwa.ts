"use client";

import { useCallback, useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  // iPadOS reports as Mac with touch points.
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function useInstall() {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);
  // This hook only runs in the client-only app tree, so reading the browser during init is safe.
  const [standalone, setStandalone] = useState(isStandalone);
  const [ios] = useState(isIos);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setStandalone(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!event) return;
    await event.prompt();
    await event.userChoice;
    setEvent(null);
  }, [event]);

  return { standalone, ios, canPrompt: event !== null, install };
}

export interface StorageStatus {
  persisted: boolean | null;
  usage?: number;
  quota?: number;
}

/** Asks the browser not to evict our IndexedDB under storage pressure. */
export async function requestPersistence(): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) return false;
  if (await navigator.storage.persisted()) return true;
  return navigator.storage.persist();
}

export async function readStorageStatus(): Promise<StorageStatus> {
  if (typeof navigator === "undefined" || !navigator.storage) return { persisted: null };
  const [persisted, estimate] = await Promise.all([
    navigator.storage.persisted?.() ?? Promise.resolve(null),
    navigator.storage.estimate?.() ?? Promise.resolve(undefined),
  ]);
  return { persisted, usage: estimate?.usage, quota: estimate?.quota };
}
