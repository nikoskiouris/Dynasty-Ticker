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
    await expect(share).toHaveText("Share trade");
    await share.click();
    const status = page.locator(".calc-share-status");
    await expect(status).toHaveAttribute("role", "status");
    await expect(status).toHaveText("Link copied.");
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    // The sharer's link carries the board's price stamp.
    expect(copied).toBe(`http://127.0.0.1:4173/t/2s${STAMP}4984.p27r1e~9221`);
    // "Link copied." clears itself after about 4s.
    await expect(status).toHaveText("", { timeout: 6000 });
  });

  test(`a cold shared link shows names, never raw ids, at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    // Real Sleeper ids: 9509 Bijan Robinson, 11632 Malik Nabers, plus the 2027 early 1st.
    const cold = `/t/2s${STAMP}9509~11632.p27r1e`;
    await page.setViewportSize(viewport);
    await page.goto(cold);
    const verdict = page.locator("#value-calc-verdict .calc-summary");
    await expect(verdict).toBeVisible({ timeout: 30000 });
    await expect(page.locator("[data-draft-side='left'] .calc-selected")).toContainText("Bijan Robinson");
    await expect(page.locator("[data-draft-side='right'] .calc-selected")).toContainText("Malik Nabers");
    await expect(page.locator("[data-draft-side='right'] .calc-selected")).toContainText("2027 Early 1st");
    const text = await page.locator("body").innerText();
    expect(text).not.toMatch(/player:|pick:/);
    // The address bar keeps the share link.
    expect(new URL(page.url()).pathname).toBe(cold);
  });

  test(`a player missing from the board shows a skeleton until Sleeper names load at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.route("**/data/player_values.json", async (route) => {
      const res = await route.fetch();
      const body = await res.json();
      delete body.names["player:9509"];
      await route.fulfill({ response: res, json: body });
    });
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    await page.route("https://api.sleeper.app/v1/players/nfl", async (route) => {
      await gate;
      await route.fulfill({ json: { 9509: { player_id: "9509", full_name: "Bijan Robinson", first_name: "Bijan", last_name: "Robinson", position: "RB", team: "ATL" } } });
    });
    await page.setViewportSize(viewport);
    await page.goto(`/t/2s${STAMP}9509~11632`);
    const left = page.locator("[data-draft-side='left'] .calc-selected");
    await expect(left.locator(".name-skeleton")).toBeVisible({ timeout: 30000 });
    expect(await page.locator("body").innerText()).not.toMatch(/player:|pick:/);
    release();
    await expect(left).toContainText("Bijan Robinson", { timeout: 15000 });
    await expect(left.locator(".name-skeleton")).toHaveCount(0);
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
    // One neutral vocabulary: both rows name a side the same way.
    const VERDICT = "(Fair trade · [\\d.]+% apart|(Fair, slight edge|Favors one side|Lopsided) · (Give|Get) side worth [\\d.]+% more)";
    await expect(shared.locator("div").first()).toHaveText(new RegExp(`^Oct 7\\s*${VERDICT}$`));
    await expect(shared.locator(".is-today")).toHaveText(new RegExp(`^Today\\s*${VERDICT}$`));
    await expect(page.locator(".calc-shared-note")).toHaveText("Prices moved since this was shared.");
    const heading = page.locator("#value-calc-verdict h3");
    await expect(heading).toHaveText(new RegExp(`^Shared on Oct 7: ${VERDICT}\\. Today: ${VERDICT}\\.$`));
    await expect(page.locator("#value-calc-verdict")).not.toContainText(/for them|in favor of|overpay|\bwins?\b|leans/i);
    const box = await shared.boundingBox();
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
  });

  test(`disclaimers sit behind an accessible info button on a shared link at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    // Bijan for Nabers + a 1st gets package credit, so there is fine print to hide.
    await page.goto(`/t/2s${STAMP}9509~11632.p27r1e`);
    const toggle = page.locator("[data-action='verdict-info']");
    await expect(toggle).toBeVisible({ timeout: 30000 });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(toggle).toHaveAccessibleName("How this verdict works");
    const fine = page.locator(".verdict-fine-print");
    await expect(fine).toBeHidden();
    await expect(page.locator("#value-calc-verdict")).not.toContainText("Package credit");
    const box = await toggle.boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.width).toBeGreaterThanOrEqual(44);
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(fine).toBeVisible();
    await expect(fine).toContainText("Stars cost extra");
    await toggle.click();
    await expect(fine).toBeHidden();
  });

  test(`an unknown date falls back to today's prices at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/t/2s2025010112004984~9221");
    await expect(page.locator("#value-calc-verdict .calc-summary")).toBeVisible({ timeout: 30000 });
    await expect(page.locator(".calc-shared")).toHaveCount(0);
  });
}

const BAD_CODES = {
  garbage: "zzz",
  truncated: "2s202610141917~",
  "400 characters": "9".repeat(400),
  "out-of-range date": "2s2099999999999221~p27r1e",
  "wrong version": "3s4984~9221",
};

for (const [name, code] of Object.entries(BAD_CODES)) {
  test(`a broken share link (${name}) says so and offers a trade check`, async ({ page, request }) => {
    const res = await request.get(`/t/${code}`);
    expect(res.status()).toBe(404);
    expect(res.headers()["x-robots-tag"]).toBe("noindex");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/t/${code}`);
    const alert = page.locator(".share-broken[role='alert']");
    await expect(alert).toBeVisible({ timeout: 30000 });
    // The calculator is usable underneath once prices load.
    await expect(page.locator(".calc-grid")).toBeVisible({ timeout: 30000 });
    await expect(alert).toBeVisible();
    await expect(alert.locator("h3")).toHaveText("This trade link is broken or expired");
    const link = alert.getByRole("link", { name: "Check a trade" });
    await expect(link).toHaveAttribute("href", "/trade");
    const box = await link.boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(44);
    await expect(page.locator("#landing")).toBeHidden();
    await link.click();
    await expect(page).toHaveURL(/\/trade$/);
    await expect(page.locator(".share-broken")).toHaveCount(0);
  });
}

test("a bad code with a saved trade still shows the notice and keeps the trade", async ({ page }) => {
  await page.goto("/trade?give=player:4984&get=player:9221");
  await expect(page.locator("#value-calc-verdict .calc-summary")).toBeVisible({ timeout: 30000 });
  await page.goto("/t/zzz");
  const alert = page.locator(".share-broken[role='alert']");
  await expect(page.locator(".calc-grid")).toBeVisible({ timeout: 30000 });
  await expect(alert).toBeVisible();
  await expect(alert.locator("h3")).toHaveText("This trade link is broken or expired");
  await expect(page.locator("[data-draft-side='left'] .calc-selected")).toContainText("Josh Allen");
  await expect(page.locator("[data-draft-side='right'] .calc-selected")).toContainText("Jahmyr Gibbs");
});

test("the /trade headline carries the % like the card", async ({ page }) => {
  await page.goto("/trade?give=player:9221&get=pick:2027:r1:early,pick:2028:r1:any");
  const heading = page.locator("#value-calc-verdict h3");
  // Gibbs for two 1sts: credited 21,031 vs 11,112 -> 89.3% more.
  await expect(heading).toHaveText("Lopsided · Give side worth 89.3% more", { timeout: 30000 });
});

test("Esc closes the info panel and returns focus to its button", async ({ page }) => {
  await page.goto(`/t/2s${STAMP}9509~11632.p27r1e`);
  const toggle = page.locator("[data-action='verdict-info']");
  await expect(toggle).toBeVisible({ timeout: 30000 });
  await toggle.click();
  await expect(page.locator(".verdict-fine-print")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator(".verdict-fine-print")).toBeHidden();
  await expect(toggle).toBeFocused();
});

test("pane totals say players & picks, not assets", async ({ page }) => {
  await page.goto(`/t/2s${STAMP}9509~11632.p27r1e`);
  await expect(page.locator("#value-calc-verdict .calc-summary")).toBeVisible({ timeout: 30000 });
  await expect(page.locator("[data-draft-side='right'] .calc-pane-total small")).toHaveText("2 players & picks");
  await expect(page.locator("[data-draft-side='left'] .calc-pane-total small")).toHaveText("1 player or pick");
});

test("after sharing from /trade the sender's address bar shows /t/<code>", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
  });
  await page.goto("/trade?give=player:4984&get=player:9221");
  const share = page.locator("[data-action='trade-share']");
  await expect(share).toBeVisible({ timeout: 30000 });
  await share.click();
  await expect(page.locator(".calc-share-status")).toHaveText("Link copied.");
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(new URL(copied).pathname).toBe(new URL(page.url()).pathname);
  expect(new URL(page.url()).pathname).toBe(`/t/2s${STAMP}4984~9221`);
  // Share pushed a history entry: Back returns to the /trade URL.
  await page.goBack();
  await expect(page).toHaveURL(/\/trade\?give=player(:|%3A)4984&get=player(:|%3A)9221$/);
  await expect(page.locator("#value-calc-verdict .calc-summary")).toBeVisible();
  await page.waitForTimeout(300);
  expect(new URL(page.url()).pathname).toBe("/trade");
});
