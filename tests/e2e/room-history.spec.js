import { test, expect } from "@playwright/test";
import { waitForAppBoot } from "./boot.js";

const LEAGUE = "1360686137898700800";

const viewports = [
  { width: 390, height: 844 },
  { width: 1280, height: 800 },
];

const ROOM_NAME = {
  board: "League",
  scores: "This week",
  activity: "Activity",
  history: "History",
  team: "My team",
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
  const name = ROOM_NAME[room];
  const phone = page.viewportSize().width <= 700;
  if (phone) {
    const open = await page.locator("body").evaluate((body) => body.classList.contains("rail-open"));
    if (!open) await page.getByRole("button", { name: "Sections" }).click();
    const section = page.locator("#phone-desk").getByRole("button", { name: "My League" });
    if ((await section.getAttribute("aria-expanded")) !== "true") await section.click();
    await page.locator("#phone-desk").getByRole("button", { name, exact: true }).click();
    return;
  }
  await page.locator("#room-nav").getByRole("tab", { name, exact: true }).click();
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

async function expectRoom(page, pathname, room) {
  await expect.poll(() => pathOf(page.url())).toBe(pathname);
  await expect(page.locator(`[data-room-panel="${room}"]`)).toBeVisible();
  for (const other of ["team", "board", "scores", "activity", "history"]) {
    if (other === room) continue;
    await expect(page.locator(`[data-room-panel="${other}"]`)).toBeHidden();
  }
}

for (const viewport of viewports) {
  test(`league rooms keep their own history at ${viewport.width}`, async ({ page }) => {
    await watchSlashReplace(page);
    await page.setViewportSize(viewport);
    await loadLeague(page);
    await expectRoom(page, `/l/${LEAGUE}/team`, "team");
    await expect(page).toHaveTitle(/^My team · Dynasty Ticker/);

    await openRoom(page, "board");
    await expectRoom(page, `/l/${LEAGUE}/league`, "board");
    await expect(page).toHaveTitle(/^League · Dynasty Ticker/);

    await openRoom(page, "scores");
    await expectRoom(page, `/l/${LEAGUE}/week`, "scores");
    await expect(page).toHaveTitle(/^This week · Dynasty Ticker/);

    await openRoom(page, "activity");
    await expectRoom(page, `/l/${LEAGUE}/activity`, "activity");
    await expect(page).toHaveTitle(/^Activity · Dynasty Ticker/);

    await page.goBack();
    await expectRoom(page, `/l/${LEAGUE}/week`, "scores");
    await expect(page).toHaveTitle(/^This week · Dynasty Ticker/);

    await page.goBack();
    await expectRoom(page, `/l/${LEAGUE}/league`, "board");
    await expect(page).toHaveTitle(/^League · Dynasty Ticker/);

    await page.goForward();
    await expectRoom(page, `/l/${LEAGUE}/week`, "scores");
    await expect(page).toHaveTitle(/^This week · Dynasty Ticker/);
    await expect(page).not.toHaveTitle("Dynasty Ticker — Your Sleeper dynasty league");

    const slashes = await page.evaluate(() => window.__slashReplaces);
    expect(slashes).toEqual([]);
  });

  test(`back and forward restore the room and the player at ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await loadLeague(page);
    await expectRoom(page, `/l/${LEAGUE}/team`, "team");
    const roomTitle = await page.title();
    const player = page.locator("[data-room-panel='team'] [data-action='open-player']").first();
    await expect(player).toBeVisible({ timeout: 30000 });
    await player.click();
    const sheet = page.locator(".player-week-sheet");
    await expect(sheet).toBeVisible();
    const playerName = (await sheet.locator("h2, h3").first().innerText()).trim();
    await expect.poll(() => page.title()).toContain(playerName);
    await page.goBack();
    await expectRoom(page, `/l/${LEAGUE}/team`, "team");
    await expect(page).toHaveTitle(roomTitle);
    await expect(sheet).toBeHidden();
    await page.goForward();
    await expect(sheet).toBeVisible();
    await expect.poll(() => page.title()).toContain(playerName);
  });
}

for (const viewport of viewports) {
  test(`cold room urls open that room at ${viewport.width}`, async ({ page }) => {
    test.setTimeout(180000);
    await page.setViewportSize(viewport);
    const rooms = [
      ["/league", "League", "board"],
      ["/week", "This week", "scores"],
      ["/activity", "Activity", "activity"],
      ["/history", "History", "history"],
    ];
    for (const [suffix, title, room] of rooms) {
      await page.goto("about:blank");
      const before = await page.evaluate(() => history.length);
      await page.goto(`/l/${LEAGUE}${suffix}`);
      await expect(page.locator("body")).toHaveClass(/league-loaded/, { timeout: 30000 });
      await expect.poll(() => pathOf(page.url())).toBe(`/l/${LEAGUE}${suffix}`);
      await expect(page).toHaveTitle(new RegExp(`^${title} · Dynasty Ticker`));
      await expect(page.locator(`[data-room-panel="${room}"]`)).toBeVisible();
      await expect(page.locator(`[data-room-panel="${room}"] h2`).first()).toBeVisible();
      const after = await page.evaluate(() => history.length);
      expect(after).toBeGreaterThanOrEqual(before);
      expect(after).toBeLessThanOrEqual(before + 1);
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
  await expect.poll(() => pathOf(page.url())).toBe(`/l/${LEAGUE}/team`);
  await expect(page.locator("[data-room-panel='team']")).toBeVisible();
  await expect(page.locator("#landing")).toBeHidden();
});

test("history focus waits for the archive at 390", async ({ page }) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 390, height: 844 });
  await loadLeague(page);
  await openRoom(page, "history");
  await expect(page.locator("#history-dashboard")).toContainText(/games in the archive/i, { timeout: 60000 });
  await expect.poll(() => page.evaluate(() => ({
    id: document.activeElement?.id || "",
    text: (document.activeElement?.textContent || "").replace(/\s+/g, " ").trim(),
  }))).toEqual({
    id: "history-heading",
    text: "Titles, records, and who stayed",
  });
});

test("an unknown numeric league room returns home", async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/l/1/activity");
  await expect(page.locator("#landing")).toBeVisible();
  await expect.poll(() => {
    const url = new URL(page.url());
    return `${url.pathname}${url.search}`;
  }, { timeout: 45000 }).toBe("/");
  await expect(page.locator("body")).not.toHaveClass(/league-loaded/);
});
