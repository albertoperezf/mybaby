import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function onboard(page: Page, name = "Ada") {
  await page.goto("/app");
  await page.getByLabel("Name").fill(name);
  await page.getByRole("checkbox", { name: "I understand" }).check();
  await page.getByRole("button", { name: "Get started" }).click();
  await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
}

test.describe("feeding log", () => {
  test("one-tap preset, undo, and the 2-tap quick-add flow", async ({ page }) => {
    await onboard(page);
    await expect(page.getByText("No feedings yet")).toBeVisible();

    await page.getByRole("button", { name: "Log 3 oz" }).click();
    await expect(page.getByText("Logged 3 oz")).toBeVisible();
    await expect(page.getByText("<1m ago")).toBeVisible();

    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByText("No feedings yet")).toBeVisible();

    // FAB -> preset = 2 taps from anywhere
    await page.getByRole("button", { name: "Quick log" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "4 oz" }).click();
    await expect(page.getByText("Logged 4 oz")).toBeVisible();

    // last-used amount is now offered as a preset
    await expect(page.getByRole("button", { name: "Log last amount, 4 oz" })).toHaveCount(0); // 4 oz is already a preset
  });

  test("custom amount in ml, backdated time, and editing from the log", async ({ page }) => {
    await onboard(page);
    await page.getByRole("button", { name: "Quick log" }).click();
    const sheet = page.getByRole("dialog");
    await sheet.getByRole("button", { name: "30 min ago" }).click();
    await sheet.getByLabel("Other amount").fill("100");
    await sheet.getByRole("radio", { name: "ml" }).click();
    await sheet.getByRole("button", { name: "Log feeding" }).click();
    await expect(page.getByText("Logged 100 ml")).toBeVisible();
    await expect(page.getByText("30m ago")).toBeVisible();

    await page.getByRole("link", { name: "Log" }).first().click();
    await expect(page.getByText("100 ml").first()).toBeVisible();
    await page.getByRole("button", { name: "Edit" }).first().click();
    await page.getByRole("dialog").getByLabel("Amount").fill("120");
    await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("120 ml").first()).toBeVisible();
  });
});

test.describe("reminders", () => {
  test("feeding reminder fires, can be snoozed and dismissed", async ({ page }) => {
    await page.clock.install({ time: new Date("2026-06-01T02:00:00") });
    await onboard(page);

    await page.getByRole("link", { name: "Reminders" }).first().click();
    await page.getByRole("switch", { name: "Next feeding reminder" }).click();
    await page.getByRole("link", { name: "Home" }).first().click();
    await page.getByRole("button", { name: "Log 3 oz" }).click();
    await expect(page.getByText(/Next feeding in/)).toBeVisible();

    await page.clock.fastForward("03:01:00");
    const alert = page.getByRole("alert").filter({ hasText: "Time to feed Ada" });
    await expect(alert).toBeVisible();

    await alert.getByRole("button", { name: "10 min" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Time to feed Ada" })).toHaveCount(0);

    await page.clock.fastForward("00:11:00");
    await expect(alert).toBeVisible();
    await alert.getByRole("button", { name: "Dismiss" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Time to feed Ada" })).toHaveCount(0);
  });

  test("custom daily reminder is saved and listed", async ({ page }) => {
    await onboard(page);
    await page.getByRole("link", { name: "Reminders" }).first().click();
    await page.getByRole("button", { name: "Add reminder" }).click();
    const sheet = page.getByRole("dialog");
    await sheet.getByRole("radio", { name: "Vitamin" }).click();
    await sheet.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Vitamin", { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/Daily · 09:00/)).toBeVisible();
  });
});

test.describe("growth", () => {
  test("add a measurement and see percentiles on the chart and history", async ({ page }) => {
    await onboard(page);
    await page.getByRole("link", { name: "Growth" }).first().click();
    await page.getByRole("button", { name: "Add measurement" }).click();
    const sheet = page.getByRole("dialog");
    await sheet.getByLabel("Weight (lb)").fill("7");
    await sheet.getByLabel("Weight (oz)").fill("7");
    await sheet.getByLabel("Length (in)").fill("19.5");
    await sheet.getByLabel("Head (in)").fill("13.5");
    await sheet.getByRole("button", { name: "Save" }).click();

    await expect(page.getByRole("img", { name: /Growth chart/ })).toBeVisible();
    await expect(page.getByText(/\d+(st|nd|rd|th) percentile/).first()).toBeVisible();
    await expect(page.getByText("7 lb 7 oz")).toBeVisible();
  });
});

test.describe("backup", () => {
  test.skip(({ isMobile }) => isMobile, "mobile uses the native share sheet");

  test("export JSON, then merge-import is idempotent and replace restores", async ({ page }) => {
    page.on("dialog", (d) => d.accept());
    await onboard(page);
    await page.getByRole("button", { name: "Log 3 oz" }).click();
    await page.getByRole("link", { name: "Settings" }).first().click();

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Export backup (JSON)" }).click(),
    ]);
    const path = await download.path();
    const { readFile } = await import("node:fs/promises");
    const text = await readFile(path, "utf8");
    const parsed = JSON.parse(text);
    expect(parsed.app).toBe("mybaby");
    expect(parsed.data.feedings).toHaveLength(1);
    await expect(page.getByText(/Last backup:/)).toBeVisible();

    const file = { name: "backup.json", mimeType: "application/json", buffer: Buffer.from(text) };
    await page.locator('input[type="file"]').setInputFiles(file);
    await expect(page.getByText(/0 added, 0 updated, \d+ unchanged/)).toBeVisible();

    await page.getByRole("radio", { name: "Replace all" }).click();
    await page.locator('input[type="file"]').setInputFiles(file);
    await expect(page.getByText(/Imported: \d+ added/)).toBeVisible();

    await page.locator('input[type="file"]').setInputFiles({ name: "bad.json", mimeType: "application/json", buffer: Buffer.from("nope") });
    await expect(page.getByText("That file isn't a valid backup.")).toBeVisible();
  });
});

test.describe("light/dark toggle", () => {
  test.use({ colorScheme: "light" });

  test("landing page toggle switches and persists", async ({ page }) => {
    await page.goto("/");
    const html = page.locator("html");
    await expect(html).toHaveAttribute("data-theme", "light");
    await page.getByRole("button", { name: "Switch to dark mode" }).click();
    await expect(html).toHaveAttribute("data-theme", "dark");
    await page.reload();
    await expect(html).toHaveAttribute("data-theme", "dark");
    await page.getByRole("button", { name: "Switch to light mode" }).click();
    await expect(html).toHaveAttribute("data-theme", "light");
  });

  test("in-app toggle persists across reloads and matches Settings", async ({ page }) => {
    await onboard(page);
    const html = page.locator("html");
    await page.getByRole("button", { name: "Switch to dark mode" }).click();
    await expect(html).toHaveAttribute("data-theme", "dark");
    await page.reload();
    await expect(page.getByRole("heading", { name: "Ada", level: 1 })).toBeVisible();
    await expect(html).toHaveAttribute("data-theme", "dark");

    await page.getByRole("link", { name: "Settings" }).first().click();
    await expect(page.getByRole("radio", { name: "Dark", exact: true })).toHaveAttribute("aria-checked", "true");

    await page.getByRole("button", { name: "Switch to light mode" }).click();
    await expect(html).toHaveAttribute("data-theme", "light");
    await expect(page.getByRole("radio", { name: "Light", exact: true })).toHaveAttribute("aria-checked", "true");
  });
});

test.describe("i18n and themes", () => {
  test("switches to Spanish", async ({ page }) => {
    await onboard(page);
    await page.getByRole("link", { name: "Settings" }).first().click();
    await page.getByRole("radio", { name: "Español" }).click();
    await expect(page.getByRole("link", { name: "Inicio" }).first()).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "es");
  });

  for (const theme of ["Light", "Dark", "Night"]) {
    test(`no WCAG A/AA violations in ${theme} theme`, async ({ page }) => {
      await onboard(page);
      await page.getByRole("button", { name: "Log 3 oz" }).click();
      await page.getByRole("link", { name: "Settings" }).first().click();
      await page.getByRole("radio", { name: theme, exact: true }).click();

      for (const link of ["Home", "Log", "Growth", "Reminders", "Settings"]) {
        await page.getByRole("link", { name: link, exact: true }).first().click();
        await page.waitForTimeout(300);
        const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
        expect(results.violations.map((v) => `${link}: ${v.id} (${v.nodes[0]?.target})`)).toEqual([]);
      }
    });
  }
});

test.describe("privacy and offline", () => {
  test("makes no requests to third-party origins", async ({ page, baseURL }) => {
    const foreign: string[] = [];
    page.on("request", (r) => {
      if (!r.url().startsWith(baseURL!) && !r.url().startsWith("data:") && !r.url().startsWith("blob:")) foreign.push(r.url());
    });
    await onboard(page);
    await page.getByRole("button", { name: "Log 3 oz" }).click();
    for (const link of ["Growth", "Reminders", "Settings"]) await page.getByRole("link", { name: link }).first().click();
    expect(foreign).toEqual([]);
  });

  test("works offline after the first visit", async ({ page, context }) => {
    await onboard(page);
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await page.reload(); // now controlled by the service worker
    await expect(page.getByRole("heading", { name: "Ada", level: 1 })).toBeVisible();

    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Ada", level: 1 })).toBeVisible();
    await page.getByRole("button", { name: "Log 2 oz" }).click();
    await expect(page.getByText("Logged 2 oz")).toBeVisible();

    await page.getByRole("link", { name: "Growth" }).first().click();
    await expect(page.getByRole("heading", { name: "Growth", level: 1 })).toBeVisible();
    await expect(page.getByRole("img", { name: /Growth chart/ })).toBeVisible();
  });
});
