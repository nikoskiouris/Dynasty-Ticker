import { test, expect } from "@playwright/test";

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
  await expect(sheet.locator("[aria-busy='true']")).toHaveCount(0);
  await expect(sheet.locator(".sr-only", { hasText: "Loading player" })).toHaveCount(0);
  await expect(sheet.locator(".loading-row")).toHaveCount(0);

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
