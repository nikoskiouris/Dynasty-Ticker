import { test, expect } from "@playwright/test";

const LEAGUE = "1360686137898700800";

const viewports = [
  { width: 390, height: 844 },
  { width: 1280, height: 800 },
];

async function loadLeague(page) {
  await page.goto("/");
  await page.locator("#league-id").evaluate((el) => {
    el.value = "1360686137898700800";
  });
  await page.locator("#load-league-btn").evaluate((el) => el.click());
  await expect(page).toHaveURL(new RegExp(`/l/${LEAGUE}/team`), { timeout: 30000 });
  await expect(page.locator("body")).toHaveClass(/league-loaded/);
}

async function openRoom(page, room) {
  await page.evaluate((roomId) => {
    const phone = window.matchMedia("(max-width: 700px), (max-height: 500px) and (orientation: landscape) and (hover: none) and (pointer: coarse)").matches;
    if (phone) {
      const toggle = document.querySelector("#mobile-rail-toggle");
      if (toggle && !document.body.classList.contains("rail-open")) toggle.click();
      const section = document.querySelector("[data-phone-page='league']");
      if (section && section.getAttribute("aria-expanded") !== "true") section.click();
      document.querySelector(`[data-phone-room="${roomId}"]`)?.click();
      return;
    }
    document.querySelector(`#room-nav [data-room="${roomId}"]`)?.click();
  }, room);
}

function pathOf(url) {
  return new URL(url).pathname;
}

for (const viewport of viewports) {
  test(`league rooms keep their own history at ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await loadLeague(page);
    await openRoom(page, "board");
    await expect.poll(() => pathOf(page.url())).toBe(`/l/${LEAGUE}/league`);
    await expect(page).toHaveTitle(/^League · Dynasty Ticker/);

    await openRoom(page, "scores");
    await expect.poll(() => pathOf(page.url())).toBe(`/l/${LEAGUE}/week`);
    await expect(page).toHaveTitle(/^This week · Dynasty Ticker/);

    await openRoom(page, "activity");
    await expect.poll(() => pathOf(page.url())).toBe(`/l/${LEAGUE}/activity`);
    await expect(page).toHaveTitle(/^Activity · Dynasty Ticker/);

    await page.goBack();
    await expect.poll(() => pathOf(page.url())).toBe(`/l/${LEAGUE}/week`);
    await expect(page).toHaveTitle(/^This week · Dynasty Ticker/);
    await expect(page.locator("[data-room-panel='scores'] h2").first()).toBeVisible();

    await page.goBack();
    await expect.poll(() => pathOf(page.url())).toBe(`/l/${LEAGUE}/league`);
    await expect(page).toHaveTitle(/^League · Dynasty Ticker/);

    await page.goForward();
    await expect.poll(() => pathOf(page.url())).toBe(`/l/${LEAGUE}/week`);
    await expect(page).toHaveTitle(/^This week · Dynasty Ticker/);
    await expect(page).not.toHaveTitle("Dynasty Ticker — Your Sleeper dynasty league");
  });
}

test("cold room urls open that room", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const rooms = [
    ["/league", "League", "board"],
    ["/week", "This week", "scores"],
    ["/activity", "Activity", "activity"],
    ["/history", "History", "history"],
  ];
  for (const [suffix, title, room] of rooms) {
    await page.goto(`/l/${LEAGUE}${suffix}`);
    await expect(page.locator("body")).toHaveClass(/league-loaded/, { timeout: 30000 });
    await expect.poll(() => pathOf(page.url())).toBe(`/l/${LEAGUE}${suffix}`);
    await expect(page).toHaveTitle(new RegExp(`^${title} · Dynasty Ticker`));
    await expect(page.locator(`#room-nav [data-room="${room}"].active`)).toBeVisible();
    await expect(page.locator(`[data-room-panel="${room}"] h2`).first()).toBeVisible();
  }
});
