import { test, expect } from "@playwright/test";

const LEAGUE = "1360686137898700800";

const ROOMS = [
  { name: "My team", id: "power-heading", slug: "team" },
  { name: "This week", id: "scores-heading", slug: "week" },
  { name: "League", id: "league-heading", slug: "league" },
  { name: "Activity", id: "activity-heading", slug: "activity" },
  { name: "History", id: "history-heading", slug: "history" },
];

const roomBySlug = Object.fromEntries(ROOMS.map((room) => [room.slug, room]));

async function openLeagueRoom(page, name) {
  if (page.viewportSize().width <= 700) {
    const open = await page.locator("body").evaluate((body) => body.classList.contains("rail-open"));
    if (!open) await page.locator("#mobile-rail-toggle").click();
    const section = page.locator("#phone-desk").getByRole("button", { name: "My League" });
    if ((await section.getAttribute("aria-expanded")) !== "true") await section.click();
    await page.locator("#phone-desk").getByRole("button", { name, exact: true }).click();
    return;
  }
  await page.locator("#room-nav").getByRole("tab", { name, exact: true }).click();
}

async function keyboardOpenRoom(page, name) {
  if (page.viewportSize().width <= 700) {
    const open = await page.locator("body").evaluate((body) => body.classList.contains("rail-open"));
    if (!open) await page.locator("#mobile-rail-toggle").click();
    await expect(page.locator("#mobile-rail-close")).toBeFocused({ timeout: 2000 });
    const section = page.locator("#phone-desk").getByRole("button", { name: "My League" });
    if ((await section.getAttribute("aria-expanded")) !== "true") await section.click();
    const button = page.locator("#phone-desk").getByRole("button", { name, exact: true });
    await button.focus();
    await button.press("Enter");
    return;
  }
  const tab = page.locator("#room-nav").getByRole("tab", { name, exact: true });
  await tab.focus();
  await tab.press("Enter");
}

function readRoom(page) {
  return page.evaluate(() => {
    const el = document.activeElement;
    const style = el ? getComputedStyle(el) : null;
    return {
      id: el?.id || "",
      tag: el?.tagName || "",
      heading: (el?.textContent || "").replace(/\s+/g, " ").trim(),
      live: (document.querySelector("#route-announcer")?.textContent || "").replace(/\s+/g, " ").trim(),
      outlineWidth: style ? Number.parseFloat(style.outlineWidth) || 0 : 0,
      boxShadow: style?.boxShadow || "",
    };
  });
}

async function expectRoom(page, room) {
  await expect(page).toHaveURL(new RegExp(`/l/${LEAGUE}/${room.slug}`));
  await expect.poll(async () => (await readRoom(page)).id, { timeout: 8000 }).toBe(room.id);
  await page.waitForTimeout(750);
  const snap = await readRoom(page);
  expect(snap.id).toBe(room.id);
  expect(snap.tag).toBe("H2");
  return snap;
}

function expectOneAnnouncement(snap) {
  expect(snap.live === snap.heading && snap.heading !== "", JSON.stringify(snap)).toBe(false);
  if (snap.heading === "This week" || snap.heading === "Activity") {
    expect(snap.live, JSON.stringify(snap)).toBe("");
  }
}

for (const width of [1280, 390]) {
  test(`a keyboard room change shows a ring at ${width}`, async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
    await page.goto(`/l/${LEAGUE}/team`);
    await expect(page.locator("body")).toHaveClass(/league-loaded/, { timeout: 45000 });
    await keyboardOpenRoom(page, "League");
    const snap = await expectRoom(page, roomBySlug.league);
    expect(snap.outlineWidth, JSON.stringify(snap)).toBeGreaterThan(0);
  });

  test(`a mouse room change shows no ring at ${width}`, async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
    await page.goto(`/l/${LEAGUE}/team`);
    await expect(page.locator("body")).toHaveClass(/league-loaded/, { timeout: 45000 });
    await openLeagueRoom(page, "League");
    const snap = await expectRoom(page, roomBySlug.league);
    expect(snap.outlineWidth, JSON.stringify(snap)).toBe(0);
    expect(snap.boxShadow, JSON.stringify(snap)).toBe("none");
  });

  test(`one announcement per room change at ${width}`, async ({ page }) => {
    test.setTimeout(180000);
    await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
    await page.goto(`/l/${LEAGUE}/team`);
    await expect(page.locator("body")).toHaveClass(/league-loaded/, { timeout: 45000 });

    const visit = ["week", "activity", "history", "league", "team"].map((slug) => roomBySlug[slug]);
    for (const room of visit) {
      await openLeagueRoom(page, room.name);
      expectOneAnnouncement(await expectRoom(page, room));
    }
    const back = ["league", "history", "activity", "week", "team"].map((slug) => roomBySlug[slug]);
    for (const room of back) {
      await page.goBack();
      expectOneAnnouncement(await expectRoom(page, room));
    }
    for (const room of visit) {
      await page.goForward();
      expectOneAnnouncement(await expectRoom(page, room));
    }
  });
}
