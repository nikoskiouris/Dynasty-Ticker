import { test, expect } from "@playwright/test";

// Back from a player card returns focus to the link that opened it, where the
// page is scrolled back to, instead of the room heading at the top.
test("Back from a player card returns focus to the roster link", async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?sample=1");
  await expect(page.locator(".team-verdict .team-verdict-odds")).toBeVisible({ timeout: 45000 });
  const link = page.locator("#roster-sheet .player-link").nth(8);
  await link.scrollIntoViewIfNeeded();
  const name = (await link.textContent()).trim();
  await link.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/player\//);
  await page.goBack();
  await expect.poll(() => page.evaluate(() => document.activeElement?.textContent?.trim() || ""), { timeout: 15000 }).toBe(name);
  expect(await page.evaluate(() => document.activeElement?.closest("#roster-sheet") !== null)).toBe(true);
});
