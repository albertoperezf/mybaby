import { track } from "@vercel/analytics";

/** Coarse, privacy-safe feature milestones — never attach baby names, amounts, dates, or notes. */
export type FeatureEvent =
  | "onboarding_complete"
  | "vaccine_schedule"
  | "sleep_timer"
  | "breast_timer"
  | "pump_timer"
  | "growth_logged"
  | "backup_export"
  | "backup_import"
  | "push_enabled";

/** Strips query parameters and hash fragments so deep-link params (e.g. ?quick=feed) are never reported. */
export function stripUrlQuery(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return rawUrl.split(/[?#]/)[0] ?? rawUrl;
  }
}

export function trackFeature(feature: FeatureEvent): void {
  if (typeof window === "undefined") return;
  try {
    track("feature_used", { feature });
  } catch {
    // Ignore if analytics is unavailable or blocked.
  }
}
