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
    await expectH1(page, "Is your dynasty trade fair? Find out in one tap.");

    await page.goto("/connect");
    await expectH1(page, "Is your dynasty trade fair? Find out in one tap.");

    await page.goto("/players");
    await expectH1(page, "Players");

    await page.goto("/trade");
    await expectH1(page, "Trade");
    const legend = page.locator("#calculator-shell .price-legend");
    await expect(legend).toBeVisible({ timeout: 20000 });
    await expect(legend.locator("li").nth(0)).toContainText("Value");
    await expect(legend.locator("li").nth(1)).toContainText("Stars");
    await expect(legend.getByRole("button", { name: "Value" })).toBeVisible();
    await expect(legend.getByRole("button", { name: "Stars" })).toBeVisible();

    await page.goto("/player/9221");
    await expectH1(page, "Players");

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
      [`/l/${LEAGUE}/league`, "League"],
      [`/l/${LEAGUE}/ideas`, "Trade"],
    ];
    for (const [path, label] of rooms) {
      await page.goto(path);
      await expect(page.locator("body")).toHaveClass(/league-loaded/, { timeout: 45000 });
      const heading = await expectOneH1(page);
      if (width === 1280) expect(heading.text, path).toBe(label);
      if (path.endsWith("/league") && width === 1280) {
        const head = page.locator(".standings-head");
        await expect(head).toBeVisible({ timeout: 20000 });
        await expect(head.locator(".col-streak")).toHaveText("Streak");
        await expect(head.locator(".col-pa")).toHaveText("Pts against");
        const fit = await head.evaluate((el) => [...el.querySelectorAll(".col-streak, .col-pa")].map((cell) => ({
          text: cell.textContent,
          overflow: cell.scrollWidth - cell.clientWidth,
        })));
        for (const cell of fit) expect(cell.overflow, cell.text).toBeLessThanOrEqual(1);
      }
    }
  });
}

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

    await openLeagueRoom(page, "League");
    await expect(page).toHaveURL(new RegExp(`/l/${LEAGUE}/league`));
    const leagueHeading = await headingFocus(page);

    await openLeagueRoom(page, "This week");
    await expect(page).toHaveURL(new RegExp(`/l/${LEAGUE}/week`));
    await expect.poll(async () => {
      const text = await page.locator("[data-room-panel='scores'] h2").filter({ hasText: /Week / }).first().innerText();
      return text.replace(/\s+/g, " ").trim();
    }, { timeout: 20000 }).toMatch(/Week /);
    const weekHeading = await headingFocus(page);
    expect(weekHeading).not.toEqual(leagueHeading);

    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`/l/${LEAGUE}/league`));
    await expect.poll(async () => page.evaluate(() => ({
      tag: document.activeElement?.tagName || "",
      id: document.activeElement?.id || "",
      text: (document.activeElement?.textContent || "").replace(/\s+/g, " ").trim().slice(0, 80),
    })), { timeout: 15000 }).toEqual(leagueHeading);

    await page.goForward();
    await expect(page).toHaveURL(new RegExp(`/l/${LEAGUE}/week`));
    await expect.poll(async () => page.evaluate(() => ({
      tag: document.activeElement?.tagName || "",
      id: document.activeElement?.id || "",
      text: (document.activeElement?.textContent || "").replace(/\s+/g, " ").trim().slice(0, 80),
    })), { timeout: 15000 }).toEqual(weekHeading);
  });
}

const ROOMS = [
  { name: "My team", id: "power-heading", route: "My team", slug: "team" },
  { name: "This week", id: "scores-heading", route: "This week", slug: "week" },
  { name: "League", id: "league-heading", route: "League", slug: "league" },
  { name: "Activity", id: "activity-heading", route: "Activity", slug: "activity" },
  { name: "History", id: "history-heading", route: "History", slug: "history" },
];

async function expectRoomHeading(page, room, width) {
  const wanted = { id: room.id, tag: "H2", tab: "-1" };
  const read = () => page.evaluate(() => {
    const el = document.activeElement;
    return {
      id: el?.id || "",
      tag: el?.tagName || "",
      tab: el?.getAttribute?.("tabindex") || "",
    };
  });
  await expect(page).toHaveURL(new RegExp(`/l/${LEAGUE}/${room.slug}`));
  await expect.poll(read, { timeout: 15000 }).toEqual(wanted);
  await page.waitForTimeout(500);
  await expect.poll(read, { timeout: 5000 }).toEqual(wanted);
  await expect(page).toHaveTitle(new RegExp(`^${room.route} · Dynasty Ticker`));
  await expect(page.locator(`#${room.id}`)).toBeFocused();
  const headingText = ((await page.locator(`#${room.id}`).textContent()) || "").replace(/\s+/g, " ").trim();
  await expect(page.locator("#route-announcer")).toHaveText(headingText === room.route ? "" : room.route);
  if (width === 1280) await expect(page.locator("#route-title")).toHaveText(room.route);
}

for (const width of [1280, 390]) {
  test(`every room heading takes focus at ${width}`, async ({ page }) => {
    test.setTimeout(240000);
    await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
    await page.goto(`/l/${LEAGUE}/team`);
    await expect(page.locator("body")).toHaveClass(/league-loaded/, { timeout: 45000 });

    const visit = [...ROOMS.slice(1), ROOMS[0]];
    for (const room of visit) {
      await openLeagueRoom(page, room.name);
      await expectRoomHeading(page, room, width);
    }
    for (const room of [...ROOMS].reverse()) {
      await page.goBack();
      await expectRoomHeading(page, room, width);
    }
    for (const room of visit) {
      await page.goForward();
      await expectRoomHeading(page, room, width);
    }

    if (width > 700) {
      for (let step = 1; step <= ROOMS.length; step += 1) {
        await page.locator("#room-nav [data-room].active").focus();
        await page.keyboard.press("ArrowRight");
        await expectRoomHeading(page, ROOMS[step % ROOMS.length], width);
      }
      return;
    }
    for (const room of visit) {
      const open = await page.locator("body").evaluate((body) => body.classList.contains("rail-open"));
      if (!open) {
        await page.locator("#mobile-rail-toggle").click();
        await expect(page.locator("#mobile-rail-close")).toBeFocused();
      }
      const section = page.locator("#phone-desk").getByRole("button", { name: "My League" });
      if ((await section.getAttribute("aria-expanded")) !== "true") await section.click();
      await page.locator("#phone-desk").getByRole("button", { name: room.name, exact: true }).press("Enter");
      await expectRoomHeading(page, room, width);
    }
  });
}

test("slow History focuses its heading at 390", async ({ page }) => {
  test.setTimeout(90000);
  let release = () => {};
  let pending = 0;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  await page.route("**/matchups/**", async (route) => {
    pending += 1;
    try {
      await gate;
      await route.continue();
    } finally {
      pending -= 1;
    }
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/l/${LEAGUE}/team`);
  await expect(page.locator("body")).toHaveClass(/league-loaded/, { timeout: 30000 });
  await expect.poll(() => pending, { timeout: 15000 }).toBeGreaterThan(0);

  await page.locator("#mobile-rail-toggle").click();
  await page.locator("[data-phone-room='history']").click();
  await expect.poll(async () => page.evaluate(() => {
    const el = document.activeElement;
    return {
      id: el?.id || "",
      tag: el?.tagName || "",
      text: (el?.textContent || "").replace(/\s+/g, " ").trim().slice(0, 80),
    };
  }), { timeout: 10000 }).toEqual({
    id: "history-heading",
    tag: "H2",
    text: "Titles, records, and who stayed",
  });
  expect(pending).toBeGreaterThan(0);

  await page.locator("#mobile-rail-toggle").focus();
  release();
  await page.waitForTimeout(800);
  await expect.poll(() => page.evaluate(() => document.activeElement?.id || "")).toBe("mobile-rail-toggle");
});
