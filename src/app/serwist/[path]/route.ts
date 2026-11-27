import { createSerwistRoute } from "@serwist/turbopack";

// Pages precached so the app shell opens offline right after the first visit.
// (/~offline is added automatically because the service worker declares it as a fallback;
// everything in public/, including the UI font, is precached by default.)
const APP_ROUTES = ["/app", "/app/log", "/app/growth", "/app/vaccines", "/app/medications", "/app/reminders", "/app/settings"];

const revision = process.env.VERCEL_GIT_COMMIT_SHA ?? crypto.randomUUID();

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } = createSerwistRoute({
  additionalPrecacheEntries: APP_ROUTES.map((url) => ({ url, revision })),
  // Splash screens are only fetched by iOS at install time; don't make every user download them.
  globIgnores: ["**/icons/splash*", "**/icons/icon-maskable-512.png"],
  swSrc: "src/app/sw.ts",
  useNativeEsbuild: true,
});
