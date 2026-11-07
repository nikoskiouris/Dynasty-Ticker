import { test, expect } from "@playwright/test";

// The Team score card shows roster tags, not a second contend/rebuild answer.
// The call card above it is the one answer to that question.
const LANE_LABELS = ["Middle of the pack", "Contender", "Contender, thin depth", "Rebuilding well", "Playoff team"];

test("team score tags never restate the window next to My team's call", async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?sample=1");
  await expect(page.locator(".team-verdict .team-verdict-odds")).toBeVisible({ timeout: 45000 });
  const badges = page.locator("#team-score .power-badge");
  await expect(badges.first()).toBeVisible({ timeout: 20000 });
  const texts = (await badges.allInnerTexts()).map((text) => text.split(":")[0].trim());
  for (const label of LANE_LABELS) expect(texts).not.toContain(label);
});
