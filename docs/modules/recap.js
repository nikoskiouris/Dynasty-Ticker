// Weekly recap generator. Produces plain text that pastes cleanly into a group chat.
import { formatOddsPct, formatPoints, formatRecord, ordinal } from "./season.js";

export const RECAP_TONES = [
  { id: "desk", label: "Broadcast desk", description: "Straight, clean, and quotable." },
  { id: "hype", label: "Hype", description: "Everything is the biggest thing that has ever happened." },
  { id: "roast", label: "Roast", description: "Affectionate disrespect for the whole league." },
];

export function buildRecap({
  leagueName,
  model,
  week,
  awards = [],
  games = [],
  provisional = false,
  sim = null,
  trades = [],
  tone = "desk",
  previousOdds = null,
}) {
  const lines = [];
  const entry = model?.weeks?.find((item) => item.week === Number(week)) || null;
  const weekLabel = entry?.isPlayoff ? `Playoff Week ${week}` : `Week ${week}`;
  const title = `${String(leagueName || "League").toUpperCase()} - ${weekLabel.toUpperCase()} RECAP`;
  lines.push(title);
  lines.push("=".repeat(Math.min(60, title.length)));
  lines.push(intro({ tone, model, weekLabel, provisional, games }));
  lines.push("");

  if (games.length > 0) {
    lines.push("SCOREBOARD");
    games
      .slice()
      .sort((a, b) => b.total - a.total)
      .forEach((game) => {
        const [left, right] = game.sides.slice().sort((a, b) => b.points - a.points);
        const verb = provisional ? "leads" : left.points === right.points ? "ties" : "def.";
        lines.push(`${left.name} ${formatPoints(left.points)} ${verb} ${right.name} ${formatPoints(right.points)}${gameTag(game, tone, provisional)}`);
      });
    lines.push("");
  }

  if (awards.length > 0) {
    lines.push(provisional ? "HONORS (SO FAR)" : "HONORS");
    awards.forEach((award) => {
      lines.push(`${award.title}: ${award.teamName} (${award.valueLabel}). ${awardLine(award, tone)}`);
    });
    lines.push("");
  }

  const standings = model?.standings || [];
  if (standings.length > 0 && standings.some((team) => team.gamesPlayed > 0 || team.wins + team.losses > 0)) {
    lines.push("STANDINGS");
    standings.forEach((team) => {
      const streak = team.streak?.length >= 2 ? `, ${team.streak.label}` : "";
      const luck = Number.isFinite(team.luck) && Math.abs(team.luck) >= 1 ? ` [luck ${team.luck > 0 ? "+" : ""}${team.luck.toFixed(1)}]` : "";
      lines.push(`${team.rank}. ${team.name} ${team.recordLabel} (${formatPoints(team.pf)} PF${streak})${luck}`);
    });
    lines.push("");
  }

  if (sim?.results?.length && model?.remainingGames?.length > 0) {
    lines.push("PLAYOFF PICTURE");
    sim.results
      .slice()
      .sort((a, b) => b.playoffPct - a.playoffPct || b.titlePct - a.titlePct)
      .forEach((result) => {
        const previous = previousOdds?.get?.(result.rosterId);
        const delta = previous ? result.playoffPct - previous.playoffPct : null;
        const mover = Number.isFinite(delta) && Math.abs(delta) >= 3 ? ` (${delta > 0 ? "+" : ""}${delta.toFixed(0)})` : "";
        const flag = result.clinched ? " CLINCHED" : result.eliminated ? " ELIMINATED" : "";
        lines.push(`${result.name}: ${formatOddsPct(result.playoffPct)} playoffs${mover}, ${formatOddsPct(result.titlePct)} title${flag}`);
      });
    lines.push(`Based on ${sim.iterations.toLocaleString()} simulated seasons with ${sim.remainingGameCount} games left.`);
    lines.push("");
  }

  lines.push("TRADE DESK");
  if (trades.length === 0) {
    lines.push(tone === "roast" ? "No trades. Twelve managers, zero courage." : tone === "hype" ? "The phones were quiet, but the market is loaded. Somebody blink." : "No completed trades this week.");
  } else {
    trades.forEach((trade) => lines.push(`- ${trade}`));
  }
  lines.push("");
  lines.push(signOff(tone, model, awards));
  return lines.join("\n");
}

function intro({ tone, model, weekLabel, provisional, games }) {
  const teamCount = model?.standings?.length || 0;
  const gameCount = games.length;
  if (provisional) {
    return tone === "roast"
      ? `${weekLabel} is still in progress, so these numbers are live and somebody's Monday night is about to get ruined.`
      : tone === "hype"
        ? `${weekLabel} is LIVE. ${gameCount} games on the board and every one of them matters.`
        : `${weekLabel} is in progress. Scores below are live and will move.`;
  }
  if (tone === "roast") return `${weekLabel} is in the books. ${teamCount} teams showed up, several of them regretted it.`;
  if (tone === "hype") return `${weekLabel} is FINAL and the league will never be the same. ${gameCount} games, ${gameCount} stories.`;
  return `${weekLabel} is final. Here is the desk report for all ${teamCount} teams.`;
}

function gameTag(game, tone, provisional) {
  if (provisional) return "";
  if (game.margin >= 50) return tone === "roast" ? " (a crime scene)" : tone === "hype" ? " (DEMOLITION)" : " (blowout)";
  if (game.margin > 0 && game.margin <= 3) return tone === "roast" ? " (someone left points on the bench)" : tone === "hype" ? " (PHOTO FINISH)" : " (nail-biter)";
  return "";
}

function awardLine(award, tone) {
  const bank = LINES[award.id] || LINES.default;
  const options = bank[tone] || bank.desk;
  return pick(options, `${award.id}:${award.teamName}:${award.valueLabel}`);
}

function signOff(tone, model, awards) {
  const leader = model?.standings?.[0];
  if (tone === "roast") {
    return leader && leader.wins > 0
      ? `${leader.name} is in first place, which says more about the rest of you than about ${leader.name}.`
      : "Set your lineups. Some of you clearly did not.";
  }
  if (tone === "hype") {
    return leader && leader.wins > 0
      ? `${leader.name} sits on the throne for now. Everyone else: the chase is ON.`
      : "New week, new legends. Lock in.";
  }
  const mvp = awards.find((award) => award.id === "mvp");
  return mvp
    ? `Player of the Week honors go to ${mvp.detail.replace(/ carried .*$/, "")}. Back next week.`
    : "Back next week with the full desk report.";
}

function pick(options, key) {
  if (!options?.length) return "";
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return options[hash % options.length];
}

const LINES = {
  "top-score": {
    desk: ["Highest score on the board.", "Top of the week, no debate.", "Set the pace for everyone else."],
    hype: ["ABSOLUTE CEILING GAME.", "They did not come to play, they came to end careers.", "Franchise-record energy."],
    roast: ["Congrats on beating a sleeping league.", "Enjoy it, regression is already in the group chat.", "Big week. Bigger ego by Tuesday."],
  },
  "low-score": {
    desk: ["Lowest score of the week.", "A rough Sunday on every level.", "The floor was found."],
    hype: ["Every dynasty has a dark chapter. This was one.", "The bounce-back arc starts NOW.", "Rock bottom is a launch pad."],
    roast: ["Bye week? No. Just vibes.", "The bench had more points and less shame.", "Please check that your app is still installed."],
  },
  blowout: {
    desk: ["Biggest margin of the week.", "Never close.", "Over by halftime."],
    hype: ["DEMOLITION JOB.", "A statement win with a megaphone.", "Total control from kickoff."],
    roast: ["That was not a matchup, that was a mercy rule.", "The loser should have to read this out loud.", "Somebody call a doctor for the other side."],
  },
  closest: {
    desk: ["Closest finish of the week.", "Decided by a single stat line.", "Down to the final snap."],
    hype: ["HEART. ATTACK. FINISH.", "Decided on the last play, as it should be.", "Two teams, one legend."],
    roast: ["Won by less than a kicker's mood swing.", "The loser is still re-checking the box score.", "Nobody deserved to win that one."],
  },
  "bad-beat": {
    desk: ["Scored well, lost anyway.", "A schedule loss, not a roster loss.", "Would have beaten almost anyone else."],
    hype: ["Robbed. Straight up robbed.", "The unluckiest big performance of the week.", "The universe owes this team one."],
    roast: ["Great score. Wrong week. Skill issue in scheduling.", "Put up numbers, still went home sad.", "The football gods laughed."],
  },
  lucky: {
    desk: ["Won with the lowest winning score.", "A win is a win.", "Escaped with the victory."],
    hype: ["SURVIVE AND ADVANCE.", "Ugly wins count the same in December.", "Winners find a way."],
    roast: ["Stole a win with a score that should be illegal.", "Won by scheduling, not by managing.", "Someone bought a lottery ticket this week."],
  },
  mvp: {
    desk: ["Top individual performance of the week.", "The best start on any roster.", "Weekly MVP."],
    hype: ["LEAGUE WINNER BEHAVIOR.", "That is a franchise cornerstone doing cornerstone things.", "Untouchable this week."],
    roast: ["Carried a manager who did nothing to deserve it.", "One player did all the work. Again.", "The trade offers are already incoming."],
  },
  "bench-blunder": {
    desk: ["Most points left on the bench.", "The optimal lineup told a different story.", "A lineup decision that cost real points."],
    hype: ["The bench BALLED OUT. Wrong place, wrong time.", "That is a lesson, not a loss.", "Imagine the ceiling when the lineup is right."],
    roast: ["Set the lineup with your eyes closed, apparently.", "The bench outscored the decision-making.", "Start your studs. Please. For all of us."],
  },
  default: {
    desk: ["Noted for the record."],
    hype: ["History was made."],
    roast: ["The league will remember."],
  },
};

export function buildTradeRecapLine(summary) {
  return summary;
}

const RECAP_TRADE_WINDOW_DAYS = 7;
const WEEK_START_TIME_ZONE = "America/New_York";

export function resolveSeasonStartDate(league, nflState) {
  const leagueSeason = String(league?.season || "");
  const nflSeason = String(nflState?.season || nflState?.league_season || "");
  if (leagueSeason && nflSeason === leagueSeason && nflState?.season_start_date) {
    return String(nflState.season_start_date);
  }
  if (/^\d{4}$/.test(leagueSeason)) return inferNflKickoffDate(Number(leagueSeason));
  if (nflState?.season_start_date) return String(nflState.season_start_date);
  return "";
}

export function inferNflKickoffDate(year) {
  const weekday = new Date(Date.UTC(year, 8, 1)).getUTCDay();
  const firstMonday = weekday === 1 ? 1 : ((8 - weekday) % 7) + 1;
  const kickoffDay = firstMonday + 3;
  return `${year}-09-${String(kickoffDay).padStart(2, "0")}`;
}

export function buildRecapTradeWindow({ week, seasonStartDate }) {
  const recapWeek = Number(week);
  if (!Number.isFinite(recapWeek) || recapWeek < 1) return null;
  const startMs = getNflWeekStartMs(seasonStartDate, recapWeek);
  const endMs = getNflWeekStartMs(seasonStartDate, recapWeek + 1);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return null;
  return { startMs, endMs };
}

export function isTradeInRecapWindow(transaction, window) {
  if (!window) return false;
  const timestamp = transactionTimeMs(transaction);
  if (timestamp == null) return false;
  return timestamp >= window.startMs && timestamp < window.endMs;
}

export function selectRecapTrades(transactions, { week, seasonStartDate }) {
  const window = buildRecapTradeWindow({ week, seasonStartDate });
  if (!window) return [];
  return (Array.isArray(transactions) ? transactions : []).filter(
    (transaction) => transaction?.type === "trade" && transaction?.status === "complete" && isTradeInRecapWindow(transaction, window)
  );
}

function transactionTimeMs(transaction) {
  let timestamp = Number(transaction?.status_updated || transaction?.created || 0);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return null;
  if (timestamp < 1e12) timestamp *= 1000;
  return timestamp;
}

function getNflWeekStartMs(seasonStartDate, weekNumber) {
  const parsed = parseIsoDate(seasonStartDate);
  if (!parsed) return null;
  const shifted = addUtcDays(parsed.year, parsed.month, parsed.day, (Number(weekNumber) - 1) * RECAP_TRADE_WINDOW_DAYS);
  return zonedLocalToUtcMs(shifted.year, shifted.month, shifted.day, 0, 0, WEEK_START_TIME_ZONE);
}

function parseIsoDate(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

function addUtcDays(year, month, day, delta) {
  const date = new Date(Date.UTC(year, month - 1, day + delta));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

function zonedLocalToUtcMs(year, month, day, hour, minute, timeZone) {
  const asUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
  const offset = getTimeZoneOffsetMs(new Date(asUtc), timeZone);
  const adjusted = asUtc - offset;
  const offset2 = getTimeZoneOffsetMs(new Date(adjusted), timeZone);
  return offset2 === offset ? adjusted : asUtc - offset2;
}

function getTimeZoneOffsetMs(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const map = {};
  parts.forEach((part) => {
    if (part.type !== "literal") map[part.type] = part.value;
  });
  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second)
  );
  return asUtc - date.getTime();
}

export { formatRecord, ordinal };
