import { clamp, escapeHtml, formatNumber } from "./html.js";

export const NFL_SCHEDULE_PATH = "./data/nfl_schedule.json";
export const WEEKLY_LOOKBACK_WEEKS = 6;
export const WEEKLY_SCORE_MAX = 99;
export const WEEKLY_SCORE_LABEL = "This week";
export const WEEKLY_SCORE_HINT = "Chance you should start them this week. Not trade value.";
export const WEEKLY_SCORE_HELP_TITLE = "Start chance this week";
export const DYNASTY_SCORE_LABEL = "Dynasty";
export const LINEUP_START_CHANCE_WEIGHT = 1_000_000;
const START_CHANCE_BASE = 18;
const START_CHANCE_ROLE_SPAN = 72;
export const DOUBLE_TEAM_MISSING = "no double-team data";
export const TARGET_SHARE_MISSING = "no target-share data";
export const DROP_PCT_MISSING = "no drop-percentage data";
export const OPPONENT_MISSING = "no opponent-strength data";
export const NOT_ON_TEAM = "not on a team";
export const NO_RECENT_GAMES = "no recent games";
export const NO_WEEKLY_MODEL = "no weekly model for this position";

const TEAM_ALIASES = {
  WSH: "WAS",
  WAS: "WAS",
  JAC: "JAX",
  JAX: "JAX",
  LA: "LAR",
  LAR: "LAR",
  STL: "LAR",
  SD: "LAC",
  LAC: "LAC",
  OAK: "LV",
  LV: "LV",
  ARZ: "ARI",
  GBP: "GB",
  KCC: "KC",
  NEP: "NE",
  NOS: "NO",
  SFO: "SF",
  TBB: "TB",
};

const PRODUCTION_ANCHOR = {
  QB: 20,
  RB: 15,
  WR: 14,
  TE: 10,
};

const WEEKLY_POSITIONS = new Set(["QB", "RB", "WR", "TE"]);

export function emptyWeeklyValueState() {
  return {
    loaded: false,
    loading: false,
    error: "",
    season: "",
    week: 0,
    previousSeason: "",
    weekRows: [],
    seasonStats: {},
    schedule: { games: [] },
    context: null,
    selectedPlayerId: "",
    helpOpen: false,
    key: "",
    promise: null,
  };
}

export function weeklyScoreHelpLines() {
  return [
    "This number is the chance you should start them. 50% is a coin flip. 90% is a lock.",
    "Top-tier names belong in the 90s. A healthy RB1 vs an average defense should sit near 90, not 60.",
    `Blends role, last ${WEEKLY_LOOKBACK_WEEKS} games of PPR, drops, and this week's opponent. Matchup barely moves a lock; it matters more at 50/50.`,
    "Not dynasty trade price. Last week alone does not set it.",
    "Sit/start uses this number. Bye, out, no team, and missing opponent sit. Dynasty price only breaks ties.",
  ];
}

export function lineupFillValue({ startChance, dynastyValue } = {}) {
  const dynasty = Number.isFinite(Number(dynastyValue)) ? Number(dynastyValue) : 0;
  if (!Number.isFinite(Number(startChance))) return dynasty;
  return Number(startChance) * LINEUP_START_CHANCE_WEIGHT + dynasty;
}

export function renderWeeklyScoreHelpButton({ open = false } = {}) {
  return `
    <button
      type="button"
      class="weekly-help-btn"
      data-action="toggle-weekly-help"
      aria-expanded="${open ? "true" : "false"}"
      aria-haspopup="dialog"
      aria-controls="weekly-help-pop"
      title="What this start chance means"
    >
      <span aria-hidden="true">i</span>
      <span class="sr-only">What this start chance means</span>
    </button>
  `;
}

export function renderWeeklyScoreHelpPop({ open = false } = {}) {
  if (!open) return "";
  return `
    <div class="weekly-help-layer">
      <button type="button" class="weekly-help-scrim" data-action="close-weekly-help" aria-label="Close This week help"></button>
      <div class="weekly-help-pop" id="weekly-help-pop" role="dialog" aria-modal="true" aria-labelledby="weekly-help-title">
        <div class="weekly-help-pop-head">
          <h3 id="weekly-help-title">${escapeHtml(WEEKLY_SCORE_HELP_TITLE)}</h3>
          <button type="button" class="weekly-help-close" id="weekly-help-close" data-action="close-weekly-help" aria-label="Close">×</button>
        </div>
        ${weeklyScoreHelpLines().map((line) => `<p>${escapeHtml(line)}</p>`).join("")}
      </div>
    </div>
  `;
}

export function normalizeNflTeam(value) {
  const team = String(value || "").toUpperCase().trim();
  if (!team || team === "FA" || team === "NONE") return "";
  return TEAM_ALIASES[team] || team;
}

export function weeklyPosition(value) {
  const position = String(value || "").toUpperCase().trim();
  return WEEKLY_POSITIONS.has(position) ? position : "";
}

export function playerIdFromAssetId(assetId) {
  const raw = String(assetId || "").trim();
  return raw.startsWith("player:") ? raw.slice("player:".length) : raw;
}

export function isTeamStatKey(key) {
  return String(key || "").startsWith("TEAM_");
}

export function teamFromStatKey(key) {
  return isTeamStatKey(key) ? normalizeNflTeam(String(key).slice(5)) : "";
}

export function indexNflSchedule(payload) {
  const games = Array.isArray(payload?.games) ? payload.games : (Array.isArray(payload) ? payload : []);
  const byTeamWeek = new Map();
  const weeks = new Set();
  games.forEach((game) => {
    const season = String(game?.season || "").trim();
    const week = Number(game?.week);
    const home = normalizeNflTeam(game?.home);
    const away = normalizeNflTeam(game?.away);
    if (!season || !Number.isFinite(week) || week <= 0 || !home || !away) return;
    weeks.add(`${season}:${week}`);
    byTeamWeek.set(`${season}:${week}:${home}`, { opponent: away, home: true });
    byTeamWeek.set(`${season}:${week}:${away}`, { opponent: home, home: false });
  });
  return { byTeamWeek, weeks };
}

export function lookupScheduledOpponent(index, season, week, team) {
  const teamKey = normalizeNflTeam(team);
  if (!teamKey) return { opponent: "", bye: false, missing: OPPONENT_MISSING };
  const hit = index?.byTeamWeek?.get(`${season}:${Number(week)}:${teamKey}`);
  if (hit?.opponent) return { ...hit, bye: false, missing: "" };
  if (index?.weeks?.has(`${season}:${Number(week)}`)) {
    return { opponent: "", bye: true, missing: OPPONENT_MISSING, home: false };
  }
  return { opponent: "", bye: false, missing: OPPONENT_MISSING };
}

export function opponentsFromTeamStats(weekStats) {
  const teams = {};
  Object.entries(weekStats || {}).forEach(([key, stats]) => {
    const team = teamFromStatKey(key);
    if (team && stats && typeof stats === "object") teams[team] = stats;
  });
  const names = Object.keys(teams);
  const paired = {};
  const used = new Set();
  names.forEach((team) => {
    if (used.has(team)) return;
    const row = teams[team];
    const matches = names.filter((other) => {
      if (other === team || used.has(other)) return false;
      const otherRow = teams[other];
      return Number(row?.off_yd) === Number(otherRow?.opp_off_yd)
        && Number(row?.opp_off_yd) === Number(otherRow?.off_yd);
    });
    if (matches.length !== 1) return;
    paired[team] = matches[0];
    paired[matches[0]] = team;
    used.add(team);
    used.add(matches[0]);
  });
  return paired;
}

export function weeksForWeeklyValue({ season, week, previousSeason, count = WEEKLY_LOOKBACK_WEEKS } = {}) {
  const currentSeason = String(season || "").trim();
  const currentWeek = Number(week);
  if (!currentSeason || !Number.isFinite(currentWeek) || currentWeek <= 0) return [];
  const out = [];
  let year = Number(currentSeason);
  let slate = currentWeek;
  let prior = Number(previousSeason || year - 1);
  const limit = Math.max(1, Number(count) || WEEKLY_LOOKBACK_WEEKS) + 1;
  while (out.length < limit && Number.isFinite(year) && year >= 2020) {
    out.push({ season: String(year), week: slate });
    slate -= 1;
    if (slate >= 1) continue;
    year = Number.isFinite(prior) ? prior : year - 1;
    prior = year - 1;
    slate = 18;
  }
  return out;
}

export function statNumber(stats, key) {
  const value = Number(stats?.[key]);
  return Number.isFinite(value) ? value : null;
}

export function playedNflGame(stats) {
  if (!stats || typeof stats !== "object") return false;
  return ["gp", "gms_active", "pts_ppr", "rec_tgt", "rush_att", "pass_att", "rec", "off_snp"]
    .some((key) => Number(stats[key]) > 0);
}

export function targetShareFromStats(playerStats, teamTotals) {
  const targets = statNumber(playerStats, "rec_tgt");
  const teamTargets = statNumber(teamTotals, "rec_tgt");
  if (targets == null || teamTargets == null || teamTargets <= 0) return null;
  return targets / teamTargets;
}

export function rushShareFromStats(playerStats, teamTotals) {
  const rushes = statNumber(playerStats, "rush_att");
  const teamRushes = statNumber(teamTotals, "rush_att");
  if (rushes == null || teamRushes == null || teamRushes <= 0) return null;
  return rushes / teamRushes;
}

export function dropPctFromStats(playerStats) {
  const drops = statNumber(playerStats, "rec_drop");
  const targets = statNumber(playerStats, "rec_tgt");
  if (drops == null || targets == null || targets <= 0) return null;
  return drops / targets;
}

export function teamTotalsFromWeek(weekStats, team, playerTeamById = {}) {
  const teamKey = normalizeNflTeam(team);
  const direct = weekStats?.[`TEAM_${teamKey}`];
  const totals = {
    rec_tgt: statNumber(direct, "rec_tgt"),
    rec_drop: statNumber(direct, "rec_drop"),
    rush_att: statNumber(direct, "rush_att"),
    pass_att: statNumber(direct, "pass_att"),
    off_yd: statNumber(direct, "off_yd"),
    opp_off_yd: statNumber(direct, "opp_off_yd"),
    opp_pass_fd: statNumber(direct, "opp_pass_fd"),
    opp_rush_fd: statNumber(direct, "opp_rush_fd"),
    opp_fd: statNumber(direct, "opp_fd"),
  };
  if (totals.rec_tgt != null && totals.rush_att != null) return totals;

  const summed = { rec_tgt: 0, rush_att: 0, rec_drop: 0, pass_att: 0, counted: false };
  Object.entries(weekStats || {}).forEach(([key, stats]) => {
    if (isTeamStatKey(key) || !stats || typeof stats !== "object") return;
    if (normalizeNflTeam(playerTeamById[key]) !== teamKey) return;
    summed.counted = true;
    summed.rec_tgt += Number(stats.rec_tgt) || 0;
    summed.rush_att += Number(stats.rush_att) || 0;
    summed.rec_drop += Number(stats.rec_drop) || 0;
    summed.pass_att += Number(stats.pass_att) || 0;
  });
  return {
    rec_tgt: totals.rec_tgt ?? (summed.counted ? summed.rec_tgt : null),
    rec_drop: totals.rec_drop ?? (summed.counted ? summed.rec_drop : null),
    rush_att: totals.rush_att ?? (summed.counted ? summed.rush_att : null),
    pass_att: totals.pass_att ?? (summed.counted ? summed.pass_att : null),
    off_yd: totals.off_yd,
    opp_off_yd: totals.opp_off_yd,
    opp_pass_fd: totals.opp_pass_fd,
    opp_rush_fd: totals.opp_rush_fd,
    opp_fd: totals.opp_fd,
  };
}

export function mean(values) {
  const nums = (Array.isArray(values) ? values : []).filter((value) => Number.isFinite(value));
  if (!nums.length) return null;
  return nums.reduce((sum, value) => sum + value, 0) / nums.length;
}

export function startRoleFromUsage({
  position,
  points,
  targetShare,
  rushShare,
} = {}) {
  const pos = weeklyPosition(position);
  const heat = Number.isFinite(Number(points)) ? Number(points) / (PRODUCTION_ANCHOR[pos] || 14) : 0;
  if (pos === "RB") {
    if (rushShare == null && targetShare == null) return clamp(heat * 0.4, 0, 0.55);
    const rush = rushShare != null ? Number(rushShare) : 0.18;
    const rec = targetShare != null ? Number(targetShare) : 0.06;
    return clamp((rush / 0.72) * 0.82 + (rec / 0.18) * 0.18, 0, 1);
  }
  if (pos === "WR") {
    if (targetShare == null) return clamp(heat * 0.4, 0, 0.55);
    return clamp(Number(targetShare) / 0.26, 0, 1);
  }
  if (pos === "TE") {
    if (targetShare == null) return clamp(heat * 0.4, 0, 0.55);
    return clamp(Number(targetShare) / 0.22, 0, 1);
  }
  if (pos === "QB") {
    return clamp(Number(points) / 18, 0, 1);
  }
  return 0;
}

export function scoreWeeklyValue({
  position,
  recentPoints,
  seasonPointsPerGame,
  targetShare,
  rushShare,
  dropPct,
  opponentPtsAllowed,
  opponentLeagueAvg,
  doubleTeamRate,
} = {}) {
  const pos = weeklyPosition(position);
  const missing = [];
  if (!pos) {
    return {
      score: null,
      complete: false,
      missing: [NO_WEEKLY_MODEL],
      matchupMult: 1,
    };
  }

  missing.push(DOUBLE_TEAM_MISSING);
  if (doubleTeamRate != null && Number.isFinite(Number(doubleTeamRate))) {
    missing.pop();
  }

  if (pos === "WR" || pos === "TE" || pos === "QB") {
    if (targetShare == null) missing.push(TARGET_SHARE_MISSING);
  } else if (pos === "RB" && targetShare == null && rushShare == null) {
    missing.push(TARGET_SHARE_MISSING);
  }

  if (dropPct == null && pos !== "QB") missing.push(DROP_PCT_MISSING);
  if (pos === "QB" && dropPct == null) missing.push(DROP_PCT_MISSING);

  if (!Number.isFinite(Number(opponentPtsAllowed)) || !Number.isFinite(Number(opponentLeagueAvg))) {
    missing.push(OPPONENT_MISSING);
  }

  const points = Number.isFinite(Number(recentPoints))
    ? Number(recentPoints)
    : (Number.isFinite(Number(seasonPointsPerGame)) ? Number(seasonPointsPerGame) : null);
  if (points == null) {
    return {
      score: null,
      complete: false,
      missing: missing.includes(NO_RECENT_GAMES) ? missing : [...missing, NO_RECENT_GAMES],
      matchupMult: 1,
    };
  }

  const production = clamp(points / (PRODUCTION_ANCHOR[pos] || 14), 0, 2.4);
  const usage = startRoleFromUsage({
    position: pos,
    points,
    targetShare,
    rushShare,
  });
  const dropMult = dropPct == null ? 1 : clamp(1 - Number(dropPct) * 0.85, 0.72, 1);
  let matchupMult = 1;
  if (Number.isFinite(Number(opponentPtsAllowed)) && Number(opponentLeagueAvg) > 0) {
    matchupMult = clamp(Number(opponentPtsAllowed) / Number(opponentLeagueAvg), 0.72, 1.28);
  }
  const heatNudge = clamp((production - 1) * 14, -16, 12);
  const matchupNudge = (matchupMult - 1) * 36 * (1 - 0.58 * usage);
  const dropNudge = dropPct == null ? 0 : clamp(-Number(dropPct) * 22, -8, 0);
  const score = Math.round(clamp(
    START_CHANCE_BASE + START_CHANCE_ROLE_SPAN * usage + heatNudge + matchupNudge + dropNudge,
    1,
    WEEKLY_SCORE_MAX,
  ));
  return {
    score,
    complete: missing.length === 0,
    missing,
    production: points,
    usage,
    dropMult,
    matchupMult,
  };
}

export function opponentEase({ ptsAllowed, leagueAvg } = {}) {
  if (!Number.isFinite(Number(ptsAllowed)) || !Number.isFinite(Number(leagueAvg)) || Number(leagueAvg) <= 0) {
    return { score: null, label: "", ratio: null };
  }
  const ratio = Number(ptsAllowed) / Number(leagueAvg);
  const score = Math.round(clamp(50 + ((ratio - 1) / 0.28) * 50, 1, 99));
  const label = score >= 62 ? "Easy" : score <= 38 ? "Hard" : "Average";
  return { score, label, ratio };
}

function playerMetaMaps(players = {}) {
  const teamById = {};
  const positionById = {};
  Object.entries(players || {}).forEach(([playerId, raw]) => {
    teamById[playerId] = normalizeNflTeam(raw?.team);
    positionById[playerId] = weeklyPosition(raw?.position || raw?.fantasy_positions?.[0]);
  });
  return { teamById, positionById };
}

export function buildWeeklyContext({
  weekRows = [],
  schedule = { games: [] },
  players = {},
  season = "",
  week = 0,
} = {}) {
  const scheduleIndex = indexNflSchedule(schedule);
  const { teamById, positionById } = playerMetaMaps(players);
  const defenseWeeks = {};
  const passRates = {};
  const rows = Array.isArray(weekRows) ? weekRows : [];

  rows.forEach((row) => {
    const stats = row?.stats && typeof row.stats === "object" ? row.stats : {};
    const paired = opponentsFromTeamStats(stats);
    Object.entries(stats).forEach(([key, playerStats]) => {
      if (isTeamStatKey(key) || !playedNflGame(playerStats)) return;
      const team = teamById[key];
      const position = positionById[key];
      if (!team || !position) return;
      const scheduled = lookupScheduledOpponent(scheduleIndex, row.season, row.week, team);
      const opponent = scheduled.opponent || paired[team] || "";
      if (!opponent) return;
      const bucket = defenseWeeks[opponent] || (defenseWeeks[opponent] = {});
      const posWeek = bucket[position] || (bucket[position] = {});
      const weekKey = `${row.season}:${row.week}`;
      posWeek[weekKey] = (posWeek[weekKey] || 0) + (Number(playerStats.pts_ppr) || 0);
    });

    Object.entries(stats).forEach(([key, teamStats]) => {
      const team = teamFromStatKey(key);
      if (!team) return;
      const passFd = Number(teamStats?.opp_pass_fd);
      const rushFd = Number(teamStats?.opp_rush_fd);
      const allFd = Number(teamStats?.opp_fd) || ((Number.isFinite(passFd) ? passFd : 0) + (Number.isFinite(rushFd) ? rushFd : 0));
      if (!Number.isFinite(allFd) || allFd <= 0 || !Number.isFinite(passFd)) return;
      (passRates[team] || (passRates[team] = [])).push(passFd / allFd);
    });
  });

  const defense = {};
  Object.entries(defenseWeeks).forEach(([team, byPos]) => {
    defense[team] = {};
    Object.entries(byPos).forEach(([position, byWeek]) => {
      const games = Object.values(byWeek);
      defense[team][position] = {
        ptsAllowed: mean(games),
        games: games.length,
      };
    });
  });

  const leagueAvg = {};
  ["QB", "RB", "WR", "TE"].forEach((position) => {
    leagueAvg[position] = mean(
      Object.values(defense)
        .map((row) => row?.[position]?.ptsAllowed)
        .filter((value) => Number.isFinite(value))
    );
  });

  return {
    season: String(season || ""),
    week: Number(week) || 0,
    scheduleIndex,
    weekRows: rows,
    teamById,
    positionById,
    defense,
    leagueAvg,
    passRates: Object.fromEntries(
      Object.entries(passRates).map(([team, values]) => [team, mean(values)])
    ),
  };
}

function coverageLabel(passRate) {
  if (!Number.isFinite(passRate)) return "";
  if (passRate >= 0.58) return "pass-heavy";
  if (passRate <= 0.42) return "run-heavy";
  return "balanced";
}

function averageShare(games, key) {
  const rows = games.filter((game) => Number.isFinite(game[key]));
  if (!rows.length) return null;
  return mean(rows.map((game) => game[key]));
}

export function buildWeeklyPlayerModel({
  playerId,
  name,
  position,
  team,
  dynastyValue,
  seasonStats = {},
  context,
} = {}) {
  const pos = weeklyPosition(position);
  const teamKey = normalizeNflTeam(team);
  const id = String(playerId || "");
  const rows = context?.weekRows || [];
  const games = [];

  rows.forEach((row) => {
    const stats = row?.stats?.[id];
    if (!playedNflGame(stats)) return;
    const totals = teamTotalsFromWeek(row.stats, teamKey, context?.teamById);
    const scheduled = lookupScheduledOpponent(context?.scheduleIndex, row.season, row.week, teamKey);
    const paired = opponentsFromTeamStats(row.stats);
    const opponent = scheduled.opponent || paired[teamKey] || "";
    games.push({
      season: row.season,
      week: row.week,
      pts: statNumber(stats, "pts_ppr"),
      rec: statNumber(stats, "rec"),
      recTgt: statNumber(stats, "rec_tgt"),
      recDrop: statNumber(stats, "rec_drop"),
      rushAtt: statNumber(stats, "rush_att"),
      targetShare: targetShareFromStats(stats, totals),
      rushShare: rushShareFromStats(stats, totals),
      dropPct: dropPctFromStats(stats),
      opponent,
      bye: Boolean(scheduled.bye),
    });
  });

  const past = games.slice(0, WEEKLY_LOOKBACK_WEEKS);
  const recentPoints = mean(past.map((game) => game.pts).filter((value) => Number.isFinite(value)));
  const gp = statNumber(seasonStats, "gp") || statNumber(seasonStats, "gms_active");
  const seasonPts = statNumber(seasonStats, "pts_ppr");
  const seasonPointsPerGame = gp && gp > 0 && seasonPts != null ? seasonPts / gp : null;
  const targetShare = averageShare(past, "targetShare");
  const rushShare = averageShare(past, "rushShare");
  const dropPct = averageShare(past, "dropPct");

  const noTeam = !teamKey;
  const upcoming = noTeam
    ? { opponent: "", bye: false, missing: NOT_ON_TEAM, home: false }
    : lookupScheduledOpponent(context?.scheduleIndex, context?.season, context?.week, teamKey);
  const opponent = upcoming.opponent;
  const defense = opponent ? context?.defense?.[opponent]?.[pos] : null;
  const leagueAvg = pos ? context?.leagueAvg?.[pos] : null;
  const passRate = opponent ? context?.passRates?.[opponent] : null;
  const ease = noTeam
    ? { score: null, label: "", ratio: null }
    : opponentEase({ ptsAllowed: defense?.ptsAllowed, leagueAvg });

  const scored = noTeam
    ? { score: 0, complete: false, missing: [NOT_ON_TEAM], matchupMult: 1 }
    : scoreWeeklyValue({
        position: pos,
        recentPoints,
        seasonPointsPerGame,
        targetShare: pos === "QB" ? null : targetShare,
        rushShare,
        dropPct,
        opponentPtsAllowed: defense?.ptsAllowed,
        opponentLeagueAvg: leagueAvg,
        doubleTeamRate: null,
      });

  const opponentDetail = noTeam
    ? NOT_ON_TEAM
    : upcoming.bye
      ? "Bye week"
      : opponent
        ? [
            opponent,
            ease.label,
            Number.isFinite(defense?.ptsAllowed)
              ? `${defense.ptsAllowed.toFixed(1)} PPR allowed to ${pos || "this position"}`
              : "",
            coverageLabel(passRate),
          ].filter(Boolean).join(" · ")
        : OPPONENT_MISSING;

  return {
    playerId: id,
    name: name || "Player",
    position: pos || String(position || "").toUpperCase(),
    team: teamKey,
    dynastyValue: Number.isFinite(Number(dynastyValue)) ? Number(dynastyValue) : null,
    score: scored.score,
    complete: scored.complete,
    missing: scored.missing,
    bye: Boolean(upcoming.bye),
    noTeam,
    opponentMissing: !noTeam && !upcoming.bye && !opponent,
    upcomingHome: Boolean(upcoming.home),
    targetShare,
    rushShare,
    dropPct,
    recentPoints,
    seasonPointsPerGame,
    games: past,
    inputs: [
      {
        id: "opponent",
        label: "Opponent strength",
        value: noTeam ? "No team" : upcoming.bye ? "Bye" : (ease.label || "—"),
        detail: opponentDetail,
        missing: scored.missing.includes(NOT_ON_TEAM)
          ? NOT_ON_TEAM
          : scored.missing.includes(OPPONENT_MISSING) ? OPPONENT_MISSING : "",
        tone: ease.label === "Easy" ? "up" : ease.label === "Hard" ? "down" : "",
      },
      {
        id: "targetShare",
        label: "Target share",
        value: targetShare == null || pos === "QB" ? "—" : formatShare(targetShare),
        detail: targetShare == null || pos === "QB"
          ? TARGET_SHARE_MISSING
          : `${formatShare(targetShare)} of team targets over the last ${past.length} game${past.length === 1 ? "" : "s"}`,
        missing: scored.missing.includes(TARGET_SHARE_MISSING) ? TARGET_SHARE_MISSING : "",
      },
      {
        id: "dropPct",
        label: "Drop percentage",
        value: dropPct == null ? "—" : formatShare(dropPct),
        detail: dropPct == null ? DROP_PCT_MISSING : `${formatShare(dropPct)} of targets dropped`,
        missing: scored.missing.includes(DROP_PCT_MISSING) ? DROP_PCT_MISSING : "",
      },
      {
        id: "doubleTeam",
        label: "Double-team rate",
        value: "—",
        detail: DOUBLE_TEAM_MISSING,
        missing: DOUBLE_TEAM_MISSING,
      },
    ],
    upcomingOpponent: opponent,
    opponentEase: ease,
  };
}

export function formatShare(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "";
  const pct = numeric * 100;
  const digits = Math.abs(pct) >= 10 ? 0 : 1;
  return `${pct.toFixed(digits)}%`;
}

export function formatWeeklyPoints(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "—";
  return numeric.toLocaleString("en-US", { maximumFractionDigits: 1, minimumFractionDigits: 0 });
}

export function formatWeeklyScore(score) {
  if (score == null || !Number.isFinite(Number(score))) return "—";
  return `${Math.round(Number(score))}%`;
}

export function weeklyScoreParts(score) {
  if (score == null || !Number.isFinite(Number(score))) {
    return { value: "—", max: "" };
  }
  return { value: String(Math.round(Number(score))), max: "%" };
}

export function weeklyScoreSuppressed(model) {
  return Boolean(model?.bye || model?.opponentMissing);
}

export function weeklyScoreChipLabel(model) {
  if (weeklyScoreSuppressed(model)) return "—";
  return formatWeeklyScore(model?.score);
}

export function renderWeeklyPlayerSheet(model, { helpOpen = false } = {}) {
  if (!model) return "";
  const missingNote = model.complete
    ? "Every usage and matchup input is in."
    : `Missing: ${model.missing.join(", ")}.`;
  const parts = weeklyScoreSuppressed(model)
    ? { value: "—", max: "" }
    : weeklyScoreParts(model.score);
  const dynasty = model.dynastyValue == null ? "—" : formatNumber(Math.round(model.dynastyValue));
  const games = (model.games || []).map((game) => {
    const bits = [
      Number.isFinite(game.pts) ? `${formatWeeklyPoints(game.pts)} PPR` : "",
      Number.isFinite(game.recTgt) ? `${game.recTgt} tgt` : "",
      Number.isFinite(game.recDrop) ? `${game.recDrop} drop` : "",
      game.opponent ? `vs ${game.opponent}` : "",
    ].filter(Boolean);
    return `
      <li class="week-game">
        <span>W${escapeHtml(String(game.week))}</span>
        <strong>${escapeHtml(bits.join(" · ") || "played")}</strong>
      </li>
    `;
  }).join("");

  return `
    <article class="player-week-sheet" data-player-id="${escapeHtml(model.playerId)}">
      <header class="player-week-head">
        <div>
          <span class="player-week-kicker">
            <span class="eyebrow">This week</span>
            ${renderWeeklyScoreHelpButton({ open: helpOpen })}
          </span>
          <h3>${escapeHtml(model.name)}</h3>
          <p class="muted small">${escapeHtml([model.position, model.team].filter(Boolean).join(" · "))}</p>
        </div>
        <div class="player-week-scores">
          <div class="weekly-score-badge" title="Chance you should start them this week. Not dynasty value.">
            <small>${WEEKLY_SCORE_LABEL}</small>
            <strong>${escapeHtml(parts.value)}${parts.max ? `<span class="weekly-score-max">${escapeHtml(parts.max)}</span>` : ""}</strong>
          </div>
          <div class="dynasty-value-badge" title="Market dynasty value, not this week’s start chance">
            <small>${DYNASTY_SCORE_LABEL}</small>
            <strong>${escapeHtml(dynasty)}</strong>
          </div>
        </div>
      </header>
      <p class="player-week-note">${escapeHtml(WEEKLY_SCORE_HINT)}</p>
      <p class="player-week-missing muted small">${escapeHtml(missingNote)}</p>
      <div class="week-input-grid">
        ${model.inputs.map((input) => `
          <section class="week-input ${input.missing ? "missing" : ""} ${input.tone || ""}" data-week-input="${escapeHtml(input.id)}">
            <span>${escapeHtml(input.label)}</span>
            <strong>${escapeHtml(input.value)}</strong>
            <small>${escapeHtml(input.missing || input.detail)}</small>
          </section>
        `).join("")}
      </div>
      <div class="week-games">
        <h4>Past games</h4>
        ${games
          ? `<ol>${games}</ol>`
          : `<p class="muted small">${escapeHtml(NO_RECENT_GAMES)}</p>`}
        ${Number.isFinite(model.seasonPointsPerGame)
          ? `<p class="muted small">Season ${escapeHtml(formatWeeklyPoints(model.seasonPointsPerGame))} PPR/game.</p>`
          : ""}
      </div>
      <button type="button" class="ghost-btn week-sheet-close" data-action="close-player">Close player</button>
    </article>
  `;
}

export async function fetchNflSchedule(fetchImpl = globalThis.fetch) {
  try {
    const response = await fetchImpl(NFL_SCHEDULE_PATH, { cache: "no-store" });
    if (!response?.ok) return { games: [] };
    const payload = await response.json();
    return payload && typeof payload === "object" ? payload : { games: [] };
  } catch {
    return { games: [] };
  }
}

export async function loadWeeklyStatWeeks({
  apiGet,
  season,
  week,
  previousSeason,
} = {}) {
  const wanted = weeksForWeeklyValue({ season, week, previousSeason });
  const rows = await Promise.all(wanted.map(async (item) => {
    try {
      const stats = await apiGet(
        `/stats/nfl/regular/${encodeURIComponent(item.season)}/${encodeURIComponent(item.week)}`,
        { timeoutMs: 20000 }
      );
      return { ...item, stats: stats && typeof stats === "object" ? stats : {} };
    } catch {
      return { ...item, stats: {} };
    }
  }));
  return rows;
}
