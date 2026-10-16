import { test, expect } from "@playwright/test";

// The real beacon adapter, end to end. Localhost and automation normally opt
// out, so __dtAnalyticsForceBeacon (honoured on a local host only) turns the
// real adapter on, and /api/collect is intercepted.
const LEAGUE_ID = "1360686137898700800";
const REFERER = "https://t.co/abc123";

async function collect(page) {
  const sent = [];
  await page.addInitScript(() => { window.__dtAnalyticsForceBeacon = true; });
  await page.route("**/api/collect", async (route) => {
    sent.push(JSON.parse(route.request().postData() || "{}"));
    await route.fulfill({ status: 204 });
  });
  return sent;
}

const visits = (sent) => sent.filter((row) => row.e === "visit");

const COLD = [
  ["/", "/"],
  ["/players", "/players"],
  ["/trade", "/trade"],
  ["/trade?give=player:4046&get=player:9509", "/trade"],
  ["/player/9509/bijan-robinson", "/player/:id"],
  ["/t/1s4984~9221", "/t/:code"],
  ["/connect", "/connect"],
  [`/l/${LEAGUE_ID}/team`, "/l/:id/team"],
  [`/l/${LEAGUE_ID}/week`, "/l/:id/week"],
];

for (const [path, template] of COLD) {
  test(`cold ${path} sends exactly one visit with the referrer host`, async ({ page }) => {
    const sent = await collect(page);
    await page.goto(path, { referer: REFERER });
    if (path.startsWith("/l/")) {
      await expect.poll(() => sent.some((row) => row.e === "league_connected"), { timeout: 45000 }).toBe(true);
    }
    await expect.poll(() => visits(sent).length, { timeout: 15000 }).toBeGreaterThan(0);
    await page.waitForTimeout(1500);
    expect(visits(sent)).toEqual([{ e: "visit", p: template, r: "t.co" }]);
    // Only the first visit carries a referrer, and nothing carries an id.
    expect(sent.filter((row) => "r" in row)).toHaveLength(1);
    expect(JSON.stringify(sent)).not.toMatch(/\d{4,}|player:|t\.co\/abc/);
  });
}

test("a shared trade is tagged /trade, not /", async ({ page }) => {
  const sent = await collect(page);
  await page.goto("/");
  await expect.poll(() => visits(sent).length, { timeout: 15000 }).toBe(1);
  await page.goto("/trade?give=player:9509&get=player:11632,pick:2027:1:early");
  await expect(page).toHaveURL(/\/trade\?/);
  await expect.poll(() => sent.filter((row) => row.e === "trade_checked"), { timeout: 15000 })
    .toEqual([{ e: "trade_checked", p: "/trade", props: { mode: "public" } }]);
  expect(visits(sent).map((row) => row.p)).toEqual(["/", "/trade"]);
});

test("opening a league from /trade sends no extra / visit or landing_view", async ({ page }) => {
  test.setTimeout(90000);
  const sent = await collect(page);
  await page.goto("/trade?give=player:4046&get=player:9509");
  await expect.poll(() => sent.some((row) => row.e === "trade_checked"), { timeout: 30000 }).toBe(true);
  await page.locator("#league-id").evaluate((el, id) => { el.value = id; }, LEAGUE_ID);
  await page.locator("#load-league-btn").evaluate((el) => el.click());
  await expect.poll(() => sent.some((row) => row.e === "league_connected"), { timeout: 45000 }).toBe(true);
  await page.waitForTimeout(1000);
  expect(visits(sent).map((row) => row.p)).toEqual(["/trade"]);
  expect(sent.filter((row) => row.e === "landing_view")).toEqual([]);
  expect(sent.find((row) => row.e === "league_connected")).toEqual({ e: "league_connected", p: "/trade", props: { sample: "no" } });
});

test("DNT still wins over the forced beacon", async ({ browser }) => {
  const context = await browser.newContext({ extraHTTPHeaders: { DNT: "1" } });
  const page = await context.newPage();
  await page.addInitScript(() => Object.defineProperty(Navigator.prototype, "doNotTrack", { get: () => "1" }));
  const sent = await collect(page);
  await page.goto("/players", { referer: REFERER });
  await page.waitForTimeout(2500);
  expect(sent).toEqual([]);
  await context.close();
});
