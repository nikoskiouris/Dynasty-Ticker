import test from "node:test";
import assert from "node:assert/strict";
import {
  bindTicker,
  isTickerTap,
  tickerGestureIntent,
  tickerOffsetFromTime,
  tickerTimeFromOffset,
  wrapTickerOffset,
} from "../docs/modules/ticker-scrub.js";

function fakeClassList() {
  const names = new Set();
  return {
    add(...tokens) { tokens.forEach((token) => names.add(token)); },
    remove(...tokens) { tokens.forEach((token) => names.delete(token)); },
    toggle(token, force) {
      const on = force == null ? !names.has(token) : Boolean(force);
      if (on) names.add(token);
      else names.delete(token);
      return on;
    },
    contains(token) { return names.has(token); },
  };
}

function fakeTickerNode() {
  const listeners = new Map();
  return {
    classList: fakeClassList(),
    listeners,
    attrs: {},
    title: "",
    setAttribute(name, value) { this.attrs[name] = String(value); },
    getAttribute(name) { return this.attrs[name]; },
    addEventListener(type, fn) {
      const list = listeners.get(type) || [];
      list.push(fn);
      listeners.set(type, list);
    },
    removeEventListener(type, fn) {
      listeners.set(type, (listeners.get(type) || []).filter((item) => item !== fn));
    },
    querySelector() { return null; },
    emit(type, event) {
      (listeners.get(type) || []).forEach((fn) => fn(event));
    },
  };
}

test("ticker offsets wrap so drag can go backward or forward", () => {
  assert.equal(wrapTickerOffset(-10, 100), 90);
  assert.equal(wrapTickerOffset(110, 100), 10);
  assert.equal(tickerOffsetFromTime(500, 1000, 200), 100);
  assert.equal(tickerTimeFromOffset(50, 1000, 200), 250);
  assert.equal(isTickerTap(3), true);
  assert.equal(isTickerTap(20), false);
  assert.equal(tickerGestureIntent(2, 3), "pending");
  assert.equal(tickerGestureIntent(4, 30), "scroll");
  assert.equal(tickerGestureIntent(30, 4), "scrub");
});

test("ticker aria-pressed matches pause and clears when unbound", () => {
  const root = fakeTickerNode();
  const track = fakeTickerNode();
  const playing = bindTicker(root, track, { paused: false });
  assert.equal(root.getAttribute("aria-pressed"), "false");
  assert.equal(root.classList.contains("is-paused"), false);
  root.emit("pointerdown", { pointerType: "touch", clientX: 0, clientY: 0 });
  root.emit("pointerup", {});
  assert.equal(playing.paused, true);
  assert.equal(root.getAttribute("aria-pressed"), "true");
  assert.equal(root.classList.contains("is-paused"), true);
  playing.destroy();
  assert.equal(root.getAttribute("aria-pressed"), "false");
  assert.equal(root.classList.contains("is-paused"), false);

  const again = fakeTickerNode();
  const paused = bindTicker(again, fakeTickerNode(), { paused: true });
  assert.equal(again.getAttribute("aria-pressed"), "true");
  paused.destroy();
  assert.equal(again.getAttribute("aria-pressed"), "false");
});
