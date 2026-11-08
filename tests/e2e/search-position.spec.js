import { test, expect } from "@playwright/test";
import { waitForAppBoot } from "./boot.js";

// Without a league, every player in Check a trade search read "Player".
test("calculator search shows position and NFL team without a league", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/trade");
  await waitForAppBoot(page);
  const input = page.locator("[data-draft-side='left'] input").first();
  await input.click();
  await input.pressSequentially("chase");
  const chase = page.locator(".calc-item:visible", { hasText: "Ja'Marr Chase" }).first();
  await expect(chase.locator(".asset-pill")).toHaveText("WR");
  await expect(chase.locator(".asset-context")).toHaveText("CIN");
  await expect(page.locator(".calc-item:visible .asset-pill", { hasText: /^Player$/ })).toHaveCount(0);
});
