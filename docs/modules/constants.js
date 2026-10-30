export const API_BASE = "https://api.sleeper.app/v1";
// Public 2026 Superflex dynasty league ("The Front Office", 12 teams).
// ?sample=1 opens it. Do not pin a manager.
export const SAMPLE_LEAGUE_ID = "1360686137898700800";
export const SLEEPER_AVATAR_BASE = "https://sleepercdn.com/avatars/thumbs/";
// Injury and status move during the week. Expire even when the NFL state
// key has not changed, so a Sunday designation does not sit until next week.
export const PLAYERS_CACHE_TTL_MS = 1000 * 60 * 60 * 6;
export const SIM_ITERATIONS = 4000;
// Three tabs: Check a trade, Find a trade, My team.
// Check a trade and Find a trade are two rooms of the trades page; the player
// board lives under Check a trade. Old page and room names stay as aliases so
// existing links still open.
export const PAGE_IDS = ["trades", "league"];
export const DEFAULT_PAGE = "trades";
export const HOME_ROOM = "team";
export const NAV_TABS = Object.freeze([
  { id: "check", page: "trades", room: "calculator", label: "Check a trade", hint: "Is this offer fair?" },
  { id: "find", page: "trades", room: "find", label: "Find a trade", hint: "Deals that fit both teams" },
  { id: "team", page: "league", room: "team", label: "My team", hint: "Roster, standings, playoff odds" },
]);
export const PAGE_LABELS = {
  trades: "Trade",
  league: "My team",
};
export const PAGE_HINTS = {
  trades: "Check a trade or find one",
  league: "Roster, standings, and playoff odds",
};
export const PAGE_ROOMS = {
  trades: ["calculator", "find"],
  league: ["team"],
};
export const DEFAULT_ROOMS = {
  trades: "calculator",
  league: "team",
};
export const ROOM_LABELS = {
  trades: {
    calculator: "Check a trade",
    find: "Find a trade",
  },
  league: {
    team: "My team",
  },
};
export const ROOM_HINTS = {
  trades: {
    calculator: "You give and you get. Works before you connect a league",
    find: "1-for-1 and 2-for-1 ideas from team needs",
  },
  league: {
    team: "Roster value, picks, standings, and playoff odds",
  },
};

// Backward-compatible aliases. Old links used other tab names and room names;
// each alias resolves to a { page, room } place. A null room means "page default".
export const PAGE_ALIASES = {
  players: "trades",
  player: "trades",
  trades: "trades",
  trader: "trades",
  trade: "trades",
  league: "league",
  home: "league",
  now: "league",
  week: "league",
  teams: "league",
  team: "league",
  myteam: "league",
  "my-team": "league",
  history: "league",
  hall: "league",
  analytics: "league",
  archive: "league",
};
export const PLACE_ALIASES = {
  value: { page: "trades", room: "calculator" },
  ktc: { page: "trades", room: "calculator" },
  ranks: { page: "trades", room: "calculator" },
  rank: { page: "trades", room: "calculator" },
  playervalues: { page: "trades", room: "calculator" },
  "player-values": { page: "trades", room: "calculator" },
  "any-assets": { page: "trades", room: "calculator" },
  calculator: { page: "trades", room: "calculator" },
  calc: { page: "trades", room: "calculator" },
  ask: { page: "trades", room: "calculator" },
  offer: { page: "trades", room: "calculator" },
  passports: { page: "trades", room: "calculator" },
  passport: { page: "trades", room: "calculator" },
  stamps: { page: "trades", room: "calculator" },
  players: { page: "trades", room: "calculator" },
  player: { page: "trades", room: "calculator" },
  find: { page: "trades", room: "find" },
  match: { page: "trades", room: "find" },
  tradematch: { page: "trades", room: "find" },
  partners: { page: "trades", room: "find" },
  needs: { page: "trades", room: "find" },
  lab: { page: "trades", room: "find" },
  generator: { page: "trades", room: "find" },
  shop: { page: "trades", room: "find" },
  acquire: { page: "trades", room: "find" },
  blockbuster: { page: "trades", room: "find" },
  finddeals: { page: "trades", room: "find" },
  ideas: { page: "trades", room: "find" },
  start: { page: "league", room: "team" },
  jobs: { page: "league", room: "team" },
  welcome: { page: "league", room: "team" },
  team: { page: "league", room: "team" },
  roster: { page: "league", room: "team" },
  lineup: { page: "league", room: "team" },
  scout: { page: "league", room: "team" },
  call: { page: "league", room: "team" },
  window: { page: "league", room: "team" },
  tank: { page: "league", room: "team" },
  contend: { page: "league", room: "team" },
  contending: { page: "league", room: "team" },
  rebuild: { page: "league", room: "team" },
  "all-in": { page: "league", room: "team" },
  allin: { page: "league", room: "team" },
  strategy: { page: "league", room: "team" },
  standings: { page: "league", room: "team" },
  odds: { page: "league", room: "team" },
  playoffs: { page: "league", room: "team" },
  scores: { page: "league", room: "team" },
  scoreboard: { page: "league", room: "team" },
  matchups: { page: "league", room: "team" },
  luck: { page: "league", room: "team" },
  board: { page: "league", room: "team" },
  power: { page: "league", room: "team" },
  rankings: { page: "league", room: "team" },
  awards: { page: "league", room: "team" },
  recap: { page: "league", room: "team" },
  history: { page: "league", room: "team" },
  hall: { page: "league", room: "team" },
  titles: { page: "league", room: "team" },
  seasons: { page: "league", room: "team" },
  archive: { page: "league", room: "team" },
  compare: { page: "league", room: "team" },
  records: { page: "league", room: "team" },
  recordbook: { page: "league", room: "team" },
  analytics: { page: "league", room: "team" },
  mock: { page: "league", room: "team" },
  mocks: { page: "league", room: "team" },
  rookies: { page: "league", room: "team" },
  rookiemock: { page: "league", room: "team" },
  "rookie-mock": { page: "league", room: "team" },
  loyalty: { page: "league", room: "team" },
  dna: { page: "league", room: "team" },
  charms: { page: "league", room: "team" },
  log: { page: "league", room: "team" },
  tradelog: { page: "league", room: "team" },
  tradehistory: { page: "league", room: "team" },
  file: { page: "league", room: "team" },
  wire: { page: "league", room: "team" },
  activity: { page: "league", room: "team" },
  league: { page: "league", room: "team" },
  week: { page: "league", room: "team" },
  now: { page: "league", room: "team" },
  home: { page: "league", room: "team" },
  myteam: { page: "league", room: "team" },
  "my-team": { page: "league", room: "team" },
  teams: { page: "league", room: "team" },
};
export const SCOPED_ROOM_ALIASES = {
  trades: {
    calculator: "calculator",
    calc: "calculator",
    value: "calculator",
    ask: "calculator",
    ranks: "calculator",
    match: "find",
    lab: "find",
  },
};
export const DEFAULT_FAIRNESS_PCT = 20;
export const DEFAULT_MAX_RESULTS = 3;
export const TRANSACTION_WEEK_START = 1;
export const TRANSACTION_WEEK_FALLBACK_END = 18;
export const ANALYTICS_RECENT_TRADE_LIMIT = 6;
export const ANALYTICS_ASSET_LEADER_LIMIT = 8;
export const MAX_HISTORY_SEASONS = 6;
export const HISTORY_TRANSACTION_SEASON_LIMIT = 4;
export const HISTORY_MATCHUP_SEASON_LIMIT = 6;
export const HISTORY_COMPARE_H2H_LIMIT = 6;
export const HISTORY_COMPARE_ROSTER_LIMIT = 8;
export const PHONE_LAYOUT_QUERY = "(max-width: 700px), (max-height: 500px) and (orientation: landscape) and (hover: none) and (pointer: coarse)";
export const LIVE_POLL_INTERVAL_MS = 30000;
export const LIVE_SIM_REFRESH_MS = 180000;
export const MATCHUP_FETCH_CHUNK = 3;
export const LEAGUE_HISTORY_RECORD_IDS = Object.freeze([
  "high",
  "blowout",
  "win-streak",
  "season-points",
]);
