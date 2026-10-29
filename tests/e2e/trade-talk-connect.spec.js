import { test, expect } from "@playwright/test";
import { waitForAppBoot } from "./boot.js";

// Stubbed league: roster 1 (Niko) has Gibbs and his own picks, roster 2 (Chris) has Nabers.
const LEAGUE = "1000000000000000003";
const GIBBS = "9221";
const NABERS = "11632";

async function stubLeague(page) {
  await page.route("https://api.sleeper.app/v1/league/**", (route) => {
    const url = route.request().url();
    if (/\/league\/\d+$/.test(url)) {
      return route.fulfill({ contentType: "application/json", body: JSON.stringify({
        league_id: LEAGUE,
        name: "Connect League",
        status: "in_season",
        season: "2026",
        previous_league_id: "0",
        total_rosters: 2,
        roster_positions: ["QB", "RB", "WR", "TE", "FLEX", "SUPER_FLEX", "BN"],
        settings: { type: 2, best_ball: 0, playoff_week_start: 15, playoff_teams: 2, num_teams: 2, draft_rounds: 4 },
        scoring_settings: { rec: 1 },
        avatar: "",
      }) });
    }
    if (url.includes("/users")) {
      return route.fulfill({ contentType: "application/json", body: JSON.stringify([
        { user_id: "u1", display_name: "Niko", metadata: { team_name: "Niko FC" } },
        { user_id: "u2", display_name: "Chris", metadata: { team_name: "Lions Den" } },
      ]) });
    }
    if (url.includes("/rosters")) {
      return route.fulfill({ contentType: "application/json", body: JSON.stringify([
        { roster_id: 1, owner_id: "u1", players: [GIBBS], starters: [], settings: { wins: 1, losses: 0, ties: 0 } },
        { roster_id: 2, owner_id: "u2", players: [NABERS], starters: [], settings: { wins: 0, losses: 1, ties: 0 } },
      ]) });
    }
    return route.fulfill({ contentType: "application/json", body: "[]" });
  });
  await page.route("https://api.sleeper.app/v1/state/nfl", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ season: "2026", week: 8, season_type: "regular" }),
  }));
}

const tokens = (page, side) => page.locator(`[data-draft-side='${side}'] .selected-token-label .player-name-text, [data-draft-side='${side}'] .selected-token-label:not(.player-name)`);

const viewports = [
  { width: 390, height: 844 },
  { width: 820, height: 1180 },
  { width: 1280, height: 800 },
];

// Works without a league; connecting adds ownership to the same trade.
for (const viewport of viewports) {
  test(`a trade described before connecting survives the league load and can use real picks at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    test.setTimeout(90000);
    await stubLeague(page);
    await page.setViewportSize(viewport);
    await page.goto(`/trade?say=${encodeURIComponent("Gibbs and my 2028 2nd for Nabers from Chris")}`);
    await expect(tokens(page, "left")).toHaveText(["Jahmyr Gibbs", "2028 2nd"], { timeout: 30000 });
    await expect(tokens(page, "right")).toHaveText(["Malik Nabers"]);
    await expect(page.locator("#talk-log")).toContainText("Connect your Sleeper league to use chris’s roster");

    await page.click(".talk-connect");
    await page.locator("#league-id").evaluate((el, id) => { el.value = id; }, LEAGUE);
    await page.locator("#load-league-btn").evaluate((el) => el.click());
    await expect(page.locator("body")).toHaveClass(/league-loaded/, { timeout: 20000 });

    // Back on the same trade, nothing swapped behind the manager's back.
    await expect(page.locator("[data-draft-side='left']")).toBeVisible({ timeout: 20000 });
    await expect(tokens(page, "left")).toHaveText(["Jahmyr Gibbs", "2028 2nd"]);
    await expect(tokens(page, "right")).toHaveText(["Malik Nabers"]);
    await expect(page.locator(".talk-connect")).toHaveCount(0);
    await expect(page.locator("#talk-log")).not.toContainText("Connect your Sleeper league");
    const use = page.locator("[data-action='draft-use-league-pick']");
    await expect(use).toHaveText("Use the 2028 2nd on your roster");

    await use.click();
    await expect(tokens(page, "left")).toHaveText(["Jahmyr Gibbs", /^2028 2nd .+/]);
    await expect(use).toHaveCount(0);
    await expect(page.locator("#draft-team")).not.toContainText("does not fit");
    await expect(page.locator("#draft-meter .meter-label")).toHaveText(await page.locator("#value-calc-verdict h3").innerText());
  });
}
