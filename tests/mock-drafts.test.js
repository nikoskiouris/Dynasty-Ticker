import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseMockDrafts,
  nextMockSeason,
  shouldAttachMock,
  projectedDraftSlot,
  buildCurrentPlaceLookup,
  currentPlaceForOwner,
  mockProspectAtSlot,
  formatHybridFirstName,
  formatMockSourceLine,
  SKILL_POSITIONS,
} from "../docs/modules/mock-drafts.js";

const docs = join(dirname(fileURLToPath(import.meta.url)), "../docs");
const bundled = parseMockDrafts(JSON.parse(readFileSync(join(docs, "data/nfl_mock_drafts.json"), "utf8")));

const sampleBoard = parseMockDrafts({
  season: 2027,
  rounds: 2,
  completedNflDraftYear: 2026,
  mocks: [
    {
      short: "Dynasty Nerds",
      date: "2026-08-31",
      picks: [
        { round: 1, slot: 1, name: "Jeremiah Smith", pos: "WR", school: "Ohio State" },
        { round: 1, slot: 6, name: "Ahmad Hardy", pos: "RB", school: "Missouri" },
        { round: 2, slot: 1, name: "Justice Haynes", pos: "RB", school: "Georgia Tech" },
        { round: 2, slot: 4, name: "Trey’Dez Green", pos: "TE", school: "LSU" },
        { round: 3, slot: 1, name: "Should Skip", pos: "WR", school: "Nowhere" },
        { round: 1, slot: 13, name: "Pass Rusher", pos: "EDGE", school: "Texas" },
      ],
    },
  ],
});

test("bundled mock is the Dynasty Nerds 2027 SF 2-round skill board", () => {
  assert.equal(bundled.season, 2027);
  assert.equal(bundled.rounds, 2);
  assert.equal(bundled.mocks.length, 1);
  const mock = bundled.mocks[0];
  assert.equal(mock.source, "Dynasty Nerds");
  assert.match(mock.url, /dynastynerds\.com/);
  assert.equal(mock.picks.length, 24);
  assert.equal(mock.picks[0].round, 1);
  assert.equal(mock.picks[0].slot, 1);
  assert.equal(mock.picks[0].name, "Jeremiah Smith");
  assert.equal(mock.picks[12].round, 2);
  assert.equal(mock.picks[12].slot, 1);
  assert.equal(mock.picks[12].name, "Justice Haynes");
  mock.picks.forEach((pick) => {
    assert.ok(SKILL_POSITIONS.has(pick.pos), pick.pos);
    assert.ok(pick.round <= 2);
  });
});

test("last place maps to 1.01, first place maps to last first", () => {
  assert.equal(projectedDraftSlot(10, 10), 1);
  assert.equal(projectedDraftSlot(1, 10), 10);
  assert.equal(projectedDraftSlot(4, 10), 7);
  assert.equal(projectedDraftSlot(0, 10), null);
});

test("current place ranks by wins then points", () => {
  const lookup = buildCurrentPlaceLookup([
    { roster_id: 2, settings: { wins: 1, losses: 0, fpts: 100, fpts_decimal: 0 } },
    { roster_id: 8, settings: { wins: 0, losses: 1, fpts: 140, fpts_decimal: 50 } },
    { roster_id: 3, settings: { wins: 1, losses: 0, fpts: 120, fpts_decimal: 0 } },
  ]);
  assert.equal(currentPlaceForOwner(3, lookup).rank, 1);
  assert.equal(currentPlaceForOwner(2, lookup).rank, 2);
  assert.equal(currentPlaceForOwner(8, lookup).rank, 3);
  assert.equal(currentPlaceForOwner(8, lookup).label, "3rd");
});

test("mock overlay is next-year 1sts and 2nds only", () => {
  assert.equal(shouldAttachMock({ season: 2027, round: 1 }, sampleBoard), true);
  assert.equal(shouldAttachMock({ season: 2027, round: 2 }, sampleBoard), true);
  assert.equal(shouldAttachMock({ season: 2027, round: 3 }, sampleBoard), false);
  assert.equal(shouldAttachMock({ season: 2028, round: 1 }, sampleBoard), false);
  assert.equal(nextMockSeason(sampleBoard), 2027);
});

test("slot lookup is per round and skips defense", () => {
  assert.equal(mockProspectAtSlot(sampleBoard, 1, 1).label, "Jeremiah Smith");
  assert.equal(mockProspectAtSlot(sampleBoard, 1, 2).label, "Justice Haynes");
  assert.equal(mockProspectAtSlot(sampleBoard, 13, 1), null);
  assert.equal(mockProspectAtSlot(sampleBoard, 1, 3), null);
  assert.equal(mockProspectAtSlot(bundled, 4, 2).label, "Trey’Dez Green");
});

test("hybrid label keeps pick, owner, place, and mock without a college price", () => {
  assert.equal(
    formatHybridFirstName({
      season: 2027,
      round: 1,
      ownerName: "Niko",
      placeLabel: "4th",
      mockName: "Jeremiah Smith",
    }),
    "2027 1st from Niko · 4th (Jeremiah Smith)"
  );
  assert.equal(
    formatHybridFirstName({
      season: 2027,
      round: 2,
      ownerName: "Niko",
      placeLabel: "12th",
      mockName: "Justice Haynes",
    }),
    "2027 2nd from Niko · 12th (Justice Haynes)"
  );
  assert.equal(
    formatHybridFirstName({ season: 2027, ownerName: "Niko", placeLabel: "4th" }),
    "2027 1st from Niko · 4th"
  );
  assert.doesNotMatch(formatHybridFirstName({
    season: 2027,
    mockName: "Jeremiah Smith",
  }), /[0-9],[0-9]{3}|8,?400/);
});

test("source line names Dynasty Nerds and keeps 3rds as pick labels", () => {
  const line = formatMockSourceLine(sampleBoard);
  assert.match(line, /Dynasty Nerds/);
  assert.match(line, /1sts and 2nds/);
  assert.match(line, /3rds stay pick labels/i);
  assert.match(line, /no trade value/i);
  assert.doesNotMatch(line, /SI|PFN/);
});
