import { test, expect } from "@playwright/test";

// Without a league, choosing 1QB in Check a trade stays through a reload
// and in a copied /trade link, so the verdict is checked on the same prices.
test("1QB in Check a trade survives a reload and rides in the link", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/trade?give=4984&get=9509");
  const left = page.locator("[data-draft-side='left'] .calc-pane-total");
  await expect(left).toBeVisible({ timeout: 30000 });
  const sf = (await left.innerText()).trim();
  await page.locator(".draft-format-btn[data-format='oneQb']").click();
  await expect(page).toHaveURL(/fmt=1qb/);
  const oneQb = (await left.innerText()).trim();
  expect(oneQb).not.toBe(sf);
  await page.reload();
  await expect(page.locator(".draft-format-btn[data-format='oneQb']")).toHaveAttribute("aria-pressed", "true", { timeout: 30000 });
  await expect(left).toHaveText(oneQb);
  await page.locator(".draft-format-btn[data-format='sf']").click();
  await expect(page).not.toHaveURL(/fmt=/);
});
