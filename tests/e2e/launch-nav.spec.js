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
  test(`landing Look up a player opens the board at /players, first on screen, and Back returns at ${viewport.width}`, async ({ page }) => {
    await openLanding(page, viewport);
    await page.locator(".launch-action[data-launch='players']").click();
    await expect(page).toHaveURL(/\/players$/);
    await expect(page).toHaveTitle(/^Players · Dynasty Ticker/);
    await expect(page.locator("#calculator-shell")).toBeVisible();
    await expect(page.locator("#ranks-section")).toBeVisible();
    await expect(page.locator("#ranks-section h2")).toBeInViewport();
    await expect(page.locator("[data-action='rank-open']").first()).toBeVisible({ timeout: 20000 });
    // A reload keeps the board: /players is its own address.
    await page.reload();
    await expect(page).toHaveURL(/\/players$/);
    await expect(page.locator("#ranks-section")).toBeVisible();
    // Check a trade leaves the board, and Back comes back to it.
    await page.locator("#trades-tab").click();
    await expect(page).toHaveURL(/\/trade$/);
    await expect(page.locator("#ranks-section")).toBeHidden();
    await page.goBack();
    await expect(page).toHaveURL(/\/players$/);
    await expect(page.locator("#ranks-section")).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator("#landing-job-hint")).toBeVisible();
    await expect(page.locator("#ranks-section")).toBeHidden();
  });

  // Report 2026-10-31: one tab row at every width (the home's second nav row is
  // gone), and a tab with no league stays selected and previews instead of redirecting.
  test(`home has one tab row; tabs open a trade and a no-league preview at ${viewport.width}`, async ({ page }) => {
    await openLanding(page, viewport);
    await expect(page.locator("#launch-example")).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Main navigation" })).toHaveCount(0);
    const tabs = page.locator("#page-tabs .page-tab");
    await expect(tabs).toHaveCount(3);
    await expect(page.locator("#league-tab")).toBeInViewport();
    // The tab can be pressed before the app module finishes booting; press until it lands.
    await expect(async () => {
      await page.locator("#trades-tab").click();
      await expect(page.locator("#calculator-shell")).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 30000 });
    await expect(page.locator("#calculator-shell")).not.toContainText("Bijan Robinson");
    await page.locator("#league-tab").click();
    await expect(page.locator("#league-tab")).toHaveAttribute("aria-selected", "true");
    await expect(page.locator("[data-preview='team'] input")).toBeVisible();
    await expect(page.locator("[data-preview='team'] .sample-league-link")).toBeVisible();
    await page.locator("#find-tab").click();
    await expect(page.locator("#find-tab")).toHaveAttribute("aria-selected", "true");
    await expect(page.locator("[data-preview='find'] input")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  // Never erase work: going home and back to Check a trade keeps the trade.
  test(`home and back to Check a trade keeps the trade at ${viewport.width}`, async ({ page }) => {
    await openLanding(page, viewport);
    await page.goto("/trade?give=player:9509&get=player:11632");
    await expect(page.locator("#calculator-shell")).toContainText("Bijan Robinson", { timeout: 30000 });
    await page.goto("/");
    await page.locator("#trades-tab").click();
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
