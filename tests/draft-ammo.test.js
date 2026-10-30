import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildOwnedPicksByRoster } from "../docs/modules/draft-picks.js";
import {
  buildCurrentPlaceLookup,
  currentPlaceForOwner,
  formatPickSlotLabel,
  projectedDraftSlot,
} from "../docs/modules/mock-drafts.js";
import { ordinal } from "../docs/modules/standings.js";
import {
  bucketForProjectedSlot,
  chooseLeadPick,
  getAssetValue,
} from "../docs/modules/values.js";
import { formatPickLabel, resolvePickProjection } from "../docs/modules/pick-projection.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const fixture = JSON.parse(readFileSync(join(root, "tests/fixtures/try-hard-or-die-hard.json"), "utf8"));
const snapshot = JSON.parse(readFileSync(join(root, "docs/data/player_values.json"), "utf8"));
const appSource = readFileSync(join(root, "docs/app.js"), "utf8");

function previousYearBucket(finishRank, totalTeams) {
  const tierSize = Math.max(1, Math.floor(totalTeams / 3));
  if (finishRank <= tierSize) return "late";
  if (finishRank > totalTeams - tierSize) return "early";
  return "mid";
}

function pricedPick(pick, placeLookup, values) {
  const place = currentPlaceForOwner(pick.original_owner, placeLookup);
  const projection = resolvePickProjection({
    season: pick.season,
    round: pick.round,
    leagueSeason: fixture.league.season,
    place,
  });
  const owner = fixture.users.find((user) => {
    const roster = fixture.rosters.find((row) => String(row.roster_id) === String(pick.original_owner));
    return roster && String(user.user_id) === String(roster.owner_id);
  });
  const ownerName = owner?.display_name || owner?.username || "";
  const bucket = projection.valueBucket;
  const name = formatPickLabel({
    season: pick.season,
    round: pick.round,
    bucket: projection.nameBucket,
    ownerName,
    rank: projection.rank,
    total: projection.total,
    slot: projection.slot,
    mockName: "Dante Moore",
  });
  const asset = {
    assetId: `pick:${pick.season}:r${pick.round}:${pick.original_owner}`,
    valueAssetId: `pick:${pick.season}:r${pick.round}:${bucket}`,
    valueBucket: bucket,
    name,
    assetType: "pick",
    raw: {
      season: pick.season,
      round: pick.round,
      original_owner: pick.original_owner,
      owner_id: pick.owner_id,
      ktcBucket: bucket,
      projectedDraftSlot: projection.slot,
    },
  };
  const value = getAssetValue(asset, values);
  return { asset, value, slot: projection.slot, bucket, place };
}

test("an earlier slot is worth at least as much as a later slot, and a 1st beats any 2nd", () => {
  for (const format of ["sf", "oneQb"]) {
    const values = snapshot[format];
    const years = [...new Set(
      Object.keys(values)
        .filter((key) => key.startsWith("pick:"))
        .map((key) => key.split(":")[1])
    )].sort();
    assert.ok(years.length >= 4);
    for (const year of years) {
      const teamCount = 12;
      let previous = null;
      for (let slot = 1; slot <= teamCount; slot += 1) {
        const bucket = bucketForProjectedSlot(slot, teamCount);
        const asset = {
          assetType: "pick",
          assetId: `pick:${year}:r1:${slot}`,
          valueAssetId: `pick:${year}:r1:${bucket}`,
          valueBucket: bucket,
          raw: { season: year, round: 1, ktcBucket: bucket, projectedDraftSlot: slot },
        };
        const value = getAssetValue(asset, values);
        if (previous != null) {
          assert.ok(previous >= value, `${format} ${year} slot ${slot - 1} ${previous} < slot ${slot} ${value}`);
        }
        previous = value;
        const second = getAssetValue({
          assetType: "pick",
          assetId: `pick:${year}:r2:${slot}`,
          valueAssetId: `pick:${year}:r2:any`,
          valueBucket: "any",
          raw: { season: year, round: 2, ktcBucket: "any", projectedDraftSlot: slot },
        }, values);
        assert.ok(value > second, `${format} ${year} 1st slot ${slot} ${value} is not above a 2nd ${second}`);
      }
    }
  }
});

test("Try Hard or Die Hard vault counts traded picks and leads with the richest slot", () => {
  const draftContext = { season: String(fixture.draft.season), status: fixture.draft.status };
  const owned = buildOwnedPicksByRoster(
    fixture.league,
    fixture.rosters,
    fixture.tradedPicks,
    [],
    draftContext,
  );
  const niko = owned.get(String(fixture.focus.roster_id));
  const firsts = niko.filter((pick) => Number(pick.round) === 1);
  const firsts2027 = firsts.filter((pick) => String(pick.season) === "2027");
  assert.equal(firsts2027.length, 4);
  assert.deepEqual(firsts2027.map((pick) => Number(pick.original_owner)).sort((a, b) => a - b), [4, 5, 6, 8]);
  assert.equal(firsts2027.some((pick) => Number(pick.owner_id) !== fixture.focus.roster_id), false);
  assert.equal(firsts.some((pick) => String(pick.season) === "2026"), false);
  assert.equal(firsts.some((pick) => String(pick.season) === "2028"), false);
  assert.equal(firsts.filter((pick) => String(pick.season) === "2029" && Number(pick.original_owner) === 3).length, 1);
  assert.equal(firsts.length, 5);
  assert.equal(owned.get("8").some((pick) => (
    String(pick.season) === "2027" && Number(pick.round) === 1 && Number(pick.original_owner) === 8
  )), false);

  const placeLookup = buildCurrentPlaceLookup(fixture.rosters);
  const values = snapshot.sf;
  const entries = niko.map((pick) => pricedPick(pick, placeLookup, values));
  const lead = chooseLeadPick(entries.filter((entry) => Number(entry.asset.raw.round) === 1));
  assert.equal(lead.raw.projectedDraftSlot, 4);
  assert.equal(formatPickSlotLabel(1, lead.raw.projectedDraftSlot), "1.04");
  assert.equal(lead.name, "2027 1st (1.04), projected to finish 9th of 12 from YianGhan");
  const own2029 = entries.find((entry) => String(entry.asset.raw.season) === "2029" && Number(entry.asset.raw.round) === 1);
  assert.equal(own2029.slot, null);
  assert.equal(own2029.bucket, "mid");
  assert.equal(own2029.asset.name, "2029 1st from NikoSkiouris");
  assert.equal(own2029.value, values["pick:2029:r1:mid"]);
  assert.ok(getAssetValue(lead, values) > own2029.value);
  assert.doesNotMatch(lead.name, /1\.11|1\.12|zim8box/);

  const bySlot = entries
    .filter((entry) => String(entry.asset.raw.season) === "2027" && Number(entry.asset.raw.round) === 1)
    .sort((a, b) => a.slot - b.slot);
  for (let index = 0; index < bySlot.length - 1; index += 1) {
    assert.ok(bySlot[index].value >= bySlot[index + 1].value);
  }
  const cheapestFirst = Math.min(...entries.filter((entry) => Number(entry.asset.raw.round) === 1).map((entry) => entry.value));
  const richestSecond = Math.max(...entries.filter((entry) => Number(entry.asset.raw.round) === 2).map((entry) => entry.value));
  assert.ok(cheapestFirst > richestSecond);

  const zim = bySlot.find((entry) => Number(entry.asset.raw.original_owner) === 8);
  const previous = fixture.previousSeason.standings.find((row) => row.roster_id === 8);
  const oldBucket = previousYearBucket(previous.rank, fixture.previousSeason.standings.length);
  assert.equal(oldBucket, "early");
  assert.equal(zim.slot, 12);
  assert.equal(zim.bucket, "late");
  assert.ok(zim.value < values[`pick:2027:r1:${oldBucket}`]);

  for (const entry of entries) {
    const vault = getAssetValue(entry.asset, values);
    const trade = getAssetValue(entry.asset, values);
    const ammo = getAssetValue(entry.asset, values);
    assert.equal(vault, entry.value);
    assert.equal(trade, vault);
    assert.equal(ammo, vault);
    assert.equal(vault, values[entry.asset.valueAssetId]);
  }
});

test("a 2nd-place 1.11 does not lead when week standings give someone an earlier slot", () => {
  const placeByRoster = { 5: 1, 8: 2, 1: 3, 4: 4, 2: 5, 3: 6, 7: 7, 9: 8, 10: 9, 6: 10, 11: 11, 12: 12 };
  const standings = Object.entries(placeByRoster).map(([rosterId, rank]) => ({
    rosterId,
    rank,
    wins: 12 - rank,
    losses: rank - 1,
    pf: 1000 - rank,
    pa: 700 + rank,
  }));
  const placeLookup = buildCurrentPlaceLookup(fixture.rosters, standings, new Map([
    ["8", { starterValue: 90000, benchValue: 40000 }],
    ["6", { starterValue: 1000, benchValue: 100 }],
  ]));
  const values = snapshot.sf;
  const draftContext = { season: String(fixture.draft.season), status: fixture.draft.status };
  const owned = buildOwnedPicksByRoster(fixture.league, fixture.rosters, fixture.tradedPicks, [], draftContext);
  const firsts = owned.get(String(fixture.focus.roster_id)).filter((pick) => (
    String(pick.season) === "2027" && Number(pick.round) === 1
  ));
  const entries = firsts.map((pick) => pricedPick(pick, placeLookup, values));
  const lead = chooseLeadPick(entries);
  const zim = entries.find((entry) => Number(entry.asset.raw.original_owner) === 8);
  const yian = entries.find((entry) => Number(entry.asset.raw.original_owner) === 6);
  assert.equal(zim.slot, 11);
  assert.equal(zim.bucket, "late");
  assert.equal(yian.slot, 3);
  assert.equal(yian.bucket, "early");
  assert.ok(yian.value > zim.value);
  assert.equal(lead.raw.original_owner, yian.asset.raw.original_owner);
  assert.doesNotMatch(lead.name, /1\.11|zim8box/);
  assert.equal(getAssetValue(lead, values), getAssetValue(yian.asset, values));
});

test("a next-year slot and its price bucket name the same rank", () => {
  for (const total of [10, 12, 14]) {
    for (let rank = 1; rank <= total; rank += 1) {
      const projection = resolvePickProjection({
        season: 2027,
        round: 1,
        leagueSeason: 2026,
        place: { rank, total },
      });
      const slot = projectedDraftSlot(rank, total);
      const bucket = bucketForProjectedSlot(slot, total);
      assert.equal(projection.slot, slot);
      assert.equal(projection.valueBucket, bucket);
      const label = formatPickLabel({
        season: 2027,
        round: 1,
        bucket: projection.nameBucket,
        ownerName: "Niko",
        rank: projection.rank,
        total: projection.total,
        slot: projection.slot,
      });
      const slotLabel = formatPickSlotLabel(1, slot);
      assert.equal(label, `2027 1st (${slotLabel}), projected to finish ${ordinal(rank)} of ${total} from Niko`);
      assert.doesNotMatch(label, /Early|Middle|Late|Previous Year/i);
    }
  }

  const placeLookup = buildCurrentPlaceLookup(fixture.rosters);
  const place = currentPlaceForOwner(fixture.focus.roster_id, placeLookup);
  const projection = resolvePickProjection({
    season: 2027,
    round: 1,
    leagueSeason: fixture.league.season,
    place,
  });
  const previous = fixture.previousSeason.standings.find((row) => row.roster_id === fixture.focus.roster_id);
  assert.equal(previous.rank, 10);
  assert.notEqual(place.rank, previous.rank);
  const label = formatPickLabel({
    season: 2027,
    round: 1,
    bucket: projection.nameBucket,
    ownerName: "NikoSkiouris",
    rank: projection.rank,
    total: projection.total,
    slot: projection.slot,
  });
  assert.equal(label, "2027 1st (1.06), projected to finish 7th of 12 from NikoSkiouris");
  assert.doesNotMatch(label, /10th|Previous Year|Early|Middle|Late/i);
  const second = formatPickLabel({
    season: 2027,
    round: 2,
    bucket: "any",
    ownerName: "NikoSkiouris",
    rank: projection.rank,
    total: projection.total,
    slot: projection.slot,
  });
  assert.equal(second, "2027 2nd (2.06), projected to finish 7th of 12 from NikoSkiouris");
  const later = resolvePickProjection({
    season: 2029,
    round: 1,
    leagueSeason: fixture.league.season,
    place,
  });
  assert.equal(later.slot, null);
  assert.equal(later.valueBucket, "mid");
  assert.equal(
    formatPickLabel({ season: 2029, round: 1, bucket: later.nameBucket, ownerName: "NikoSkiouris" }),
    "2029 1st from NikoSkiouris",
  );
});

test("Draft Ammo, the vault, and trade read one pick price", () => {
  assert.match(appSource, /leadFirst: chooseLeadPick\(/);
  assert.match(appSource, /draftAmmoInsight\(profile\.assetSummary\.firstRoundPickCount, profile\.assetSummary\.leadFirst\)/);
  assert.match(appSource, /resolvePickProjection\(/);
  assert.match(appSource, /function findOwnedPickAsset\(/);
  assert.match(appSource, /function refreshProjectedPickSlots\(/);
  assert.match(appSource, /projectPickSlots\(/);
  assert.match(appSource, /if \(!state\.pickProjectionReady\) return false/);
  const nameFn = appSource.slice(
    appSource.indexOf("function formatPickName("),
    appSource.indexOf("async function loadValues("),
  );
  assert.match(nameFn, /return formatPickLabel\(/);
  assert.doesNotMatch(nameFn, /finishLabel|Previous Year/);
  const render = appSource.slice(
    appSource.indexOf("function renderActivePage("),
    appSource.indexOf("function requestActivePageRender("),
  );
  assert.match(render, /refreshProjectedPickSlots\(\)/);
  const vault = appSource.slice(
    appSource.indexOf("function renderPickVaultRow("),
    appSource.indexOf("function renderAssetValuePlain("),
  );
  assert.match(vault, /renderAssetValuePlain\(asset, values\)/);
  const plain = appSource.slice(
    appSource.indexOf("function renderAssetValuePlain("),
    appSource.indexOf("function formatAssetSecondaryLabel("),
  );
  assert.match(plain, /getAssetValue\(asset, values\)/);
  const trade = appSource.slice(
    appSource.indexOf("function buildTransactionPickAsset("),
    appSource.indexOf("function buildWeeklyTradeTimeline("),
  );
  assert.match(trade, /findOwnedPickAsset\(/);
  assert.match(trade, /resolvePickProjection\(/);
  assert.doesNotMatch(trade, /valueAssetId: `pick:\$\{season\}:r\$\{round\}:any`/);
});
