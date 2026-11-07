import { test, expect } from "@playwright/test";

// The sample league is not connected, so its header button says "Leave the
// sample"; a real league still says "Disconnect league".
test("sample header offers Leave the sample; a real league offers Disconnect", async ({ page }) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/?sample=1");
  await expect(page.locator("body")).toHaveClass(/league-loaded/, { timeout: 45000 });
  await expect(page.locator("#disconnect-btn")).toHaveText("Leave the sample");
  await page.goto("/l/1360686137898700800/team");
  await expect(page.locator("body")).toHaveClass(/league-loaded/, { timeout: 45000 });
  await expect(page.locator("#disconnect-btn")).toHaveText("Disconnect league");
});
