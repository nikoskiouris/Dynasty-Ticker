import test from "node:test";
import assert from "node:assert/strict";
import { playerAgeForAsset, playerPositionForAsset } from "../docs/modules/values.js";
import {
  buildTradeMatchProfile,
  classifyMatchTimeline,
  describePartnerMatch,
  evaluateTradeHelp,
  gradeCoveredPosition,
  gradePositionNeed,
  isLateRoundPick,
  packageLooksLikeFiller,
  pickRound,
  previewBestMatch,
  proposeMatchDeals,
  rankPartnerMatches,
  scorePartnerMatch,
} from "../docs/modules/trade-match.js";

function player(id, name, position, age, rosterId = 1) {
  return {
    assetId: `player:${id}`,
    name,
    assetType: "player",
    managerRosterId: rosterId,
    raw: { position, fantasy_positions: [position], age },
  };
}

function pick(season, round, rosterId = 1, owner = "any") {
  return {
    assetId: `pick:${season}:r${round}:${owner}`,
    name: `${season} ${round === 1 ? "1st" : round === 2 ? "2nd" : "3rd"}`,
    assetType: "pick",
    managerRosterId: rosterId,
    raw: { season: String(season), round, original_owner: owner },
  };
}

function getAssetValue(asset, values) {
  return Number(values[asset.assetId]) || 0;
}

function positionsFor(asset) {
  const position = playerPositionForAsset(asset);
  return position ? [position] : [];
}

function roster(id, name, assets) {
  return {
    rosterId: id,
    manager: { displayName: name },
    assets,
  };
}

function powerProfile({ laneId, laneLabel, positions }) {
  return {
    lane: { id: laneId, label: laneLabel },
    laneId,
    laneLabel,
    positionSummaries: positions.map((row) => ({
      position: row.position,
      percentile: row.percentile,
      rankLabel: row.rankLabel || "",
      value: row.value || 0,
      demand: row.demand || 1,
    })),
  };
}

function contenderAssets() {
  return [
    player("allen", "Josh Allen", "QB", 29, 1),
    player("chase", "Ja'Marr Chase", "WR", 25, 1),
    player("lamb", "CeeDee Lamb", "WR", 26, 1),
    player("aiyuk", "Brandon Aiyuk", "WR", 27, 1),
    player("dart", "Committee Back", "RB", 27, 1),
    player("kelce", "Travis Kelce", "TE", 35, 1),
    pick(2027, 1, 1, "me"),
    pick(2027, 2, 1, "me"),
    pick(2027, 3, 1, "me"),
  ];
}

function rebuilderAssets() {
  return [
    player("stroud", "C.J. Stroud", "QB", 24, 2),
    player("bijan", "Bijan Robinson", "RB", 23, 2),
    player("gibbs", "Jahmyr Gibbs", "RB", 23, 2),
    player("rb3", "Handcuff Back", "RB", 24, 2),
    player("wr1", "Young Receiver", "WR", 23, 2),
    player("wr2", "Project Receiver", "WR", 22, 2),
    player("te", "Young Tight End", "TE", 23, 2),
    pick(2027, 1, 2, "them"),
    pick(2028, 1, 2, "them"),
    pick(2027, 3, 2, "them"),
  ];
}

const VALUES = {
  "player:allen": 9200,
  "player:chase": 9400,
  "player:lamb": 8100,
  "player:aiyuk": 4300,
  "player:dart": 2100,
  "player:kelce": 2800,
  "pick:2027:r1:me": 4100,
  "pick:2027:r2:me": 2100,
  "pick:2027:r3:me": 900,
  "player:stroud": 5400,
  "player:bijan": 9000,
  "player:gibbs": 8600,
  "player:rb3": 3900,
  "player:wr1": 2400,
  "player:wr2": 2100,
  "player:te": 2000,
  "pick:2027:r1:them": 4300,
  "pick:2028:r1:them": 4000,
  "pick:2027:r3:them": 850,
};

function buildLeagueProfiles() {
  const contenderRoster = roster(1, "Niko", contenderAssets());
  const rebuilderRoster = roster(2, "Demetri", rebuilderAssets());
  const helpers = {
    values: VALUES,
    getAssetValue,
    playerPositionForAsset,
    playerPositionsForAsset: positionsFor,
    playerAgeForAsset,
  };
  const mine = buildTradeMatchProfile({
    roster: contenderRoster,
    powerProfile: powerProfile({
      laneId: "contender",
      laneLabel: "Contender",
      positions: [
        { position: "QB", percentile: 0.9, demand: 1, value: 9200 },
        { position: "RB", percentile: 0.08, demand: 2, value: 2100 },
        { position: "WR", percentile: 0.92, demand: 3, value: 21800 },
        { position: "TE", percentile: 0.4, demand: 1, value: 2800 },
      ],
    }),
    ...helpers,
  });
  const theirs = buildTradeMatchProfile({
    roster: rebuilderRoster,
    powerProfile: powerProfile({
      laneId: "rebuild",
      laneLabel: "Rebuild Engine",
      positions: [
        { position: "QB", percentile: 0.45, demand: 1, value: 5400 },
        { position: "RB", percentile: 0.96, demand: 2, value: 17600 },
        { position: "WR", percentile: 0.12, demand: 3, value: 4500 },
        { position: "TE", percentile: 0.22, demand: 1, value: 2000 },
      ],
    }),
    ...helpers,
  });
  return { mine, theirs, helpers };
}

test("lanes map onto contend vs tank windows", () => {
  assert.equal(classifyMatchTimeline("contender"), "contending");
  assert.equal(classifyMatchTimeline("fragile-contender"), "contending");
  assert.equal(classifyMatchTimeline("rebuild"), "rebuilding");
  assert.equal(gradePositionNeed(0.1), "critical");
  assert.equal(gradePositionNeed(0.8), "surplus");
});

test("late-round picks are never a match headline", () => {
  const third = pick(2027, 3, 1, "me");
  assert.equal(pickRound(third), 3);
  assert.equal(isLateRoundPick(third), true);
  assert.equal(isLateRoundPick(pick(2027, 1, 1, "me")), false);
  assert.equal(
    packageLooksLikeFiller([third], [pick(2027, 3, 2, "them")], VALUES, getAssetValue),
    true
  );
});

test("complementary RB/WR plus contend vs tank is the partner you notice", () => {
  const { mine, theirs } = buildLeagueProfiles();
  const match = scorePartnerMatch(mine, theirs);
  assert.ok(match.score >= 18, `score ${match.score}`);
  assert.deepEqual(match.takePositions, ["RB"]);
  assert.ok(match.givePositions.includes("WR"));
  assert.equal(match.timelinePairing, "contend-rebuild");
  assert.equal(match.twoWay, true);
  assert.match(describePartnerMatch(match, mine), /RB/);
  assert.match(describePartnerMatch(match, mine), /tanking|contending/i);
});

test("rankPartnerMatches puts the complementary tank first", () => {
  const { mine, theirs, helpers } = buildLeagueProfiles();
  const other = buildTradeMatchProfile({
    roster: roster(3, "Flat", [
      player("qb", "League Average QB", "QB", 26, 3),
      player("rb", "League Average RB", "RB", 25, 3),
      player("wr", "League Average WR", "WR", 25, 3),
    ]),
    powerProfile: powerProfile({
      laneId: "middle",
      laneLabel: "Middle Build",
      positions: [
        { position: "QB", percentile: 0.5, demand: 1, value: 5000 },
        { position: "RB", percentile: 0.5, demand: 2, value: 5000 },
        { position: "WR", percentile: 0.5, demand: 3, value: 5000 },
      ],
    }),
    ...helpers,
    values: {
      "player:qb": 5000,
      "player:rb": 5000,
      "player:wr": 5000,
    },
  });
  const ranked = rankPartnerMatches(mine, [other, theirs]);
  assert.equal(ranked[0].match.managerName, "Demetri");
  const preview = previewBestMatch(mine, [other, theirs]);
  assert.equal(preview.managerName, "Demetri");
  assert.equal(preview.need, "RB");
});

test("match deals patch the hole and never ship a third-round swap", () => {
  const { mine, theirs, helpers } = buildLeagueProfiles();
  const match = scorePartnerMatch(mine, theirs);
  const deals = proposeMatchDeals({
    myProfile: mine,
    theirProfile: theirs,
    match,
    ...helpers,
  });
  assert.ok(deals.length >= 1, "expected a real two-team match deal");
  assert.ok(
    deals[0].myHelp.patchedNeeds.some((row) => row.position === "RB"),
    "top match should patch the loudest hole first"
  );
  assert.ok(
    deals.some((deal) => deal.myAssets.length + deal.theirAssets.length <= 3),
    "compact need-swap should beat a pile of extras"
  );
  for (const deal of deals) {
    assert.equal(deal.myAssets.some(isLateRoundPick), false, "no late-round outgoing");
    assert.equal(deal.theirAssets.some(isLateRoundPick), false, "no late-round incoming");
    assert.equal(
      packageLooksLikeFiller(deal.myAssets, deal.theirAssets, VALUES, getAssetValue),
      false
    );
    const incomingPositions = deal.theirAssets.flatMap((asset) => positionsFor(asset));
    assert.ok(
      incomingPositions.includes("RB") || deal.kind === "contend-rebuild",
      `incoming should help the RB hole: ${deal.theirAssets.map((asset) => asset.name).join(", ")}`
    );
    const myHelp = evaluateTradeHelp({
      profile: mine,
      incoming: deal.theirAssets,
      outgoing: deal.myAssets,
      ...helpers,
    });
    assert.equal(myHelp.helped, true);
    assert.ok(
      myHelp.patchedNeeds.some((row) => row.position === "RB") || myHelp.helped,
      "contender should leave the deal better at the need"
    );
  }
  const names = deals.flatMap((deal) => [...deal.myAssets, ...deal.theirAssets].map((asset) => asset.name)).join(" ");
  assert.doesNotMatch(names, /3rd/);
});

test("two startable tight ends are not a TE need", () => {
  const mine = buildTradeMatchProfile({
    roster: roster(1, "Friend", [
      player("likely", "Isaiah Likely", "TE", 25, 1),
      player("kincaid", "Dalton Kincaid", "TE", 25, 1),
      player("wr", "Wideout", "WR", 25, 1),
    ]),
    powerProfile: powerProfile({
      laneId: "contender",
      laneLabel: "Contender",
      positions: [
        { position: "TE", percentile: 0.18, demand: 1, value: 4800 },
        { position: "WR", percentile: 0.2, demand: 2, value: 3000 },
      ],
    }),
    values: {
      "player:likely": 4200,
      "player:kincaid": 4800,
      "player:wr": 3000,
    },
    getAssetValue,
    playerPositionForAsset,
    playerPositionsForAsset: positionsFor,
    playerAgeForAsset,
  });
  assert.equal(mine.needs.some((row) => row.position === "TE"), false);
  assert.equal(gradeCoveredPosition(0.18, { startable: 2, demand: 1 }), "stable");
  const empty = buildTradeMatchProfile({
    roster: roster(2, "Empty", [
      player("scrub", "Stream TE", "TE", 27, 2),
    ]),
    powerProfile: powerProfile({
      laneId: "middle",
      laneLabel: "Middle",
      positions: [{ position: "TE", percentile: 0.1, demand: 1, value: 900 }],
    }),
    values: { "player:scrub": 900 },
    getAssetValue,
    playerPositionForAsset,
    playerPositionsForAsset: positionsFor,
    playerAgeForAsset,
  });
  assert.equal(empty.needs[0]?.position, "TE");
  assert.equal(empty.needs[0]?.grade, "critical");
});

test("a third-for-third does not count as help", () => {
  const { mine, helpers } = buildLeagueProfiles();
  const help = evaluateTradeHelp({
    profile: mine,
    incoming: [pick(2027, 3, 2, "them")],
    outgoing: [pick(2027, 3, 1, "me")],
    ...helpers,
  });
  assert.equal(help.helped, false);
  assert.equal(help.patchedNeeds.length, 0);
});
