import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildOwnedPicksByRoster } from "../docs/modules/draft-picks.js";
import { buildCurrentPlaceLookup, currentPlaceForOwner, projectedDraftSlot } from "../docs/modules/mock-drafts.js";
import {
  collectProjectedLeads,
  compareTradeSearchPicks,
  formatPickLabel,
  projectPickSlots,
} from "../docs/modules/pick-projection.js";
import { bucketForProjectedSlot, chooseLeadPick, getAssetValue } from "../docs/modules/values.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const fixture = JSON.parse(readFileSync(join(root, "tests/fixtures/try-hard-or-die-hard.json"), "utf8"));
const snapshot = JSON.parse(readFileSync(join(root, "docs/data/player_values.json"), "utf8"));

function rowsFromRanks(rankByRoster) {
  return Object.entries(rankByRoster).map(([rosterId, rank]) => ({
    rosterId,
    rank,
    wins: 20 - rank,
    losses: rank,
    ties: 0,
    pf: 2000 - rank,
    pa: 800,
  }));
}

function nikoFirsts() {
  const draftContext = { season: String(fixture.draft.season), status: fixture.draft.status };
  const owned = buildOwnedPicksByRoster(fixture.league, fixture.rosters, fixture.tradedPicks, [], draftContext);
  return owned.get(String(fixture.focus.roster_id)).filter((pick) => (
    String(pick.season) === "2027" && Number(pick.round) === 1
  ));
}

function leadSlotFor(rows) {
  const lookup = buildCurrentPlaceLookup(fixture.rosters, rows);
  const values = snapshot.sf;
  const entries = nikoFirsts().map((pick) => {
    const place = currentPlaceForOwner(pick.original_owner, lookup);
    const slot = projectedDraftSlot(place?.rank, place?.total);
    const bucket = bucketForProjectedSlot(slot, place?.total);
    const asset = {
      assetType: "pick",
      name: `slot ${slot}`,
      valueAssetId: `pick:2027:r1:${bucket}`,
      valueBucket: bucket,
      raw: { season: "2027", round: 1, projectedDraftSlot: slot, original_owner: pick.original_owner },
    };
    return { asset, value: getAssetValue(asset, values) };
  });
  return chooseLeadPick(entries)?.raw?.projectedDraftSlot;
}

test("partial week tables publish no lead, then one final slot", () => {
  const league = fixture.league;
  const rosters = fixture.rosters;
  const finalRanks = { 8: 1, 4: 2, 5: 3, 1: 4, 2: 5, 11: 6, 3: 7, 12: 8, 6: 9, 7: 10, 9: 11, 10: 12 };
  const partialEarly = { 8: 1, 4: 2, 5: 3, 1: 4, 2: 5, 11: 6, 3: 7, 12: 8, 7: 9, 6: 10, 9: 11, 10: 12 };
  const partialMid = { 1: 1, 2: 2, 11: 3, 8: 4, 4: 5, 6: 6, 5: 7, 3: 8, 12: 9, 7: 10, 9: 11, 10: 12 };
  const finalRows = rowsFromRanks(finalRanks);
  const partialRowsA = rowsFromRanks(partialEarly);
  const partialRowsB = rowsFromRanks(partialMid);

  assert.equal(leadSlotFor(finalRows), 4);
  assert.notEqual(leadSlotFor(partialRowsA), 4);
  assert.notEqual(leadSlotFor(partialRowsB), 4);
  assert.equal(projectPickSlots(league, { settled: false, rosters, rows: partialRowsA }), null);
  assert.equal(projectPickSlots(league, { settled: false, rosters, rows: partialRowsB }), null);
  assert.equal(projectPickSlots(league, { settled: false, rosters, rows: finalRows }), null);

  const leads = collectProjectedLeads(league, [
    { settled: false, rosters, rows: partialRowsA },
    { settled: false, rosters, rows: partialRowsB },
    { settled: true, rosters, rows: finalRows },
  ], (slots) => slots.get("6")?.slot);
  assert.deepEqual(leads, [4]);
  assert.equal(projectPickSlots(league, { settled: true, rosters, rows: finalRows }).get("6").slot, 4);
});

test("every round uses one projected label, with the slot and the finish", () => {
  const early = {
    season: 2029,
    bucket: "early",
    ownerName: "skolnickavery",
    rank: 12,
    total: 12,
    slot: 1,
  };
  assert.equal(
    formatPickLabel({ ...early, round: 1 }),
    "2029 Early 1st (1.01), projected to finish 12th of 12 from skolnickavery",
  );
  assert.equal(
    formatPickLabel({ ...early, round: 2 }),
    "2029 Early 2nd (2.01), projected to finish 12th of 12 from skolnickavery",
  );
  assert.equal(
    formatPickLabel({ ...early, round: 3, bucket: "late", rank: 1, slot: 12 }),
    "2029 Late 3rd (3.12), projected to finish 1st of 12 from skolnickavery",
  );
  assert.equal(
    formatPickLabel({
      season: 2027,
      round: 1,
      ownerName: "YianGhan",
      placeLabel: "9th",
      mockName: "Dante Moore",
      slot: 4,
      rank: 9,
      total: 12,
    }),
    "2027 1st from YianGhan · 9th place (1.04 Dante Moore)",
  );
});

test("trade search orders picks by value, then by slot", () => {
  const rows = [
    { assetType: "pick", name: "7ikGuild", value: 4701, slot: 3, round: 1 },
    { assetType: "pick", name: "benk2023", value: 4701, slot: 2, round: 1 },
    { assetType: "pick", name: "skolnickavery", value: 4701, slot: 1, round: 1 },
    { assetType: "pick", name: "YianGhan", value: 4701, slot: 4, round: 1 },
    { assetType: "pick", name: "NikoSkiouris", value: 3706, slot: 6, round: 1 },
  ];
  const sorted = rows.slice().sort(compareTradeSearchPicks);
  assert.deepEqual(sorted.map((row) => row.slot), [1, 2, 3, 4, 6]);
  assert.deepEqual(sorted.map((row) => row.name), [
    "skolnickavery",
    "benk2023",
    "7ikGuild",
    "YianGhan",
    "NikoSkiouris",
  ]);
});

test("Previous Year is gone from the app and the pick modules", () => {
  const files = [];
  const skip = new Set(["node_modules", ".git", "tests"]);
  function walk(dir) {
    for (const name of readdirSync(dir)) {
      if (skip.has(name)) continue;
      const path = join(dir, name);
      const stat = statSync(path);
      if (stat.isDirectory()) walk(path);
      else if (/\.(js|mjs|py|html|css|md)$/.test(name)) files.push(path);
    }
  }
  walk(join(root, "docs"));
  walk(join(root, "src"));
  const hits = [];
  for (const path of files) {
    const text = readFileSync(path, "utf8");
    if (/Previous Year/i.test(text)) hits.push(path.slice(root.length + 1));
  }
  assert.deepEqual(hits, []);
  const second = formatPickLabel({
    season: 2028,
    round: 2,
    bucket: "mid",
    ownerName: "Niko",
    rank: 6,
    total: 12,
    slot: 7,
  });
  assert.match(second, /2028 Middle 2nd \(2\.07\), projected to finish 6th of 12 from Niko/);
  assert.doesNotMatch(second, /Previous Year/i);
});
