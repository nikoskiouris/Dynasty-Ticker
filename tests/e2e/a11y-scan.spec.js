import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Ticket 021 leftover: an accessibility scan of every tab, at phone and
// desktop widths, without a league and with the sample league.
const PAGES = [
  { name: "home", path: "/" },
  { name: "check a trade", path: "/trade?give=9221&get=11632" },
  { name: "players", path: "/players" },
  { name: "player page", path: "/player/9509" },
  { name: "my team (sample)", path: "/?sample=1", league: true },
  { name: "find a trade (sample)", path: "/?sample=1", league: true, room: "find" },
];

for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
  for (const target of PAGES) {
    test(`${target.name} has no accessibility violations at ${viewport.width}`, async ({ page }) => {
      test.setTimeout(90000);
      await page.setViewportSize(viewport);
      await page.goto(target.path);
      if (target.league) await expect(page.locator("body")).toHaveClass(/league-loaded/, { timeout: 45000 });
      if (target.room) await page.locator(`.page-tab[data-room='${target.room}']`).click();
      await page.waitForTimeout(2500);
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"]).analyze();
      const serious = results.violations
        .map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
      expect(serious, serious.join("\n")).toEqual([]);
    });
  }
}
