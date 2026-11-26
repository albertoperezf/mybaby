import { sendNotification, setVapidDetails } from "web-push";
import { sendBodySchema } from "@/features/push/schema";
import { getPushConfig, json, qstashReceiver, sendUrl } from "@/server/push";

export const dynamic = "force-dynamic";

/** Called by the queue at fire time. Only requests signed by the queue are accepted. */
export async function POST(request: Request) {
  const cfg = getPushConfig();
  if (!cfg) return json({ error: "push-not-configured" }, 503);

  const raw = await request.text();
  const signature = request.headers.get("upstash-signature");
  if (!signature) return json({ error: "unauthorized" }, 401);
  try {
    await qstashReceiver(cfg).verify({ signature, body: raw, url: sendUrl(cfg) });
  } catch {
    return json({ error: "unauthorized" }, 401);
  }

  let parsed;
  try {
    parsed = sendBodySchema.safeParse(JSON.parse(raw));
  } catch {
    return json({ error: "invalid-json" }, 400);
  }
  // 2xx on a bad payload so the queue doesn't retry something that can never succeed.
  if (!parsed.success) return json({ error: "invalid-body" }, 200);

  const { subscription, reminderId, fireAt } = parsed.data;
  try {
    setVapidDetails(cfg.vapidSubject, cfg.vapidPublicKey, cfg.vapidPrivateKey);
    // The payload carries ids only; the device builds the visible text from its own data.
    await sendNotification(subscription, JSON.stringify({ reminderId, fireAt }), { TTL: 60 * 60, urgency: "high" });
    return json({ ok: true });
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode;
    // Expired/invalid subscriptions and other permanent client errors must not be retried.
    if (status !== undefined && status >= 400 && status < 500 && status !== 429) return json({ dropped: status }, 200);
    return json({ error: "push-service-unavailable" }, 502);
  }
}
