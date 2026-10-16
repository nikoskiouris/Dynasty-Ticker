import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildOwnedPicksByRoster } from "../docs/modules/draft-picks.js";
import { buildCurrentPlaceLookup, currentPlaceForOwner, projectedDraftSlot, rosterPointsFor } from "../docs/modules/mock-drafts.js";
import { renderSleeperInsight } from "../docs/modules/roster-markup.js";
import { buildSeasonModel } from "../docs/modules/season.js";
import {
  collectProjectedLeads,
  compareTradeSearchPicks,
  formatPickLabel,
  projectPickSlots,
  resolvePickProjection,
  rosterRecordsReady,
  valuedAsMidFirstHint,
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

test("the next draft year uses one plain sentence, and a mock name does not change it", () => {
  assert.equal(
    formatPickLabel({
      season: 2027,
      round: 1,
      bucket: "any",
      ownerName: "YianGhan",
      mockName: "Dante Moore",
      placeLabel: "9th",
      slot: 4,
      rank: 9,
      total: 12,
    }),
    "2027 1st (1.04), projected to finish 9th of 12 from YianGhan",
  );
  assert.equal(
    formatPickLabel({
      season: 2027,
      round: 2,
      ownerName: "YianGhan",
      slot: 4,
      rank: 9,
      total: 12,
    }),
    "2027 2nd (2.04), projected to finish 9th of 12 from YianGhan",
  );
  assert.equal(
    formatPickLabel({ season: 2028, round: 1, ownerName: "YianGhan" }),
    "2028 1st from YianGhan",
  );
  assert.doesNotMatch(
    formatPickLabel({ season: 2028, round: 1, ownerName: "YianGhan", mockName: "Dante Moore" }),
    /Dante|projected|1\.\d\d|place/,
  );
});

test("only the next draft year gets a projected slot; later years are the mid price", () => {
  const next = resolvePickProjection({
    season: 2027,
    round: 1,
    leagueSeason: 2026,
    place: { rank: 9, total: 12 },
  });
  assert.equal(next.project, true);
  assert.equal(next.slot, 4);
  assert.equal(next.valueBucket, "early");
  assert.equal(next.nameBucket, "any");
  assert.equal(
    formatPickLabel({
      season: 2027,
      round: 1,
      bucket: next.nameBucket,
      ownerName: "YianGhan",
      rank: next.rank,
      total: next.total,
      slot: next.slot,
    }),
    "2027 1st (1.04), projected to finish 9th of 12 from YianGhan",
  );

  const later = resolvePickProjection({
    season: 2028,
    round: 1,
    leagueSeason: 2026,
    place: { rank: 12, total: 12 },
  });
  assert.equal(later.project, false);
  assert.equal(later.slot, null);
  assert.equal(later.rank, null);
  assert.equal(later.valueBucket, "mid");
  assert.equal(
    formatPickLabel({
      season: 2028,
      round: 1,
      bucket: later.nameBucket,
      ownerName: "skolnickavery",
    }),
    "2028 1st from skolnickavery",
  );
  const laterSecond = resolvePickProjection({
    season: 2029,
    round: 2,
    leagueSeason: 2026,
    place: { rank: 12, total: 12 },
  });
  assert.equal(laterSecond.valueBucket, "any");
  assert.equal(laterSecond.slot, null);

  const values = snapshot.sf;
  const early = values["pick:2027:r1:early"];
  const mid = values["pick:2028:r1:mid"];
  const late = values["pick:2027:r1:late"];
  assert.ok(early > mid);
  const assets = [
    {
      asset: {
        assetType: "pick",
        name: "2028 1st from Niko",
        valueAssetId: "pick:2028:r1:mid",
        raw: { season: "2028", round: 1, projectedDraftSlot: null },
      },
      value: mid,
    },
    {
      asset: {
        assetType: "pick",
        name: "2027 1st (1.04), projected to finish 9th of 12 from YianGhan",
        valueAssetId: "pick:2027:r1:early",
        raw: { season: "2027", round: 1, projectedDraftSlot: 4 },
      },
      value: early,
    },
    {
      asset: {
        assetType: "pick",
        name: "2027 1st (1.12), projected to finish 1st of 12 from zim8box",
        valueAssetId: "pick:2027:r1:late",
        raw: { season: "2027", round: 1, projectedDraftSlot: 12 },
      },
      value: late,
    },
  ];
  const lead = chooseLeadPick(assets);
  assert.equal(lead.name, "2027 1st (1.04), projected to finish 9th of 12 from YianGhan");
  const rows = assets.map((entry) => ({
    value: entry.value,
    slot: entry.asset.raw.projectedDraftSlot,
    round: entry.asset.raw.round,
    name: entry.asset.name,
  }));
  const sorted = rows.slice().sort(compareTradeSearchPicks);
  assert.deepEqual(sorted.map((row) => row.value), [early, mid, late].sort((a, b) => b - a));
  assert.equal(sorted[0].slot, 4);
  assert.equal(getAssetValue(lead, values), early);
  assert.equal(getAssetValue(assets[0].asset, values), mid);
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

function slotTable(slots) {
  return [...slots.values()]
    .map((row) => ({ id: row.rosterId, rank: row.rank, slot: row.slot, bucket: row.bucket }))
    .sort((a, b) => Number(a.id) - Number(b.id));
}

// Five games each. Pair whoever still has a game, then give the win to the
// roster that still needs it. Points stay on the winner's side of the margin.
function weeksFromRosterRecords(rosters) {
  const records = rosters.map((roster) => ({
    id: String(roster.roster_id),
    wins: Number(roster.settings.wins) || 0,
    losses: Number(roster.settings.losses) || 0,
    pf: rosterPointsFor(roster),
  }));
  const games = records[0].wins + records[0].losses;
  const remW = new Map(records.map((row) => [row.id, row.wins]));
  const remG = new Map(records.map((row) => [row.id, games]));
  const seen = new Map(records.map((row) => [row.id, new Set()]));
  const played = [];
  const ids = records.map((row) => row.id);
  for (let week = 1; week <= games; week += 1) {
    const pool = ids.filter((id) => remG.get(id) > 0);
    const pairs = [];
    while (pool.length) {
      pool.sort((a, b) => (remW.get(b) / remG.get(b)) - (remW.get(a) / remG.get(a)));
      const left = pool.shift();
      let best = 0;
      let bestScore = -1e9;
      for (let i = 0; i < pool.length; i += 1) {
        const right = pool[i];
        if (seen.get(left).has(right)) continue;
        const leftMust = remW.get(left) >= remG.get(left);
        const rightMust = remW.get(right) >= remG.get(right);
        const leftNone = remW.get(left) === 0;
        const rightNone = remW.get(right) === 0;
        let score = 10;
        if ((leftMust && rightNone) || (rightMust && leftNone)) score = 100;
        else if (leftMust !== rightMust) score = 80;
        else if (leftNone !== rightNone) score = 70;
        score -= Math.abs(remW.get(left) - remW.get(right));
        if (score > bestScore) {
          bestScore = score;
          best = i;
        }
      }
      const right = pool.splice(best, 1)[0];
      pairs.push([left, right]);
    }
    pairs.forEach(([left, right]) => {
      const leftMust = remW.get(left) >= remG.get(left) && remW.get(left) > 0;
      const rightMust = remW.get(right) >= remG.get(right) && remW.get(right) > 0;
      const leftCan = remW.get(left) > 0;
      const rightCan = remW.get(right) > 0;
      let winner = left;
      if (rightMust && !leftMust) winner = right;
      else if (leftMust && !rightMust) winner = left;
      else if (rightCan && !leftCan) winner = right;
      else if (!leftCan && !rightCan) winner = left;
      else if (remW.get(right) > remW.get(left)) winner = right;
      played.push({ week, left, right, winner });
      remW.set(winner, remW.get(winner) - 1);
      remG.set(left, remG.get(left) - 1);
      remG.set(right, remG.get(right) - 1);
      seen.get(left).add(right);
      seen.get(right).add(left);
    });
  }
  if ([...remW.values()].some((wins) => wins !== 0)) {
    throw new Error("roster win totals could not be scheduled");
  }

  const pf = new Map(records.map((row) => [row.id, row.pf]));
  const byTeam = new Map(ids.map((id) => [id, []]));
  played.forEach((game, index) => {
    byTeam.get(game.left).push(index);
    byTeam.get(game.right).push(index);
  });
  const points = played.map((game) => ({ [game.left]: 0, [game.right]: 0 }));
  ids.forEach((id) => {
    const share = pf.get(id) / byTeam.get(id).length;
    byTeam.get(id).forEach((index) => {
      points[index][id] = share;
    });
  });
  const margin = 0.02;
  for (let iter = 0; iter < 200; iter += 1) {
    let fixes = 0;
    played.forEach((game, index) => {
      const loser = game.winner === game.left ? game.right : game.left;
      if (points[index][game.winner] > points[index][loser]) return;
      const need = (points[index][loser] + margin) - points[index][game.winner];
      points[index][game.winner] += need;
      let left = need;
      byTeam.get(game.winner).forEach((other) => {
        if (other === index || left <= 1e-9) return;
        const opp = played[other].left === game.winner ? played[other].right : played[other].left;
        const floor = played[other].winner === game.winner ? points[other][opp] + margin : 0;
        const take = Math.min(Math.max(0, points[other][game.winner] - floor), left);
        points[other][game.winner] -= take;
        left -= take;
      });
      fixes += 1;
    });
    if (!fixes) break;
  }
  const totals = new Map(ids.map((id) => [id, 0]));
  points.forEach((row) => {
    Object.entries(row).forEach(([id, value]) => totals.set(id, totals.get(id) + value));
  });
  ids.forEach((id) => {
    const delta = pf.get(id) - totals.get(id);
    if (Math.abs(delta) < 0.001) return;
    const owned = byTeam.get(id);
    if (delta > 0) {
      const win = owned.find((index) => played[index].winner === id) ?? owned[0];
      points[win][id] += delta;
      return;
    }
    let left = -delta;
    owned.forEach((index) => {
      const opp = played[index].left === id ? played[index].right : played[index].left;
      const floor = played[index].winner === id ? points[index][opp] + margin : 0;
      const take = Math.min(Math.max(0, points[index][id] - floor), left);
      points[index][id] -= take;
      left -= take;
    });
  });

  const weekRows = new Map();
  played.forEach((game, index) => {
    if (!weekRows.has(game.week)) weekRows.set(game.week, []);
    const matchupId = weekRows.get(game.week).length / 2 + 1;
    weekRows.get(game.week).push(
      { roster_id: Number(game.left), matchup_id: matchupId, points: points[index][game.left] },
      { roster_id: Number(game.right), matchup_id: matchupId, points: points[index][game.right] },
    );
  });
  return weekRows;
}

test("roster settings and the full week table agree on the fixture", () => {
  const rosters = fixture.rosters;
  assert.equal(rosterRecordsReady(rosters), true);
  assert.equal(rosterRecordsReady(rosters.map((roster) => ({ ...roster, settings: { wins: 0, losses: 0, fpts: 0 } }))), false);
  assert.equal(rosterRecordsReady([{ roster_id: 1, settings: { wins: 1, losses: 0 } }]), false);

  const fast = projectPickSlots(fixture.league, { settled: true, rosters, rows: [] });
  const games = (Number(rosters[0].settings.wins) || 0) + (Number(rosters[0].settings.losses) || 0);
  const league = {
    ...fixture.league,
    settings: {
      ...fixture.league.settings,
      playoff_week_start: 15,
      last_scored_leg: games,
      leg: games + 1,
    },
  };
  const model = buildSeasonModel({
    league,
    rosters,
    users: fixture.users,
    weekRows: weeksFromRosterRecords(rosters),
    nflState: { week: games + 1, season: league.season, league_season: league.season, season_type: "regular" },
  });
  assert.equal(model.hasComputedGames, true);
  const full = projectPickSlots(league, { settled: true, rosters, rows: model.standings });
  assert.deepEqual(slotTable(fast), slotTable(full));
  assert.equal(fast.get("6").slot, 4);
  assert.equal(full.get("6").slot, 4);
});

test("Draft Ammo calculating line is busy and has no lead", () => {
  const busy = renderSleeperInsight({
    title: "Draft Ammo",
    body: "Calculating…",
    tone: "gold",
    busy: true,
  });
  assert.match(busy, /aria-busy="true"/);
  assert.match(busy, /Calculating…/);
  assert.match(busy, /insight-item/);
  assert.doesNotMatch(busy, /led by|1\.\d\d|Cam Coleman|Ahmad Hardy|vault/);
  const ready = renderSleeperInsight({
    title: "Draft Ammo",
    body: "5 first-round picks in the vault, led by 2027 1st (1.04), projected to finish 9th of 12 from YianGhan.",
    tone: "gold",
  });
  assert.doesNotMatch(ready, /aria-busy/);
  assert.match(ready, /led by 2027 1st \(1\.04\), projected to finish 9th of 12 from YianGhan/);

  const appSource = readFileSync(join(root, "docs/app.js"), "utf8");
  const ammoFn = appSource.slice(
    appSource.indexOf("function draftAmmoInsight("),
    appSource.indexOf("function draftAmmoInsightForRoster("),
  );
  assert.match(ammoFn, /body: "Calculating…"/);
  assert.match(ammoFn, /busy: true/);
  assert.match(ammoFn, /leadReady/);
  const calculating = ammoFn.slice(ammoFn.indexOf("if (!leadReady)"), ammoFn.indexOf("const count"));
  assert.doesNotMatch(calculating, /led by|1\\\.\\d\\d|Cam Coleman|Ahmad Hardy/);
  const dashboard = appSource.slice(
    appSource.indexOf("function renderPowerDashboard("),
    appSource.indexOf("function getSeasonModel("),
  );
  assert.match(dashboard, /draftAmmoInsightForRoster\(meRoster\)/);
  assert.match(dashboard, /rosterGradeReady\(meRoster\)/);
  assert.doesNotMatch(dashboard, /Syncing player metadata/);
  assert.doesNotMatch(dashboard, /if \(!state\.playerMetadataLoaded\)/);
  const css = readFileSync(join(root, "docs/styles.css"), "utf8");
  assert.match(css, /\.insight-item\[aria-busy="true"\] span \{\s*animation: pulse 1\.6s ease-in-out infinite;/);
});

test("named 2028+ firsts say they are valued as a mid 1st", () => {
  const named = {
    assetType: "pick",
    assetId: "pick:2029:r1:3",
    raw: { season: "2029", round: 1, original_owner: 3 },
  };
  assert.equal(valuedAsMidFirstHint(named, "2026"), "valued as a mid 1st");
  assert.equal(valuedAsMidFirstHint({
    assetType: "pick",
    assetId: "pick:2027:r1:6",
    raw: { season: "2027", round: 1, original_owner: 6 },
  }, "2026"), "");
  assert.equal(valuedAsMidFirstHint({
    assetType: "pick",
    assetId: "pick:2028:r1:mid",
    name: "2028 Mid 1st",
    raw: { season: "2028", round: 1 },
  }, "2026"), "");
  assert.equal(valuedAsMidFirstHint({
    assetType: "pick",
    assetId: "pick:2028:r2:4",
    raw: { season: "2028", round: 2, original_owner: 4 },
  }, "2026"), "");
  const markup = renderSleeperInsight({
    title: "Draft Ammo",
    body: "1 first-round pick in the vault, led by 2029 1st from NikoSkiouris (valued as a mid 1st).",
    tone: "gold",
  });
  assert.doesNotMatch(markup, /pick-value-hint/);
  assert.match(markup, /led by 2029 1st from NikoSkiouris \(valued as a mid 1st\)\./);
  const appSource = readFileSync(join(root, "docs/app.js"), "utf8");
  const ammoFn = appSource.slice(
    appSource.indexOf("function draftAmmoInsight("),
    appSource.indexOf("function draftAmmoInsightForRoster("),
  );
  assert.match(ammoFn, /inlineMidFirstHint\(laterFirstHint\(lead, roster\)\)/);
  assert.match(ammoFn, /led by \$\{lead\.name\}\$\{hint\}/);
  assert.doesNotMatch(ammoFn, /hint: laterFirstHint/);
  const cards = appSource.slice(
    appSource.indexOf("function buildSleeperInsightCards("),
    appSource.indexOf("function describeLeagueFormat("),
  );
  assert.match(cards, /inlineMidFirstHint\(laterFirstHint\(profile\.assetSummary\.leadFirst/);
  assert.doesNotMatch(cards, /ammo\.hint/);
});
