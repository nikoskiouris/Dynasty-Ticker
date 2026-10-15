import { test, expect } from "@playwright/test";

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
    expect(copied).toBe(`http://127.0.0.1:4173/t/${CODE}`);
  });
}

test("a bad share code goes home", async ({ page }) => {
  await page.goto("/t/not-a-trade");
  await expect(page.locator("#landing")).toBeVisible({ timeout: 30000 });
});
