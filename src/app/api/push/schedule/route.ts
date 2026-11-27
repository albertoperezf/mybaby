import { fireAtInRange, scheduleBodySchema } from "@/features/push/schema";
import { getPushConfig, json, qstashClient, rateLimited, sendUrl } from "@/server/push";

export const dynamic = "force-dynamic";

/** Queues one delayed delivery per fire time. Nothing is stored here: the queue holds the message until it is due. */
export async function POST(request: Request) {
  const cfg = getPushConfig();
  if (!cfg) return json({ error: "push-not-configured" }, 503);
  if (rateLimited(request)) return json({ error: "rate-limited" }, 429, { "retry-after": "600" });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid-json" }, 400);
  }
  const parsed = scheduleBodySchema.safeParse(body);
  if (!parsed.success) return json({ error: "invalid-body" }, 400);

  const now = Date.now();
  const { subscription, items } = parsed.data;
  if (items.some((i) => !fireAtInRange(i.fireAt, now))) return json({ error: "fire-time-out-of-range" }, 400);

  const client = qstashClient(cfg);
  try {
    const jobs = await Promise.all(
      items.map(async ({ reminderId, fireAt }) => {
        const res = await client.publishJSON({
          url: sendUrl(cfg),
          body: { subscription, reminderId, fireAt },
          notBefore: Math.ceil(Math.max(fireAt, now) / 1000),
          retries: 3,
        });
        return { reminderId, fireAt, messageId: res.messageId };
      }),
    );
    return json({ jobs });
  } catch {
    return json({ error: "queue-unavailable" }, 502);
  }
}
