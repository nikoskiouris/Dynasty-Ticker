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
} from "../docs/modules/mock-drafts.js";

const docs = join(dirname(fileURLToPath(import.meta.url)), "../docs");
const bundled = parseMockDrafts(JSON.parse(readFileSync(join(docs, "data/nfl_mock_drafts.json"), "utf8")));

const sampleBoard = parseMockDrafts({
  season: 2027,
  completedNflDraftYear: 2026,
  mocks: [
    {
      short: "SI",
      date: "2026-09-07",
      picks: [
        { slot: 1, name: "Arch Manning", pos: "QB", school: "Texas" },
        { slot: 2, name: "Dante Moore", pos: "QB", school: "Oregon" },
        { slot: 4, name: "Jeremiah Smith", pos: "WR", school: "Ohio State" },
      ],
    },
    {
      short: "PFN",
      date: "2026-09-12",
      picks: [
        { slot: 1, name: "Dante Moore", pos: "QB", school: "Oregon" },
        { slot: 2, name: "Jeremiah Smith", pos: "WR", school: "Ohio State" },
        { slot: 4, name: "Jeremiah Smith", pos: "WR", school: "Ohio State" },
      ],
    },
  ],
});

test("bundled mocks are two complete 2027 first rounds", () => {
  assert.equal(bundled.season, 2027);
  assert.equal(bundled.mocks.length, 2);
  bundled.mocks.forEach((mock) => {
    assert.equal(mock.picks.length, 32);
    assert.equal(mock.picks[0].slot, 1);
    assert.equal(mock.picks[31].slot, 32);
  });
  const names = bundled.mocks.flatMap((mock) => mock.picks.map((pick) => pick.name));
  assert.ok(names.includes("Jeremiah Smith"));
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

test("mock overlay is next-year firsts only", () => {
  assert.equal(shouldAttachMock({ season: 2027, round: 1 }, sampleBoard), true);
  assert.equal(shouldAttachMock({ season: 2027, round: 2 }, sampleBoard), false);
  assert.equal(shouldAttachMock({ season: 2028, round: 1 }, sampleBoard), false);
  assert.equal(nextMockSeason(sampleBoard), 2027);
});

test("majority mock wins; split names both show and pick the newer source", () => {
  const first = mockProspectAtSlot(sampleBoard, 1);
  assert.equal(first.split, true);
  assert.equal(first.label, "Arch Manning / Dante Moore");
  assert.equal(first.name, "Dante Moore");

  const fourth = mockProspectAtSlot(sampleBoard, 4);
  assert.equal(fourth.split, false);
  assert.equal(fourth.label, "Jeremiah Smith");
});

test("hybrid label keeps pick, owner, place, and mock without a college price", () => {
  assert.equal(
    formatHybridFirstName({
      season: 2027,
      ownerName: "Niko",
      placeLabel: "4th",
      mockName: "Jeremiah Smith",
    }),
    "2027 1st from Niko · 4th (Jeremiah Smith)"
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

test("source line names the stored boards", () => {
  assert.match(formatMockSourceLine(sampleBoard), /SI \+ PFN/);
  assert.match(formatMockSourceLine(sampleBoard), /no trade value/i);
});
