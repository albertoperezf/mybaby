import type { DoctorVisit, VisitQuestion } from "@/db/types";

export function splitVisits(visits: DoctorVisit[], todayIso: string): {
  upcoming: DoctorVisit[];
  past: DoctorVisit[];
} {
  const upcoming: DoctorVisit[] = [];
  const past: DoctorVisit[] = [];
  for (const v of visits) {
    if (v.visitedOn >= todayIso) upcoming.push(v);
    else past.push(v);
  }
  // Upcoming: soonest first. Past: most recent first.
  upcoming.sort((a, b) => a.visitedOn.localeCompare(b.visitedOn) || a.createdAt - b.createdAt);
  past.sort((a, b) => b.visitedOn.localeCompare(a.visitedOn) || b.createdAt - a.createdAt);
  return { upcoming, past };
}

export function lastProvider(visits: DoctorVisit[]): string {
  const sorted = [...visits].sort((a, b) => b.visitedOn.localeCompare(a.visitedOn) || b.updatedAt - a.updatedAt);
  return sorted.find((v) => v.provider?.trim())?.provider?.trim() ?? "";
}

export function questionProgress(questions: VisitQuestion[]): { done: number; total: number } {
  const total = questions.length;
  const done = questions.filter((q) => q.done).length;
  return { done, total };
}

/** Computes a local 9:00 AM timestamp the day before `isoDate` (YYYY-MM-DD), or null if already in the past. */
export function dayBeforeMorningAt(isoDate: string, now = Date.now()): number | null {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return null;
  const dt = new Date(y, m - 1, d - 1, 9, 0, 0, 0);
  const ts = dt.getTime();
  return ts > now ? ts : null;
}
