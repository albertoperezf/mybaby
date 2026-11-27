"use client";

import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { stripUrlQuery } from "@/lib/telemetry";

/** Loads Vercel Analytics and Speed Insights from /_vercel with query strings stripped before send. */
export function Telemetry() {
  return (
    <>
      <Analytics beforeSend={(event) => ({ ...event, url: stripUrlQuery(event.url) })} />
      <SpeedInsights beforeSend={(event) => ({ ...event, url: stripUrlQuery(event.url) })} />
    </>
  );
}
