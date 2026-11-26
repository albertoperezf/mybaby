import { Client, Receiver } from "@upstash/qstash";

export interface PushServerConfig {
  vapidPublicKey: string;
  vapidPrivateKey: string;
  vapidSubject: string;
  qstashToken: string;
  currentSigningKey: string;
  nextSigningKey: string;
  qstashUrl?: string;
  /** Public origin QStash calls back, e.g. https://mybaby.example.com */
  baseUrl: string;
}

/** Returns null unless every required variable is set, which keeps push fully optional. */
export function getPushConfig(): PushServerConfig | null {
  const env = process.env;
  const host = env.VERCEL_PROJECT_PRODUCTION_URL;
  const baseUrl = (env.PUSH_BASE_URL ?? (host ? `https://${host}` : "")).replace(/\/$/, "");
  const cfg = {
    vapidPublicKey: env.VAPID_PUBLIC_KEY,
    vapidPrivateKey: env.VAPID_PRIVATE_KEY,
    vapidSubject: env.VAPID_SUBJECT,
    qstashToken: env.QSTASH_TOKEN,
    currentSigningKey: env.QSTASH_CURRENT_SIGNING_KEY,
    nextSigningKey: env.QSTASH_NEXT_SIGNING_KEY,
    qstashUrl: env.QSTASH_URL,
    baseUrl,
  };
  const required = [cfg.vapidPublicKey, cfg.vapidPrivateKey, cfg.vapidSubject, cfg.qstashToken, cfg.currentSigningKey, cfg.nextSigningKey, baseUrl];
  return required.every(Boolean) ? (cfg as PushServerConfig) : null;
}

export const sendUrl = (cfg: PushServerConfig) => `${cfg.baseUrl}/api/push/send`;

export const qstashClient = (cfg: PushServerConfig) => new Client({ token: cfg.qstashToken, baseUrl: cfg.qstashUrl });

export const qstashReceiver = (cfg: PushServerConfig) =>
  new Receiver({ currentSigningKey: cfg.currentSigningKey, nextSigningKey: cfg.nextSigningKey });

// Best-effort per-instance throttle; the real guard is that each request can only schedule alerts to a push endpoint.
const hits = new Map<string, number[]>();
export function rateLimited(request: Request, limit = 60, windowMs = 10 * 60_000, now = Date.now()): boolean {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > limit;
}

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
