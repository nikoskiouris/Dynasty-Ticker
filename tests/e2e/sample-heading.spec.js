import { test, expect } from "@playwright/test";

// The sample is someone else's team: its My team heading names the manager
// instead of saying "Your team". A real league keeps "Your team".
test("sample My team heading names the manager", async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?sample=1");
  await expect(page.locator("body")).toHaveClass(/league-loaded/, { timeout: 45000 });
  await expect(page.locator("#power-heading")).toHaveText(/^\S+'s? team$/);
  await expect(page.locator("#power-heading")).not.toHaveText(/your/i);
  await page.goto("/l/1360686137898700800/team");
  await expect(page.locator("body")).toHaveClass(/league-loaded/, { timeout: 45000 });
  await expect(page.locator("#power-heading")).toHaveText("Your team");
});
