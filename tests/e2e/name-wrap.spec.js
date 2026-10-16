import { test, expect } from "@playwright/test";

const LEAGUE = "1360686137898700800";
const LONG_NAME = "Christopher Bartholomew Worthington-Montgomery Rodriguez Alexander Jr.";

test("a very long roster name stays whole inside the row at 390", async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/l/${LEAGUE}/team`);
  await expect(page.locator("body")).toHaveClass(/league-loaded/, { timeout: 45000 });
  const strong = page.locator("[data-room-panel='team'] .sheet-player strong").first();
  await expect(strong).toBeVisible({ timeout: 20000 });

  const report = await strong.evaluate((el, name) => {
    el.textContent = name;
    const textNode = el.firstChild;
    const range = document.createRange();
    const box = el.getBoundingClientRect();
    const row = el.closest(".sheet-row");
    const rowBox = row.getBoundingClientRect();
    let hidden = 0;
    let lines = 1;
    let lastTop = null;
    let midWord = false;
    let lastIndex = -1;
    let visible = "";
    for (let i = 0; i < name.length; i += 1) {
      range.setStart(textNode, i);
      range.setEnd(textNode, i + 1);
      const rect = range.getClientRects()[0];
      const shown = Boolean(rect)
        && rect.width > 0.2
        && rect.height > 0.2
        && rect.top >= box.top - 1
        && rect.bottom <= box.bottom + 1
        && rect.left >= box.left - 1
        && rect.right <= box.right + 1;
      if (!shown) {
        hidden += 1;
        continue;
      }
      if (lastTop != null && Math.abs(rect.top - lastTop) > 1) {
        lines += 1;
        const prev = name[lastIndex];
        const next = name[i];
        const gap = name.slice(lastIndex + 1, i);
        if (!/[\s-]/.test(prev) && !/[\s-]/.test(next) && !/[\s-]/.test(gap)) midWord = true;
      }
      visible += name[i];
      lastIndex = i;
      lastTop = rect.top;
    }
    const style = getComputedStyle(el);
    return {
      lines,
      hidden,
      midWord,
      visible,
      textOverflow: style.textOverflow,
      whiteSpace: style.whiteSpace,
      rowOverflow: row.scrollWidth - row.clientWidth,
      rowClipped: rowBox.left < -1 || rowBox.right > window.innerWidth + 1,
      nameOutsideRow: box.left < rowBox.left - 1 || box.right > rowBox.right + 1,
      pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  }, LONG_NAME);

  expect(report.midWord, JSON.stringify(report)).toBe(false);
  expect(report.lines, JSON.stringify(report)).toBe(1);
  expect(nameStartsWithVisible(LONG_NAME, report.visible), JSON.stringify(report)).toBe(true);
  expect(report.hidden, JSON.stringify(report)).toBeGreaterThan(0);
  expect(report.textOverflow, JSON.stringify(report)).toBe("ellipsis");
  expect(report.whiteSpace, JSON.stringify(report)).toBe("nowrap");
  expect(report.rowOverflow, JSON.stringify(report)).toBeLessThanOrEqual(1);
  expect(report.rowClipped, JSON.stringify(report)).toBe(false);
  expect(report.nameOutsideRow, JSON.stringify(report)).toBe(false);
  expect(report.pageOverflow, JSON.stringify(report)).toBeLessThanOrEqual(1);
});

function nameStartsWithVisible(name, visible) {
  let at = 0;
  for (const char of visible) {
    const found = name.indexOf(char, at);
    if (found < 0) return false;
    at = found + 1;
  }
  return visible.length > 0 && name.startsWith(visible);
}
