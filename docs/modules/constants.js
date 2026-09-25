export const API_BASE = "https://api.sleeper.app/v1";
export const SLEEPER_AVATAR_BASE = "https://sleepercdn.com/avatars/thumbs/";
export const SAMPLE_VALUES_PATH = "./data/ktc_values_sample.csv";
export const PLAYERS_CACHE_TTL_MS = 1000 * 60 * 60 * 24;
export const SIM_ITERATIONS = 4000;
// Three jobs: Players, Trade, My League.
// Old page and room names stay as aliases so existing links still open.
export const PAGE_IDS = ["players", "trades", "league"];
export const DEFAULT_PAGE = "players";
export const HOME_ROOM = "team";
export const PAGE_LABELS = {
  players: "Players",
  trades: "Trade",
  league: "My League",
};
export const PAGE_HINTS = {
  players: "What is this player worth?",
  trades: "Check an offer or find a deal",
  league: "Your team, this week, and the league",
};
export const PAGE_ROOMS = {
  players: ["ranks"],
  trades: ["calculator", "find"],
  league: ["team", "scores", "board", "activity", "history"],
};
export const DEFAULT_ROOMS = {
  players: "ranks",
  trades: "calculator",
  league: "team",
};
export const ROOM_LABELS = {
  players: {
    ranks: "Players",
  },
  trades: {
    calculator: "Check an offer",
    find: "Find a trade",
  },
  league: {
    team: "My team",
    scores: "This week",
    board: "League",
    activity: "Activity",
    history: "History",
  },
};
export const ROOM_HINTS = {
  players: {
    ranks: "Search a player, see the value, add them to a trade",
  },
  trades: {
    calculator: "You give and you get. Works before you connect a league",
    find: "Shop one of yours, target one of theirs, or find a partner",
  },
  league: {
    team: "Your outlook, then the roster",
    scores: "This week's matchups",
    board: "Standings and team ranks",
    activity: "Trades in this league",
    history: "Titles, records, and who stayed",
  },
};

// Backward-compatible aliases. Old links used other tab names and room names;
// each alias resolves to a { page, room } place. A null room means "page default".
export const PAGE_ALIASES = {
  players: "players",
  player: "players",
  league: "league",
  home: "league",
  now: "league",
  week: "league",
  teams: "league",
  team: "league",
  myteam: "league",
  "my-team": "league",
  trades: "trades",
  trader: "trades",
  trade: "trades",
  history: "league",
  hall: "league",
  analytics: "league",
  archive: "league",
};
export const PLACE_ALIASES = {
  start: { page: "league", room: "team" },
  jobs: { page: "league", room: "team" },
  welcome: { page: "league", room: "team" },
  team: { page: "league", room: "team" },
  scores: { page: "league", room: "scores" },
  scoreboard: { page: "league", room: "scores" },
  matchups: { page: "league", room: "scores" },
  standings: { page: "league", room: "board" },
  odds: { page: "league", room: "board" },
  playoffs: { page: "league", room: "board" },
  luck: { page: "league", room: "board" },
  board: { page: "league", room: "board" },
  power: { page: "league", room: "board" },
  rankings: { page: "league", room: "board" },
  awards: { page: "league", room: "history" },
  recap: { page: "league", room: "scores" },
  history: { page: "league", room: "history" },
  hall: { page: "league", room: "history" },
  titles: { page: "league", room: "history" },
  seasons: { page: "league", room: "history" },
  archive: { page: "league", room: "history" },
  compare: { page: "league", room: "history" },
  records: { page: "league", room: "history" },
  recordbook: { page: "league", room: "history" },
  analytics: { page: "league", room: "history" },
  roster: { page: "league", room: "team" },
  lineup: { page: "league", room: "team" },
  scout: { page: "league", room: "team" },
  mock: { page: "league", room: "team" },
  mocks: { page: "league", room: "team" },
  rookies: { page: "league", room: "team" },
  rookiemock: { page: "league", room: "team" },
  "rookie-mock": { page: "league", room: "team" },
  call: { page: "league", room: "team" },
  window: { page: "league", room: "team" },
  tank: { page: "league", room: "team" },
  contend: { page: "league", room: "team" },
  contending: { page: "league", room: "team" },
  rebuild: { page: "league", room: "team" },
  "all-in": { page: "league", room: "team" },
  allin: { page: "league", room: "team" },
  strategy: { page: "league", room: "team" },
  loyalty: { page: "league", room: "history" },
  dna: { page: "league", room: "history" },
  charms: { page: "league", room: "history" },
  passports: { page: "players", room: "ranks" },
  passport: { page: "players", room: "ranks" },
  stamps: { page: "players", room: "ranks" },
  log: { page: "league", room: "activity" },
  tradelog: { page: "league", room: "activity" },
  tradehistory: { page: "league", room: "activity" },
  file: { page: "league", room: "activity" },
  wire: { page: "league", room: "activity" },
  activity: { page: "league", room: "activity" },
  value: { page: "trades", room: "calculator" },
  ktc: { page: "trades", room: "calculator" },
  ranks: { page: "players", room: "ranks" },
  rank: { page: "players", room: "ranks" },
  playervalues: { page: "players", room: "ranks" },
  "player-values": { page: "players", room: "ranks" },
  "any-assets": { page: "trades", room: "calculator" },
  calculator: { page: "trades", room: "calculator" },
  calc: { page: "trades", room: "calculator" },
  find: { page: "trades", room: "find" },
  match: { page: "trades", room: "find" },
  tradematch: { page: "trades", room: "find" },
  partners: { page: "trades", room: "find" },
  needs: { page: "trades", room: "find" },
  ask: { page: "trades", room: "calculator" },
  offer: { page: "trades", room: "calculator" },
  lab: { page: "trades", room: "find" },
  generator: { page: "trades", room: "find" },
  shop: { page: "trades", room: "find" },
  acquire: { page: "trades", room: "find" },
  blockbuster: { page: "trades", room: "find" },
  finddeals: { page: "trades", room: "find" },
};
export const SCOPED_ROOM_ALIASES = {
  league: {
    now: "scores",
    home: "team",
    hall: "history",
    analytics: "history",
    standings: "board",
    power: "board",
    awards: "history",
    roster: "team",
    log: "activity",
  },
  trades: {
    calculator: "calculator",
    calc: "calculator",
    value: "calculator",
    ask: "calculator",
    match: "find",
    lab: "find",
  },
  players: {
    ranks: "ranks",
    value: "ranks",
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
