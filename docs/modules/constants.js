export const API_BASE = "https://api.sleeper.app/v1";
export const SLEEPER_AVATAR_BASE = "https://sleepercdn.com/avatars/thumbs/";
export const SAMPLE_VALUES_PATH = "./data/ktc_values_sample.csv";
export const PLAYERS_CACHE_TTL_MS = 1000 * 60 * 60 * 24;
export const SIM_ITERATIONS = 4000;
// Desk hierarchy: three top-level pages, each with a row of rooms.
// Every room is a URL-addressable place (`?tab=<page>&view=<room>`).
// League "start" is a real room but is hidden from the room nav: it is the
// home screen when a league first opens, or when the logo / home control is hit.
export const PAGE_IDS = ["league", "teams", "trades"];
export const DEFAULT_PAGE = "league";
export const HOME_ROOM = "start";
export const PAGE_LABELS = {
  league: "League",
  teams: "Teams",
  trades: "Trades",
};
export const PAGE_HINTS = {
  league: "Scores, standings, history",
  teams: "Roster, tank or contend, mock",
  trades: "Calculator, partners, deals",
};
export const PAGE_ROOMS = {
  league: ["start", "scores", "standings", "power", "awards", "history"],
  teams: ["roster", "call", "loyalty", "passports", "mock"],
  trades: ["value", "match", "calculator", "lab", "log"],
};
export const DEFAULT_ROOMS = {
  league: "start",
  teams: "roster",
  trades: "value",
};
export const ROOM_LABELS = {
  league: {
    start: "Start",
    scores: "Scores",
    standings: "Standings",
    power: "Power",
    awards: "Awards",
    history: "League History",
  },
  teams: {
    roster: "Roster",
    call: "Tank or contend",
    loyalty: "Who stayed",
    passports: "Player passport",
    mock: "Mock",
  },
  trades: {
    value: "Calculator",
    calculator: "Two teams",
    match: "Partners",
    lab: "Find deals",
    log: "Log",
  },
};
export const ROOM_HINTS = {
  league: {
    start: "Pick what you want to do",
    scores: "This week's matchups and win odds",
    standings: "Table, playoff odds, luck",
    power: "Dynasty value rankings",
    awards: "Weekly honors and superlatives",
    history: "Last champion, titles, and a few records",
  },
  teams: {
    roster: "Sit/start this week, scout card, picks",
    call: "Tank, all in, or stay in the middle",
    loyalty: "Roster DNA, ironmen, charms",
    passports: "Who owned each player, season by season",
    mock: "2027 SF rookie mock board",
  },
  trades: {
    value: "Blank board: search any player or pick in one box",
    calculator: "Build both sides from two rosters and get a verdict",
    match: "Teams that have your holes and need your extras",
    lab: "Shop an asset, acquire a target, blockbuster",
    log: "Graded past deals and the league wire",
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
  history: "league",
  hall: "league",
  analytics: "league",
  archive: "league",
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
  // Teams rooms.
  roster: { page: "teams", room: "roster" },
  lineup: { page: "teams", room: "roster" },
  scout: { page: "teams", room: "roster" },
  mock: { page: "teams", room: "mock" },
  mocks: { page: "teams", room: "mock" },
  rookies: { page: "teams", room: "mock" },
  rookiemock: { page: "teams", room: "mock" },
  "rookie-mock": { page: "teams", room: "mock" },
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
  value: { page: "trades", room: "value" },
  ktc: { page: "trades", room: "value" },
  "any-assets": { page: "trades", room: "value" },
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
};
// Room words whose meaning depends on the page they were attached to.
export const SCOPED_ROOM_ALIASES = {
  league: { now: "scores", home: "start", hall: "history", analytics: "history" },
  trades: { history: "log", calculator: "calculator", calc: "calculator" },
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
