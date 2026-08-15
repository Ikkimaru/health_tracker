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
