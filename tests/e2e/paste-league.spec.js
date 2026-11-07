import { test, expect } from "@playwright/test";

// The Sleeper username box takes a pasted league link or id. A 48-character
// link used to be cut at 40 characters, so the league id lost its last digits.
for (const pasted of ["https://sleeper.com/leagues/1360686137898700800", "1360686137898700800"]) {
  test(`pasting ${pasted.length > 20 ? "a league link" : "a league id"} into the username box opens the league`, async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/connect");
    const box = page.locator("#landing-username");
    await expect(box).toBeVisible({ timeout: 20000 });
    await box.fill(pasted);
    await expect(box).toHaveValue(pasted);
    await box.press("Enter");
    await expect(page).toHaveURL(/\/l\/1360686137898700800\/team/, { timeout: 45000 });
    await expect(page.locator("body")).toHaveClass(/league-loaded/, { timeout: 45000 });
  });
}
