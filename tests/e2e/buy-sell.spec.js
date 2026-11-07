import { test, expect } from "@playwright/test";

// Ticket 004: Find a trade lists buy-low names on other rosters and sell-high
// names on yours, each with a why from price vs this season's points, and a
// link into Shop for that player.
for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
  test(`buy low / sell high rows explain themselves and open Shop at ${viewport.width}`, async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize(viewport);
    await page.goto("/?sample=1");
    await expect(page.locator(".team-verdict .team-verdict-odds")).toBeVisible({ timeout: 45000 });
    await page.locator(".page-tab[data-room='find']").click();
    const section = page.locator("#buy-sell-section");
    await expect(section).toBeVisible();
    await expect(section).toContainText("A reason to look, not a forecast.");
    const rows = section.locator(".buy-sell-row");
    await expect(rows.first()).toBeVisible({ timeout: 20000 });
    for (const why of await section.locator(".buy-sell-why").allInnerTexts()) {
      expect(why).toMatch(/^(Scoring like [A-Z]{2}\d+ \(\d+\.\d a game over \d+\), priced as [A-Z]{2}\d+|Priced as [A-Z]{2}\d+, scoring like [A-Z]{2}\d+ \(\d+\.\d a game over \d+\))\.$/);
    }
    const first = rows.first();
    const name = (await first.locator(".player-link").textContent()).trim();
    await first.getByRole("button", { name: /Price an offer|See offers/ }).click();
    await expect(page.locator("#shop-panel")).toContainText(name, { timeout: 20000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}
