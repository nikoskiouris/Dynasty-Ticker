import { test, expect } from "@playwright/test";

// The roster sheet's Superflex slot label fits its column at every width.
for (const width of [1280, 820, 390]) {
  test(`superflex slot label is not clipped at ${width}`, async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/?sample=1");
    const slot = page.locator("#roster-sheet .sheet-slot-superflex").first();
    await expect(slot).toBeVisible({ timeout: 45000 });
    const fit = await slot.evaluate((el) => ({ text: el.innerText.trim(), over: el.scrollWidth - el.clientWidth }));
    expect(fit.over, JSON.stringify(fit)).toBeLessThanOrEqual(1);
    expect(fit.text).toBe("SF");
    await expect(slot.locator("abbr")).toHaveAttribute("title", "Superflex");
  });
}
