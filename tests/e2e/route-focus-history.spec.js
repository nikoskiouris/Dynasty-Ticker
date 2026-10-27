import { test, expect } from "@playwright/test";
import { waitForAppBoot } from "./boot.js";

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

function readFocus(page) {
  return page.evaluate(() => {
    const el = document.activeElement;
    return { id: el?.id || "", tag: el?.tagName || "" };
  });
}

async function expectRoomFocus(page, room) {
  const wanted = { id: room.id, tag: "H2" };
  await expect(page).toHaveURL(new RegExp(`/l/${LEAGUE}/${room.slug}`));
  await expect.poll(() => readFocus(page), { timeout: 8000 }).toEqual(wanted);
  await page.waitForTimeout(750);
  expect(await readFocus(page)).toEqual(wanted);
}

async function visiblePageHeading(page) {
  return page.evaluate(() => {
    const shown = (node) => {
      let cur = node;
      while (cur && cur.nodeType === 1) {
        const style = getComputedStyle(cur);
        if (style.display === "none" || style.visibility === "hidden") return false;
        cur = cur.parentElement;
      }
      return true;
    };
    const h1 = [...document.querySelectorAll("h1")].find((node) => {
      return shown(node) && (node.textContent || "").replace(/\s+/g, " ").trim();
    });
    const el = document.activeElement;
    return {
      activeId: el?.id || "",
      activeTag: el?.tagName || "",
      h1Id: h1?.id || "",
    };
  });
}

for (const width of [1280, 390]) {
  test(`back and forward keep every room heading focused at ${width}`, async ({ page }) => {
    test.setTimeout(180000);
    await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
    await page.goto(`/l/${LEAGUE}/team`);
    await expect(page.locator("body")).toHaveClass(/league-loaded/, { timeout: 45000 });

    const visit = ["week", "activity", "history", "league", "team"].map((slug) => roomBySlug[slug]);
    for (const room of visit) {
      await openLeagueRoom(page, room.name);
      await expectRoomFocus(page, room);
    }
    const back = ["league", "history", "activity", "week", "team"].map((slug) => roomBySlug[slug]);
    for (const room of back) {
      await page.goBack();
      await expectRoomFocus(page, room);
    }
    for (const room of visit) {
      await page.goForward();
      await expectRoomFocus(page, room);
    }
  });

  test(`back to players focuses the page heading at ${width}`, async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
    await page.goto("/players");
    await waitForAppBoot(page);
    await page.locator("#league-id").evaluate((el, id) => {
      el.value = id;
    }, LEAGUE);
    await page.locator("#load-league-btn").evaluate((el) => el.click());
    await expect(page).toHaveURL(new RegExp(`/l/${LEAGUE}/team`), { timeout: 45000 });
    await expect(page.locator("body")).toHaveClass(/league-loaded/);

    await page.goBack();
    await expect(page).toHaveURL(/\/players$/);
    await expect.poll(async () => {
      const snap = await visiblePageHeading(page);
      return snap.activeTag === "H1" && snap.activeId === snap.h1Id && snap.h1Id !== "";
    }, { timeout: 8000 }).toBe(true);
    await page.waitForTimeout(750);
    const snap = await visiblePageHeading(page);
    expect(snap.activeTag).toBe("H1");
    expect(snap.activeId).toBe(snap.h1Id);
    expect(snap.h1Id).not.toBe("");
  });
}
