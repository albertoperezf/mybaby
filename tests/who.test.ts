import { describe, expect, it } from "vitest";
import data from "@/lib/who/who-lms.json";
import { ageInDays, curvePoints, lmsAt, normalCdf, percentileOf, valueAtZ, zScore, type WhoData } from "@/lib/who";

const who = data as unknown as WhoData;

describe("WHO growth standards", () => {
  it("normal CDF matches known values", () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 6);
    expect(normalCdf(1.6449)).toBeCloseTo(0.95, 3);
    expect(normalCdf(-1.8808)).toBeCloseTo(0.03, 3);
  });

  it("z and value are inverse of each other", () => {
    const lms = lmsAt(who.wfa.boys, 100)!;
    expect(zScore(valueAtZ(lms, 1.3), lms)).toBeCloseTo(1.3, 8);
  });

  it("the WHO median is the 50th percentile (boys, birth weight 3.346 kg)", () => {
    const res = percentileOf(who, "weight", "male", 0, 3346.4)!;
    expect(res.percentile).toBeCloseTo(50, 0);
  });

  it("matches the published 12-month boy weight (median 9.6 kg, +2SD 12.0 kg)", () => {
    const lms = lmsAt(who.wfa.boys, 365)!;
    expect(lms.M).toBeGreaterThan(9.5);
    expect(lms.M).toBeLessThan(9.8);
    expect(valueAtZ(lms, 2)).toBeGreaterThan(11.8);
    expect(valueAtZ(lms, 2)).toBeLessThan(12.2);
  });

  it("orders girls vs boys sensibly at birth (girls lighter)", () => {
    expect(lmsAt(who.wfa.girls, 0)!.M).toBeLessThan(lmsAt(who.wfa.boys, 0)!.M);
  });

  it("interpolates between weekly rows and rejects out-of-range ages", () => {
    const a = lmsAt(who.lhfa.girls, 7)!.M;
    const b = lmsAt(who.lhfa.girls, 14)!.M;
    const mid = lmsAt(who.lhfa.girls, 10.5)!.M;
    expect(mid).toBeGreaterThan(a);
    expect(mid).toBeLessThan(b);
    expect(lmsAt(who.lhfa.girls, 2000)).toBeNull();
    expect(percentileOf(who, "head", "female", 2000, 500)).toBeNull();
  });

  it("curves are monotonic across percentiles and cover the requested range", () => {
    const p3 = curvePoints(who, "length", "male", -1.8808, 365);
    const p97 = curvePoints(who, "length", "male", 1.8808, 365);
    expect(p3.length).toBe(p97.length);
    expect(p3[p3.length - 1].days).toBeLessThanOrEqual(365);
    p3.forEach((p, i) => expect(p97[i].value).toBeGreaterThan(p.value));
  });

  it("corrected age for preterm babies", () => {
    // Born at 32 weeks (8 weeks early = 56 days). 100 days after birth -> 44 days corrected.
    expect(ageInDays("2026-01-01", "2026-04-11", 32, true)).toBe(100 - 56);
    expect(ageInDays("2026-01-01", "2026-04-11", 32, false)).toBe(100);
    expect(ageInDays("2026-01-01", "2026-04-11", 39, true)).toBe(100);
  });
});
