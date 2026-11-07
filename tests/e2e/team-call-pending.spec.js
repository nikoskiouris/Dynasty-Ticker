import { test, expect } from "@playwright/test";

// My team's contend-or-rebuild call weighs this season's record and playoff
// odds. Before the weekly scores land it says so, instead of showing a
// confident call from roster value alone that flips a moment later.
test("the team call waits for this season's scores instead of flipping", async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 390, height: 844 });
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  await page.route(/api\.sleeper\.app\/v1\/league\/\d+\/matchups\/\d+/, async (route) => {
    await gate;
    await route.continue();
  });
  const seen = [];
  await page.exposeFunction("__noteCall", (text) => seen.push(text));
  await page.addInitScript(() => {
    new MutationObserver(() => {
      const node = document.querySelector("#window-call-dashboard, .team-verdict");
      const text = node?.textContent?.replace(/\s+/g, " ").trim();
      if (text) window.__noteCall?.(text);
    }).observe(document, { subtree: true, childList: true, characterData: true });
  });
  await page.goto("/?sample=1");
  await expect(page.locator("body")).toHaveClass(/league-loaded/, { timeout: 45000 });
  const pending = page.locator(".team-verdict .call-pending");
  await expect(pending).toHaveText("Loading this season's scores to make the call…", { timeout: 20000 });
  await expect(page.locator(".team-verdict .window-call-line")).toHaveCount(0);
  release();
  await expect(page.locator(".team-verdict .window-call-line")).toBeVisible({ timeout: 30000 });
  await expect(pending).toHaveCount(0);
  const final = (await page.locator(".team-verdict .window-call-line strong").textContent()).trim();
  // Every call shown before the final one was the pending line, never another call.
  const calls = seen.filter((text) => !text.includes("Loading this season's scores")).map((text) => text.match(/(?:Contend or rebuild|This season)\s*(.*?)(?: ·|Confidence)/)?.[1]?.trim()).filter(Boolean);
  expect(new Set(calls)).toEqual(new Set([final]));
});
