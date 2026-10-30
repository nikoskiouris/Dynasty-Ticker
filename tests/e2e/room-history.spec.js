import { test, expect } from "@playwright/test";
import { waitForAppBoot } from "./boot.js";

const LEAGUE = "1360686137898700800";

const viewports = [
  { width: 390, height: 844 },
  { width: 1280, height: 800 },
];

const ROOM = {
  team: { slug: "team", title: "My team" },
  find: { slug: "ideas", title: "Find a trade" },
};

async function loadLeague(page) {
  await page.goto("/");
  await waitForAppBoot(page);
  await page.locator("#league-id").evaluate((el) => {
    el.value = "1360686137898700800";
  });
  await page.locator("#load-league-btn").evaluate((el) => el.click());
  await expect(page).toHaveURL(new RegExp(`/l/${LEAGUE}/team`), { timeout: 30000 });
  await expect(page.locator("body")).toHaveClass(/league-loaded/);
}

async function openRoom(page, room) {
  if (page.viewportSize().width <= 700) {
    const open = await page.locator("body").evaluate((body) => body.classList.contains("rail-open"));
    if (!open) await page.locator("#mobile-rail-toggle").click();
    await page.locator(`#phone-desk [data-phone-room='${room}']`).click();
    return;
  }
  await page.locator(`.page-tab[data-room='${room}']`).click();
}

function pathOf(url) {
  return new URL(url).pathname;
}

async function watchSlashReplace(page) {
  await page.addInitScript(() => {
    window.__slashReplaces = [];
    const orig = history.replaceState.bind(history);
    history.replaceState = function (state, title, url) {
      const path = new URL(String(url ?? ""), location.origin).pathname;
      if (path === "/") window.__slashReplaces.push(String(url));
      return orig(state, title, url);
    };
  });
}

async function expectRoom(page, room) {
  const { slug, title } = ROOM[room];
  await expect.poll(() => pathOf(page.url())).toBe(`/l/${LEAGUE}/${slug}`);
  await expect(page).toHaveTitle(new RegExp(`^${title} · Dynasty Ticker`));
  await expect(page.locator("body")).toHaveClass(/league-loaded/);
}

for (const viewport of viewports) {
  test(`league rooms keep their own history at ${viewport.width}`, async ({ page }) => {
    test.setTimeout(120000);
    await watchSlashReplace(page);
    await page.setViewportSize(viewport);
    await loadLeague(page);
    await expectRoom(page, "team");

    await openRoom(page, "find");
    await expectRoom(page, "find");

    await openRoom(page, "team");
    await expectRoom(page, "team");

    await page.goBack();
    await expectRoom(page, "find");

    await page.goBack();
    await expectRoom(page, "team");

    await page.goForward();
    await expectRoom(page, "find");
    await expect(page).not.toHaveTitle("Dynasty Ticker — Your Sleeper dynasty league");

    const slashes = await page.evaluate(() => window.__slashReplaces);
    expect(slashes).toEqual([]);
  });
}

for (const viewport of viewports) {
  test(`cold room urls open their room at ${viewport.width}`, async ({ page }) => {
    test.setTimeout(240000);
    await page.setViewportSize(viewport);
    const rooms = [
      ["/team", "team"],
      ["/ideas", "find"],
      ["/week", "team"],
      ["/league", "team"],
      ["/activity", "team"],
      ["/history", "team"],
    ];
    for (const [suffix, room] of rooms) {
      await page.goto("about:blank");
      const before = await page.evaluate(() => history.length);
      await page.goto(`/l/${LEAGUE}${suffix}`);
      await expect(page.locator("body")).toHaveClass(/league-loaded/, { timeout: 45000 });
      await expectRoom(page, room);
      await expect(page.locator("#landing")).toBeHidden();
      const after = await page.evaluate(() => history.length);
      expect(after, suffix).toBeGreaterThanOrEqual(before);
      expect(after, suffix).toBeLessThanOrEqual(before + 1);
      await page.goBack();
      await expect(page).toHaveURL("about:blank");
    }
  });
}

test("a cold unknown league room opens the team", async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/l/${LEAGUE}/not-a-room`);
  await expect(page.locator("body")).toHaveClass(/league-loaded/, { timeout: 45000 });
  await expectRoom(page, "team");
  await expect(page.locator("#landing")).toBeHidden();
});

test("a missing numeric league under a room path is not found", async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/l/1/ideas");
  await expect(page.locator("#league-missing-title")).toBeVisible({ timeout: 45000 });
  await expect(page.locator("#league-missing-title")).toHaveText("We couldn't find that league");
  await expect(page).toHaveTitle("We couldn't find that league · Dynasty Ticker");
  await expect(page.locator("#landing")).toBeHidden();
  await expect(page.locator("#sleeper-down")).toBeHidden();
  await expect.poll(() => new URL(page.url()).pathname).toBe("/l/1/ideas");
  await expect(page.locator("body")).not.toHaveClass(/league-loaded/);
});
