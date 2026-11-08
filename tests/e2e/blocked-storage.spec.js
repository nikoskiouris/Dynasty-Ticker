import { test, expect } from "@playwright/test";

// Safari "Block all cookies" and some in-app browsers throw on the storage
// getter itself. The app showed "Couldn't load" (localStorage) or never drew
// the calculator (sessionStorage).
for (const blocked of [["localStorage"], ["sessionStorage"], ["localStorage", "sessionStorage", "indexedDB"]]) {
  test(`the site works with ${blocked.join(" + ")} blocked`, async ({ page }) => {
    test.setTimeout(90000);
    await page.addInitScript((names) => {
      for (const name of names) {
        Object.defineProperty(window, name, {
          configurable: true,
          get() { throw new DOMException("denied", "SecurityError"); },
        });
      }
    }, blocked);
    const errors = [];
    page.on("pageerror", (err) => errors.push(err.message));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/trade");
    const box = page.locator("#calculator-shell .talk-box input").first();
    await expect(box).toBeVisible({ timeout: 30000 });
    await box.fill("Gibbs for Josh Allen");
    await box.press("Enter");
    await expect(page.locator(".calc-summary h3").first()).toContainText(/Fair|Favors|Lopsided/);
    await page.goto("/l/1360686137898700800/team?sample=1");
    await expect(page.locator(".team-verdict")).toBeVisible({ timeout: 45000 });
    expect(errors).toEqual([]);
  });
}
