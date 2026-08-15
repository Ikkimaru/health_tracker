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
