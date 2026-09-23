import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createPageRenderQueue, isTextEntry } from "../docs/modules/page-render.js";

const appSource = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../docs/app.js"), "utf8");

function harness() {
  const frames = new Map();
  let nextId = 1;
  const calls = { renders: 0 };
  const flags = { typing: false };
  const queue = createPageRenderQueue({
    render: () => {
      calls.renders += 1;
      queue.settle();
    },
    isTyping: () => flags.typing,
    schedule: (run) => {
      const id = nextId;
      nextId += 1;
      frames.set(id, run);
      return id;
    },
    cancel: (id) => frames.delete(id),
  });
  const flush = () => {
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach((run) => run());
  };
  return { queue, calls, flags, flush, frames };
}

test("background asks in one frame collapse into one page render", () => {
  const { queue, calls, flush } = harness();
  queue.request();
  queue.request();
  queue.request();
  assert.equal(calls.renders, 0);
  flush();
  assert.equal(calls.renders, 1);
  flush();
  assert.equal(calls.renders, 1);
});

test("a render for another reason drops the queued one", () => {
  const { queue, calls, flush, frames } = harness();
  queue.request();
  queue.settle();
  assert.equal(frames.size, 0);
  flush();
  assert.equal(calls.renders, 0);
  assert.equal(queue.isPending(), false);
});

test("typing holds background renders until the field is left", () => {
  const { queue, calls, flush, flags } = harness();
  flags.typing = true;
  queue.request();
  flush();
  assert.equal(calls.renders, 0);
  assert.equal(queue.isPending(), true);
  queue.release();
  flush();
  assert.equal(calls.renders, 0, "still typing, so still held");
  flags.typing = false;
  queue.release();
  flush();
  assert.equal(calls.renders, 1);
  assert.equal(queue.isPending(), false);
});

test("a frame that fires mid-typing waits instead of rebuilding the field", () => {
  const { queue, calls, flush, flags } = harness();
  queue.request();
  flags.typing = true;
  flush();
  assert.equal(calls.renders, 0);
  flags.typing = false;
  queue.release();
  flush();
  assert.equal(calls.renders, 1);
});

test("only text fields count as typing", () => {
  assert.equal(isTextEntry({ tagName: "INPUT", type: "text" }), true);
  assert.equal(isTextEntry({ tagName: "INPUT", type: "search" }), true);
  assert.equal(isTextEntry({ tagName: "INPUT" }), true);
  assert.equal(isTextEntry({ tagName: "TEXTAREA" }), true);
  assert.equal(isTextEntry({ tagName: "INPUT", type: "checkbox" }), false);
  assert.equal(isTextEntry({ tagName: "SELECT" }), false);
  assert.equal(isTextEntry({ tagName: "BUTTON" }), false);
  assert.equal(isTextEntry({ tagName: "DIV", isContentEditable: true }), true);
  assert.equal(isTextEntry(null), false);
});

test("background loaders ask for a render; only user actions render on the spot", () => {
  const loaders = [
    "loadDraftSelectionIndex",
    "loadTrendingPlayers",
    "loadLeagueTransactions",
    "loadLeagueHistoryTransactions",
    "loadLeagueHistoryMatchups",
    "hydrateManagerSelector",
    "applyValuationBundle",
    "applyRemoteCrowdVotes",
  ];
  loaders.forEach((name) => {
    const start = appSource.indexOf(`function ${name}(`);
    assert.ok(start >= 0, `${name} missing`);
    const next = appSource.indexOf("\nfunction ", start + 10);
    const nextAsync = appSource.indexOf("\nasync function ", start + 10);
    const end = Math.min(...[next, nextAsync].filter((index) => index > start));
    const body = appSource.slice(start, end);
    assert.doesNotMatch(body, /renderActivePage\(\)/, `${name} re-renders the page synchronously`);
    assert.match(body, /requestActivePageRender\(\)/, `${name} never asks for a render`);
  });
  assert.match(appSource, /function renderActivePage\(\) \{\s*pageRenderQueue\.settle\(\);/);
  assert.match(appSource, /addEventListener\("focusout"[\s\S]{0,160}pageRenderQueue\.release\(\)/);
});
