import { test, expect } from "@playwright/test";

const LEAGUE = "1360686137898700800";

test("My team at 390: compact roster rows, whole names, position rank and team on one line", async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/l/${LEAGUE}/team?sample=1`);
  await expect(page.locator("body")).toHaveClass(/league-loaded/, { timeout: 45000 });
  const rows = page.locator("#roster-sheet .sheet-row:not(.pick):not(.empty)");
  await expect.poll(() => rows.count(), { timeout: 45000 }).toBeGreaterThan(8);
  await expect(page.locator("#roster-sheet .sheet-row.loading-row")).toHaveCount(0, { timeout: 30000 });

  const report = await rows.evaluateAll((nodes) => nodes.map((row) => {
    const name = row.querySelector(".sheet-player strong");
    const meta = row.querySelector(".sheet-player > span:not(.player-face)");
    const metaBox = meta?.getBoundingClientRect();
    return {
      name: name?.textContent.trim() || "",
      clipped: Boolean(name) && (name.scrollWidth > name.clientWidth + 1 || /…|\.\.\.$/.test(name.textContent)),
      meta: meta?.textContent.replace(/\s+/g, " ").trim() || "",
      metaLines: metaBox ? Math.round(metaBox.height / Number.parseFloat(getComputedStyle(meta).lineHeight || "16")) : 0,
      height: Math.round(row.getBoundingClientRect().height),
    };
  }));
  for (const row of report) {
    expect(row.clipped, row.name).toBe(false);
    expect(row.meta, row.name).toMatch(/^(QB|RB|WR|TE|K|DEF|DL|LB|DB)\d* · [A-Z]{2,3}\b/);
    expect(row.metaLines, row.name).toBeLessThanOrEqual(1);
    expect(row.height, row.name).toBeLessThanOrEqual(60);
  }
  await expect(page.locator("#ticker")).toHaveCount(0);
  await expect(page.getByText(/^LIVE$/)).toHaveCount(0);
  await expect(page.getByText(/Scoring your roster/i)).toHaveCount(0);
  const pickNote = page.locator("#roster-sheet .pick-value-hint").first();
  if (await pickNote.count()) {
    expect(Number.parseFloat(await pickNote.evaluate((el) => getComputedStyle(el).fontSize))).toBeLessThanOrEqual(12);
  }
});
