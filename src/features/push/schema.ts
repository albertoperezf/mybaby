import { z } from "zod";
import { MAX_ITEMS_PER_REQUEST, PUSH_HORIZON_MS } from "./occurrences";

// Only real browser push services: the server will POST to whatever endpoint it is given.
const PUSH_HOSTS: (string | RegExp)[] = [
  "fcm.googleapis.com",
  "updates.push.services.mozilla.com",
  /\.push\.services\.mozilla\.com$/,
  /\.push\.apple\.com$/,
  /\.notify\.windows\.com$/,
];

export function isAllowedPushEndpoint(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
  return PUSH_HOSTS.some((h) => (typeof h === "string" ? url.hostname === h : h.test(url.hostname)));
}

export const subscriptionSchema = z.object({
  endpoint: z.string().max(1000).refine(isAllowedPushEndpoint, "endpoint not allowed"),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});

const reminderId = z.string().min(1).max(64).regex(/^[\w-]+$/);

export const scheduleBodySchema = z.object({
  subscription: subscriptionSchema,
  items: z.array(z.object({ reminderId, fireAt: z.number().int() })).min(1).max(MAX_ITEMS_PER_REQUEST),
});

export const cancelBodySchema = z.object({
  messageIds: z.array(z.string().regex(/^[\w-]{1,100}$/)).min(1).max(100),
});

export const sendBodySchema = z.object({
  subscription: subscriptionSchema,
  reminderId,
  fireAt: z.number().int(),
});

/** fireAt must be (roughly) in the future and within the queue's delay limit. */
export function fireAtInRange(fireAt: number, now: number): boolean {
  return fireAt >= now - 5_000 && fireAt <= now + PUSH_HORIZON_MS + 60_000;
}
