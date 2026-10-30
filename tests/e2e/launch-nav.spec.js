import { test, expect } from "@playwright/test";

const viewports = [
  { width: 390, height: 844 },
  { width: 1280, height: 800 },
  { width: 1024, height: 1366 },
];

async function openLanding(page, viewport) {
  await page.setViewportSize(viewport);
  await page.goto("/");
  await expect(page.locator("#landing-job-hint")).toBeVisible();
}

for (const viewport of viewports) {
  test(`landing Explore players opens the board under the calculator and Back returns at ${viewport.width}`, async ({ page }) => {
    await openLanding(page, viewport);
    await page.locator(".launch-action[data-launch='players']").click();
    await expect(page).toHaveURL(/\/trade$/);
    await expect(page.locator("#calculator-shell")).toBeVisible();
    await expect(page.locator("#ranks-section")).toBeVisible();
    await expect(page.locator("[data-action='rank-open']").first()).toBeVisible({ timeout: 20000 });
    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator("#landing-job-hint")).toBeVisible();
    await expect(page.locator("#ranks-section")).toBeHidden();
  });

  test(`home offers a blank trade and league connection at ${viewport.width}`, async ({ page }) => {
    await openLanding(page, viewport);
    await expect(page.locator("#launch-example")).toHaveCount(0);
    const nav = page.getByRole("navigation", { name: "Main navigation" });
    await expect(nav.getByRole("link", { name: "My team", exact: true })).toBeInViewport();
    await nav.getByRole("link", { name: "Check a trade", exact: true }).click();
    await expect(page).toHaveURL(/\/trade$/);
    await expect(page.locator("#calculator-shell")).toBeVisible();
    await expect(page.locator("#calculator-shell")).not.toContainText("Bijan Robinson");
    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
    await expect(nav).toBeVisible();
    await nav.getByRole("link", { name: "My team", exact: true }).click();
    await expect(page.locator("#landing-username")).toBeVisible();
    await expect(page.locator("#landing-username")).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  // QA 2026-10-18 #6 (owner): landing "Build a trade" starts fresh; the old draft is one tap away.
  test(`home Trade starts fresh and offers the old draft back at ${viewport.width}`, async ({ page }) => {
    await openLanding(page, viewport);
    await page.locator(".launch-action[data-launch='players']").click();
    await expect(page).toHaveURL(/\/trade$/);
    // A shared draft is also an editable trade; returning home must not clear it.
    await page.goto("/trade?give=player:9509&get=player:11632");
    await expect(page.locator("#calculator-shell")).toContainText("Bijan Robinson", { timeout: 30000 });
    await page.goto("/");
    await page.locator('.launch-nav [data-launch="empty"]').click();
    await expect(page.locator("[data-action='draft-restore']")).toBeVisible({ timeout: 30000 });
    await expect(page.locator(".calc-grid")).not.toContainText("Bijan Robinson");
    await page.locator("[data-action='draft-restore']").click();
    await expect(page.locator("#calculator-shell")).toContainText("Bijan Robinson", { timeout: 30000 });
    await expect(page.locator("#calculator-shell")).toContainText("Malik Nabers");
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
