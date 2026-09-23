import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DOUBLE_TEAM_MISSING,
  DYNASTY_SCORE_LABEL,
  NFL_SCHEDULE_PATH,
  NO_RECENT_GAMES,
  NOT_ON_TEAM,
  OPPONENT_MISSING,
  TARGET_SHARE_MISSING,
  WEEKLY_LOOKBACK_WEEKS,
  WEEKLY_SCORE_HELP_TITLE,
  WEEKLY_SCORE_HINT,
  WEEKLY_SCORE_LABEL,
  lineupFillValue,
  formatWeeklyScore,
  weeklyScoreChipLabel,
  weeklyScoreHelpLines,
  buildWeeklyContext,
  buildWeeklyPlayerModel,
  regularSeasonFinale,
  dropPctFromStats,
  indexNflSchedule,
  lookupScheduledOpponent,
  normalizeNflTeam,
  opponentsFromTeamStats,
  renderWeeklyPlayerSheet,
  renderWeeklyScoreHelpButton,
  renderWeeklyScoreHelpPop,
  scoreWeeklyValue,
  targetShareFromStats,
  weeksForWeeklyValue,
} from "../docs/modules/weekly-value.js";

const docs = join(dirname(fileURLToPath(import.meta.url)), "../docs");

test("NFL aliases land on Sleeper team codes", () => {
  assert.equal(normalizeNflTeam("wsh"), "WAS");
  assert.equal(normalizeNflTeam("JAC"), "JAX");
  assert.equal(normalizeNflTeam("LA"), "LAR");
});

test("2026 week 2 schedule has DET at BUF", () => {
  const payload = JSON.parse(readFileSync(join(docs, NFL_SCHEDULE_PATH.replace("./", "")), "utf8"));
  const index = indexNflSchedule(payload);
  assert.deepEqual(lookupScheduledOpponent(index, "2026", 2, "BUF"), {
    opponent: "DET",
    home: true,
    bye: false,
    missing: "",
  });
  assert.equal(lookupScheduledOpponent(index, "2026", 5, "BUF").bye || Boolean(lookupScheduledOpponent(index, "2026", 5, "BUF").opponent), true);
});

test("weeks walk back into the previous season", () => {
  assert.deepEqual(
    weeksForWeeklyValue({ season: "2026", week: 2, previousSeason: "2025", count: 3 }).slice(0, 4),
    [
      { season: "2026", week: 2 },
      { season: "2026", week: 1 },
      { season: "2025", week: 18 },
      { season: "2025", week: 17 },
    ]
  );
});

test("2021 week 1 walks back to the 17-game 2020 finale", () => {
  assert.equal(regularSeasonFinale(2020), 17);
  assert.equal(regularSeasonFinale(2021), 18);
  assert.deepEqual(
    weeksForWeeklyValue({ season: "2021", week: 1, previousSeason: "2020", count: 2 }).slice(0, 3),
    [
      { season: "2021", week: 1 },
      { season: "2020", week: 17 },
      { season: "2020", week: 16 },
    ]
  );
});

test("a bye-week box score stays out of the lookback", () => {
  const scheduleIndex = indexNflSchedule({
    games: [
      { season: "2026", week: 4, home: "BUF", away: "NYJ" },
      { season: "2026", week: 5, home: "KC", away: "LAC" },
    ],
  });
  const model = buildWeeklyPlayerModel({
    playerId: "p1",
    name: "Bye Back",
    position: "WR",
    team: "BUF",
    dynastyValue: 1000,
    context: {
      season: "2026",
      week: 6,
      scheduleIndex,
      weekRows: [
        { season: "2026", week: 4, stats: { p1: { gp: 1, pts_ppr: 10, rec_tgt: 4 } } },
        { season: "2026", week: 5, stats: { p1: { gp: 1, pts_ppr: 20, rec_tgt: 8 } } },
        { season: "2026", week: 5, stats: { p1: { gp: 1, pts_ppr: 99, rec_tgt: 12 } } },
      ],
    },
  });
  assert.equal(model.recentPoints, 10);
  assert.equal(model.games.length, 1);
  assert.equal(model.games[0].week, 4);
});

test("target share and drops stay honest when pieces are missing", () => {
  assert.equal(targetShareFromStats({ rec_tgt: 8 }, { rec_tgt: 32 }), 0.25);
  assert.equal(targetShareFromStats({ rec_tgt: 8 }, {}), null);
  assert.equal(dropPctFromStats({ rec_tgt: 10, rec_drop: 2 }), 0.2);
  assert.equal(dropPctFromStats({ rec_tgt: 10 }), null);
});

test("TEAM stat pairing recovers opponents when yards match", () => {
  const paired = opponentsFromTeamStats({
    TEAM_SEA: { off_yd: 400, opp_off_yd: 250 },
    TEAM_NE: { off_yd: 250, opp_off_yd: 400 },
    TEAM_BUF: { off_yd: 111, opp_off_yd: 222 },
  });
  assert.equal(paired.SEA, "NE");
  assert.equal(paired.NE, "SEA");
  assert.equal(paired.BUF, undefined);
});

test("easy opponent lifts weekly score and a hard one cuts it", () => {
  const base = {
    position: "WR",
    recentPoints: 14,
    targetShare: 0.22,
    dropPct: 0.05,
    doubleTeamRate: null,
  };
  const easy = scoreWeeklyValue({ ...base, opponentPtsAllowed: 28, opponentLeagueAvg: 14 });
  const hard = scoreWeeklyValue({ ...base, opponentPtsAllowed: 8, opponentLeagueAvg: 14 });
  assert.ok(easy.score > hard.score, `easy ${easy.score} should beat hard ${hard.score}`);
  assert.equal(easy.matchupMult > hard.matchupMult, true);
  assert.ok(easy.missing.includes(DOUBLE_TEAM_MISSING));
  assert.equal(easy.complete, false);
});

test("dynasty market value never enters the weekly blend", () => {
  const left = scoreWeeklyValue({
    position: "WR",
    recentPoints: 12,
    targetShare: 0.2,
    dropPct: 0.08,
    opponentPtsAllowed: 18,
    opponentLeagueAvg: 16,
    dynastyValue: 9000,
  });
  const right = scoreWeeklyValue({
    position: "WR",
    recentPoints: 12,
    targetShare: 0.2,
    dropPct: 0.08,
    opponentPtsAllowed: 18,
    opponentLeagueAvg: 16,
    dynastyValue: 400,
  });
  assert.equal(left.score, right.score);
});

test("missing target share is visible and does not invent a usage rate", () => {
  const scored = scoreWeeklyValue({
    position: "WR",
    recentPoints: 11,
    opponentPtsAllowed: 16,
    opponentLeagueAvg: 16,
  });
  assert.ok(scored.missing.includes(TARGET_SHARE_MISSING));
  assert.ok(scored.missing.includes(DOUBLE_TEAM_MISSING));
  assert.ok(scored.usage <= 0.55, `missing usage should not look like a WR1, got ${scored.usage}`);
});

test("locked-in RB1 start chance sits near 90", () => {
  const scored = scoreWeeklyValue({
    position: "RB",
    recentPoints: 18.6,
    rushShare: 0.69,
    targetShare: 0.18,
    dropPct: 0.11,
    opponentPtsAllowed: 22,
    opponentLeagueAvg: 22,
  });
  assert.ok(scored.score >= 86 && scored.score <= 95, `elite RB ${scored.score} should sit in the 90s`);
});

test("middling flex sits near a 50/50 start", () => {
  const scored = scoreWeeklyValue({
    position: "WR",
    recentPoints: 12,
    targetShare: 0.13,
    dropPct: 0.06,
    opponentPtsAllowed: 16,
    opponentLeagueAvg: 16,
  });
  assert.ok(scored.score >= 44 && scored.score <= 58, `flex ${scored.score} should be a coin flip`);
});

test("starting QB start chance is high", () => {
  const starter = scoreWeeklyValue({
    position: "QB",
    recentPoints: 19.2,
    opponentPtsAllowed: 17,
    opponentLeagueAvg: 16.5,
  });
  const backup = scoreWeeklyValue({
    position: "QB",
    recentPoints: 1.0,
    opponentPtsAllowed: 17,
    opponentLeagueAvg: 16.5,
  });
  assert.ok(starter.score >= 85, `starting QB ${starter.score} should be a lock`);
  assert.ok(backup.score <= 35, `backup QB ${backup.score} should sit`);
  assert.ok(starter.score > backup.score);
});

test("matchup moves a flex more than a lock", () => {
  const lock = {
    position: "RB",
    recentPoints: 18,
    rushShare: 0.68,
    targetShare: 0.16,
    dropPct: 0.05,
  };
  const flex = {
    position: "WR",
    recentPoints: 11,
    targetShare: 0.13,
    dropPct: 0.06,
  };
  const lockEasy = scoreWeeklyValue({ ...lock, opponentPtsAllowed: 28, opponentLeagueAvg: 16 });
  const lockHard = scoreWeeklyValue({ ...lock, opponentPtsAllowed: 10, opponentLeagueAvg: 16 });
  const flexEasy = scoreWeeklyValue({ ...flex, opponentPtsAllowed: 28, opponentLeagueAvg: 16 });
  const flexHard = scoreWeeklyValue({ ...flex, opponentPtsAllowed: 10, opponentLeagueAvg: 16 });
  assert.ok(lockEasy.score > lockHard.score);
  assert.ok(flexEasy.score > flexHard.score);
  assert.ok(
    flexEasy.score - flexHard.score > lockEasy.score - lockHard.score,
    `flex swing ${flexEasy.score - flexHard.score} should beat lock swing ${lockEasy.score - lockHard.score}`,
  );
  assert.ok(lockHard.score >= 82, `lock vs hard ${lockHard.score} should stay startable`);
});

test("player sheet keeps weekly and dynasty on separate badges", () => {
  const context = buildWeeklyContext({
    season: "2026",
    week: 2,
    schedule: { games: [{ season: "2026", week: 1, home: "SEA", away: "NE" }, { season: "2026", week: 2, home: "SEA", away: "ARI" }] },
    players: {
      111: { team: "SEA", position: "WR" },
      222: { team: "NE", position: "WR" },
      333: { team: "ARI", position: "WR" },
    },
    weekRows: [
      {
        season: "2026",
        week: 1,
        stats: {
          111: { gp: 1, rec_tgt: 10, rec_drop: 1, rec: 7, pts_ppr: 18 },
          222: { gp: 1, rec_tgt: 8, rec_drop: 0, rec: 6, pts_ppr: 22 },
          TEAM_SEA: { rec_tgt: 40, rec_drop: 3, rush_att: 22, off_yd: 380, opp_off_yd: 260, opp_pass_fd: 14, opp_rush_fd: 8, opp_fd: 22 },
          TEAM_NE: { rec_tgt: 35, rec_drop: 1, rush_att: 20, off_yd: 260, opp_off_yd: 380, opp_pass_fd: 12, opp_rush_fd: 9, opp_fd: 21 },
        },
      },
    ],
  });
  const model = buildWeeklyPlayerModel({
    playerId: "111",
    name: "Demo WR",
    position: "WR",
    team: "SEA",
    dynastyValue: 8412,
    seasonStats: { gp: 1, pts_ppr: 18 },
    context,
  });
  assert.equal(model.inputs.length, 4);
  assert.equal(model.inputs.find((input) => input.id === "doubleTeam").missing, DOUBLE_TEAM_MISSING);
  assert.equal(model.upcomingOpponent, "ARI");
  assert.ok(model.score >= 1);
  const html = renderWeeklyPlayerSheet(model);
  assert.match(html, /class="weekly-score-badge"/);
  assert.match(html, /class="dynasty-value-badge"/);
  assert.match(html, new RegExp(WEEKLY_SCORE_LABEL));
  assert.match(html, new RegExp(DYNASTY_SCORE_LABEL));
  assert.match(html, /8,412/);
  assert.match(html, /no double-team data/);
  assert.match(html, /weekly-score-max">%/);
  assert.match(html, /Chance you should start them this week\. Not trade value\./);
  assert.match(html, /class="weekly-help-btn"/);
  assert.match(html, /data-action="toggle-weekly-help"/);
  assert.doesNotMatch(html, /Incomplete —/);
  assert.doesNotMatch(html, /class="weekly-score-badge"[^>]*>[^<]*Dynasty/);
  const css = readFileSync(join(docs, "styles.css"), "utf8");
  assert.match(css, /\.weekly-score-badge\s*\{/);
  assert.match(css, /\.dynasty-value-badge\s*\{/);
  assert.match(css, /\.weekly-score-max\s*\{/);
  assert.match(css, /\.sheet-metrics\s*\{[^}]*padding:/s);
  assert.match(css, /\.weekly-chip,\s*\.dynasty-chip\s*\{[^}]*display:\s*flex/s);
  assert.match(css, /button\.weekly-help-btn\s*\{[^}]*width:\s*1\.05rem/s);
  assert.match(css, /\.weekly-help-pop\s*\{/);
  assert.ok(!html.includes(NO_RECENT_GAMES) || model.games.length === 0);
});

test("league-wide week data is read once per context, not once per player", () => {
  let scans = 0;
  const players = {};
  const weekStats = (week) => {
    const stats = {
      TEAM_SEA: { rec_tgt: 36, rush_att: 24, off_yd: 360 + week, opp_off_yd: 290 },
      TEAM_NE: { rec_tgt: 31, rush_att: 27, off_yd: 290, opp_off_yd: 360 + week },
    };
    for (let index = 0; index < 40; index += 1) {
      stats[`p${index}`] = { gp: 1, rec_tgt: 2 + ((index + week) % 6), rush_att: index % 4, pts_ppr: 4 + ((index * 3 + week) % 17) };
    }
    return new Proxy(stats, {
      ownKeys(target) {
        scans += 1;
        return Reflect.ownKeys(target);
      },
    });
  };
  for (let index = 0; index < 40; index += 1) {
    players[`p${index}`] = { team: index % 2 ? "SEA" : "NE", position: ["WR", "RB", "TE"][index % 3] };
  }
  const context = buildWeeklyContext({
    season: "2026",
    week: 4,
    schedule: { games: [{ season: "2026", week: 4, home: "SEA", away: "ARI" }, { season: "2026", week: 4, home: "NE", away: "BUF" }] },
    players,
    weekRows: [1, 2, 3].map((week) => ({ season: "2026", week, stats: weekStats(week) })),
  });
  const modelFor = (playerId, ctx) => buildWeeklyPlayerModel({
    playerId,
    name: playerId,
    position: players[playerId].position,
    team: players[playerId].team,
    dynastyValue: 1000,
    context: ctx,
  });
  const before = scans;
  const models = Object.keys(players).map((playerId) => modelFor(playerId, context));
  assert.ok(scans - before <= 3, `40 players rescanned the week ${scans - before} times`);
  assert.ok(models.some((model) => model.games.length === 3));
  Object.keys(players).forEach((playerId, index) => {
    assert.deepEqual(models[index], modelFor(playerId, { ...context }));
  });
});

test("weekly score help popup explains start chance", () => {
  const button = renderWeeklyScoreHelpButton({ open: false });
  assert.match(button, /data-action="toggle-weekly-help"/);
  assert.match(button, /aria-expanded="false"/);
  assert.equal(renderWeeklyScoreHelpPop({ open: false }), "");
  const pop = renderWeeklyScoreHelpPop({ open: true });
  assert.match(pop, /id="weekly-help-pop"/);
  assert.match(pop, /role="dialog"/);
  assert.match(pop, new RegExp(WEEKLY_SCORE_HELP_TITLE));
  assert.match(pop, new RegExp(`last ${WEEKLY_LOOKBACK_WEEKS} games`));
  assert.match(pop, /50% is a coin flip/);
  assert.match(pop, /90% is a lock/);
  assert.match(pop, /data-action="close-weekly-help"/);
  assert.match(pop, /Sit\/start uses this number/);
  const lines = weeklyScoreHelpLines();
  assert.equal(lines.length, 5);
  const sheetOpen = renderWeeklyPlayerSheet({
    playerId: "111",
    name: "Demo WR",
    position: "WR",
    team: "SEA",
    score: 90,
    complete: false,
    missing: ["no double-team data"],
    dynastyValue: 8412,
    games: [],
    inputs: [],
  }, { helpOpen: true });
  assert.match(sheetOpen, /aria-expanded="true"/);
});

test("weekly score prints start chance percent", () => {
  assert.equal(formatWeeklyScore(50), "50%");
  assert.equal(formatWeeklyScore(90), "90%");
  assert.equal(formatWeeklyScore(0), "0%");
  assert.equal(formatWeeklyScore(null), "—");
  assert.equal(weeklyScoreChipLabel({ score: 22 }), "22%");
  assert.equal(weeklyScoreChipLabel({ score: 0 }), "0%");
  assert.equal(weeklyScoreChipLabel({ score: 62, opponentMissing: true }), "—");
  assert.equal(weeklyScoreChipLabel({ score: 62, bye: true }), "—");
  assert.equal(weeklyScoreChipLabel({ score: 0, noTeam: true }), "0%");
  assert.match(WEEKLY_SCORE_HINT, /Chance you should start/);
});

test("lineup fill prefers start chance over dynasty price", () => {
  const hotCheap = lineupFillValue({ startChance: 84, dynastyValue: 4253 });
  const coldExpensive = lineupFillValue({ startChance: 50, dynastyValue: 9000 });
  const lockCheap = lineupFillValue({ startChance: 90, dynastyValue: 6977 });
  const lockPricey = lineupFillValue({ startChance: 90, dynastyValue: 13830 });
  const noWeekly = lineupFillValue({ dynastyValue: 8000 });
  assert.ok(hotCheap > coldExpensive, "84% WR should start over a 50% WR with more market value");
  assert.ok(lockPricey > lockCheap, "same start chance, higher dynasty wins the tie");
  assert.equal(noWeekly, 8000);
  assert.equal(lineupFillValue({ startChance: null, dynastyValue: 500 }), 500);
});

test("bye week and unknown players fail opponent strength visibly", () => {
  const context = buildWeeklyContext({
    season: "2026",
    week: 5,
    schedule: { games: [{ season: "2026", week: 5, home: "KC", away: "LV" }] },
    players: { 9: { team: "BUF", position: "WR" } },
    weekRows: [],
  });
  const model = buildWeeklyPlayerModel({
    playerId: "9",
    name: "Bye WR",
    position: "WR",
    team: "BUF",
    context,
  });
  assert.ok(model.missing.includes(OPPONENT_MISSING));
  assert.equal(model.bye, true);
  assert.equal(model.opponentMissing, false);
  assert.equal(model.inputs.find((input) => input.id === "opponent").value, "Bye");
});

test("unsigned players are 0% this week, even with leftover box scores", () => {
  const context = buildWeeklyContext({
    season: "2026",
    week: 2,
    schedule: { games: [{ season: "2026", week: 2, home: "KC", away: "LV" }] },
    players: { tebow: { team: "", position: "QB" } },
    weekRows: [
      {
        season: "2026",
        week: 1,
        stats: { tebow: { gp: 1, pts_ppr: 22, pass_att: 30 } },
      },
    ],
  });
  const unsigned = buildWeeklyPlayerModel({
    playerId: "tebow",
    name: "Tim Tebow",
    position: "QB",
    team: "",
    seasonStats: { gp: 1, pts_ppr: 22 },
    context,
  });
  const fa = buildWeeklyPlayerModel({
    playerId: "tebow",
    name: "Tim Tebow",
    position: "QB",
    team: "FA",
    context,
  });
  assert.equal(unsigned.score, 0);
  assert.equal(unsigned.noTeam, true);
  assert.equal(unsigned.team, "");
  assert.ok(unsigned.missing.includes(NOT_ON_TEAM));
  assert.equal(unsigned.inputs.find((input) => input.id === "opponent").value, "No team");
  assert.equal(formatWeeklyScore(unsigned.score), "0%");
  assert.equal(weeklyScoreChipLabel(unsigned), "0%");
  assert.match(renderWeeklyPlayerSheet(unsigned), /not on a team/);
  assert.match(renderWeeklyPlayerSheet(unsigned), /weekly-score-badge[\s\S]*<strong>0<span class="weekly-score-max">%<\/span>/);
  assert.equal(fa.score, 0);
  assert.equal(fa.noTeam, true);
});
