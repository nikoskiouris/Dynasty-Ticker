import { test, expect } from "@playwright/test";

// Phone with a league: the workspace header has nothing visible in it, so it
// must not draw its double rule as a stray line over My team.
test("no stray header rule over My team on a phone", async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?sample=1");
  await expect(page.locator("body")).toHaveClass(/league-loaded/, { timeout: 45000 });
  const header = await page.locator("#workspace-header").evaluate((el) => ({
    border: getComputedStyle(el).borderBottomWidth,
    height: el.getBoundingClientRect().height,
  }));
  expect(header).toEqual({ border: "0px", height: 0 });
});
