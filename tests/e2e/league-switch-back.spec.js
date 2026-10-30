import { test, expect } from "@playwright/test";

// Stubbed ids. The retired private sample id is not allowed anywhere in the tree.
const FROM = "1000000000000000001";
const TO = "1000000000000000002";

function leagueBody(id) {
  return {
    league_id: id,
    name: id === TO ? "Second League" : "First League",
    status: "in_season",
    season: "2025",
    previous_league_id: "0",
    total_rosters: 1,
    roster_positions: ["QB", "RB", "WR", "TE", "FLEX", "BN"],
    settings: { type: 2, best_ball: 0, playoff_week_start: 15, playoff_teams: 4, num_teams: 1 },
    scoring_settings: { rec: 1 },
    avatar: "",
  };
}

async function stubLeagues(page) {
  await page.route("https://api.sleeper.app/v1/league/**", (route) => {
    const url = route.request().url();
    const id = url.match(/\/league\/(\d+)/)?.[1] || "";
    if (/\/league\/\d+$/.test(url)) {
      return route.fulfill({ contentType: "application/json", body: JSON.stringify(leagueBody(id)) });
    }
    if (url.includes("/users")) {
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify([{ user_id: "u1", display_name: "Manager", metadata: { team_name: "Squad" } }]),
      });
    }
    if (url.includes("/rosters")) {
      return route.fulfill({
        contentType: "application/json",
        body: JSON.stringify([{
          roster_id: 1,
          owner_id: "u1",
          players: [],
          starters: [],
          settings: { wins: 1, losses: 0, ties: 0 },
        }]),
      });
    }
    return route.fulfill({ contentType: "application/json", body: "[]" });
  });
  await page.route("https://api.sleeper.app/v1/state/nfl", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ season: "2025", week: 5, season_type: "regular" }),
  }));
}

for (const width of [390, 1280]) {
  test(`back after a league switch focuses the room heading at ${width}`, async ({ page }) => {
    test.setTimeout(90000);
    await stubLeagues(page);
    await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
    await page.goto(`/l/${FROM}/team`);
    await expect(page.locator("body")).toHaveClass(/league-loaded/, { timeout: 20000 });
    await expect(page).toHaveURL(new RegExp(`/l/${FROM}/team`));

    await page.locator("#league-id").evaluate((el, id) => {
      el.value = id;
    }, TO);
    await page.locator("#load-league-btn").evaluate((el) => el.click());
    await expect(page).toHaveURL(new RegExp(`/l/${TO}/`), { timeout: 20000 });
    await expect(page.locator("body")).toHaveClass(/league-loaded/);

    await page.goBack();
    await expect.poll(() => new URL(page.url()).pathname).toBe(`/l/${FROM}/team`);
    await expect(page.locator("body")).toHaveClass(/league-loaded/, { timeout: 20000 });
    await expect(page).toHaveTitle(/^My team · Dynasty Ticker/);
    await expect.poll(() => page.evaluate(() => document.activeElement?.id || ""), { timeout: 15000 }).toBe("power-heading");
    await page.waitForTimeout(750);
    const snap = await page.evaluate(() => {
      const el = document.activeElement;
      const rect = el?.getBoundingClientRect?.() || { width: 0, height: 0 };
      return {
        id: el?.id || "",
        tag: el?.tagName || "",
        width: rect.width,
        height: rect.height,
        srOnly: Boolean(el?.classList?.contains("sr-only")),
      };
    });
    expect(snap.id).toBe("power-heading");
    expect(snap.tag).toBe("H2");
    expect(snap.srOnly).toBe(false);
    expect(snap.width).toBeGreaterThan(0);
    expect(snap.height).toBeGreaterThan(0);
  });
}

test("a failed in-app league switch leaves history alone so the first Back leaves", async ({ page }) => {
  test.setTimeout(90000);
  const from = "1360686137898700800";
  const to = "1000000000000000002";
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`/l/${from}/team`);
  await expect(page.locator("body")).toHaveClass(/league-loaded/, { timeout: 45000 });
  await expect(page).toHaveURL(new RegExp(`/l/${from}/team`));
  const before = await page.evaluate(() => history.length);

  await page.route("**/api.sleeper.app/**", (route) => route.abort());
  await page.locator("#league-id").evaluate((el, id) => {
    el.value = id;
  }, to);
  await page.locator("#load-league-btn").evaluate((el) => el.click());
  await expect(page.locator("#desk-load-alert")).toContainText(`Couldn't switch to ${to}`, { timeout: 20000 });
  await expect(page).toHaveURL(new RegExp(`/l/${from}/team`));
  await expect(page.locator("body")).toHaveClass(/league-loaded/);
  await expect(page.locator("#league-missing")).toBeHidden();
  expect(await page.evaluate(() => history.length)).toBe(before);

  await page.goBack();
  await expect.poll(() => page.url()).not.toMatch(new RegExp(`/l/${from}/team`));
});
