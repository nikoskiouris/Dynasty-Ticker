import test from "node:test";
import assert from "node:assert/strict";
import { formatStatNumber, lookupNflDraftPick } from "../docs/modules/player-notes.js";

const picks = {
  "100": { year: 2025, round: 1, pick: 6, name: "Tetairoa McMillan" },
  "x1": { year: 2024, round: 2, pick: 40, name: "Ja'Lynn Polk" },
  "x2": { year: 2023, round: 3, pick: 70, name: "Chris Smith" },
  "x3": { year: 2024, round: 5, pick: 150, name: "Chris Smith" },
  "bad": { name: "No Round" },
};

test("draft lookup: by id, then by a unique normalized name; shared names stay unknown", () => {
  assert.deepEqual(lookupNflDraftPick("100", picks), { year: 2025, round: 1, pick: 6, name: "Tetairoa McMillan" });
  assert.equal(lookupNflDraftPick("999", picks, { full_name: "Ja’Lynn Polk" })?.pick, 40);
  assert.equal(lookupNflDraftPick("999", picks, { first_name: "JaLynn", last_name: "Polk" }), null);
  assert.equal(lookupNflDraftPick("999", picks, { full_name: "ja'lynn  POLK" })?.round, 2);
  assert.equal(lookupNflDraftPick("999", picks, { full_name: "Chris Smith" }), null, "two Chris Smiths: no guess");
  assert.equal(lookupNflDraftPick("999", picks, { full_name: "No Round" }), null);
  assert.equal(lookupNflDraftPick("999", {}, { full_name: "Anyone" }), null);
});

test("draft lookup stays fast across a full board", () => {
  const big = {};
  for (let i = 0; i < 3000; i += 1) big[`p${i}`] = { year: 2020 + (i % 6), round: 1 + (i % 7), pick: i, name: `Player Number ${i}` };
  const start = performance.now();
  for (let i = 0; i < 3000; i += 1) lookupNflDraftPick(`q${i}`, big, { full_name: `Player Number ${i}` });
  assert.ok(performance.now() - start < 500, "3,000 name lookups should not rescan the file each time");
});

test("stat numbers keep their format", () => {
  assert.equal(formatStatNumber(2549), "2,549");
  assert.equal(formatStatNumber(14.62), "14.6");
  assert.equal(formatStatNumber(7), "7");
  assert.equal(formatStatNumber("x"), "");
});
