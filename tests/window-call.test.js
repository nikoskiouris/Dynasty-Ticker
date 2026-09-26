import test from "node:test";
import assert from "node:assert/strict";
import {
  analyzeWindowCall,
  computeSeasonProgress,
  groupWindowCalls,
  scoreWindowAxes,
  summarizeLeagueWindowCalls,
  windowCallInputFromDesk,
  windowCallTeamState,
} from "../docs/modules/window-call.js";

function callFor(overrides = {}) {
  return analyzeWindowCall({
    rosterId: "1",
    managerName: "Niko",
    rank: 6,
    totalTeams: 12,
    powerScore: 74,
    starterPercentile: 0.55,
    pickPercentile: 0.5,
    timelineScore: 0.5,
    averageAge: 26.2,
    youthCount: 6,
    veteranCount: 6,
    firstRoundPickCount: 2,
    weakestPosition: { position: "RB", percentile: 0.3, rankLabel: "8th / 12" },
    playoffPct: 42,
    titlePct: 6,
    lastPlacePct: 4,
    winPct: 0.5,
    gamesPlayed: 8,
    remainingTeamGames: 6,
    currentWeek: 9,
    startWeek: 1,
    playoffStart: 15,
    playoffTeams: 6,
    ...overrides,
  });
}

test("season progress hits 1 after the regular season and stays early before kickoff", () => {
  assert.equal(computeSeasonProgress({ seasonComplete: true }), 1);
  assert.ok(computeSeasonProgress({ currentWeek: 1, startWeek: 1, playoffStart: 15 }) < 0.08);
  assert.ok(computeSeasonProgress({ currentWeek: 10, startWeek: 1, playoffStart: 15 }) > 0.6);
});

test("aging title threat goes all in", () => {
  const result = callFor({
    rank: 1,
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
    clinched: false,
  });
  assert.equal(result.id, "all-in");
  assert.equal(result.teamState, "contending");
  assert.equal(result.tone, "green");
  assert.match(result.headline, /window|title|live/i);
  assert.ok(result.moves.some((move) => /first|starter/i.test(move)));
  assert.ok(result.confidence >= 70);
});

test("young last-place pick hoarder tanks", () => {
  const result = callFor({
    rank: 12,
    powerScore: 46,
    starterPercentile: 0.08,
    pickPercentile: 0.92,
    timelineScore: 0.86,
    averageAge: 24.0,
    youthCount: 11,
    veteranCount: 3,
    firstRoundPickCount: 4,
    playoffPct: 4,
    titlePct: 0.2,
    lastPlacePct: 41,
    winPct: 0.15,
  });
  assert.equal(result.id, "tank");
  assert.equal(result.teamState, "rebuilding");
  assert.match(result.headline, /rebuild|tear|aging production/i);
  assert.ok(result.moves.some((move) => /veteran/i.test(move)));
});

test("bubble mixed roster stays in the middle", () => {
  const result = callFor();
  assert.equal(result.id, "middle");
  assert.equal(result.shortLabel, "Middle");
  assert.match(result.summary, /not a tank/i);
  assert.ok(result.nowScore > 35 && result.nowScore < 70);
});

test("early season keeps the fence: balanced, thin capital, and flat rosters stay middle", () => {
  const early = { currentWeek: 3, gamesPlayed: 2, remainingTeamGames: 12 };
  const balanced = callFor({
    ...early,
    rank: 6,
    powerScore: 70,
    starterPercentile: 0.48,
    pickPercentile: 0.72,
    averageAge: 24.8,
    youthCount: 10,
    veteranCount: 8,
    firstRoundPickCount: 5,
    playoffPct: 55,
    titlePct: 6,
    winPct: 1,
  });
  const thinCapital = callFor({
    ...early,
    rank: 5,
    powerScore: 78,
    starterPercentile: 0.55,
    pickPercentile: 0.22,
    averageAge: 26.3,
    youthCount: 8,
    veteranCount: 9,
    firstRoundPickCount: 1,
    playoffPct: 80,
    titlePct: 13,
    winPct: 1,
  });
  const flat = callFor({
    ...early,
    rank: 9,
    powerScore: 58,
    starterPercentile: 0.36,
    pickPercentile: 0.28,
    averageAge: 25.7,
    youthCount: 6,
    veteranCount: 9,
    firstRoundPickCount: 1,
    playoffPct: 21,
    titlePct: 2,
    winPct: 0.5,
    lastPlacePct: 14,
  });
  const rebuild = callFor({
    ...early,
    rank: 10,
    powerScore: 48,
    starterPercentile: 0.2,
    pickPercentile: 0.75,
    averageAge: 24.4,
    youthCount: 9,
    veteranCount: 5,
    firstRoundPickCount: 3,
    playoffPct: 14,
    titlePct: 1,
    winPct: 0,
    lastPlacePct: 18,
  });
  const elite = callFor({
    ...early,
    rank: 2,
    powerScore: 94,
    starterPercentile: 0.9,
    pickPercentile: 0.7,
    averageAge: 24.9,
    youthCount: 12,
    veteranCount: 5,
    firstRoundPickCount: 4,
    playoffPct: 80,
    titlePct: 15,
    winPct: 1,
  });

  assert.equal(balanced.id, "middle");
  assert.ok(balanced.nowScore >= 50 && balanced.nowScore <= 70);
  assert.equal(thinCapital.id, "middle");
  assert.ok(thinCapital.nowScore >= 60 && thinCapital.nowScore <= 76);
  assert.ok(thinCapital.futureScore <= 45);
  assert.equal(flat.id, "middle");
  assert.ok(flat.nowScore >= 33 && flat.nowScore <= 46);
  assert.equal(rebuild.id, "tank");
  assert.ok(rebuild.futureScore >= 58);
  assert.equal(elite.id, "all-in");
  assert.ok(elite.nowScore >= 80);
});

test("eliminated teams tank even with a decent core", () => {
  const result = callFor({
    rank: 8,
    powerScore: 71,
    playoffPct: 0,
    titlePct: 0,
    eliminated: true,
    winPct: 0.33,
    currentWeek: 12,
  });
  assert.equal(result.id, "tank");
});

test("clinched teams go all in", () => {
  const result = callFor({
    rank: 2,
    powerScore: 88,
    starterPercentile: 0.84,
    averageAge: 25.8,
    playoffPct: 100,
    titlePct: 19,
    clinched: true,
    winPct: 0.75,
  });
  assert.equal(result.id, "all-in");
});

test("dead playoff math late in the year forces a tank", () => {
  const result = callFor({
    rank: 11,
    powerScore: 58,
    starterPercentile: 0.22,
    playoffPct: 2,
    titlePct: 0,
    winPct: 0.25,
    currentWeek: 12,
    averageAge: 27.1,
  });
  assert.equal(result.id, "tank");
});

test("preseason elite roster competes, preseason rebuild tanks", () => {
  const contender = callFor({
    rank: 1,
    powerScore: 91,
    starterPercentile: 0.94,
    pickPercentile: 0.4,
    averageAge: 25.9,
    playoffPct: null,
    titlePct: null,
    winPct: null,
    gamesPlayed: 0,
    remainingTeamGames: 13,
    currentWeek: 1,
  });
  const rebuild = callFor({
    rank: 12,
    powerScore: 44,
    starterPercentile: 0.1,
    pickPercentile: 0.88,
    averageAge: 24.2,
    firstRoundPickCount: 4,
    youthCount: 10,
    veteranCount: 2,
    playoffPct: null,
    titlePct: null,
    winPct: null,
    gamesPlayed: 0,
    remainingTeamGames: 13,
    currentWeek: 1,
  });
  assert.equal(contender.id, "all-in");
  assert.equal(rebuild.id, "tank");
});

test("desk snapshot maps standings, sim, and remaining games", () => {
  const input = windowCallInputFromDesk({
    profile: {
      rosterId: 3,
      managerName: "Alex",
      rank: 4,
      totalTeams: 12,
      score: 81,
      starterPercentile: 0.7,
      pickPercentile: 0.4,
      timelineScore: 0.45,
      assetSummary: { averageAge: 27.2, youthCount: 5, veteranCount: 7, firstRoundPickCount: 1 },
      weakestPosition: { position: "WR", percentile: 0.2, rankLabel: "10th / 12" },
    },
    standing: { rosterId: 3, name: "Alex", wins: 8, losses: 3, ties: 0, gamesPlayed: 11, recordLabel: "8-3" },
    simRow: { playoffPct: 71, titlePct: 14, lastPlacePct: 1, clinched: false, eliminated: false },
    model: {
      currentWeek: 12,
      startWeek: 1,
      playoffStart: 15,
      playoffTeams: 6,
      remainingGames: [
        { game: { sides: [{ rosterId: "3" }, { rosterId: "9" }] } },
        { game: { sides: [{ rosterId: "2" }, { rosterId: "4" }] } },
      ],
    },
  });
  assert.equal(input.rosterId, "3");
  assert.equal(input.winPct, 8 / 11);
  assert.equal(input.remainingTeamGames, 1);
  assert.equal(input.playoffPct, 71);
  const result = analyzeWindowCall(input);
  assert.equal(result.id, "all-in");
  assert.equal(windowCallTeamState(result.id), "contending");
});

test("league grouping counts the three calls", () => {
  const calls = [
    callFor({ rank: 1, powerScore: 92, starterPercentile: 0.95, playoffPct: 88, titlePct: 24, averageAge: 28 }),
    callFor(),
    callFor({ rank: 12, powerScore: 45, starterPercentile: 0.1, playoffPct: 3, firstRoundPickCount: 4, averageAge: 24, currentWeek: 11 }),
  ];
  const summary = summarizeLeagueWindowCalls(calls);
  assert.equal(summary.allInCount, 1);
  assert.equal(summary.middleCount, 1);
  assert.equal(summary.tankCount, 1);
  assert.equal(groupWindowCalls(calls).tank[0].id, "tank");
});

test("this-year and future scores move in the expected directions", () => {
  const hot = scoreWindowAxes({
    rank: 1,
    totalTeams: 12,
    powerScore: 94,
    starterPercentile: 0.97,
    playoffPct: 90,
    titlePct: 30,
    winPct: 0.85,
    currentWeek: 10,
    averageAge: 28.4,
    pickPercentile: 0.2,
    firstRoundPickCount: 0,
    youthCount: 2,
    veteranCount: 10,
  });
  const cold = scoreWindowAxes({
    rank: 12,
    totalTeams: 12,
    powerScore: 42,
    starterPercentile: 0.05,
    playoffPct: 3,
    titlePct: 0,
    winPct: 0.1,
    currentWeek: 10,
    averageAge: 23.8,
    pickPercentile: 0.95,
    firstRoundPickCount: 5,
    youthCount: 12,
    veteranCount: 2,
  });
  assert.ok(hot.nowScore > cold.nowScore);
  assert.ok(cold.futureScore > hot.futureScore);
  assert.ok(hot.aging);
  assert.ok(cold.young);
});

test("redraft dead team is out, not a rebuild", () => {
  const result = callFor({
    horizon: "season",
    rank: 12,
    powerScore: 46,
    starterPercentile: 0.08,
    pickPercentile: 0.5,
    firstRoundPickCount: 0,
    playoffPct: 2,
    titlePct: 0,
    lastPlacePct: 40,
    winPct: 0.15,
    currentWeek: 12,
    averageAge: 24.0,
    youthCount: 11,
    veteranCount: 3,
  });
  assert.equal(result.id, "tank");
  assert.equal(result.horizon, "season");
  assert.equal(result.shortLabel, "Out");
  assert.equal(result.label, "Out of it");
  assert.match(result.headline, /out|dead/i);
  assert.doesNotMatch(result.headline, /rebuild|firsts|veterans/i);
  assert.ok(result.signals.every((signal) => signal.id !== "picks"));
  assert.ok(result.moves.every((move) => !/2027 capital|pick vault/i.test(move)));
});

test("redraft lock is in it without spending future picks", () => {
  const result = callFor({
    horizon: "season",
    rank: 1,
    powerScore: 93,
    starterPercentile: 0.96,
    playoffPct: 88,
    titlePct: 24,
    clinched: true,
    winPct: 0.8,
    currentWeek: 12,
  });
  assert.equal(result.id, "all-in");
  assert.equal(result.shortLabel, "In it");
  assert.match(result.headline, /in it/i);
  assert.doesNotMatch(result.headline, /future picks/i);
});
