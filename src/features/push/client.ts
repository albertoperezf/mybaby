import { db } from "@/db/schema";
import { getSetting, setSetting } from "@/db/settings";
import { trackFeature } from "@/lib/telemetry";
import type { QuietHours, Reminder } from "@/db/types";
import { MAX_ITEMS_PER_REQUEST, upcomingFireTimes } from "./occurrences";

export interface PushConfig {
  enabled: boolean;
  publicKey?: string;
}

export type EnableResult = "ok" | "not-configured" | "unsupported" | "denied" | "error";

const DEFAULT_QUIET: QuietHours = { enabled: false, start: "22:00", end: "07:00" };

export async function fetchPushConfig(): Promise<PushConfig> {
  try {
    const res = await fetch("/api/push/config", { cache: "no-store" });
    return res.ok ? ((await res.json()) as PushConfig) : { enabled: false };
  } catch {
    return { enabled: false };
  }
}

export function pushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`${path} ${res.status}`);
  return (await res.json()) as T;
}

function keyToBytes(base64Url: string): Uint8Array<ArrayBuffer> {
  const padded = base64Url.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(base64Url.length / 4) * 4, "=");
  const raw = atob(padded);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function getSubscription(publicKey?: string): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  if (existing || !publicKey) return existing;
  return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(publicKey) });
}

export async function enablePush(): Promise<EnableResult> {
  const cfg = await fetchPushConfig();
  if (!cfg.enabled || !cfg.publicKey) return "not-configured";
  if (!pushSupported()) return "unsupported";
  const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (permission !== "granted") return "denied";
  try {
    await getSubscription(cfg.publicKey);
    await setSetting("pushEnabled", true);
  } catch {
    return "error";
  }
  void syncPush().catch(() => undefined);
  trackFeature("push_enabled");
  return "ok";
}

export async function disablePush(): Promise<void> {
  await setSetting("pushEnabled", false);
  const reminders = await db.reminders.toArray();
  const ids = reminders.flatMap((r) => (r.pushJobs ?? []).filter((j) => j.at > Date.now()).map((j) => j.id));
  for (let i = 0; i < ids.length; i += 100) {
    await post("/api/push/cancel", { messageIds: ids.slice(i, i + 100) }).catch(() => undefined);
  }
  await Promise.all(reminders.filter((r) => r.pushJobs).map((r) => db.reminders.update(r.id, { pushJobs: undefined, pushEndpoint: undefined })));
  if (pushSupported()) {
    const sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
    await sub?.unsubscribe().catch(() => undefined);
  }
}

/** Sends a push to this device a few seconds from now, to prove the whole path works. */
export async function sendTestPush(): Promise<boolean> {
  const sub = await getSubscription();
  if (!sub) return false;
  try {
    await post("/api/push/schedule", { subscription: sub.toJSON(), items: [{ reminderId: "test", fireAt: Date.now() + 3000 }] });
    return true;
  } catch {
    return false;
  }
}

export async function syncReminder(r: Reminder, sub: PushSubscription, quiet: QuietHours, now: number) {
  const wanted = upcomingFireTimes(r, now, quiet);
  const sameDevice = r.pushEndpoint === sub.endpoint;
  const current = (r.pushJobs ?? []).filter((j) => j.at > now);
  const keep = sameDevice ? current.filter((j) => wanted.includes(j.at)) : [];
  const drop = current.filter((j) => !keep.includes(j));
  const missing = wanted.filter((t) => !keep.some((j) => j.at === t));

  let added: { at: number; id: string }[] = [];
  if (missing.length > 0) {
    const res = await post<{ jobs: { fireAt: number; messageId: string }[] }>("/api/push/schedule", {
      subscription: sub.toJSON(),
      items: missing.slice(0, MAX_ITEMS_PER_REQUEST).map((fireAt) => ({ reminderId: r.id, fireAt })),
    });
    added = res.jobs.map((j) => ({ at: j.fireAt, id: j.messageId }));
  }
  if (drop.length > 0) await post("/api/push/cancel", { messageIds: drop.map((j) => j.id) }).catch(() => undefined);

  const next = [...keep, ...added].sort((a, b) => a.at - b.at);
  const changed = JSON.stringify(next) !== JSON.stringify(r.pushJobs ?? []) || (next.length > 0 && !sameDevice);
  if (changed) await db.reminders.update(r.id, { pushJobs: next.length ? next : undefined, pushEndpoint: next.length ? sub.endpoint : undefined });
}

async function syncOnce() {
  if (!pushSupported() || !(await getSetting("pushEnabled")) || Notification.permission !== "granted") return;
  if (!navigator.onLine) return;
  let sub = await getSubscription();
  if (!sub) {
    // The browser dropped the subscription (rotation/cleanup): quietly get a new one.
    const cfg = await fetchPushConfig();
    if (!cfg.enabled || !cfg.publicKey) return;
    sub = await getSubscription(cfg.publicKey);
    if (!sub) return;
  }
  const quiet = (await getSetting("quietHours")) ?? DEFAULT_QUIET;
  const now = Date.now();
  for (const r of await db.reminders.toArray()) await syncReminder(r, sub, quiet, now);
}

let running: Promise<void> | null = null;
let rerun = false;

/** Reconciles scheduled pushes with the reminders on this device. Safe to call often; calls are coalesced. */
export function syncPush(): Promise<void> {
  if (running) {
    rerun = true;
    return running;
  }
  running = (async () => {
    try {
      do {
        rerun = false;
        await syncOnce();
      } while (rerun);
    } finally {
      running = null;
    }
  })();
  return running;
}
