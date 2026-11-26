import { describe, expect, it } from "vitest";
import { formatLength, formatVolume, formatWeight, gToLbOz, lbOzToG, mlToOz, ozToMl, toMl, volumeNumber } from "@/lib/units";

describe("units", () => {
  it("converts oz <-> ml", () => {
    expect(ozToMl(1)).toBeCloseTo(29.5735, 3);
    expect(mlToOz(ozToMl(3))).toBeCloseTo(3, 10);
  });

  it("formats volumes, snapping oz to quarters", () => {
    expect(formatVolume(ozToMl(3), "oz")).toBe("3 oz");
    expect(formatVolume(ozToMl(3.5), "oz")).toBe("3.5 oz");
    expect(formatVolume(ozToMl(3.3), "oz")).toBe("3.25 oz");
    expect(formatVolume(89.4, "ml")).toBe("89 ml");
    expect(volumeNumber(ozToMl(4), "oz")).toBe(4);
    expect(toMl(120, "ml")).toBe(120);
  });

  it("round-trips lb/oz", () => {
    const g = lbOzToG(7, 4);
    expect(g).toBe(3289);
    expect(gToLbOz(g)).toEqual({ lb: 7, oz: 4 });
  });

  it("carries 16 oz into a pound", () => {
    expect(gToLbOz(lbOzToG(7, 15.98))).toEqual({ lb: 8, oz: 0 });
  });

  it("formats weight and length per system", () => {
    expect(formatWeight(3450, "metric")).toBe("3.45 kg");
    expect(formatWeight(3289, "imperial")).toBe("7 lb 4 oz");
    expect(formatLength(500, "metric")).toBe("50 cm");
    expect(formatLength(508, "imperial")).toBe("20 in");
  });
});
