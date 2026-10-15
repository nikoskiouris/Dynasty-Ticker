import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

const VALUES = JSON.parse(readFileSync(new URL("../../docs/data/player_values.json", import.meta.url), "utf8"));
const STAMP = new Date(Date.parse(VALUES.asOf)).toISOString().replace(/[^0-9]/g, "").slice(0, 12);
const OLD = "202610071117";

// Real Sleeper ids: 4984 Josh Allen, 9221 Jahmyr Gibbs. Superflex.
const CODE = "1s4984.p27r1e~9221";
const viewports = [
  { width: 390, height: 844 },
  { width: 1280, height: 800 },
];

test("bots get the trade's meta without running JS", async ({ request }) => {
  const res = await request.get(`/t/${CODE}`);
  expect(res.status()).toBe(200);
  const html = await res.text();
  expect(html).toContain(`<meta property="og:url" content="http://127.0.0.1:4173/t/${CODE}" />`);
  expect(html).toMatch(/<meta property="og:image" content="http:\/\/127\.0\.0\.1:4173\/og\/t\/1s4984\.p27r1e~9221\.png(\?v=\d+)?" \/>/);
  expect(html).toContain('<meta name="twitter:card" content="summary_large_image" />');
  expect((html.match(/property="og:title"/g) || []).length).toBe(1);
  const card = await request.get(`/og/t/${CODE}.png`);
  expect(card.status()).toBe(200);
  expect(card.headers()["content-type"]).toBe("image/png");
  expect(card.headers()["cache-control"]).toContain("immutable");
  expect((await request.get("/og/t/nope.png")).status()).toBe(404);
});

for (const viewport of viewports) {
  test(`a shared link reopens the trade and Share copies it at ${viewport.width}x${viewport.height}`, async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.addInitScript(() => {
      // Desktop Chromium has no share sheet here; force the copy fallback.
      Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
    });
    await page.setViewportSize(viewport);
    await page.goto(`/t/${CODE}`);
    const verdict = page.locator("#value-calc-verdict .calc-summary");
    await expect(verdict).toBeVisible({ timeout: 30000 });
    await expect(verdict.locator("h3")).not.toHaveText("");
    await expect(page.locator("[data-draft-side='left'] .calc-selected")).toContainText(/2027/);
    const share = page.locator("[data-action='trade-share']");
    await expect(share).toBeVisible();
    const box = await share.boundingBox();
    expect(box.height).toBeLessThanOrEqual(36);
    await share.click();
    const status = page.locator(".calc-share-status");
    await expect(status).toHaveAttribute("role", "status");
    await expect(status).toHaveText("Link copied.");
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    // The sharer's link carries the board's price stamp.
    expect(copied).toBe(`http://127.0.0.1:4173/t/2s${STAMP}4984.p27r1e~9221`);
  });

  test(`a dated link on today's board shows one verdict at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto(`/t/2s${STAMP}4984~9221`);
    const verdict = page.locator("#value-calc-verdict .calc-summary");
    await expect(verdict).toBeVisible({ timeout: 30000 });
    await page.waitForLoadState("networkidle");
    await expect(page.locator(".calc-shared")).toHaveCount(0);
    await expect(verdict.locator("h3")).not.toContainText("Today:");
  });

  test(`a dated link whose prices moved shows shared and today at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    // An older archived board where Gibbs cost twice as much.
    await page.route(`**/data/price-history/${OLD}.json`, (route) => route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ asOf: "2026-10-07T11:17:00+00:00", sf: { ...VALUES.sf, "player:9221": VALUES.sf["player:9221"] * 2 }, oneQb: VALUES.oneQb }),
    }));
    await page.setViewportSize(viewport);
    await page.goto(`/t/2s${OLD}4984~9221`);
    const shared = page.locator(".calc-shared");
    await expect(shared).toBeVisible({ timeout: 30000 });
    await expect(shared).toContainText("Shared verdict (Oct 7)");
    await expect(page.locator("#value-calc-verdict h3")).toContainText("Today:");
    const box = await shared.boundingBox();
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
  });

  test(`an unknown date falls back to today's prices at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/t/2s2025010112004984~9221");
    await expect(page.locator("#value-calc-verdict .calc-summary")).toBeVisible({ timeout: 30000 });
    await expect(page.locator(".calc-shared")).toHaveCount(0);
  });
}

test("a bad share code goes home", async ({ page }) => {
  await page.goto("/t/not-a-trade");
  await expect(page.locator("#landing")).toBeVisible({ timeout: 30000 });
});
