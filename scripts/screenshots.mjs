// Visual smoke check: screenshots of the main screens (not part of the test suite).
import { chromium, devices } from "@playwright/test";

const base = "http://localhost:3100";
const browser = await chromium.launch({ channel: "chrome" });

async function run(name, contextOpts, theme) {
  const ctx = await browser.newContext(contextOpts);
  const page = await ctx.newPage();
  await page.goto(base + "/app");
  await page.getByLabel("Name").fill("Ada");
  await page.getByLabel("Birth date").fill("2026-09-20");
  await page.getByRole("radio", { name: "Girl" }).click();
  await page.getByRole("checkbox", { name: "I understand" }).check();
  await page.screenshot({ path: `/tmp/shots/${name}-onboarding.png`, fullPage: true });
  await page.getByRole("button", { name: "Get started" }).click();
  await page.getByRole("button", { name: "Log 3 oz" }).click();
  await page.getByRole("button", { name: "Wet" }).click();
  await page.getByRole("link", { name: "Reminders" }).first().click();
  await page.getByRole("switch", { name: "Next feeding reminder" }).click();
  await page.getByRole("link", { name: "Growth" }).first().click();
  await page.getByRole("button", { name: "Add measurement" }).click();
  await page.getByLabel("Weight (lb)").fill("9");
  await page.getByLabel("Weight (oz)").fill("4");
  await page.getByLabel("Length (in)").fill("22");
  await page.getByLabel("Head (in)").fill("15");
  await page.getByRole("button", { name: "Save" }).click();
  if (theme) {
    await page.getByRole("link", { name: "Settings" }).first().click();
    await page.getByRole("radio", { name: theme, exact: true }).click();
  }
  for (const [link, file] of [["Home", "home"], ["Log", "log"], ["Growth", "growth"], ["Reminders", "reminders"], ["Settings", "settings"]]) {
    await page.getByRole("link", { name: link, exact: true }).first().click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `/tmp/shots/${name}-${file}.png`, fullPage: false });
  }
  await page.getByRole("link", { name: "Home", exact: true }).first().click();
  await page.getByRole("button", { name: "Quick log" }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `/tmp/shots/${name}-sheet.png` });
  await ctx.close();
}

await run("m-light", { ...devices["Pixel 7"] });
await run("m-night", { ...devices["Pixel 7"] }, "Night");
await run("d-dark", { viewport: { width: 1280, height: 800 } }, "Dark");
await browser.close();
