import { test, expect } from "@playwright/test";
import { waitForAppBoot } from "./boot.js";

// "Which Chase?" listed bare names. Each choice now says position, team, price.
test("a 'Which …?' choice shows position, team and price, and adds the real name", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/trade");
  await waitForAppBoot(page);
  const box = page.locator("#calculator-shell .talk-box input").first();
  await box.fill("Jefferson for Chase");
  await box.press("Enter");
  const chase = page.locator(".talk-choice", { hasText: /which chase/i }).locator(".talk-chip");
  await expect(chase.first()).toContainText("Ja'Marr Chase · WR · CIN");
  await expect(chase.first().locator(".talk-chip-value")).toHaveText(/\d/);
  await expect(chase.filter({ hasText: "Chase Brown" })).toContainText("RB · CIN");
  await chase.first().click();
  await expect(page.locator("[data-draft-side='right'] .player-name-text")).toHaveText(["Ja'Marr Chase"]);
});
