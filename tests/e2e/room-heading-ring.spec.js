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

function readFocusBox(page) {
  return page.evaluate(() => {
    const el = document.activeElement;
    const rect = el?.getBoundingClientRect?.() || { width: 0, height: 0, top: 0, right: 0, bottom: 0, left: 0 };
    const style = el ? getComputedStyle(el) : null;
    const clip = style?.clip || "";
    const zeroClip = /^rect\(\s*0px?\s*,\s*0px?\s*,\s*0px?\s*,\s*0px?\s*\)$/.test(clip);
    let ancestorClips = false;
    let node = el?.parentElement || null;
    while (node && node !== document.documentElement) {
      const parentStyle = getComputedStyle(node);
      const overflow = `${parentStyle.overflow} ${parentStyle.overflowX} ${parentStyle.overflowY}`;
      if (/\b(hidden|clip)\b/.test(overflow)) {
        const parent = node.getBoundingClientRect();
        const width = Math.min(rect.right, parent.right) - Math.max(rect.left, parent.left);
        const height = Math.min(rect.bottom, parent.bottom) - Math.max(rect.top, parent.top);
        if (width <= 0 || height <= 0) ancestorClips = true;
      }
      node = node.parentElement;
    }
    return {
      width: rect.width,
      height: rect.height,
      srOnly: Boolean(el?.classList?.contains("sr-only")),
      clip,
      zeroClip,
      ancestorClips,
      outlineWidth: style ? Number.parseFloat(style.outlineWidth) || 0 : 0,
    };
  });
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

  test(`This week and Activity show a visible ring at ${width}`, async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
    await page.goto(`/l/${LEAGUE}/team`);
    await expect(page.locator("body")).toHaveClass(/league-loaded/, { timeout: 45000 });
    for (const slug of ["week", "activity"]) {
      const room = roomBySlug[slug];
      await keyboardOpenRoom(page, room.name);
      await expectRoom(page, room);
      const box = await readFocusBox(page);
      expect(box.width, JSON.stringify(box)).toBeGreaterThan(0);
      expect(box.height, JSON.stringify(box)).toBeGreaterThan(0);
      expect(box.srOnly, JSON.stringify(box)).toBe(false);
      expect(box.zeroClip, JSON.stringify(box)).toBe(false);
      expect(box.ancestorClips, JSON.stringify(box)).toBe(false);
      expect(box.outlineWidth, JSON.stringify(box)).toBeGreaterThan(0);
      if (width === 390) {
        const look = await page.locator(`#${room.id}`).evaluate((el) => {
          const style = getComputedStyle(el);
          const panel = el.closest(".panel-heading");
          const panelStyle = panel ? getComputedStyle(panel) : null;
          return {
            transform: style.textTransform,
            size: Number.parseFloat(style.fontSize) || 0,
            marginTop: Number.parseFloat(panelStyle?.marginTop || "0") || 0,
          };
        });
        expect(look.transform).toBe("uppercase");
        expect(look.size).toBeLessThanOrEqual(12);
        expect(look.marginTop).toBeGreaterThanOrEqual(8);
      }
    }
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
