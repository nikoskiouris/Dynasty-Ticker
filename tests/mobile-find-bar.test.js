import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { PHONE_LAYOUT_QUERY } from "../docs/modules/constants.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const docs = join(root, "docs");

function readDocs(name) {
  return readFileSync(join(docs, name), "utf8");
}

test("Find my leagues stays a real button and no longer docks on scroll", () => {
  const index = readDocs("index.html");
  const landing = readDocs("ui/landing.html");
  const app = readDocs("app.js");
  const css = `${readDocs("styles.css")}\n${readDocs("product.css")}`;
  assert.match(index, /class="skip-link"/);
  assert.match(index, /<button id="sticky-find-btn" type="button"/);
  assert.match(landing, /id="landing-find-btn"/);
  assert.match(landing, /type="submit"/);
  assert.match(app, /stickyFindBtn\?\.addEventListener\("click"[\s\S]{0,500}focusUsernameSearch\(\)/);
  assert.match(css, /:focus-visible/);
  assert.doesNotMatch(app, /new IntersectionObserver/);
  assert.doesNotMatch(app, /landingSearchOffscreen/);
  assert.doesNotMatch(css, /body\.dock-visible/);
  assert.match(css, /\.site-dock\s*\{[^}]*position:\s*fixed/s);
  assert.match(css, /@media \(max-width:\s*700px\)[\s\S]*?\.site-dock,[\s\S]*?position:\s*static/);
  assert.doesNotMatch(css, /\.mobile-chrome\s*\{[^}]*position:\s*sticky/);
});

async function findChrome() {
  const names = [
    process.env.CHROME_PATH,
    "google-chrome",
    "google-chrome-stable",
    "chromium",
    "chromium-browser",
    "/usr/local/bin/google-chrome",
  ].filter(Boolean);
  for (const bin of names) {
    const ok = await new Promise((resolve) => {
      const probe = spawn(bin, ["--version"], { stdio: "ignore" });
      probe.on("error", () => resolve(false));
      probe.on("exit", (code) => resolve(code === 0));
    });
    if (ok) return bin;
  }
  return "";
}

function fixtureHtml() {
  const cssHref = (name) => `file://${join(docs, name)}`;
  const scrollModule = pathToFileURL(join(docs, "modules/mobile-chrome-scroll.js")).href;
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="stylesheet" href="${cssHref("styles.css")}" />
    <link rel="stylesheet" href="${cssHref("product.css")}" />
    <title>Find bar probe</title>
  </head>
  <body>
    <a class="skip-link" href="#workspace">Skip to content</a>
    <div class="app-frame">
      <header class="mobile-chrome" id="mobile-chrome">
        <button type="button" class="mobile-icon-btn" aria-label="Sections"><span class="menu-bars"></span></button>
        <div class="mobile-chrome-copy">
          <span class="brand-lockup brand-lockup--header">
            <img class="brand-wordmark" alt="Dynasty Ticker" width="364" height="57" />
          </span>
          <div class="mobile-chrome-title-row"><strong>Your Sleeper league</strong></div>
        </div>
      </header>
      <div class="rail-backdrop" id="rail-backdrop" hidden></div>
      <aside class="control-rail" id="control-rail" aria-label="League controls"></aside>
      <main class="workspace" id="workspace">
        <div class="desk-nav" id="desk-nav">
          <nav class="workspace-tabs">
            <button class="page-tab active" type="button">Players</button>
            <button class="page-tab" type="button">Trade</button>
            <button class="page-tab" type="button">My League</button>
          </nav>
        </div>
        <form class="landing-search">
          <div class="landing-search-row">
            <input id="landing-username" value="" />
            <button id="landing-find-btn" type="submit">Find my leagues</button>
          </div>
        </form>
        <article class="ranks-card" id="player-card">
          <h2>Jahmyr Gibbs</h2>
          <h3>Similar value</h3>
          <p>Neighbor row that used to sit under the pinned bar.</p>
        </article>
        <div id="site-dock" class="site-dock">
          <div id="sticky-mobile-cta" class="sticky-mobile-cta" hidden>
            <button id="sticky-find-btn" type="button">Find my leagues</button>
          </div>
        </div>
      </main>
    </div>
    <style>
      #player-card { min-height: 1600px; }
    </style>
    <script type="module">
      import { bindMobileChromeScroll } from ${JSON.stringify(scrollModule)};
      bindMobileChromeScroll(window, {
        chrome: document.getElementById("mobile-chrome"),
        isPhone: () => window.matchMedia(${JSON.stringify(PHONE_LAYOUT_QUERY)}).matches,
        prefersReducedMotion: () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      });
      window.__chromeScrollBound = true;
    </script>
  </body>
</html>`;
}

const MEASURE = `(async () => {
  document.documentElement.style.scrollBehavior = "auto";
  const card = document.querySelector(".ranks-card");
  const chrome = document.getElementById("mobile-chrome");
  const settle = () => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
  const scrollToY = async (y) => {
    window.scrollTo({ top: y, behavior: "instant" });
    await settle();
  };
  await scrollToY(0);
  const atTopAway = chrome.classList.contains("is-away");
  await scrollToY(120);
  const afterDown = chrome.classList.contains("is-away");
  const inertWhenHidden = chrome.hasAttribute("inert");
  const downTransform = getComputedStyle(chrome).transform;
  const transitionDuration = getComputedStyle(chrome).transitionDuration;
  await scrollToY(112);
  const afterSmallUp = chrome.classList.contains("is-away");
  await scrollToY(90);
  const afterUp = chrome.classList.contains("is-away");
  const inertWhenShown = chrome.hasAttribute("inert");
  await scrollToY(96);
  const afterSmallDown = chrome.classList.contains("is-away");
  await scrollToY(card.getBoundingClientRect().top + window.scrollY);
  const rect = (el) => {
    const r = el.getBoundingClientRect();
    return { top: r.top, left: r.left, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
  };
  const overlapArea = (a, b) => {
    const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
    const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    return w > 0 && h > 0 ? w * h : 0;
  };
  const cardBox = rect(card);
  const overlaps = [];
  for (const el of document.querySelectorAll("*")) {
    const pos = getComputedStyle(el).position;
    if (pos !== "fixed" && pos !== "sticky") continue;
    if (el.classList.contains("is-away")) continue;
    const box = rect(el);
    if (box.bottom <= 1) continue;
    const hit = overlapArea(cardBox, box);
    if (hit > 1) overlaps.push({ id: el.id, className: String(el.className), pos, hit });
  }
  const position = {};
  for (const id of ["site-dock", "sticky-mobile-cta", "sticky-find-btn", "mobile-chrome"]) {
    position[id] = getComputedStyle(document.getElementById(id)).position;
  }
  return {
    bound: window.__chromeScrollBound === true,
    atTopAway,
    afterDown,
    afterSmallUp,
    afterUp,
    afterSmallDown,
    inertWhenHidden,
    inertWhenShown,
    downTransform,
    transitionDuration,
    scrollPadding: getComputedStyle(document.documentElement).scrollPaddingTop,
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    position,
    rail: getComputedStyle(document.getElementById("control-rail")).position,
    chromeDisplay: getComputedStyle(chrome).display,
    chromeHeight: rect(chrome).height,
    bodyPad: getComputedStyle(document.body).paddingBottom,
    workspacePad: getComputedStyle(document.querySelector(".workspace")).paddingBottom,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    overlaps,
    buttonTag: document.getElementById("sticky-find-btn").tagName,
  };
})()`;

function launchChrome(bin) {
  const dir = mkdtempSync(join(tmpdir(), "dt-find-bar-"));
  const proc = spawn(bin, [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--allow-file-access-from-files",
    "--remote-debugging-port=0",
    `--user-data-dir=${dir}`,
    "about:blank",
  ], { stdio: ["ignore", "pipe", "pipe"] });
  let stderr = "";
  proc.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });
  const stop = () => {
    proc.kill("SIGKILL");
    rmSync(dir, { recursive: true, force: true });
  };
  return { proc, stop, endpoint: async () => {
    const started = Date.now();
    while (Date.now() - started < 8000) {
      const match = stderr.match(/ws:\/\/127\.0\.0\.1:\d+\/devtools\/browser\/[^\s]+/);
      if (match) return match[0];
      if (proc.exitCode != null) throw new Error(`Chrome exited early: ${stderr}`);
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
    throw new Error(`Chrome did not open a debug port: ${stderr}`);
  } };
}

async function withPage(bin, htmlPath, run) {
  const chrome = launchChrome(bin);
  const browserWs = await chrome.endpoint();
  const ws = new WebSocket(browserWs);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });
  let nextId = 0;
  const pending = new Map();
  ws.addEventListener("message", (event) => {
    const msg = JSON.parse(event.data);
    if (!msg.id || !pending.has(msg.id)) return;
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
    else resolve(msg.result || {});
  });
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    ws.send(JSON.stringify(payload));
  });
  try {
    const { targetId } = await send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
    await send("Page.enable", {}, sessionId);
    await send("Runtime.enable", {}, sessionId);
    const fileUrl = `file://${htmlPath}`;
    const measure = async (width, height, mobile, media = []) => {
      await send("Emulation.setEmulatedMedia", { features: media }, sessionId);
      await send("Emulation.setDeviceMetricsOverride", {
        width,
        height,
        deviceScaleFactor: 1,
        mobile,
      }, sessionId);
      await send("Page.navigate", { url: fileUrl }, sessionId);
      const started = Date.now();
      while (Date.now() - started < 8000) {
        const state = await send("Runtime.evaluate", {
          expression: "document.readyState === 'complete' && window.__chromeScrollBound === true",
          returnByValue: true,
        }, sessionId);
        if (state.result?.value === true) break;
        await new Promise((resolve) => setTimeout(resolve, 40));
      }
      const probed = await send("Runtime.evaluate", {
        expression: MEASURE,
        awaitPromise: true,
        returnByValue: true,
      }, sessionId);
      if (probed.exceptionDetails) {
        throw new Error(probed.exceptionDetails.text || "probe failed");
      }
      return probed.result.value;
    };
    return await run(measure);
  } finally {
    ws.close();
    chrome.stop();
  }
}

test("at 390px the Find bar is not sticky or fixed and does not cover the player card", async () => {
  const bin = await findChrome();
  assert.ok(bin, "headless Chrome is required to read computed position");
  const dir = mkdtempSync(join(tmpdir(), "dt-find-html-"));
  const htmlPath = join(dir, "find-bar.html");
  writeFileSync(htmlPath, fixtureHtml());
  try {
    await withPage(bin, htmlPath, async (measure) => {
      for (const width of [360, 390, 414]) {
        const box = await measure(width, 844, true);
        assert.equal(box.bound, true, `scroll binder at ${width}`);
        assert.equal(box.innerWidth, width, `viewport ${width}`);
        for (const id of ["site-dock", "sticky-mobile-cta", "sticky-find-btn"]) {
          assert.notEqual(box.position[id], "sticky", `${id} at ${width}`);
          assert.notEqual(box.position[id], "fixed", `${id} at ${width}`);
        }
        assert.equal(box.position["mobile-chrome"], "fixed", `top bar at ${width}`);
        assert.equal(box.atTopAway, false, `shown near the top at ${width}`);
        assert.equal(box.afterDown, true, `hidden after scroll down at ${width}`);
        assert.equal(box.afterSmallUp, true, `stays hidden under the threshold at ${width}`);
        assert.equal(box.afterUp, false, `shown on scroll up at ${width}`);
        assert.equal(box.afterSmallDown, false, `stays shown under the threshold at ${width}`);
        assert.equal(box.inertWhenHidden, true, `hidden bar leaves the tab order at ${width}`);
        assert.equal(box.inertWhenShown, false, `shown bar can take focus at ${width}`);
        assert.notEqual(box.downTransform, "none");
        assert.equal(box.transitionDuration, "0.18s");
        assert.ok(Number.parseFloat(box.scrollPadding) >= 40, `scroll padding ${box.scrollPadding}`);
        assert.equal(box.buttonTag, "BUTTON");
        assert.equal(box.bodyPad, "0px");
        assert.ok(Number.parseFloat(box.workspacePad) < 48, `workspace pad ${box.workspacePad}`);
        assert.ok(box.overflow <= 1, `overflow ${box.overflow} at ${width}`);
        assert.deepEqual(box.overlaps, [], `sticky overlap at ${width}: ${JSON.stringify(box.overlaps)}`);
      }

      const phone = await measure(390, 844, true);
      assert.ok(phone.chromeHeight > 0 && phone.chromeHeight <= 48, `top bar ${phone.chromeHeight}px`);
      assert.equal(phone.chromeDisplay, "grid");

      const reduced = await measure(390, 844, true, [
        { name: "prefers-reduced-motion", value: "reduce" },
      ]);
      assert.equal(reduced.afterDown, true, "reduced motion still hides on scroll down");
      assert.equal(reduced.afterUp, false, "reduced motion still shows on scroll up");
      assert.equal(reduced.transitionDuration, "0s");

      const desk = await measure(768, 1024, false);
      assert.equal(desk.innerWidth, 768);
      assert.equal(desk.position["site-dock"], "fixed", "desktop dock stays fixed");
      assert.equal(desk.afterDown, false, "desktop scroll does not hide a phone bar");
      for (const id of ["sticky-mobile-cta", "sticky-find-btn"]) {
        assert.notEqual(desk.position[id], "sticky", `${id} at 768`);
        assert.notEqual(desk.position[id], "fixed", `${id} at 768`);
      }
      assert.equal(desk.rail, "sticky");
      assert.equal(desk.chromeDisplay, "none");
      assert.ok(desk.overflow <= 1, `desktop overflow ${desk.overflow}`);
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
