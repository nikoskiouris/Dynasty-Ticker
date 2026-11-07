import { test, expect } from "@playwright/test";

// Tickets 005/008: a contender sees named older starters on rebuilding teams
// in this league, with owner and why; a rebuilder is told not to buy them.
test("win-now targets follow the call and name real owners", async ({ page }) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?sample=1");
  await expect(page.locator(".team-verdict .team-verdict-odds")).toBeVisible({ timeout: 45000 });
  const call = (await page.locator(".team-verdict .window-call-line strong").textContent()).trim();
  await page.locator(".page-tab[data-room='find']").click();
  const host = page.locator("#win-now-dashboard");
  if (call === "Rebuild") {
    await expect(host).toContainText("Don't buy them.");
  } else {
    const rows = host.locator(".win-now-row");
    await expect(rows.first()).toBeVisible({ timeout: 20000 });
    for (const why of await host.locator(".win-now-why").allInnerTexts()) {
      expect(why).toMatch(/ is rebuilding( \(\d+-\d+(-\d+)?\))?\. At \d+, he helps a contender this year more than a rebuild later\.$/);
    }
  }
  // Switch to a team whose call is Rebuild: the list turns off.
  await page.locator(".page-tab[data-room='team']").click();
  const select = page.locator("#me-select");
  for (const value of await select.locator("option").evaluateAll((opts) => opts.map((o) => o.value).filter(Boolean))) {
    await select.selectOption(value);
    await expect(page.locator(".team-verdict .window-call-line strong")).toBeVisible({ timeout: 20000 });
    if ((await page.locator(".team-verdict .window-call-line strong").textContent()).trim() !== "Rebuild") continue;
    await page.locator(".page-tab[data-room='find']").click();
    await expect(host).toContainText("Don't buy them.");
    await expect(host.locator(".win-now-row")).toHaveCount(0);
    return;
  }
});
