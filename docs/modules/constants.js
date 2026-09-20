export const API_BASE = "https://api.sleeper.app/v1";
export const SLEEPER_AVATAR_BASE = "https://sleepercdn.com/avatars/thumbs/";
export const SAMPLE_VALUES_PATH = "./data/ktc_values_sample.csv";
export const PLAYERS_CACHE_TTL_MS = 1000 * 60 * 60 * 24;
export const SIM_ITERATIONS = 4000;
// Desk hierarchy: four top-level pages, each with a row of rooms.
// Every room is a URL-addressable place (`?tab=<page>&view=<room>`).
export const PAGE_IDS = ["league", "teams", "trades", "history"];
export const DEFAULT_PAGE = "league";
export const PAGE_LABELS = {
  league: "League",
  teams: "Teams",
  trades: "Trades",
  history: "History",
};
export const PAGE_HINTS = {
  league: "Scores, standings, awards",
  teams: "Roster, tank or contend",
  trades: "Calculator, partners, deals",
  history: "Titles, seasons, records",
};
export const PAGE_ROOMS = {
  league: ["start", "scores", "standings", "power", "awards", "recap"],
  teams: ["roster", "call", "loyalty", "passports"],
  trades: ["calculator", "match", "lab", "log"],
  history: ["hall", "seasons", "records"],
};
export const DEFAULT_ROOMS = {
  league: "start",
  teams: "roster",
  trades: "calculator",
  history: "hall",
};
export const ROOM_LABELS = {
  league: {
    start: "Start",
    scores: "Scores",
    standings: "Standings",
    power: "Power",
    awards: "Awards",
    recap: "Recap",
  },
  teams: {
    roster: "Roster",
    call: "Tank or contend",
    loyalty: "Who stayed",
    passports: "Player stamps",
  },
  trades: {
    log: "Log",
    match: "Partners",
    calculator: "Calculator",
    lab: "Find deals",
  },
  history: {
    hall: "Titles",
    seasons: "Seasons",
    records: "Records",
  },
};
export const ROOM_HINTS = {
  league: {
    start: "Pick what you want to do",
    scores: "This week's matchups and win odds",
    standings: "Table, playoff odds, luck",
    power: "Dynasty value rankings",
    awards: "Weekly honors and superlatives",
    recap: "Group-chat recap and image card",
  },
  teams: {
    roster: "Sit/start this week, scout card, picks",
    call: "Tank, all in, or stay in the middle",
    loyalty: "Roster DNA, ironmen, charms",
    passports: "Who owned each player, season by season",
  },
  trades: {
    log: "Graded past deals and the league wire",
    match: "Teams that have your holes and need your extras",
    calculator: "Build both sides and get a verdict",
    lab: "Shop an asset, acquire a target, blockbuster",
  },
  history: {
    hall: "Titles, career records, finish matrix",
    seasons: "Season ledger and comparisons",
    records: "All-time record book",
  },
};

// Backward-compatible aliases. Old links used other tab names and room names;
// each alias resolves to a { page, room } place. A null room means "page default".
export const PAGE_ALIASES = {
  league: "league",
  home: "league",
  now: "league",
  teams: "teams",
  team: "teams",
  myteam: "teams",
  "my-team": "teams",
  trades: "trades",
  trader: "trades",
  trade: "trades",
  history: "history",
  hall: "history",
  analytics: "history",
  archive: "history",
};
export const PLACE_ALIASES = {
  // League rooms.
  start: { page: "league", room: "start" },
  jobs: { page: "league", room: "start" },
  welcome: { page: "league", room: "start" },
  scores: { page: "league", room: "scores" },
  scoreboard: { page: "league", room: "scores" },
  matchups: { page: "league", room: "scores" },
  standings: { page: "league", room: "standings" },
  odds: { page: "league", room: "standings" },
  playoffs: { page: "league", room: "standings" },
  luck: { page: "league", room: "standings" },
  power: { page: "league", room: "power" },
  rankings: { page: "league", room: "power" },
  awards: { page: "league", room: "awards" },
  recap: { page: "league", room: "recap" },
  // Teams rooms.
  roster: { page: "teams", room: "roster" },
  lineup: { page: "teams", room: "roster" },
  scout: { page: "teams", room: "roster" },
  call: { page: "teams", room: "call" },
  window: { page: "teams", room: "call" },
  tank: { page: "teams", room: "call" },
  contend: { page: "teams", room: "call" },
  contending: { page: "teams", room: "call" },
  rebuild: { page: "teams", room: "call" },
  "all-in": { page: "teams", room: "call" },
  allin: { page: "teams", room: "call" },
  strategy: { page: "teams", room: "call" },
  loyalty: { page: "teams", room: "loyalty" },
  dna: { page: "teams", room: "loyalty" },
  charms: { page: "teams", room: "loyalty" },
  passports: { page: "teams", room: "passports" },
  passport: { page: "teams", room: "passports" },
  stamps: { page: "teams", room: "passports" },
  // Trades rooms.
  log: { page: "trades", room: "log" },
  tradelog: { page: "trades", room: "log" },
  tradehistory: { page: "trades", room: "log" },
  file: { page: "trades", room: "log" },
  wire: { page: "trades", room: "log" },
  calculator: { page: "trades", room: "calculator" },
  calc: { page: "trades", room: "calculator" },
  match: { page: "trades", room: "match" },
  tradematch: { page: "trades", room: "match" },
  partners: { page: "trades", room: "match" },
  needs: { page: "trades", room: "match" },
  lab: { page: "trades", room: "lab" },
  generator: { page: "trades", room: "lab" },
  shop: { page: "trades", room: "lab" },
  acquire: { page: "trades", room: "lab" },
  blockbuster: { page: "trades", room: "lab" },
  finddeals: { page: "trades", room: "lab" },
  // History rooms.
  hall: { page: "history", room: "hall" },
  titles: { page: "history", room: "hall" },
  seasons: { page: "history", room: "seasons" },
  archive: { page: "history", room: "seasons" },
  compare: { page: "history", room: "seasons" },
  records: { page: "history", room: "records" },
  recordbook: { page: "history", room: "records" },
};
// Room words whose meaning depends on the page they were attached to.
export const SCOPED_ROOM_ALIASES = {
  league: { now: "scores", home: "scores" },
  trades: { history: "log" },
  history: { history: "hall", analytics: "hall" },
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
