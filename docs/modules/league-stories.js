import { ownerIdFromRoster, personManagerKey } from "./franchise.js";
import { seasonGames } from "./league-records.js";
import { formatPoints, formatRecord, sleeperPoints } from "./standings.js";

// Stories are plain text. Keep the date and underlying numbers with each claim
// so the same story makes sense on the league cover and in the full archive.
function seasonTeams(entry) {
  const users = new Map((entry.users || []).map(user => [String(user.user_id), user]));
  return new Map((entry.rosters || []).map(roster => {
    const id = String(roster.roster_id);
    const owner = ownerIdFromRoster(roster);
    const user = users.get(owner);
    const settings = roster.settings || {};
    const wins = Number(settings.wins || 0), losses = Number(settings.losses || 0), ties = Number(settings.ties || 0);
    return [id, { id, owner, name: user?.metadata?.team_name || user?.display_name || user?.username || `Roster ${id}`,
      manager: user?.display_name || user?.username || "", wins, losses, ties, games: wins + losses + ties,
      points: sleeperPoints(settings.fpts, settings.fpts_decimal) }];
  }));
}

function trophyStories(seasons) {
  const finals = seasons.flatMap(({ entry, teams }) => {
    if (entry.league?.status !== "complete") return [];
    const game = (entry.winnersBracket || []).find(row => Number(row.p) === 1 && row.w != null);
    const winner = game && teams.get(String(game.w));
    return winner ? [{ year: entry.season, winner, runnerUp: teams.get(String(game.l)) }] : [];
  });
  if (!finals.length) return [];
  const latest = finals[0];
  const rings = finals.filter(row => latest.winner.owner && row.winner.owner === latest.winner.owner);
  let crown;
  if (rings.length >= 2 && latest.winner.manager) {
    const years = rings.map(row => row.year).reverse().join(", ");
    crown = { id: "repeat-champion", category: "Trophy room", headline: `${latest.winner.manager} has a ring collection.`,
      stat: `${rings.length} rings`, detail: `The latest champ won the league in ${years}. Each of those seasons ends with the same manager on top of the bracket.`,
      source: `${years} · Title games`, section: "champions" };
  } else {
    crown = { id: "champion", category: "Trophy room", headline: `The trophy belongs to ${latest.winner.name}.`,
      stat: `${latest.year} champ`, detail: latest.runnerUp
        ? `${latest.winner.name} beat ${latest.runnerUp.name} in the ${latest.year} final. That’s the latest title on the books.`
        : `Sleeper’s ${latest.year} title bracket lists ${latest.winner.name} as the winner.`,
      source: `${latest.year} · Title game`, section: "champions" };
  }
  const losses = new Map();
  for (const { year, runnerUp } of finals) {
    if (!runnerUp?.owner || !runnerUp.manager) continue;
    if (!losses.has(runnerUp.owner)) losses.set(runnerUp.owner, { manager: runnerUp.manager, years: [] });
    losses.get(runnerUp.owner).years.push(year);
  }
  const frequent = [...losses.values()].sort((a, b) => b.years.length - a.years.length)[0];
  if (!frequent || frequent.years.length < 2) return [crown];
  const years = frequent.years.reverse().join(", ");
  return [crown, { id: "near-miss", category: "Bad beats", headline: `${frequent.manager} knows the walk off the podium.`,
    stat: `${frequent.years.length} silver medals`, detail: `Made the final in ${years}. Someone else took home the trophy each time.`,
    source: `${years} · Title games`, section: "champions" }];
}

function turnaroundStory(seasons) {
  let best;
  for (let i = 1; i < seasons.length; i++) {
    const newer = seasons[i - 1], older = seasons[i];
    if (newer.entry.league?.status !== "complete" || older.entry.league?.status !== "complete" ||
        Number(newer.entry.season) !== Number(older.entry.season) + 1) continue;
    const previous = new Map([...older.teams.values()].map(team => [team.owner, team]));
    for (const team of newer.teams.values()) {
      const prior = previous.get(team.owner);
      if (!team.owner || !team.manager || !prior || team.games !== prior.games || team.games < 4) continue;
      const gain = team.wins - prior.wins;
      if (gain < 3 || (best && gain <= best.gain)) continue;
      best = { gain, story: { id: "turnaround", category: "Turnarounds", headline: `${team.manager} flipped the standings.`,
        stat: `+${gain} wins`, detail: `From ${formatRecord(prior)} in ${older.entry.season} to ${formatRecord(team)} in ${newer.entry.season}. Same manager, ${gain} more regular-season wins in the same number of games.`,
        source: `${older.entry.season}–${newer.entry.season} · Season records`, section: "standings" } };
    }
  }
  return best?.story;
}

function tradeTrend(archive, seasons) {
  const counts = new Map();
  for (const { entry } of seasons) {
    const rows = archive.transactions?.[entry.season];
    const missing = archive.issues?.some(issue => String(issue.season) === String(entry.season) &&
      issue.resource?.startsWith("transactions/"));
    if (Array.isArray(rows) && !missing) counts.set(entry.season, rows.filter(move => move.type === "trade" && move.status === "complete").length);
  }
  for (let i = 1; i < seasons.length; i++) {
    const { entry } = seasons[i - 1];
    const prior = seasons[i].entry;
    const newer = entry.season, older = prior.season;
    const now = counts.get(newer), before = counts.get(older);
    if (Number(newer) !== Number(older) + 1 || now == null || before == null || prior.league?.status !== "complete") continue;
    const delta = now - before;
    if (entry.league?.status !== "complete") {
      if (entry.league?.status !== "in_season" || delta <= 0 || before < 3) continue;
      return { id: "trade-volume", category: "League trends", headline: "The trade block already beat last year.",
        stat: `${now} trades`, detail: `Managers have made ${now} deals in ${newer}. They made ${before} in all of ${older}, and this season is still going.`,
        source: `${older}–${newer} · Completed trades`, section: "trends" };
    }
    if (delta === 0 && now >= 5) return { id: "trade-volume", category: "League trends", headline: "Same league. Same number of deals.",
      stat: `${now} each year`, detail: `Managers closed ${before} trades in ${older}, then exactly ${now} again in ${newer}.`,
      source: `${older}–${newer} · Completed trades`, section: "trends" };
    if (Math.abs(delta) < 3 || Math.abs(delta) / Math.max(1, before) < 0.25) continue;
    return { id: "trade-volume", category: "League trends",
      headline: delta > 0 ? "The trade block got a lot busier." : "The trade block went quiet.",
      stat: `${delta > 0 ? "+" : "−"}${Math.abs(delta)} trades`,
      detail: `Managers closed ${before} ${before === 1 ? "deal" : "deals"} in ${older} and ${now} in ${newer}. That’s ${Math.abs(delta)} ${delta > 0 ? "more" : "fewer"} completed trades between two full seasons.`,
      source: `${older}–${newer} · Completed trades`, section: "trends" };
  }
}

// A championship hangover can lead the cover even
// before weekly matchups arrive. Compare owners, never reused roster slots.
function titleHangover(seasons) {
  const current = seasons.find(({ teams }) => [...teams.values()].some(team => team.games >= 4));
  if (!current) return;
  const losing = [...current.teams.values()].filter(team => team.owner && team.manager && team.games >= 4 && team.losses > 2 * team.wins);
  for (const { entry, teams } of seasons) {
    if (Number(entry.season) >= Number(current.entry.season) || entry.league?.status !== "complete") continue;
    const final = (entry.winnersBracket || []).find(row => Number(row.p) === 1 && row.w != null);
    const champion = final && teams.get(String(final.w));
    const slide = champion && losing.find(team => team.owner === champion.owner);
    if (!slide) continue;
    return { id: "title-hangover", category: "Turnarounds", headline: `${slide.manager} went from a ring to a rough season.`,
      stat: formatRecord(slide), detail: `${slide.manager} lifted the trophy in ${entry.season}. Their ${current.entry.season} regular-season record is ${formatRecord(slide)}.`,
      source: `${entry.season} & ${current.entry.season} · Title and record`, section: "champions" };
  }
}

function scoringStory(seasons) {
  for (const { entry, teams } of seasons) {
    const field = [...teams.values()].sort((a, b) => b.points - a.points);
    if (field.length < 2 || field.some(team => team.points == null || team.games < 2)) continue;
    const [leader, next] = field;
    if (leader.points <= next.points) continue;
    const gap = formatPoints(leader.points - next.points);
    const final = entry.league?.status === "complete" && (entry.winnersBracket || []).find(row => Number(row.p) === 1 && teams.has(String(row.w)));
    if (final && String(final.w) !== leader.id) {
      return { id: "scoring-crown", category: "Bad beats", headline: `All those points. No ring for ${leader.name}.`,
        stat: `${formatPoints(leader.points)} pts`, detail: `${leader.name} outscored the field by ${gap} regular-season points in ${entry.season}. ${teams.get(String(final.w)).name} took the title.`,
        source: `${entry.season} · Season points & title game`, section: "champions" };
    }
    return { id: "scoring-pace", category: "Bragging rights", headline: `${leader.name} sets the scoring pace.`,
      stat: `+${gap} pts`, detail: `The ${entry.season} regular-season totals put ${leader.name} at ${formatPoints(leader.points)}, with ${next.name} chasing at ${formatPoints(next.points)}.`,
      source: `${entry.season} · Season points`, section: "champions" };
  }
}

function matchupKey(a, b) {
  if (!a?.owner || !b?.owner || a.owner === b.owner) return undefined;
  return [personManagerKey(a.owner), personManagerKey(b.owner)].sort((x, y) => x.localeCompare(y)).join("|");
}

function matchupStories(archive, seasons) {
  let badBeat, closest;
  const pairs = new Map();
  for (const { entry, teams } of seasons) {
    // Archive weeks exclude the live week. Restrict these stories to the
    // regular season, where weekly head-to-head scores actually decide a game.
    const settings = entry.league?.settings || {};
    const playoffStart = Number(settings.playoff_week_start ?? 15) || 19;
    const games = seasonGames(entry, archive).filter(game => game.week < playoffStart && game.week >= (Number(settings.start_week) || 1));
    const weeks = new Map();
    for (const game of games) {
      if (!weeks.has(game.week)) weeks.set(game.week, []);
      weeks.get(game.week).push(game);
      const [a, b] = game.teams;
      const margin = Math.abs(Math.round(a.points * 100) - Math.round(b.points * 100));
      const [winner, loser] = a.points > b.points ? [a, b] : [b, a];
      if (margin && (!closest || margin < closest.margin)) {
        closest = { game, winner, loser, margin, matchup: matchupKey(teams.get(a.rosterId), teams.get(b.rosterId)) };
      }
      const managers = [teams.get(a.rosterId), teams.get(b.rosterId)];
      if (managers.some(team => !team?.owner || !team.manager) || managers[0].owner === managers[1].owner) continue;
      const [first, second] = managers.sort((x, y) => x.owner.localeCompare(y.owner));
      const key = `${first.owner}|${second.owner}`;
      if (!pairs.has(key)) pairs.set(key, { first, second, firstWins: 0, secondWins: 0, ties: 0, years: new Set() });
      const pair = pairs.get(key);
      pair.years.add(game.season);
      if (!margin) pair.ties++;
      else if (winner.rosterId === first.id) pair.firstWins++;
      else pair.secondWins++;
    }
    for (const [week, meetings] of weeks) {
      const field = meetings.flatMap(game => game.teams).sort((a, b) => b.points - a.points);
      // A "second in the league" claim needs every roster's score, a unique
      // runner-up, and an actual direct loss to the only team above them.
      const rosterIds = new Set(field.map(team => team.rosterId));
      if (field.length < 6 || field.length !== teams.size || rosterIds.size !== teams.size ||
          field.some(team => !teams.has(team.rosterId))) continue;
      const [first, second, third] = field;
      if (!(first.points > second.points && second.points > third.points)) continue;
      const met = meetings.some(game => game.teams.includes(first) && game.teams.includes(second));
      if (met && (!badBeat || field.length > badBeat.size || (field.length === badBeat.size && second.points > badBeat.second.points))) {
        badBeat = { first, second, size: field.length, week, year: entry.season,
          matchup: matchupKey(teams.get(first.rosterId), teams.get(second.rosterId)) };
      }
    }
  }
  const stories = [];
  if (badBeat) {
    const { first, second, size, week, year } = badBeat;
    stories.push({ id: "wrong-opponent", category: "Bad beats", headline: `${second.name} drew the one team they couldn’t beat.`,
      stat: `2nd of ${size}`, detail: `${second.name} scored ${formatPoints(second.points)}. That beats ${size - 2} other lineups that week. Their opponent? ${first.name}, with ${formatPoints(first.points)}.`,
      source: `${year} · Week ${week}`, section: "rivalries", matchup: badBeat.matchup });
  }
  const sweeps = [...pairs.values()].filter(pair => !pair.ties && (!pair.firstWins || !pair.secondWins))
    .sort((a, b) => (b.firstWins + b.secondWins) - (a.firstWins + a.secondWins));
  const sweep = sweeps[0];
  const wins = sweep && sweep.firstWins + sweep.secondWins;
  if (wins >= 3) {
    const [winner, loser] = sweep.firstWins ? [sweep.first, sweep.second] : [sweep.second, sweep.first];
    const years = [...sweep.years].sort().join(", ");
    stories.push({ id: "nemesis", category: "Rivalries", headline: `${loser.manager} still needs an answer for ${winner.manager}.`,
      stat: `${wins}–0`, detail: `The archive has ${wins} regular-season meetings between them. ${winner.manager} won every one.`,
      source: `${years} · Head-to-head`, section: "rivalries", matchup: matchupKey(winner, loser) });
  }
  if (closest && closest.margin <= 100) {
    const { game, winner, loser, margin } = closest;
    stories.push({ id: "photo-finish", category: "Bragging rights", headline: `${winner.name} got away with one.`,
      stat: `${formatPoints(margin / 100)} pts`, detail: `${loser.name} put up ${formatPoints(loser.points)}. ${winner.name} scraped past with ${formatPoints(winner.points)}.`,
      source: `${game.season} · Week ${game.week}`, section: "rivalries", matchup: closest.matchup });
  }
  return stories;
}

export function leagueStories(archive = {}) {
  const seasons = (archive.seasons || []).map(entry => ({ entry, teams: seasonTeams(entry) }))
    .sort((a, b) => Number(b.entry.season) - Number(a.entry.season));
  const [crown, nearMiss] = trophyStories(seasons);
  const [firstMatchup, ...otherMatchups] = matchupStories(archive, seasons);
  return [firstMatchup, titleHangover(seasons), tradeTrend(archive, seasons), ...otherMatchups,
    turnaroundStory(seasons), nearMiss, crown, scoringStory(seasons)].filter(Boolean);
}
