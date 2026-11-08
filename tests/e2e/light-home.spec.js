import { test, expect } from "@playwright/test";

// Home and a bare Check a trade need prices only. Last season's Sleeper stat
// file (about 1.2MB) loads when a player card or the players board opens.
test("home and the calculator skip last season's stats until a player card opens", async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 390, height: 844 });
  const stats = [];
  page.on("request", (request) => {
    if (/api\.sleeper\.app\/v1\/stats\/nfl\//.test(request.url())) stats.push(request.url());
  });
  await page.goto("/");
  await expect(page.locator("#launch-trend a.launch-row").first()).toBeVisible({ timeout: 30000 });
  await page.goto("/trade?give=9221&get=11632");
  await expect(page.locator("#value-calc-verdict h3")).toBeVisible({ timeout: 30000 });
  await page.waitForTimeout(1500);
  expect(stats).toEqual([]);
  await page.locator("#calculator-shell .player-link", { hasText: "Jahmyr Gibbs" }).first().click();
  await expect(page.locator(".ranks-card")).toContainText(/\d{4} · /, { timeout: 30000 });
  expect(stats.length).toBeGreaterThan(0);
});
