import { getPushConfig, json } from "@/server/push";

export const dynamic = "force-dynamic";

/** Tells the client whether this deployment has push configured, and the public VAPID key. */
export async function GET() {
  const cfg = getPushConfig();
  return json(cfg ? { enabled: true, publicKey: cfg.vapidPublicKey } : { enabled: false });
}
