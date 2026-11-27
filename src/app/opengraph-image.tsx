import { ImageResponse } from "next/og";
import { BRAND } from "@/lib/brand";

export const alt = `${BRAND.name} - ${BRAND.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 84px",
          background: "linear-gradient(135deg, #fff8f1 0%, #ffe3cc 100%)",
          color: "#2b1d17",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div
            style={{
              width: 84,
              height: 84,
              borderRadius: 24,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "linear-gradient(135deg, #e8803f, #c2492b)",
              color: "#fff3e6",
              fontSize: 48,
              fontWeight: 800,
            }}
          >
            ☾
          </div>
          <span style={{ fontSize: 56, fontWeight: 800, letterSpacing: "-0.03em" }}>{BRAND.name}</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 940 }}>
          <div style={{ fontSize: 64, fontWeight: 800, lineHeight: 1.08, letterSpacing: "-0.03em" }}>
            {BRAND.tagline}
          </div>
          <div style={{ fontSize: 30, color: "#6e574b", lineHeight: 1.35 }}>
            Feedings, diapers, sleep &amp; breast/pump timers, WHO growth curves, and vaccine checklist.
          </div>
        </div>

        <div style={{ display: "flex", gap: 16 }}>
          {["100% On-Device", "Works Offline", "No Account · No Ads"].map((label) => (
            <div
              key={label}
              style={{
                padding: "14px 26px",
                borderRadius: 999,
                background: "#ffffff",
                border: "2px solid #e6d2bd",
                color: "#6b2e0c",
                fontSize: 24,
                fontWeight: 700,
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  );
}
