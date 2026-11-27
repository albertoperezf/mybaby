import { cancelBodySchema } from "@/features/push/schema";
import { getPushConfig, json, qstashClient, rateLimited } from "@/server/push";

export const dynamic = "force-dynamic";

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
  const parsed = cancelBodySchema.safeParse(body);
  if (!parsed.success) return json({ error: "invalid-body" }, 400);

  try {
    // Already-delivered ids are fine to cancel; failures are not worth retrying from the client.
    await qstashClient(cfg).messages.cancel(parsed.data.messageIds);
  } catch {
    return json({ error: "queue-unavailable" }, 502);
  }
  return json({ ok: true });
}
