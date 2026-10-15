import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  MOBILE_CHROME_NEAR_TOP,
  MOBILE_CHROME_SCROLL_DELTA,
  bindMobileChromeScroll,
  nextMobileChromeScroll,
} from "../docs/modules/mobile-chrome-scroll.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(name) {
  return readFileSync(join(root, name), "utf8");
}

function step(state, y, extra = {}) {
  return nextMobileChromeScroll({
    phone: true,
    previousY: state.y,
    hidden: state.hidden,
    y,
    ...extra,
  });
}

test("phone chrome hides after a scroll down and shows on scroll up", () => {
  let state = nextMobileChromeScroll({ phone: true, y: 0 });
  assert.equal(state.hidden, false);

  state = step(state, MOBILE_CHROME_NEAR_TOP);
  assert.equal(state.hidden, false, "stays shown near the top");

  state = step(state, MOBILE_CHROME_NEAR_TOP + MOBILE_CHROME_SCROLL_DELTA);
  assert.equal(state.hidden, true, "hides once the downward delta clears the threshold");

  state = step(state, state.y - (MOBILE_CHROME_SCROLL_DELTA - 2));
  assert.equal(state.hidden, true, "a smaller scroll up keeps it hidden");

  state = step(state, state.y - MOBILE_CHROME_SCROLL_DELTA);
  assert.equal(state.hidden, false, "scroll up past the threshold shows it");

  state = step(state, state.y + (MOBILE_CHROME_SCROLL_DELTA - 1));
  assert.equal(state.hidden, false, "a smaller scroll down keeps it shown");

  state = step(state, MOBILE_CHROME_NEAR_TOP);
  assert.equal(state.hidden, false, "near the top it is shown again");
});

test("reduced motion still hides and shows without a transition", () => {
  const down = nextMobileChromeScroll({
    phone: true,
    previousY: 0,
    y: 120,
    reducedMotion: true,
  });
  assert.equal(down.hidden, true);
  assert.equal(down.instant, true);
  const up = nextMobileChromeScroll({
    phone: true,
    previousY: down.y,
    hidden: down.hidden,
    y: down.y - 40,
    reducedMotion: true,
  });
  assert.equal(up.hidden, false);
  assert.equal(up.instant, true);
});

test("desktop scroll does not hide the phone bar", () => {
  const state = nextMobileChromeScroll({ phone: false, previousY: 0, y: 800 });
  assert.equal(state.hidden, false);
  assert.equal(state.instant, false);
});

function makeChrome() {
  const names = new Set();
  const attrs = new Map();
  return {
    classList: {
      toggle(name, force) {
        const on = force === undefined ? !names.has(name) : Boolean(force);
        if (on) names.add(name);
        else names.delete(name);
        return on;
      },
      contains(name) {
        return names.has(name);
      },
    },
    setAttribute(key, value) {
      attrs.set(key, value);
    },
    removeAttribute(key) {
      attrs.delete(key);
    },
    hasAttribute(key) {
      return attrs.has(key);
    },
    getBoundingClientRect() {
      return { height: 45 };
    },
  };
}

function makeWindow(scrollY = 0, { asyncFrame = false } = {}) {
  const listeners = [];
  let queued = null;
  const win = {
    scrollY,
    listeners,
    document: {
      documentElement: {
        style: {
          props: new Map(),
          setProperty(name, value) {
            this.props.set(name, value);
          },
        },
      },
    },
    addEventListener(type, fn, opts) {
      listeners.push({ type, fn, opts });
    },
    removeEventListener(type, fn) {
      const index = listeners.findIndex((entry) => entry.type === type && entry.fn === fn);
      if (index >= 0) listeners.splice(index, 1);
    },
    requestAnimationFrame(fn) {
      if (asyncFrame) {
        queued = fn;
        return 1;
      }
      fn();
      return 1;
    },
    cancelAnimationFrame() {
      queued = null;
    },
    flush() {
      const fn = queued;
      queued = null;
      fn?.();
    },
  };
  return win;
}

test("scroll listener is passive, uses one animation frame, and moves the bar", () => {
  const chrome = makeChrome();
  const win = makeWindow(0, { asyncFrame: true });
  const stop = bindMobileChromeScroll(win, {
    chrome,
    isPhone: () => true,
    prefersReducedMotion: () => false,
  });
  const scroll = win.listeners.find((entry) => entry.type === "scroll");
  assert.equal(scroll.opts.passive, true);
  assert.equal(chrome.classList.contains("is-away"), false);

  win.scrollY = 140;
  scroll.fn();
  scroll.fn();
  assert.equal(chrome.classList.contains("is-away"), false, "waits for the frame");
  win.flush();
  assert.equal(chrome.classList.contains("is-away"), true);
  assert.equal(chrome.hasAttribute("inert"), true);

  win.scrollY = 100;
  scroll.fn();
  win.flush();
  assert.equal(chrome.classList.contains("is-away"), false);
  assert.equal(chrome.hasAttribute("inert"), false);
  assert.equal(win.document.documentElement.style.props.get("--mobile-chrome-space"), "45px");
  stop();
  assert.equal(win.listeners.some((entry) => entry.type === "scroll"), false);
});

test("reduced motion path toggles the bar with no transition class", () => {
  const chrome = makeChrome();
  const win = makeWindow(0);
  bindMobileChromeScroll(win, {
    chrome,
    isPhone: () => true,
    prefersReducedMotion: () => true,
  });
  const scroll = win.listeners.find((entry) => entry.type === "scroll");
  win.scrollY = 160;
  scroll.fn();
  assert.equal(chrome.classList.contains("is-away"), true);
  assert.equal(chrome.classList.contains("is-instant"), true);
  win.scrollY = 80;
  scroll.fn();
  assert.equal(chrome.classList.contains("is-away"), false);
  assert.equal(chrome.classList.contains("is-instant"), true);
});

test("scroll reveal CSS keeps the phone bar fixed and the desk dock fixed", () => {
  const css = read("docs/styles.css");
  const app = read("docs/app.js");
  const source = read("docs/modules/mobile-chrome-scroll.js");
  assert.match(css, /\.site-dock\s*\{[^}]*position:\s*fixed/s);
  assert.match(css, /scroll-padding-top:\s*var\(--mobile-chrome-space/);
  assert.match(css, /\.mobile-chrome\.is-away\s*\{[^}]*transform:\s*translateY\(-100%\)/s);
  assert.match(css, /@media \(max-width:\s*700px\)[\s\S]*?\.site-dock,[\s\S]*?position:\s*static/);
  const reduceAt = css.indexOf("@media (prefers-reduced-motion: reduce)");
  assert.match(css.slice(reduceAt, reduceAt + 700), /\.mobile-chrome\s*\{[^}]*transition:\s*none/s);
  assert.match(app, /bindMobileChromeScroll\(window/);
  assert.doesNotMatch(source, /pushState|popstate|replaceState/);
  assert.match(source, /passive:\s*true/);
  assert.match(source, /requestAnimationFrame/);
  assert.doesNotMatch(css, /\.storage-notice/);
  assert.doesNotMatch(css, /#sticky-mobile-cta/);
});
