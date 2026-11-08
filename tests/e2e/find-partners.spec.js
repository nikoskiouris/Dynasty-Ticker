import { test, expect } from "@playwright/test";

const LEAGUE = "1360686137898700800";

// "Best partners" named teams with a reason and nothing to tap. Each partner
// now opens Check a trade with that team on the get side.
for (const width of [390, 1280]) {
  test(`a best partner opens Check a trade with that team at ${width}`, async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/l/${LEAGUE}/ideas?sample=1`);
    const go = page.locator("#match-partners [data-action='calc-with']").first();
    await expect(go).toBeVisible({ timeout: 45000 });
    const name = (await page.locator("#match-partners li strong").first().innerText()).trim();
    await expect(go).toHaveText(`Build a trade with ${name}`);
    const box = await go.boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(44);
    await go.click();
    await expect(page).toHaveURL(/\/trade\?/);
    await expect(page.locator("[data-draft-side='right']")).toContainText(`from ${name}`);
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`/l/${LEAGUE}/ideas`));
  });
}
