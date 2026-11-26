import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
// Locally use the installed Google Chrome (no browser download needed); CI uses Playwright's Chromium.
const channel = process.env.CI ? undefined : "chrome";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure", channel },
  // The service worker only exists in production builds, so e2e runs against `next start`.
  webServer: {
    command: `npm run build && npm run start -- -p ${PORT}`,
    url: `http://localhost:${PORT}/app`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"], channel } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 }, channel } },
  ],
});
