import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

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
    // After Back the landing list can re-render under the click; retry until
    // the open lands (a click that did navigate is never repeated).
    await expect(async () => {
      if (!/\/player\/\d+/.test(page.url())) await page.locator("[data-action='rank-open']").first().evaluate((el) => el.click());
      await expect(page).toHaveURL(/\/player\/\d+/, { timeout: 1000 });
    }).toPass({ timeout: 10000 });

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
    // The room URL is pushed before the Sleeper fetches finish; league_connected
    // fires when the load lands, so wait for it rather than a fixed delay.
    await expect.poll(async () => (await events(page)).filter((row) => row.startsWith("league_connected")).length, { timeout: 30000 }).toBeGreaterThan(0);
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

// #164 hooks: t_opened once per /t open (drift yes/no), share_tapped once per share.
const VALUES_167 = JSON.parse(require_values());
function require_values() {
  return readFileSync(new URL("../../docs/data/player_values.json", import.meta.url), "utf8");
}
const STAMP_167 = new Date(Date.parse(VALUES_167.asOf)).toISOString().replace(/[^0-9]/g, "").slice(0, 12);

test("a /t link sends one t_opened with drift no, and Share copy sends share_tapped copy", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const hosts = await instrument(page);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
  });
  await page.goto(`/t/2s${STAMP_167}4984~9221`);
  await expect(page.locator("#value-calc-verdict .calc-summary")).toBeVisible({ timeout: 30000 });
  await expect.poll(async () => (await events(page)).filter((e) => e.startsWith("t_opened"))).toEqual(['t_opened {"drift":"no"}']);
  await page.locator("[data-action='trade-share']").click();
  await expect(page.locator(".calc-share-status")).toHaveText("Link copied.");
  await expect.poll(async () => (await events(page)).filter((e) => e.startsWith("share_tapped"))).toEqual(['share_tapped {"method":"copy"}']);
  expect(await events(page)).toContain("pageview /t/:code");
  await expectClean(page);
  expectNoThirdParty(hosts);
});

test("a dated /t link whose prices moved sends t_opened drift yes; the share sheet sends webshare", async ({ page }) => {
  const OLD = "202610071117";
  await page.route("**/data/price-history/index.json", async (route) => {
    const index = await (await route.fetch()).json();
    const snapshots = Array.isArray(index.snapshots) ? index.snapshots.slice() : [];
    if (!snapshots.some((row) => row?.stamp === OLD)) {
      snapshots.push({ asOf: "2026-10-07T11:17:00+00:00", stamp: OLD });
    }
    await route.fulfill({ json: { ...index, snapshots } });
  });
  await page.route(`**/data/price-history/${OLD}.json`, (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ asOf: "2026-10-07T11:17:00+00:00", sf: { ...VALUES_167.sf, "player:9221": VALUES_167.sf["player:9221"] * 2 }, oneQb: VALUES_167.oneQb }),
  }));
  await instrument(page);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", { value: async () => {}, configurable: true });
  });
  await page.goto(`/t/2s${OLD}4984~9221`);
  await expect(page.locator(".calc-shared")).toBeVisible({ timeout: 30000 });
  await expect.poll(async () => (await events(page)).filter((e) => e.startsWith("t_opened"))).toEqual(['t_opened {"drift":"yes"}']);
  await page.locator("[data-action='trade-share']").click();
  await expect.poll(async () => (await events(page)).filter((e) => e.startsWith("share_tapped"))).toEqual(['share_tapped {"method":"webshare"}']);
  await expectClean(page);
});

test("a cancelled share sheet sends no share_tapped", async ({ page }) => {
  await instrument(page);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", { value: async () => { throw new DOMException("cancel", "AbortError"); }, configurable: true });
  });
  await page.goto(`/t/2s${STAMP_167}4984~9221`);
  await expect(page.locator("#value-calc-verdict .calc-summary")).toBeVisible({ timeout: 30000 });
  await page.locator("[data-action='trade-share']").click();
  await page.waitForTimeout(300);
  expect((await events(page)).filter((e) => e.startsWith("share_tapped"))).toEqual([]);
});
