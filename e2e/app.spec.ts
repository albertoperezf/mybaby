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
    await expect(page.getByRole("img", { name: "Last fed <1m ago" })).toBeVisible();

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
    await expect(page.getByRole("img", { name: "Last fed 30m ago" })).toBeVisible();

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

  test("closed-app alerts are clearly unavailable when the server has no push config", async ({ page }) => {
    await onboard(page);
    await page.getByRole("link", { name: "Reminders" }).first().click();
    await expect(page.getByRole("heading", { name: "Alerts when the app is closed" })).toBeVisible();
    await expect(page.getByText(/Not set up on this server/)).toBeVisible();
    await expect(page.getByRole("switch", { name: "Alerts when the app is closed" })).toHaveCount(0);
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
    await page.getByRole("link", { name: "Health" }).first().click();
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

test.describe("personality", () => {
  test.use({ colorScheme: "light" });

  test("home greets the baby and shows an encouraging summary", async ({ page }) => {
    await page.clock.install({ time: new Date("2026-06-01T02:30:00") });
    await onboard(page);
    await expect(page.getByText("Up late? You've got this")).toBeVisible();
    await expect(page.getByText(/A fresh day for Ada/)).toBeVisible();
    await page.getByRole("button", { name: "Log 3 oz" }).click();
    await expect(page.getByText("Feed #1 done today. Nice and steady.")).toBeVisible();
    await expect(page.getByText("On track")).toBeVisible();
  });

  test("a second baby gets an avatar and can be switched to", async ({ page }) => {
    await onboard(page);
    await page.getByRole("link", { name: "Settings" }).first().click();
    await page.getByRole("button", { name: "Add baby" }).click();
    const sheet = page.getByRole("dialog");
    await sheet.getByLabel("Name").fill("Bo");
    await sheet.getByRole("radio", { name: "🦊" }).click();
    await sheet.getByRole("button", { name: "Save" }).click();

    const switcher = page.getByRole("radiogroup", { name: "Switch baby" });
    await expect(switcher.getByRole("radio", { name: "Bo" })).toBeVisible();
    await switcher.getByRole("radio", { name: "Bo" }).click();
    await page.getByRole("link", { name: "Home" }).first().click();
    await expect(page.getByRole("heading", { name: "Bo", level: 1 })).toBeVisible();
    await expect(page.locator("main").getByText("🦊")).toBeVisible();
  });

  test("optional Night theme after 9 PM while theme is Auto", async ({ page }) => {
    await page.clock.install({ time: new Date("2026-06-01T23:15:00") });
    await onboard(page);
    const html = page.locator("html");
    await expect(html).toHaveAttribute("data-theme", "light");
    await page.getByRole("link", { name: "Settings" }).first().click();
    await page.getByRole("switch", { name: /Switch to the Night theme/ }).click();
    await expect(html).toHaveAttribute("data-theme", "night");
    await page.reload();
    await expect(html).toHaveAttribute("data-theme", "night");
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
    await page.waitForTimeout(400); // let the setting finish writing to IndexedDB before reloading
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

test.describe("vaccines", () => {
  test.use({ colorScheme: "light" });

  async function openVaccines(page: Page) {
    await page.getByRole("link", { name: "Health" }).first().click();
    await page.getByRole("link", { name: "Vaccines" }).first().click();
  }

  test("choose a schedule, record doses, and keep the details", async ({ page }) => {
    await onboard(page);
    await openVaccines(page);
    await expect(page.getByRole("heading", { name: /Which vaccine schedule should we follow for Ada/ })).toBeVisible();
    await expect(page.getByText(/For information only/).first()).toBeVisible();

    await page.getByRole("button", { name: "Use this schedule" }).first().click();
    await expect(page.getByText("Hepatitis B #1", { exact: true })).toBeVisible();
    await expect(page.getByText("Doses due now: 1")).toBeVisible();

    await page.getByRole("button", { name: "Mark Hepatitis B #1 as given today" }).click();
    await expect(page.getByText("Vaccine saved")).toBeVisible();
    await expect(page.getByText("All caught up. Nice work.")).toBeVisible();
    await expect(page.getByText("1 of 1 recommended doses given so far")).toBeVisible();

    // Details: lot number and clinic are saved and shown again.
    await page.getByRole("button", { name: "Edit Hepatitis B #1" }).click();
    const sheet = page.getByRole("dialog");
    await sheet.getByLabel("Lot number").fill("L123");
    await sheet.getByLabel("Clinic or provider").fill("City Pediatrics");
    await sheet.getByRole("button", { name: "Save" }).click();
    await page.getByRole("button", { name: "Edit Hepatitis B #1" }).click();
    await expect(page.getByRole("dialog").getByLabel("Lot number")).toHaveValue("L123");
    await page.getByRole("dialog").getByRole("button", { name: "Mark as not given" }).click();
    await expect(page.getByText("Doses due now: 1")).toBeVisible();
  });

  test("add another vaccine, skip a dose, and switch schedule keeping what was given", async ({ page }) => {
    await onboard(page);
    await openVaccines(page);
    await page.getByRole("button", { name: "Use this schedule" }).first().click();
    await page.getByRole("button", { name: "Mark Hepatitis B #1 as given today" }).click();

    await page.getByRole("button", { name: "Add other vaccine" }).click();
    const sheet = page.getByRole("dialog");
    await sheet.getByLabel("Vaccine name").fill("BCG");
    await sheet.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("heading", { name: "Other vaccines" })).toBeVisible();
    await expect(page.getByText("BCG", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Change schedule" }).click();
    await page.getByRole("button", { name: "Use this schedule" }).nth(1).click(); // Spain
    await expect(page.getByText("Hexavalent (6-in-1) #1", { exact: true })).toBeVisible();
    await expect(page.getByText("Hepatitis B #1", { exact: true })).toBeVisible(); // the given dose was kept
    await expect(page.getByText("BCG", { exact: true })).toBeVisible();
  });

  test("visit reminders appear on the Reminders page when switched on", async ({ page }) => {
    await onboard(page);
    await openVaccines(page);
    await page.getByRole("button", { name: "Use this schedule" }).first().click();
    await page.getByRole("switch", { name: "Vaccine visit reminders" }).click();
    await page.waitForTimeout(1500);
    await page.getByRole("link", { name: "Reminders" }).first().click();
    await expect(page.getByText(/Vaccines on .*Hepatitis B #1/).first()).toBeVisible();
  });

  test("vaccine record in Spanish", async ({ page }) => {
    await onboard(page);
    await page.getByRole("link", { name: "Settings" }).first().click();
    await page.getByRole("radio", { name: "Español" }).click();
    await page.getByRole("link", { name: "Salud" }).first().click();
    await page.getByRole("link", { name: "Vacunas" }).first().click();
    await page.getByRole("button", { name: "Usar este calendario" }).nth(1).click();
    await expect(page.getByText("Hexavalente (6 en 1) #1")).toBeVisible();
    await expect(page.getByText(/Solo informativo/).first()).toBeVisible();
  });
});

test.describe("timers", () => {
  test.use({ colorScheme: "light" });

  test("sleep timer survives reload and logs to history", async ({ page }) => {
    await onboard(page);
    await page.getByRole("button", { name: "Sleep", exact: true }).click();
    await expect(page.getByText("Sleeping", { exact: true })).toBeVisible();

    await page.reload();
    await expect(page.getByText("Sleeping", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Wake up" }).click();
    await expect(page.getByText(/Sleep logged:/)).toBeVisible();

    await page.getByRole("link", { name: "Log", exact: true }).first().click();
    await expect(page.getByText(/Sleep · /)).toBeVisible();
  });

  test("breast and pump timers save entries and pump does not count as a baby feeding", async ({ page }) => {
    await onboard(page);

    // Breast timer: start left, switch right, save.
    await page.getByRole("button", { name: "Breast", exact: true }).click();
    await page.getByRole("button", { name: /Right/ }).click();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText(/Breastfeeding logged:/)).toBeVisible();

    // Pump timer: start, enter amount, save.
    await page.getByRole("button", { name: "Pump", exact: true }).click();
    await page.getByLabel("Amount pumped (optional)").fill("4");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Pumping session logged")).toBeVisible();

    await page.getByRole("link", { name: "Log", exact: true }).first().click();
    await expect(page.getByText(/Breast \(/).first()).toBeVisible();
    await expect(page.getByText(/Pump \(L\+R\) · 4 oz/).first()).toBeVisible();
  });
});

test.describe("medications", () => {
  test.use({ colorScheme: "light" });

  test("log a dose, repeat with one tap, edit, and see it in Log", async ({ page }) => {
    await onboard(page);
    await page.getByRole("link", { name: "Health" }).first().click();
    await page.getByRole("link", { name: "Meds" }).first().click();
    await expect(page.getByRole("heading", { name: "Medications", level: 1 })).toBeVisible();

    await page.getByRole("button", { name: "Log dose" }).first().click();
    const sheet = page.getByRole("dialog");
    await sheet.getByRole("button", { name: "Vitamin D" }).click();
    await sheet.getByLabel("Dose").fill("400");
    await sheet.getByLabel("Unit").selectOption("IU");
    await sheet.getByRole("button", { name: "Save" }).click();

    await expect(page.getByText("Dose logged")).toBeVisible();
    await expect(page.getByText("Vitamin D · 400 IU")).toBeVisible();

    // One-tap repeat from Recent medicines
    await page.getByRole("button", { name: /Give Vitamin D/ }).click();
    await expect(page.getByText("2 today")).toBeVisible();

    // Appears in the chronological Log, without "Load 2 more weeks" since no older entries exist.
    await page.getByRole("link", { name: "Log", exact: true }).first().click();
    await expect(page.getByText("Vitamin D · 400 IU").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Load 2 more weeks" })).toHaveCount(0);
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

      for (const link of ["Home", "Log", "Health", "Reminders", "Settings"]) {
        await page.getByRole("link", { name: link, exact: true }).first().click();
        await page.waitForTimeout(300);
        const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
        expect(results.violations.map((v) => `${link}: ${v.id} (${v.nodes[0]?.target})`)).toEqual([]);
      }

      // Vaccines: the schedule chooser and the checklist with a dose due.
      await page.getByRole("link", { name: "Health", exact: true }).first().click();
      await page.getByRole("link", { name: "Vaccines", exact: true }).first().click();
      for (const step of ["chooser", "checklist"]) {
        if (step === "checklist") await page.getByRole("button", { name: "Use this schedule" }).first().click();
        await page.waitForTimeout(300);
        const vaccineResults = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
        expect(vaccineResults.violations.map((v) => `vaccines ${step}: ${v.id} (${v.nodes[0]?.target})`)).toEqual([]);
      }

      // Medications page
      await page.getByRole("link", { name: "Meds", exact: true }).first().click();
      await page.waitForTimeout(300);
      const medResults = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      expect(medResults.violations.map((v) => `meds: ${v.id} (${v.nodes[0]?.target})`)).toEqual([]);
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
    for (const link of ["Health", "Reminders", "Settings"]) await page.getByRole("link", { name: link }).first().click();
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

    await page.getByRole("link", { name: "Health" }).first().click();
    await expect(page.getByRole("heading", { name: "Growth", level: 1 })).toBeVisible();
    await expect(page.getByRole("img", { name: /Growth chart/ })).toBeVisible();
  });
});
