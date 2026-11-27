import { describe, expect, it } from "vitest";
import { stripUrlQuery, trackFeature } from "@/lib/telemetry";

describe("telemetry helpers", () => {
  it("strips query parameters and hash fragments from URLs", () => {
    expect(stripUrlQuery("https://mybaby.example/app?quick=feed&foo=bar#top")).toBe("https://mybaby.example/app");
    expect(stripUrlQuery("https://mybaby.example/app/vaccines")).toBe("https://mybaby.example/app/vaccines");
    expect(stripUrlQuery("/app?quick=sleep#section")).toBe("/app");
  });

  it("does not throw when called outside a browser", () => {
    expect(() => trackFeature("sleep_timer")).not.toThrow();
  });
});
