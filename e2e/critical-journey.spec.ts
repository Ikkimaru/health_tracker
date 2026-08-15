import { expect, test } from "@playwright/test";

test("creates an exercise and routine and keeps them after reload", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Exercises" }).click();
  await page.getByLabel("Name").fill("Push-ups");
  await page.getByRole("button", { name: "Add exercise" }).click();
  await expect(page.getByRole("heading", { name: "Push-ups" })).toBeVisible();
  await page.getByRole("button", { name: "Routines" }).click();
  await page.getByLabel("Routine name").fill("Daily quest");
  await page.getByLabel("Push-ups").check();
  await page
    .getByText(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date().getDay()]!, {
      exact: true
    })
    .click();
  await page.getByRole("button", { name: "Create routine" }).click();
  await expect(page.getByRole("heading", { name: "Daily quest" })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Today" }).click();
  await expect(page.getByRole("heading", { name: "Push-ups" })).toBeVisible();
  await page.getByText("Set 1: 10 reps").click();
  await page.getByText("Set 2: 10 reps").click();
  await page.getByText("Set 3: 10 reps").click();
  await expect(page.getByText("Quest complete!")).toBeVisible();
});

test("previews a custom palette and applies it only after saving", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Settings" }).click();
  const background = page.getByLabel("Page background color");
  await background.fill("#332244");
  await expect(page.getByRole("radio", { name: /Custom/ })).toBeChecked();
  await expect(page.locator("#theme-preview")).toHaveCSS("background-color", "rgb(51, 34, 68)");
  await expect(page.locator("html")).not.toHaveCSS("background-color", "rgb(51, 34, 68)");
  await page.getByRole("button", { name: "Save theme" }).click();
  const snackbar = page.locator(".snackbar");
  await expect(snackbar).toContainText("Theme saved");
  await expect(snackbar).toBeInViewport();
  await page.reload();
  await expect(page.locator("html")).toHaveCSS("background-color", "rgb(51, 34, 68)");
});

test("keeps backup confirmation visible in a snackbar", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Settings" }).click();
  const backupPanel = page
    .getByRole("heading", { name: "Encrypted backup", exact: true })
    .locator("..");
  const transferPanel = page
    .getByRole("heading", { name: "Local transfer", exact: true })
    .locator("..");
  const backupBox = await backupPanel.boundingBox();
  const transferBox = await transferPanel.boundingBox();
  expect(transferBox!.y - (backupBox!.y + backupBox!.height)).toBeGreaterThan(0);
  await page.getByLabel("Backup password").fill("correct horse battery staple");
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export backup" }).click();
  await download;

  const snackbar = page.locator(".snackbar");
  await expect(snackbar).toHaveText("Encrypted backup created.");
  await expect(snackbar).toBeInViewport();
  await expect(snackbar).toBeHidden({ timeout: 6_000 });
});

test("adds and edits weight from the calendar and changes the week start", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Weight", exact: true }).click();
  const date = page.locator("[data-weight-date]:not([disabled])").last();
  await date.click();
  await expect(page.locator("html")).toHaveClass(/modal-open/);
  await page.getByLabel("Weight (kg)").fill("81.25");
  await page.getByRole("button", { name: "Save weight" }).click();
  await expect(page.locator("html")).not.toHaveClass(/modal-open/);
  await expect(page.getByText("81.25 kg")).toBeVisible();

  await page.getByText("81.25 kg").click();
  await expect(page.getByLabel("Weight (kg)")).toHaveValue("81.25");
  await page.getByLabel("Weight (kg)").fill("80.75");
  await page.getByRole("button", { name: "Save weight" }).click();
  await expect(page.getByText("80.75 kg")).toBeVisible();

  await page.locator("[data-weight-date]:not([disabled])").nth(-2).click();
  await page.getByLabel("Weight (kg)").fill("81.5");
  await page.getByRole("button", { name: "Save weight" }).click();
  await expect(page.locator(".weight-value-label")).toHaveCount(2);
  const points = page.locator("[data-chart-point]");
  await points.first().locator("circle").click();
  await expect(points.first()).toHaveClass(/selected/);
  await points.last().locator("circle").click();
  await expect(points.first()).not.toHaveClass(/selected/);
  await expect(points.last()).toHaveClass(/selected/);

  await page.locator("[data-weight-date].has-weight").first().click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete record" }).click();
  await expect(page.locator("[data-weight-date].has-weight")).toHaveCount(1);

  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByLabel("Start of week").selectOption("sunday");
  await page.getByRole("button", { name: "Save calendar settings" }).click();
  await page.getByRole("button", { name: "Weight", exact: true }).click();
  await expect(page.locator(".calendar-head b").first()).toHaveText("S");
  const currentMonth = await page.locator(".calendar-month-nav h3").textContent();
  await page.getByRole("button", { name: "Previous month" }).click();
  await expect(page.locator(".calendar-month-nav h3")).not.toHaveText(currentMonth!);
  await page.getByRole("button", { name: "Next month" }).click();
  await expect(page.locator(".calendar-month-nav h3")).toHaveText(currentMonth!);
  await expect(page.getByRole("button", { name: "Next month" })).toBeDisabled();
  await page.getByRole("button", { name: "1 month" }).click();
  await expect(page.getByRole("button", { name: "Monthly" })).toBeDisabled();
  await page.getByRole("button", { name: "3 months" }).click();
  await expect(page.getByRole("button", { name: "Monthly" })).toBeEnabled();
});
