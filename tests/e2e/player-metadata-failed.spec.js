import { test, expect } from "@playwright/test";

async function expectRosterNamesSettled(sheet) {
  const names = await sheet.locator(".directory-row .sheet-player").allInnerTexts();
  expect(names.length).toBeGreaterThan(0);
  expect(names.some((name) => name.includes("Details unavailable"))).toBe(true);
  expect(names.some((name) => name.includes("Unknown player"))).toBe(false);
  for (const name of names) {
    expect(name, name).not.toMatch(/…/);
    expect(name, name).not.toMatch(/Player\s+\d+/);
    expect(name, name).not.toMatch(/\b\d{5,}\b/);
  }
  const values = await sheet.locator(".directory-row .sheet-value").allInnerTexts();
  expect(values.some((value) => /\d/.test(value))).toBe(true);
  const unknown = sheet.locator(".directory-row").filter({ hasText: "Details unavailable" }).first();
  await expect(unknown.locator(".sheet-value")).not.toHaveText(/…/);
  const order = await sheet.evaluate((root) => {
    const note = root.querySelector(".roster-names-note");
    const row = root.querySelector(".directory-row");
    if (!note || !row) return null;
    return {
      note: note.getBoundingClientRect().bottom,
      row: row.getBoundingClientRect().top,
    };
  });
  expect(order).not.toBeNull();
  expect(order.note).toBeLessThanOrEqual(order.row);
}

test("blocked player files settle the roster failed state at 390", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/nfl_players_slim.json", (route) => route.abort("failed"));
  await page.route("https://api.sleeper.app/v1/players/nfl**", (route) => {
    const url = route.request().url();
    if (url.includes("/trending/")) return route.continue();
    return route.abort("failed");
  });

  await page.goto("/?sample=1");
  const sheet = page.locator("#roster-sheet");
  await expect(sheet.locator(".sr-only", { hasText: "Player details unavailable" })).toHaveCount(1, { timeout: 45000 });
  await expect(sheet.locator(".roster-names-note")).toContainText("Player names couldn't load. Values still work; try again later.");
  await expect(sheet.getByRole("button", { name: "Retry" })).toBeVisible();
  await expect(sheet.locator("[aria-busy='true']")).toHaveCount(0);
  await expect(sheet.locator(".sr-only", { hasText: "Loading player" })).toHaveCount(0);
  await expect(sheet.locator(".loading-row")).toHaveCount(0);
  await expectRosterNamesSettled(sheet);

  const layout = await sheet.locator(".directory-row").first().evaluate((row) => {
    const name = row.querySelector(".sheet-player");
    const rowBox = row.getBoundingClientRect();
    const nameBox = name.getBoundingClientRect();
    return {
      cols: getComputedStyle(row).gridTemplateColumns,
      name: nameBox.width,
      row: rowBox.width,
    };
  });
  expect(layout.row).toBeGreaterThan(200);
  expect(layout.name).toBeGreaterThan(layout.row * 0.55);

  const nextPlayers = page.waitForRequest((request) => {
    const url = request.url();
    return url.includes("api.sleeper.app/v1/players/nfl") && !url.includes("/trending/");
  });
  await sheet.getByRole("button", { name: "Retry" }).click();
  await nextPlayers;
  await expect(sheet.locator(".sr-only", { hasText: "Player details unavailable" })).toHaveCount(1);
  await expect(sheet.locator(".roster-names-note")).toContainText("Player names couldn't load. Values still work; try again later.");
  await expect(sheet.locator("[aria-busy='true']")).toHaveCount(0);
  await expect(sheet.locator(".sr-only", { hasText: "Loading player" })).toHaveCount(0);
  await expect(sheet.locator(".loading-row")).toHaveCount(0);
  await expectRosterNamesSettled(sheet);

  const contrast = await page.locator(".ticker-label").evaluate((el) => {
    function channel(value) {
      const n = value / 255;
      return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
    }
    function luminance(color) {
      const match = color.match(/rgba?\(([^)]+)\)/);
      const parts = match[1].split(",").map((part) => Number(part.trim()));
      return 0.2126 * channel(parts[0]) + 0.7152 * channel(parts[1]) + 0.0722 * channel(parts[2]);
    }
    function contrastOf(foreground, background) {
      const hi = Math.max(foreground, background);
      const lo = Math.min(foreground, background);
      return (hi + 0.05) / (lo + 0.05);
    }
    const style = getComputedStyle(el);
    const ratio = contrastOf(luminance(style.color), luminance(style.backgroundColor));
    return {
      ratio,
      color: style.color,
      background: style.backgroundColor,
      width: window.innerWidth,
      tag: document.querySelector("#ticker")?.tagName || "",
      pressed: document.querySelector("#ticker")?.getAttribute("aria-pressed"),
    };
  });
  expect(contrast.width).toBe(390);
  expect(contrast.tag).toBe("BUTTON");
  expect(contrast.pressed).toBe("false");
  expect(contrast.ratio).toBeGreaterThanOrEqual(4.5);
  console.log(`ticker-label contrast at 390: ${contrast.ratio.toFixed(2)} (${contrast.color} on ${contrast.background})`);
});
