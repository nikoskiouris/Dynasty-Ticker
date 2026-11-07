import { test, expect } from "@playwright/test";

// Ticket 007: My team names players to move on from, each with why, what to
// ask for, and likely buyers, following the call; a contender keeps its core.
test("My team names players to move on from, by the call, and opens Shop", async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?sample=1");
  await expect(page.locator(".team-verdict .team-verdict-odds")).toBeVisible({ timeout: 45000 });
  const call = (await page.locator(".team-verdict .window-call-line strong").textContent()).trim();
  const rows = page.locator("#move-on .move-on-row");
  const count = await rows.count();
  expect(count).toBeLessThanOrEqual(6);
  for (let i = 0; i < count; i += 1) {
    const text = await rows.nth(i).innerText();
    expect(text).toMatch(/Ask for: /);
    if (call === "Go win it now") expect(text).toMatch(/^[\s\S]*Bench [A-Z]{2}, \d+:/);
  }
  if (count) {
    const name = (await rows.first().locator(".player-link").textContent()).trim();
    await rows.first().getByRole("button", { name: "See offers →" }).click();
    await expect(page.locator("#shop-panel")).toContainText(name, { timeout: 20000 });
  }
});
