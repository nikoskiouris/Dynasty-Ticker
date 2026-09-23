// Season engine: standings, luck, awards, record book, win probability, and playoff simulation.
// Pure functions only. Everything here takes raw Sleeper payloads (league, rosters, users,
// weekly matchup rows) and returns plain objects the UI can render.

const DEFAULT_PLAYOFF_TEAMS = 6;
const DEFAULT_PLAYOFF_START = 15;
const SIM_PRIOR_WEIGHT = 6;
const SIM_MIN_STD = 20;
const SIM_SEASON_DRIFT = 0.42;
const SIM_DEFAULT_ITERATIONS = 4000;
const SIM_UNLOCKED_FLOOR = 0.1;
const SIM_UNLOCKED_CEILING = 99.9;

export function buildSeasonModel({ league, rosters = [], users = [], weekRows = new Map(), nflState = null, optimalPoints = null }) {
  const settings = league?.settings || {};
  const startWeek = Math.max(1, Number(settings.start_week) || 1);
  const playoffStart = Number(settings.playoff_week_start) || DEFAULT_PLAYOFF_START;
  const playoffTeams = Number(settings.playoff_teams) || DEFAULT_PLAYOFF_TEAMS;
  const rounds = computePlayoffRounds(playoffTeams, Number(settings.playoff_round_type) || 0);
  const regularWeeks = range(startWeek, playoffStart - 1);
  const playoffWeeks = range(playoffStart, playoffStart + rounds - 1);
  const weekState = resolveWeekState(league, nflState, weekRows, playoffStart + rounds - 1);
  const divisionCount = Number(settings.divisions) || 0;
  const medianGames = Number(settings.league_average_match) === 1;
  const userById = new Map(users.map((user) => [String(user.user_id), user]));

  const teams = new Map();
  rosters.forEach((roster) => {
    const rosterId = String(roster.roster_id);
    const user = roster.owner_id != null ? userById.get(String(roster.owner_id)) : null;
    const division = Number(roster?.settings?.division) || 0;
    teams.set(rosterId, {
      rosterId,
      ownerId: roster.owner_id != null ? String(roster.owner_id) : "",
      name: user?.display_name || user?.username || `Roster ${rosterId}`,
      teamName: user?.metadata?.team_name || "",
      avatar: user?.avatar || null,
      division,
      divisionName: divisionCount > 0 ? String(league?.metadata?.[`division_${division}`] || `Division ${division}`) : "",
      wins: 0,
      losses: 0,
      ties: 0,
      pf: 0,
      pa: 0,
      medianWins: 0,
      medianLosses: 0,
      scores: [],
      results: [],
      allPlayWins: 0,
      allPlayLosses: 0,
      allPlayTies: 0,
      expectedWins: 0,
      high: null,
      low: null,
      benchPoints: 0,
      sleeperRecord: {
        wins: Number(roster?.settings?.wins || 0),
        losses: Number(roster?.settings?.losses || 0),
        ties: Number(roster?.settings?.ties || 0),
        pf: decimalStat(roster, "fpts", "fpts_decimal"),
        pa: decimalStat(roster, "fpts_against", "fpts_against_decimal"),
        ppts: decimalStat(roster, "ppts", "ppts_decimal"),
      },
    });
  });

  const weeks = [];
  [...regularWeeks, ...playoffWeeks].forEach((week) => {
    const rows = dedupeWeekRows(Array.isArray(weekRows.get(week)) ? weekRows.get(week) : []);
    const { games, byes } = groupGames(rows, teams);
    const isPlayoff = week >= playoffStart;
    const isFinal = week <= weekState.finalThroughWeek;
    const hasPoints = rows.some((row) => matchupPoints(row) > 0);
    const isCurrent = !isFinal && week === weekState.currentWeek;
    weeks.push({
      week,
      games,
      byes,
      isPlayoff,
      isFinal,
      isCurrent,
      hasPoints,
      isLive: isCurrent && hasPoints,
      status: isFinal ? "final" : isCurrent ? (hasPoints ? "live" : "current") : week < weekState.currentWeek ? "final" : "upcoming",
      label: isPlayoff ? `Week ${week} · Playoffs` : `Week ${week}`,
    });
  });

  weeks.filter((entry) => entry.isFinal && !entry.isPlayoff && entry.hasPoints).forEach((entry) => {
    const weekScores = [];
    entry.games.forEach((game) => {
      const [left, right] = game.sides;
      const leftTeam = teams.get(left.rosterId);
      const rightTeam = teams.get(right.rosterId);
      if (!leftTeam || !rightTeam) return;
      applyResult(leftTeam, rightTeam, left.points, right.points, entry.week);
      applyResult(rightTeam, leftTeam, right.points, left.points, entry.week);
      weekScores.push({ rosterId: left.rosterId, points: left.points });
      weekScores.push({ rosterId: right.rosterId, points: right.points });
      if (typeof optimalPoints === "function") {
        [[leftTeam, left], [rightTeam, right]].forEach(([team, side]) => {
          const optimal = optimalPoints(side);
          if (Number.isFinite(optimal) && optimal > side.points) team.benchPoints += optimal - side.points;
        });
      }
    });
    entry.byes.forEach((side) => {
      const team = teams.get(side.rosterId);
      if (team && Number.isFinite(side.points) && side.points > 0) {
        weekScores.push({ rosterId: side.rosterId, points: side.points });
      }
    });

    weekScores.forEach((score) => {
      const team = teams.get(score.rosterId);
      if (!team) return;
      let wins = 0;
      let losses = 0;
      let ties = 0;
      weekScores.forEach((other) => {
        if (other.rosterId === score.rosterId) return;
        if (score.points > other.points) wins += 1;
        else if (score.points < other.points) losses += 1;
        else ties += 1;
      });
      team.allPlayWins += wins;
      team.allPlayLosses += losses;
      team.allPlayTies += ties;
      const opponents = wins + losses + ties;
      if (opponents > 0) team.expectedWins += (wins + ties / 2) / opponents;
    });

    if (medianGames && weekScores.length >= 2) {
      const medianValue = median(weekScores.map((score) => score.points));
      weekScores.forEach((score) => {
        const team = teams.get(score.rosterId);
        if (!team) return;
        if (score.points > medianValue) {
          team.medianWins += 1;
          team.wins += 1;
        } else if (score.points < medianValue) {
          team.medianLosses += 1;
          team.losses += 1;
        } else {
          team.ties += 1;
        }
      });
    }
  });

  const finalRegularWeeks = weeks.filter((entry) => entry.isFinal && !entry.isPlayoff).length;
  const hasComputedGames = finalRegularWeeks > 0 && [...teams.values()].some((team) => team.scores.length > 0);

  teams.forEach((team) => {
    if (!hasComputedGames) {
      team.wins = team.sleeperRecord.wins;
      team.losses = team.sleeperRecord.losses;
      team.ties = team.sleeperRecord.ties;
      team.pf = team.sleeperRecord.pf;
      team.pa = team.sleeperRecord.pa;
    }
    const gamesPlayed = team.scores.length;
    team.gamesPlayed = gamesPlayed;
    team.avg = gamesPlayed ? team.pf / gamesPlayed : 0;
    team.std = gamesPlayed > 1 ? standardDeviation(team.scores) : 0;
    team.allPlayGames = team.allPlayWins + team.allPlayLosses + team.allPlayTies;
    team.expectedWins = round2(team.expectedWins || 0);
    team.headToHeadWins = team.results.filter((result) => result.result === "W").length;
    team.luck = gamesPlayed ? round2(team.headToHeadWins - team.expectedWins) : 0;
    team.allPlayRecord = `${team.allPlayWins}-${team.allPlayLosses}${team.allPlayTies ? `-${team.allPlayTies}` : ""}`;
    team.allPlayPct = team.allPlayGames ? (team.allPlayWins + team.allPlayTies / 2) / team.allPlayGames : 0;
    team.recordLabel = formatRecord(team);
    team.streak = computeStreak(team.results);
    team.pointsLeftOnBench = round2(team.benchPoints);
  });

  const standings = [...teams.values()].sort(compareStandings);
  standings.forEach((team, index) => {
    team.rank = index + 1;
  });

  const divisions = buildDivisions(standings, divisionCount);
  const seedOrder = seedTeams(standings, {
    divisionCount,
    playoffTeams,
    seedType: Number(settings.playoff_seed_type) || 0,
  });
  seedOrder.forEach((rosterId, index) => {
    const team = teams.get(rosterId);
    if (team) team.seed = index + 1;
  });

  const remainingGames = weeks
    .filter((entry) => !entry.isFinal && !entry.isPlayoff)
    .flatMap((entry) => entry.games.map((game) => ({ week: entry.week, game })));
  // A missing week, or a future week Sleeper has not scheduled yet, is not
  // "zero games left". Locks and the Monte Carlo both read remainingGames.
  const scheduleIncomplete = weeks.some((entry) => {
    if (entry.isPlayoff || entry.isFinal) return false;
    if (!weekRows.has(entry.week)) return true;
    return entry.games.length === 0 && entry.byes.length === 0;
  });
  const leagueScores = standings.flatMap((team) => team.scores);
  const currentWeekEntry = weeks.find((entry) => entry.isCurrent)
    || weeks.find((entry) => entry.week === weekState.currentWeek)
    || null;
  const latestFinalWeek = weeks.filter((entry) => entry.isFinal && entry.hasPoints).slice(-1)[0] || null;
  const featuredWeek = currentWeekEntry?.hasPoints ? currentWeekEntry : latestFinalWeek || currentWeekEntry || weeks[0] || null;

  return {
    leagueId: String(league?.league_id || ""),
    season: String(league?.season || ""),
    status: String(league?.status || ""),
    currentWeek: weekState.currentWeek,
    finalThroughWeek: weekState.finalThroughWeek,
    seasonComplete: weekState.seasonComplete,
    regularSeasonComplete: weekState.finalThroughWeek >= playoffStart - 1,
    playoffsStarted: weekState.currentWeek >= playoffStart || weekState.finalThroughWeek >= playoffStart,
    startWeek,
    playoffStart,
    playoffTeams,
    playoffRounds: rounds,
    regularWeeks,
    playoffWeeks,
    weeks,
    teams,
    standings,
    divisions,
    divisionCount,
    medianGames,
    seedType: Number(settings.playoff_seed_type) || 0,
    seedOrder,
    remainingGames,
    finalRegularWeeks,
    hasComputedGames,
    leagueAverage: leagueScores.length ? average(leagueScores) : 0,
    leagueStd: leagueScores.length > 1 ? standardDeviation(leagueScores) : 0,
    currentWeekEntry,
    latestFinalWeek,
    featuredWeek,
    weeksLoaded: weekRows.size,
    scheduleIncomplete,
  };
}

export function getWeekEntry(model, week) {
  return model?.weeks?.find((entry) => entry.week === Number(week)) || null;
}

export function blendSimPrior({ baseline, previousPpg = null, valuePercentile = 0.5 } = {}) {
  const base = Number(baseline) > 0 ? Number(baseline) : 125;
  const percentile = Number.isFinite(Number(valuePercentile)) ? Number(valuePercentile) : 0.5;
  const valueMean = base * (0.94 + 0.12 * percentile);
  const shrunkPrev = previousPpg != null && Number.isFinite(Number(previousPpg))
    ? base + (Number(previousPpg) - base) * 0.35
    : null;
  const mixed = shrunkPrev != null ? valueMean * 0.45 + shrunkPrev * 0.55 : valueMean;
  return {
    mean: base + (mixed - base) * 0.7,
    std: Math.max(24, base * 0.22),
  };
}

export function buildTeamDistributions(model, priors = new Map(), { priorWeight = SIM_PRIOR_WEIGHT } = {}) {
  const distributions = new Map();
  const leagueAverage = model.leagueAverage || 0;
  model.standings.forEach((team) => {
    const prior = priors.get(team.rosterId) || null;
    const fallbackMean = leagueAverage || prior?.mean || 120;
    const priorMean = Number.isFinite(prior?.mean) ? prior.mean : fallbackMean;
    const priorStd = Number.isFinite(prior?.std) ? prior.std : Math.max(SIM_MIN_STD, fallbackMean * 0.18);
    const n = team.scores.length;
    const sampleMean = n ? average(team.scores) : priorMean;
    const sampleStd = n > 1 ? standardDeviation(team.scores) : priorStd;
    const mean = (priorWeight * priorMean + n * sampleMean) / (priorWeight + n);
    const std = Math.max(
      SIM_MIN_STD,
      (priorWeight * priorStd + Math.max(0, n - 1) * sampleStd) / (priorWeight + Math.max(0, n - 1))
    );
    const posteriorMeanStd = std / Math.sqrt(priorWeight + n);
    const seasonDriftStd = std * SIM_SEASON_DRIFT / Math.sqrt(1 + n);
    const meanStd = Math.sqrt(posteriorMeanStd ** 2 + seasonDriftStd ** 2);
    const predictiveStd = Math.sqrt(std ** 2 + meanStd ** 2);
    distributions.set(team.rosterId, {
      mean,
      std,
      meanStd,
      predictiveStd,
      sampleMean,
      sampleStd,
      n,
      priorMean,
      priorStd,
      priorWeight,
    });
  });
  return distributions;
}

export function winProbability(distA, distB) {
  if (!distA || !distB) return 0.5;
  const stdA = Number(distA.predictiveStd) || Number(distA.std) || 1;
  const stdB = Number(distB.predictiveStd) || Number(distB.std) || 1;
  const spread = Math.sqrt(stdA ** 2 + stdB ** 2) || 1;
  return normalCdf((distA.mean - distB.mean) / spread);
}

export function playoffLockStatus(model) {
  const clinched = new Set();
  const eliminated = new Set();
  const teams = model?.standings || [];
  if (teams.length < 2 || model.scheduleIncomplete) return { clinched, eliminated };
  const playoffTeams = Math.min(Number(model.playoffTeams) || DEFAULT_PLAYOFF_TEAMS, teams.length);
  const remainingByTeam = new Map(teams.map((team) => [String(team.rosterId), 0]));
  (model.remainingGames || []).forEach(({ game }) => {
    const sides = game?.sides || [];
    sides.slice(0, 2).forEach((side) => {
      const rosterId = String(side?.rosterId || "");
      if (!remainingByTeam.has(rosterId)) return;
      remainingByTeam.set(rosterId, remainingByTeam.get(rosterId) + 1);
    });
  });
  const rows = teams.map((team) => {
    const remaining = remainingByTeam.get(String(team.rosterId)) || 0;
    const winPts = Number(team.wins || 0) + 0.5 * Number(team.ties || 0);
    return {
      rosterId: String(team.rosterId),
      division: Number(team.division) || 0,
      minWins: winPts,
      maxWins: winPts + remaining,
    };
  });
  const remainingGameCount = (model.remainingGames || []).length;

  if (remainingGameCount === 0) {
    const seeds = new Set((model.seedOrder || []).slice(0, playoffTeams).map(String));
    rows.forEach((row) => {
      if (seeds.has(row.rosterId)) clinched.add(row.rosterId);
      else eliminated.add(row.rosterId);
    });
    return { clinched, eliminated };
  }

  rows.forEach((team) => {
    const others = rows.filter((row) => row.rosterId !== team.rosterId);
    const canCatch = others.filter((row) => row.maxWins >= team.minWins).length;
    if (canCatch < playoffTeams) clinched.add(team.rosterId);
    const uncatchable = others.filter((row) => row.minWins > team.maxWins).length;
    if (uncatchable >= playoffTeams) eliminated.add(team.rosterId);
  });

  if ((Number(model.divisionCount) || 0) > 1 && Number(model.seedType) !== 2) {
    rows.forEach((team) => {
      if (clinched.has(team.rosterId) || !team.division) return;
      const rivals = rows.filter((row) => row.division === team.division && row.rosterId !== team.rosterId);
      if (rivals.length > 0 && rivals.every((row) => row.maxWins < team.minWins)) clinched.add(team.rosterId);
    });
  }

  eliminated.forEach((rosterId) => {
    if (clinched.has(rosterId)) eliminated.delete(rosterId);
  });
  return { clinched, eliminated };
}

export function formatOddsPct(value) {
  if (!Number.isFinite(Number(value))) return "—";
  const numeric = Number(value);
  if (numeric <= 0) return "0%";
  if (numeric < 1) return "<1%";
  if (numeric >= 100) return "100%";
  if (numeric > 99) return ">99%";
  return `${Math.round(numeric)}%`;
}

export function simulateSeason(model, { priors = new Map(), iterations = SIM_DEFAULT_ITERATIONS, seed = 7 } = {}) {
  if (!model || model.scheduleIncomplete || model.standings.length < 2) return null;
  const distributions = buildTeamDistributions(model, priors);
  const rng = mulberry32(seed);
  const teams = model.standings;
  const teamIndex = new Map(teams.map((team, index) => [team.rosterId, index]));
  const playoffTeams = Math.min(model.playoffTeams, teams.length);
  const byeCount = bracketByeCount(playoffTeams);
  const seedType = Number(model.seedType) || 0;
  const remaining = model.remainingGames
    .map(({ game }) => [teamIndex.get(game.sides[0].rosterId), teamIndex.get(game.sides[1].rosterId)])
    .filter(([a, b]) => Number.isInteger(a) && Number.isInteger(b));
  const playoffsDecided = model.seasonComplete;
  // Draw a season-long talent for each roster so remaining weeks do not
  // collapse a small scoring edge into a fake 100% lock.
  const totals = teams.map(() => ({
    playoffs: 0,
    bye: 0,
    division: 0,
    finals: 0,
    title: 0,
    wins: 0,
    seedSum: 0,
    seedCounts: new Array(playoffTeams + 1).fill(0),
    topSeed: 0,
    lastPlace: 0,
  }));
  const dist = teams.map((team) => distributions.get(team.rosterId));
  const runs = playoffsDecided ? 1 : iterations;
  const locks = playoffLockStatus(model);

  for (let iteration = 0; iteration < runs; iteration += 1) {
    const wins = teams.map((team) => team.wins);
    const ties = teams.map((team) => team.ties);
    const pf = teams.map((team) => team.pf);
    const seasonMeans = dist.map((row) => randomNormal(rng, row.mean, row.meanStd || 0));
    remaining.forEach(([a, b]) => {
      const scoreA = randomNormal(rng, seasonMeans[a], dist[a].std);
      const scoreB = randomNormal(rng, seasonMeans[b], dist[b].std);
      pf[a] += scoreA;
      pf[b] += scoreB;
      if (scoreA > scoreB) wins[a] += 1;
      else if (scoreB > scoreA) wins[b] += 1;
      else {
        ties[a] += 1;
        ties[b] += 1;
      }
    });

    const rows = teams.map((team, index) => ({
      rosterId: team.rosterId,
      index,
      wins: wins[index],
      ties: ties[index],
      pf: pf[index],
      division: team.division,
    }));
    const ordered = rows.slice().sort(compareStandings);
    const seeds = seedTeams(ordered, { divisionCount: model.divisionCount, playoffTeams, seedType });
    const divisionWinners = model.divisionCount > 1 ? pickDivisionWinners(ordered, model.divisionCount) : [];

    ordered.forEach((row, position) => {
      totals[row.index].wins += row.wins;
      if (position === ordered.length - 1) totals[row.index].lastPlace += 1;
    });
    divisionWinners.forEach((rosterId) => {
      totals[teamIndex.get(rosterId)].division += 1;
    });
    seeds.forEach((rosterId, seedIndex) => {
      const bucket = totals[teamIndex.get(rosterId)];
      bucket.playoffs += 1;
      bucket.seedSum += seedIndex + 1;
      bucket.seedCounts[seedIndex + 1] += 1;
      if (seedIndex === 0) bucket.topSeed += 1;
      if (seedIndex < byeCount) bucket.bye += 1;
    });

    const bracket = simulateBracket(
      seeds.map((rosterId) => teamIndex.get(rosterId)),
      dist,
      rng,
      seasonMeans
    );
    if (bracket.champion != null) totals[bracket.champion].title += 1;
    if (bracket.finalists) bracket.finalists.forEach((index) => { totals[index].finals += 1; });
  }

  const results = teams.map((team, index) => {
    const bucket = totals[index];
    const pct = (value) => round1((value / runs) * 100);
    const isClinched = locks.clinched.has(String(team.rosterId));
    const isEliminated = locks.eliminated.has(String(team.rosterId));
    const rawPlayoff = (bucket.playoffs / runs) * 100;
    const rawTitle = (bucket.title / runs) * 100;
    const playoffPct = isClinched
      ? 100
      : isEliminated
        ? 0
        : round1(Math.min(SIM_UNLOCKED_CEILING, Math.max(SIM_UNLOCKED_FLOOR, rawPlayoff)));
    const titlePct = playoffsDecided
      ? round1(rawTitle)
      : round1(Math.min(SIM_UNLOCKED_CEILING, Math.max(0, rawTitle)));
    return {
      rosterId: team.rosterId,
      name: team.name,
      playoffPct,
      byePct: pct(bucket.bye),
      divisionPct: pct(bucket.division),
      finalsPct: pct(bucket.finals),
      titlePct,
      topSeedPct: pct(bucket.topSeed),
      lastPlacePct: pct(bucket.lastPlace),
      projectedWins: round1(bucket.wins / runs),
      averageSeed: bucket.playoffs ? round1(bucket.seedSum / bucket.playoffs) : null,
      seedDistribution: bucket.seedCounts.map((count) => round1((count / runs) * 100)),
      distribution: distributions.get(team.rosterId),
      clinched: isClinched,
      eliminated: isEliminated,
    };
  });

  return {
    iterations: runs,
    playoffTeams,
    byeCount,
    remainingGameCount: remaining.length,
    results: results.sort((a, b) => b.titlePct - a.titlePct || b.playoffPct - a.playoffPct || b.projectedWins - a.projectedWins),
    byRosterId: new Map(results.map((result) => [result.rosterId, result])),
    distributions,
  };
}

export function resolveUpcomingWeekEntry(model) {
  if (!model?.weeks?.length) return null;
  const current = model.currentWeekEntry;
  if (current && current.status !== "final" && current.games?.length) return current;
  return model.weeks.find((entry) => entry.status === "upcoming" && entry.games?.length) || null;
}

function gaussianKernel(x, mu, sigma) {
  const width = Math.max(Number(sigma) || 0.01, 0.01);
  const z = (Number(x) - Number(mu)) / width;
  return Math.exp(-0.5 * z * z);
}

function logisticPdf(x, scale = 1.15) {
  const s = Math.max(Number(scale) || 0.2, 0.2);
  const z = Number(x) / s;
  const e = Math.exp(Math.min(40, Math.max(-40, -z)));
  return e / ((1 + e) ** 2) / s;
}

function playoffWinCutoff(model, sim) {
  const rows = [...(sim?.results || [])].sort((a, b) => (
    Number(b.projectedWins) - Number(a.projectedWins)
    || Number(b.playoffPct) - Number(a.playoffPct)
  ));
  const cutIndex = Math.max(0, Math.min(rows.length - 1, (model?.playoffTeams || 6) - 1));
  return Number(rows[cutIndex]?.projectedWins);
}

function bubbleIndex(simRow) {
  const playoff = Math.max(0, Math.min(1, (Number(simRow?.playoffPct) || 0) / 100));
  const title = Math.max(0, Math.min(1, (Number(simRow?.titlePct) || 0) / 100));
  return 4 * playoff * (1 - playoff) + 2.4 * title * (1 - title);
}

export function scoreUpcomingWeekAngles(model, sim = null, { weekEntry = null } = {}) {
  const entry = weekEntry || resolveUpcomingWeekEntry(model);
  const empty = {
    week: entry?.week ?? null,
    label: entry?.label || "",
    status: entry?.status || "",
    darkHorses: [],
    trapGames: [],
    leverageGames: [],
    tossUps: [],
    cards: [],
  };
  if (!model || !entry || entry.status === "final" || !Array.isArray(entry.games) || entry.games.length === 0) {
    return empty;
  }

  const distributions = sim?.distributions || buildTeamDistributions(model);
  const byRoster = sim?.byRosterId || new Map();
  const cutoff = playoffWinCutoff(model, sim);
  const darkHorses = [];
  const trapGames = [];
  const leverageGames = [];
  const tossUps = [];

  entry.games.forEach((game) => {
    const sides = game?.sides || [];
    if (sides.length < 2) return;
    const left = sides[0];
    const right = sides[1];
    const distA = distributions.get(String(left.rosterId)) || distributions.get(left.rosterId);
    const distB = distributions.get(String(right.rosterId)) || distributions.get(right.rosterId);
    if (!distA || !distB) return;

    const pLeft = winProbability(distA, distB);
    const pRight = 1 - pLeft;
    const underIsLeft = pLeft <= pRight;
    const under = {
      side: underIsLeft ? left : right,
      dist: underIsLeft ? distA : distB,
      p: underIsLeft ? pLeft : pRight,
    };
    const fav = {
      side: underIsLeft ? right : left,
      dist: underIsLeft ? distB : distA,
      p: underIsLeft ? pRight : pLeft,
    };

    const spread = Math.sqrt((Number(distA.std) || 16) ** 2 + (Number(distB.std) || 16) ** 2) || 1;
    const zSpread = Math.abs(Number(distA.mean) - Number(distB.mean)) / spread;
    const overlapDensity = normalPdf(zSpread) / spread;
    const boomZ = (Number(fav.dist.mean) - Number(under.dist.mean)) / Math.max(Number(under.dist.std) || 1, 1);
    const boomReach = 1 - normalCdf(boomZ);
    const volShare = Number(under.dist.std) / Math.max(Number(under.dist.std) + Number(fav.dist.std), 1);

    const underTeam = model.teams.get(String(under.side.rosterId));
    const favTeam = model.teams.get(String(fav.side.rosterId));
    const underSim = byRoster.get(String(under.side.rosterId));
    const favSim = byRoster.get(String(fav.side.rosterId));
    const luck = Number(underTeam?.luck) || 0;
    const luckRev = luck < 0 ? Math.min(1, Math.abs(luck) / 2.5) : Math.max(-0.2, -luck / 5);
    const streak = underTeam?.streak;
    const heat = streak?.type === "W"
      ? Math.min(1, Number(streak.length) / 4)
      : streak?.type === "L"
        ? -0.08 * Math.min(1, Number(streak.length) / 4)
        : 0;

    const underCutoffGap = Number.isFinite(cutoff) && Number.isFinite(Number(underSim?.projectedWins))
      ? Number(underSim.projectedWins) - cutoff
      : 0;
    const favCutoffGap = Number.isFinite(cutoff) && Number.isFinite(Number(favSim?.projectedWins))
      ? Number(favSim.projectedWins) - cutoff
      : 0;
    const underLeverage = logisticPdf(underCutoffGap) * (1 - under.p) + 0.35 * bubbleIndex(underSim);
    const favLeverage = logisticPdf(favCutoffGap) * (1 - fav.p) + 0.2 * bubbleIndex(favSim);
    const gameLeverage = underLeverage + favLeverage * 0.55;

    const horseKernel = under.p >= 0.14 && under.p < 0.45
      ? gaussianKernel(under.p, 0.30, 0.09)
      : 0;
    const horseScore = horseKernel
      ? horseKernel * (
        0.32
        + 0.22 * boomReach
        + 0.14 * Math.min(1, volShare * 2)
        + 0.14 * Math.min(1, overlapDensity * 80)
        + 0.12 * Math.min(1, underLeverage)
        + 0.08 * luckRev
        + 0.06 * heat
      )
      : 0;

    const trapKernel = fav.p >= 0.56 && fav.p <= 0.84 ? gaussianKernel(fav.p, 0.66, 0.10) : 0;
    const trapScore = trapKernel * (0.4 * boomReach + 0.35 * volShare + 0.25 * Math.min(1, overlapDensity * 70));

    const tossScore = under.p >= 0.45 && under.p <= 0.5
      ? (0.55 + 10 * (under.p - 0.45)) * Math.min(1, overlapDensity * 90)
      : 0;

    const matchupId = game.matchupId ?? `${left.rosterId}-${right.rosterId}`;
    const underName = underTeam?.name || `Roster ${under.side.rosterId}`;
    const favName = favTeam?.name || `Roster ${fav.side.rosterId}`;
    const winLabel = `${Math.round(under.p * 100)}%`;
    const favWinLabel = `${Math.round(fav.p * 100)}%`;

    if (horseScore > 0) {
      darkHorses.push({
        kind: "dark-horse",
        title: "Dark horse",
        rosterId: String(under.side.rosterId),
        teamName: underName,
        opponentRosterId: String(fav.side.rosterId),
        opponentName: favName,
        winPct: under.p * 100,
        valueLabel: winLabel,
        detail: `${winLabel} by scoring-profile sim to beat ${favName}. Boom tail, playoff bubble, and all-play luck — not roster KTC.`,
        tone: "gold",
        score: horseScore,
        matchupId,
      });
    }

    if (trapScore > 0.04) {
      trapGames.push({
        kind: "trap",
        title: "Trap game",
        rosterId: String(fav.side.rosterId),
        teamName: favName,
        opponentRosterId: String(under.side.rosterId),
        opponentName: underName,
        winPct: fav.p * 100,
        valueLabel: favWinLabel,
        detail: `${favName} is the model favorite (${favWinLabel}) but ${underName} has a fat scoring tail. Pre-game distributions, not market value.`,
        tone: "rose",
        score: trapScore,
        matchupId,
      });
    }

    if (gameLeverage > 0.04 && Number.isFinite(cutoff)) {
      const bubbleTeam = bubbleIndex(underSim) >= bubbleIndex(favSim) ? under : fav;
      const bubbleTeamRow = bubbleTeam === under ? underTeam : favTeam;
      const bubbleP = bubbleTeam.p;
      leverageGames.push({
        kind: "leverage",
        title: "Highest leverage",
        rosterId: String(bubbleTeam.side.rosterId),
        teamName: bubbleTeamRow?.name || `Roster ${bubbleTeam.side.rosterId}`,
        opponentRosterId: String(bubbleTeam === under ? fav.side.rosterId : under.side.rosterId),
        opponentName: bubbleTeam === under ? favName : underName,
        winPct: bubbleP * 100,
        valueLabel: `${Math.round(bubbleP * 100)}%`,
        detail: `Monte Carlo projected wins sit on the playoff cut. This kickoff moves playoff and title odds more than a typical game.`,
        tone: "blue",
        score: gameLeverage,
        matchupId,
      });
    }

    if (tossScore > 0) {
      tossUps.push({
        kind: "toss-up",
        title: "Coin flip",
        rosterId: String(left.rosterId),
        teamName: model.teams.get(String(left.rosterId))?.name || `Roster ${left.rosterId}`,
        opponentRosterId: String(right.rosterId),
        opponentName: model.teams.get(String(right.rosterId))?.name || `Roster ${right.rosterId}`,
        winPct: Math.min(pLeft, pRight) * 100,
        valueLabel: `${Math.round(Math.min(pLeft, pRight) * 100)}-${Math.round(Math.max(pLeft, pRight) * 100)}`,
        detail: "Scoring distributions overlap almost completely. The Gaussian win model calls this a toss-up.",
        tone: "green",
        score: tossScore,
        matchupId,
      });
    }
  });

  darkHorses.sort((a, b) => b.score - a.score || a.winPct - b.winPct);
  trapGames.sort((a, b) => b.score - a.score);
  leverageGames.sort((a, b) => b.score - a.score);
  tossUps.sort((a, b) => b.score - a.score);

  if (!darkHorses.length) {
    const longest = [...entry.games]
      .map((game) => {
        const sides = game?.sides || [];
        if (sides.length < 2) return null;
        const distA = distributions.get(String(sides[0].rosterId)) || distributions.get(sides[0].rosterId);
        const distB = distributions.get(String(sides[1].rosterId)) || distributions.get(sides[1].rosterId);
        if (!distA || !distB) return null;
        const pLeft = winProbability(distA, distB);
        const underIsLeft = pLeft <= 0.5;
        const under = underIsLeft ? sides[0] : sides[1];
        const fav = underIsLeft ? sides[1] : sides[0];
        const p = underIsLeft ? pLeft : 1 - pLeft;
        if (p >= 0.5) return null;
        return {
          kind: "dark-horse",
          title: p <= 0.42 ? "Dark horse" : "Slight dog",
          rosterId: String(under.rosterId),
          teamName: model.teams.get(String(under.rosterId))?.name || `Roster ${under.rosterId}`,
          opponentRosterId: String(fav.rosterId),
          opponentName: model.teams.get(String(fav.rosterId))?.name || `Roster ${fav.rosterId}`,
          winPct: p * 100,
          valueLabel: `${Math.round(p * 100)}%`,
          detail: `${Math.round(p * 100)}% by scoring-profile sim to beat ${model.teams.get(String(fav.rosterId))?.name || "the favorite"}. Gaussian matchup CDF on empirical-Bayes scoring, not roster KTC.`,
          tone: "gold",
          score: 0.5 - p,
          matchupId: game.matchupId ?? `${sides[0].rosterId}-${sides[1].rosterId}`,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.winPct - b.winPct)[0];
    if (longest) darkHorses.push(longest);
  }

  return {
    week: entry.week,
    label: entry.label,
    status: entry.status,
    darkHorses,
    trapGames,
    leverageGames,
    tossUps,
    cards: pickWeekAngleCards({ darkHorses, trapGames, leverageGames, tossUps }),
  };
}

export function pickWeekAngleCards({
  darkHorses = [],
  trapGames = [],
  leverageGames = [],
  tossUps = [],
} = {}, { max = 4 } = {}) {
  const cards = [];
  const seen = new Set();
  const push = (item) => {
    if (!item || cards.length >= max) return;
    const key = `${item.kind}:${item.rosterId}:${item.matchupId}`;
    if (seen.has(key)) return;
    seen.add(key);
    cards.push(item);
  };
  darkHorses.slice(0, 2).forEach(push);
  push(trapGames[0]);
  push(leverageGames[0]);
  push(tossUps[0]);
  return cards.slice(0, max);
}

export function computeWeeklyAwards(model, week, { playerName = (id) => id, playerPosition = () => "", optimalPoints = null } = {}) {
  const entry = getWeekEntry(model, week);
  if (!entry) return { week, entry: null, awards: [], games: [] };
  const games = entry.games.filter((game) => game.sides.some((side) => side.points > 0));
  if (games.length === 0) return { week, entry, awards: [], games: [], provisional: !entry.isFinal };
  const liveMode = !entry.isFinal;

  const allSides = games.flatMap((game) => game.sides.map((side, index) => ({
    ...side,
    opponent: game.sides[1 - index],
    margin: side.points - game.sides[1 - index].points,
    won: side.points > game.sides[1 - index].points,
    lost: side.points < game.sides[1 - index].points,
    team: model.teams.get(side.rosterId) || null,
  })));
  const sides = liveMode ? allSides.filter((side) => side.points > 0) : allSides;
  const awards = [];
  const push = (id, title, side, valueLabel, detail, tone = "blue") => {
    if (!side) return;
    awards.push({
      id,
      title,
      rosterId: side.rosterId,
      teamName: side.team?.name || `Roster ${side.rosterId}`,
      avatar: side.team?.avatar || null,
      valueLabel,
      detail,
      tone,
    });
  };

  const top = maxBy(sides, (side) => side.points);
  push("top-score", liveMode ? "Top Gun (so far)" : "Top Gun", top, formatPoints(top?.points), `Highest score of the week${top?.opponent ? ` against ${teamLabel(model, top.opponent.rosterId)}` : ""}.`, "green");
  const low = liveMode ? null : minBy(sides, (side) => side.points);
  push("low-score", "Toilet Bowl", low, formatPoints(low?.points), "Lowest score of the week. Someone owes the group chat an explanation.", "rose");

  const blowout = liveMode ? null : maxBy(games, (game) => game.margin);
  if (blowout && blowout.margin > 0) {
    const winner = blowout.sides[0].points > blowout.sides[1].points ? blowout.sides[0] : blowout.sides[1];
    const loser = blowout.sides[0].points > blowout.sides[1].points ? blowout.sides[1] : blowout.sides[0];
    push("blowout", "Demolition", { ...winner, team: model.teams.get(winner.rosterId) }, `+${formatPoints(blowout.margin)}`, `${teamLabel(model, winner.rosterId)} ${formatPoints(winner.points)} over ${teamLabel(model, loser.rosterId)} ${formatPoints(loser.points)}.`, "gold");
  }
  const closest = liveMode ? null : minBy(games.filter((game) => game.margin > 0), (game) => game.margin);
  if (closest) {
    const winner = closest.sides[0].points > closest.sides[1].points ? closest.sides[0] : closest.sides[1];
    const loser = closest.sides[0].points > closest.sides[1].points ? closest.sides[1] : closest.sides[0];
    push("closest", "Photo Finish", { ...winner, team: model.teams.get(winner.rosterId) }, `by ${formatPoints(closest.margin)}`, `${teamLabel(model, winner.rosterId)} edged ${teamLabel(model, loser.rosterId)} ${formatPoints(winner.points)} to ${formatPoints(loser.points)}.`, "blue");
  }
  const badBeat = liveMode ? null : maxBy(sides.filter((side) => side.lost), (side) => side.points);
  if (badBeat) {
    const rankAmongAll = sides.filter((side) => side.points > badBeat.points).length + 1;
    push("bad-beat", "Bad Beat", badBeat, formatPoints(badBeat.points), `Lost despite the ${ordinal(rankAmongAll)} highest score of the week, falling to ${teamLabel(model, badBeat.opponent.rosterId)} (${formatPoints(badBeat.opponent.points)}).`, "rose");
  }
  const lucky = liveMode ? null : minBy(sides.filter((side) => side.won), (side) => side.points);
  if (lucky) {
    const worseCount = sides.filter((side) => side.points < lucky.points).length;
    push("lucky", "Lucky Duck", lucky, formatPoints(lucky.points), `Won with the ${ordinal(sides.length - worseCount)} lowest score on the board. ${teamLabel(model, lucky.opponent.rosterId)} put up ${formatPoints(lucky.opponent.points)}.`, "gold");
  }

  let mvp = null;
  sides.forEach((side) => {
    (side.starters || []).forEach((playerId, index) => {
      const points = Number(side.startersPoints?.[index]);
      if (!Number.isFinite(points) || !playerId || playerId === "0") return;
      if (!mvp || points > mvp.points) mvp = { playerId, points, side };
    });
  });
  if (mvp) {
    const mvpName = String(playerName(mvp.playerId) || "").trim();
    const mvpPosition = String(playerPosition(mvp.playerId) || "").trim();
    push("mvp", liveMode ? "Player of the Week (so far)" : "Player of the Week", mvp.side, formatPoints(mvp.points), `${mvpName}${mvpPosition ? ` (${mvpPosition})` : ""} carried ${teamLabel(model, mvp.side.rosterId)}.`, "green");
    const mvpAward = awards.find((award) => award.id === "mvp");
    if (mvpAward) {
      mvpAward.playerId = String(mvp.playerId);
      mvpAward.playerName = mvpName;
      mvpAward.playerPosition = mvpPosition;
    }
  }

  if (!liveMode && typeof optimalPoints === "function") {
    let blunder = null;
    sides.forEach((side) => {
      const optimal = optimalPoints(side);
      if (!Number.isFinite(optimal)) return;
      const wasted = optimal - side.points;
      if (wasted > 0.05 && (!blunder || wasted > blunder.wasted)) {
        blunder = { side, wasted, optimal };
      }
    });
    if (blunder) {
      const flipped = blunder.side.lost && blunder.optimal > blunder.side.opponent.points;
      push(
        "bench-blunder",
        "Bench Blunder",
        blunder.side,
        `${formatPoints(blunder.wasted)} left on bench`,
        `${teamLabel(model, blunder.side.rosterId)} scored ${formatPoints(blunder.side.points)} but the optimal lineup had ${formatPoints(blunder.optimal)}.${flipped ? " That lineup would have won." : ""}`,
        "rose"
      );
    }
  }

  return { week, entry, awards, games, provisional: !entry.isFinal };
}

export function computeSeasonSuperlatives(model) {
  const teams = model.standings.filter((team) => team.gamesPlayed > 0);
  if (teams.length === 0) return [];
  const items = [];
  const add = (id, title, team, valueLabel, detail, tone = "blue") => {
    if (!team) return;
    items.push({ id, title, rosterId: team.rosterId, teamName: team.name, avatar: team.avatar, valueLabel, detail, tone });
  };
  const pfLeader = maxBy(teams, (team) => team.pf);
  add("points-machine", "Points Machine", pfLeader, formatPoints(pfLeader.pf), `${formatPoints(pfLeader.avg)} per game, the league's best offense.`, "green");
  const fortress = minBy(teams, (team) => team.pa);
  add("fortress", "Softest Schedule", fortress, formatPoints(fortress.pa), "Fewest points allowed. The schedule has been kind.", "blue");
  const punchingBag = maxBy(teams, (team) => team.pa);
  add("punching-bag", "Hardest Schedule", punchingBag, formatPoints(punchingBag.pa), "Most points allowed. Everyone brings their best game against this roster.", "rose");
  const luckiest = maxBy(teams, (team) => team.luck);
  if (luckiest && luckiest.luck > 0) add("luckiest", "Horseshoe", luckiest, `${luckiest.luck > 0 ? "+" : ""}${luckiest.luck.toFixed(1)} wins`, `${luckiest.headToHeadWins} real wins versus ${luckiest.expectedWins.toFixed(1)} expected from the all-play record (${luckiest.allPlayRecord}).`, "gold");
  const unluckiest = minBy(teams, (team) => team.luck);
  if (unluckiest && unluckiest.luck < 0) add("unluckiest", "Snakebitten", unluckiest, `${unluckiest.luck.toFixed(1)} wins`, `${unluckiest.headToHeadWins} real wins versus ${unluckiest.expectedWins.toFixed(1)} expected. All-play record ${unluckiest.allPlayRecord}.`, "rose");
  const hot = maxBy(teams.filter((team) => team.streak.type === "W"), (team) => team.streak.length);
  if (hot && hot.streak.length >= 2) add("hot", "Heater", hot, `${hot.streak.length} straight wins`, "Longest active winning streak in the league.", "green");
  const cold = maxBy(teams.filter((team) => team.streak.type === "L"), (team) => team.streak.length);
  if (cold && cold.streak.length >= 2) add("cold", "Ice Cold", cold, `${cold.streak.length} straight losses`, "Longest active losing streak in the league.", "rose");
  const ceiling = maxBy(teams, (team) => team.high?.points ?? -Infinity);
  if (ceiling?.high) add("ceiling", "Season High", ceiling, formatPoints(ceiling.high.points), `Week ${ceiling.high.week} explosion, the biggest single-week score so far.`, "green");
  const floor = minBy(teams, (team) => team.low?.points ?? Infinity);
  if (floor?.low) add("floor", "Season Low", floor, formatPoints(floor.low.points), `Week ${floor.low.week}. It happened, and the league remembers.`, "rose");
  const steady = minBy(teams.filter((team) => team.gamesPlayed >= 3), (team) => team.std);
  if (steady) add("steady", "Metronome", steady, `±${formatPoints(steady.std)}`, "Smallest week-to-week swing in scoring.", "blue");
  const volatile = maxBy(teams.filter((team) => team.gamesPlayed >= 3), (team) => team.std);
  if (volatile) add("volatile", "Boom or Bust", volatile, `±${formatPoints(volatile.std)}`, "Largest week-to-week swing in scoring.", "gold");
  const benchLeader = maxBy(teams.filter((team) => team.benchPoints > 0), (team) => team.benchPoints);
  if (benchLeader) add("bench", "Bench Hoarder", benchLeader, `${formatPoints(benchLeader.benchPoints)} wasted`, "Most points left on the bench versus the optimal lineup.", "rose");
  return items;
}

export function computeRecordBook({ games = [], seasonRows = [] } = {}) {
  const valid = games.filter((game) => game?.a && game?.b && Number.isFinite(game.a.points) && Number.isFinite(game.b.points) && (game.a.points > 0 || game.b.points > 0));
  const sides = valid.flatMap((game) => [
    { ...game.a, opponent: game.b, season: game.season, week: game.week, isPlayoff: game.isPlayoff, margin: game.a.points - game.b.points },
    { ...game.b, opponent: game.a, season: game.season, week: game.week, isPlayoff: game.isPlayoff, margin: game.b.points - game.a.points },
  ]);
  const records = [];
  const add = (id, title, holder, valueLabel, detail, tone = "blue") => {
    if (!holder) return;
    records.push({ id, title, holder: holder.managerName, rosterId: holder.rosterId || null, avatar: holder.avatar || null, valueLabel, detail, tone });
  };

  const high = maxBy(sides, (side) => side.points);
  if (high) add("high", "Highest Score", high, formatPoints(high.points), `${high.season} Week ${high.week}${high.isPlayoff ? " (playoffs)" : ""} against ${high.opponent.managerName}.`, "green");
  const low = minBy(sides.filter((side) => side.points > 0), (side) => side.points);
  if (low) add("low", "Lowest Score", low, formatPoints(low.points), `${low.season} Week ${low.week}. A dark day against ${low.opponent.managerName}.`, "rose");
  const blowout = maxBy(sides, (side) => side.margin);
  if (blowout && blowout.margin > 0) add("blowout", "Biggest Blowout", blowout, `+${formatPoints(blowout.margin)}`, `${blowout.season} Week ${blowout.week}: ${formatPoints(blowout.points)} to ${formatPoints(blowout.opponent.points)} over ${blowout.opponent.managerName}.`, "gold");
  const closest = minBy(sides.filter((side) => side.margin > 0), (side) => side.margin);
  if (closest) add("closest", "Closest Game", closest, `by ${formatPoints(closest.margin)}`, `${closest.season} Week ${closest.week}: ${formatPoints(closest.points)} to ${formatPoints(closest.opponent.points)} over ${closest.opponent.managerName}.`, "blue");
  const shootout = maxBy(valid, (game) => game.a.points + game.b.points);
  if (shootout) add("shootout", "Biggest Shootout", { ...shootout.a, managerName: `${shootout.a.managerName} vs ${shootout.b.managerName}` }, formatPoints(shootout.a.points + shootout.b.points), `${shootout.season} Week ${shootout.week}: ${formatPoints(shootout.a.points)} to ${formatPoints(shootout.b.points)}.`, "green");
  const slog = minBy(valid.filter((game) => game.a.points >= 25 && game.b.points >= 25), (game) => game.a.points + game.b.points);
  if (slog) add("slog", "Ugliest Game", { ...slog.a, managerName: `${slog.a.managerName} vs ${slog.b.managerName}` }, formatPoints(slog.a.points + slog.b.points), `${slog.season} Week ${slog.week}: ${formatPoints(slog.a.points)} to ${formatPoints(slog.b.points)} combined misery.`, "rose");

  const streaks = computeAllTimeStreaks(valid);
  if (streaks.win) add("win-streak", "Longest Win Streak", streaks.win, `${streaks.win.length} games`, `${streaks.win.startSeason} Week ${streaks.win.startWeek} through ${streaks.win.endSeason} Week ${streaks.win.endWeek}.`, "green");
  if (streaks.loss) add("loss-streak", "Longest Skid", streaks.loss, `${streaks.loss.length} games`, `${streaks.loss.startSeason} Week ${streaks.loss.startWeek} through ${streaks.loss.endSeason} Week ${streaks.loss.endWeek}.`, "rose");

  const seasonPf = maxBy(seasonRows.filter((row) => row.points > 0 && row.complete), (row) => row.points);
  if (seasonPf) add("season-points", "Most Points, One Season", { managerName: seasonPf.managerName, rosterId: seasonPf.rosterId, avatar: seasonPf.avatar }, formatPoints(seasonPf.points), `${seasonPf.season} regular season, ${seasonPf.wins}-${seasonPf.losses}.`, "green");
  const bestRecord = maxBy(seasonRows.filter((row) => row.complete && row.wins + row.losses > 0), (row) => row.wins / Math.max(1, row.wins + row.losses) + row.points / 1e6);
  if (bestRecord) add("best-record", "Best Regular Season", { managerName: bestRecord.managerName, rosterId: bestRecord.rosterId, avatar: bestRecord.avatar }, `${bestRecord.wins}-${bestRecord.losses}`, `${bestRecord.season}, ${formatPoints(bestRecord.points)} points.`, "gold");
  const worstRecord = minBy(seasonRows.filter((row) => row.complete && row.wins + row.losses > 0), (row) => row.wins / Math.max(1, row.wins + row.losses) - row.points / 1e6);
  if (worstRecord) add("worst-record", "Roughest Regular Season", { managerName: worstRecord.managerName, rosterId: worstRecord.rosterId, avatar: worstRecord.avatar }, `${worstRecord.wins}-${worstRecord.losses}`, `${worstRecord.season}, ${formatPoints(worstRecord.points)} points.`, "rose");

  return { records, gameCount: valid.length, seasonCount: new Set(valid.map((game) => game.season)).size };
}

export function computeAllTimeStreaks(games) {
  const byManager = new Map();
  games.forEach((game) => {
    [[game.a, game.b], [game.b, game.a]].forEach(([side, opponent]) => {
      const key = side.managerKey || side.managerName;
      if (!byManager.has(key)) byManager.set(key, { managerName: side.managerName, rosterId: side.rosterId, avatar: side.avatar, results: [] });
      const bucket = byManager.get(key);
      bucket.managerName = side.managerName || bucket.managerName;
      bucket.results.push({
        season: Number(game.season),
        week: Number(game.week),
        result: side.points > opponent.points ? "W" : side.points < opponent.points ? "L" : "T",
      });
    });
  });

  let win = null;
  let loss = null;
  byManager.forEach((bucket) => {
    bucket.results.sort((a, b) => a.season - b.season || a.week - b.week);
    let current = null;
    bucket.results.forEach((result) => {
      if (result.result === "T") {
        current = null;
        return;
      }
      if (current && current.type === result.result) {
        current.length += 1;
        current.endSeason = result.season;
        current.endWeek = result.week;
      } else {
        current = {
          type: result.result,
          length: 1,
          startSeason: result.season,
          startWeek: result.week,
          endSeason: result.season,
          endWeek: result.week,
          managerName: bucket.managerName,
          rosterId: bucket.rosterId,
          avatar: bucket.avatar,
        };
      }
      if (current.type === "W" && (!win || current.length > win.length)) win = { ...current };
      if (current.type === "L" && (!loss || current.length > loss.length)) loss = { ...current };
    });
  });
  return { win, loss };
}

export function seedTeams(rows, { divisionCount = 0, playoffTeams = DEFAULT_PLAYOFF_TEAMS, seedType = 0 } = {}) {
  const ordered = rows.slice().sort(compareStandings);
  const spots = Math.min(playoffTeams, ordered.length);
  if (divisionCount > 1 && seedType !== 2) {
    const winners = pickDivisionWinners(ordered, divisionCount);
    const winnerSet = new Set(winners);
    const wildcards = ordered.filter((row) => !winnerSet.has(row.rosterId)).map((row) => row.rosterId);
    if (seedType === 1) {
      const qualified = new Set([...winners, ...wildcards.slice(0, Math.max(0, spots - winners.length))]);
      return ordered.filter((row) => qualified.has(row.rosterId)).map((row) => row.rosterId).slice(0, spots);
    }
    return [...winners, ...wildcards].slice(0, spots);
  }
  return ordered.slice(0, spots).map((row) => row.rosterId);
}

export function pickDivisionWinners(orderedRows, divisionCount) {
  const winners = [];
  const seen = new Set();
  orderedRows.forEach((row) => {
    const division = Number(row.division) || 0;
    if (!division || seen.has(division)) return;
    seen.add(division);
    winners.push(row.rosterId);
  });
  return winners.slice(0, divisionCount);
}

export function compareStandings(a, b) {
  return (b.wins - a.wins)
    || (b.ties - a.ties)
    || (b.pf - a.pf)
    || ((a.pa ?? 0) - (b.pa ?? 0))
    || String(a.rosterId).localeCompare(String(b.rosterId), undefined, { numeric: true });
}

export function pointsAgainstFromSettings(settings = {}) {
  if (settings?.fpts_against == null && settings?.fpts_against_decimal == null) return null;
  return sleeperPoints(settings.fpts_against, settings.fpts_against_decimal);
}

export function compareRosterRecord(a, b) {
  const wins = (Number(b.wins) || 0) - (Number(a.wins) || 0);
  if (wins) return wins;
  const losses = (Number(a.losses) || 0) - (Number(b.losses) || 0);
  if (losses) return losses;
  const ties = (Number(b.ties) || 0) - (Number(a.ties) || 0);
  if (ties) return ties;
  const points = (Number(b.points) || 0) - (Number(a.points) || 0);
  if (points) return points;
  const aPa = Number.isFinite(Number(a.pointsAgainst)) ? Number(a.pointsAgainst) : null;
  const bPa = Number.isFinite(Number(b.pointsAgainst)) ? Number(b.pointsAgainst) : null;
  if (aPa == null && bPa == null) {
    return String(a.rosterId).localeCompare(String(b.rosterId), undefined, { numeric: true });
  }
  if (aPa == null) return 1;
  if (bPa == null) return -1;
  const pa = aPa - bPa;
  if (pa) return pa;
  return String(a.rosterId).localeCompare(String(b.rosterId), undefined, { numeric: true });
}

export function playoffWeekCount(playoffTeams, roundType) {
  const teams = Number(playoffTeams);
  const size = Number.isFinite(teams) && teams >= 2 ? teams : 2;
  const base = Math.max(1, Math.ceil(Math.log2(size)));
  const type = Number(roundType) || 0;
  if (type === 1) return base + 1;
  if (type === 2) return base * 2;
  return base;
}

export function transactionWeekEnd(league, {
  fallbackEnd = 18,
  minWeek = 1,
  maxWeek = 22,
} = {}) {
  const settings = league?.settings || {};
  const playoffStart = Number(settings.playoff_week_start);
  const tradeDeadline = Number(settings.trade_deadline);
  const playoffTeams = Number(settings.playoff_teams);
  const roundType = Number(settings.playoff_round_type) || 0;
  let playoffEnd = 0;
  if (Number.isFinite(playoffStart) && playoffStart > 0) {
    const weeks = Number.isFinite(playoffTeams) && playoffTeams >= 2
      ? playoffWeekCount(playoffTeams, roundType)
      : 4;
    playoffEnd = playoffStart + weeks - 1;
  }
  const configuredEnd = Math.max(
    fallbackEnd,
    playoffEnd,
    Number.isFinite(tradeDeadline) && tradeDeadline > 0 ? tradeDeadline + 6 : 0,
  );
  return Math.min(maxWeek, Math.max(minWeek, configuredEnd));
}

export function bracketOrder(size) {
  let order = [1];
  while (order.length < size) {
    const next = [];
    const total = order.length * 2 + 1;
    order.forEach((seed) => {
      next.push(seed, total - seed);
    });
    order = next;
  }
  return order;
}

export function bracketByeCount(playoffTeams) {
  const size = nextPowerOfTwo(playoffTeams);
  return Math.max(0, size - playoffTeams);
}

function simulateBracket(seedIndexes, dist, rng, seasonMeans = null) {
  if (seedIndexes.length === 0) return { champion: null, finalists: null };
  if (seedIndexes.length === 1) return { champion: seedIndexes[0], finalists: [seedIndexes[0]] };
  const size = nextPowerOfTwo(seedIndexes.length);
  const order = bracketOrder(size);
  let slots = order.map((seed) => (seed <= seedIndexes.length ? seedIndexes[seed - 1] : null));
  let finalists = null;
  while (slots.length > 1) {
    const next = [];
    for (let i = 0; i < slots.length; i += 2) {
      const a = slots[i];
      const b = slots[i + 1];
      if (a == null) next.push(b);
      else if (b == null) next.push(a);
      else {
        const meanA = seasonMeans?.[a] ?? dist[a].mean;
        const meanB = seasonMeans?.[b] ?? dist[b].mean;
        const scoreA = randomNormal(rng, meanA, dist[a].std);
        const scoreB = randomNormal(rng, meanB, dist[b].std);
        next.push(scoreA >= scoreB ? a : b);
      }
    }
    if (slots.length === 2) finalists = slots.filter((slot) => slot != null);
    slots = next;
  }
  return { champion: slots[0] ?? null, finalists };
}

function dedupeWeekRows(rows) {
  const byRoster = new Map();
  rows.forEach((row) => {
    const rosterId = row?.roster_id != null ? String(row.roster_id) : "";
    if (!rosterId) return;
    const previous = byRoster.get(rosterId);
    if (!previous || matchupPoints(row) > matchupPoints(previous)) byRoster.set(rosterId, row);
  });
  return [...byRoster.values()];
}

function groupGames(rows, teams) {
  const grouped = new Map();
  const byes = [];
  rows.forEach((row) => {
    const side = normalizeSide(row, teams);
    if (!side) return;
    const matchupId = Number(row?.matchup_id);
    if (!Number.isFinite(matchupId) || matchupId <= 0) {
      byes.push(side);
      return;
    }
    if (!grouped.has(matchupId)) grouped.set(matchupId, []);
    grouped.get(matchupId).push(side);
  });
  const games = [];
  grouped.forEach((sides, matchupId) => {
    if (sides.length !== 2) {
      sides.forEach((side) => byes.push(side));
      return;
    }
    sides.sort((a, b) => Number(a.rosterId) - Number(b.rosterId));
    games.push({
      matchupId,
      sides,
      margin: Math.abs(sides[0].points - sides[1].points),
      total: sides[0].points + sides[1].points,
      played: sides[0].points > 0 || sides[1].points > 0,
      winnerRosterId: sides[0].points === sides[1].points ? null : sides[0].points > sides[1].points ? sides[0].rosterId : sides[1].rosterId,
    });
  });
  games.sort((a, b) => a.matchupId - b.matchupId);
  return { games, byes };
}

function normalizeSide(row, teams) {
  const rosterId = row?.roster_id != null ? String(row.roster_id) : null;
  if (!rosterId) return null;
  const team = teams.get(rosterId);
  return {
    rosterId,
    name: team?.name || `Roster ${rosterId}`,
    avatar: team?.avatar || null,
    points: round2(matchupPoints(row)),
    starters: Array.isArray(row?.starters) ? row.starters.map(String) : [],
    startersPoints: Array.isArray(row?.starters_points) ? row.starters_points.map(Number) : [],
    players: Array.isArray(row?.players) ? row.players.map(String) : [],
    playersPoints: row?.players_points && typeof row.players_points === "object" ? row.players_points : {},
  };
}

function applyResult(team, opponent, points, opponentPoints, week) {
  const result = points > opponentPoints ? "W" : points < opponentPoints ? "L" : "T";
  if (result === "W") team.wins += 1;
  else if (result === "L") team.losses += 1;
  else team.ties += 1;
  team.pf = round2(team.pf + points);
  team.pa = round2(team.pa + opponentPoints);
  team.scores.push(points);
  team.results.push({ week, opponentRosterId: opponent.rosterId, opponentName: opponent.name, points, opponentPoints, result });
  if (!team.high || points > team.high.points) team.high = { week, points, opponentName: opponent.name };
  if (!team.low || points < team.low.points) team.low = { week, points, opponentName: opponent.name };
}

function computeStreak(results) {
  if (!results.length) return { type: null, length: 0, label: "—" };
  const ordered = results.slice().sort((a, b) => a.week - b.week);
  const last = ordered[ordered.length - 1];
  let length = 0;
  for (let i = ordered.length - 1; i >= 0; i -= 1) {
    if (ordered[i].result !== last.result) break;
    length += 1;
  }
  return { type: last.result, length, label: `${last.result}${length}` };
}

function buildDivisions(standings, divisionCount) {
  if (divisionCount <= 1) return [];
  const map = new Map();
  standings.forEach((team) => {
    const division = team.division || 0;
    if (!map.has(division)) map.set(division, { division, name: team.divisionName || `Division ${division}`, teams: [] });
    map.get(division).teams.push(team);
  });
  return [...map.values()].sort((a, b) => a.division - b.division);
}

function resolveWeekState(league, nflState, weekRows, lastWeek) {
  const settings = league?.settings || {};
  const status = String(league?.status || "").toLowerCase();
  const leagueSeason = String(league?.season || "");
  const nflSeason = String(nflState?.season || nflState?.league_season || "");
  const sameSeason = nflSeason && leagueSeason && nflSeason === leagueSeason;
  const leg = Number(settings.leg);
  const lastScored = Number(settings.last_scored_leg);

  if (status === "complete") {
    return { currentWeek: lastWeek + 1, finalThroughWeek: lastWeek, seasonComplete: true };
  }
  if (status === "pre_draft" || status === "drafting") {
    return { currentWeek: 1, finalThroughWeek: 0, seasonComplete: false };
  }

  let currentWeek = Number.isFinite(leg) && leg > 0 ? leg : null;
  if (sameSeason) {
    const nflWeek = Number(nflState.week) || Number(nflState.display_week) || null;
    if (String(nflState.season_type || "") === "pre") currentWeek = 1;
    else if (String(nflState.season_type || "") === "post") currentWeek = lastWeek + 1;
    else if (nflWeek) currentWeek = currentWeek ? Math.max(currentWeek, nflWeek) : nflWeek;
  } else if (nflSeason && leagueSeason && Number(nflSeason) > Number(leagueSeason)) {
    return { currentWeek: lastWeek + 1, finalThroughWeek: lastWeek, seasonComplete: true };
  }
  if (!currentWeek) currentWeek = inferCurrentWeek(weekRows);

  let finalThroughWeek = Number.isFinite(lastScored) && lastScored > 0 ? lastScored : Math.max(0, currentWeek - 1);
  finalThroughWeek = Math.min(finalThroughWeek, lastWeek);
  currentWeek = Math.max(currentWeek, finalThroughWeek + 1);
  return { currentWeek, finalThroughWeek, seasonComplete: finalThroughWeek >= lastWeek };
}

function inferCurrentWeek(weekRows) {
  let latest = 0;
  weekRows.forEach((rows, week) => {
    if (Array.isArray(rows) && rows.some((row) => matchupPoints(row) > 0)) latest = Math.max(latest, Number(week));
  });
  return Math.max(1, latest || 1);
}

function computePlayoffRounds(playoffTeams, roundType) {
  return playoffWeekCount(playoffTeams, roundType);
}

export function matchupPoints(row) {
  const raw = row?.custom_points ?? row?.points;
  const value = Number(raw);
  return Number.isFinite(value) ? value : 0;
}

export function sleeperPoints(wholeRaw, decimalRaw) {
  if (wholeRaw == null && decimalRaw == null) return null;
  const whole = Number(wholeRaw);
  const decimal = Number(decimalRaw);
  const wholeValue = Number.isFinite(whole) ? whole : 0;
  if (Number.isFinite(whole) && !Number.isInteger(whole)) return round2(whole);
  if (!Number.isFinite(decimal) || decimal === 0) return round2(wholeValue);
  const fraction = Math.abs(decimal) < 1 ? decimal : decimal / 100;
  return round2(wholeValue + fraction);
}

function decimalStat(roster, wholeKey, decimalKey) {
  const settings = roster?.settings || {};
  return sleeperPoints(settings[wholeKey], settings[decimalKey]) ?? 0;
}

function teamLabel(model, rosterId) {
  return model.teams.get(String(rosterId))?.name || `Roster ${rosterId}`;
}

export function formatRecord(team) {
  return `${team.wins}-${team.losses}${team.ties ? `-${team.ties}` : ""}`;
}

export function formatPoints(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "—";
  return numeric.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function ordinal(rank) {
  const value = Number(rank);
  if (!Number.isFinite(value)) return "";
  const mod100 = value % 100;
  if (mod100 >= 10 && mod100 <= 20) return `${value}th`;
  const suffix = { 1: "st", 2: "nd", 3: "rd" }[value % 10] || "th";
  return `${value}${suffix}`;
}

export function normalPdf(z) {
  if (!Number.isFinite(z)) return 0;
  return Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
}

export function normalCdf(z) {
  if (!Number.isFinite(z)) return z > 0 ? 1 : 0;
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const poly = t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  const density = normalPdf(z);
  const tail = density * poly;
  return z >= 0 ? 1 - tail : tail;
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomNormal(rng, mean, std) {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return Math.max(0, mean + z * std);
}

function nextPowerOfTwo(value) {
  let size = 1;
  while (size < value) size *= 2;
  return size;
}

function range(start, end) {
  const out = [];
  for (let i = start; i <= end; i += 1) out.push(i);
  return out;
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values) {
  if (values.length < 2) return 0;
  const mean = average(values);
  return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1));
}

function median(values) {
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function maxBy(items, scorer) {
  let best = null;
  let bestScore = -Infinity;
  items.forEach((item) => {
    const score = scorer(item);
    if (Number.isFinite(score) && score > bestScore) {
      best = item;
      bestScore = score;
    }
  });
  return best;
}

function minBy(items, scorer) {
  let best = null;
  let bestScore = Infinity;
  items.forEach((item) => {
    const score = scorer(item);
    if (Number.isFinite(score) && score < bestScore) {
      best = item;
      bestScore = score;
    }
  });
  return best;
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

function round2(value) {
  return Math.round(value * 100) / 100;
}
