import { test, expect } from "@playwright/test";

// Every offer card has a "Review trade" button. Each one's accessible name
// says which trade it opens, so a screen-reader list of buttons is usable.
test("Review trade buttons name their trade", async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?sample=1");
  await expect(page.locator("body")).toHaveClass(/league-loaded/, { timeout: 45000 });
  await page.locator(".page-tab[data-room='find']").click();
  await page.locator("#shop-panel select").first().selectOption({ index: 1 });
  const buttons = page.locator("#shop-panel [data-action='review-trade']");
  await expect(buttons.first()).toBeVisible({ timeout: 20000 });
  const names = await buttons.evaluateAll((els) => els.map((el) => el.getAttribute("aria-label") || ""));
  expect(names.length).toBeGreaterThan(1);
  for (const name of names) expect(name).toMatch(/^Review trade with .+: .+ for .+$/);
  expect(new Set(names).size).toBe(names.length);
  await expect(buttons.first()).toHaveText("Review trade");
  await page.getByRole("button", { name: names[0] }).click();
  await expect(page).toHaveURL(/\/trade\?give=/);
});
