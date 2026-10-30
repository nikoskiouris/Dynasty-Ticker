import { test, expect } from "@playwright/test";

const LEAGUE = "1360686137898700800";

async function h1s(page) {
  return page.evaluate(() => {
    const shown = [];
    for (const el of document.querySelectorAll("h1")) {
      let node = el;
      let hidden = false;
      while (node && node.nodeType === 1) {
        const style = getComputedStyle(node);
        if (style.display === "none" || style.visibility === "hidden") {
          hidden = true;
          break;
        }
        node = node.parentElement;
      }
      const text = (el.textContent || "").replace(/\s+/g, " ").trim();
      if (!hidden && text) shown.push({ id: el.id, text });
    }
    return shown;
  });
}

async function expectH1(page, text) {
  let last = [];
  await expect.poll(async () => {
    last = await h1s(page);
    if (last.length !== 1) return "";
    return last[0].text;
  }, { timeout: 20000 }).toBe(text);
  return last[0];
}

async function expectOneH1(page) {
  let last = [];
  await expect.poll(async () => {
    last = await h1s(page);
    return last.length;
  }, { timeout: 20000 }).toBe(1);
  return last[0];
}

for (const width of [1280, 390]) {
  test(`every route has one h1 at ${width}`, async ({ page }) => {
    test.setTimeout(240000);
    await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });

    await page.goto("/");
    await expectH1(page, "Your next dynasty move starts here.");

    await page.goto("/connect");
    await expectH1(page, "Your next dynasty move starts here.");

    await page.goto("/players");
    await expect.poll(() => new URL(page.url()).pathname).toBe("/trade");
    await expectH1(page, "Check a trade");

    await page.goto("/trade");
    await expectH1(page, "Check a trade");
    const legend = page.locator("#calculator-shell .price-legend");
    await expect(legend).toBeVisible({ timeout: 20000 });
    await expect(legend.locator("li").nth(0)).toContainText("Value");
    await expect(legend.locator("li").nth(1)).toContainText("Stars");
    await expect(legend.getByRole("button", { name: "Value" })).toBeVisible();
    await expect(legend.getByRole("button", { name: "Stars" })).toBeVisible();

    await page.goto("/player/9221");
    await expectH1(page, "Check a trade");

    await page.goto("/t/1s4984~9221");
    await expect.poll(async () => {
      const shown = await h1s(page);
      if (shown.length !== 1 || shown[0].id !== "shared-trade-title") return "";
      return shown[0].text;
    }, { timeout: 20000 }).toBe("Josh Allen for Jahmyr Gibbs");
    await expect(page.locator("#route-title")).toBeHidden();

    const rooms = [
      [`/l/${LEAGUE}`, "My team"],
      [`/l/${LEAGUE}/team`, "My team"],
      [`/l/${LEAGUE}/ideas`, "Find a trade"],
    ];
    for (const [path, label] of rooms) {
      await page.goto(path);
      await expect(page.locator("body")).toHaveClass(/league-loaded/, { timeout: 45000 });
      const heading = await expectOneH1(page);
      if (width === 1280) expect(heading.text, path).toBe(label);
    }
  });
}

async function openLeagueRoom(page, room) {
  if (page.viewportSize().width <= 700) {
    const open = await page.locator("body").evaluate((body) => body.classList.contains("rail-open"));
    if (!open) await page.locator("#mobile-rail-toggle").click();
    await page.locator(`#phone-desk [data-phone-room='${room}']`).click();
    return;
  }
  await page.locator(`.page-tab[data-room='${room}']`).click();
}

async function headingFocus(page) {
  let snap = { tag: "", id: "", text: "" };
  await expect.poll(async () => {
    snap = await page.evaluate(() => {
      const el = document.activeElement;
      return {
        tag: el?.tagName || "",
        id: el?.id || "",
        text: (el?.textContent || "").replace(/\s+/g, " ").trim().slice(0, 80),
      };
    });
    return snap.tag;
  }, { timeout: 15000 }).toMatch(/^H[12]$/);
  return snap;
}

for (const width of [1280, 390]) {
  test(`back and forward focus the room heading at ${width}`, async ({ page }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
    await page.goto(`/l/${LEAGUE}/team`);
    await expect(page.locator("body")).toHaveClass(/league-loaded/, { timeout: 45000 });

    await openLeagueRoom(page, "find");
    await expect(page).toHaveURL(new RegExp(`/l/${LEAGUE}/ideas`));
    const findHeading = await headingFocus(page);

    await openLeagueRoom(page, "team");
    await expect(page).toHaveURL(new RegExp(`/l/${LEAGUE}/team`));
    await expect.poll(async () => (await headingFocus(page)).id).toBe("power-heading");
    const teamHeading = await headingFocus(page);
    expect(teamHeading).not.toEqual(findHeading);

    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`/l/${LEAGUE}/ideas`));
    await expect.poll(async () => page.evaluate(() => document.activeElement?.tagName || ""), { timeout: 15000 }).toMatch(/^H[12]$/);

    await page.goForward();
    await expect(page).toHaveURL(new RegExp(`/l/${LEAGUE}/team`));
    await expect.poll(async () => page.evaluate(() => document.activeElement?.tagName || ""), { timeout: 15000 }).toMatch(/^H[12]$/);
  });
}

const ROOMS = [
  { room: "team", heading: "Your team", route: "My team", slug: "team" },
  { room: "find", heading: "Trade ideas", route: "Find a trade", slug: "ideas" },
];

async function expectRoomHeading(page, room, width) {
  const read = () => page.evaluate(() => document.activeElement?.tagName || "");
  await expect(page).toHaveURL(new RegExp(`/l/${LEAGUE}/${room.slug}`));
  await expect.poll(read, { timeout: 15000 }).toMatch(/^H[12]$/);
  await page.waitForTimeout(500);
  await expect.poll(read, { timeout: 5000 }).toMatch(/^H[12]$/);
  await expect(page).toHaveTitle(new RegExp(`^${room.route} · Dynasty Ticker`));
  if (width === 1280) await expect(page.locator("#route-title")).toHaveText(room.route);
}

for (const width of [1280, 390]) {
  test(`every room heading takes focus at ${width}`, async ({ page }) => {
    test.setTimeout(240000);
    await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
    await page.goto(`/l/${LEAGUE}/team`);
    await expect(page.locator("body")).toHaveClass(/league-loaded/, { timeout: 45000 });

    const visit = [ROOMS[1], ROOMS[0]];
    for (const room of visit) {
      await openLeagueRoom(page, room.room);
      await expectRoomHeading(page, room, width);
    }
    await page.goBack();
    await expectRoomHeading(page, ROOMS[1], width);
    await page.goBack();
    await expectRoomHeading(page, ROOMS[0], width);
    for (const room of visit) {
      await page.goForward();
      await expectRoomHeading(page, room, width);
    }

    if (width > 700) {
      await page.locator(".page-tab.active").focus();
      await page.keyboard.press("ArrowLeft");
      await expectRoomHeading(page, ROOMS[1], width);
      await page.locator(".page-tab.active").focus();
      await page.keyboard.press("ArrowRight");
      await expectRoomHeading(page, ROOMS[0], width);
      return;
    }
    for (const room of visit) {
      const open = await page.locator("body").evaluate((body) => body.classList.contains("rail-open"));
      if (!open) {
        await page.locator("#mobile-rail-toggle").click();
        await expect(page.locator("#mobile-rail-close")).toBeFocused();
      }
      await page.locator(`#phone-desk [data-phone-room='${room.room}']`).press("Enter");
      await expectRoomHeading(page, room, width);
    }
  });
}
