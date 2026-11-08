import { test, expect } from "@playwright/test";

// The phone drawer is a modal layer: Tab never reaches the page behind it,
// and the page is usable again once it closes.
test("Tab stays inside the open phone drawer", async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?sample=1");
  await expect(page.locator("body")).toHaveClass(/league-loaded/, { timeout: 45000 });
  await page.locator("#mobile-rail-toggle").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("body")).toHaveClass(/rail-open/);
  for (let i = 0; i < 30; i += 1) {
    await page.keyboard.press("Tab");
    const inside = await page.evaluate(() => Boolean(document.activeElement?.closest("#control-rail")) || document.activeElement === document.body);
    expect(inside, `tab ${i}`).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(page.locator("body")).not.toHaveClass(/rail-open/);
  await expect(page.locator("#workspace")).not.toHaveAttribute("inert", "");
  await expect(page.locator("#mobile-chrome")).not.toHaveAttribute("inert", "");
});
