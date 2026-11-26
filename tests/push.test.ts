import { createHash, createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("web-push", () => ({ setVapidDetails: vi.fn(), sendNotification: vi.fn() }));

import { sendNotification } from "web-push";
import { POST as cancel } from "@/app/api/push/cancel/route";
import { GET as config } from "@/app/api/push/config/route";
import { POST as schedule } from "@/app/api/push/schedule/route";
import { POST as send } from "@/app/api/push/send/route";
import { db } from "@/db/schema";
import type { QuietHours, Reminder } from "@/db/types";
import { syncReminder } from "@/features/push/client";
import { upcomingFireTimes } from "@/features/push/occurrences";
import { isAllowedPushEndpoint } from "@/features/push/schema";

const DAY = 86_400_000;
const NOW = Date.parse("2026-06-01T12:00:00Z"); // TZ=UTC
const quiet: QuietHours = { enabled: false, start: "22:00", end: "07:00" };

const reminder = (over: Partial<Reminder>): Reminder => ({
  id: "r1",
  kind: "vitamin",
  title: "Vit D",
  schedule: { type: "daily", times: ["09:00"] },
  enabled: true,
  respectQuietHours: false,
  createdAt: 0,
  updatedAt: 0,
  ...over,
});

describe("upcomingFireTimes", () => {
  it("lists daily occurrences inside the 6-day horizon", () => {
    const times = upcomingFireTimes(reminder({}), NOW, quiet);
    expect(times).toHaveLength(6);
    expect(times[0]).toBe(Date.parse("2026-06-02T09:00:00Z"));
    expect(times.every((t) => t > NOW && t <= NOW + 6 * DAY)).toBe(true);
  });

  it("includes the pending alert (e.g. a feeding or a snooze) once, without duplicates", () => {
    const next = Date.parse("2026-06-01T15:00:00Z");
    const feeding = reminder({ kind: "feeding-interval", schedule: { type: "interval", everyMin: 180 }, nextFireAt: next });
    expect(upcomingFireTimes(feeding, NOW, quiet)).toEqual([next]);
    const snoozed = reminder({ nextFireAt: Date.parse("2026-06-02T09:00:00Z") });
    expect(upcomingFireTimes(snoozed, NOW, quiet)).toHaveLength(6);
  });

  it("skips disabled, deleted, past and far-future alerts", () => {
    expect(upcomingFireTimes(reminder({ enabled: false }), NOW, quiet)).toEqual([]);
    expect(upcomingFireTimes(reminder({ deletedAt: 1 }), NOW, quiet)).toEqual([]);
    expect(upcomingFireTimes(reminder({ schedule: { type: "once", at: NOW - 1 }, nextFireAt: NOW - 1 }), NOW, quiet)).toEqual([]);
    expect(upcomingFireTimes(reminder({ schedule: { type: "once", at: NOW + 9 * DAY }, nextFireAt: NOW + 9 * DAY }), NOW, quiet)).toEqual([]);
  });

  it("applies quiet hours to recurring occurrences when requested", () => {
    const r = reminder({ schedule: { type: "daily", times: ["23:00"] }, respectQuietHours: true });
    const times = upcomingFireTimes(r, NOW, { enabled: true, start: "22:00", end: "07:00" });
    expect(times[0]).toBe(Date.parse("2026-06-02T07:00:00Z"));
  });
});

describe("push endpoint allow-list (SSRF guard)", () => {
  it("accepts the real push services", () => {
    for (const u of [
      "https://fcm.googleapis.com/fcm/send/abc",
      "https://updates.push.services.mozilla.com/wpush/v2/abc",
      "https://web.push.apple.com/abc",
      "https://wns2-par02p.notify.windows.com/w/?token=abc",
    ])
      expect(isAllowedPushEndpoint(u), u).toBe(true);
  });

  it("rejects everything else", () => {
    for (const u of [
      "http://fcm.googleapis.com/x",
      "https://evil.example.com/x",
      "https://fcm.googleapis.com.evil.com/x",
      "https://169.254.169.254/latest/meta-data",
      "https://localhost/x",
      "https://user:pw@fcm.googleapis.com/x",
      "https://fcm.googleapis.com:8443/x",
      "not a url",
    ])
      expect(isAllowedPushEndpoint(u), u).toBe(false);
  });
});

const ENV = {
  VAPID_PUBLIC_KEY: "pub",
  VAPID_PRIVATE_KEY: "priv",
  VAPID_SUBJECT: "mailto:test@example.com",
  QSTASH_TOKEN: "token",
  QSTASH_CURRENT_SIGNING_KEY: "current-key",
  QSTASH_NEXT_SIGNING_KEY: "next-key",
  PUSH_BASE_URL: "https://mybaby.test",
};

const subscription = {
  endpoint: "https://fcm.googleapis.com/fcm/send/abc",
  keys: { p256dh: "BPkey", auth: "authkey" },
};

const post = (url: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`https://mybaby.test${url}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": `10.0.0.${Math.floor(Math.random() * 250)}`, ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

function qstashSignature(body: string, url: string, key = ENV.QSTASH_CURRENT_SIGNING_KEY) {
  const b64 = (v: object | Buffer) => Buffer.from(v instanceof Buffer ? v : JSON.stringify(v)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: "HS256", typ: "JWT" });
  const payload = b64({
    iss: "Upstash",
    sub: url,
    exp: now + 300,
    nbf: now - 10,
    iat: now,
    jti: `jti-${Math.random()}`,
    body: createHash("sha256").update(body).digest("base64url"),
  });
  const sig = createHmac("sha256", key).update(`${head}.${payload}`).digest("base64url");
  return `${head}.${payload}.${sig}`;
}

describe("push API routes", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    for (const [k, v] of Object.entries(ENV)) process.env[k] = v;
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.mocked(sendNotification).mockReset();
  });
  afterEach(() => {
    for (const k of Object.keys(ENV)) delete process.env[k];
    vi.unstubAllGlobals();
  });

  it("config reports disabled without env and enabled (with only the public key) with it", async () => {
    expect(await (await config()).json()).toEqual({ enabled: true, publicKey: "pub" });
    delete process.env.QSTASH_TOKEN;
    expect(await (await config()).json()).toEqual({ enabled: false });
  });

  it("schedule is unavailable when push is not configured", async () => {
    delete process.env.VAPID_PRIVATE_KEY;
    const res = await schedule(post("/api/push/schedule", { subscription, items: [{ reminderId: "r1", fireAt: Date.now() + 60_000 }] }));
    expect(res.status).toBe(503);
  });

  it("schedule rejects bad endpoints, bad times and malformed bodies, without calling the queue", async () => {
    const good = { reminderId: "r1", fireAt: Date.now() + 60_000 };
    const cases: unknown[] = [
      { subscription: { ...subscription, endpoint: "https://evil.example.com/x" }, items: [good] },
      { subscription, items: [{ ...good, fireAt: Date.now() - 3_600_000 }] },
      { subscription, items: [{ ...good, fireAt: Date.now() + 30 * DAY }] },
      { subscription, items: [] },
      { subscription, items: Array.from({ length: 41 }, () => good) },
      { subscription, items: [{ ...good, reminderId: "../../x" }] },
      "not json",
    ];
    for (const body of cases) expect((await schedule(post("/api/push/schedule", body))).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("schedule publishes one delayed message per fire time and returns their ids", async () => {
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ messageId: `msg_${Math.random().toString(36).slice(2)}` }), { status: 200 }));
    const t1 = Date.now() + 60_000;
    const t2 = Date.now() + 120_000;
    const res = await schedule(
      post("/api/push/schedule", {
        subscription,
        items: [
          { reminderId: "r1", fireAt: t1 },
          { reminderId: "r1", fireAt: t2 },
        ],
      }),
    );
    expect(res.status).toBe(200);
    const { jobs } = await res.json();
    expect(jobs.map((j: { fireAt: number }) => j.fireAt)).toEqual([t1, t2]);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const [url, init] = fetchMock.mock.calls[0] as [string | URL | Request, RequestInit];
    expect(String(url)).toContain("/v2/publish/");
    expect(String(url)).toContain(encodeURIComponent("https://mybaby.test/api/push/send").replace(/%3A/g, ":").replace(/%2F/g, "/"));
    const headers = new Headers(init.headers);
    expect(headers.get("authorization")).toBe("Bearer token");
    expect(headers.get("upstash-not-before")).toBe(String(Math.ceil(t1 / 1000)));
    // The queued body carries ids and the push address only, no reminder text or baby data.
    expect(JSON.parse(String(init.body))).toEqual({ subscription, reminderId: "r1", fireAt: t1 });
  });

  it("cancel validates ids and forwards to the queue", async () => {
    expect((await cancel(post("/api/push/cancel", { messageIds: ["a/b"] }))).status).toBe(400);
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ cancelled: 2 }), { status: 200 }));
    expect((await cancel(post("/api/push/cancel", { messageIds: ["msg_1", "msg_2"] }))).status).toBe(200);
    expect(fetchMock).toHaveBeenCalled();
  });

  describe("send", () => {
    const sendUrl = "https://mybaby.test/api/push/send";
    const payload = JSON.stringify({ subscription, reminderId: "r1", fireAt: Date.now() });

    it("rejects unsigned, wrongly signed and wrong-url requests", async () => {
      expect((await send(post("/api/push/send", payload))).status).toBe(401);
      expect((await send(post("/api/push/send", payload, { "upstash-signature": qstashSignature(payload, sendUrl, "attacker-key") }))).status).toBe(401);
      expect((await send(post("/api/push/send", payload, { "upstash-signature": qstashSignature(payload, "https://other.test/api/push/send") }))).status).toBe(401);
      expect((await send(post("/api/push/send", payload + " ", { "upstash-signature": qstashSignature(payload, sendUrl) }))).status).toBe(401);
      expect(sendNotification).not.toHaveBeenCalled();
    });

    it("delivers a signed request with an ids-only payload", async () => {
      const res = await send(post("/api/push/send", payload, { "upstash-signature": qstashSignature(payload, sendUrl) }));
      expect(res.status).toBe(200);
      expect(sendNotification).toHaveBeenCalledTimes(1);
      const [sub, body, options] = vi.mocked(sendNotification).mock.calls[0];
      expect(sub).toEqual(subscription);
      expect(Object.keys(JSON.parse(String(body))).sort()).toEqual(["fireAt", "reminderId"]);
      expect(options).toMatchObject({ urgency: "high" });
    });

    it("accepts a signature made with the next signing key (key rotation)", async () => {
      const res = await send(post("/api/push/send", payload, { "upstash-signature": qstashSignature(payload, sendUrl, ENV.QSTASH_NEXT_SIGNING_KEY) }));
      expect(res.status).toBe(200);
    });

    it("does not retry expired subscriptions, but does retry transient push-service failures", async () => {
      const sig = () => ({ "upstash-signature": qstashSignature(payload, sendUrl) });
      vi.mocked(sendNotification).mockRejectedValueOnce(Object.assign(new Error("gone"), { statusCode: 410 }));
      expect((await send(post("/api/push/send", payload, sig()))).status).toBe(200);
      vi.mocked(sendNotification).mockRejectedValueOnce(Object.assign(new Error("busy"), { statusCode: 503 }));
      expect((await send(post("/api/push/send", payload, sig()))).status).toBe(502);
      vi.mocked(sendNotification).mockRejectedValueOnce(Object.assign(new Error("slow down"), { statusCode: 429 }));
      expect((await send(post("/api/push/send", payload, sig()))).status).toBe(502);
    });

    it("ignores signed but malformed payloads without retrying", async () => {
      const bad = JSON.stringify({ subscription: { ...subscription, endpoint: "https://evil.example.com" }, reminderId: "r1", fireAt: 1 });
      const res = await send(post("/api/push/send", bad, { "upstash-signature": qstashSignature(bad, sendUrl) }));
      expect(res.status).toBe(200);
      expect(sendNotification).not.toHaveBeenCalled();
    });
  });
});

describe("client sync (per reminder)", () => {
  const sub = (endpoint = subscription.endpoint) => ({ endpoint, toJSON: () => subscription }) as unknown as PushSubscription;
  const fetchMock = vi.fn();
  let counter = 0;

  beforeEach(async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
    fetchMock.mockReset();
    counter = 0;
    fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
      if (String(url).endsWith("/schedule")) {
        const { items } = JSON.parse(String(init.body));
        return new Response(JSON.stringify({ jobs: items.map((i: { fireAt: number }) => ({ fireAt: i.fireAt, messageId: `m${++counter}` })) }), { status: 200 });
      }
      return new Response("{}", { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  const calls = (suffix: string) => fetchMock.mock.calls.filter(([u]) => String(u).endsWith(suffix));

  it("schedules all upcoming occurrences once, then does nothing on the next sync", async () => {
    const r = reminder({});
    await db.reminders.add(r);
    await syncReminder((await db.reminders.get(r.id))!, sub(), quiet, NOW);
    expect(calls("/schedule")).toHaveLength(1);
    const stored = await db.reminders.get(r.id);
    expect(stored!.pushJobs).toHaveLength(6);
    expect(stored!.pushEndpoint).toBe(subscription.endpoint);

    fetchMock.mockClear();
    await syncReminder(stored!, sub(), quiet, NOW + 1000);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("slides the window: schedules only the newly in-range time and prunes fired jobs", async () => {
    const r = reminder({});
    await db.reminders.add(r);
    await syncReminder((await db.reminders.get(r.id))!, sub(), quiet, NOW);
    fetchMock.mockClear();

    const later = NOW + DAY; // one occurrence has fired, one new one is now inside the horizon
    await syncReminder((await db.reminders.get(r.id))!, sub(), quiet, later);
    const items = JSON.parse(String(calls("/schedule")[0][1].body)).items;
    expect(items).toHaveLength(1);
    expect(calls("/cancel")).toHaveLength(0);
    expect((await db.reminders.get(r.id))!.pushJobs).toHaveLength(6);
  });

  it("cancels queued jobs when the reminder is disabled", async () => {
    const r = reminder({});
    await db.reminders.add(r);
    await syncReminder((await db.reminders.get(r.id))!, sub(), quiet, NOW);
    fetchMock.mockClear();
    await db.reminders.update(r.id, { enabled: false });
    await syncReminder((await db.reminders.get(r.id))!, sub(), quiet, NOW + 1000);
    expect(JSON.parse(String(calls("/cancel")[0][1].body)).messageIds).toHaveLength(6);
    expect((await db.reminders.get(r.id))!.pushJobs).toBeUndefined();
  });

  it("moves a feeding alert: schedules the new time and cancels the old one", async () => {
    const first = NOW + 3 * 3_600_000;
    const r = reminder({ id: "feed", kind: "feeding-interval", schedule: { type: "interval", everyMin: 180 }, nextFireAt: first });
    await db.reminders.add(r);
    await syncReminder((await db.reminders.get("feed"))!, sub(), quiet, NOW);
    fetchMock.mockClear();

    const second = NOW + 5 * 3_600_000;
    await db.reminders.update("feed", { nextFireAt: second });
    await syncReminder((await db.reminders.get("feed"))!, sub(), quiet, NOW + 1000);
    expect(JSON.parse(String(calls("/schedule")[0][1].body)).items).toEqual([{ reminderId: "feed", fireAt: second }]);
    expect(JSON.parse(String(calls("/cancel")[0][1].body)).messageIds).toEqual(["m1"]);
    expect((await db.reminders.get("feed"))!.pushJobs).toEqual([{ at: second, id: "m2" }]);
  });

  it("reschedules everything when the browser subscription changed", async () => {
    const r = reminder({});
    await db.reminders.add(r);
    await syncReminder((await db.reminders.get(r.id))!, sub(), quiet, NOW);
    fetchMock.mockClear();
    await syncReminder((await db.reminders.get(r.id))!, sub("https://fcm.googleapis.com/fcm/send/new"), quiet, NOW + 1000);
    expect(JSON.parse(String(calls("/schedule")[0][1].body)).items).toHaveLength(6);
    expect(JSON.parse(String(calls("/cancel")[0][1].body)).messageIds).toHaveLength(6);
  });
});
