import { test, expect } from "@playwright/test";

const viewports = [
  { width: 390, height: 844 },
  { width: 1280, height: 800 },
];

async function openGibbs(page) {
  await page.goto("/");
  await page.locator("[data-action='open-public-ranks']").evaluate((el) => el.click());
  await page.waitForSelector("[data-input='ranks-search']", { timeout: 30000 });
  await page.evaluate(() => {
    const input = document.querySelector("[data-input='ranks-search']");
    input.value = "Jahmyr Gibbs";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.waitForFunction(() => {
    return [...document.querySelectorAll("[data-action='rank-open']")].some((el) => el.textContent.includes("Jahmyr Gibbs"));
  }, null, { timeout: 15000 });
  await page.evaluate(() => {
    const button = [...document.querySelectorAll("[data-action='rank-open']")].find((el) => el.textContent.includes("Jahmyr Gibbs"));
    button.click();
  });
  await expect(page).toHaveURL(/\/player\/\d+/);
  await expect(page.locator(".ranks-card h2")).toHaveText("Jahmyr Gibbs");
  return page.url();
}

for (const viewport of viewports) {
  test(`back from a player stays on the desk at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openGibbs(page);
    await page.goBack();
    await expect(page).not.toHaveURL(/\/player\//);
    await expect(page.locator(".ranks-card")).toHaveCount(0);
    await expect(page.getByRole("searchbox", { name: "Search players and picks" })).toBeVisible();
    await expect(page.locator("#trades-page")).toBeHidden();

    await page.locator("#trades-tab").evaluate((el) => el.click());
    await expect(page.locator("#trades-page")).toBeVisible();
    await page.locator("#players-tab").evaluate((el) => el.click());
    await expect(page.locator("#players-page")).toBeVisible();
    await page.evaluate(() => {
      const input = document.querySelector("[data-input='ranks-search']");
      input.value = "Jahmyr Gibbs";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await page.waitForFunction(() => {
      return [...document.querySelectorAll("[data-action='rank-open']")].some((el) => el.textContent.includes("Jahmyr Gibbs"));
    });
    await page.evaluate(() => {
      const button = [...document.querySelectorAll("[data-action='rank-open']")].find((el) => el.textContent.includes("Jahmyr Gibbs"));
      button.click();
    });
    await expect(page.locator(".ranks-card")).toBeVisible();
    await page.goBack();
    await expect(page.locator(".ranks-card")).toHaveCount(0);
    await expect(page.locator("#players-page")).toBeVisible();
    await expect(page).not.toHaveURL(/\/player\//);

    if (viewport.width < 700) {
      await page.locator("#mobile-rail-toggle").evaluate((el) => el.click());
      await expect(page.locator("body")).toHaveClass(/rail-open/);
      await page.goBack();
      await expect(page.locator("body")).not.toHaveClass(/rail-open/);
      await expect(page.locator("#players-page")).toBeVisible();
    }
  });
}

test("cold load of /player/<id> opens that player", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const playerUrl = await openGibbs(page);
  const path = new URL(playerUrl).pathname;
  await page.goto(path);
  await expect(page.locator(".ranks-card h2")).toHaveText("Jahmyr Gibbs", { timeout: 30000 });
  await expect(page).toHaveURL(new RegExp(`${path}$`));
});
