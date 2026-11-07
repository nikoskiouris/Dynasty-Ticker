import { test, expect } from "@playwright/test";

// Sleeper marks injured-reserve players "Inactive". With a league loaded,
// they used to drop off the board: no rank, and their page said "We can't
// find that player". A hurt player keeps his price, rank, and page.
test("an injured-reserve player keeps his page and rank with a league loaded", async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 390, height: 844 });
  // Pin Lamar on IR the way Sleeper reports it, so the test does not depend on
  // this week's injury report.
  await page.route("**/nfl_players_slim.json", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.players["4881"] = ["Lamar Jackson", "QB", "BAL", 29, "IR", "Inactive", 8];
    await route.fulfill({ response, json: body });
  });
  await page.goto("/?sample=1");
  await expect(page.locator("body")).toHaveClass(/league-loaded/, { timeout: 45000 });
  await page.evaluate(() => { history.pushState({}, "", "/player/4881/lamar-jackson"); dispatchEvent(new PopStateEvent("popstate")); });
  const card = page.locator(".ranks-card");
  await expect(card).toContainText("Lamar Jackson", { timeout: 20000 });
  await expect(card).not.toContainText("We can't find that player");
  await expect(card).toContainText(/QB\d+/);
});
