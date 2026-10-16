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

    await page.goto("/player/9221");
    await expectH1(page, "Players");

    await page.goto("/t/1s4984~9221");
    await expectH1(page, "Trade");

    const rooms = [
      [`/l/${LEAGUE}`, "My team"],
      [`/l/${LEAGUE}/team`, "My team"],
      [`/l/${LEAGUE}/league`, "League"],
      [`/l/${LEAGUE}/week`, "This week"],
      [`/l/${LEAGUE}/activity`, "Activity"],
      [`/l/${LEAGUE}/history`, "History"],
      [`/l/${LEAGUE}/ideas`, "Trade"],
    ];
    for (const [path, label] of rooms) {
      await page.goto(path);
      await expect(page.locator("body")).toHaveClass(/league-loaded/, { timeout: 30000 });
      const heading = await expectOneH1(page);
      if (width === 1280) expect(heading.text, path).toBe(label);
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
