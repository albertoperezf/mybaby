import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/app",
    name: BRAND.name,
    short_name: BRAND.name,
    description: BRAND.description,
    start_url: "/app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: BRAND.darkBg,
    theme_color: BRAND.themeColor,
    categories: ["health", "lifestyle"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Long-press the home-screen icon for one-tap logging; also usable from Siri Shortcuts via URL.
    shortcuts: [
      { name: "Log feeding", url: "/app?quick=feed", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Log diaper", url: "/app?quick=diaper", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
