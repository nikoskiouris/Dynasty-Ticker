import { test, expect } from "@playwright/test";

// My team's contend-or-rebuild call and Find a trade's "Your situation" line
// come from one model, so they never disagree.
const WORD = {
  "Go win it now": "contending",
  "Buy for a playoff push": "contending",
  "Hold steady": "in between",
  "On the bubble": "in between",
  "Rebuild": "rebuilding",
  "Out of it": "rebuilding",
};

test("Find a trade's situation line agrees with My team's call", async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?sample=1");
  await expect(page.locator(".team-verdict .team-verdict-odds")).toBeVisible({ timeout: 45000 });
  const call = (await page.locator(".team-verdict .window-call-line strong").textContent()).trim();
  expect(Object.keys(WORD)).toContain(call);
  await page.locator(".page-tab[data-room='find']").click();
  await expect(page.locator("#find-situation")).toContainText(` is ${WORD[call]}.`, { timeout: 20000 });
});
