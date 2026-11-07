import { test, expect } from "@playwright/test";

// Phone, no league: the header's "Connect my league" opened an empty drawer.
// It now opens the connect form, and connecting returns to the same trade.
test("phone Connect my league from Check a trade connects and keeps the trade", async ({ page }) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/trade?give=9221&get=11632");
  await expect(page.locator("#value-calc-verdict h3")).toBeVisible({ timeout: 30000 });
  await page.locator("#mobile-rail-toggle").click();
  const username = page.locator("#sleeper-username");
  await expect(username).toBeVisible();
  await expect(username).toBeFocused();
  await username.fill("kingshaw9");
  await page.locator("#find-leagues-btn").click();
  const league = page.locator("#league-picker button, #league-picker [data-league-id]").first();
  await expect(league).toBeVisible({ timeout: 30000 });
  await league.click();
  await expect(page.locator("body")).toHaveClass(/league-loaded/, { timeout: 45000 });
  await expect(page).toHaveURL(/\/trade\?give=9221&get=11632/);
  await expect(page.locator("#calculator-shell")).toContainText("Jahmyr Gibbs");
  await expect(page.locator("#calculator-shell")).toContainText("Malik Nabers");
});
