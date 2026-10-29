import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { removeTempDir, stopChrome } from "./support/temp-dir.js";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const docs = join(root, "docs");

function readDocs(name) {
  return readFileSync(join(docs, name), "utf8");
}

test("a player added in Check an offer uses the 40px face", () => {
  const app = readDocs("app.js");
  const label = app.slice(app.indexOf("function renderSelectedTokenLabel"), app.indexOf("function draftItemMismatch"));
  assert.match(label, /renderPlayerFace\(facePlayerId\(asset\), asset\?\.name, \{ size: "sm" \}\)/);
  assert.doesNotMatch(label, /size:\s*"xs"/);
});

test("density tokens load before the desk styles and the fonts stay on this origin", () => {
  for (const page of ["index.html", "404.html", "privacy.html", "terms.html"]) {
    const html = readDocs(page);
    // index.html sits under <base href="/">; the others use root URLs.
    const at = (file) => Math.max(html.indexOf(`href="./${file}"`), html.indexOf(`href="/${file}"`));
    const tokensAt = at("tokens.css");
    const stylesAt = at("styles.css");
    const productAt = at("product.css");
    assert.ok(tokensAt >= 0 && tokensAt < stylesAt && stylesAt < productAt, page);
    assert.doesNotMatch(html, /fonts\.googleapis|fonts\.gstatic/);
  }
  const tokens = readDocs("tokens.css");
  const styles = readDocs("styles.css");
  assert.match(tokens, /@font-face/);
  assert.match(tokens, /font-family:\s*"Instrument Sans"/);
  assert.match(tokens, /instrument-sans-latin\.woff2/);
  assert.match(tokens, /--font-brand:\s*"Instrument Serif"/);
  assert.match(tokens, /--fs-body:\s*13px/);
  assert.match(tokens, /--fs-h1:\s*17px/);
  assert.match(tokens, /--fs-num-xl:\s*22px/);
  assert.match(tokens, /--btn-h:\s*32px/);
  assert.match(tokens, /--input-h:\s*32px/);
  assert.match(tokens, /--card-pad:\s*10px/);
  assert.match(tokens, /--r-sm:\s*6px/);
  assert.match(tokens, /--r-md:\s*8px/);
  assert.match(tokens, /--row-h-compact:\s*36px/);
  assert.match(tokens, /--tap-min:\s*44px/);
  assert.match(tokens, /--focus:\s*0 0 0 2px/);
  assert.match(styles, /\.ranks-card-price span,\s*\n\.ranks-facts dt \{[^}]*font-size:\s*var\(--fs-xs\)/);
  assert.match(styles, /\.ranks-facts dd \{[^}]*font-size:\s*var\(--fs-num\)/);
  assert.match(styles, /\.ranks-facts dd \{[^}]*font-weight:\s*700/);
  assert.doesNotMatch(styles, /font-weight:\s*(800|900)/);
  const product = readDocs("product.css");
  assert.match(product, /min\(0px, calc\(\(100% - var\(--tap-min\)\) \/ 2\)\)/);
  assert.match(product, /\.mobile-chrome \{[^}]*background:\s*var\(--bg\)/);
  assert.match(product, /header#mobile-chrome \{[^}]*background-color:\s*var\(--bg\)/);
  assert.doesNotMatch(product, /\.mobile-chrome \{[^}]*88%/);
  const headers = readFileSync(join(docs, "_headers"), "utf8");
  assert.match(headers, /\/fonts\/\*\.woff2[\s\S]*Cache-Control:\s*public,\s*max-age=31536000,\s*immutable/);
  assert.match(styles, /--font-display:\s*var\(--font-ui\)/);
  assert.match(styles, /font-size:\s*var\(--fs-body\)/);
  assert.match(styles, /font-size:\s*var\(--fs-h1\)/);
  assert.match(styles, /outline:\s*2px solid/);
  const desk = `${styles}\n${readDocs("product.css")}`;
  assert.match(desk, /@supports\s*\(-webkit-touch-callout:\s*none\)/);
  assert.match(desk, /font-size:\s*16px/);
  for (const file of [
    "instrument-sans-latin.woff2",
    "instrument-sans-latin-ext.woff2",
    "instrument-serif-latin.woff2",
  ]) {
    assert.ok(statSync(join(docs, "fonts", file)).size > 1000, file);
  }
});

test("index preloads the above-the-fold Instrument Sans file", () => {
  const html = readDocs("index.html");
  const tokens = readDocs("tokens.css");
  const preloads = [...html.matchAll(/<link\b[^>]*>/gi)]
    .map((match) => match[0])
    .filter((tag) => /\brel=["']preload["']/.test(tag));
  assert.deepEqual(preloads.length, 1);
  const tag = preloads[0];
  assert.match(tag, /\bas=["']font["']/);
  assert.match(tag, /\btype=["']font\/woff2["']/);
  assert.match(tag, /\bcrossorigin\b/);
  const href = tag.match(/\bhref=["']([^"']+)["']/)[1];
  assert.equal(href, "./fonts/instrument-sans-latin.woff2");
  assert.ok(statSync(join(docs, href.replace(/^\.\//, ""))).size > 1000, href);
  assert.ok(html.indexOf(tag) < html.indexOf('href="./tokens.css"'));
  assert.match(html, /font-src 'self'/);
  assert.doesNotMatch(html, /fonts\.googleapis|fonts\.gstatic/);
  const faces = tokens.match(/@font-face\s*\{[^}]+\}/g);
  assert.ok(faces?.length >= 2);
  for (const face of faces) assert.match(face, /font-display:\s*swap/);
  assert.match(tokens, /font-weight:\s*400 700/);
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
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="stylesheet" href="${cssHref("tokens.css")}" />
    <link rel="stylesheet" href="${cssHref("styles.css")}" />
    <link rel="stylesheet" href="${cssHref("product.css")}" />
    <title>Density probe</title>
  </head>
  <body>
    <h1 id="hero-title">Your Sleeper league</h1>
    <form class="landing-search">
      <div class="landing-search-row">
        <input id="landing-username" value="manager" />
        <button id="landing-find-btn" type="submit">Find my leagues</button>
      </div>
    </form>
    <header class="mobile-chrome" id="mobile-chrome">
      <button id="mobile-rail-toggle" class="mobile-icon-btn" type="button" aria-label="Menu"></button>
      <button id="mobile-home-btn" class="mobile-icon-btn" type="button" aria-label="Home"></button>
    </header>
    <button id="mobile-rail-close" class="mobile-rail-close" type="button" aria-label="Close">×</button>
    <p class="ranks-card-price"><span id="price-label">Model</span><strong id="price">8421</strong></p>
    <dl class="ranks-facts"><div><dt id="fact-label">Projected</dt><dd id="fact-value">23.1</dd></div></dl>
    <button id="find-leagues-btn" type="button">Find my leagues</button>
    <button id="load-league-btn" type="button">Load League</button>
    <button id="open-public-ranks" class="ghost-btn" type="button">Look up a player</button>
    <button id="home-btn" class="ghost-btn" type="button">Close</button>
    <button id="add-trade" class="ghost-btn" type="button">Add to trade</button>
    <button id="desk-room" class="phone-desk-room" type="button">Room</button>
    <input class="ranks-search" id="player-search" type="search" aria-label="Search players" />
    <div class="ranks-toolbar">
      <div class="ranks-filters" id="pos-row">
        <button id="ranks-chip" class="ranks-chip" type="button">All</button>
        <button class="ranks-chip" type="button">QB</button>
      </div>
      <div class="ranks-filters" id="format-row">
        <button class="ranks-chip" type="button">Superflex</button>
        <button class="ranks-chip" type="button">1QB</button>
      </div>
    </div>
    <div class="sample-banner">
      <button type="button" id="sample-banner-find">Find my leagues</button>
    </div>
    <select data-change="lens-roster" id="lens-roster"><option>Roster</option></select>
    <button type="button" id="weekly-help-btn" class="weekly-help-btn">?</button>
    <p class="muted small pick-mock-note">Dynasty Nerds <button type="button" class="inline-link" id="mock-link" data-action="go" data-page="league" data-room="board" data-open-mock="1">Full board</button></p>
    <section class="workspace-panel mock-board">
      <div class="panel-heading">
        <p class="section-copy">Dynasty Nerds · <a class="inline-link" id="mock-article" href="https://example.com/mock">Open article</a></p>
      </div>
    </section>
    <p id="landing-job-hint" class="muted landing-job-hint">Type your Sleeper username. No name yet? <a id="sample-league-link" class="sample-league-link" href="./?sample=1">See the sample league</a>.</p>
    <form class="player-connect" data-player-connect>
      <input id="player-connect-user" class="player-connect-user" name="username" aria-label="Sleeper username" placeholder="Sleeper username" />
      <button id="player-connect-find" type="submit">Find my leagues</button>
    </form>
    <button type="button" class="selected-token" id="offer-token">
      <span class="selected-token-label player-name"><span class="player-face player-face-sm" id="offer-headshot"><img class="player-face-photo" id="offer-photo" alt="" width="64" height="64" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" /></span><span class="player-name-text">Jahmyr Gibbs</span></span>
    </button>
    <div class="week-chips" id="week-chips">
      <button type="button">Wk 1</button>
      <button type="button">Wk 2</button>
      <button type="button">Wk 3</button>
      <button type="button">Wk 4</button>
      <button type="button" id="week-chip" class="active">Wk 5</button>
    </div>
    <article class="ranks-card">
      <div class="ranks-card-main">
        <div class="ranks-headshot" id="ranks-headshot">
          <img class="rather-photo" id="ranks-photo" alt="" width="64" height="64" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" />
        </div>
      </div>
    </article>
    <span class="player-face player-face-md" id="card-headshot"><img class="player-face-photo" id="card-photo" alt="" width="64" height="64" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" /></span>
    <span class="player-face player-face-sm" id="headshot"></span>
    <div class="workspace">
      <div class="roster-sheet">
        <div class="sheet-grid">
          <section class="sheet-column">
            <div class="sheet-row">
              <span class="sheet-slot">WR</span>
              <div class="sheet-player">
                <span class="player-face player-face-sm" id="list-headshot"><img class="player-face-photo" id="list-photo" alt="" width="64" height="64" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" /></span>
                <strong>Marquez Valdes-Scantling</strong>
              </div>
              <span class="sheet-metrics"><span class="weekly-chip"><small>This week</small><strong>12.1</strong></span><span class="dynasty-chip"><small>Model</small><strong>4100</strong></span></span>
            </div>
            <div class="sheet-row">
              <span class="sheet-slot">WR</span>
              <div class="sheet-player">
                <span class="player-face player-face-sm"></span>
                <strong>Amon-Ra St. Brown <em class="nickname">“Sun God”</em></strong>
              </div>
              <span class="sheet-metrics"><span class="weekly-chip"><small>This week</small><strong>18.4</strong></span><span class="dynasty-chip"><small>Model</small><strong>8421</strong></span></span>
            </div>
            <div class="sheet-row">
              <span class="sheet-slot">RB</span>
              <div class="sheet-player">
                <span class="player-face player-face-sm"></span>
                <strong>Christopher Rodriguez Jr.</strong>
              </div>
              <span class="sheet-metrics"><span class="weekly-chip"><small>This week</small><strong>8.2</strong></span><span class="dynasty-chip"><small>Model</small><strong>2200</strong></span></span>
            </div>
          </section>
        </div>
      </div>
    </div>
    <details class="workspace-panel"><summary id="own-summary">Ownership history</summary></details>
    <details class="league-id-fallback"><summary id="league-summary">Have a league ID or URL instead?</summary></details>
    <select id="me-select"><option>Team</option></select>
    <button id="page-tab" class="page-tab" type="button">Players</button>
    <button id="room-tab" class="room-tab" type="button">Ranks</button>
    <button id="team-trade" class="team-card-trade" type="button">Build a trade</button>
    <button class="ranks-row" type="button"><span>1</span><span>Jahmyr Gibbs</span><strong>8421</strong></button>
    <button class="ranks-row" id="long-name-row" type="button">
      <span class="ranks-num">12</span>
      <span class="ranks-who">
        <strong class="player-name"><span class="player-face player-face-sm"></span><span class="player-name-text">Marquez Valdes-Scantling</span></strong>
        <small>WR · GB</small>
      </span>
      <span class="ranks-value">4100</span>
    </button>
  </body>
</html>`;
}

const MEASURE = `(() => {
  const px = (value) => Number.parseFloat(value);
  const styleOf = (el) => getComputedStyle(el);
  const box = (el) => {
    const r = el.getBoundingClientRect();
    return { height: r.height, width: r.width };
  };
  const body = styleOf(document.body);
  const h1 = styleOf(document.querySelector("h1"));
  const price = styleOf(document.querySelector(".ranks-card-price strong"));
  const priceLabel = styleOf(document.querySelector("#price-label"));
  const factLabel = styleOf(document.querySelector("#fact-label"));
  const factValue = styleOf(document.querySelector("#fact-value"));
  const button = document.querySelector("#landing-find-btn");
  const input = document.querySelector("#landing-username");
  const row = document.querySelector(".ranks-row");
  const hitOf = (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const pseudo = getComputedStyle(el, "::before");
    const raw = (side) => Number.parseFloat(pseudo[side]) || 0;
    const grow = (side) => {
      const value = raw(side);
      return value < 0 ? -value : 0;
    };
    const live = pseudo.content !== "none" && pseudo.content !== "normal" && pseudo.position === "absolute";
    const borderY = (Number.parseFloat(cs.borderTopWidth) || 0) + (Number.parseFloat(cs.borderBottomWidth) || 0);
    const borderX = (Number.parseFloat(cs.borderLeftWidth) || 0) + (Number.parseFloat(cs.borderRightWidth) || 0);
    const pseudoHeight = live ? (r.height - borderY) + grow("top") + grow("bottom") : r.height;
    const pseudoWidth = live ? (r.width - borderX) + grow("left") + grow("right") : r.width;
    const height = Math.max(r.height, pseudoHeight);
    const width = Math.max(r.width, pseudoWidth);
    const top = Math.min(r.top, r.top + (Number.parseFloat(cs.borderTopWidth) || 0) - (live ? grow("top") : 0));
    const left = Math.min(r.left, r.left + (Number.parseFloat(cs.borderLeftWidth) || 0) - (live ? grow("left") : 0));
    return {
      height,
      width,
      visual: r.height,
      visualWidth: r.width,
      top,
      left,
      bottom: top + height,
      right: left + width,
    };
  };
  const hits = {};
  for (const id of [
    "mobile-rail-toggle",
    "mobile-home-btn",
    "mobile-rail-close",
    "landing-find-btn",
    "find-leagues-btn",
    "load-league-btn",
    "open-public-ranks",
    "home-btn",
    "add-trade",
    "desk-room",
    "ranks-chip",
    "own-summary",
    "league-summary",
    "me-select",
    "page-tab",
    "room-tab",
    "team-trade",
    "sample-banner-find",
    "weekly-help-btn",
    "mock-link",
    "mock-article",
    "sample-league-link",
    "week-chip",
    "lens-roster",
    "player-search",
    "player-connect-user",
    "player-connect-find",
  ]) {
    const el = document.getElementById(id);
    hits[id] = hitOf(el);
  }
  button.focus({ focusVisible: true });
  const focusOutline = styleOf(button).outlineWidth;
  const short = [];
  for (const el of document.querySelectorAll("button, a, input, select, textarea, summary")) {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") continue;
    const hit = hitOf(el);
    if (hit.visual < 1 && hit.visualWidth < 1) continue;
    const tooShort = hit.height < 43.4;
    const narrow = hit.visualWidth < 44 && hit.width < 43.4;
    if (tooShort || narrow) {
      short.push(el.id || el.className || el.tagName);
    }
  }
  const rowHits = (id) => [...document.querySelectorAll("#" + id + " button.ranks-chip")].map(hitOf);
  let chipOverlap = 0;
  for (const a of rowHits("pos-row")) {
    for (const b of rowHits("format-row")) {
      const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      if (oy > 0 && ox > 0) chipOverlap = Math.max(chipOverlap, oy);
    }
  }
  const headshot = box(document.querySelector("#headshot"));
  const faceBox = (id) => box(document.querySelector("#" + id));
  const clippedNames = [];
  for (const el of document.querySelectorAll(".sheet-player strong, .player-name-text")) {
    const style = getComputedStyle(el);
    const ellipsis = style.textOverflow === "ellipsis" && style.whiteSpace === "nowrap" && style.overflowX === "hidden";
    const wide = el.scrollWidth > el.clientWidth + 1;
    const tall = el.scrollHeight > el.clientHeight + 1;
    const row = el.closest(".sheet-row");
    const rowWide = row && row.scrollWidth > row.clientWidth + 1;
    if (((wide || tall) && !ellipsis) || rowWide) clippedNames.push((el.textContent || "").trim().slice(0, 48));
  }
  let maxFont = 0;
  for (const el of document.querySelectorAll("*")) {
    const size = px(styleOf(el).fontSize);
    if (size > maxFont) maxFont = size;
  }
  const root = styleOf(document.documentElement);
  const contrast = (fg, bg) => {
    const lum = (hex) => {
      const n = Number.parseInt(hex.slice(1), 16);
      const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
    };
    const a = lum(fg);
    const b = lum(bg);
    const [hi, lo] = a > b ? [a, b] : [b, a];
    return (hi + 0.05) / (lo + 0.05);
  };
  return {
    innerWidth: window.innerWidth,
    bodyFont: body.fontSize,
    bodyFamily: body.fontFamily,
    h1Font: h1.fontSize,
    h1Family: h1.fontFamily,
    priceFont: price.fontSize,
    priceWeight: price.fontWeight,
    labelFont: priceLabel.fontSize,
    factFont: factLabel.fontSize,
    factWeight: factLabel.fontWeight,
    factValueFont: factValue.fontSize,
    factValueWeight: factValue.fontWeight,
    maxFont,
    hits,
    focusOutline,
    buttonHeight: box(button).height,
    inputHeight: box(input).height,
    inputFont: styleOf(input).fontSize,
    rowHeight: box(row).height,
    numXl: root.getPropertyValue("--fs-num-xl").trim(),
    textOnBg: contrast(root.getPropertyValue("--text").trim(), root.getPropertyValue("--bg").trim()),
    mutedOnBg: contrast(root.getPropertyValue("--muted").trim(), root.getPropertyValue("--bg").trim()),
    sansReady: document.fonts.check('14px "Instrument Sans"'),
    chromeBg: styleOf(document.querySelector("#mobile-chrome")).backgroundColor,
    short,
    chipOverlap,
    headshot: headshot.width,
    cardHead: faceBox("card-headshot").width,
    cardPhoto: faceBox("card-photo").width,
    listHead: faceBox("list-headshot").width,
    listPhoto: faceBox("list-photo").width,
    ranksHead: faceBox("ranks-headshot").width,
    ranksPhoto: faceBox("ranks-photo").width,
    cardHeadH: faceBox("card-headshot").height,
    listHeadH: faceBox("list-headshot").height,
    ranksHeadH: faceBox("ranks-headshot").height,
    offerHead: faceBox("offer-headshot").width,
    offerPhoto: faceBox("offer-photo").width,
    offerHeadH: faceBox("offer-headshot").height,
    offerPhotoH: faceBox("offer-photo").height,
    connectFont: styleOf(document.querySelector("#player-connect-user")).fontSize,
    clippedNames,
  };
})()`;

// Same hardening as tests/mobile-find-bar.test.js (#159): wait 30s for the
// debug port, retry once, and skip only when Chrome never starts.
const CHROME_PORT_WAIT_MS = 30000;

class ChromeLaunchError extends Error {
  constructor(message) {
    super(message);
    this.name = "ChromeLaunchError";
  }
}

function isChromeLaunchFailure(error) {
  return error instanceof ChromeLaunchError || error?.name === "ChromeLaunchError";
}

function launchChrome(bin) {
  const dir = mkdtempSync(join(tmpdir(), "dt-density-"));
  const proc = spawn(bin, [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--no-first-run",
    "--no-default-browser-check",
    "--allow-file-access-from-files",
    "--remote-debugging-port=0",
    `--user-data-dir=${dir}`,
    "about:blank",
  ], { stdio: ["ignore", "pipe", "pipe"] });
  let stderr = "";
  proc.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });
  const stop = () => stopChrome(proc, dir);
  return {
    stop,
    endpoint: async () => {
      const started = Date.now();
      while (Date.now() - started < CHROME_PORT_WAIT_MS) {
        const match = stderr.match(/ws:\/\/127\.0\.0\.1:\d+\/devtools\/browser\/[^\s]+/);
        if (match) return match[0];
        if (proc.exitCode != null) throw new ChromeLaunchError(`Chrome exited early: ${stderr}`);
        await new Promise((resolve) => setTimeout(resolve, 40));
      }
      throw new ChromeLaunchError(`Chrome did not open a debug port: ${stderr}`);
    },
  };
}

async function openChrome(bin) {
  let chrome = launchChrome(bin);
  try {
    return { chrome, browserWs: await chrome.endpoint() };
  } catch (error) {
    await chrome.stop();
    if (!isChromeLaunchFailure(error)) throw error;
    chrome = launchChrome(bin);
    try {
      return { chrome, browserWs: await chrome.endpoint() };
    } catch (retryError) {
      await chrome.stop();
      throw retryError;
    }
  }
}

async function measureAt(bin, htmlPath, width, mobile = true) {
  let chrome;
  let ws;
  try {
  const opened = await openChrome(bin);
  chrome = opened.chrome;
  const browserWs = opened.browserWs;
  ws = new WebSocket(browserWs);
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
    await send("Emulation.setDeviceMetricsOverride", {
      width,
      height: 844,
      deviceScaleFactor: 1,
      mobile,
    }, sessionId);
    await send("Page.navigate", { url: `file://${htmlPath}` }, sessionId);
    const started = Date.now();
    while (Date.now() - started < 8000) {
      const state = await send("Runtime.evaluate", {
        expression: "document.readyState",
        returnByValue: true,
      }, sessionId);
      if (state.result?.value === "complete") break;
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
    await send("Runtime.evaluate", {
      expression: "document.fonts.ready.then(() => true)",
      awaitPromise: true,
      returnByValue: true,
    }, sessionId);
    const probed = await send("Runtime.evaluate", {
      expression: MEASURE,
      returnByValue: true,
    }, sessionId);
    if (probed.exceptionDetails) {
      throw new Error(probed.exceptionDetails.text || JSON.stringify(probed.exceptionDetails));
    }
    return probed.result.value;
    } finally {
      try {
        ws?.close();
      } catch {
        /* socket already closed */
      }
    }
  } finally {
    await chrome?.stop();
  }
}

test("at 390px body, h1, number, controls, and rows use the density sizes", async (t) => {
  if (typeof WebSocket === "undefined") {
    t.skip("WebSocket is not available");
    return;
  }
  const bin = await findChrome();
  if (!bin) {
    t.skip("headless Chrome is not available");
    return;
  }
  const dir = mkdtempSync(join(tmpdir(), "dt-density-html-"));
  const htmlPath = join(dir, "density.html");
  writeFileSync(htmlPath, fixtureHtml());
  try {
    try {
    const box = await measureAt(bin, htmlPath, 390);
    assert.equal(box.innerWidth, 390);
    assert.equal(box.bodyFont, "13px");
    assert.equal(box.h1Font, "17px");
    assert.equal(box.priceFont, "22px");
    assert.equal(box.priceWeight, "700");
    assert.equal(box.labelFont, "11px");
    assert.equal(box.factFont, "11px");
    assert.equal(box.factWeight, "700");
    assert.equal(box.factValueFont, "14px");
    assert.equal(box.factValueWeight, "700");
    assert.equal(box.numXl, "22px");
    assert.ok(box.maxFont <= 22, `number max ${box.maxFont}`);
    assert.ok(Math.abs(box.buttonHeight - 32) < 0.6, `button height ${box.buttonHeight}`);
    assert.ok(box.inputHeight >= 44, `input height ${box.inputHeight}`);
    assert.ok(Math.abs(box.rowHeight - 44) < 0.6, `row height ${box.rowHeight}`);
    assert.ok(Math.abs(box.headshot - 40) < 0.6, `headshot ${box.headshot}`);
    for (const [label, size] of [
      ["card head", box.cardHead],
      ["card photo", box.cardPhoto],
      ["list head", box.listHead],
      ["list photo", box.listPhoto],
      ["ranks head", box.ranksHead],
      ["ranks photo", box.ranksPhoto],
      ["card head height", box.cardHeadH],
      ["list head height", box.listHeadH],
      ["ranks head height", box.ranksHeadH],
      ["offer head", box.offerHead],
      ["offer photo", box.offerPhoto],
      ["offer head height", box.offerHeadH],
      ["offer photo height", box.offerPhotoH],
    ]) {
      const want = label.includes("offer") ? 28 : 40;
      assert.ok(Math.abs(size - want) < 0.6, `${label} ${size}`);
    }
    assert.deepEqual(box.clippedNames, [], `clipped names ${box.clippedNames.join(" | ")}`);
    assert.equal(box.inputFont, "16px");
    assert.equal(box.connectFont, "16px");
    assert.match(box.bodyFamily, /Instrument Sans/);
    assert.match(box.h1Family, /Instrument Sans/);
    assert.equal(box.sansReady, true);
    assert.ok(box.textOnBg >= 4.5, `text contrast ${box.textOnBg}`);
    assert.ok(box.mutedOnBg >= 4.5, `muted contrast ${box.mutedOnBg}`);
    assert.equal(box.focusOutline, "2px");
    assert.equal(box.chromeBg, "rgb(12, 12, 14)");
    const squares = ["mobile-rail-toggle", "mobile-home-btn", "mobile-rail-close"];
    for (const id of Object.keys(box.hits)) {
      assert.ok(box.hits[id].height >= 43.5, `${id} hit height ${box.hits[id].height}`);
      if (squares.includes(id)) {
        assert.ok(box.hits[id].width >= 43.5, `${id} hit width ${box.hits[id].width}`);
      }
    }
    const desk = await measureAt(bin, htmlPath, 1280, false);
    assert.equal(desk.innerWidth, 1280);
    for (const id of ["page-tab", "room-tab", "team-trade", "landing-find-btn", "ranks-chip", "me-select", "sample-banner-find", "weekly-help-btn", "mock-link", "mock-article", "sample-league-link", "week-chip", "lens-roster", "player-connect-user", "player-connect-find"]) {
      assert.ok(desk.hits[id].height >= 43.5, `${id} desk hit ${desk.hits[id].height}`);
    }
    for (const id of ["mock-link", "mock-article", "sample-league-link", "week-chip", "player-connect-user", "player-connect-find"]) {
      for (const shot of [box, desk]) {
        assert.ok(shot.hits[id].visual >= 43.5, `${id} box ${shot.innerWidth} ${shot.hits[id].visual}`);
      }
    }
    for (const [label, size] of [
      ["desk card head", desk.cardHead],
      ["desk list head", desk.listHead],
      ["desk ranks head", desk.ranksHead],
      ["desk card photo", desk.cardPhoto],
      ["desk list photo", desk.listPhoto],
      ["desk ranks photo", desk.ranksPhoto],
      ["desk offer head", desk.offerHead],
      ["desk offer photo", desk.offerPhoto],
      ["desk offer head height", desk.offerHeadH],
      ["desk offer photo height", desk.offerPhotoH],
    ]) {
      const want = label.includes("offer") ? 28 : 40;
      assert.ok(Math.abs(size - want) < 0.6, `${label} ${size}`);
    }
    assert.deepEqual(desk.clippedNames, [], `desk clipped names ${desk.clippedNames.join(" | ")}`);
    for (const shot of [box, desk]) {
      assert.deepEqual(shot.short, [], `short targets ${shot.short.join(", ")}`);
      assert.ok(shot.chipOverlap <= 0.6, `chip overlap ${shot.chipOverlap}`);
    }
    } catch (error) {
      if (isChromeLaunchFailure(error)) {
        t.skip(`Chrome did not start: ${error.message}`);
        return;
      }
      throw error;
    }
  } finally {
    await removeTempDir(dir);
  }
});

test("trade chip prices use token colors at 4.5:1", () => {
  const css = readDocs("styles.css");
  const rule = css.match(/\.selected-token-price\s*\{([^}]*)\}/)?.[1] || "";
  const opacity = Number((rule.match(/opacity:\s*([0-9.]+)/) || [, "1"])[1]);
  const decl = (name) => {
    const match = css.match(new RegExp(`${name}\\s*:\\s*([^;]+);`));
    assert.ok(match, name);
    return match[1].trim();
  };
  const parse = (value) => {
    const hex = value.match(/^#([0-9a-f]{6})$/i);
    if (hex) {
      const n = Number.parseInt(hex[1], 16);
      return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
    }
    const rgba = value.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i);
    assert.ok(rgba, value);
    return { r: Number(rgba[1]), g: Number(rgba[2]), b: Number(rgba[3]), a: rgba[4] == null ? 1 : Number(rgba[4]) };
  };
  const over = (top, bottom) => ({
    r: top.r * top.a + bottom.r * (1 - top.a),
    g: top.g * top.a + bottom.g * (1 - top.a),
    b: top.b * top.a + bottom.b * (1 - top.a),
    a: 1,
  });
  const lum = ({ r, g, b }) => {
    const ch = [r, g, b].map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  };
  const ratio = (fg, bg) => {
    const hi = Math.max(lum(fg), lum(bg));
    const lo = Math.min(lum(fg), lum(bg));
    return (hi + 0.05) / (lo + 0.05);
  };
  const panel = parse(decl("--panel"));
  const paint = (paneTint, chipTint, ink) => {
    const pane = over(parse(paneTint), panel);
    const chip = over(parse(chipTint), pane);
    const text = over({ ...parse(ink), a: opacity }, chip);
    return ratio(text, chip);
  };
  const give = paint(decl("--team-a-soft"), decl("--blue-soft"), decl("--blue"));
  const get = paint(decl("--team-b-soft"), decl("--team-b-soft"), decl("--team-b"));
  assert.ok(give >= 4.5, `give price contrast ${give}`);
  assert.ok(get >= 4.5, `get price contrast ${get}`);
});

test("density: a failed assertion is not a Chrome launch failure", () => {
  assert.equal(isChromeLaunchFailure(new ChromeLaunchError("Chrome did not open a debug port")), true);
  let assertion;
  try {
    assert.equal(1, 2, "layout mismatch");
  } catch (error) {
    assertion = error;
  }
  assert.equal(isChromeLaunchFailure(assertion), false);
  assert.equal(isChromeLaunchFailure(new Error("Chrome did not open a debug port")), false);
});
