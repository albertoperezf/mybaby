import { describe, expect, it } from "vitest";
import { dayPart, feedRatio, feedState } from "@/features/feeding/progress";

const MIN = 60_000;

describe("feed progress", () => {
  it("is the fraction of the interval elapsed, never negative", () => {
    expect(feedRatio(90 * MIN, 180)).toBe(0.5);
    expect(feedRatio(-5 * MIN, 180)).toBe(0);
    expect(feedRatio(270 * MIN, 180)).toBe(1.5);
  });

  it("moves through fresh, soon, due and overdue", () => {
    expect(feedState(0)).toBe("fresh");
    expect(feedState(0.79)).toBe("fresh");
    expect(feedState(0.8)).toBe("soon");
    expect(feedState(0.99)).toBe("soon");
    expect(feedState(1)).toBe("due");
    expect(feedState(1.14)).toBe("due");
    expect(feedState(1.15)).toBe("overdue");
  });
});

describe("day part", () => {
  it("maps hours to a greeting, with late night wrapping past midnight", () => {
    expect(dayPart(5)).toBe("morning");
    expect(dayPart(11)).toBe("morning");
    expect(dayPart(12)).toBe("afternoon");
    expect(dayPart(17)).toBe("evening");
    expect(dayPart(21)).toBe("evening");
    expect(dayPart(22)).toBe("night");
    expect(dayPart(3)).toBe("night");
  });
});
