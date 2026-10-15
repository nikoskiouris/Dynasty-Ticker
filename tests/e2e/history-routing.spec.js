import { test, expect } from "@playwright/test";

const viewports = [
  { width: 390, height: 844 },
  { width: 1280, height: 800 },
];

async function landFromAnotherPage(page) {
  await page.goto("about:blank");
  await page.goto("/");
  await page.waitForFunction(() => document.querySelectorAll("[data-action='rank-open']").length > 0);
}

for (const viewport of viewports) {
  test(`back from a player stays in the app at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await landFromAnotherPage(page);
    await page.locator("[data-action='rank-open']").first().evaluate((el) => el.click());
    await expect(page).toHaveURL(/\/player\/\d+/);
    await expect(page).not.toHaveURL(/[?&]asset=/);
    await expect(page.locator(".ranks-card")).toBeVisible();
    await page.goBack();
    expect(page.url()).not.toBe("about:blank");
    expect(page.url()).not.toContain("/player/");
    await expect(page.locator(".ranks-card")).toHaveCount(0);
    await expect(page.locator("#landing")).toBeVisible();
  });

  test(`menu, players, and a league each push a route at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await landFromAnotherPage(page);

    if (viewport.width < 700) {
      await page.locator("#mobile-rail-toggle").evaluate((el) => el.click());
      await expect(page.locator("body")).toHaveClass(/rail-open/);
      await page.locator("[data-phone-page='players']").evaluate((el) => el.click());
    } else {
      await page.locator("#players-tab").evaluate((el) => el.click());
    }
    await expect(page).toHaveURL(/\/players$/);
    await page.goBack();
    expect(page.url()).not.toBe("about:blank");
    await expect(page.locator("#landing")).toBeVisible();

    await page.locator("#league-id").evaluate((el) => {
      el.value = "1360686137898700800";
    });
    await page.locator("#load-league-btn").evaluate((el) => el.click());
    await expect(page).toHaveURL(/\/l\/1360686137898700800\/team/, { timeout: 30000 });
    await page.goBack();
    expect(page.url()).not.toBe("about:blank");
    await expect(page).not.toHaveURL(/\/l\//);
    const priorVisible = await page.locator("#landing").isVisible()
      || await page.locator("[data-input='ranks-search']").isVisible();
    expect(priorVisible).toBe(true);
  });
}

test("cold load of /player/<id> opens that player", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.waitForFunction(() => document.querySelectorAll("[data-action='rank-open']").length > 0);
  await page.evaluate(() => {
    const input = document.querySelector("[data-input='ranks-search']");
    input.value = "Jahmyr Gibbs";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.waitForFunction(() => {
    return [...document.querySelectorAll("[data-action='rank-open']")].some((el) => el.textContent.includes("Jahmyr Gibbs"));
  });
  await page.evaluate(() => {
    const button = [...document.querySelectorAll("[data-action='rank-open']")].find((el) => el.textContent.includes("Jahmyr Gibbs"));
    button.click();
  });
  await expect(page).toHaveURL(/\/player\/\d+/);
  const path = new URL(page.url()).pathname;
  const cold = await page.context().newPage();
  await cold.setViewportSize({ width: 390, height: 844 });
  await cold.goto(path);
  await expect(cold.locator(".ranks-card h2")).toHaveText("Jahmyr Gibbs", { timeout: 30000 });
  await expect(cold).toHaveURL(/\/player\/\d+/);
  await cold.locator(".player-back").click();
  await expect(cold).toHaveURL(/\/$/);
  await expect(cold.locator(".ranks-card")).toHaveCount(0);
  await expect(cold.locator("#landing")).toBeVisible();
});

for (const viewport of viewports) {
  test(`back from a league restores the picker at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await page.locator("#league-id").evaluate((el) => {
      el.value = "1360686137898700800";
    });
    await page.locator("#load-league-btn").evaluate((el) => el.click());
    await expect(page).toHaveURL(/\/l\/1360686137898700800\/team/, { timeout: 30000 });
    await expect(page.locator("body")).toHaveClass(/league-loaded/);
    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator("#landing")).toBeVisible();
    await expect(page.locator("#landing-username")).toBeVisible();
    await expect(page.locator("body")).not.toHaveClass(/league-loaded/);
    await expect(page.locator("#league-page")).toBeHidden();
    await page.goForward();
    await expect(page).toHaveURL(/\/l\/1360686137898700800\/team/);
    await expect(page.locator("body")).toHaveClass(/league-loaded/, { timeout: 30000 });
    await expect(page.locator("#league-page")).toBeVisible();
    await expect(page.locator("#landing")).toBeHidden();
  });
}

test("cold player link can find leagues", async ({ page }) => {
  await page.route("**/api.sleeper.app/v1/user/tickerfan", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ user_id: "user-ticker", display_name: "Ticker Fan", username: "tickerfan" }),
  }));
  await page.route("**/api.sleeper.app/v1/user/user-ticker/leagues/nfl/**", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify([
      { league_id: "111", name: "Alpha Dynasty", season: "2026", total_rosters: 12, status: "in_season", settings: { type: 2 } },
      { league_id: "222", name: "Beta Dynasty", season: "2026", total_rosters: 12, status: "in_season", settings: { type: 2 } },
    ]),
  }));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/player/9221");
  await expect(page.locator(".ranks-card h2")).toHaveText("Jahmyr Gibbs", { timeout: 30000 });
  const find = page.locator(".ranks-card [data-action='find-my-leagues']");
  await expect(find).toBeVisible();
  await find.click();
  await expect(page.locator("#landing")).toBeVisible();
  await expect(page.locator("#landing-username")).toBeVisible();
  await page.locator("#landing-username").fill("tickerfan");
  await page.locator("#landing-find-btn").evaluate((el) => el.click());
  await expect(page.locator("#landing-league-picker")).toContainText("Alpha Dynasty", { timeout: 15000 });
  await expect(page.locator("#landing-league-picker")).toContainText("Beta Dynasty");
  await expect(page.locator(".ranks-card h2")).toHaveText("Jahmyr Gibbs");
});

test("legacy ?asset= opens the player route", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?asset=player:9221");
  await expect(page.locator(".ranks-card h2")).toHaveText("Jahmyr Gibbs", { timeout: 30000 });
  await expect(page).toHaveURL(/\/player\/9221/);
  await expect(page).not.toHaveURL(/[?&]asset=/);
});
