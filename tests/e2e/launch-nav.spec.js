import { test, expect } from "@playwright/test";

const viewports = [
  { width: 390, height: 844 },
  { width: 1280, height: 800 },
];

async function openLanding(page, viewport) {
  await page.setViewportSize(viewport);
  await page.goto("/");
  await expect(page.locator("#landing-job-hint")).toBeVisible();
}

for (const viewport of viewports) {
  test(`landing All players opens the list and Back returns at ${viewport.width}`, async ({ page }) => {
    await openLanding(page, viewport);
    await page.locator("a[data-launch='players']").click();
    await expect(page).toHaveURL(/\/players$/);
    await expect(page.locator("#ranks-section")).toBeVisible();
    await expect(page.locator("[data-action='rank-open']").first()).toBeVisible({ timeout: 20000 });
    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator("#landing-job-hint")).toBeVisible();
    await expect(page.locator("#ranks-section")).toBeHidden();
  });

  test(`landing Players tab opens the list and Back returns at ${viewport.width}`, async ({ page }) => {
    await openLanding(page, viewport);
    await page.waitForFunction(() => document.querySelectorAll("[data-action='rank-open']").length > 0);
    await page.locator("#players-tab").evaluate((el) => el.click());
    await expect(page).toHaveURL(/\/players$/);
    await expect(page.locator("#ranks-section")).toBeVisible();
    await expect(page.locator("[data-action='rank-open']").first()).toBeVisible({ timeout: 20000 });
    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator("#landing-job-hint")).toBeVisible();
  });

  test(`Back from a Hot on Sleeper player returns to the landing at ${viewport.width}`, async ({ page }) => {
    await openLanding(page, viewport);
    const row = page.locator("#launch-trend a.launch-row").first();
    await expect(row).toBeVisible({ timeout: 20000 });
    await row.scrollIntoViewIfNeeded();
    await row.click();
    await expect(page).toHaveURL(/\/player\/\d+/);
    await expect(page.locator(".ranks-card")).toBeVisible({ timeout: 20000 });
    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator("#landing-job-hint")).toBeVisible();
    await expect(page.locator("#launch-trend")).toBeVisible();
  });
}
