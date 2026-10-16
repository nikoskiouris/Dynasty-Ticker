import { test, expect } from "@playwright/test";

for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
  test(`404 at a nested path is styled and goes home at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const failed = [];
    page.on("response", (res) => {
      if (res.status() >= 400 && new URL(res.url()).pathname !== "/garbage/x") failed.push(`${res.status()} ${res.url()}`);
    });
    const res = await page.goto("/garbage/x");
    expect(res.status()).toBe(404);
    await expect(page.locator(".brand-wordmark")).toBeVisible();
    // tokens.css applied: the dark page background, not the browser default.
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).not.toBe("rgba(0, 0, 0, 0)");
    expect(await page.locator(".brand-wordmark").evaluate((img) => img.naturalWidth)).toBeGreaterThan(0);
    expect(failed).toEqual([]);
    const back = page.getByRole("link", { name: "Back to Dynasty Ticker" });
    await expect(back).toHaveAttribute("href", "/");
    await back.click();
    await expect(page).toHaveURL(/127\.0\.0\.1:4173\/$/);
  });
}
