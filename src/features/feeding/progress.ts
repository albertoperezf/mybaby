export type FeedState = "fresh" | "soon" | "due" | "overdue";

/** How far through the usual feeding interval we are: 0 = just fed, 1 = due now, above 1 = overdue. */
export function feedRatio(elapsedMs: number, intervalMin: number): number {
  return Math.max(0, elapsedMs) / (intervalMin * 60_000);
}

export function feedState(ratio: number): FeedState {
  if (ratio < 0.8) return "fresh";
  if (ratio < 1) return "soon";
  if (ratio < 1.15) return "due";
  return "overdue";
}

export type DayPart = "morning" | "afternoon" | "evening" | "night";

export function dayPart(hour: number): DayPart {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 22) return "evening";
  return "night";
}
