import { test, expect } from "@playwright/test";

// Position ranks label each room by its rank: the last-ranked room never
// reads "stable" beside a Next move that says to upgrade it.
test("position rank labels follow the rank", async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?sample=1");
  await expect(page.locator(".team-verdict .team-verdict-odds")).toBeVisible({ timeout: 45000 });
  const meters = page.locator(".position-meter");
  await expect(meters.first()).toBeVisible();
  const rows = await meters.evaluateAll((els) => els.map((el) => ({
    pos: el.querySelector("strong").textContent.trim(),
    rank: el.querySelector(".position-meter-top span").textContent.trim(),
    label: el.querySelector("p").textContent.trim(),
  })));
  const teams = Number(rows[0].rank.split("/")[1]);
  for (const row of rows) {
    const rank = Number.parseInt(row.rank, 10);
    if (rank === teams) expect(row.label, JSON.stringify(row)).toMatch(/upgrade target/);
    if (rank === 1) expect(row.label, JSON.stringify(row)).toMatch(/^edge/);
  }
  const next = await page.locator("#next-move").innerText();
  const upgrade = next.match(/Upgrade (\w+)/)?.[1];
  if (upgrade) expect(rows.find((row) => row.pos === upgrade).label).not.toMatch(/^stable/);
});
