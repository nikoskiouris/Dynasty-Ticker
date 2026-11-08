import { test, expect } from "@playwright/test";

// When the price file failed, paint -> fetch -> fail -> paint refetched it
// hundreds of times a second and showed "Loading" forever.
for (const path of ["/trade?give=9221&get=4984", "/player/4984"]) {
  test(`a failed price file shows Try again on ${path} and does not refetch in a loop`, async ({ page }) => {
    let fetches = 0;
    const fail = (route) => { fetches += 1; return route.fulfill({ status: 503, body: "down" }); };
    await page.route("**/data/player_values.json*", fail);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(path);
    const retry = page.locator("[data-action='retry-values']:visible").first();
    await expect(retry).toBeVisible({ timeout: 30000 });
    await page.waitForTimeout(1500);
    expect(fetches).toBeLessThanOrEqual(3);
    await page.unroute("**/data/player_values.json*", fail);
    await retry.click();
    if (path.startsWith("/trade")) {
      await expect(page.locator("[data-draft-side='left'] .player-name-text")).toHaveText(["Jahmyr Gibbs"]);
    } else {
      await expect(page.locator(".ranks-card h2")).toHaveText("Josh Allen");
    }
  });
}
