import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { SAMPLE_LEAGUE_ID } from "../docs/modules/constants.js";
import { sampleRosterLabels } from "../docs/modules/sample-voice.js";
import { describeDraftItem } from "../docs/modules/trade-draft.js";
import { analyzeWindowCall } from "../docs/modules/window-call.js";
import {
  SAMPLE_BANNER_KEY,
  clearSampleBannerDismissal,
  focusAfterSampleBannerDismiss,
  sampleBannerDismissed,
  sampleConnectEntryVisible,
} from "../docs/modules/site.js";
import { siteMarkup } from "./site-markup.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const OLD_SAMPLE_LEAGUE_ID = ["1315165104", "303513600"].join("");

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".git") continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}

test("sample banner dismissal stays on this visit and leaves Find my leagues", () => {
  const memory = new Map([[SAMPLE_BANNER_KEY, "1"]]);
  const storage = {
    getItem(key) {
      return memory.has(key) ? memory.get(key) : null;
    },
    removeItem(key) {
      memory.delete(key);
    },
  };
  assert.equal(sampleBannerDismissed(false), false);
  assert.equal(storage.getItem(SAMPLE_BANNER_KEY), "1");
  assert.equal(clearSampleBannerDismissal(storage), true);
  assert.equal(storage.getItem(SAMPLE_BANNER_KEY), null);
  assert.equal(sampleConnectEntryVisible({ sampleOn: true, bannerDismissed: false }), false);
  assert.equal(sampleConnectEntryVisible({ sampleOn: true, bannerDismissed: true }), true);
  assert.equal(sampleConnectEntryVisible({ sampleOn: false, bannerDismissed: true }), false);
});

test("dismiss moves focus to the workspace, not the body", () => {
  const focused = [];
  const attrs = new Map();
  const workspace = {
    id: "workspace",
    getAttribute(name) {
      return attrs.has(name) ? attrs.get(name) : null;
    },
    setAttribute(name, value) {
      attrs.set(name, value);
    },
    focus(options) {
      focused.push({ id: "workspace", options });
    },
  };
  const body = { id: "body", focus() { focused.push({ id: "body" }); } };
  const doc = {
    body,
    getElementById(id) {
      if (id === "workspace") return workspace;
      if (id === "sleeper-username") return { id: "sleeper-username", focus() { focused.push({ id: "sleeper-username" }); } };
      return null;
    },
  };
  const target = focusAfterSampleBannerDismiss(doc);
  assert.equal(target, workspace);
  assert.deepEqual(focused.map((row) => row.id), ["workspace"]);
  assert.equal(focused[0].options.preventScroll, true);

  const usernameOnly = {
    body,
    getElementById(id) {
      if (id === "sleeper-username") return { id: "sleeper-username", getAttribute() { return null; }, focus() { focused.push({ id: "sleeper-username" }); } };
      return null;
    },
  };
  assert.equal(focusAfterSampleBannerDismiss(usernameOnly).id, "sleeper-username");
});

test("sample chrome keeps a real Find my leagues button after the banner", () => {
  const index = siteMarkup();
  const app = readFileSync(join(root, "docs/app.js"), "utf8");
  assert.match(index, /<main class="workspace" id="workspace" tabindex="-1">/);
  assert.match(index, /<button type="button" class="sample-find-btn" data-sample-find hidden>Find my leagues<\/button>/);
  assert.match(index, /<button type="button" id="sample-find-btn" class="sample-find-btn" data-sample-find data-action="find-my-leagues" hidden>Find my leagues<\/button>/);
  assert.match(index, /data-action="dismiss-sample-banner">Dismiss<\/button>/);
  assert.match(app, /sampleBannerOff = true/);
  assert.match(app, /clearSampleBannerDismissal\(\)/);
  assert.match(app, /focusAfterSampleBannerDismiss\(document\)/);
  assert.match(app, /openSampleConnect\(\)/);
  assert.doesNotMatch(app, /sessionStorage\.setItem\(\s*["']dynasty_ticker_sample_banner_off["']/);
  assert.doesNotMatch(app, /sessionStorage\.getItem\(\s*["']dynasty_ticker_sample_banner_off["']/);
});

const SAMPLE_COPY_BANNED = /pick I own|on your roster|Do not sell your aging stars/;

test("sample copy drops pick I own, on your roster, and do not sell your aging stars", () => {
  const voice = sampleRosterLabels({ viewingSample: true, ownerName: "Ada" });
  const anon = sampleRosterLabels({ viewingSample: true, ownerName: "" });
  const trailing = sampleRosterLabels({ viewingSample: true, ownerName: "chrisalberts" });
  const aging = {
    rosterId: "1",
    managerName: "Ada",
    rank: 1,
    totalTeams: 12,
    powerScore: 93,
    starterPercentile: 0.96,
    pickPercentile: 0.2,
    averageAge: 28.5,
    youthCount: 3,
    veteranCount: 9,
    firstRoundPickCount: 1,
    playoffPct: 84,
    titlePct: 26,
    winPct: 0.78,
    gamesPlayed: 8,
    remainingTeamGames: 6,
    currentWeek: 9,
    startWeek: 1,
    playoffStart: 15,
    playoffTeams: 6,
    weakestPosition: { position: "RB", percentile: 0.3, rankLabel: "8th / 12" },
  };
  const sampleCall = analyzeWindowCall({ ...aging, sampleVoice: voice });
  const ownCall = analyzeWindowCall({ ...aging });
  const player = describeDraftItem({ status: "already-yours" }, { kind: "player", voice });
  const pick = describeDraftItem({ status: "already-yours" }, { kind: "pick", voice: trailing });
  const sampleText = [
    voice.shopOption,
    voice.heatOnRoster,
    voice.searchEmpty,
    voice.draftAlreadyPlayer,
    `Do not sell ${voice.favor} aging stars for picks.`,
    anon.shopOption,
    anon.heatOnRoster,
    anon.searchEmpty,
    `Do not sell ${anon.favor} aging stars for picks.`,
    sampleCall.headline,
    sampleCall.summary,
    ...(sampleCall.moves || []),
    player,
    pick,
  ].join("\n");
  assert.doesNotMatch(sampleText, SAMPLE_COPY_BANNED);
  assert.match(sampleText, /Shop a player or pick Ada owns/);
  assert.match(sampleText, /is on Ada's roster/);
  assert.match(sampleText, /Do not sell Ada's aging stars for picks/);
  assert.match(pick, /chrisalberts' roster/);
  assert.doesNotMatch(pick, /chrisalberts's/);
  assert.equal(sampleRosterLabels({ viewingSample: false, ownerName: "Ada" }), null);
  assert.match(ownCall.moves.join("\n"), /Do not sell your aging stars for picks/);
  assert.match(describeDraftItem({ status: "already-yours" }, { kind: "player" }), /on your roster/);
  const app = readFileSync(join(root, "docs/app.js"), "utf8");
  assert.match(app, /voice\?\.shopOption \|\| "Shop a player or pick I own"/);
  assert.match(app, /sampleVoice\(\)\?\.heatOnRoster \|\| "is on your roster"/);
  assert.match(app, /sampleVoice\(\)\?\.searchEmpty/);
});

test("sample league id lives in one place and the old private league is gone", () => {
  assert.match(SAMPLE_LEAGUE_ID, /^\d{8,}$/);
  assert.notEqual(SAMPLE_LEAGUE_ID, OLD_SAMPLE_LEAGUE_ID);
  const textFiles = walk(root).filter((path) => /\.(js|mjs|py|html|css|md|json|toml|txt|yml|svg)$/.test(path));
  const oldHits = [];
  const definitions = [];
  for (const path of textFiles) {
    const text = readFileSync(path, "utf8");
    if (text.includes(OLD_SAMPLE_LEAGUE_ID)) oldHits.push(relative(root, path));
    if (/export const SAMPLE_LEAGUE_ID\s*=/.test(text)) definitions.push(relative(root, path));
  }
  assert.deepEqual(oldHits, []);
  assert.deepEqual(definitions, ["docs/modules/constants.js"]);
});
