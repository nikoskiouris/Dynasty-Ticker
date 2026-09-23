// Debug probes the unit tests do not run.
// `npm run debug` fails when a hidden bug shows up again.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { PAGE_IDS, PAGE_ROOMS } from "../docs/modules/constants.js";
import { DESK_JOBS, DESK_MORE_JOBS } from "../docs/modules/jobs.js";
import { chooseBestLineup } from "../docs/modules/lineup.js";
import { weekRowsFingerprint } from "../docs/modules/live.js";
import { rosterPointsFor } from "../docs/modules/mock-drafts.js";
import {
  buildShareUrl,
  classifyLeagueInput,
  isRoomOf,
  parseLeagueId,
  parseShareParams,
  resolveDeskPlace,
} from "../docs/modules/parse.js";
import { pairKey, pickRatherPair, RATHER_MAX_VALUE_RATIO } from "../docs/modules/rather.js";
import {
  bracketOrder,
  buildSeasonModel,
  matchupPoints,
  mulberry32,
  normalCdf,
  pointsAgainstFromSettings,
  simulateSeason,
  sleeperPoints,
} from "../docs/modules/season.js";
import { buildSitStart } from "../docs/modules/sit-start.js";
import { utcIsoWeek } from "../netlify/lib/traffic.js";
import {
  applyElitePlayerValuePremium,
  CROWD_MAX_ABS_SHIFT,
  crowdShiftsFromVotes,
} from "../docs/modules/values.js";
import { weeksForWeeklyValue } from "../docs/modules/weekly-value.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];
let checks = 0;

function check(name, run) {
  checks += 1;
  try {
    const detail = run();
    if (detail) failures.push(`${name}: ${detail}`);
  } catch (error) {
    failures.push(`${name}: ${error?.stack || error}`);
  }
}

function near(actual, expected, slack = 0.02) {
  return Math.abs(Number(actual) - Number(expected)) <= slack;
}

check("regex capture groups", () => {
  const problems = [];
  for (const file of walkJs(root)) {
    const text = readFileSync(file, "utf8");
    const consts = text.matchAll(/const\s+([A-Z0-9_]+)\s*=\s*\/((?:\\\/|[^/\n])+)\/[a-z]*/g);
    for (const found of consts) {
      const name = found[1];
      if (capturingGroupCount(found[2]) > 0) continue;
      const uses = text.matchAll(new RegExp(`\\.match\\(\\s*${name}\\s*\\)`, "g"));
      for (const use of uses) {
        const window = text.slice(use.index, use.index + 200);
        if (/\[1\]/.test(window)) {
          problems.push(`${relative(root, file)} ${name} has no capture group but reads match()[1]`);
        }
      }
    }
  }
  return problems.join("; ");
});

check("embedded league ids", () => {
  const prose = parseLeagueId("notes 1315165104303513600 please");
  if (prose !== "1315165104303513600") return `prose id came back ${prose}`;
  const draft = classifyLeagueInput("https://sleeper.app/draft/1315165104303513600");
  if (draft.kind !== "league" || draft.leagueId !== "1315165104303513600") {
    return `draft url classified as ${JSON.stringify(draft)}`;
  }
  const user = classifyLeagueInput("https://sleeper.app/u/NikoSkiouris");
  if (user.kind !== "username" || user.username !== "NikoSkiouris") {
    return `user url classified as ${JSON.stringify(user)}`;
  }
  return "";
});

check("share links round-trip every room", () => {
  for (const page of PAGE_IDS) {
    for (const room of PAGE_ROOMS[page] || []) {
      const url = buildShareUrl({
        origin: "https://dynastyticker.com",
        pathname: "/",
        leagueId: "1315165104303513600",
        tab: page,
        view: room,
      });
      const parsed = parseShareParams(url.includes("?") ? url.split("?")[1] : "");
      const place = resolveDeskPlace({ tab: parsed.tab, view: parsed.view });
      if (place.page !== page || place.room !== room) {
        return `${page}/${room} came back ${place.page}/${place.room} via ${url}`;
      }
    }
  }
  return "";
});

check("desk jobs point at real rooms", () => {
  for (const job of [...DESK_JOBS, ...DESK_MORE_JOBS]) {
    if (!isRoomOf(job.page, job.room)) return `${job.id} -> ${job.page}/${job.room}`;
  }
  return "";
});

check("custom points drive live state and the score cache", () => {
  const model = buildSeasonModel({
    league: leagueFixture({ lastScored: 0, leg: 1 }),
    rosters: rosters(4),
    users: users(4),
    weekRows: new Map([[1, [
      side(1, 1, 0, { custom_points: 42 }),
      side(2, 1, 0, { custom_points: 17 }),
      side(3, 2, 0, { custom_points: 11 }),
      side(4, 2, 0, { custom_points: 9 }),
    ]]]),
  });
  if (!model.currentWeekEntry?.isLive) return "custom-only scores were not live";
  const shown = model.currentWeekEntry.games[0]?.sides?.[0]?.points;
  if (!near(shown, 42, 0.01)) return `scoreboard showed ${shown}`;
  const quiet = new Map([[1, [{ roster_id: 1, points: 0, custom_points: 10 }]]]);
  const loud = new Map([[1, [{ roster_id: 1, points: 0, custom_points: 18 }]]]);
  if (weekRowsFingerprint(quiet) === weekRowsFingerprint(loud)) {
    return "fingerprint ignored custom_points";
  }
  if (matchupPoints({ custom_points: 18, points: 4 }) !== 18) return "matchupPoints preferred raw points";
  return "";
});

check("all-play luck uses the teams that actually scored", () => {
  const model = buildSeasonModel({
    league: leagueFixture({ lastScored: 1, leg: 2 }),
    rosters: rosters(4),
    users: users(4),
    weekRows: new Map([[1, [
      side(1, 1, 100),
      side(2, 1, 70),
      side(3, 0, 0),
      side(4, 0, 0),
    ]]]),
  });
  const winner = model.teams.get("1");
  if (!near(winner.expectedWins, 1, 0.01)) return `expected wins ${winner.expectedWins}`;
  if (!near(winner.luck, 0, 0.01)) return `luck ${winner.luck}`;
  return "";
});

check("median tie is a tie", () => {
  const model = buildSeasonModel({
    league: leagueFixture({ lastScored: 1, leg: 2, medianGames: true, teams: 3 }),
    rosters: rosters(3),
    users: users(3),
    weekRows: new Map([[1, [
      side(1, 1, 10),
      side(2, 1, 30),
      side(3, 0, 20),
    ]]]),
  });
  const middle = model.teams.get("3");
  if (middle.ties !== 1 || middle.wins !== 0 || middle.losses !== 0) {
    return `middle record ${middle.wins}-${middle.losses}-${middle.ties}`;
  }
  const wins = [...model.teams.values()].reduce((sum, team) => sum + team.wins, 0);
  const losses = [...model.teams.values()].reduce((sum, team) => sum + team.losses, 0);
  if (wins !== losses) return `wins ${wins} losses ${losses}`;
  return "";
});

check("head-to-head books stay balanced", () => {
  const random = mulberry32(11);
  for (let trial = 0; trial < 12; trial += 1) {
    const model = buildSeasonModel({
      league: leagueFixture({ lastScored: 2, leg: 3 }),
      rosters: rosters(4),
      users: users(4),
      weekRows: new Map([
        [1, [side(1, 1, score(random)), side(2, 1, score(random)), side(3, 2, score(random)), side(4, 2, score(random))]],
        [2, [side(1, 1, score(random)), side(3, 1, score(random)), side(2, 2, score(random)), side(4, 2, score(random))]],
      ]),
    });
    const teams = [...model.teams.values()];
    const wins = teams.reduce((sum, team) => sum + team.wins, 0);
    const losses = teams.reduce((sum, team) => sum + team.losses, 0);
    if (wins !== losses) return `trial ${trial} wins ${wins} losses ${losses}`;
    for (const team of teams) {
      if (team.wins + team.losses + team.ties !== team.gamesPlayed) {
        return `trial ${trial} roster ${team.rosterId} record does not match games`;
      }
      if (team.expectedWins < -0.001 || team.expectedWins - team.gamesPlayed > 0.02) {
        return `trial ${trial} roster ${team.rosterId} expected wins ${team.expectedWins}`;
      }
    }
  }
  return "";
});

check("sleeper points do not add the decimal twice", () => {
  if (sleeperPoints(100.45, 45) !== 100.45) return `float whole ${sleeperPoints(100.45, 45)}`;
  if (sleeperPoints(140, 50) !== 140.5) return `split stat ${sleeperPoints(140, 50)}`;
  if (pointsAgainstFromSettings({ fpts_against: 10.2, fpts_against_decimal: 20 }) !== 10.2) {
    return "points against double counted";
  }
  const scored = rosters(2);
  scored[0].settings.fpts = 100.45;
  scored[0].settings.fpts_decimal = 45;
  const model = buildSeasonModel({
    league: leagueFixture({ lastScored: 0, leg: 1 }),
    rosters: scored,
    users: users(2),
    weekRows: new Map(),
  });
  const pf = model.teams.get("1")?.sleeperRecord?.pf;
  if (pf !== 100.45) return `season pf ${pf}`;
  if (rosterPointsFor({ settings: { fpts: 100.45, fpts_decimal: 45 } }) !== 100.45) {
    return "mock draft points double counted";
  }
  return "";
});

check("iso weeks follow the Thursday rule", () => {
  for (let year = 2015; year <= 2032; year += 1) {
    const jan4 = utcIsoWeek(new Date(Date.UTC(year, 0, 4)));
    if (jan4.year !== year || jan4.week !== 1) return `${year}-01-04 -> ${jan4.year}-W${jan4.week}`;
  }
  const samples = [
    ["2021-01-01", 2020, 53],
    ["2020-12-31", 2020, 53],
    ["2026-01-01", 2026, 1],
    ["2019-12-30", 2020, 1],
  ];
  for (const [iso, year, week] of samples) {
    const got = utcIsoWeek(new Date(`${iso}T00:00:00Z`));
    if (got.year !== year || got.week !== week) return `${iso} -> ${got.year}-W${got.week}`;
  }
  return "";
});

check("normal cdf is symmetric", () => {
  if (!near(normalCdf(0), 0.5, 0.002)) return `cdf(0) = ${normalCdf(0)}`;
  for (const z of [0.4, 1, 1.8]) {
    const sum = normalCdf(z) + normalCdf(-z);
    if (!near(sum, 1, 0.003)) return `cdf(${z}) + cdf(-${z}) = ${sum}`;
  }
  return "";
});

check("bracket order is a seed permutation", () => {
  for (const size of [1, 2, 4, 8, 16]) {
    const order = bracketOrder(size);
    const unique = new Set(order);
    if (order.length !== size || unique.size !== size) return `size ${size} -> ${order.join(",")}`;
    for (let seed = 1; seed <= size; seed += 1) {
      if (!unique.has(seed)) return `size ${size} missing ${seed}`;
    }
  }
  return "";
});

check("playoff sim hands out every spot and one title", () => {
  const model = buildSeasonModel({
    league: leagueFixture({ lastScored: 1, leg: 2, playoffTeams: 2 }),
    rosters: rosters(4),
    users: users(4),
    weekRows: new Map([
      [1, [side(1, 1, 110), side(2, 1, 90), side(3, 2, 100), side(4, 2, 80)]],
      [2, [side(1, 1, 0), side(3, 1, 0), side(2, 2, 0), side(4, 2, 0)]],
    ]),
    nflState: { season: "2026", week: 2, season_type: "regular" },
  });
  const sim = simulateSeason(model, { iterations: 80, seed: 3 });
  if (!sim) return "sim missing";
  const playoffSum = sim.results.reduce((sum, row) => sum + row.playoffPct, 0);
  const titleSum = sim.results.reduce((sum, row) => sum + row.titlePct, 0);
  if (!near(playoffSum, model.playoffTeams * 100, 1.5)) return `playoff pct sum ${playoffSum}`;
  if (!near(titleSum, 100, 1.5)) return `title pct sum ${titleSum}`;
  return "";
});

check("weekly lookback does not repeat a slate", () => {
  const weeks = weeksForWeeklyValue({ season: "2026", week: 2, previousSeason: "2025", count: 6 });
  if (weeks.length !== 7) return `length ${weeks.length}`;
  if (weeks[0].season !== "2026" || weeks[0].week !== 2) return `starts at ${weeks[0].season} week ${weeks[0].week}`;
  const keys = weeks.map((row) => `${row.season}-${row.week}`);
  if (new Set(keys).size !== keys.length) return `duplicate ${keys.join(",")}`;
  return "";
});

check("elite premium never drops as the raw price rises", () => {
  let previous = 0;
  for (let value = 0; value <= 12000; value += 25) {
    const premium = applyElitePlayerValuePremium({ assetType: "player" }, value);
    if (premium + 0.001 < previous) return `${value} -> ${premium} after ${previous}`;
    previous = premium;
  }
  return "";
});

check("crowd shifts stay inside the cap", () => {
  const now = Date.UTC(2026, 8, 16);
  const votes = Array.from({ length: 40 }, (_, index) => ({
    eventId: `vote-${index}`,
    winnerId: "player:a",
    loserId: "player:b",
    format: "sf",
    at: now - index * 3600000,
  }));
  const shifts = crowdShiftsFromVotes(votes, { "player:a": 5000, "player:b": 4900 }, { format: "sf", now });
  for (const [id, shift] of Object.entries(shifts)) {
    if (Math.abs(shift) - CROWD_MAX_ABS_SHIFT > 1e-9) return `${id} shift ${shift}`;
  }
  return "";
});

check("rather picks a close fight when one exists", () => {
  const players = [
    { assetId: "player:a", playerId: "a", name: "Ace", value: 9000, position: "WR" },
    { assetId: "player:b", playerId: "b", name: "Bee", value: 1000, position: "RB" },
    { assetId: "player:c", playerId: "c", name: "Cee", value: 980, position: "TE" },
  ];
  const close = pairKey("player:b", "player:c");
  for (let seed = 1; seed <= 12; seed += 1) {
    const pair = pickRatherPair(players, { random: mulberry32(seed) });
    if (!pair) return "no pair";
    if (pair.key !== close) return `seed ${seed} picked ${pair.key}`;
    const hi = Math.max(pair.left.value, pair.right.value);
    const lo = Math.min(pair.left.value, pair.right.value);
    if (hi / lo > RATHER_MAX_VALUE_RATIO) return `ratio ${hi / lo}`;
  }
  return "";
});

check("lineup solver does not play the same player twice", () => {
  const candidates = [{ value: 12 }, { value: 9 }, { value: 8 }, { value: 3 }];
  const slots = ["QB", "RB", "WR"].map((slot) => ({ slot }));
  const plan = chooseBestLineup(slots, candidates, () => true);
  const picks = plan.picks.filter((pick) => pick != null);
  if (new Set(picks).size !== picks.length) return `picks ${plan.picks.join(",")}`;
  const score = picks.reduce((sum, index) => sum + candidates[index].value, 0);
  if (score !== plan.score) return `score ${plan.score} vs ${score}`;
  if (plan.score !== 29) return `best score ${plan.score}`;
  return "";
});

check("sit start keeps a scarce starter when stars crowd the cap", () => {
  const qbs = [1, 2, 3].map((index) => ({
    id: `qb${index}`,
    name: `QB ${index}`,
    position: "QB",
    positions: ["QB"],
    weekly: { score: 20 - index, position: "QB" },
    dynastyValue: 1000,
  }));
  const wrs = Array.from({ length: 18 }, (_, index) => ({
    id: `wr${index}`,
    name: `WR ${index}`,
    position: "WR",
    positions: ["WR"],
    weekly: { score: 99, position: "WR" },
    dynastyValue: 8000,
  }));
  const board = buildSitStart({ players: [...qbs, ...wrs], slots: ["QB", "QB", "QB"], week: 3 });
  const started = board.starters.map((entry) => entry.player?.id).filter(Boolean);
  if (started.length !== 3) return `started ${started.join(",") || "nobody"}`;
  const hurt = buildSitStart({
    slots: ["QB"],
    week: 3,
    players: [
      { id: "out", name: "Out QB", position: "QB", positions: ["QB"], injuryStatus: "Out", weekly: { score: 99, position: "QB" }, dynastyValue: 1 },
      { id: "ok", name: "Healthy QB", position: "QB", positions: ["QB"], weekly: { score: 40, position: "QB" }, dynastyValue: 1 },
    ],
  });
  if (hurt.starters[0]?.player?.id !== "ok") return `started ${hurt.starters[0]?.player?.id}`;
  return "";
});

function leagueFixture({
  lastScored = 1,
  leg = 2,
  medianGames = false,
  playoffTeams = 2,
  teams = 4,
} = {}) {
  return {
    league_id: "L1",
    season: "2026",
    status: "in_season",
    settings: {
      start_week: 1,
      playoff_week_start: 4,
      playoff_teams: playoffTeams,
      playoff_round_type: 0,
      divisions: 0,
      league_average_match: medianGames ? 1 : 0,
      last_scored_leg: lastScored,
      leg,
    },
    total_rosters: teams,
  };
}

function users(count) {
  return Array.from({ length: count }, (_, index) => ({
    user_id: `u${index + 1}`,
    display_name: `M${index + 1}`,
  }));
}

function rosters(count) {
  return Array.from({ length: count }, (_, index) => ({
    roster_id: index + 1,
    owner_id: `u${index + 1}`,
    settings: { wins: 0, losses: 0, ties: 0, fpts: 0, fpts_decimal: 0 },
  }));
}

function side(rosterId, matchupId, points, extras = {}) {
  return {
    roster_id: rosterId,
    matchup_id: matchupId,
    points,
    ...extras,
  };
}

function score(random) {
  return 60 + Math.floor(random() * 80);
}

function capturingGroupCount(pattern) {
  const stripped = pattern.replace(/\\./g, "").replace(/\[(?:\\.|[^\]])\]/g, "");
  return (stripped.match(/\((?!\?)/g) || []).length;
}

function walkJs(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".git" || name === "data") continue;
    const path = join(dir, name);
    const info = statSync(path);
    if (info.isDirectory()) walkJs(path, out);
    else if (name.endsWith(".js")) out.push(path);
  }
  return out;
}

if (failures.length) {
  console.error(`debug invariants found ${failures.length} bug${failures.length === 1 ? "" : "s"} in ${checks} checks`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`debug invariants ok (${checks} checks)`);
