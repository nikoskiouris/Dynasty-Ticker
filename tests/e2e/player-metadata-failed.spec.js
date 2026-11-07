import { test, expect } from "@playwright/test";

// Sleeper's player file is blocked. The bundled values still carry each
// player's name, position, and team, so the roster settles with real names:
// no ids, no endless loading rows. The "names couldn't load" note and Retry
// appear only when a rostered player has no name anywhere.
test("blocked player files still settle the roster with real names at 390", async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/nfl_players_slim.json", (route) => route.abort("failed"));
  await page.route("https://api.sleeper.app/v1/players/nfl**", (route) => {
    const url = route.request().url();
    if (url.includes("/trending/")) return route.continue();
    return route.abort("failed");
  });

  await page.goto("/?sample=1");
  const sheet = page.locator("#roster-sheet");
  const rows = sheet.locator(".sheet-row:not(.empty):not(.pick)");
  await expect(rows.first()).toBeVisible({ timeout: 45000 });
  await expect(sheet.locator("[aria-busy='true']")).toHaveCount(0, { timeout: 45000 });
  await expect(sheet.locator(".sr-only", { hasText: "Loading player" })).toHaveCount(0);
  await expect(sheet.locator(".loading-row")).toHaveCount(0);

  const names = await rows.locator(".sheet-player strong").allInnerTexts();
  expect(names.length).toBeGreaterThan(0);
  for (const name of names) {
    expect(name, name).not.toMatch(/…/);
    expect(name, name).not.toMatch(/Player\s+\d+/);
    expect(name, name).not.toMatch(/\b\d{5,}\b/);
    expect(name, name).not.toMatch(/Unknown player/);
  }
  const values = await rows.locator(".mono").allInnerTexts();
  expect(values.some((value) => /\d/.test(value))).toBe(true);

  const unnamed = names.filter((name) => name.includes("Details unavailable")).length;
  const note = sheet.locator(".roster-names-note");
  if (unnamed) {
    await expect(note).toContainText("Player names couldn't load. Values still work; try again later.");
    await expect(sheet.getByRole("button", { name: "Retry" })).toBeVisible();
  } else {
    await expect(note).toHaveCount(0);
  }

  const layout = await rows.first().evaluate((row) => {
    const name = row.querySelector(".sheet-player");
    return { name: name.getBoundingClientRect().width, row: row.getBoundingClientRect().width };
  });
  expect(layout.row).toBeGreaterThan(200);
  expect(layout.name).toBeGreaterThan(layout.row * 0.4);
});
