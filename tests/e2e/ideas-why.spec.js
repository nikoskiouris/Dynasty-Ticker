import { test, expect } from "@playwright/test";

// Ticket 017: every idea card names a benefit for you and a reason the
// partner says yes. No card says only that the rank stays put.
test("every Find a trade idea says what it does for you and why they say yes", async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?sample=1");
  await expect(page.locator("body")).toHaveClass(/league-loaded/, { timeout: 45000 });
  await page.locator(".page-tab[data-room='find']").click();
  const board = page.locator("#trade-match-dashboard");
  await expect(board).not.toContainText("Looking for trades", { timeout: 30000 });
  await expect(board).not.toContainText(/rank stays put/i);
  const cards = board.locator(".match-trade-card");
  const count = await cards.count();
  for (let i = 0; i < count; i += 1) {
    await expect(cards.nth(i).locator(".match-trade-gain")).toContainText(/^For you: /);
    await expect(cards.nth(i).locator(".match-trade-why")).toContainText(/^Why .+ says yes: /);
  }
});
