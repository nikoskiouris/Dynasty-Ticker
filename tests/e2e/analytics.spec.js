import { test, expect } from "@playwright/test";

// The analytics layer opts out under automation and on localhost, so these
// tests inject a recording adapter (honoured only on a local host) and check
// the exact event sequence. They also check no request leaves for a third
// party: only the site itself and the Sleeper data/CDN hosts the desk
// already uses are allowed.
const viewports = [
  { width: 390, height: 844 },
  { width: 1280, height: 800 },
];
const ALLOWED_HOSTS = new Set(["127.0.0.1:4173", "api.sleeper.app", "sleepercdn.com"]);
const LEAGUE_ID = "1360686137898700800";

async function instrument(page) {
  const hosts = new Set();
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.protocol === "http:" || url.protocol === "https:") hosts.add(url.host);
  });
  await page.addInitScript(() => {
    window.__dtEvents = [];
    window.__dtAnalyticsTestAdapter = {
      pageview(route, context) { window.__dtEvents.push({ type: "pageview", route, context }); },
      event(name, props) { window.__dtEvents.push({ type: "event", name, props }); },
    };
  });
  return hosts;
}

const events = (page) => page.evaluate(() => window.__dtEvents.map((row) => (
  row.type === "pageview" ? `pageview ${row.route}` : `${row.name} ${JSON.stringify(row.props)}`
)));

function expectNoThirdParty(hosts) {
  const outside = [...hosts].filter((host) => !ALLOWED_HOSTS.has(host));
  expect(outside).toEqual([]);
}

async function expectClean(page) {
  const raw = JSON.stringify(await page.evaluate(() => window.__dtEvents));
  expect(raw).not.toMatch(/\d{4,}|player:|pick:/);
}

for (const viewport of viewports) {
  test(`landing, players, back and a player send one pageview each at ${viewport.width}`, async ({ page }) => {
    const hosts = await instrument(page);
    await page.setViewportSize(viewport);
    await page.goto("/");
    await page.waitForFunction(() => document.querySelectorAll("[data-action='rank-open']").length > 0);
    await expect.poll(() => events(page)).toEqual(["pageview /", "landing_view {}"]);

    if (viewport.width < 700) {
      await page.locator("#mobile-rail-toggle").evaluate((el) => el.click());
      await page.locator("[data-phone-page='players']").evaluate((el) => el.click());
    } else {
      await page.locator("#players-tab").evaluate((el) => el.click());
    }
    await expect(page).toHaveURL(/\/players$/);
    await page.goBack();
    await expect(page.locator("#landing")).toBeVisible();
    await page.locator("[data-action='rank-open']").first().evaluate((el) => el.click());
    await expect(page).toHaveURL(/\/player\/\d+/);

    await expect.poll(() => events(page)).toEqual([
      "pageview /",
      "landing_view {}",
      "pageview /players",
      "pageview /",
      "landing_view {}",
      "pageview /player/:id",
    ]);
    await expectClean(page);
    expectNoThirdParty(hosts);
  });

  test(`a checked trade fires once and a league connect fires once at ${viewport.width}`, async ({ page }) => {
    const hosts = await instrument(page);
    await page.setViewportSize(viewport);
    await page.goto("/trade?give=player:4046&get=player:9509");
    await expect(page.locator("#value-calc-verdict .calc-summary")).toBeVisible({ timeout: 30000 });
    // Re-renders of the same trade (resize, data refresh) must not re-fire.
    await page.setViewportSize({ width: viewport.width === 390 ? 1280 : 390, height: 844 });
    await page.setViewportSize(viewport);
    await page.waitForTimeout(500);
    await expect.poll(() => events(page)).toEqual(["pageview /trade", 'trade_checked {"mode":"public"}']);

    await page.goto("/");
    await page.locator("#league-id").evaluate((el, id) => { el.value = id; }, LEAGUE_ID);
    await page.locator("#load-league-btn").evaluate((el) => el.click());
    await expect(page).toHaveURL(new RegExp(`/l/${LEAGUE_ID}/team`), { timeout: 30000 });
    await page.waitForTimeout(500);
    const after = await events(page);
    expect(after.filter((row) => row.startsWith("league_connected"))).toEqual(['league_connected {"sample":"no"}']);
    expect(after).toContain("pageview /l/:id/team");
    expect(after.indexOf('league_connected {"sample":"no"}')).toBeGreaterThan(after.indexOf("pageview /"));
    await expectClean(page);
    expectNoThirdParty(hosts);
  });
}

test("without an injected adapter, automation opts out and nothing is recorded", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => document.querySelectorAll("[data-action='rank-open']").length > 0);
  const injected = await page.evaluate(() => "__dtAnalyticsTestAdapter" in window);
  expect(injected).toBe(false);
  expect(await page.evaluate(() => navigator.webdriver)).toBe(true);
});
