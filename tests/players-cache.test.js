import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PLAYERS_CACHE_TTL_MS } from "../docs/modules/constants.js";
import { playersCacheIsFresh } from "../docs/modules/state.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const NOW = 1_700_000_000_000;

test("player cache expires even when the NFL week has not changed", () => {
  const fresh = { players: { a: 1 }, savedAt: NOW - 1000, stateKey: "2026-2026-6" };
  assert.equal(playersCacheIsFresh(fresh, {
    now: NOW,
    ttlMs: PLAYERS_CACHE_TTL_MS,
    stateKey: "2026-2026-6",
    requireStateKey: true,
  }), true);
  const stale = { ...fresh, savedAt: NOW - PLAYERS_CACHE_TTL_MS };
  assert.equal(playersCacheIsFresh(stale, {
    now: NOW,
    ttlMs: PLAYERS_CACHE_TTL_MS,
    stateKey: "2026-2026-6",
    requireStateKey: true,
  }), false);
  assert.equal(playersCacheIsFresh(fresh, {
    now: NOW,
    ttlMs: PLAYERS_CACHE_TTL_MS,
    stateKey: "2026-2026-7",
    requireStateKey: true,
  }), false);
  assert.equal(playersCacheIsFresh(fresh, { now: NOW, ttlMs: PLAYERS_CACHE_TTL_MS }), true);
  const app = readFileSync(join(root, "docs/app.js"), "utf8");
  assert.match(app, /playersCacheIsFresh\(/);
});

test("standings rows are keyboard buttons and placeholder text is lighter", () => {
  const app = readFileSync(join(root, "docs/app.js"), "utf8");
  const css = readFileSync(join(root, "docs/styles.css"), "utf8");
  assert.match(app, /role="button" tabindex="0" data-action="set-lens-teams"/);
  assert.match(app, /missingFinalWeeks/);
  assert.match(css, /--rail-placeholder: #c4bbb4;/);
  assert.match(css, /opacity: 0\.72;/);
  assert.doesNotMatch(css, /--rail-placeholder: #8c827a;/);
});
