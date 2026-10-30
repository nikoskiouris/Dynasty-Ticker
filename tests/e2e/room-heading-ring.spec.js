import { test, expect } from "@playwright/test";

const LEAGUE = "1360686137898700800";

const ROOMS = [
  { name: "My team", room: "team", heading: "Your team", path: `/l/${LEAGUE}/team` },
  { name: "Find a trade", room: "find", heading: "Trade ideas", path: `/l/${LEAGUE}/ideas` },
  { name: "Check a trade", room: "calculator", heading: "Trade", path: "/trade" },
];

const roomBy = Object.fromEntries(ROOMS.map((room) => [room.room, room]));

async function openPhoneMenu(page) {
  const open = await page.locator("body").evaluate((body) => body.classList.contains("rail-open"));
  if (!open) await page.locator("#mobile-rail-toggle").click();
}

async function openRoom(page, room) {
  if (page.viewportSize().width <= 700) {
    await openPhoneMenu(page);
    await page.locator(`#phone-desk [data-phone-room='${room.room}']`).click();
    return;
  }
  await page.locator(`.page-tab[data-room='${room.room}']`).click();
}

async function keyboardOpenRoom(page, room) {
  if (page.viewportSize().width <= 700) {
    await openPhoneMenu(page);
    await expect(page.locator("#mobile-rail-close")).toBeFocused({ timeout: 2000 });
    const button = page.locator(`#phone-desk [data-phone-room='${room.room}']`);
    await button.focus();
    await button.press("Enter");
    return;
  }
  const tabs = page.locator(".page-tab");
  const active = page.locator(".page-tab.active");
  for (let step = 0; step < 3; step += 1) {
    if ((await active.getAttribute("data-room")) === room.room) return;
    await active.focus();
    await active.press("ArrowLeft");
  }
  await expect(tabs.and(page.locator(`[data-room='${room.room}']`))).toHaveClass(/active/);
}

function readRoom(page) {
  return page.evaluate(() => {
    const el = document.activeElement;
    const style = el ? getComputedStyle(el) : null;
    return {
      tag: el?.tagName || "",
      heading: (el?.textContent || "").replace(/\s+/g, " ").trim(),
      live: (document.querySelector("#route-announcer")?.textContent || "").replace(/\s+/g, " ").trim(),
      outlineWidth: style ? Number.parseFloat(style.outlineWidth) || 0 : 0,
      boxShadow: style?.boxShadow || "",
    };
  });
}

async function expectRoom(page, room, { history = false } = {}) {
  await expect.poll(() => new URL(page.url()).pathname).toBe(room.path);
  await expect(page).toHaveTitle(new RegExp(`^${room.name} · Dynasty Ticker`));
  if (history) {
    await expect.poll(async () => (await readRoom(page)).tag, { timeout: 8000 }).toMatch(/^H[12]$/);
    return readRoom(page);
  }
  await expect.poll(async () => (await readRoom(page)).heading, { timeout: 8000 }).toBe(room.heading);
  await page.waitForTimeout(750);
  const snap = await readRoom(page);
  expect(snap.heading).toBe(room.heading);
  expect(snap.tag).toBe("H2");
  return snap;
}

function expectOneAnnouncement(snap) {
  expect(snap.live === snap.heading && snap.heading !== "", JSON.stringify(snap)).toBe(false);
}

for (const width of [1280, 390]) {
  test(`a keyboard room change shows a ring at ${width}`, async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
    await page.goto(`/l/${LEAGUE}/team`);
    await expect(page.locator("body")).toHaveClass(/league-loaded/, { timeout: 45000 });
    await keyboardOpenRoom(page, roomBy.find);
    const snap = await expectRoom(page, roomBy.find);
    expect(snap.outlineWidth, JSON.stringify(snap)).toBeGreaterThan(0);
  });

  test(`a mouse room change shows no ring at ${width}`, async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
    await page.goto(`/l/${LEAGUE}/team`);
    await expect(page.locator("body")).toHaveClass(/league-loaded/, { timeout: 45000 });
    await openRoom(page, roomBy.find);
    const snap = await expectRoom(page, roomBy.find);
    expect(snap.outlineWidth, JSON.stringify(snap)).toBe(0);
    expect(snap.boxShadow, JSON.stringify(snap)).toBe("none");
  });

  test(`one announcement per room change at ${width}`, async ({ page }) => {
    test.setTimeout(180000);
    await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
    await page.goto(`/l/${LEAGUE}/team`);
    await expect(page.locator("body")).toHaveClass(/league-loaded/, { timeout: 45000 });

    const visit = ["find", "team"].map((slug) => roomBy[slug]);
    for (const room of visit) {
      await openRoom(page, room);
      expectOneAnnouncement(await expectRoom(page, room));
    }
    const back = ["find", "team"].map((slug) => roomBy[slug]);
    for (const room of back) {
      await page.goBack();
      expectOneAnnouncement(await expectRoom(page, room, { history: true }));
    }
    for (const room of visit) {
      await page.goForward();
      expectOneAnnouncement(await expectRoom(page, room, { history: true }));
    }
  });
}
