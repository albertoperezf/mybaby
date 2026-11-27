import type { Metadata, Viewport } from "next";
import { SerwistProvider } from "@serwist/turbopack/react";
import type { ReactNode } from "react";
import splash from "../../public/icons/splash.json";
import { Telemetry } from "@/components/telemetry";
import { BRAND } from "@/lib/brand";
import "./globals.css";

const siteOrigin = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin),
  applicationName: BRAND.name,
  title: { default: `${BRAND.name} - ${BRAND.tagline}`, template: `%s - ${BRAND.name}` },
  description: BRAND.description,
  openGraph: {
    type: "website",
    siteName: BRAND.name,
    title: `${BRAND.name} - ${BRAND.tagline}`,
    description: BRAND.description,
  },
  twitter: {
    card: "summary_large_image",
    title: `${BRAND.name} - ${BRAND.tagline}`,
    description: BRAND.description,
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: BRAND.name,
    statusBarStyle: "default",
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
    { media: "(prefers-color-scheme: light)", color: "#fff8f1" },
    { media: "(prefers-color-scheme: dark)", color: BRAND.darkBg },
  ],
};

// Runs before first paint so the saved theme never flashes the wrong colours.
const themeScript = `(function(){try{var t=localStorage.getItem('theme')||'system';var d=t==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):t;var h=new Date().getHours();if(t==='system'&&localStorage.getItem('nightAuto')==='1'&&(h>=21||h<6))d='night';document.documentElement.dataset.theme=d;var c={light:'#fff8f1',dark:'#14121f',night:'#000000'}[d];document.querySelectorAll('meta[name="theme-color"]').forEach(function(m){m.setAttribute('content',c)});}catch(e){}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preload" href="/fonts/nunito-latin-wght.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
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
        {/* Both load from this site's own /_vercel path, so the CSP stays 'self'. */}
        <Telemetry />
      </body>
    </html>
  );
}
