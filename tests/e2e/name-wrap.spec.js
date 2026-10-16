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

const FULL_NAMES = ["Nico Collins", "Marvin Harrison Jr."];

async function paintRosterNames(page, names) {
  return page.evaluate((wanted) => {
    const rows = [...document.querySelectorAll("[data-room-panel='team'] button.sheet-row .sheet-player strong")];
    const used = new Set();
    return wanted.map((name) => {
      let strong = rows.find((el) => (el.textContent || "").replace(/\s+/g, " ").trim().startsWith(name));
      if (!strong) {
        strong = rows.find((el) => !used.has(el));
        if (strong) strong.textContent = name;
      }
      if (strong) used.add(strong);
      if (!strong) return null;
      const style = getComputedStyle(strong);
      const box = strong.getBoundingClientRect();
      const row = strong.closest(".sheet-row");
      const textNode = [...strong.childNodes].find((node) => node.nodeType === Node.TEXT_NODE && (node.textContent || "").includes(name.slice(0, 4)));
      const range = document.createRange();
      let hidden = 0;
      const source = textNode ? textNode.textContent || "" : "";
      const start = source.indexOf(name);
      if (textNode && start >= 0) {
        for (let i = start; i < start + name.length; i += 1) {
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
          if (!shown) hidden += 1;
        }
      } else {
        hidden = name.length;
      }
      return {
        name,
        text: (strong.textContent || "").replace(/\s+/g, " ").trim(),
        scrollWidth: strong.scrollWidth,
        clientWidth: strong.clientWidth,
        hidden,
        textOverflow: style.textOverflow,
        rowOverflow: row.scrollWidth - row.clientWidth,
        pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
  }, names);
}

test("Nico Collins and Marvin Harrison Jr. fit on the phone roster", async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/l/${LEAGUE}/team`);
  await expect(page.locator("body")).toHaveClass(/league-loaded/, { timeout: 45000 });
  const sheet = page.locator("#roster-sheet .sheet-player strong").first();
  await expect(sheet).toBeVisible({ timeout: 20000 });

  const reports = await paintRosterNames(page, FULL_NAMES);
  for (const report of reports) {
    expect(report, JSON.stringify(reports)).toBeTruthy();
    expect(report.text.startsWith(report.name), JSON.stringify(report)).toBe(true);
    expect(report.scrollWidth, JSON.stringify(report)).toBeLessThanOrEqual(report.clientWidth + 1);
    expect(report.hidden, JSON.stringify(report)).toBe(0);
    expect(report.textOverflow === "ellipsis" && report.scrollWidth > report.clientWidth + 1, JSON.stringify(report)).toBe(false);
    expect(report.rowOverflow, JSON.stringify(report)).toBeLessThanOrEqual(1);
    expect(report.pageOverflow, JSON.stringify(report)).toBeLessThanOrEqual(1);
  }
});

test("the value stays beside the name at 1280", async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`/l/${LEAGUE}/team`);
  await expect(page.locator("body")).toHaveClass(/league-loaded/, { timeout: 45000 });
  const row = page.locator("#roster-sheet button.sheet-row").first();
  await expect(row).toBeVisible({ timeout: 20000 });
  const layout = await row.evaluate((node) => {
    const name = node.querySelector(".sheet-player");
    const metrics = node.querySelector(".sheet-metrics");
    const nameBox = name.getBoundingClientRect();
    const metricsBox = metrics.getBoundingClientRect();
    return {
      columns: getComputedStyle(node).gridTemplateColumns.split(" ").filter(Boolean).length,
      sideBySide: metricsBox.left >= nameBox.right - 2 && metricsBox.top < nameBox.bottom,
    };
  });
  expect(layout.columns).toBe(3);
  expect(layout.sideBySide).toBe(true);
});

for (const width of [1280, 701, 700, 390]) {
  test(`superflex slot reads ${width > 700 ? "Superflex" : "SF"} at ${width}`, async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width, height: width <= 700 ? 844 : 800 });
    await page.goto(`/l/${LEAGUE}/team`);
    await expect(page.locator("body")).toHaveClass(/league-loaded/, { timeout: 45000 });
    const slot = page.locator("#roster-sheet .sheet-slot-superflex").first();
    await expect(slot).toBeVisible({ timeout: 20000 });
    const label = await slot.evaluate((node) => {
      const full = node.querySelector(".sheet-slot-full");
      const short = node.querySelector(".sheet-slot-short");
      const shown = (el) => Boolean(el) && getComputedStyle(el).display !== "none";
      return {
        fullShown: shown(full),
        shortShown: shown(short),
        fullText: full?.textContent || "",
        shortText: short?.textContent || "",
        title: short?.getAttribute("title") || "",
        aria: short?.getAttribute("aria-label") || "",
      };
    });
    expect(label.fullText).toBe("Superflex");
    expect(label.shortText).toBe("SF");
    expect(label.title).toBe("Superflex");
    expect(label.aria).toBe("Superflex");
    if (width > 700) {
      expect(label.fullShown).toBe(true);
      expect(label.shortShown).toBe(false);
    } else {
      expect(label.fullShown).toBe(false);
      expect(label.shortShown).toBe(true);
    }
  });
}

async function textFit(locator) {
  return locator.evaluate((el) => {
    const style = getComputedStyle(el);
    const box = el.getBoundingClientRect();
    const range = document.createRange();
    const nodes = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let current;
    while ((current = walker.nextNode())) nodes.push(current);
    const flat = nodes.map((node) => node.textContent || "").join("");
    let hidden = 0;
    let lines = 1;
    let lastTop = null;
    let lastIndex = -1;
    let midWord = false;
    let index = -1;
    for (const node of nodes) {
      const value = node.textContent || "";
      for (let i = 0; i < value.length; i += 1) {
        index += 1;
        const ch = value[i];
        range.setStart(node, i);
        range.setEnd(node, i + 1);
        const rect = range.getClientRects()[0];
        const shown = Boolean(rect)
          && rect.width > 0.2
          && rect.height > 0.2
          && rect.top >= box.top - 1
          && rect.bottom <= box.bottom + 1
          && rect.left >= box.left - 1
          && rect.right <= box.right + 1;
        if (!shown) {
          if (!/\s/.test(ch)) hidden += 1;
          continue;
        }
        if (lastTop != null && Math.abs(rect.top - lastTop) > 1) {
          lines += 1;
          const prev = flat[lastIndex];
          const gap = flat.slice(lastIndex + 1, index);
          if (prev && !/[\s-]/.test(prev) && !/[\s-]/.test(ch) && !/[\s-]/.test(gap)) midWord = true;
        }
        lastIndex = index;
        lastTop = rect.top;
      }
    }
    const row = el.closest(".sheet-row, button.ranks-row, .power-board-row");
    return {
      text: (el.textContent || "").replace(/\s+/g, " ").trim(),
      hidden,
      lines,
      midWord,
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      textOverflow: style.textOverflow,
      whiteSpace: style.whiteSpace,
      rowOverflow: row ? row.scrollWidth - row.clientWidth : 0,
      pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
}

function expectWhole(report) {
  expect(report, JSON.stringify(report)).toBeTruthy();
  expect(report.hidden, JSON.stringify(report)).toBe(0);
  expect(report.midWord, JSON.stringify(report)).toBe(false);
  expect(report.scrollWidth, JSON.stringify(report)).toBeLessThanOrEqual(report.clientWidth + 1);
  expect(report.textOverflow, JSON.stringify(report)).not.toBe("ellipsis");
  expect(report.rowOverflow, JSON.stringify(report)).toBeLessThanOrEqual(1);
  expect(report.pageOverflow, JSON.stringify(report)).toBeLessThanOrEqual(1);
}

test("the first 20 player names are whole at 390", async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/players");
  const names = page.locator(".ranks-list .player-name-text");
  await expect(names.nth(19)).toBeVisible({ timeout: 30000 });
  const reports = await names.evaluateAll((els) => els.slice(0, 20).map((el) => {
    const style = getComputedStyle(el);
    const box = el.getBoundingClientRect();
    const range = document.createRange();
    const node = [...el.childNodes].find((child) => child.nodeType === Node.TEXT_NODE);
    const value = node?.textContent || "";
    let hidden = 0;
    let midWord = false;
    let lines = 1;
    let lastTop = null;
    let lastIndex = -1;
    if (node) {
      for (let i = 0; i < value.length; i += 1) {
        range.setStart(node, i);
        range.setEnd(node, i + 1);
        const rect = range.getClientRects()[0];
        const shown = Boolean(rect)
          && rect.width > 0.2
          && rect.height > 0.2
          && rect.top >= box.top - 1
          && rect.bottom <= box.bottom + 1
          && rect.left >= box.left - 1
          && rect.right <= box.right + 1;
        if (!shown) {
          if (!/\s/.test(value[i])) hidden += 1;
          continue;
        }
        if (lastTop != null && Math.abs(rect.top - lastTop) > 1) {
          lines += 1;
          const prev = value[lastIndex];
          const gap = value.slice(lastIndex + 1, i);
          if (prev && !/[\s-]/.test(prev) && !/[\s-]/.test(value[i]) && !/[\s-]/.test(gap)) midWord = true;
        }
        lastIndex = i;
        lastTop = rect.top;
      }
    } else {
      hidden = value.length || 1;
    }
    const row = el.closest("button.ranks-row");
    return {
      text: value.replace(/\s+/g, " ").trim(),
      hidden,
      lines,
      midWord,
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      textOverflow: style.textOverflow,
      rowOverflow: row ? row.scrollWidth - row.clientWidth : 0,
      pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  }));
  expect(reports).toHaveLength(20);
  for (const report of reports) {
    expect(report.text.length, JSON.stringify(report)).toBeGreaterThan(0);
    expect(report.hidden, JSON.stringify(report)).toBe(0);
    expect(report.midWord, JSON.stringify(report)).toBe(false);
    expect(report.scrollWidth, JSON.stringify(report)).toBeLessThanOrEqual(report.clientWidth + 1);
    expect(report.textOverflow, JSON.stringify(report)).not.toBe("ellipsis");
    expect(report.rowOverflow, JSON.stringify(report)).toBeLessThanOrEqual(1);
    expect(report.pageOverflow, JSON.stringify(report)).toBeLessThanOrEqual(1);
  }
});

test("Jacory Croskey-Merritt is whole on the phone players list", async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/players");
  await expect(page.locator("button.ranks-row").first()).toBeVisible({ timeout: 30000 });
  await page.locator("[data-input='ranks-search']").fill("Croskey");
  const name = page.locator(".ranks-list .player-name-text", { hasText: "Jacory Croskey-Merritt" });
  await expect(name).toBeVisible({ timeout: 20000 });
  const report = await textFit(name);
  expect(report.text, JSON.stringify(report)).toBe("Jacory Croskey-Merritt");
  expect(report.lines, JSON.stringify(report)).toBeGreaterThan(1);
  expectWhole(report);
});

test("Christian McCaffrey stays whole behind his open card at 390", async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/player/12533");
  await expect(page.locator(".ranks-card h2")).toBeVisible({ timeout: 30000 });
  const name = page.locator(".ranks-list .player-name-text", { hasText: "Christian McCaffrey" });
  await expect(name).toBeVisible({ timeout: 20000 });
  const report = await textFit(name);
  expect(report.text, JSON.stringify(report)).toBe("Christian McCaffrey");
  expectWhole(report);
});

for (const width of [390, 1280]) {
  test(`Quentin Johnston and his nickname fit at ${width}`, async ({ page }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
    await page.goto(`/l/${LEAGUE}/team`);
    await expect(page.locator("body")).toHaveClass(/league-loaded/, { timeout: 45000 });
    const strong = page.locator("#roster-sheet .sheet-player strong", { hasText: "Quentin Johnston" }).first();
    await expect(strong).toBeVisible({ timeout: 20000 });
    const report = await strong.evaluate((el) => {
      const nickname = "Coming for that one";
      let em = el.querySelector(".nickname");
      if (!em) {
        em = document.createElement("em");
        em.className = "nickname";
        el.appendChild(document.createTextNode(" "));
        el.appendChild(em);
      }
      em.textContent = `“${nickname}”`;
      const style = getComputedStyle(el);
      const box = el.getBoundingClientRect();
      const range = document.createRange();
      const nodes = [];
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let current;
      while ((current = walker.nextNode())) nodes.push(current);
      const flat = nodes.map((node) => node.textContent || "").join("");
      let hidden = 0;
      let lines = 1;
      let lastTop = null;
      let lastIndex = -1;
      let midWord = false;
      let index = -1;
      for (const node of nodes) {
        const value = node.textContent || "";
        for (let i = 0; i < value.length; i += 1) {
          index += 1;
          const ch = value[i];
          range.setStart(node, i);
          range.setEnd(node, i + 1);
          const rect = range.getClientRects()[0];
          const shown = Boolean(rect)
            && rect.width > 0.2
            && rect.height > 0.2
            && rect.top >= box.top - 1
            && rect.bottom <= box.bottom + 1
            && rect.left >= box.left - 1
            && rect.right <= box.right + 1;
          if (!shown) {
            if (!/\s/.test(ch)) hidden += 1;
            continue;
          }
          if (lastTop != null && Math.abs(rect.top - lastTop) > 1) {
            lines += 1;
            const prev = flat[lastIndex];
            const gap = flat.slice(lastIndex + 1, index);
            if (prev && !/[\s-]/.test(prev) && !/[\s-]/.test(ch) && !/[\s-]/.test(gap)) midWord = true;
          }
          lastIndex = index;
          lastTop = rect.top;
        }
      }
      const row = el.closest(".sheet-row");
      const nick = el.querySelector(".nickname");
      return {
        text: (el.textContent || "").replace(/\s+/g, " ").trim(),
        hidden,
        lines,
        midWord,
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        textOverflow: style.textOverflow,
        nickDisplay: nick ? getComputedStyle(nick).display : "",
        rowOverflow: row.scrollWidth - row.clientWidth,
        pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    expect(report.text, JSON.stringify(report)).toContain("Quentin Johnston");
    expect(report.text, JSON.stringify(report)).toContain("Coming for that one");
    expect(report.lines, JSON.stringify(report)).toBeGreaterThan(1);
    expect(report.nickDisplay, JSON.stringify(report)).toBe("block");
    expectWhole(report);
  });
}

test("a league team line wraps at 390", async ({ page }) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/l/${LEAGUE}/league`);
  await expect(page.locator("body")).toHaveClass(/league-loaded/, { timeout: 45000 });
  const line = page.locator(".power-board-row .team-identity-copy > span", { hasText: "Rebuilding well" }).first();
  await expect(line).toBeVisible({ timeout: 20000 });
  const report = await textFit(line);
  expect(report.text, JSON.stringify(report)).toContain("Rebuilding well");
  expect(report.whiteSpace, JSON.stringify(report)).toBe("normal");
  expect(report.lines, JSON.stringify(report)).toBeGreaterThan(1);
  expectWhole(report);
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
