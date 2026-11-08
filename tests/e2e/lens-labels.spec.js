import { test, expect } from "@playwright/test";

const LEAGUE = "1360686137898700800";

// Viewing another manager from the standings names their team and their next
// move, and drops the Find button (Find a trade works for your own team).
test("another manager's team is labeled as theirs", async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/l/${LEAGUE}/team`);
  await expect(page.locator(".team-verdict .team-verdict-odds")).toBeVisible({ timeout: 45000 });
  await expect(page.locator("#power-heading")).toHaveText("Your team");
  const me = (await page.locator("#roster-sheet-heading").textContent()).trim();
  const rows = page.locator("#standings-dashboard [data-action='set-lens-teams']");
  const count = await rows.count();
  for (let i = 0; i < count; i += 1) {
    if (!(await rows.nth(i).textContent()).includes(me)) {
      await rows.nth(i).click();
      break;
    }
  }
  await expect(page.locator("#roster-sheet-heading")).not.toHaveText(me, { timeout: 15000 });
  const other = (await page.locator("#roster-sheet-heading").textContent()).trim();
  await expect(page.locator("#power-heading")).toHaveText(new RegExp(`^${other.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}'s? team$`));
  await expect(page.locator("#next-move-title")).toHaveText(new RegExp(`next move$`, "i"));
  await expect(page.locator("#next-move-title")).not.toHaveText(/your/i);
  await expect(page.locator("#next-move [data-action='find-position']")).toHaveCount(0);
});
