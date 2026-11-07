import { test, expect } from "@playwright/test";

// Before a league drafts, every roster is empty. My team and Find a trade say
// so instead of "Scoring your roster…" forever or "Biggest hole: QB (1st)".
test("an empty pre-draft roster gets an honest empty state, not a stuck loader", async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route(/api\.sleeper\.app\/v1\/league\/\d+\/rosters$/, async (route) => {
    const response = await route.fetch();
    const rosters = (await response.json()).map((roster) => ({ ...roster, players: [], starters: [], reserve: [], taxi: [] }));
    await route.fulfill({ response, json: rosters });
  });
  await page.route(/api\.sleeper\.app\/v1\/league\/\d+$/, async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, json: { ...(await response.json()), status: "pre_draft" } });
  });
  await page.goto("/?sample=1");
  await expect(page.locator("body")).toHaveClass(/league-loaded/, { timeout: 45000 });
  const power = page.locator("#power-section");
  await expect(power).toContainText("No players yet: this league hasn't drafted.", { timeout: 20000 });
  await expect(power).not.toContainText("Scoring your roster");
  await page.locator(".page-tab[data-room='find']").click();
  await expect(page.locator("#trade-match-needs")).toContainText("No players yet: this league hasn't drafted.");
  await expect(page.locator("#trade-match-needs")).not.toContainText("Biggest hole");
});
