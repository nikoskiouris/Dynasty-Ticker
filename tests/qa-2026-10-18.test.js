import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isGenericPickAssetId, listValueCalcAssets, pastPickSeasonHint } from "../docs/modules/value-calc.js";
import { badgeMeaning, GLOSSARY } from "../docs/modules/info-tip.js";
import { describeUserSearchFailure } from "../docs/modules/league-search.js";
import { verdictCopyFor } from "../docs/modules/verdict-copy.js";

const values = JSON.parse(readFileSync(new URL("../docs/data/player_values.json", import.meta.url), "utf8"));
const names = (q) => listValueCalcAssets(values.sf, values.names, { query: q, limit: 10 }).map((row) => row.name);

test("pick search finds every tradeable round 1-5 without a league", () => {
  assert.ok(names("2027 early 1st").includes("2027 Early 1st"));
  assert.equal(names("2027 1st").length, 3);
  for (const round of ["2nd", "3rd", "4th", "5th"]) assert.equal(names(`2027 ${round}`).length, 1, round);
  assert.deepEqual(names("🔥🔥"), []);
});

test("already-drafted hint only when that season has no values", () => {
  assert.match(pastPickSeasonHint("2026 early 1st", 2027, values.sf), /already drafted/);
  assert.equal(pastPickSeasonHint("2026 early 1st", 2027, { "pick:2026:r1:early": 100 }), "");
  assert.equal(pastPickSeasonHint("2027 1st", 2027, values.sf), "");
});

test("whole-round picks are generic; league picks are not", () => {
  assert.equal(isGenericPickAssetId("pick:2027:r2:any"), true);
  assert.equal(isGenericPickAssetId("pick:2027:r1:5"), false);
});

test("jargon has plain words", () => {
  for (const key of ["PPR", "Superflex", "1QB", "Stars", "Pick slot", "Pick Hoarder", "Lopsided"]) assert.ok(GLOSSARY[key], key);
  assert.match(badgeMeaning("RB Edge"), /strongest/);
  assert.match(badgeMeaning("Pick Hoarder"), /1st-round/);
});

test("a long username is echoed short", () => {
  const err = new Error(`We can't find "x" on Sleeper. Check the spelling.`);
  const { message } = describeUserSearchFailure(err, "x".repeat(500));
  assert.ok(message.length < 90, message);
});

test("the favors tier names its side", () => {
  assert.match(verdictCopyFor(10000, 12000).label, /^Favors Get side$/);
  assert.match(verdictCopyFor(12000, 10000).label, /^Favors Give side$/);
});
