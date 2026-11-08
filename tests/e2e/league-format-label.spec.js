import { test, expect } from "@playwright/test";

// In a league, Check a trade prices in the league's format. The SF/1QB toggle
// stayed on screen and tapping 1QB did nothing.
test("in a league, Check a trade names the league's format instead of a dead toggle", async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/l/1360686137898700800/team?sample=1");
  await expect(page.locator(".team-verdict")).toBeVisible({ timeout: 45000 });
  await page.click(".page-tab[data-room='calculator']");
  await expect(page.locator(".draft-format-fixed")).toHaveText("SF · your league");
  await expect(page.locator("[data-action='draft-format']")).toHaveCount(0);
});

test("without a league the SF / 1QB toggle stays and changes prices", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/trade?give=4984&get=9221");
  const allen = page.locator("[data-draft-side='left'] .selected-token");
  await expect(page.locator("[data-action='draft-format']")).toHaveCount(2);
  const sf = await allen.innerText();
  await page.click("[data-action='draft-format'][data-format='oneQb']");
  await expect(allen).not.toHaveText(sf);
});
