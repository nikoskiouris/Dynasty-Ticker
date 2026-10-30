import { test, expect } from "@playwright/test";

const LEAGUE = "1360686137898700800";

async function openRoom(page, room) {
  if (page.viewportSize().width <= 700) {
    const open = await page.locator("body").evaluate((body) => body.classList.contains("rail-open"));
    if (!open) await page.locator("#mobile-rail-toggle").click();
    await page.locator(`#phone-desk [data-phone-room='${room}']`).click();
    return;
  }
  await page.locator(`.page-tab[data-room='${room}']`).click();
}

function readFocus(page) {
  return page.evaluate(() => {
    const el = document.activeElement;
    return { id: el?.id || "", tag: el?.tagName || "" };
  });
}

async function expectHeadingFocus(page, path) {
  await expect.poll(() => new URL(page.url()).pathname).toBe(path);
  await expect.poll(async () => (await readFocus(page)).tag, { timeout: 15000 }).toMatch(/^H[12]$/);
  await page.waitForTimeout(750);
  const snap = await readFocus(page);
  expect(snap.tag).toMatch(/^H[12]$/);
  return snap;
}

async function expectTeamFocus(page) {
  await expect.poll(async () => (await readFocus(page)).id, { timeout: 15000 }).toBe("power-heading");
  await expectHeadingFocus(page, `/l/${LEAGUE}/team`);
  expect(await readFocus(page)).toEqual({ id: "power-heading", tag: "H2" });
}

for (const width of [1280, 390]) {
  test(`back and forward keep the room heading focused at ${width}`, async ({ page }) => {
    test.setTimeout(180000);
    await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
    await page.goto(`/l/${LEAGUE}/team`);
    await expect(page.locator("body")).toHaveClass(/league-loaded/, { timeout: 45000 });

    await openRoom(page, "find");
    await expectHeadingFocus(page, `/l/${LEAGUE}/ideas`);
    await openRoom(page, "team");
    await expectTeamFocus(page);

    await page.goBack();
    await expectHeadingFocus(page, `/l/${LEAGUE}/ideas`);
    await page.goBack();
    await expectTeamFocus(page);
    await page.goForward();
    await expectHeadingFocus(page, `/l/${LEAGUE}/ideas`);
    await page.goForward();
    await expectTeamFocus(page);
  });

  test(`back to Check a trade focuses the page heading at ${width}`, async ({ page }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
    await page.goto(`/l/${LEAGUE}/team`);
    await expect(page.locator("body")).toHaveClass(/league-loaded/, { timeout: 45000 });

    await openRoom(page, "calculator");
    await expect.poll(() => new URL(page.url()).pathname).toBe("/trade");
    await expect(page).toHaveTitle(/^Check a trade · Dynasty Ticker/);
    await openRoom(page, "team");
    await expectTeamFocus(page);

    await page.goBack();
    await expect.poll(() => new URL(page.url()).pathname).toBe("/trade");
    await expect(page).toHaveTitle(/^Check a trade · Dynasty Ticker/);
    const snap = await expectHeadingFocus(page, "/trade");
    const text = await page.evaluate(() => (document.activeElement?.textContent || "").replace(/\s+/g, " ").trim());
    expect(snap.id).not.toBe("power-heading");
    expect(text).not.toBe("");
  });
}
