import { test, expect } from "@playwright/test";
import { waitForAppBoot } from "./boot.js";

// My team with no league shows a small connect form. Submitting it swaps the
// tab for the landing league list, which used to drop focus to <body>.
async function stubSleeper(page) {
  await page.route("https://api.sleeper.app/v1/state/nfl", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ season: "2026", league_season: "2026", week: 9, season_type: "regular" }),
  }));
  await page.route("https://api.sleeper.app/v1/user/focuscheck", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ user_id: "900", username: "focuscheck", display_name: "focuscheck" }),
  }));
  await page.route("https://api.sleeper.app/v1/user/900/leagues/nfl/**", (route) => {
    const season = route.request().url().split("/").pop();
    const body = season === "2026"
      ? [1, 2].map((n) => ({ league_id: `11110000000000000${n}`, name: `League ${n}`, season: "2026", total_rosters: 12, status: "in_season", settings: { type: 2 } }))
      : [];
    return route.fulfill({ contentType: "application/json", body: JSON.stringify(body) });
  });
}

for (const width of [390, 1280]) {
  test(`connecting from the My team preview keeps focus on the connect box at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await stubSleeper(page);
    await page.goto("/trade?give=9221&get=4984");
    await waitForAppBoot(page);
    await page.locator(".page-tab[data-room='team']:visible").first().click();
    const input = page.locator("#preview-username-team");
    await expect(input).toBeVisible();
    await input.fill("focuscheck");
    await input.press("Enter");
    await expect(page.locator("#landing-league-picker .league-pick")).toHaveCount(2);
    await expect(page.locator("#landing-connect")).toBeFocused();
    // Tab moves on through the form to the league list, not from the top of the page.
    await page.keyboard.press("Tab");
    await expect(page.locator("#landing-username")).toBeFocused();
  });
}
