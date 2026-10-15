import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const docs = join(root, "docs");

function readDocs(name) {
  return readFileSync(join(docs, name), "utf8");
}

test("density tokens load before the desk styles and the fonts stay on this origin", () => {
  for (const page of ["index.html", "404.html", "privacy.html", "terms.html"]) {
    const html = readDocs(page);
    const tokensAt = html.indexOf('href="./tokens.css"');
    const stylesAt = html.indexOf('href="./styles.css"');
    const productAt = html.indexOf('href="./product.css"');
    assert.ok(tokensAt >= 0 && tokensAt < stylesAt && stylesAt < productAt, page);
    assert.doesNotMatch(html, /fonts\.googleapis|fonts\.gstatic/);
  }
  const tokens = readDocs("tokens.css");
  const styles = readDocs("styles.css");
  assert.match(tokens, /@font-face/);
  assert.match(tokens, /font-family:\s*"Instrument Sans"/);
  assert.match(tokens, /instrument-sans-latin\.woff2/);
  assert.match(tokens, /--font-brand:\s*"Instrument Serif"/);
  assert.match(tokens, /--fs-body:\s*14px/);
  assert.match(tokens, /--fs-h1:\s*18px/);
  assert.match(tokens, /--fs-num-xl:\s*24px/);
  assert.match(tokens, /--btn-h:\s*36px/);
  assert.match(tokens, /--input-h:\s*36px/);
  assert.match(tokens, /--card-pad:\s*12px/);
  assert.match(tokens, /--r-sm:\s*6px/);
  assert.match(tokens, /--r-md:\s*8px/);
  assert.match(tokens, /--row-h-compact:\s*40px/);
  assert.match(tokens, /--focus:\s*0 0 0 2px/);
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
    <p class="ranks-card-price"><strong id="price">8421</strong></p>
    <button class="ranks-row" type="button"><span>1</span><span>Jahmyr Gibbs</span><strong>8421</strong></button>
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
  const button = document.querySelector("#landing-find-btn");
  const input = document.querySelector("#landing-username");
  const row = document.querySelector(".ranks-row");
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
    maxFont,
    buttonHeight: box(button).height,
    inputHeight: box(input).height,
    inputFont: styleOf(input).fontSize,
    rowHeight: box(row).height,
    numXl: root.getPropertyValue("--fs-num-xl").trim(),
    textOnBg: contrast(root.getPropertyValue("--text").trim(), root.getPropertyValue("--bg").trim()),
    mutedOnBg: contrast(root.getPropertyValue("--muted").trim(), root.getPropertyValue("--bg").trim()),
    sansReady: document.fonts.check('14px "Instrument Sans"'),
  };
})()`;

function launchChrome(bin) {
  const dir = mkdtempSync(join(tmpdir(), "dt-density-"));
  const proc = spawn(bin, [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--remote-debugging-port=0",
    `--user-data-dir=${dir}`,
    "about:blank",
  ], { stdio: ["ignore", "pipe", "pipe"] });
  let stderr = "";
  proc.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });
  const exited = new Promise((resolve) => {
    if (proc.exitCode != null) resolve();
    else proc.once("exit", () => resolve());
  });
  const stop = async () => {
    try {
      proc.kill("SIGKILL");
    } catch {
      /* already gone */
    }
    await exited;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      try {
        rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 40 });
        return;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 40 * (attempt + 1)));
      }
    }
  };
  return {
    stop,
    endpoint: async () => {
      const started = Date.now();
      while (Date.now() - started < 8000) {
        const match = stderr.match(/ws:\/\/127\.0\.0\.1:\d+\/devtools\/browser\/[^\s]+/);
        if (match) return match[0];
        if (proc.exitCode != null) throw new Error(`Chrome exited early: ${stderr}`);
        await new Promise((resolve) => setTimeout(resolve, 40));
      }
      throw new Error(`Chrome did not open a debug port: ${stderr}`);
    },
  };
}

async function measureAt(bin, htmlPath, width) {
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
    await send("Emulation.setDeviceMetricsOverride", {
      width,
      height: 844,
      deviceScaleFactor: 1,
      mobile: true,
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
    ws.close();
    await chrome.stop();
  }
}

test("at 390px body, h1, number, controls, and rows use the density sizes", async () => {
  const bin = await findChrome();
  assert.ok(bin, "headless Chrome is required to read computed sizes");
  const dir = mkdtempSync(join(tmpdir(), "dt-density-html-"));
  const htmlPath = join(dir, "density.html");
  writeFileSync(htmlPath, fixtureHtml());
  try {
    const box = await measureAt(bin, htmlPath, 390);
    assert.equal(box.innerWidth, 390);
    assert.equal(box.bodyFont, "14px");
    assert.equal(box.h1Font, "18px");
    assert.equal(box.priceFont, "24px");
    assert.equal(box.numXl, "24px");
    assert.ok(box.maxFont <= 24, `number max ${box.maxFont}`);
    assert.ok(Math.abs(box.buttonHeight - 36) < 0.6, `button height ${box.buttonHeight}`);
    assert.ok(Math.abs(box.inputHeight - 36) < 0.6, `input height ${box.inputHeight}`);
    assert.ok(Math.abs(box.rowHeight - 40) < 0.6, `row height ${box.rowHeight}`);
    assert.equal(box.inputFont, "16px");
    assert.match(box.bodyFamily, /Instrument Sans/);
    assert.match(box.h1Family, /Instrument Sans/);
    assert.equal(box.sansReady, true);
    assert.ok(box.textOnBg >= 4.5, `text contrast ${box.textOnBg}`);
    assert.ok(box.mutedOnBg >= 4.5, `muted contrast ${box.mutedOnBg}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
