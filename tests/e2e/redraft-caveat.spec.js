import { test, expect } from "@playwright/test";

// A redraft league still uses the one dynasty price. Check a trade and My
// team say so where prices show; a dynasty league shows no caveat.
for (const [type, expected] of [[0, "This is a redraft league. Prices are still the dynasty market"], [2, null]]) {
  test(`market caveat in a league of type ${type}`, async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.route(/api\.sleeper\.app\/v1\/league\/\d+$/, async (route) => {
      const response = await route.fetch();
      const league = await response.json();
      await route.fulfill({ response, json: { ...league, settings: { ...(league.settings || {}), type } } });
    });
    await page.goto("/?sample=1");
    await expect(page.locator("body")).toHaveClass(/league-loaded/, { timeout: 45000 });
    const sheet = page.locator("#roster-sheet .calc-market-caveat");
    await page.locator(".page-tab[data-room='calculator']").click();
    const calc = page.locator("#calculator-shell .calc-market-caveat");
    if (expected) {
      await expect(calc).toContainText(expected);
      await page.locator(".page-tab[data-room='team']").click();
      await expect(sheet).toContainText(expected, { timeout: 20000 });
    } else {
      await expect(page.locator("#calculator-shell .calc-heading")).toBeVisible();
      await expect(calc).toHaveCount(0);
    }
  });
}
