import { test, expect } from "@playwright/test";
import { waitForAppBoot } from "./boot.js";

const viewports = [
  { width: 390, height: 844 },
  { width: 820, height: 1180 },
  { width: 1280, height: 800 },
];

const tokens = (page, side) => page.locator(`[data-draft-side='${side}'] .selected-token-label .player-name-text, [data-draft-side='${side}'] .selected-token-label:not(.player-name)`);

for (const viewport of viewports) {
  test(`a described trade is built, edited by follow-ups, and undoable at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await waitForAppBoot(page);
    await page.fill("#landing-talk", "Gibbs and a 2027 1st for Nabers");
    await page.press("#landing-talk", "Enter");

    await expect(tokens(page, "left")).toHaveText(["Jahmyr Gibbs", "2027 1st"], { timeout: 30000 });
    await expect(tokens(page, "right")).toHaveText(["Malik Nabers"]);
    await expect(page.locator("#draft-meter .meter-label")).toHaveText(await page.locator("#value-calc-verdict h3").innerText());
    await expect(page).toHaveURL(/\/trade\?give=9221,pick:2027:r1:any&get=11632/);

    await page.fill("#trade-talk-input", "add my 2028 2nd");
    await page.press("#trade-talk-input", "Enter");
    await expect(tokens(page, "left")).toHaveText(["Jahmyr Gibbs", "2027 1st", "2028 2nd"]);
    await expect(page.locator("#trade-talk-input")).toBeFocused();

    await page.fill("#trade-talk-input", "brown");
    await page.press("#trade-talk-input", "Enter");
    await expect(page.locator(".talk-choice-title")).toHaveText("Which Brown?");
    await expect(tokens(page, "left")).toHaveCount(3);

    // A new trade replaces the draft, and Restore draft brings the old one back.
    await page.fill("#trade-talk-input", "CMC for Bijan");
    await page.press("#trade-talk-input", "Enter");
    await expect(tokens(page, "left")).toHaveText(["Christian McCaffrey"]);
    await page.click("[data-action='draft-restore']");
    await expect(tokens(page, "left")).toHaveText(["Jahmyr Gibbs", "2027 1st", "2028 2nd"]);
    await expect(tokens(page, "right")).toHaveText(["Malik Nabers"]);
  });
}

test("/trade?say= opens the described trade", async ({ page }) => {
  await page.goto(`/trade?say=${encodeURIComponent("I got offered JSN for CMC")}`);
  await expect(tokens(page, "left")).toHaveText(["Christian McCaffrey"], { timeout: 30000 });
  await expect(tokens(page, "right")).toHaveText(["Jaxon Smith-Njigba"]);
  await expect(page).not.toHaveURL(/say=/);
});

test("a landing example opens that trade, and Keep going adds to it", async ({ page }) => {
  await page.goto("/");
  await waitForAppBoot(page);
  await page.click(".landing-talk-try button[value='Gibbs and a 1st for Nabers']");
  await expect(tokens(page, "left")).toHaveText(["Jahmyr Gibbs", /1st/], { timeout: 30000 });
  await expect(tokens(page, "right")).toHaveText(["Malik Nabers"]);
  const next = page.locator(".talk-next [data-action='talk-example']").first();
  await expect(next).toBeVisible();
  const before = await tokens(page, "left").count() + await tokens(page, "right").count();
  await next.click();
  await expect.poll(async () => await tokens(page, "left").count() + await tokens(page, "right").count()).toBe(before + 1);
});

test("the verdict meter matches the verdict and See why lists every piece", async ({ page }) => {
  await page.goto(`/trade?say=${encodeURIComponent("I got offered JSN and two 2nds for CMC")}`);
  await expect(tokens(page, "right")).toHaveCount(3, { timeout: 30000 });
  await expect(page.locator("#draft-meter .meter-label")).toHaveText(await page.locator("#value-calc-verdict h3").innerText());
  await expect(page.locator("[data-draft-side='right'] .calc-pane-total small")).toHaveText("(3)");
  await page.click("[data-action='meter-why']");
  await expect(page.locator("[data-action='meter-why']")).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator(".meter-why .side-left .meter-why-row")).toHaveCount(1);
  await expect(page.locator(".meter-why .side-right .meter-why-row:not(.is-credit)")).toHaveCount(3);
  await page.fill("#trade-talk-input", "add my 2028 2nd");
  await page.press("#trade-talk-input", "Enter");
  await expect(page.locator("#talk-toast")).toHaveText(/Added 2028 2nd/);
  await expect(page.locator(".meter-why .side-left .meter-why-row")).toHaveCount(2);
});

for (const viewport of viewports) {
  test(`"Jefferson and a first for Chase" asks which Jefferson and which Chase at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto(`/trade?say=${encodeURIComponent("Jefferson and a first for Chase")}`);
    const jefferson = page.locator(".talk-choice[aria-label='Which Jefferson?']");
    const chase = page.locator(".talk-choice[aria-label='Which Chase?']");
    await expect(jefferson).toBeVisible({ timeout: 30000 });
    await expect(chase).toBeVisible();
    await expect(tokens(page, "left")).toHaveText([/1st/]);
    await expect(tokens(page, "right")).toHaveCount(0);
    // The reply stays in place; no toast floats over the questions.
    await expect(page.locator(".talk-lines")).toContainText("2027 1st");
    await expect(page.locator("#talk-toast")).toBeHidden();

    // Answering one question keeps the other on screen.
    await jefferson.locator("[data-action='talk-add']", { hasText: "Justin Jefferson" }).click();
    await expect(tokens(page, "left")).toHaveText([/1st/, "Justin Jefferson"]);
    await expect(jefferson).toHaveCount(0);
    await expect(chase).toBeVisible();

    await chase.locator("[data-action='talk-add']", { hasText: "Chase Brown" }).click();
    await expect(tokens(page, "right")).toHaveText(["Chase Brown"]);
    await expect(chase).toHaveCount(0);
    await expect(page.locator("#draft-meter .meter-label")).toHaveText(await page.locator("#value-calc-verdict h3").innerText());
  });
}
