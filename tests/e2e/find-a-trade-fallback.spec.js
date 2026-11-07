import { test, expect } from "@playwright/test";

// Find a trade never ends on "no deal" when My team already names a group to
// upgrade: with no two-way idea it prices fair buys at the lowest-ranked group,
// and Review trade opens that offer in Check a trade.
for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
  test(`Find a trade with no two-way idea shows fair buys at the weakest group at ${viewport.width}`, async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize(viewport);
    await page.goto("/?sample=1");
    await expect(page.locator("body")).toHaveClass(/league-loaded/, { timeout: 45000 });
    const nextMove = page.locator("#next-move [data-action='find-position']");
    await expect(nextMove).toBeVisible({ timeout: 20000 });
    const position = await nextMove.getAttribute("data-position");
    await page.locator(".page-tab[data-room='find']").click();
    const board = page.locator("#trade-match-dashboard");
    await expect(board).not.toContainText("Looking for trades", { timeout: 30000 });
    const reviews = board.getByRole("button", { name: "Review trade" });
    if (await board.locator(".find-fallback").count()) {
      await expect(board.locator(".find-fallback")).toContainText(`what a ${position} costs`);
      await expect(board).toContainText(`${position}s you could get at a fair price`);
    }
    await expect(board).not.toContainText("No fair deal that helps your lineup yet.");
    await expect(reviews.first()).toBeVisible();
    await reviews.first().click();
    await expect(page).toHaveURL(/\/trade\?give=/);
    await expect(page.locator("#value-calc-verdict h3")).toContainText(/Fair|slight/i, { timeout: 20000 });
  });
}
