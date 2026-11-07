import { test, expect } from "@playwright/test";

// Never erase work: after Clear both sides, Restore draft is still offered
// after a reload in the same tab, and it brings the trade back.
test("Restore draft survives a reload after Clear both sides", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/trade?give=9221&get=11632");
  await expect(page.locator("#value-calc-verdict h3")).toBeVisible({ timeout: 30000 });
  await page.getByRole("button", { name: "Clear both sides" }).click();
  await expect(page.getByRole("button", { name: /Restore/ })).toBeVisible();
  await page.reload();
  const restore = page.getByRole("button", { name: /Restore/ });
  await expect(restore).toBeVisible({ timeout: 20000 });
  await restore.click();
  await expect(page).toHaveURL(/\/trade\?give=9221&get=11632/);
  await expect(page.locator("[data-draft-side='right']")).toContainText("Malik Nabers");
});
