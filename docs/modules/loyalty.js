export function formatRecordLine(wins = 0, losses = 0, ties = 0) {
  const w = Number(wins) || 0;
  const l = Number(losses) || 0;
  const t = Number(ties) || 0;
  return t > 0 ? `${w}-${l}-${t}` : `${w}-${l}`;
}

export function winPctFromRecord({ wins = 0, losses = 0, ties = 0 } = {}) {
  const games = Number(wins) + Number(losses) + Number(ties);
  if (games <= 0) return 0;
  return (Number(wins) + Number(ties) * 0.5) / games;
}

export function recordFromResults(results = []) {
  let wins = 0;
  let losses = 0;
  let ties = 0;
  results.forEach((result) => {
    const mark = String(result?.result || "").toUpperCase();
    if (mark === "W") wins += 1;
    else if (mark === "L") losses += 1;
    else if (mark === "T") ties += 1;
  });
  return {
    wins,
    losses,
    ties,
    games: wins + losses + ties,
    winPct: winPctFromRecord({ wins, losses, ties }),
    label: formatRecordLine(wins, losses, ties),
  };
}

export function gameSortKey(game) {
  return Number(game?.season || 0) * 100 + Number(game?.week || 0);
}

export function gameIsAfter(game, marker) {
  return gameSortKey(game) > gameSortKey(marker);
}

export function buildRosterDna({
  currentIds = [],
  previousIds = [],
  nameOf = (id) => String(id),
  valueOf = () => 0,
  ageOf = () => null,
  limit = 8,
} = {}) {
  const current = new Set([...currentIds].map(String).filter(Boolean));
  const previous = new Set([...previousIds].map(String).filter(Boolean));
  const toChip = (playerId) => ({
    playerId,
    name: nameOf(playerId) || playerId,
    value: Number(valueOf(playerId)) || 0,
    age: ageOf(playerId),
  });
  const sortChips = (chips) => chips.sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
  const keptAll = [...current].filter((id) => previous.has(id)).map(toChip);
  const addedAll = [...current].filter((id) => !previous.has(id)).map(toChip);
  const lostAll = [...previous].filter((id) => !current.has(id)).map(toChip);
  return {
    kept: sortChips(keptAll).slice(0, limit),
    added: sortChips(addedAll).slice(0, limit),
    lost: sortChips(lostAll).slice(0, limit),
    keptCount: keptAll.length,
    addedCount: addedAll.length,
    lostCount: lostAll.length,
    overlap: current.size === 0 && previous.size === 0
      ? 0
      : keptAll.length / Math.max(current.size, previous.size, 1),
  };
}

export function buildTenure({ currentIds = [], seasons = [] } = {}) {
  const ordered = [...seasons]
    .map((entry) => ({
      season: String(entry.season || ""),
      ids: new Set([...(entry.ids || [])].map(String)),
    }))
    .filter((entry) => entry.season)
    .sort((a, b) => Number(a.season) - Number(b.season));

  return [...currentIds]
    .map(String)
    .filter(Boolean)
    .map((playerId) => {
      let consecutive = 0;
      for (let index = ordered.length - 1; index >= 0; index -= 1) {
        if (!ordered[index].ids.has(playerId)) break;
        consecutive += 1;
      }
      const seasonsPresent = ordered.filter((entry) => entry.ids.has(playerId)).map((entry) => entry.season);
      return {
        playerId,
        consecutiveSeasons: consecutive,
        seasonsPresent: seasonsPresent.length,
        firstSeason: seasonsPresent[0] || null,
        ironman: consecutive >= 3,
      };
    })
    .sort((a, b) => b.consecutiveSeasons - a.consecutiveSeasons || b.seasonsPresent - a.seasonsPresent);
}

export function ironRosterShare(tenures = [], minSeasons = 2) {
  if (!tenures.length) return 0;
  const loyal = tenures.filter((row) => Number(row.consecutiveSeasons) >= minSeasons).length;
  return loyal / tenures.length;
}

export function summarizeCharms(appearances = [], { teamWinPct = 0, minGames = 3 } = {}) {
  const byPlayer = new Map();
  appearances.forEach((row) => {
    const playerId = String(row?.playerId || "");
    if (!playerId || playerId === "0") return;
    if (!byPlayer.has(playerId)) {
      byPlayer.set(playerId, {
        playerId,
        roster: { wins: 0, losses: 0, ties: 0 },
        started: { wins: 0, losses: 0, ties: 0 },
      });
    }
    const bucket = byPlayer.get(playerId);
    const mark = String(row.result || "").toUpperCase();
    const bump = (record) => {
      if (mark === "W") record.wins += 1;
      else if (mark === "L") record.losses += 1;
      else if (mark === "T") record.ties += 1;
    };
    bump(bucket.roster);
    if (row.started) bump(bucket.started);
  });

  return [...byPlayer.values()]
    .map((row) => {
      const roster = {
        ...row.roster,
        games: row.roster.wins + row.roster.losses + row.roster.ties,
        winPct: winPctFromRecord(row.roster),
        label: formatRecordLine(row.roster.wins, row.roster.losses, row.roster.ties),
      };
      const started = {
        ...row.started,
        games: row.started.wins + row.started.losses + row.started.ties,
        winPct: winPctFromRecord(row.started),
        label: formatRecordLine(row.started.wins, row.started.losses, row.started.ties),
      };
      const sample = started.games >= minGames ? started : roster;
      const charmDelta = sample.games >= minGames ? sample.winPct - Number(teamWinPct || 0) : 0;
      return {
        playerId: row.playerId,
        roster,
        started,
        charmDelta,
        badge: charmBadge(started, roster, charmDelta, minGames),
      };
    })
    .filter((row) => row.roster.games >= minGames || row.started.games >= minGames)
    .sort((a, b) => b.charmDelta - a.charmDelta || b.started.games - a.started.games);
}

function charmBadge(started, roster, charmDelta, minGames) {
  if (started.games >= minGames && charmDelta >= 0.12 && started.winPct >= 0.6) return "charm";
  if (started.games >= minGames && charmDelta <= -0.12) return "jinx";
  if (roster.games >= Math.max(minGames, 6) && roster.winPct >= 0.65) return "anchor";
  return "";
}

export function hindsightGrade(valueDelta = 0, winPct = 0.5) {
  const valueScore = Math.max(-1, Math.min(1, Number(valueDelta) / 2000));
  const recScore = (Number(winPct) - 0.5) * 2;
  const combined = valueScore * 0.65 + recScore * 0.35;
  if (combined > 0.55) return "A+";
  if (combined > 0.32) return "A";
  if (combined > 0.12) return "B";
  if (combined > -0.12) return "C";
  if (combined > -0.35) return "D";
  return "F";
}

export function finishesAfterTrade(rows = [], trade = {}) {
  return (rows || []).filter((row) => {
    if (row.isCurrent) return false;
    if (Number(row.season) > Number(trade.season)) return true;
    if (String(row.season) !== String(trade.season)) return false;
    const week = Number(trade.week || 0);
    return week === 0 || week <= 14;
  });
}

// Fleece is a market steal, not raw KTC delta: log-ratio of the packages,
// relative lopsidedness, and the star that moved. Heater is the record
// after the deal: Bayesian shrink toward .500 plus a Wilson lower bound
// so 2-0 cannot beat a real sample. Impact still waits on games piling up.
export function wilsonLowerBound(successes = 0, n = 0, z = 1.28) {
  const games = Number(n) || 0;
  if (games <= 0) return 0;
  const p = Math.max(0, Math.min(1, Number(successes) / games));
  const z2 = z * z;
  const denom = 1 + z2 / games;
  const center = p + z2 / (2 * games);
  const spread = z * Math.sqrt((p * (1 - p) + z2 / (4 * games)) / games);
  return Math.max(0, (center - spread) / denom);
}

export function scoreTradeSide({
  receivedNow = 0,
  sentNow = 0,
  received = [],
  sent = [],
  since = {},
} = {}) {
  const got = Number(receivedNow) || 0;
  const gave = Number(sentNow) || 0;
  const delta = got - gave;
  const dealSize = Math.max(got + gave, 1);
  const rel = delta / dealSize;
  const games = Number(since.games) || 0;
  const wins = Number(since.wins) || 0;
  const losses = Number(since.losses) || 0;
  const ties = Number(since.ties) || 0;
  const successes = wins + ties * 0.5;
  const rawPct = games ? successes / games : 0.5;
  const shrinkPct = (successes + 3) / (games + 6);
  const wilsonPct = wilsonLowerBound(successes, games);
  const recordEdge = (shrinkPct - 0.5) * 100;
  const valuePts = Math.max(-60, Math.min(60, delta / 70));
  const relPts = Math.max(-40, Math.min(40, rel * 80));
  const starGot = Math.max(0, ...received.map((item) => Number(item.value) || 0), 0);
  const starLost = Math.max(0, ...sent.map((item) => Number(item.value) || 0), 0);
  const starPts = Math.max(-30, Math.min(30, (starGot - starLost) / 280));
  const logPts = Math.max(-45, Math.min(45, Math.log((got + 400) / (gave + 400)) * 22));
  const sample = 1 - Math.exp(-games / 8);
  const formPts = recordEdge * (0.35 + 0.65 * sample);
  const marketPts = valuePts * 0.38 + relPts * 0.22 + starPts * 0.18 + logPts * 0.22;
  const impact = marketPts * (0.25 + 0.75 * sample) + formPts * 0.9;
  const fleece = marketPts;
  const heaterScore = shrinkPct * 100 + wilsonPct * 20 * sample;
  const evenness = 1 - Math.min(1, Math.abs(rel) * 2.2 + Math.abs(starGot - starLost) / 12000);
  return {
    delta,
    rel,
    dealSize,
    games,
    winPct: rawPct,
    shrinkPct,
    wilsonPct,
    sample,
    impact,
    fleece,
    heaterScore,
    evenness,
    starGot,
    starLost,
    losses,
  };
}

export function buildTradeRecap({
  managerName = "This team",
  partnerName = "them",
  season = "",
  week = 0,
  received = [],
  sent = [],
  delta = 0,
  since = {},
  grade = "C",
  finishes = [],
} = {}) {
  const got = received.map((item) => item.name).filter(Boolean).slice(0, 6).join(", ") || "picks";
  const gave = sent.map((item) => item.name).filter(Boolean).slice(0, 6).join(", ") || "picks";
  const when = Number(week) > 0 ? `${season} Week ${week}` : String(season || "That season");
  const recordBit = Number(since.games) > 0
    ? `Since the deal the ticker is ${since.label} (${Math.round((Number(since.winPct) || 0) * 100)}%).`
    : "No games have posted after this one yet, so the record is still blank.";
  const marketBit = Math.abs(Number(delta) || 0) < 200
    ? "Today's KTC still calls it even."
    : Number(delta) > 0
      ? `Today's KTC says ${managerName} is up ${Math.round(delta)}.`
      : `Today's KTC says ${managerName} is down ${Math.round(Math.abs(delta))}.`;
  const finishBit = finishes.length
    ? ` Later finishes: ${finishes.map((row) => `${row.season} ${row.label}`).join(", ")}.`
    : "";
  return `${when} vs ${partnerName}. ${managerName} took ${got} for ${gave}. ${marketBit} ${recordBit} Grade ${grade}.${finishBit}`;
}

export function analyzePastTrades({
  trades = [],
  myRosterId,
  games = [],
  valueOf = () => 0,
  managerName = "This team",
  finishes = [],
} = {}) {
  const mine = String(myRosterId || "");
  return trades
    .map((trade) => {
      const movements = Array.isArray(trade.movements)
        ? trade.movements.map((item) => ({
          ...item,
          value: Number(valueOf(item)) || Number(item.value) || 0,
        }))
        : [];
      const received = movements.filter((item) => String(item.toRosterId) === mine);
      const sent = movements.filter((item) => String(item.fromRosterId) === mine);
      if (received.length === 0 && sent.length === 0) return null;
      const receivedNow = received.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
      const sentNow = sent.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
      const delta = receivedNow - sentNow;
      const after = games
        .filter((game) => gameIsAfter(game, trade))
        .sort((a, b) => gameSortKey(a) - gameSortKey(b));
      const since = recordFromResults(after);
      const grade = hindsightGrade(delta, since.games ? since.winPct : 0.5);
      const scored = scoreTradeSide({ receivedNow, sentNow, received, sent, since });
      const laterFinishes = finishesAfterTrade(finishes, trade);
      return {
        id: trade.id || `${trade.season}-${trade.week}-${mine}`,
        season: String(trade.season || ""),
        week: Number(trade.week) || 0,
        partnerName: trade.partnerName || "Rival",
        managerKey: mine,
        managerName,
        received,
        sent,
        receivedNow,
        sentNow,
        delta,
        since,
        after,
        laterFinishes,
        grade,
        verdict: delta > 150 ? "won" : delta < -150 ? "lost" : "even",
        ...scored,
        recap: buildTradeRecap({
          managerName,
          partnerName: trade.partnerName || "Rival",
          season: trade.season,
          week: trade.week,
          received,
          sent,
          delta,
          since,
          grade,
          finishes: laterFinishes,
        }),
      };
    })
    .filter(Boolean)
    .sort((a, b) => gameSortKey(b) - gameSortKey(a) || Math.abs(b.delta) - Math.abs(a.delta));
}

export function analyzeLeagueTradeSides({
  trades = [],
  gamesByManager = new Map(),
  valueOf = () => 0,
  nameOf = (key) => key,
  finishesByManager = new Map(),
} = {}) {
  const sides = [];
  trades.forEach((trade) => {
    const keys = [...new Set((trade.movements || [])
      .flatMap((item) => [item.fromRosterId, item.toRosterId])
      .map(String)
      .filter(Boolean))];
    keys.forEach((managerKey) => {
      const [row] = analyzePastTrades({
        trades: [{
          ...trade,
          partnerName: keys
            .filter((key) => key !== managerKey)
            .map((key) => nameOf(key))
            .filter(Boolean)
            .join(" / ") || trade.partnerName || "Rival",
        }],
        myRosterId: managerKey,
        games: gamesByManager.get(managerKey) || [],
        valueOf,
        managerName: nameOf(managerKey) || "Manager",
        finishes: finishesByManager.get(managerKey) || [],
      });
      if (row) sides.push(row);
    });
  });
  return sides;
}

function laterFinishBoost(finishes = []) {
  let boost = 0;
  (finishes || []).forEach((row) => {
    const rank = Number(row.finishRank);
    const label = String(row.label || "").toLowerCase();
    if (label.includes("champion") || rank === 1) boost = Math.max(boost, 6);
    else if (Number.isFinite(rank) && rank <= 3) boost = Math.max(boost, 3);
    else if (Number.isFinite(rank) && rank <= 6) boost = Math.max(boost, 1);
  });
  return boost;
}

function heaterRankScore(side) {
  return (Number(side.heaterScore) || Number(side.shrinkPct) * 100 || 0) + laterFinishBoost(side.laterFinishes);
}

export function pickLeagueTradeAwards(sides = []) {
  const real = sides.filter((side) => Number(side.dealSize) >= 600);
  if (!real.length) {
    return { fleece: null, heater: null };
  }
  const fleece = [...real].sort((a, b) => b.fleece - a.fleece)[0] || null;
  const withSample = real.filter((side) => Number(side.games) >= 4);
  const heaterPool = real.filter((side) => Number(side.games) >= 6);
  const heater = [...(heaterPool.length ? heaterPool : withSample)]
    .sort((a, b) => heaterRankScore(b) - heaterRankScore(a) || b.games - a.games)[0] || null;
  return { fleece, heater };
}

export function biggestTradeMiss(trades = [], { myRosterId, valueOf = () => 0 } = {}) {
  const mine = String(myRosterId || "");
  const lost = [];
  trades.forEach((trade) => {
    (trade.movements || []).forEach((item) => {
      if (String(item.fromRosterId) !== mine) return;
      if (item.assetType && item.assetType !== "player") return;
      lost.push({
        ...item,
        value: Number(valueOf(item)) || 0,
        season: trade.season,
        week: trade.week,
        partnerName: trade.partnerName,
      });
    });
  });
  lost.sort((a, b) => b.value - a.value);
  return lost[0] || null;
}

export function newCorePlayers(added = [], { ageOf = () => null, maxAge = 25 } = {}) {
  return added
    .filter((chip) => {
      const age = Number(chip.age ?? ageOf(chip.playerId));
      return Number.isFinite(age) ? age <= maxAge : true;
    })
    .slice(0, 6);
}

export function buildPlayerPassport({ playerId, name = "", seasons = [] } = {}) {
  const ordered = [...seasons]
    .filter((entry) => entry?.managerKey)
    .sort((a, b) => Number(a.season) - Number(b.season));
  const stops = [];
  ordered.forEach((entry) => {
    const last = stops[stops.length - 1];
    if (last && last.managerKey === entry.managerKey && last.managerName === (entry.managerName || "Unknown")) {
      last.toSeason = String(entry.season);
      return;
    }
    stops.push({
      managerKey: entry.managerKey,
      managerName: entry.managerName || "Unknown",
      fromSeason: String(entry.season),
      toSeason: String(entry.season),
    });
  });
  return {
    playerId: String(playerId || ""),
    name: name || String(playerId || ""),
    stops,
  };
}

export function formatSeasonSpan(fromSeason, toSeason) {
  const from = String(fromSeason || "").trim();
  const to = String(toSeason || from).trim();
  if (!from) return "";
  if (from === to) return from;
  if (from.length === 4 && to.length === 4 && from.slice(0, 2) === to.slice(0, 2)) {
    return `${from}–${to.slice(-2)}`;
  }
  return `${from}–${to}`;
}

export function decoratePassport(passport = {}, { myManagerKey = "", currentSeason = "" } = {}) {
  const mine = String(myManagerKey || "");
  const nowSeason = String(currentSeason || "");
  const stops = (passport.stops || []).map((stop, index, list) => {
    const fromSeason = String(stop.fromSeason || "");
    const toSeason = String(stop.toSeason || fromSeason);
    const fromYear = Number(fromSeason);
    const toYear = Number(toSeason);
    const years = Number.isFinite(fromYear) && Number.isFinite(toYear)
      ? Math.max(1, toYear - fromYear + 1)
      : 1;
    const isMine = mine && String(stop.managerKey) === mine;
    const isNow = nowSeason && toSeason === nowSeason && isMine;
    const origin = index === 0;
    const last = index === list.length - 1;
    return {
      ...stop,
      fromSeason,
      toSeason,
      years,
      origin,
      last,
      current: Boolean(isNow),
      stamp: origin ? "origin" : isNow ? "now" : "visa",
    };
  });
  return {
    ...passport,
    stops,
    hops: Math.max(0, stops.length - 1),
  };
}

export function passportJourneyLabel(passport = {}) {
  const stops = passport.stops || [];
  const hops = Number.isFinite(Number(passport.hops)) ? Number(passport.hops) : Math.max(0, stops.length - 1);
  const here = stops.some((stop) => stop.current);
  if (stops.length <= 1) return here ? "Never left this roster" : "One stamp";
  const visaWord = hops === 1 ? "One visa" : `${hops} visas`;
  return here ? `${visaWord} · still here` : visaWord;
}

export function buildHallRows(dynastyRows = [], { playoffTeams = 6 } = {}) {
  return [...dynastyRows]
    .map((row) => {
      const playoffApps = (row.records || []).filter((record) => {
        if (record.isCurrent) return false;
        if (Number.isFinite(Number(record.playoffFinish))) return true;
        return Number(record.finishRank) > 0 && Number(record.finishRank) <= playoffTeams;
      }).length;
      return {
        managerKey: row.managerKey,
        managerName: row.managerName,
        titles: Number(row.titles) || 0,
        careerWins: Number(row.totalWins) || 0,
        careerLosses: Number(row.totalLosses) || 0,
        careerTies: Number(row.totalTies) || 0,
        playoffApps,
        avgFinish: Number.isFinite(Number(row.avgFinish)) ? Number(row.avgFinish) : null,
        dynastyScore: Number(row.dynastyScore) || 0,
        currentRosterId: row.currentRosterId,
        recordLabel: formatRecordLine(row.totalWins, row.totalLosses, row.totalTies),
      };
    })
    .sort((a, b) => b.titles - a.titles || b.careerWins - a.careerWins || b.dynastyScore - a.dynastyScore);
}

export function loyaltyScore({ tenures = [], charms = [], dna } = {}) {
  const iron = ironRosterShare(tenures, 2);
  const topCharm = charms[0]?.charmDelta || 0;
  const keepRate = Number(dna?.overlap) || 0;
  const raw = iron * 48 + Math.max(0, topCharm) * 80 + keepRate * 28;
  return Math.max(1, Math.min(99, Math.round(raw)));
}
