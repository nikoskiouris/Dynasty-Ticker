import { test, expect } from "@playwright/test";

async function visibleHeadings(page) {
  return page.locator("h1").evaluateAll((nodes) => nodes
    .filter((node) => {
      const style = getComputedStyle(node);
      const box = node.getBoundingClientRect();
      return style.display !== "none"
        && style.visibility !== "hidden"
        && box.width > 0
        && box.height > 0;
    })
    .map((node) => (node.textContent || "").replace(/\s+/g, " ").trim()));
}

test("a bad league link has one heading, and Find my leagues returns home", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/l/x");
  const title = page.locator("#league-missing-title");
  await expect(title).toBeVisible({ timeout: 30000 });
  await expect(title).toBeFocused();
  await expect(page).toHaveTitle("We couldn't find that league — Dynasty Ticker");
  await expect(page.locator("body")).toHaveClass(/launch-open/);
  expect(await visibleHeadings(page)).toEqual(["We couldn't find that league"]);
  await expect(page.locator("#mobile-chrome-title")).toBeHidden();
  await expect(page.locator("#workspace-header")).toBeHidden();
  await expect(page.locator("#hero-lede")).toBeHidden();

  const find = page.locator(".league-missing-primary");
  await expect(find).toHaveText("Find my leagues");
  const hit = await find.evaluate((el) => {
    const box = el.getBoundingClientRect();
    const before = getComputedStyle(el, "::before");
    const top = Number.parseFloat(before.top);
    const bottom = Number.parseFloat(before.bottom);
    const extraTop = Number.isFinite(top) ? Math.max(0, -top) : 0;
    const extraBottom = Number.isFinite(bottom) ? Math.max(0, -bottom) : 0;
    return box.height + extraTop + extraBottom;
  });
  expect(hit).toBeGreaterThanOrEqual(44);

  await find.click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page).toHaveTitle("Dynasty Ticker — Your Sleeper dynasty league");
  await expect(page.locator("#landing-username")).toBeFocused();
  await expect(page.locator("#landing")).toBeVisible();
  await expect(page.locator("#league-missing")).toBeHidden();

  await page.goBack();
  await expect(page).toHaveURL(/\/l\/x$/);
  await expect(page.locator("#league-missing-title")).toBeVisible();
  await expect(page).toHaveTitle("We couldn't find that league — Dynasty Ticker");
  expect(await visibleHeadings(page)).toEqual(["We couldn't find that league"]);
});

test("an empty /l id is the missing-league state, and /l/x.json stays a 404", async ({ page }) => {
  for (const path of ["/l", "/l/"]) {
    const res = await page.goto(path);
    expect(res.status()).toBe(200);
    await expect(page.locator("#league-missing-title")).toBeVisible({ timeout: 30000 });
    await expect(page.locator("#league-missing-title")).toHaveText("We couldn't find that league");
    await expect(page).toHaveTitle("We couldn't find that league — Dynasty Ticker");
  }
  const missing = await page.request.get("/l/x.json");
  expect(missing.status()).toBe(404);
});

test("a Sleeper outage has its own heading, alert, and title", async ({ page }) => {
  await page.route("**/api.sleeper.app/**", (route) => route.abort());
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/l/1360686137898700800");
  const title = page.locator("#sleeper-down-title");
  await expect(title).toBeVisible({ timeout: 30000 });
  await expect(title).toHaveText("Couldn't reach Sleeper");
  await expect(title).toBeFocused();
  await expect(page.locator("#sleeper-down")).toHaveAttribute("role", "alert");
  await expect(page).toHaveTitle("Couldn't reach Sleeper — Dynasty Ticker");
  await expect(page.locator("#league-missing")).toBeHidden();
  await expect(page.locator("body")).toHaveClass(/launch-open/);
  expect(await visibleHeadings(page)).toEqual(["Couldn't reach Sleeper"]);
  await expect(page.locator("#sleeper-down-retry")).toBeVisible();
});
