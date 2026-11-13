export const API_BASE = "https://api.sleeper.app/v1";
export const SLEEPER_AVATAR_BASE = "https://sleepercdn.com/avatars/thumbs/";
// Injury and status move during the week. Expire even when the NFL state
// key has not changed, so a Sunday designation does not sit until next week.
export const PLAYERS_CACHE_TTL_MS = 1000 * 60 * 60 * 6;
export const SIM_ITERATIONS = 4000;
// Three tabs: Check a trade, Find a trade, My team.
// Check a trade and Find a trade are two rooms of the trades page; the player
// board lives under Check a trade. Old page and room names stay as aliases so
// existing links still open.
export const PAGE_IDS = ["home", "trades", "leagues", "league"];
export const DEFAULT_PAGE = "home";
export const HOME_ROOM = "team";
export const PAGE_LABELS = {
  home: "Home",
  leagues: "League History",
  trades: "Check a trade",
  league: "My team",
};
export const PAGE_HINTS = {
  home: "Choose a tool",
  leagues: "Choose your Sleeper league",
  trades: "Is this trade fair?",
  league: "Roster, standings, and playoff odds",
};
export const PAGE_ROOMS = {
  home: ["home"],
  leagues: ["picker"],
  trades: ["calculator"],
  league: ["hub", "standings", "team", "trades", "history"],
};
export const DEFAULT_ROOMS = {
  home: "home",
  leagues: "picker",
  trades: "calculator",
  league: "hub",
};
export const ROOM_LABELS = {
  home: { home: "Home" },
  leagues: { picker: "League History" },
  trades: {
    calculator: "Check a trade",
  },
  league: {
    hub: "League hub", standings: "Standings", trades: "Recent Trades", history: "Historical Data",
    team: "My Team",
  },
};
export const ROOM_HINTS = {
  trades: {
    calculator: "You give and you get. Works before you connect a league",
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
  home: "home",
  leagues: "leagues",
  connect: "leagues",
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
  find: { page: "trades", room: "calculator" },
  match: { page: "trades", room: "calculator" },
  tradematch: { page: "trades", room: "calculator" },
  partners: { page: "trades", room: "calculator" },
  needs: { page: "trades", room: "calculator" },
  lab: { page: "trades", room: "calculator" },
  generator: { page: "trades", room: "calculator" },
  shop: { page: "trades", room: "calculator" },
  acquire: { page: "trades", room: "calculator" },
  blockbuster: { page: "trades", room: "calculator" },
  finddeals: { page: "trades", room: "calculator" },
  ideas: { page: "trades", room: "calculator" },
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
  standings: { page: "league", room: "standings" },
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
  history: { page: "league", room: "history" },
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
  home: { page: "home", room: "home" },
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
    match: "calculator",
    lab: "calculator",
  },
};
export const DEFAULT_FAIRNESS_PCT = 20;
export const MAX_HISTORY_SEASONS = 6;
