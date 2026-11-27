import { useSyncExternalStore } from "react";
import type { ID } from "@/db/types";

export interface BreastTimerState {
  kind: "breast";
  babyId: ID;
  startedAt: number;
  activeSide: "left" | "right" | null;
  sideStartedAt: number | null;
  leftSec: number;
  rightSec: number;
}

export interface PumpTimerState {
  kind: "pump";
  babyId: ID;
  startedAt: number;
  runningSince: number | null;
  accumulatedSec: number;
  side: "left" | "right" | "both";
}

interface StoredTimers {
  breast: Record<ID, BreastTimerState>;
  pump: Record<ID, PumpTimerState>;
}

const STORAGE_KEY = "mybaby.timers.v1";
const EMPTY: StoredTimers = { breast: {}, pump: {} };

// ---- pure timer math -------------------------------------------------------

export function formatStopwatch(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

export function formatDurationShort(totalSec: number): string {
  const m = Math.round(Math.max(0, totalSec) / 60);
  if (m < 1) return "< 1m";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h}h ${rem}m` : `${h}h`;
}

export function breastElapsed(t: BreastTimerState, now: number): { leftSec: number; rightSec: number; totalSec: number } {
  const running = t.activeSide && t.sideStartedAt !== null ? Math.max(0, (now - t.sideStartedAt) / 1000) : 0;
  const leftSec = Math.floor(t.leftSec + (t.activeSide === "left" ? running : 0));
  const rightSec = Math.floor(t.rightSec + (t.activeSide === "right" ? running : 0));
  return { leftSec, rightSec, totalSec: leftSec + rightSec };
}

export function pumpElapsed(t: PumpTimerState, now: number): number {
  const running = t.runningSince !== null ? Math.max(0, (now - t.runningSince) / 1000) : 0;
  return Math.floor(t.accumulatedSec + running);
}

/** Tap a side: starts it if idle, pauses it if already active, or switches sides seamlessly. */
export function toggleBreastSide(
  current: BreastTimerState | null,
  babyId: ID,
  side: "left" | "right",
  now: number,
): BreastTimerState {
  if (!current) {
    return {
      kind: "breast",
      babyId,
      startedAt: now,
      activeSide: side,
      sideStartedAt: now,
      leftSec: 0,
      rightSec: 0,
    };
  }
  const { leftSec, rightSec } = breastElapsed(current, now);
  if (current.activeSide === side) {
    return { ...current, activeSide: null, sideStartedAt: null, leftSec, rightSec };
  }
  return { ...current, activeSide: side, sideStartedAt: now, leftSec, rightSec };
}

export function pauseBreast(current: BreastTimerState, now: number): BreastTimerState {
  const { leftSec, rightSec } = breastElapsed(current, now);
  return { ...current, activeSide: null, sideStartedAt: null, leftSec, rightSec };
}

export function breastSummarySide(leftSec: number, rightSec: number): "left" | "right" | "both" {
  if (leftSec > 0 && rightSec > 0) return "both";
  return rightSec > leftSec ? "right" : "left";
}

export function startOrResumePump(
  current: PumpTimerState | null,
  babyId: ID,
  side: "left" | "right" | "both",
  now: number,
): PumpTimerState {
  if (!current) {
    return { kind: "pump", babyId, startedAt: now, runningSince: now, accumulatedSec: 0, side };
  }
  if (current.runningSince !== null) return current;
  return { ...current, runningSince: now };
}

export function pausePump(current: PumpTimerState, now: number): PumpTimerState {
  return { ...current, accumulatedSec: pumpElapsed(current, now), runningSince: null };
}

export function setPumpSide(current: PumpTimerState, side: "left" | "right" | "both"): PumpTimerState {
  return { ...current, side };
}

// ---- localStorage store ----------------------------------------------------

const listeners = new Set<() => void>();
let cache: StoredTimers | null = null;

function readStore(): StoredTimers {
  if (cache) return cache;
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      cache = EMPTY;
      return cache;
    }
    const parsed = JSON.parse(raw) as Partial<StoredTimers>;
    cache = {
      breast: parsed.breast && typeof parsed.breast === "object" ? parsed.breast : {},
      pump: parsed.pump && typeof parsed.pump === "object" ? parsed.pump : {},
    };
    return cache;
  } catch {
    cache = EMPTY;
    return cache;
  }
}

function writeStore(next: StoredTimers) {
  cache = next;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Storage full or unavailable; keep in-memory cache.
    }
  }
  listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      cache = null;
      fn();
    }
  };
  if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(fn);
    if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
  };
}

export function setBreastTimer(babyId: ID, state: BreastTimerState | null) {
  const cur = readStore();
  const breast = { ...cur.breast };
  if (state) breast[babyId] = state;
  else delete breast[babyId];
  writeStore({ ...cur, breast });
}

export function setPumpTimer(babyId: ID, state: PumpTimerState | null) {
  const cur = readStore();
  const pump = { ...cur.pump };
  if (state) pump[babyId] = state;
  else delete pump[babyId];
  writeStore({ ...cur, pump });
}

export function useActiveTimers(babyId: ID) {
  const store = useSyncExternalStore(subscribe, readStore, () => EMPTY);
  return {
    breast: store.breast[babyId] ?? null,
    pump: store.pump[babyId] ?? null,
  };
}
