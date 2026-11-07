import { test, expect } from "@playwright/test";

const LEAGUE = "1360686137898700800";

// Ticket 018: a second visit in the same browser opens the last league and
// team in one tap; "Forget this league" clears it; the sample is never saved.
for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
  test(`home reopens the last league and team, and forgets it at ${viewport.width}`, async ({ page }) => {
    test.setTimeout(120000);
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page.locator("#landing-resume")).toBeHidden();

    await page.goto("/?sample=1");
    await expect(page.locator("body")).toHaveClass(/league-loaded/, { timeout: 45000 });
    await page.goto("/");
    await expect(page.locator("#landing-job-hint")).toBeVisible();
    await expect(page.locator("#landing-resume")).toBeHidden();

    await page.goto(`/l/${LEAGUE}/team`);
    await expect(page.locator("body")).toHaveClass(/league-loaded/, { timeout: 45000 });
    const manager = (await page.locator("#me-select option:checked").textContent()) || "";
    const rosterId = await page.locator("#me-select").inputValue();

    await page.goto("/");
    const open = page.locator("#landing-resume .launch-resume-open");
    await expect(open).toBeVisible({ timeout: 20000 });
    await expect(open).toHaveAttribute("href", `/l/${LEAGUE}/team?me=${rosterId}`);
    expect(manager.length).toBeGreaterThan(0);
    await open.click();
    await expect(page.locator("body")).toHaveClass(/league-loaded/, { timeout: 45000 });
    await expect(page).toHaveURL(new RegExp(`/l/${LEAGUE}/team`));
    await expect(page.locator("#me-select")).toHaveValue(rosterId);

    await page.goto("/");
    await page.locator("#landing-resume .launch-resume-forget").click();
    await expect(page.locator("#landing-resume")).toBeHidden();
    await page.reload();
    await expect(page.locator("#landing-job-hint")).toBeVisible();
    await expect(page.locator("#landing-resume")).toBeHidden();
  });
}
