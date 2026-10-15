import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isKeyboardActivation, scheduleRankDialogFocus, tabWrapTarget } from "../docs/modules/focus-trap.js";

const docs = join(dirname(fileURLToPath(import.meta.url)), "../docs");

function readDocs(name) {
  return readFileSync(join(docs, name), "utf8");
}

function channel(hex) {
  const value = Number.parseInt(hex, 16) / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function contrast(fg, bg) {
  const lum = (hex) => {
    const raw = hex.replace("#", "");
    return 0.2126 * channel(raw.slice(0, 2))
      + 0.7152 * channel(raw.slice(2, 4))
      + 0.0722 * channel(raw.slice(4, 6));
  };
  const lighter = Math.max(lum(fg), lum(bg));
  const darker = Math.min(lum(fg), lum(bg));
  return (lighter + 0.05) / (darker + 0.05);
}

test("tab stays inside an open menu or dialog", () => {
  const nodes = ["close", "username", "find"];
  assert.equal(tabWrapTarget(nodes, "find", false), "close");
  assert.equal(tabWrapTarget(nodes, "close", true), "find");
  assert.equal(tabWrapTarget(nodes, "username", false), null);
  assert.equal(tabWrapTarget(nodes, "outside", false), "close");
  assert.equal(tabWrapTarget(nodes, "outside", true), "find");
  assert.equal(tabWrapTarget([], "close", false), null);
});

test("a keyboard league pick is not a mouse click", () => {
  assert.equal(isKeyboardActivation({ type: "click", detail: 0 }), true);
  assert.equal(isKeyboardActivation({ type: "click", detail: 1 }), false);
  assert.equal(isKeyboardActivation({ key: "Enter" }), true);
  assert.equal(isKeyboardActivation(null), false);
});

test("names, headings, ticker, and focus wiring are in the page", () => {
  const index = readDocs("index.html");
  const landing = readDocs("ui/landing.html");
  const app = readDocs("app.js");
  const css = readDocs("styles.css");
  assert.match(index, /id="sleeper-username"[\s\S]*aria-label="Sleeper username"/);
  assert.match(index, /id="me-select"[^>]*aria-label="Team"/);
  assert.match(index, /id="hero-title"[^>]*tabindex="-1"/);
  assert.doesNotMatch(index, /id="ticker"[^>]*aria-pressed/);
  assert.match(landing, /<h1 class="sr-only">Dynasty Ticker<\/h1>/);
  assert.match(app, /focusLoadedLeagueHeading = isKeyboardActivation/);
  assert.match(app, /focusLoadedLeague\(/);
  assert.match(app, /phonePageInert\(true\)/);
  assert.match(app, /tabWrapTarget\(focusableIn/);
  assert.match(app, /closeRankDialog\(true\)/);
  assert.match(app, /calcSearchEscapePlan\(query\) === "clear"/);
  assert.doesNotMatch(app, /search\.blur\(\)/);
  assert.match(app, /<h3>Start<\/h3>/);
  assert.match(app, /<h3>Sit<\/h3>/);
  assert.doesNotMatch(app, /<section class="sheet-column">\s*<h4>/);
  assert.match(css, /grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(css, /body\.league-loaded \.league-hero \{[^}]*clip:\s*rect\(0,\s*0,\s*0,\s*0\)/s);
});

test("ranks dialog focus runs after the card is painted", () => {
  const focused = [];
  const button = { focus() { focused.push("action"); } };
  const doc = {
    querySelector(selector) {
      if (selector === ".ranks-card[role='dialog']") {
        return { querySelector: () => button };
      }
      return null;
    },
  };
  let queued = null;
  const run = scheduleRankDialogFocus(doc, (fn) => {
    queued = fn;
  });
  assert.equal(focused.length, 0);
  assert.equal(queued, run);
  queued();
  assert.deepEqual(focused, ["action"]);

  const closed = [];
  scheduleRankDialogFocus({
    querySelector() {
      return null;
    },
  }, (fn) => fn()) ;
  assert.deepEqual(closed, []);

  const app = readDocs("app.js");
  assert.match(app, /scheduleRankDialogFocus\(document, \(run\) => \{\s*window\.requestAnimationFrame\(run\);/s);
});

test("the two reported contrast pairs clear 4.5:1", () => {
  const css = readDocs("styles.css");
  const product = readDocs("product.css");
  const rose = css.match(/\.mini-chip\.rose \{([^}]+)\}/)?.[1] || "";
  const roseBg = rose.match(/background:\s*(#[0-9a-fA-F]{6})/)?.[1];
  const roseFg = rose.match(/color:\s*(#[0-9a-fA-F]{6})/)?.[1];
  assert.equal(roseBg, "#3d1418");
  assert.equal(roseFg, "#ffd2cd");
  assert.ok(contrast(roseFg, roseBg) >= 4.5);

  const activeSmall = product.match(/\.mode-card\.active small \{[^}]*color:\s*(#[0-9a-fA-F]{6})/)?.[1]
    || product.match(/\.mode-card\.active span,\s*\.mode-card\.active small \{[^}]*color:\s*(#[0-9a-fA-F]{6})/s)?.[1];
  assert.equal(activeSmall, "#5c534c");
  assert.ok(contrast(activeSmall, "#f4f1ec") >= 4.5);

  const root = css.match(/:root \{([\s\S]*?)\n\}/)?.[1] || "";
  const onAccent = root.match(/--on-accent:\s*(#[0-9a-fA-F]{6})/)?.[1];
  const field = root.match(/--field:\s*(#[0-9a-fA-F]{6})/)?.[1];
  const label = css.match(/\.ticker-label \{([^}]+)\}/)?.[1] || "";
  assert.match(label, /color:\s*var\(--on-accent\)/);
  assert.equal(onAccent, "#141210");
  assert.equal(field, "#e85d4c");
  assert.ok(contrast(onAccent, field) >= 4.5);
});

test("ranks strip fits at tablet width and keeps its focus ring", () => {
  const css = readDocs("styles.css");
  const product = readDocs("product.css");
  const shelf = css.match(/\.ranks-shelf \{([^}]+)\}/)?.[1] || "";
  assert.match(shelf, /padding-top:\s*6px/);
  assert.match(shelf, /padding-inline:\s*6px/);
  assert.match(product, /@media \(min-width: 701px\) \{\s*\.ranks-shelf \{\s*overflow-x: clip;/);
  assert.match(product, /button\.ranks-shelf-item \{\s*flex: 1 1 0;/);
  assert.match(product, /\.rather-duel \{\s*width: 100%;\s*overflow-x: clip;/);
});
