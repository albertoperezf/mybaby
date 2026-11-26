import type { Metadata, Viewport } from "next";
import { SerwistProvider } from "@serwist/turbopack/react";
import type { ReactNode } from "react";
import splash from "../../public/icons/splash.json";
import { BRAND } from "@/lib/brand";
import "./globals.css";

export const metadata: Metadata = {
  applicationName: BRAND.name,
  title: { default: `${BRAND.name} - ${BRAND.tagline}`, template: `%s - ${BRAND.name}` },
  description: BRAND.description,
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: BRAND.name,
    statusBarStyle: "black-translucent",
    startupImage: splash.map(({ file, cw, ch, dpr }) => ({
      url: file,
      media: `(device-width: ${cw}px) and (device-height: ${ch}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: portrait)`,
    })),
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf9f7" },
    { media: "(prefers-color-scheme: dark)", color: BRAND.darkBg },
  ],
};

// Runs before first paint so the saved theme never flashes the wrong colours.
const themeScript = `(function(){try{var t=localStorage.getItem('theme')||'system';var d=t==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):t;document.documentElement.dataset.theme=d;}catch(e){}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <SerwistProvider
          swUrl="/serwist/sw.js"
          disable={process.env.NODE_ENV === "development"}
          cacheOnNavigation
          reloadOnOnline={false}
        >
          {children}
        </SerwistProvider>
      </body>
    </html>
  );
}
