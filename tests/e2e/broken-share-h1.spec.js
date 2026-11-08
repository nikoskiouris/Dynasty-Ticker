import { test, expect } from "@playwright/test";

// A broken /t/ link opens the calculator with a notice. It has no shared-trade
// title, so the page h1 must stay: exactly one, "Check a trade".
function shownH1s(page) {
  return page.evaluate(() => [...document.querySelectorAll("h1")].filter((el) => {
    for (let node = el; node && node.nodeType === 1; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.display === "none" || style.visibility === "hidden") return false;
    }
    return Boolean(el.textContent.trim());
  }).map((el) => el.textContent.replace(/\s+/g, " ").trim()));
}

for (const width of [390, 1280]) {
  test(`a broken share link keeps one h1 at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
    await page.goto("/t/zzz");
    await expect(page.locator("#calculator-shell")).toBeVisible({ timeout: 30000 });
    await expect.poll(() => shownH1s(page), { timeout: 15000 }).toEqual(["Check a trade"]);
  });
}
