import { test, expect } from "@playwright/test";

// The sticky page tabs sat a fraction of a pixel below the top rail, so
// scrolled cards showed through a sliver between them on iPad and desktop.
for (const width of [820, 1024, 1366]) {
  test(`sticky tabs meet the top rail with no gap at ${width}`, async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width, height: 768 });
    await page.goto("/l/1360686137898700800/team?sample=1");
    await expect(page.locator(".team-verdict")).toBeVisible({ timeout: 45000 });
    await page.evaluate(() => window.scrollBy(0, 600));
    const gap = await page.evaluate(() => {
      const rail = document.querySelector("#control-rail").getBoundingClientRect();
      const nav = document.querySelector(".desk-nav").getBoundingClientRect();
      return nav.top - rail.bottom;
    });
    expect(gap).toBeLessThanOrEqual(0);
  });
}
