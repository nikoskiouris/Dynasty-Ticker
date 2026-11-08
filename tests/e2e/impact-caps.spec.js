import { test, expect } from "@playwright/test";

// Team impact summaries are sentences: they start with a capital letter.
test("team impact summary lines start with a capital", async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/?sample=1");
  await expect(page.locator("body")).toHaveClass(/league-loaded/, { timeout: 45000 });
  await page.locator(".page-tab[data-room='calculator']").click();
  const box = page.locator("#calculator-shell .talk-box input").first();
  await box.fill("my Gibbs for Josh Allen");
  await box.press("Enter");
  const summaries = page.locator("#draft-team .impact-summary");
  await expect(summaries.first()).toBeVisible({ timeout: 20000 });
  for (const text of await summaries.allInnerTexts()) expect(text.trim()).toMatch(/^[A-Z]/);
});
