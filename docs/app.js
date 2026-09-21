import {
  buildSeasonModel,
  simulateSeason,
  computeWeeklyAwards,
  computeSeasonSuperlatives,
  computeRecordBook,
  winProbability,
  buildTeamDistributions,
  formatPoints,
  formatOddsPct,
  ordinal,
  blendSimPrior,
  scoreUpcomingWeekAngles,
} from "./modules/season.js";
import {
  SLEEPER_AVATAR_BASE,
  PLAYERS_CACHE_TTL_MS,
  SIM_ITERATIONS,
  PAGE_IDS,
  PAGE_LABELS,
  DEFAULT_PAGE,
  DEFAULT_ROOMS,
  HOME_ROOM,
  ROOM_LABELS,
  DEFAULT_FAIRNESS_PCT,
  DEFAULT_MAX_RESULTS,
  TRANSACTION_WEEK_START,
  TRANSACTION_WEEK_FALLBACK_END,
  ANALYTICS_RECENT_TRADE_LIMIT,
  ANALYTICS_ASSET_LEADER_LIMIT,
  MAX_HISTORY_SEASONS,
  HISTORY_TRANSACTION_SEASON_LIMIT,
  HISTORY_MATCHUP_SEASON_LIMIT,
  HISTORY_COMPARE_H2H_LIMIT,
  HISTORY_COMPARE_ROSTER_LIMIT,
  PHONE_LAYOUT_QUERY,
  LIVE_POLL_INTERVAL_MS,
  LIVE_SIM_REFRESH_MS,
  MATCHUP_FETCH_CHUNK,
  LEAGUE_HISTORY_RECORD_IDS,
} from "./modules/constants.js";
import { state, sleeper, THEME_STORAGE_KEY, PLAYERS_CACHE_KEY, DEFAULT_THEME, THEME_COLORS } from "./modules/state.js";
import { createLeagueLoader } from "./modules/league-load.js";
import { apiGet, apiGetWithRetry, fetchUserLeagues, mapInChunks } from "./modules/sleeper.js";
import {
  classifyLeagueInput,
  parseLeagueId,
  parseShareParams,
  normalizeDeskTab,
  resolveDeskPlace,
  isRoomOf,
  defaultRoomFor,
  bootSearchFieldValues,
  buildShareUrl as buildShareUrlFromParts,
  uniqueSeasons,
  sortUserLeagues,
} from "./modules/parse.js";
import {
  pickValueBundle,
  selectValueFormat,
  fetchValuationBundles,
  coerceValueMap,
  getAssetValue as marketAssetValue,
  isEstimatedAsset as marketIsEstimated,
  estimatedValue,
  applyElitePlayerValuePremium,
  buildPickValuationCatalog,
  resolvePickAssetValue,
  parsePickAssetId,
  parsePickDescriptor,
  normalizePickBucket,
  getPickBucketAliases,
  formatPickBucketLabel,
  formatGenericPickAssetLabel,
  resolvePickNameForCatalog,
  getAssetPickBucket,
  buildPickLookupMeta,
  buildPickValueLookupIds,
  findPickCatalogValue,
  playerPositionForRaw,
  playerPositionForAsset,
  playerAgeForAsset,
  isInactivePlayerAsset,
  leagueHasSuperflex,
  tepLevel,
  crowdShiftsFromVotes,
  getGlobalMaxPlayerValue,
  KTC_GLOBAL_MAX_FALLBACK,
} from "./modules/values.js";
import {
  composeValuationBundles,
  fetchTradeMarketBundle,
} from "./modules/trade-market.js";
import {
  ageBucketForAsset,
  buildLeagueBoard,
  emptyLeagueBoard,
  isBoomBustAsset,
  readApplyLeagueBoard,
  renderLeagueBoardMarkup,
  renderValueBoardBar,
  shouldShowLeagueAlt,
  writeApplyLeagueBoard,
} from "./modules/league-board.js";
import { createLivePoller, shouldPollLive, shouldRefreshSim, weekRowsFingerprint } from "./modules/live.js";
import { copyTextToClipboard, escapeHtml, formatNumber, formatSignedNumber, formatMatchIdeaCopy, clamp, renderTradeAssetLabel, renderTradeMove } from "./modules/html.js";
import {
  addValueCalcItem,
  clearValueCalcSides,
  emptyValueCalcState,
  listValueCalcAssets,
  removeValueCalcItem,
  sumValueCalcSide,
  valueCalcVerdict,
  withPlayerDirectoryNames,
} from "./modules/value-calc.js";
import {
  CALC_LIST_LIMIT,
  keepCalcSearchFocused,
  planCalcListVisibility,
  renderCalcSearchInput,
  shouldHoldCalcSearchFocus,
} from "./modules/calc-search.js";
import { bindTicker } from "./modules/ticker-scrub.js";
import { leagueHistoryRecords, pickLatestCrown } from "./modules/league-crown.js";
import { jobById, landingSearchHint, renderDeskJobsMarkup, deskJobsForLeague } from "./modules/jobs.js";
import {
  buildTradeMatchProfile,
  packageLooksLikeFiller,
  previewBestMatch,
  proposeMatchDeals,
  rankPartnerMatches,
} from "./modules/trade-match.js";
import {
  combinationsOfSize,
  buildPackages as buildCappedPackages,
  buildTargetPackages as buildCappedTargetPackages,
  walkPackagePairs,
} from "./modules/trade-packages.js";
import {
  buildWeeklyContext,
  buildWeeklyPlayerModel,
  emptyWeeklyValueState,
  fetchNflSchedule,
  loadWeeklyStatWeeks,
  playerIdFromAssetId,
  renderWeeklyPlayerSheet,
  renderWeeklyScoreHelpButton,
  renderWeeklyScoreHelpPop,
  weeklyScoreChipLabel,
  lineupFillValue,
  WEEKLY_SCORE_HINT,
  WEEKLY_SCORE_LABEL,
} from "./modules/weekly-value.js";
import {
  buildSitStart,
  renderSitStartCallout,
} from "./modules/sit-start.js";
import {
  analyzePastTrades,
  analyzeLeagueTradeSides,
  biggestTradeMiss,
  buildHallRows,
  buildPlayerPassport,
  decoratePassport,
  formatSeasonSpan,
  passportJourneyLabel,
  buildRosterDna,
  buildTenure,
  formatRecordLine,
  ironRosterShare,
  loyaltyScore,
  newCorePlayers,
  pickLeagueTradeAwards,
  summarizeCharms,
  winPctFromRecord,
} from "./modules/loyalty.js";
import {
  renderLeaguePickerMarkup,
  renderMeSelectOptions,
  resolveDefaultMeRoster,
} from "./modules/league-search.js";
import {
  leagueKeepsPlayers,
  leagueTypeId,
  leagueTypeLabel,
  leagueUsesFuturePicks,
  marketCaveat,
  pageHintForLeague,
  roomLabelFor,
  roomHintFor,
  roomsForPage,
  visibleRoomFor,
  windowCallHorizon,
} from "./modules/league-format.js";
import {
  buildFranchiseIndex,
  ownerIdFromRoster,
  resolveRosterIdentity,
  takeoverForRoster,
} from "./modules/franchise.js";
import { buildDeskHistorySnapshot, isSameDeskPlace } from "./modules/desk-history.js";
import {
  analyzeWindowCall,
  groupWindowCalls,
  windowCallInputFromDesk,
} from "./modules/window-call.js";
import {
  formatPickWithSelection,
  indexDraftSelections,
  lookupDraftedSelection,
  mergeDraftSelectionIndex,
  ownerKeyByRosterIdFromRosters,
  slotToRosterIdFromDraft,
  sortDraftsForSelectionIngest,
} from "./modules/draft-picks.js";
import {
  buildCurrentPlaceLookup,
  currentPlaceForOwner,
  fetchMockDrafts,
  formatHybridFirstName,
  buildMockBoardModel,
  formatPickSlotLabel,
  formatMockSourceLine,
  mockPickDomId,
  mockPickTarget,
  mockProspectAtSlot,
  nextMockSeason,
  projectedDraftSlot,
  shouldAttachMock,
} from "./modules/mock-drafts.js";
import {
  applyDocumentMeta,
  buildDocumentTitle,
  buildPageDescription,
  tickerDurationSeconds,
} from "./modules/site.js";
import { recordDeskVisit } from "./modules/visits.js";
import {
  DEFAULT_RATHER_FORMAT,
  buildRatherBoard,
  decorateRatherPlayer,
  fetchRatherDraftPicks,
  formatRatherDetail,
  listRatherPlayers,
  pickRatherPair,
  pushRatherRecentKey,
  readRatherRecentKeys,
  readRatherVotes,
  recordRatherVote,
  renderLandingRatherPlaceholder,
  renderRatherMarkup,
} from "./modules/rather.js";
import { fetchRatherCrowdVotes, submitRatherCrowdVote } from "./modules/rather-crowd.js";

const OUTGOING_POOL_LIMIT = 14;
const DEFAULT_MAX_OUTGOING_PACKAGE_SIZE = 3;
const ELITE_MAX_OUTGOING_PACKAGE_SIZE = 4;
const ELITE_TARGET_VALUE_THRESHOLD = 7000;
const STAR_TARGET_VALUE_THRESHOLD = 5000;
const MIN_OUTGOING_ASSET_VALUE = 450;
const LINEUP_EXACT_SOLVER_CANDIDATE_LIMIT = 14;
const LINEUP_EXACT_SOLVER_SLOT_LIMIT = 11;
const LINEUP_CANDIDATE_FLOOR = 6;
const LINEUP_CANDIDATE_BUFFER = 2;
const ELITE_TARGET_ANCHOR_SHARE_BASE = 0.48;
const STAR_TARGET_ANCHOR_SHARE_BASE = 0.4;
const ANCHOR_SHARE_STEP_PER_EXTRA_ASSET = 0.02;
const MAX_TARGET_ANCHOR_SHARE = 0.64;
const ELITE_FRAGMENTATION_TAX_PER_EXTRA_ASSET = 180;
const STAR_FRAGMENTATION_TAX_PER_EXTRA_ASSET = 120;
const BASE_FRAGMENTATION_TAX_PER_EXTRA_ASSET = 70;
const ELITE_VALUE_PREMIUM_TIERS = [
  { floor: 9000, multiplier: 1.32 },
  { floor: 8000, multiplier: 1.27 },
  { floor: 7000, multiplier: 1.21 },
  { floor: 6000, multiplier: 1.15 },
  { floor: 5000, multiplier: 1.09 },
];
const PACKAGE_DIVERSITY_OVERLAP_RATIO = 0.55;
const PACKAGE_DIVERSITY_VALUE_OVERLAP_RATIO = 0.72;
const KTC_RAW_BASE = 0.10;
const KTC_RAW_ELITE_WEIGHT = 0.08;
const KTC_RAW_TRADE_WEIGHT = 0.11;
const KTC_RAW_DEPTH_WEIGHT = 0.18;
const DEFAULT_MULTI_TEAM_COUNT = 3;
const TRENDING_PLAYERS_LIMIT = 30;
const TRENDING_LOOKBACK_HOURS = 24;
const MULTI_TEAM_MAX_EXTRAS_PER_SENDER = 3;
const MULTI_TEAM_VALUE_STEP = 180;
const MULTI_TEAM_VALUE_VARIANTS = 4;
const MULTI_TEAM_FILLER_POOL_LIMIT = 12;
const SHOP_COUNTERPARTY_POOL_LIMIT = 12;
const MULTI_TEAM_BASE_FAIRNESS_BUFFER = 10;
const MULTI_TEAM_PER_TEAM_FAIRNESS_BUFFER = 2;
const MULTI_TEAM_VARIANT_COUNT = 8;
const MULTI_TEAM_SENDER_PACKAGE_OPTION_LIMIT = 6;
const MULTI_TEAM_MAX_FILLER_PAIRS_PER_ASSET = 3;
const MULTI_TEAM_MAX_FILLER_RATIO_BASE = 0.52;
const MULTI_TEAM_MAX_FILLER_RATIO_STEP = 0.04;
const MULTI_TEAM_MAX_FILLER_OVERSHOOT_BASE = 650;
const MULTI_TEAM_MAX_UNREQUESTED_ANCHOR_RATIO_BASE = 0.82;
const MULTI_TEAM_MAX_UNREQUESTED_ANCHOR_RATIO_STEP = 0.18;
const MULTI_TEAM_MAX_FILLER_OVERAGE_RATIO_BASE = 0.18;
const MULTI_TEAM_MAX_FILLER_OVERAGE_RATIO_STEP = 0.05;
const MULTI_TEAM_COMPENSATION_BEAM_WIDTH = 28;
const MULTI_TEAM_COMPENSATION_BRANCH_LIMIT = 12;
const MULTI_TEAM_COMPENSATION_DONOR_LIMIT = 3;
const MULTI_TEAM_COMPENSATION_RECIPIENT_LIMIT = 3;
const MULTI_TEAM_COMPENSATION_ASSET_POOL_LIMIT = 16;
const MULTI_TEAM_COMPENSATION_TOLERANCE = 425;
const AUTO_MULTI_TEAM_MY_ANCHOR_CANDIDATE_LIMIT = 3;
const AUTO_MULTI_TEAM_HELPER_ANCHOR_CANDIDATE_LIMIT = 2;
const AUTO_MULTI_TEAM_HELPER_ANCHOR_CAP_SHARE = 0.68;
const CUSTOM_MULTI_TEAM_BASE_ANCHOR_CANDIDATE_LIMIT = 3;
const CUSTOM_MULTI_TEAM_SECONDARY_ANCHOR_LIMIT = 2;
const CUSTOM_MULTI_TEAM_SECONDARY_ANCHOR_MIN_SHARE = 0.16;
const CUSTOM_MULTI_TEAM_SECONDARY_ANCHOR_MAX_SHARE = 0.78;
const CUSTOM_MULTI_TEAM_ORDER_LIMIT = 12;
const CUSTOM_MULTI_TEAM_PLAN_LIMIT = 18;

const leagueStrengthCache = { key: "", baseline: null };
const weeklyModelCache = { key: "", models: new Map() };

const el = {
  sleeperUsername: document.querySelector("#sleeper-username"),
  usernameSearchForm: document.querySelector("#username-search-form"),
  findLeaguesBtn: document.querySelector("#find-leagues-btn"),
  leaguePicker: document.querySelector("#league-picker"),
  leagueId: document.querySelector("#league-id"),
  leagueLoadForm: document.querySelector("#league-load-form"),
  loadLeagueBtn: document.querySelector("#load-league-btn"),
  leagueStatus: document.querySelector("#league-status"),
  leagueStatusText: document.querySelector("#league-status-text"),
  leagueStatusLoader: document.querySelector("#league-status-loader"),
  chromeLeagueLabel: document.querySelector("#chrome-league-label"),
  chromeManagerLabel: document.querySelector("#chrome-manager-label"),
  chromeModeLabel: document.querySelector("#chrome-mode-label"),
  identitySection: document.querySelector("#identity-section"),
  meSelect: document.querySelector("#me-select"),
  deskNav: document.querySelector("#desk-nav"),
  pageTabs: document.querySelector("#page-tabs"),
  roomNav: document.querySelector("#room-nav"),
  powerSection: document.querySelector("#power-section"),
  powerDashboard: document.querySelector("#power-dashboard"),
  historyDashboard: document.querySelector("#history-dashboard"),
  playerSection: document.querySelector("#player-section"),
  tradeModeSelect: document.querySelector("#trade-mode-select"),
  modeCards: document.querySelectorAll("[data-trade-mode]"),
  tradeModeHelp: document.querySelector("#trade-mode-help"),
  playerSearchLabel: document.querySelector("#player-search-label"),
  targetSearchShell: document.querySelector("#target-search-shell"),
  targetChip: document.querySelector("#target-chip"),
  targetChipLabel: document.querySelector("#target-chip-label"),
  clearTargetBtn: document.querySelector("#clear-target-btn"),
  playerSearch: document.querySelector("#player-search"),
  playerResults: document.querySelector("#player-results"),
  settingsSection: document.querySelector("#settings-section"),
  generateBtn: document.querySelector("#generate-btn"),
  generateHelp: document.querySelector("#generate-help"),
  resultsSection: document.querySelector("#results-section"),
  resultsSubtitle: document.querySelector("#results-subtitle"),
  resultsList: document.querySelector("#results-list"),
  workspace: document.querySelector(".workspace"),
  pageTabButtons: document.querySelectorAll(".page-tab"),
  pages: Object.fromEntries(PAGE_IDS.map((page) => [page, document.querySelector(`#${page}-page`)])),
  scoresDashboard: document.querySelector("#scores-dashboard"),
  startDashboard: document.querySelector("#start-dashboard"),
  standingsDashboard: document.querySelector("#standings-dashboard"),
  powerBoardDashboard: document.querySelector("#power-board-dashboard"),
  teamsGrid: document.querySelector("#teams-grid"),
  powerHeading: document.querySelector("#power-heading"),
  rosterSheet: document.querySelector("#roster-sheet"),
  rosterSheetHeading: document.querySelector("#roster-sheet-heading"),
  weeklyHelpBtn: document.querySelector("#weekly-help-btn"),
  weeklyHelpLayerHost: document.querySelector("#weekly-help-layer-host"),
  awardsDashboard: document.querySelector("#awards-dashboard"),
  loyaltyDashboard: document.querySelector("#loyalty-dashboard"),
  windowCallDashboard: document.querySelector("#window-call-dashboard"),
  passportDashboard: document.querySelector("#passport-dashboard"),
  mockDashboard: document.querySelector("#mock-dashboard"),
  tradeLogDashboard: document.querySelector("#trade-log-dashboard"),
  tradeMatchNeeds: document.querySelector("#trade-match-needs"),
  tradeMatchDashboard: document.querySelector("#trade-match-dashboard"),
  matchGenerateBtn: document.querySelector("#match-generate-btn"),
  matchGenerateHelp: document.querySelector("#match-generate-help"),
  matchGenerateError: document.querySelector("#match-generate-error"),
  ticker: document.querySelector("#ticker"),
  tickerTrack: document.querySelector("#ticker-track"),
  calculatorSection: document.querySelector("#calculator-section"),
  calculatorShell: document.querySelector("#calculator-shell"),
  valueCalculatorShell: document.querySelector("#value-calculator-shell"),
  themeToggleBtn: document.querySelector("#theme-toggle-btn"),
  homeBtn: document.querySelector("#home-btn"),
  landingFindBtn: document.querySelector("#landing-find-btn"),
  landingUsername: document.querySelector("#landing-username"),
  landingUsernameForm: document.querySelector("#landing-username-form"),
  landingUsernameError: document.querySelector("#landing-username-error"),
  landingJobs: document.querySelector("#landing-jobs"),
  landingJobHint: document.querySelector("#landing-job-hint"),
  landingLeaguePicker: document.querySelector("#landing-league-picker"),
  landingRather: document.querySelector("#landing-rather"),
  landingLoading: document.querySelector("#landing-loading"),
  landingLoadingText: document.querySelector("#landing-loading-text"),
  usernameError: document.querySelector("#username-error"),
  leagueIdError: document.querySelector("#league-id-error"),
  generateError: document.querySelector("#generate-error"),
  stickyMobileCta: document.querySelector("#sticky-mobile-cta"),
  stickyFindBtn: document.querySelector("#sticky-find-btn"),
  mobileChromeTitle: document.querySelector("#mobile-chrome-title"),
  mobileRailToggle: document.querySelector("#mobile-rail-toggle"),
  mobileRailClose: document.querySelector("#mobile-rail-close"),
  mobileThemeBtn: document.querySelector("#mobile-theme-btn"),
  mobileThemeIcon: document.querySelector("#mobile-theme-icon"),
  mobileThemeLabel: document.querySelector("#mobile-theme-label"),
  mobileHomeBtn: document.querySelector("#mobile-home-btn"),
  railBackdrop: document.querySelector("#rail-backdrop"),
  controlRail: document.querySelector("#control-rail"),
  heroTitle: document.querySelector("#hero-title"),
  heroLede: document.querySelector("#hero-lede"),
  heroEyebrow: document.querySelector("#hero-eyebrow"),
  leagueAvatar: document.querySelector("#league-avatar"),
};

const leagueLoader = createLeagueLoader();
let leagueLoadAnimationTimer = null;
let leagueLoadStartedAt = 0;
let livePoller = null;
let tickerController = null;
let tickerFingerprint = "";
let liveVisibilityBound = false;
let userSearchPromise = null;
let lastSimSignature = "";
let leagueTradeSideCache = { key: "", sides: [] };
let franchiseIndexCache = { key: "", index: null };
let applyingHistory = false;
let managerSelectorHydrating = false;
let managerSelectorHydrateEpoch = 0;
let ratherPromptPair = null;
let ratherSeasonStatsCache = { season: "", stats: null };
let landingSearchOffscreen = false;
let landingSearchObserver = null;
let ratherPromptContext = {
  nflPlayers: {},
  seasonStats: {},
  draftPicks: {},
  currentSeason: "",
  previousSeason: "",
};

function getAssetValue(asset, values = state.values, extra = {}) {
  const { applyLeagueBoard, ...rest } = extra;
  return marketAssetValue(asset, values, {
    valueNameMap: state.valueNameMap,
    pickCatalog: state.pickValueCatalog,
    league: state.league,
    crowdShifts: state.crowdShifts,
    leagueShifts: state.leagueBoard?.shifts,
    ...rest,
    applyLeagueBoard: applyLeagueBoard ?? state.applyLeagueBoard,
  });
}

function isEstimatedAsset(asset, values = state.values) {
  return marketIsEstimated(asset, values, {
    valueNameMap: state.valueNameMap,
    pickCatalog: state.pickValueCatalog,
  });
}

el.usernameSearchForm?.addEventListener("submit", requestFindLeagues);
el.leaguePicker?.addEventListener("click", handleLeaguePickClick);
el.landingLeaguePicker?.addEventListener("click", handleLeaguePickClick);
el.landingJobs?.addEventListener("click", handleLandingJobClick);
el.leagueLoadForm?.addEventListener("submit", requestLoadLeague);
el.loadLeagueBtn?.addEventListener("pointerdown", handleLoadLeaguePointerDown);
el.loadLeagueBtn?.addEventListener("click", requestLoadLeague);
el.leagueId?.addEventListener("focus", (event) => {
  if (!event.currentTarget.value) return;
  event.currentTarget.select();
});
el.leagueId?.addEventListener("mouseup", (event) => {
  if (!event.currentTarget.value) return;
  event.preventDefault();
  event.currentTarget.select();
});
el.leagueId?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    requestLoadLeague(event);
  }
});
el.pageTabButtons?.forEach((button) => {
  button.addEventListener("click", () => {
    if (button.dataset.page === state.activePage) {
      // Re-tapping the active tab returns to that page's first room.
      openRoom(state.activePage, defaultRoomFor(state.activePage));
      return;
    }
    setActivePage(button.dataset.page, { history: "push", scroll: "top" });
  });
});
el.roomNav?.addEventListener("click", (event) => {
  const item = event.target.closest("[data-room]");
  if (!item) return;
  event.preventDefault();
  openRoom(state.activePage, item.dataset.room);
});
el.roomNav?.addEventListener("keydown", handleRoomTabKeydown);
el.pageTabs?.addEventListener("keydown", handlePageTabKeydown);
el.themeToggleBtn?.addEventListener("click", () => applyTheme(state.theme === "dark" ? "light" : "dark"));
el.mobileThemeBtn?.addEventListener("click", () => applyTheme(state.theme === "dark" ? "light" : "dark"));
el.mobileRailToggle?.addEventListener("click", () => {
  const nextOpen = !document.body.classList.contains("rail-open");
  setMobileRailOpen(nextOpen);
  if (nextOpen) {
    requestAnimationFrame(() => el.mobileRailClose?.focus());
  }
});
el.mobileRailClose?.addEventListener("click", () => setMobileRailOpen(false));
el.railBackdrop?.addEventListener("click", () => setMobileRailOpen(false));
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (state.weeklyValue?.helpOpen) {
    event.preventDefault();
    setWeeklyScoreHelpOpen(false);
    return;
  }
  if (document.body.classList.contains("rail-open")) {
    setMobileRailOpen(false);
    el.mobileRailToggle?.focus();
  }
});
el.landingRather?.addEventListener("click", handleLandingRatherClick);
document.addEventListener("click", (event) => {
  const home = event.target.closest("[data-action='league-home']");
  if (!home) return;
  event.preventDefault();
  goLeagueHome();
});
document.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const home = event.target.closest("[data-action='league-home']");
  if (!home || event.target !== home) return;
  event.preventDefault();
  goLeagueHome();
});
window.matchMedia(PHONE_LAYOUT_QUERY).addEventListener("change", () => {
  setMobileRailOpen(false);
});
el.landingUsernameForm?.addEventListener("submit", requestFindLeagues);
el.stickyFindBtn?.addEventListener("click", focusUsernameSearch);
el.sleeperUsername?.addEventListener("input", () => {
  syncUsernameFields(el.sleeperUsername);
  setUsernameError("");
});
el.landingUsername?.addEventListener("input", () => {
  syncUsernameFields(el.landingUsername);
  setUsernameError("");
});
el.leagueId?.addEventListener("input", () => setFieldError(el.leagueId, el.leagueIdError, ""));
el.workspace?.addEventListener("click", handleWorkspaceClick);
el.workspace?.addEventListener("keydown", handleWorkspaceKeydown);
el.workspace?.addEventListener("pointerdown", handleWorkspacePointerDown);
el.workspace?.addEventListener("change", handleWorkspaceChange);
el.workspace?.addEventListener("input", handleWorkspaceInput);
syncWeeklyScoreHelp();
el.playerSearch?.addEventListener("input", () => {
  invalidateResults();
  renderPlayerSearch();
});
el.tradeModeSelect?.addEventListener("change", () => {
  invalidateResults();
  syncTradeModeUi();
});
el.modeCards?.forEach((button) => {
  button.addEventListener("click", () => {
    if (!el.tradeModeSelect) return;
    el.tradeModeSelect.value = button.dataset.tradeMode || "shop";
    invalidateResults();
    syncTradeModeUi();
  });
});
el.clearTargetBtn?.addEventListener("click", clearTargetAsset);
el.meSelect?.addEventListener("change", () => {
  if (managerSelectorHydrating) return;
  invalidateResults();
  state.meRosterId = Number(el.meSelect.value);
  state.mePickedByUser = true;
  state.lensRosterId = null;
  resetCalculatorState({ keepPartner: false });
  clearTradeMatchCache();
  renderPlayerSearch();
  pruneSelectedOutgoingAssets();
  pruneExcludedOutgoingAssets();
  syncTradeModeUi();
  renderActivePage();
  renderSessionSnapshot();
  updateUrlState({ mode: "replace" });
});
el.generateBtn?.addEventListener("click", generateTradeIdeas);
el.matchGenerateBtn?.addEventListener("click", () => {
  void generateTradeMatches({ userRequested: true });
});
el.seasonsDashboard?.addEventListener("click", handleHistoryCompareClick);
el.seasonsDashboard?.addEventListener("change", handleHistoryCompareChange);

applyTheme(readStoredTheme(), { persist: false });
state.applyLeagueBoard = readApplyLeagueBoard();
renderSessionSnapshot();
syncTradeModeUi();
void recordDeskVisit();
bootFromUrl();
void bootLandingRather();
void hydrateCrowdVotes().then((ok) => {
  if (!ok) return;
  refreshCrowdShifts();
  refreshPlayerPositionRanks();
  if (state.leagueId) {
    renderActivePage();
    renderSessionSnapshot();
  }
});
if (typeof history.scrollRestoration === "string") history.scrollRestoration = "manual";
window.addEventListener("popstate", (event) => applyDeskPopState(event.state));
if (isPhoneLayout()) setMobileRailOpen(false);
syncDocumentMeta();
watchLandingSearchVisibility();
syncSiteDock();

// ---------------------------------------------------------------------------
// Desk navigation: three pages, each with a row of rooms
// ---------------------------------------------------------------------------

function visibleRooms(page) {
  return roomsForPage(page, state.league);
}

function clampRoom(page, room) {
  return visibleRoomFor(page, room, state.league) || defaultRoomFor(page);
}

function clampRoomsToLeague() {
  PAGE_IDS.forEach((page) => {
    state.rooms[page] = clampRoom(page, state.rooms?.[page]);
  });
}

function getRoom(page = state.activePage) {
  return clampRoom(page, state.rooms?.[page]);
}

function setRoom(page, room) {
  if (!PAGE_IDS.includes(page)) return;
  state.rooms[page] = clampRoom(page, room);
}

function openRoom(page, room, { history = "push", scroll = "top" } = {}) {
  const nextPage = PAGE_IDS.includes(page) ? page : DEFAULT_PAGE;
  const nextRoom = clampRoom(nextPage, isRoomOf(nextPage, room) ? room : defaultRoomFor(nextPage));
  const samePlace = state.activePage === nextPage && getRoom(nextPage) === nextRoom && !state.selectedTradeId;
  if (samePlace && history === "push") return;
  if (history === "push") prepareDeskPush();
  setRoom(nextPage, nextRoom);
  // Room navigation always lands on the room itself, never on an open trade file.
  state.selectedTradeId = "";
  state.selectedTradeManagerKey = "";
  if (state.activePage !== nextPage) {
    setActivePage(nextPage, { history, scroll, prepared: true });
    return;
  }
  renderActivePage();
  if (scroll === "top") window.scrollTo(0, 0);
  if (history !== "silent") updateUrlState({ mode: history });
  syncDocumentMeta();
}

function invalidateResults() {
  el.resultsSection.classList.add("hidden");
  syncGenerateState();
}

function showAppPages() {
  el.deskNav?.classList.remove("hidden");
  el.homeBtn?.classList.remove("hidden");
  el.mobileHomeBtn?.classList.remove("hidden");
  const pending = state.pendingPlace;
  state.pendingPlace = null;
  state.pendingJobId = "";
  const page = pending && PAGE_IDS.includes(pending.page) ? pending.page : state.activePage || DEFAULT_PAGE;
  if (pending?.room) setRoom(page, pending.room);
  clampRoomsToLeague();
  setActivePage(page, { history: "replace", scroll: "top" });
}

function hideAppPages() {
  el.deskNav?.classList.add("hidden");
  el.homeBtn?.classList.add("hidden");
  el.mobileHomeBtn?.classList.add("hidden");
  el.ticker?.classList.add("hidden");
  tickerController?.destroy();
  tickerController = null;
  tickerFingerprint = "";
  PAGE_IDS.forEach((page) => {
    const pageEl = el.pages[page];
    pageEl?.classList.add("hidden");
    if (pageEl) pageEl.hidden = true;
  });
}

function setActivePage(page, { history = "replace", scroll = "preserve", prepared = false } = {}) {
  const nextPage = PAGE_IDS.includes(page) ? page : DEFAULT_PAGE;
  if (history === "push" && !prepared) prepareDeskPush();
  state.activePage = nextPage;

  PAGE_IDS.forEach((pageId) => {
    const pageEl = el.pages[pageId];
    const isActive = pageId === nextPage;
    pageEl?.classList.toggle("hidden", !isActive);
    if (pageEl) pageEl.hidden = !isActive;
  });
  el.pageTabButtons?.forEach((button) => {
    const isActive = button.dataset.page === nextPage;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-selected", String(isActive));
    button.tabIndex = isActive ? 0 : -1;
  });
  scrollActiveTabIntoView();
  renderSessionSnapshot();
  renderActivePage();
  if (scroll === "top") window.scrollTo(0, 0);
  if (history !== "silent") updateUrlState({ mode: history });
  syncDocumentMeta();
}

function stepTabIndex(event, count, currentIndex) {
  if (event.key === "ArrowRight" || event.key === "ArrowDown") return (currentIndex + 1) % count;
  if (event.key === "ArrowLeft" || event.key === "ArrowUp") return (currentIndex - 1 + count) % count;
  if (event.key === "Home") return 0;
  if (event.key === "End") return count - 1;
  return -1;
}

function handlePageTabKeydown(event) {
  const tabs = [...(el.pageTabButtons || [])];
  if (tabs.length === 0) return;
  const currentIndex = Math.max(0, tabs.findIndex((button) => button.classList.contains("active")));
  const nextIndex = stepTabIndex(event, tabs.length, currentIndex);
  if (nextIndex < 0) return;
  event.preventDefault();
  const nextTab = tabs[nextIndex];
  nextTab.focus();
  if (nextTab.dataset.page === state.activePage) return;
  setActivePage(nextTab.dataset.page, { history: "push", scroll: "top" });
}

function handleRoomTabKeydown(event) {
  const tabs = [...(el.roomNav?.querySelectorAll("[data-room]") || [])];
  if (tabs.length === 0) return;
  const currentIndex = Math.max(0, tabs.findIndex((button) => button.classList.contains("active")));
  const nextIndex = stepTabIndex(event, tabs.length, currentIndex);
  if (nextIndex < 0) return;
  event.preventDefault();
  const nextTab = tabs[nextIndex];
  nextTab.focus();
  openRoom(state.activePage, nextTab.dataset.room, { history: "push", scroll: "preserve" });
}

function renderActivePage() {
  if (!state.leagueId) return;
  syncRoomUi();
  renderLeagueHero();
  const page = state.activePage;
  const room = getRoom(page);
  switch (page) {
    case "teams":
      renderTeamsRoom(room);
      break;
    case "trades":
      renderTradesRoom(room);
      break;
    default:
      renderLeagueRoom(room);
  }
  renderTicker();
}

function renderLeagueRoom(room) {
  switch (room) {
    case "start":
      renderStartRoom();
      break;
    case "standings":
      renderStandingsRoom();
      break;
    case "power":
      renderPowerRoom();
      break;
    case "awards":
      renderAwardsPage();
      break;
    case "history":
      renderLeagueHistoryRoom();
      break;
    default:
      renderScoresRoom();
  }
}

function renderTeamsRoom(room) {
  switch (room) {
    case "call":
      renderWindowCallDashboard();
      break;
    case "loyalty":
      renderLoyaltyDashboard();
      break;
    case "passports":
      renderPassportDesk();
      break;
    case "mock":
      renderMockBoard();
      break;
    default:
      renderTeamsPage();
  }
}

function renderTradesRoom(room) {
  syncTradeModeUi();
  switch (room) {
    case "calculator":
      renderCalculator();
      break;
    case "value":
      renderValueCalculator();
      break;
    case "match":
      renderTradeMatchRoom();
      break;
    case "lab":
      break;
    default:
      renderTradeLogDesk();
  }
}

function renderHistoryRoom() {
  renderLeagueHistoryRoom();
}

function readStoredTheme() {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // Storage unavailable; fall through to the default.
  }
  return DEFAULT_THEME;
}

function applyTheme(theme, { persist = true } = {}) {
  const nextTheme = theme === "dark" ? "dark" : "light";
  state.theme = nextTheme;
  document.documentElement.dataset.theme = nextTheme;
  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) themeColor.content = THEME_COLORS[nextTheme];
  if (el.themeToggleBtn) {
    el.themeToggleBtn.textContent = nextTheme === "dark" ? "Light mode" : "Dark mode";
    el.themeToggleBtn.setAttribute("aria-pressed", String(nextTheme === "light"));
  }
  if (el.mobileThemeBtn) {
    el.mobileThemeBtn.setAttribute("aria-pressed", String(nextTheme === "light"));
    el.mobileThemeBtn.title = nextTheme === "dark" ? "Light mode" : "Dark mode";
  }
  if (el.mobileThemeLabel) {
    el.mobileThemeLabel.textContent = nextTheme === "dark" ? "Light mode" : "Dark mode";
  }
  if (persist) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // Non-fatal.
    }
  }
}

function bootFromUrl() {
  const parsed = parseShareParams(window.location.search);
  if (parsed.meRosterId) state.pendingMeRosterId = parsed.meRosterId;
  const hashToken = String(window.location.hash || "").replace(/^#/, "");
  if (parsed.tab) {
    state.pendingPlace = { page: parsed.tab, room: parsed.view };
  } else if (hashToken) {
    // Old anchors like #league-hall still open the room they pointed at.
    state.pendingPlace = resolveDeskPlace({ view: hashToken });
  }
  if (parsed.week) state.pendingWeek = parsed.week;
  if (parsed.tone) state.pendingTone = parsed.tone;

  const fields = bootSearchFieldValues({ leagueFromUrl: parsed.leagueId });
  if (el.sleeperUsername) el.sleeperUsername.value = fields.username;
  if (el.landingUsername) el.landingUsername.value = fields.username;
  if (el.leagueId) el.leagueId.value = fields.leagueId;

  if (parsed.leagueId) {
    void loadLeagueById(parsed.leagueId);
  }
}

function currentDeskSnapshot() {
  return buildDeskHistorySnapshot({
    tab: state.activePage,
    view: getRoom(),
    selectedTradeId: state.selectedTradeId,
    selectedTradeManagerKey: state.selectedTradeManagerKey,
    scrollY: window.scrollY || 0,
  });
}

function deskUrlPath() {
  const nextUrl = buildShareUrl();
  return `${window.location.pathname}${nextUrl.includes("?") ? `?${nextUrl.split("?")[1]}` : ""}`;
}

function prepareDeskPush() {
  if (applyingHistory || !state.leagueId) return;
  if (typeof history?.replaceState !== "function") return;
  const currentPath = `${window.location.pathname}${window.location.search}`;
  history.replaceState({
    ...buildDeskHistorySnapshot(history.state || {}),
    ...currentDeskSnapshot(),
  }, "", currentPath);
}

function updateUrlState({ mode = "replace" } = {}) {
  if (applyingHistory || !state.leagueId) return;
  if (typeof history?.replaceState !== "function") return;
  const path = deskUrlPath();
  const snapshot = currentDeskSnapshot();
  const currentPath = `${window.location.pathname}${window.location.search}`;
  if (mode === "push" && typeof history.pushState === "function") {
    if (isSameDeskPlace(history.state || {}, snapshot) && currentPath === path) {
      history.replaceState(snapshot, "", path);
      return;
    }
    history.pushState(snapshot, "", path);
    return;
  }
  history.replaceState(snapshot, "", path);
}

function applyDeskPopState(historyState) {
  if (!state.leagueId) return;
  const parsed = parseShareParams(window.location.search);
  if (parsed.leagueId && parsed.leagueId !== state.leagueId) {
    void loadLeagueById(parsed.leagueId);
    return;
  }
  applyingHistory = true;
  try {
    const nextPage = PAGE_IDS.includes(parsed.tab) ? parsed.tab : DEFAULT_PAGE;
    setRoom(nextPage, parsed.view);
    const snapshot = buildDeskHistorySnapshot(historyState || {});
    state.selectedTradeId = snapshot.selectedTradeId;
    state.selectedTradeManagerKey = snapshot.selectedTradeManagerKey;
    setActivePage(nextPage, { history: "silent", scroll: "preserve" });
    const scrollY = Number(snapshot.scrollY);
    if (Number.isFinite(scrollY)) {
      requestAnimationFrame(() => {
        window.scrollTo(0, scrollY);
        requestAnimationFrame(() => window.scrollTo(0, scrollY));
      });
    }
  } finally {
    applyingHistory = false;
  }
}

function buildShareUrl(overrides = {}) {
  const page = normalizeDeskTab(overrides.tab) || state.activePage;
  const room = overrides.view || getRoom(page);
  const week = room === "awards"
    ? state.awardsWeek || state.homeWeek
    : state.homeWeek;
  return buildShareUrlFromParts({
    origin: window.location.origin,
    pathname: window.location.pathname,
    leagueId: state.leagueId,
    meRosterId: state.meRosterId,
    tab: page,
    view: room,
    week: overrides.week ?? week,
  });
}

function goLeagueHome() {
  if (!state.leagueId) return;
  openRoom("league", HOME_ROOM);
}

function getTradeMode() {
  const mode = el.tradeModeSelect?.value || "shop";
  if (mode === "acquire" || mode === "surprise") return mode;
  return "shop";
}

function getTradeTier() {
  return "all";
}

function getCurrentPrimaryAsset() {
  return getTradeMode() === "shop" ? state.shopAsset : state.targetAsset;
}

function setCurrentPrimaryAsset(asset) {
  if (getTradeMode() === "shop") {
    state.shopAsset = asset;
    return;
  }
  state.targetAsset = asset;
}

function clearTargetAsset() {
  invalidateResults();
  if (getTradeMode() === "shop") {
    state.shopAsset = null;
  } else {
    state.targetAsset = null;
  }
  if (el.playerSearch) el.playerSearch.value = "";
  renderPlayerSearch();
  syncGenerateState();
}

function syncTargetSearchUi() {
  const selectedAsset = getCurrentPrimaryAsset();
  const hasTarget = Boolean(selectedAsset);
  const mode = getTradeMode();
  const placeholderByMode = {
    acquire: "Search another roster for the player or pick you want",
    shop: "Search your roster for the player or pick you want to move",
  };

  if (el.targetChip) {
    el.targetChip.classList.toggle("hidden", !hasTarget);
  }
  if (el.targetChipLabel) {
    el.targetChipLabel.textContent = selectedAsset?.name || "";
  }
  if (el.targetSearchShell) {
    el.targetSearchShell.classList.toggle("has-token", hasTarget);
  }
  if (el.playerSearch) {
    el.playerSearch.placeholder = hasTarget ? "" : (placeholderByMode[mode] || "Search player or pick");
  }
  syncGenerateState();
}

function isReadyToGenerate() {
  if (!state.meRosterId) return false;
  const mode = getTradeMode();
  if (mode === "calculator") return false;
  if (mode === "surprise") return true;
  if (mode === "shop") return Boolean(state.shopAsset);
  if (mode === "acquire") return Boolean(state.targetAsset);
  return false;
}

function getGenerateHelpText() {
  if (!state.meRosterId) return "Load a league and choose your team first.";
  const mode = getTradeMode();
  if (mode === "calculator") return "Pick a partner and tap assets on both sides. The ticker grades the deal live.";
  if (mode === "surprise") return "Ready. The app will find a three-team blockbuster.";
  if (mode === "shop") {
    return state.shopAsset
      ? `Ready to shop ${state.shopAsset.name}.`
      : "Choose one of your players or picks to shop.";
  }
  if (mode === "acquire") {
    return state.targetAsset
      ? `Ready to build offers for ${state.targetAsset.name}.`
      : "Choose the player or pick you want from another team.";
  }
  return "Choose a trade path first.";
}

function syncGenerateState() {
  if (el.generateBtn && !el.generateBtn.classList.contains("loading")) {
    el.generateBtn.disabled = !isReadyToGenerate();
  }
  if (el.generateHelp) {
    el.generateHelp.textContent = getGenerateHelpText();
  }
}

function isPhoneLayout() {
  return window.matchMedia(PHONE_LAYOUT_QUERY).matches;
}

function setMobileRailOpen(open) {
  const shouldOpen = Boolean(open) && isPhoneLayout();
  if (!shouldOpen && el.controlRail?.contains(document.activeElement)) {
    el.mobileRailToggle?.focus();
  }
  document.body.classList.toggle("rail-open", shouldOpen);
  el.controlRail?.classList.toggle("is-open", shouldOpen);
  el.mobileRailToggle?.setAttribute("aria-expanded", String(shouldOpen));
  if (el.railBackdrop) {
    el.railBackdrop.hidden = !shouldOpen;
    el.railBackdrop.classList.toggle("open", shouldOpen);
  }
  if (!el.controlRail) return;
  if (isPhoneLayout() && !shouldOpen) {
    el.controlRail.setAttribute("aria-hidden", "true");
    el.controlRail.setAttribute("inert", "");
  } else {
    el.controlRail.removeAttribute("aria-hidden");
    el.controlRail.removeAttribute("inert");
  }
  syncSiteDock();
}

function scrollActiveTabIntoView() {
  const active = [...(el.pageTabButtons || [])].find((button) => button.classList.contains("active"));
  if (!active || !el.pageTabs) return;
  const parentRect = el.pageTabs.getBoundingClientRect();
  const activeRect = active.getBoundingClientRect();
  if (activeRect.left < parentRect.left + 8 || activeRect.right > parentRect.right - 8) {
    active.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }
}

function renderSessionSnapshot() {
  document.body.classList.toggle("league-loaded", Boolean(state.leagueId));
  if (el.mobileChromeTitle) {
    el.mobileChromeTitle.textContent = state.leagueName || "Your Sleeper league";
  }
  if (el.chromeLeagueLabel) {
    el.chromeLeagueLabel.textContent = state.leagueName || "Not loaded";
  }
  if (el.chromeManagerLabel) {
    el.chromeManagerLabel.textContent = getMyRoster()?.manager?.displayName || "Select team";
  }
  if (el.chromeModeLabel) {
    el.chromeModeLabel.textContent = state.leagueId ? describeSeasonWeek() : "—";
  }
  renderLeagueHero();
  syncDocumentMeta();
  syncSiteDock();
}

function describeSeasonWeek() {
  const model = state.leagueId ? getSeasonModel() : null;
  if (!model) return "—";
  if (model.seasonComplete) return `${model.season} done`;
  const entry = model.currentWeekEntry;
  if (!entry) return `Week ${model.currentWeek}`;
  if (entry.isPlayoff) return `Playoffs Wk ${entry.week}${entry.isLive ? " live" : ""}`;
  if (entry.isLive) return `Week ${entry.week} live`;
  return `Week ${entry.week}`;
}

function brandMarkAvatarHtml() {
  return `<img class="league-mark" src="./brand/mark.svg" width="148" height="132" alt="" decoding="async" />`;
}

function renderLeagueHero() {
  if (!el.heroTitle) return;
  if (!state.leagueId || !state.league) {
    el.heroEyebrow.textContent = "Sleeper dynasty league";
    el.heroTitle.textContent = "Your league. Pick a job.";
    el.heroLede.textContent = "See this week, scout a roster, make a trade, or open league history.";
    if (el.leagueAvatar) el.leagueAvatar.innerHTML = brandMarkAvatarHtml();
    return;
  }
  const league = state.league;
  const model = getSeasonModel();
  const format = describeLeagueFormat(league);
  const seasonLabel = `${league.season} season`;
  const trophy = String(league?.metadata?.trophy_winner_banner_text || "").trim();
  const pageLabel = PAGE_LABELS[state.activePage] || "League";
  const room = getRoom();
  const roomLabel = room === HOME_ROOM ? "" : roomLabelFor(state.activePage, room, league);
  el.heroEyebrow.textContent = `${pageLabel}${roomLabel ? ` / ${roomLabel}` : ""} · ${seasonLabel} · ${state.normalizedRosters.length} teams · ${model?.playoffTeams || league?.settings?.playoff_teams || "?"} playoff spots`;
  el.heroTitle.textContent = state.leagueName;
  const status = model?.seasonComplete
    ? "Season complete. The archive, awards, and record book are final."
    : !state.seasonLoaded
      ? "Matchups are syncing from Sleeper."
      : model?.currentWeekEntry?.isLive
        ? `Week ${model.currentWeek} is live. Scores, win probability, and playoff odds update as Sleeper posts points.`
        : model
          ? `Week ${model.currentWeek} is next. ${model.remainingGames.length} regular-season games left before the playoffs start in Week ${model.playoffStart}.`
          : "Matchups are syncing.";
  el.heroLede.textContent = `${format}. ${status}${trophy ? ` Reigning champion banner: "${trophy}".` : ""}`;
  if (el.leagueAvatar) {
    el.leagueAvatar.innerHTML = league.avatar
      ? `<img src="${SLEEPER_AVATAR_BASE}${escapeHtml(league.avatar)}" alt="${escapeHtml(state.leagueName || "League")} logo" loading="lazy" />`
      : brandMarkAvatarHtml();
  }
  syncLeagueFormatCopy();
}

function scrollLoadedWorkspaceIntoView() {
  requestAnimationFrame(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

function syncRoomUi() {
  const page = state.activePage;
  const room = getRoom(page);
  el.pages[page]?.querySelectorAll("[data-room-panel]").forEach((panel) => {
    panel.classList.toggle("hidden", panel.dataset.roomPanel !== room);
  });
  renderRoomNav(page, room);
}

function renderRoomNav(page, room) {
  if (!el.roomNav) return;
  const rooms = visibleRooms(page);
  const navKey = `${page}:${leagueTypeId(state.league)}`;
  if (el.roomNav.dataset.navKey !== navKey) {
    el.roomNav.innerHTML = rooms.map((id) => `
      <button type="button" class="room-tab" role="tab" data-room="${escapeHtml(id)}" title="${escapeHtml(roomHintFor(page, id, state.league))}">
        ${escapeHtml(roomLabelFor(page, id, state.league) || id)}
      </button>
    `).join("");
    el.roomNav.dataset.navKey = navKey;
    el.roomNav.dataset.page = page;
    el.roomNav.setAttribute("aria-label", `${PAGE_LABELS[page] || "Page"} rooms`);
  }
  let activeButton = null;
  el.roomNav.querySelectorAll("[data-room]").forEach((button) => {
    const isActive = button.dataset.room === room;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-selected", String(isActive));
    button.tabIndex = isActive ? 0 : -1;
    if (isActive) activeButton = button;
  });
  if (activeButton && typeof activeButton.scrollIntoView === "function") {
    const parentRect = el.roomNav.getBoundingClientRect();
    const rect = activeButton.getBoundingClientRect();
    if (rect.left < parentRect.left + 8 || rect.right > parentRect.right - 8) {
      activeButton.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
    }
  }
}

function syncTradeModeUi() {
  const room = getRoom("trades");
  const mode = getTradeMode();
  const isLab = room === "lab" && state.activePage === "trades";
  const searchEnabled = isLab && mode !== "surprise";
  const selectedAsset = getCurrentPrimaryAsset();
  const copyByMode = {
    acquire: {
      help: "Search another roster for the player or pick you want.",
      label: "Who do you want?",
    },
    shop: {
      help: "Pick one player or pick from your roster. The app will shop it around the league.",
      label: "Who are you willing to move?",
    },
    surprise: {
      help: "No player search needed. The app will pick teams and build a multi-team blockbuster.",
      label: "Surprise blockbuster",
    },
  };

  el.modeCards?.forEach((button) => {
    const isActive = button.dataset.tradeMode === mode;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });

  el.playerSearchLabel?.classList.toggle("hidden", !searchEnabled);
  el.targetSearchShell?.classList.toggle("hidden", !searchEnabled);
  el.playerResults?.classList.toggle("hidden", !searchEnabled);

  if (el.tradeModeHelp) el.tradeModeHelp.textContent = copyByMode[mode]?.help || "";
  if (el.playerSearchLabel) el.playerSearchLabel.textContent = copyByMode[mode]?.label || "Search player or pick";
  if (!searchEnabled && el.playerResults) {
    el.playerResults.innerHTML = "";
  }

  if (searchEnabled) {
    syncTargetSearchUi();
    if (selectedAsset && !el.playerSearch?.value.trim()) {
      el.playerResults?.classList.add("hidden");
    }
    renderPlayerSearch();
  }
  syncGenerateState();
  renderSessionSnapshot();
}

function handleLeaguePickClick(event) {
  const button = event.target.closest("[data-league-id]");
  if (!button) return;
  const leagueId = parseLeagueId(button.dataset.leagueId);
  if (!leagueId) return;
  if (el.leagueId) el.leagueId.value = leagueId;
  void loadLeagueById(leagueId);
}

function handleLandingJobClick(event) {
  const button = event.target.closest("[data-job]");
  if (!button || !el.landingJobs?.contains(button)) return;
  selectLandingJob(button.dataset.job);
}

function selectLandingJob(jobId) {
  const job = jobById(jobId, { includeMore: false });
  if (!job) return;
  const nextId = state.pendingJobId === job.id ? "" : job.id;
  state.pendingJobId = nextId;
  state.pendingPlace = nextId ? { page: job.page, room: job.room } : null;
  syncLandingJobUi();
  if (nextId) {
    el.landingUsername?.focus();
    el.landingUsernameForm?.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

function syncLandingJobUi() {
  const selected = state.pendingJobId;
  el.landingJobs?.querySelectorAll("[data-job]").forEach((button) => {
    const on = button.dataset.job === selected;
    button.classList.toggle("active", on);
    button.setAttribute("aria-pressed", String(on));
  });
  const job = jobById(selected, { includeMore: false });
  if (el.landingJobHint) el.landingJobHint.textContent = landingSearchHint(job);
}

function requestLoadLeague(event) {
  event?.preventDefault?.();
  const classified = classifyLeagueInput(el.leagueId?.value || el.sleeperUsername?.value);
  if (classified.kind === "empty") {
    setFieldError(el.leagueId, el.leagueIdError, "Paste a Sleeper league ID or URL.");
    setStatus("Paste a Sleeper league ID or URL.", { error: true });
    el.leagueId?.focus();
    return;
  }
  if (classified.kind === "league") {
    setFieldError(el.leagueId, el.leagueIdError, "");
    if (el.leagueId) el.leagueId.value = classified.leagueId;
    void loadLeagueById(classified.leagueId);
    return;
  }
  void loadLeague();
}

function requestFindLeagues(event) {
  event?.preventDefault?.();
  syncUsernameFields(event?.currentTarget === el.landingUsernameForm ? el.landingUsername : el.sleeperUsername);
  const classified = classifyLeagueInput(el.sleeperUsername?.value || el.landingUsername?.value);
  if (classified.kind === "empty") {
    setUsernameError("Type your Sleeper username, then press Find leagues.");
    setStatus("Type your Sleeper username, then press Find leagues.", { error: true });
    (el.landingUsername || el.sleeperUsername)?.focus();
    return;
  }
  setUsernameError("");
  if (classified.kind === "league") {
    if (el.leagueId) el.leagueId.value = classified.leagueId;
    void loadLeagueById(classified.leagueId);
    return;
  }
  void searchUserLeagues(classified.username);
}

function isPrimaryPointer(event) {
  return !(event.pointerType === "mouse" && event.button !== 0);
}

function handleLoadLeaguePointerDown(event) {
  if (!isPrimaryPointer(event)) return;
  event.preventDefault();
  void requestLoadLeague(event);
}

async function searchUserLeagues(username) {
  if (userSearchPromise) return userSearchPromise;
  userSearchPromise = runUserLeagueSearch(username);
  try {
    await userSearchPromise;
  } finally {
    userSearchPromise = null;
  }
}

async function runUserLeagueSearch(username) {
  startFindLeaguesUi();
  setStatus(`Looking up ${username} on Sleeper…`, { loading: true });
  let autoloadId = "";
  try {
    const nflState = await apiGetWithRetry(`/state/nfl`, { timeoutMs: 8000, retries: 1 }).catch(() => state.nflState);
    if (nflState) state.nflState = nflState;
    const season = String(nflState?.league_season || nflState?.season || new Date().getUTCFullYear());
    const { user, leagues } = await fetchUserLeagues(sleeper, username, uniqueSeasons(season, 1));
    state.sleeperUser = user;
    state.userLeagues = sortUserLeagues(leagues, season);
    renderLeaguePicker(state.userLeagues, season);
    setUsernameError("");
    if (state.userLeagues.length === 0) {
      setStatus(`Found ${user.display_name || username}, but no NFL leagues for ${season}/${Number(season) - 1}.`, { error: true });
      setUsernameError(`No NFL leagues for ${season}/${Number(season) - 1}.`);
      return;
    }
    if (state.userLeagues.length === 1) {
      autoloadId = String(state.userLeagues[0].league_id || "");
      if (el.leagueId && autoloadId) el.leagueId.value = autoloadId;
      setStatus(`One league found. Opening ${state.userLeagues[0].name || "league"}…`, { loading: true });
    } else {
      setStatus(`Found ${state.userLeagues.length} leagues for ${user.display_name || username}. Pick one.`);
      el.landingLeaguePicker?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  } catch (err) {
    renderLeaguePicker([]);
    const message = `Could not find that Sleeper user. ${err.message}`;
    setUsernameError(message);
    setStatus(message, { error: true });
  } finally {
    stopFindLeaguesUi();
  }
  if (autoloadId) await loadLeagueById(autoloadId);
}

function renderLeaguePicker(leagues, season) {
  const hosts = [...new Set([el.leaguePicker, el.landingLeaguePicker].filter(Boolean))];
  if (!hosts.length) return;
  const html = leagues?.length ? renderLeaguePickerMarkup(leagues, season, state.leagueId) : "";
  hosts.forEach((host) => {
    host.classList.toggle("hidden", !html);
    host.innerHTML = html;
  });
}

function startFindLeaguesUi() {
  [el.findLeaguesBtn, el.landingFindBtn].forEach((button) => {
    if (!button) return;
    button.disabled = true;
    button.classList.add("loading");
    button.textContent = "Searching...";
  });
  el.usernameSearchForm?.setAttribute("aria-busy", "true");
  el.landingUsernameForm?.setAttribute("aria-busy", "true");
}

function stopFindLeaguesUi() {
  [el.findLeaguesBtn, el.landingFindBtn].forEach((button) => {
    if (!button) return;
    button.disabled = false;
    button.classList.remove("loading");
    button.textContent = "Find leagues";
  });
  el.usernameSearchForm?.setAttribute("aria-busy", "false");
  el.landingUsernameForm?.setAttribute("aria-busy", "false");
}

async function loadLeague() {
  const classified = classifyLeagueInput(el.leagueId?.value);
  const leagueId = classified.kind === "league" ? classified.leagueId : parseLeagueId(el.leagueId?.value);
  if (!leagueId) {
    setFieldError(el.leagueId, el.leagueIdError, "Search your Sleeper username, or paste a league ID / URL.");
    setStatus("Search your Sleeper username, or paste a league ID / URL.", { error: true });
    (el.sleeperUsername || el.leagueId)?.focus();
    return;
  }
  if (el.leagueId) el.leagueId.value = leagueId;
  return loadLeagueById(leagueId);
}

async function loadLeagueById(leagueId) {
  if (!leagueId) return;
  return leagueLoader.run(leagueId, (id, token) => runLeagueLoad(id, token));
}

async function runLeagueLoad(leagueId, token) {
  try {
    if (!leagueLoader.isCurrent(token)) return;
    startLeagueLoadingUi();
    stopLivePolling();
    state.targetAsset = null;
    state.shopAsset = null;
    state.selectedOutgoingAssetIds.clear();
    state.excludedOutgoingAssetIds.clear();
    state.customParticipantRosterIds = [];
    state.tradedPicks = [];
    state.currentDraftContext = null;
    state.draftedPickByKey = new Map();
    state.trendingAdds = [];
    state.trendingDrops = [];
    state.trendingLoaded = false;
    state.playerMetadataLoaded = false;
    state.playerMetadataFailed = false;
    state.activePage = DEFAULT_PAGE;
    state.rooms = { ...DEFAULT_ROOMS };
    franchiseIndexCache = { key: "", index: null };
    state.transactions = [];
    state.transactionsLoaded = false;
    state.transactionsFailed = false;
    state.transactionWeeksLoaded = 0;
    state.transactionLoadError = "";
    state.leagueBoard = emptyLeagueBoard();
    state.leagueHistory = [];
    state.historyTransactions = [];
    state.historyTransactionsLoaded = false;
    state.historyTransactionsFailed = false;
    state.historyTransactionLeaguesLoaded = 0;
    state.historyTransactionLoadError = "";
    resetHistoryCompareState();
    resetSeasonState();
    state.lensRosterId = null;
    if (String(state.leagueId || "") !== String(leagueId)) {
      state.meRosterId = null;
      state.mePickedByUser = false;
      if (el.meSelect) el.meSelect.innerHTML = "";
    }
    state.homeWeek = null;
    state.awardsWeek = null;
    state.selectedTradeId = "";
    state.selectedTradeManagerKey = "";
    leagueTradeSideCache = { key: "", sides: [] };
    state.standingsView = "overall";
    resetCalculatorState({ keepPartner: false });
    state.valueCalc = emptyValueCalcState();
    clearTradeMatchCache();
    state.weeklyValue = emptyWeeklyValueState();
    if (el.playerSearch) el.playerSearch.value = "";
    hideAppPages();
    if (el.resultsList) el.resultsList.innerHTML = "";
    el.resultsSection?.classList.add("hidden");

    const [coreData, nflState] = await Promise.all([
      loadLeagueCoreData(leagueId),
      apiGetWithRetry(`/state/nfl`, { timeoutMs: 8000, retries: 1 }).catch(() => null),
      ensureMockDraftsLoaded(),
    ]);
    if (!leagueLoader.isCurrent(token)) return;
    state.nflState = nflState;
    const { league, users, rosters, tradedPicks, drafts } = coreData;
    const leagueHistory = await loadLeagueHistoryContext(leagueId, coreData);
    if (!leagueLoader.isCurrent(token)) return;
    const previousEntry = leagueHistory.find((entry) => !entry.isCurrent) || null;
    const previousContext = previousEntry
      ? {
          league: previousEntry.league,
          users: previousEntry.users,
          rosters: previousEntry.rosters,
        }
      : { league: null, users: [], rosters: [] };
    const currentDraftContext = await loadCurrentSeasonDraftContext(leagueId, league, rosters, drafts);
    if (!leagueLoader.isCurrent(token)) return;

    state.leagueId = leagueId;
    state.leagueName = league?.name || `League ${leagueId}`;
    state.league = league;
    state.users = users;
    state.rosters = rosters;
    state.tradedPicks = tradedPicks;
    state.currentDraftContext = currentDraftContext;
    state.players = {};
    state.previousLeague = previousContext.league;
    state.previousUsers = previousContext.users;
    state.previousRosters = previousContext.rosters;
    state.leagueHistory = leagueHistory;
    state.normalizedRosters = normalizeRosters(league, rosters, users, state.players, previousContext, tradedPicks, currentDraftContext);

    setFieldError(el.leagueId, el.leagueIdError, "");
    if (state.userLeagues.length) {
      renderLeaguePicker(state.userLeagues, String(state.nflState?.league_season || state.nflState?.season || league?.season || ""));
    }
    hydrateManagerSelector();
    syncTradeModeUi();
    renderSessionSnapshot();
    el.identitySection?.classList.remove("hidden");
    if (state.pendingWeek) {
      state.homeWeek = state.pendingWeek;
      state.awardsWeek = state.pendingWeek;
      state.pendingWeek = null;
    }
    showAppPages();
    scrollLoadedWorkspaceIntoView();
    setMobileRailOpen(false);
    setStatus(`Loaded ${state.leagueName}. Player names are still syncing...`, { loading: true });
    primeValuationData();
    loadTrendingPlayers();
    loadLeagueTransactions(leagueId, league);
    loadLeagueHistoryTransactions(leagueHistory);
    loadLeagueHistoryMatchups(leagueHistory);
    loadDraftSelectionIndex(leagueHistory);
    startLivePolling();

    loadPlayersWithCache()
      .then((players) => {
        if (!leagueLoader.isCurrent(token) || String(state.leagueId) !== String(leagueId)) return;
        state.players = players;
        state.playerMetadataLoaded = true;
        state.playerMetadataFailed = false;
        refreshPlayerPositionRanks();
        rebuildWeeklyValueContext();
        void ensureWeeklyValueContext();
        state.normalizedRosters = normalizeRosters(state.league, state.rosters, state.users, players, {
          league: state.previousLeague,
          users: state.previousUsers,
          rosters: state.previousRosters,
        }, state.tradedPicks, state.currentDraftContext);
        invalidateSeasonCaches();
        hydrateManagerSelector();
        syncTradeModeUi();
        renderActivePage();
        const me = getMyRoster();
        setStatus(
          me
            ? `Loaded ${state.leagueName}. Viewing as ${me.manager?.displayName || "your team"}. Switch teams in the Manager panel.`
            : `Loaded ${state.leagueName}. Choose your team to continue.`,
          { ok: true },
        );
      })
      .catch((err) => {
        if (!leagueLoader.isCurrent(token) || String(state.leagueId) !== String(leagueId)) return;
        state.playerMetadataLoaded = false;
        state.playerMetadataFailed = true;
        syncTradeModeUi();
        renderActivePage();
        setStatus(
          `Loaded ${state.leagueName}, but could not pull full NFL names (${err.message}). You can still use the app.`,
          { ok: true }
        );
      });
  } catch (err) {
    if (!leagueLoader.isCurrent(token)) return;
    const message = `Could not load league data. ${err.message}`;
    setFieldError(el.leagueId, el.leagueIdError, message);
    setStatus(message, { error: true });
  } finally {
    if (leagueLoader.isCurrent(token)) stopLeagueLoadingUi();
  }
}

function resetSeasonState() {
  state.nflState = null;
  state.seasonWeekRows = new Map();
  state.seasonLoaded = false;
  state.seasonLoadError = "";
  invalidateSeasonCaches();
}

function invalidateSeasonCaches() {
  state.seasonModelCache = { key: "", model: null };
  state.simCache = { key: "", result: null };
}

function invalidateSeasonModelCache() {
  state.seasonModelCache = { key: "", model: null };
}

function valuationCacheVersion() {
  const sourceVersion = state.valueBundles?.valuationVersion
    || state.tradeMarketBundle?.meta?.updatedAt
    || "local";
  const leagueBasis = state.applyLeagueBoard
    ? `league:${Number(state.leagueBoard?.tradeCount || 0)}`
    : "market";
  return `${sourceVersion}:${Number(state.valuationRevision || 0)}:${leagueBasis}`;
}

function simSignature(model) {
  if (!model) return "";
  return [
    state.leagueId,
    model.finalThroughWeek,
    model.remainingGames.length,
    model.seasonComplete ? 1 : 0,
    valuationCacheVersion(),
    state.previousRosters.length,
  ].join("|");
}

function stopLivePolling() {
  livePoller?.stop();
  livePoller = null;
  state.livePolling = false;
  if (liveVisibilityBound) {
    document.removeEventListener("visibilitychange", handleLiveVisibility);
    liveVisibilityBound = false;
  }
}

function startLivePolling() {
  stopLivePolling();
  livePoller = createLivePoller({
    intervalMs: LIVE_POLL_INTERVAL_MS,
    simRefreshMs: LIVE_SIM_REFRESH_MS,
    isLive: () => shouldPollLive(getSeasonModel(), state.nflState),
    shouldPause: () => Boolean(document.hidden),
    fetchUpdate: async () => {
      const model = getSeasonModel();
      const week = model?.currentWeek || Number(state.nflState?.week) || 1;
      const [rows, nflState] = await Promise.all([
        apiGetWithRetry(`/league/${state.leagueId}/matchups/${week}`, { timeoutMs: 12000, retries: 1 }),
        apiGetWithRetry(`/state/nfl`, { timeoutMs: 8000, retries: 1 }).catch(() => state.nflState),
      ]);
      return { week, rows: Array.isArray(rows) ? rows : [], nflState, previousModel: model };
    },
    onScores: ({ week, rows, nflState, previousModel }) => {
      if (nflState) state.nflState = nflState;
      state.seasonWeekRows.set(Number(week), rows);
      invalidateSeasonModelCache();
      const nextModel = getSeasonModel();
      if (shouldRefreshSim({
        previousFinalThroughWeek: previousModel?.finalThroughWeek,
        nextFinalThroughWeek: nextModel?.finalThroughWeek,
        previousRemaining: previousModel?.remainingGames?.length,
        nextRemaining: nextModel?.remainingGames?.length,
      })) {
        state.simCache = { key: "", result: null };
      }
      state.livePolling = shouldPollLive(nextModel, state.nflState);
      renderSessionSnapshot();
      renderTicker();
      if (state.activePage === "league") renderActivePage();
    },
    onSimRefresh: () => {
      state.simCache = { key: "", result: null };
      if (state.activePage === "league") renderActivePage();
    },
  });
  livePoller.start();
  document.addEventListener("visibilitychange", handleLiveVisibility, { passive: true });
  liveVisibilityBound = true;
}

function handleLiveVisibility() {
  if (!livePoller?.running) return;
  if (!document.hidden) livePoller.resume();
}

async function loadLeagueCoreData(leagueId) {
  const endpointPlan = [
    { key: "league", label: "league profile", path: `/league/${leagueId}` },
    { key: "users", label: "league managers", path: `/league/${leagueId}/users` },
    { key: "rosters", label: "league rosters", path: `/league/${leagueId}/rosters` },
    { key: "tradedPicks", label: "traded picks", path: `/league/${leagueId}/traded_picks`, optional: true },
    { key: "drafts", label: "league drafts", path: `/league/${leagueId}/drafts`, optional: true },
    { key: "winnersBracket", label: "playoff bracket", path: `/league/${leagueId}/winners_bracket`, optional: true },
    { key: "losersBracket", label: "consolation bracket", path: `/league/${leagueId}/losers_bracket`, optional: true },
  ];

  const tasks = endpointPlan.map(async (endpoint) => {
    setStatus(`Loading ${endpoint.label}...`, { loading: true });
    const payload = await apiGetWithRetry(endpoint.path, { timeoutMs: 12000, retries: 1 });
    return { key: endpoint.key, payload };
  });

  const settled = await Promise.allSettled(tasks);
  const byKey = {};
  const failures = [];

  settled.forEach((result, idx) => {
    const endpoint = endpointPlan[idx];
    if (result.status === "fulfilled") {
      byKey[result.value.key] = result.value.payload;
    } else if (!endpoint.optional) {
      failures.push(`${endpoint.label} (${result.reason?.message || "unknown error"})`);
    }
  });

  if (failures.length > 0) {
    const missingLeague = failures.every((failure) => /returned 404/.test(failure));
    if (missingLeague) {
      throw new Error(`No Sleeper league found for ${leagueId}. Check the ID, or paste the league URL.`);
    }
    throw new Error(`Failed to load: ${failures.join("; ")}`);
  }

  return {
    league: byKey.league,
    users: byKey.users,
    rosters: byKey.rosters,
    tradedPicks: Array.isArray(byKey.tradedPicks) ? byKey.tradedPicks : [],
    drafts: Array.isArray(byKey.drafts) ? byKey.drafts : [],
    winnersBracket: Array.isArray(byKey.winnersBracket) ? byKey.winnersBracket : [],
    losersBracket: Array.isArray(byKey.losersBracket) ? byKey.losersBracket : [],
  };
}

function rankDraftCandidateStatus(status) {
  switch (normalizeDraftStatus(status)) {
    case "drafting": return 0;
    case "paused": return 1;
    case "complete": return 2;
    default: return 3;
  }
}

function normalizeDraftStatus(status) {
  return String(status || "").trim().toLowerCase();
}

function isCompleteDraftStatus(status) {
  return normalizeDraftStatus(status) === "complete";
}

function buildCurrentDraftDetailCandidateIds(league, drafts = []) {
  const leagueSeason = String(league?.season || "").trim();
  const candidateIds = [];
  const seen = new Set();
  const push = (draftId) => {
    const normalized = String(draftId || "").trim();
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    candidateIds.push(normalized);
  };

  drafts
    .filter((draft) => String(draft?.season || "").trim() === leagueSeason)
    .slice()
    .sort((left, right) => {
      const statusDiff = rankDraftCandidateStatus(left?.status) - rankDraftCandidateStatus(right?.status);
      if (statusDiff !== 0) return statusDiff;
      return Number(right?.last_picked || 0) - Number(left?.last_picked || 0);
    })
    .forEach((draft) => push(draft?.draft_id));

  push(league?.draft_id);
  return candidateIds;
}

function buildUsedDraftPickIndex(draftDetails, draftPicks = []) {
  const season = String(draftDetails?.season || "").trim();
  const slotMap = draftDetails?.slot_to_roster_id && typeof draftDetails.slot_to_roster_id === "object"
    ? draftDetails.slot_to_roster_id
    : {};
  const usedPickKeys = new Set();
  const usedSlotKeys = new Set();

  (Array.isArray(draftPicks) ? draftPicks : []).forEach((pick) => {
    const playerId = String(pick?.player_id || "").trim();
    const round = Number(pick?.round);
    const slot = Number(pick?.draft_slot);
    if (!playerId || !Number.isFinite(round)) return;

    if (Number.isFinite(slot)) {
      usedSlotKeys.add(`${round}:${slot}`);
      const originalOwnerKey = normalizeRosterIdKey(slotMap[String(slot)] ?? slotMap[slot]);
      if (season && originalOwnerKey) {
        usedPickKeys.add(buildOwnedPickKey(season, round, originalOwnerKey));
      }
    }
  });

  return { usedPickKeys, usedSlotKeys };
}

function buildCurrentDraftContext(league, rosters, draftDetails, draftPicks = []) {
  const leagueSeason = String(league?.season || "").trim();
  const draftSeason = String(draftDetails?.season || "").trim();
  if (!leagueSeason || !draftSeason || draftSeason !== leagueSeason) return null;

  const slotByRosterId = new Map();
  const slotMap = draftDetails?.slot_to_roster_id && typeof draftDetails.slot_to_roster_id === "object"
    ? draftDetails.slot_to_roster_id
    : {};

  Object.entries(slotMap).forEach(([slotToken, rosterId]) => {
    const slot = Number(slotToken);
    const rosterKey = normalizeRosterIdKey(rosterId);
    if (!Number.isFinite(slot) || !rosterKey) return;
    slotByRosterId.set(rosterKey, slot);
  });

  if (slotByRosterId.size === 0) {
    const rosterIdByOwnerId = new Map(
      rosters
        .map((roster) => [normalizeRosterIdKey(roster.owner_id), normalizeRosterIdKey(roster.roster_id)])
        .filter(([ownerId, rosterId]) => ownerId && rosterId)
    );
    const draftOrder = draftDetails?.draft_order && typeof draftDetails.draft_order === "object"
      ? draftDetails.draft_order
      : {};

    Object.entries(draftOrder).forEach(([ownerId, slotToken]) => {
      const slot = Number(slotToken);
      const rosterKey = rosterIdByOwnerId.get(normalizeRosterIdKey(ownerId));
      if (!Number.isFinite(slot) || !rosterKey) return;
      slotByRosterId.set(rosterKey, slot);
    });
  }

  const status = normalizeDraftStatus(draftDetails?.status);
  const { usedPickKeys, usedSlotKeys } = buildUsedDraftPickIndex(draftDetails, draftPicks);
  if (slotByRosterId.size === 0 && status !== "complete" && usedPickKeys.size === 0 && usedSlotKeys.size === 0) {
    return null;
  }

  const slotValues = [...slotByRosterId.values()];
  return {
    draftId: String(draftDetails?.draft_id || ""),
    season: draftSeason,
    status,
    rounds: Number(draftDetails?.settings?.rounds) || 0,
    totalSlots: Math.max(
      Number(draftDetails?.settings?.teams) || 0,
      Number(league?.total_rosters) || 0,
      rosters.length,
      ...slotValues
    ),
    slotByRosterId,
    usedPickKeys,
    usedSlotKeys,
  };
}

function ingestDraftSelections(season, draftDetails, draftPicks, rosters = []) {
  if (!(state.draftedPickByKey instanceof Map)) state.draftedPickByKey = new Map();
  const indexed = indexDraftSelections({
    season: String(season || draftDetails?.season || ""),
    slotToRosterId: slotToRosterIdFromDraft(draftDetails, rosters),
    ownerKeyByRosterId: ownerKeyByRosterIdFromRosters(rosters),
    picks: Array.isArray(draftPicks) ? draftPicks : [],
  });
  mergeDraftSelectionIndex(state.draftedPickByKey, indexed);
}

function collectDraftIngestJobs(historyEntries = []) {
  const jobs = [];
  const seenDraftIds = new Set();
  (Array.isArray(historyEntries) ? historyEntries : []).forEach((entry) => {
    const draftIds = [];
    const drafts = [...(Array.isArray(entry?.drafts) ? entry.drafts : [])];
    const leagueDraftId = String(entry?.league?.draft_id || "").trim();
    if (leagueDraftId && !drafts.some((draft) => String(draft?.draft_id || "") === leagueDraftId)) {
      drafts.push({ draft_id: leagueDraftId, settings: { rounds: 0 } });
    }
    sortDraftsForSelectionIngest(drafts).forEach((draft) => {
      const draftId = String(draft?.draft_id || "").trim();
      if (!draftId || seenDraftIds.has(draftId)) return;
      seenDraftIds.add(draftId);
      draftIds.push(draftId);
    });
    draftIds.forEach((draftId) => {
      jobs.push({
        draftId,
        seasonHint: String(entry?.season || ""),
        rosters: Array.isArray(entry?.rosters) ? entry.rosters : [],
      });
    });
  });
  return jobs;
}

async function loadDraftSelectionIndex(historyEntries = []) {
  const activeLeagueId = state.leagueId;
  const jobs = collectDraftIngestJobs(historyEntries);
  if (!jobs.length) return;

  const settled = await mapInChunks(jobs, MATCHUP_FETCH_CHUNK, async (job) => {
    const [draftDetails, draftPicks] = await Promise.all([
      apiGetWithRetry(`/draft/${job.draftId}`, { timeoutMs: 12000, retries: 1 }),
      apiGetWithRetry(`/draft/${job.draftId}/picks`, { timeoutMs: 12000, retries: 1 }).catch(() => []),
    ]);
    return {
      job,
      draftDetails,
      draftPicks: Array.isArray(draftPicks) ? draftPicks : [],
    };
  });

  if (state.leagueId !== activeLeagueId) return;

  settled.forEach((result) => {
    if (result.status !== "fulfilled") return;
    const { job, draftDetails, draftPicks } = result.value;
    ingestDraftSelections(draftDetails?.season || job.seasonHint, draftDetails, draftPicks, job.rosters);
  });

  leagueTradeSideCache = { key: "", sides: [] };
  renderActivePage();
}

async function loadCurrentSeasonDraftContext(leagueId, league, rosters, drafts = []) {
  const candidateIds = buildCurrentDraftDetailCandidateIds(league, drafts);
  for (const draftId of candidateIds) {
    try {
      const [draftDetails, draftPicks] = await Promise.all([
        apiGetWithRetry(`/draft/${draftId}`, { timeoutMs: 12000, retries: 1 }),
        apiGetWithRetry(`/draft/${draftId}/picks`, { timeoutMs: 12000, retries: 1 }).catch(() => []),
      ]);
      const picks = Array.isArray(draftPicks) ? draftPicks : [];
      ingestDraftSelections(draftDetails?.season || league?.season, draftDetails, picks, rosters);
      const context = buildCurrentDraftContext(league, rosters, draftDetails, picks);
      if (context) return context;
    } catch (err) {
      console.warn(`Could not load draft details for ${draftId}`, err);
    }
  }

  return null;
}

function buildLeagueHistoryEntry(leagueId, coreData, isCurrent = false) {
  return {
    leagueId: String(leagueId || coreData?.league?.league_id || ""),
    season: String(coreData?.league?.season || ""),
    isCurrent,
    league: coreData?.league || null,
    users: Array.isArray(coreData?.users) ? coreData.users : [],
    rosters: Array.isArray(coreData?.rosters) ? coreData.rosters : [],
    tradedPicks: Array.isArray(coreData?.tradedPicks) ? coreData.tradedPicks : [],
    drafts: Array.isArray(coreData?.drafts) ? coreData.drafts : [],
    winnersBracket: Array.isArray(coreData?.winnersBracket) ? coreData.winnersBracket : [],
    losersBracket: Array.isArray(coreData?.losersBracket) ? coreData.losersBracket : [],
  };
}

async function loadLeagueHistoryContext(currentLeagueId, currentCoreData) {
  const entries = [buildLeagueHistoryEntry(currentLeagueId, currentCoreData, true)];
  const seenLeagueIds = new Set([String(currentLeagueId || "")]);
  let previousLeagueId = currentCoreData?.league?.previous_league_id;

  for (let depth = 1; depth < MAX_HISTORY_SEASONS && previousLeagueId; depth += 1) {
    const historyLeagueId = String(previousLeagueId);
    if (seenLeagueIds.has(historyLeagueId)) break;
    seenLeagueIds.add(historyLeagueId);

    try {
      setStatus(`Loading league archive season ${depth + 1}...`, { loading: true });
      const historicalCore = await loadLeagueCoreData(historyLeagueId);
      entries.push(buildLeagueHistoryEntry(historyLeagueId, historicalCore, false));
      previousLeagueId = historicalCore?.league?.previous_league_id;
    } catch (err) {
      console.warn(`Could not load historical league ${historyLeagueId}`, err);
      break;
    }
  }

  return entries;
}

async function loadPreviousLeagueContext(league) {
  const previousLeagueId = league?.previous_league_id;
  if (!previousLeagueId) {
    return { league: null, users: [], rosters: [] };
  }

  try {
    setStatus("Loading previous league context for pick labels...", { loading: true });
    return await loadLeagueCoreData(previousLeagueId);
  } catch (err) {
    console.warn("Could not load previous league context", err);
    return { league: null, users: [], rosters: [] };
  }
}

async function loadPlayersWithCache() {
  const now = Date.now();
  const fromCache = getPlayersCache();
  let stateKey = null;

  try {
    const nflState = await apiGetWithRetry(`/state/nfl`, { timeoutMs: 8000, retries: 1 });
    stateKey = `${nflState?.season || "na"}-${nflState?.league_season || "na"}-${nflState?.week || "na"}`;
    if (fromCache?.players && fromCache?.stateKey === stateKey) return fromCache.players;
  } catch {
    if (fromCache && now - fromCache.savedAt < PLAYERS_CACHE_TTL_MS) {
      return fromCache.players;
    }
  }

  const players = await apiGet(`/players/nfl`, { timeoutMs: 30000 });
  savePlayersCache(players, now, stateKey);
  return players;
}

async function loadTrendingPlayers() {
  state.trendingLoaded = false;
  try {
    const [adds, drops] = await Promise.all([
      apiGetWithRetry(`/players/nfl/trending/add?lookback_hours=${TRENDING_LOOKBACK_HOURS}&limit=${TRENDING_PLAYERS_LIMIT}`, { timeoutMs: 9000, retries: 1 }),
      apiGetWithRetry(`/players/nfl/trending/drop?lookback_hours=${TRENDING_LOOKBACK_HOURS}&limit=${TRENDING_PLAYERS_LIMIT}`, { timeoutMs: 9000, retries: 1 }),
    ]);
    state.trendingAdds = Array.isArray(adds) ? adds : [];
    state.trendingDrops = Array.isArray(drops) ? drops : [];
    state.trendingLoaded = true;
  } catch (err) {
    console.warn("Could not load Sleeper trending players", err);
    state.trendingAdds = [];
    state.trendingDrops = [];
    state.trendingLoaded = false;
  } finally {
    renderActivePage();
  }
}

async function loadLeagueTransactions(leagueId, league) {
  const loadLeagueId = String(leagueId || "");
  state.transactions = [];
  state.transactionsLoaded = false;
  state.transactionsFailed = false;
  state.transactionWeeksLoaded = 0;
  state.transactionLoadError = "";
  renderActivePage();

  const weeks = buildTransactionWeeks(league);
  try {
    const transactions = [];
    let loadedWeeks = 0;
    const settled = await mapInChunks(weeks, MATCHUP_FETCH_CHUNK, (week) =>
      apiGetWithRetry(`/league/${loadLeagueId}/transactions/${week}`, { timeoutMs: 10000, retries: 1 })
        .then((weekTransactions) => ({
          week,
          transactions: Array.isArray(weekTransactions) ? weekTransactions : [],
        }))
    );

    if (state.leagueId !== loadLeagueId) return;

    settled.forEach((result) => {
      if (result.status !== "fulfilled") return;
      loadedWeeks += 1;
      result.value.transactions.forEach((transaction) => {
        transactions.push({
          ...transaction,
          leg: transaction?.leg ?? result.value.week,
          week: result.value.week,
        });
      });
    });

    state.transactions = dedupeTransactions(transactions);
    state.transactionWeeksLoaded = loadedWeeks;
    state.transactionsLoaded = true;
    state.transactionsFailed = loadedWeeks === 0;
    state.transactionLoadError = loadedWeeks === 0 ? "Sleeper did not return transaction weeks for this league." : "";
    refreshLeagueBoard();
  } catch (err) {
    if (state.leagueId !== loadLeagueId) return;
    state.transactions = [];
    state.transactionsLoaded = true;
    state.transactionsFailed = true;
    state.transactionLoadError = err.message || "Could not load Sleeper transactions.";
  } finally {
    if (state.leagueId === loadLeagueId) {
      renderActivePage();
    }
  }
}

async function loadLeagueHistoryTransactions(historyEntries = []) {
  const activeLeagueId = state.leagueId;
  const historicalEntries = historyEntries
    .filter((entry) => entry && !entry.isCurrent && entry.leagueId)
    .slice(0, HISTORY_TRANSACTION_SEASON_LIMIT);

  state.historyTransactions = [];
  state.historyTransactionsLoaded = historicalEntries.length === 0;
  state.historyTransactionsFailed = false;
  state.historyTransactionLeaguesLoaded = 0;
  state.historyTransactionLoadError = "";
  renderActivePage();

  if (historicalEntries.length === 0) return;

  const transactions = [];
  let loadedLeagues = 0;
  try {
    for (const entry of historicalEntries) {
      if (state.leagueId !== activeLeagueId) return;
      const weeks = buildTransactionWeeks(entry.league);
      let loadedWeeks = 0;
      const settled = await mapInChunks(weeks, MATCHUP_FETCH_CHUNK, (week) =>
        apiGetWithRetry(`/league/${entry.leagueId}/transactions/${week}`, { timeoutMs: 10000, retries: 1 })
          .then((weekTransactions) => ({
            week,
            transactions: Array.isArray(weekTransactions) ? weekTransactions : [],
          }))
      );

      settled.forEach((result) => {
        if (result.status !== "fulfilled") return;
        loadedWeeks += 1;
        result.value.transactions.forEach((transaction) => {
          transactions.push({
            ...transaction,
            leg: transaction?.leg ?? result.value.week,
            week: result.value.week,
            sourceLeagueId: entry.leagueId,
            sourceSeason: entry.season,
          });
        });
      });

      if (loadedWeeks > 0) loadedLeagues += 1;
    }

    if (state.leagueId !== activeLeagueId) return;
    state.historyTransactions = dedupeTransactionsByLeague(transactions);
    state.historyTransactionsLoaded = true;
    state.historyTransactionsFailed = loadedLeagues === 0;
    state.historyTransactionLeaguesLoaded = loadedLeagues;
    state.historyTransactionLoadError = loadedLeagues === 0
      ? "Sleeper did not return archived transaction weeks for this league."
      : "";
    refreshLeagueBoard();
  } catch (err) {
    if (state.leagueId !== activeLeagueId) return;
    state.historyTransactions = [];
    state.historyTransactionsLoaded = true;
    state.historyTransactionsFailed = true;
    state.historyTransactionLoadError = err.message || "Could not load archived Sleeper transactions.";
  } finally {
    if (state.leagueId === activeLeagueId) {
      renderActivePage();
    }
  }
}

function resetHistoryCompareState() {
  state.historyMatchups = [];
  state.historyMatchupsLoaded = false;
  state.historyMatchupsFailed = false;
  state.historyMatchupLeaguesLoaded = 0;
  state.historyMatchupLoadError = "";
  state.historyCompare = {
    mode: "seasons",
    leftSeason: "",
    rightSeason: "",
    leftManagerKey: "",
    rightManagerKey: "",
  };
}

async function loadLeagueHistoryMatchups(historyEntries = []) {
  const activeLeagueId = state.leagueId;
  const entries = historyEntries
    .filter((entry) => entry?.leagueId)
    .slice(0, HISTORY_MATCHUP_SEASON_LIMIT);

  state.historyMatchups = [];
  state.historyMatchupsLoaded = entries.length === 0;
  state.historyMatchupsFailed = false;
  state.historyMatchupLeaguesLoaded = 0;
  state.historyMatchupLoadError = "";
  renderActivePage();

  if (entries.length === 0) return;

  const matchups = [];
  let loadedLeagues = 0;
  try {
    for (const entry of entries) {
      if (state.leagueId !== activeLeagueId) return;
      const weeks = buildTransactionWeeks(entry.league);
      const playoffStart = Number(entry.league?.settings?.playoff_week_start);
      const currentWeek = Number(state.nflState?.week) || 1;
      const orderedWeeks = entry.isCurrent
        ? [...weeks].sort((a, b) => Math.abs(a - currentWeek) - Math.abs(b - currentWeek) || a - b)
        : weeks;
      let loadedWeeks = 0;
      const chunkSize = MATCHUP_FETCH_CHUNK;
      for (let i = 0; i < orderedWeeks.length; i += chunkSize) {
        if (state.leagueId !== activeLeagueId) return;
        const chunk = orderedWeeks.slice(i, i + chunkSize);
        const settled = await Promise.allSettled(
          chunk.map((week) =>
            apiGetWithRetry(`/league/${entry.leagueId}/matchups/${week}`, { timeoutMs: 15000, retries: 1 })
              .then((weekMatchups) => ({
                week,
                matchups: Array.isArray(weekMatchups) ? weekMatchups : [],
              }))
          )
        );
        settled.forEach((result) => {
          if (result.status !== "fulfilled") return;
          loadedWeeks += 1;
          matchups.push(...buildWeekMatchupRecords(entry, result.value.week, result.value.matchups, playoffStart));
          if (entry.isCurrent) {
            state.seasonWeekRows.set(Number(result.value.week), result.value.matchups);
          }
        });
        if (entry.isCurrent && loadedWeeks > 0) {
          state.seasonLoaded = true;
          state.seasonLoadError = "";
          invalidateSeasonCaches();
          renderSessionSnapshot();
          renderActivePage();
          livePoller?.resume();
        }
      }
      if (loadedWeeks > 0) loadedLeagues += 1;
      if (entry.isCurrent) {
        state.seasonLoaded = loadedWeeks > 0;
        state.seasonLoadError = loadedWeeks > 0 ? "" : "Sleeper did not return matchups for the current season.";
        invalidateSeasonCaches();
        renderSessionSnapshot();
        renderActivePage();
        livePoller?.resume();
      }
    }

    if (state.leagueId !== activeLeagueId) return;
    state.historyMatchups = matchups;
    state.historyMatchupsLoaded = true;
    state.historyMatchupsFailed = loadedLeagues === 0;
    state.historyMatchupLeaguesLoaded = loadedLeagues;
    state.historyMatchupLoadError = loadedLeagues === 0
      ? "Sleeper did not return archived matchup weeks for this league."
      : "";
  } catch (err) {
    if (state.leagueId !== activeLeagueId) return;
    state.historyMatchups = [];
    state.historyMatchupsLoaded = true;
    state.historyMatchupsFailed = true;
    state.historyMatchupLoadError = err.message || "Could not load archived Sleeper matchups.";
  } finally {
    if (state.leagueId === activeLeagueId) {
      renderActivePage();
    }
  }
}

function buildWeekMatchupRecords(entry, week, weekMatchups, playoffStart) {
  const grouped = new Map();
  weekMatchups.forEach((row) => {
    const matchupId = Number(row?.matchup_id);
    if (!Number.isFinite(matchupId) || matchupId <= 0) return;
    if (!grouped.has(matchupId)) grouped.set(matchupId, []);
    grouped.get(matchupId).push(row);
  });

  const records = [];
  grouped.forEach((rows, matchupId) => {
    if (rows.length !== 2) return;
    const leftInfo = getHistoryRosterInfo(entry.leagueId, rows[0]?.roster_id);
    const rightInfo = getHistoryRosterInfo(entry.leagueId, rows[1]?.roster_id);
    if (!leftInfo || !rightInfo || leftInfo.managerKey === rightInfo.managerKey) return;
    const leftPoints = Number(rows[0]?.points || 0);
    const rightPoints = Number(rows[1]?.points || 0);
    if (!(leftPoints > 0 || rightPoints > 0)) return;
    records.push({
      season: String(entry.season || ""),
      leagueId: String(entry.leagueId || ""),
      week: Number(week),
      matchupId,
      isPlayoff: Number.isFinite(playoffStart) && Number(week) >= playoffStart,
      left: {
        rosterId: leftInfo.rosterId,
        managerKey: leftInfo.managerKey,
        managerName: leftInfo.managerName,
        points: leftPoints,
        ...matchupSidePlayers(rows[0]),
      },
      right: {
        rosterId: rightInfo.rosterId,
        managerKey: rightInfo.managerKey,
        managerName: rightInfo.managerName,
        points: rightPoints,
        ...matchupSidePlayers(rows[1]),
      },
    });
  });
  return records;
}

function matchupSidePlayers(row) {
  const starters = Array.isArray(row?.starters) ? row.starters.map(String).filter((id) => id && id !== "0") : [];
  const players = Array.isArray(row?.players) ? row.players.map(String).filter((id) => id && id !== "0") : [];
  return { starters, players: players.length ? players : starters };
}

function handleHistoryCompareClick(event) {
  const button = event.target.closest("[data-history-compare-mode]");
  if (!button) return;
  const mode = button.dataset.historyCompareMode === "managers" ? "managers" : "seasons";
  if (state.historyCompare.mode === mode) return;
  state.historyCompare.mode = mode;
  renderActivePage();
}

function handleHistoryCompareChange(event) {
  const select = event.target.closest("[data-history-compare-field]");
  if (!select) return;
  const field = select.dataset.historyCompareField;
  if (!["leftSeason", "rightSeason", "leftManagerKey", "rightManagerKey"].includes(field)) return;
  state.historyCompare[field] = select.value;
  renderActivePage();
}

function buildTransactionWeeks(league) {
  const playoffStart = Number(league?.settings?.playoff_week_start);
  const tradeDeadline = Number(league?.settings?.trade_deadline);
  const configuredEnd = Math.max(
    TRANSACTION_WEEK_FALLBACK_END,
    Number.isFinite(playoffStart) ? playoffStart + 3 : 0,
    Number.isFinite(tradeDeadline) ? tradeDeadline + 6 : 0
  );
  const endWeek = clamp(configuredEnd, TRANSACTION_WEEK_START, 22);
  const weeks = [];
  for (let week = TRANSACTION_WEEK_START; week <= endWeek; week++) {
    weeks.push(week);
  }
  return weeks;
}

function dedupeTransactions(transactions) {
  const byId = new Map();
  transactions.forEach((transaction) => {
    const transactionId = String(transaction?.transaction_id || "");
    if (!transactionId || byId.has(transactionId)) return;
    byId.set(transactionId, transaction);
  });
  return [...byId.values()].sort((a, b) => Number(b.status_updated || b.created || 0) - Number(a.status_updated || a.created || 0));
}

function dedupeTransactionsByLeague(transactions) {
  const byId = new Map();
  transactions.forEach((transaction) => {
    const transactionId = String(transaction?.transaction_id || "");
    if (!transactionId) return;
    const sourceLeagueId = String(transaction?.sourceLeagueId || transaction?.league_id || "");
    const key = `${sourceLeagueId}:${transactionId}`;
    if (byId.has(key)) return;
    byId.set(key, transaction);
  });
  return [...byId.values()].sort((a, b) => Number(b.status_updated || b.created || 0) - Number(a.status_updated || a.created || 0));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForNextPaint() {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame !== "function") {
      setTimeout(resolve, 0);
      return;
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(resolve);
    });
  });
}

function getPlayersCache() {
  try {
    const raw = localStorage.getItem(PLAYERS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.players || !parsed?.savedAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

function savePlayersCache(players, savedAt, stateKey = null) {
  try {
    localStorage.setItem(
      PLAYERS_CACHE_KEY,
      JSON.stringify({
        savedAt,
        stateKey,
        players,
      })
    );
  } catch {
    // Cache write failure is non-fatal (private mode/storage quota).
  }
}

function applyMeSelectValue(rosterId) {
  if (!el.meSelect || rosterId == null || rosterId === "") return;
  const token = String(rosterId);
  el.meSelect.value = token;
  const index = [...el.meSelect.options].findIndex((option) => option.value === token);
  if (index >= 0) {
    el.meSelect.selectedIndex = index;
    el.meSelect.options[index].selected = true;
  }
}

function hydrateManagerSelector() {
  if (!el.meSelect) return;
  const epoch = ++managerSelectorHydrateEpoch;
  managerSelectorHydrating = true;
  const chosen = resolveDefaultMeRoster({
    rosters: state.normalizedRosters,
    pendingMeRosterId: state.pendingMeRosterId,
    selectedRosterId: el.meSelect.value || state.meRosterId,
    sleeperUser: state.sleeperUser,
    rawRosters: state.rosters,
    userPickedMe: state.mePickedByUser,
  });
  state.pendingMeRosterId = null;
  el.meSelect.innerHTML = renderMeSelectOptions(state.normalizedRosters, chosen?.rosterId);
  if (chosen) {
    state.meRosterId = chosen.rosterId;
    applyMeSelectValue(chosen.rosterId);
  } else {
    state.meRosterId = null;
  }
  pruneSelectedOutgoingAssets();
  pruneExcludedOutgoingAssets();
  renderPlayerSearch();
  renderSessionSnapshot();
  renderActivePage();
  updateUrlState({ mode: "replace" });
  requestAnimationFrame(() => {
    if (epoch !== managerSelectorHydrateEpoch) return;
    if (chosen) applyMeSelectValue(chosen.rosterId);
    managerSelectorHydrating = false;
  });
}

function currentMeRosterId() {
  const fromState = Number(state.meRosterId);
  if (Number.isFinite(fromState) && fromState > 0) return fromState;
  const fromSelect = Number(el.meSelect?.value);
  if (Number.isFinite(fromSelect) && fromSelect > 0) return fromSelect;
  return null;
}

function getMyRoster() {
  const meRosterId = currentMeRosterId();
  if (!meRosterId) return null;
  state.meRosterId = meRosterId;
  return state.normalizedRosters.find((roster) => Number(roster.rosterId) === meRosterId) || null;
}

function getLensRoster() {
  if (state.lensRosterId != null) {
    const lens = state.normalizedRosters.find((roster) => Number(roster.rosterId) === Number(state.lensRosterId));
    if (lens) return lens;
  }
  return getMyRoster();
}

// The lens is the roster the app is viewing on Teams and the trade log.
// Null means "follow my team", so switching identity also resets the lens.
function setLensRoster(rosterId) {
  const next = Number(rosterId);
  state.lensRosterId = Number.isFinite(next) && next > 0 && next !== Number(state.meRosterId) ? next : null;
  if (state.weeklyValue) state.weeklyValue.selectedPlayerId = "";
}

function isViewingOtherRoster(roster) {
  return Boolean(roster) && String(roster.rosterId) !== String(state.meRosterId ?? "");
}

function findNormalizedRoster(rosterId) {
  return state.normalizedRosters.find((roster) => String(roster.rosterId) === String(rosterId)) || null;
}

function renderPowerDashboard() {
  if (!el.powerDashboard) return;
  const meRoster = getLensRoster();
  if (el.powerHeading) {
    el.powerHeading.textContent = meRoster ? `${meRoster.manager.displayName} scout card` : "Roster power";
  }
  if (!meRoster || state.normalizedRosters.length === 0) {
    el.powerDashboard.innerHTML = `<p class="muted">Choose your team to generate a power score.</p>`;
    return;
  }
  if (!state.playerMetadataLoaded) {
    el.powerDashboard.innerHTML = `
      <div class="power-sync">
        <strong>${state.playerMetadataFailed ? "Player metadata unavailable" : "Syncing player metadata"}</strong>
        <p class="muted">${
          state.playerMetadataFailed
            ? "Sleeper league data loaded, but positions and ages are missing. Trade search still works with fallback values."
            : "Power Score needs Sleeper positions, ages, injury flags, and team metadata before it can grade the roster."
        }</p>
      </div>
    `;
    return;
  }

  const context = buildLeaguePowerContext({
    league: state.league,
    rosters: state.normalizedRosters,
    values: state.values,
  });
  const profile = buildTeamPowerProfile({
    roster: meRoster,
    values: state.values,
    league: state.league,
    context,
  });
  const insights = buildSleeperInsightCards(profile, context);
  const windowCall = buildWindowCallForProfile(profile);
  const trendNote = state.trendingLoaded
    ? "Sleeper market trends loaded"
    : "Sleeper market trends syncing";

  const showPicks = leagueUsesFuturePicks(state.league) || Number(profile.assetSummary.pickValue) > 0
    || Number(profile.assetSummary.firstRoundPickCount) > 0;
  el.powerDashboard.innerHTML = `
    ${renderWindowCallBanner(windowCall)}
    <div class="power-hero">
      <div class="power-score-ring" style="--score:${profile.score}">
        <strong>${profile.score}</strong>
        <span>/100</span>
      </div>
      <div class="power-hero-copy">
        <div class="power-title-row">
          <h3>${profile.managerName} Power Level</h3>
          <span class="power-tier ${profile.tierClass}">${profile.grade}</span>
        </div>
        <p>${profile.laneLabel} • ${formatStarterRank(profile.rank, profile.totalTeams)} lineup • ${formatNumber(profile.metrics.starterValue)} starter value</p>
        <div class="power-badge-row">
          ${profile.badges.map((badge) => `<span class="power-badge">${badge}</span>`).join("")}
          <span class="power-badge muted-badge">${trendNote}</span>
        </div>
      </div>
    </div>
    <div class="power-stat-grid">
      ${renderPowerStat("Starter XP", formatNumber(profile.metrics.starterValue), profile.componentLabels.starter)}
      ${renderPowerStat("Bench XP", formatNumber(profile.metrics.benchValue), profile.componentLabels.bench)}
      ${showPicks ? renderPowerStat("Pick Vault", formatNumber(profile.assetSummary.pickValue), `${profile.assetSummary.firstRoundPickCount} firsts`) : ""}
      ${renderPowerStat("Timeline", profile.assetSummary.averageAgeLabel, profile.componentLabels.timeline)}
    </div>
    <div class="power-lanes">
      <section class="power-lane">
        <h4>Position Map</h4>
        <div class="position-meter-list">
          ${profile.positionSummaries.map(renderPositionMeter).join("")}
        </div>
      </section>
      <section class="power-lane">
        <h4>Sleeper Intel</h4>
        <div class="insight-list">
          ${insights.map(renderSleeperInsight).join("")}
        </div>
      </section>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Season engine glue: model, priors, simulation, and shared helpers
// ---------------------------------------------------------------------------

function getSeasonModel() {
  if (!state.league) return null;
  const key = [
    state.leagueId,
    weekRowsFingerprint(state.seasonWeekRows),
    state.seasonLoaded,
    state.rosters.length,
    state.users.length,
    state.playerMetadataLoaded,
    state.nflState?.week ?? "na",
  ].join("|");
  if (state.seasonModelCache.key === key && state.seasonModelCache.model) return state.seasonModelCache.model;
  const model = buildSeasonModel({
    league: state.league,
    rosters: state.rosters,
    users: state.users,
    weekRows: state.seasonWeekRows,
    nflState: state.nflState,
    optimalPoints: state.playerMetadataLoaded ? computeOptimalPointsForSide : null,
  });
  state.seasonModelCache = { key, model };
  return model;
}

function computeOptimalPointsForSide(side) {
  if (!state.playerMetadataLoaded || !Array.isArray(side?.players) || side.players.length === 0) return null;
  const values = {};
  const assets = side.players.map((playerId) => {
    const raw = state.players?.[playerId] || {};
    values[`player:${playerId}`] = Number(side.playersPoints?.[playerId]) || 0;
    return { assetId: `player:${playerId}`, name: String(playerId), assetType: "player", raw };
  });
  const lineup = buildOptimalStartingLineup(assets, getStarterRosterSlots(state.league), values);
  return lineup.starters.reduce((sum, entry) => sum + (entry.asset ? values[entry.asset.assetId] || 0 : 0), 0);
}

function getSimulation(model) {
  if (!model) return null;
  if (!state.seasonLoaded && model.remainingGames.length === 0 && !model.seasonComplete) return null;
  const key = simSignature(model);
  if (state.simCache.key === key) return state.simCache.result;
  let result = null;
  try {
    result = simulateSeason(model, { priors: buildSimPriors(model), iterations: SIM_ITERATIONS, seed: 20260911 });
  } catch (err) {
    console.warn("Playoff simulation failed", err);
  }
  state.simCache = { key, result };
  lastSimSignature = key;
  return result;
}

function buildSimPriors(model) {
  const priors = new Map();
  const previousRows = (state.previousRosters || [])
    .map((roster) => {
      const settings = roster?.settings || {};
      const games = Number(settings.wins || 0) + Number(settings.losses || 0) + Number(settings.ties || 0);
      return {
        ownerId: roster?.owner_id != null ? String(roster.owner_id) : "",
        rosterId: String(roster?.roster_id),
        games,
        pf: Number(settings.fpts || 0) + Number(settings.fpts_decimal || 0) / 100,
      };
    })
    .filter((row) => row.games > 0 && row.pf > 0);
  const previousLeaguePpg = previousRows.length
    ? previousRows.reduce((sum, row) => sum + row.pf, 0) / previousRows.reduce((sum, row) => sum + row.games, 0)
    : 0;
  const baseline = model.finalRegularWeeks >= 3 && model.leagueAverage > 0
    ? model.leagueAverage
    : previousLeaguePpg || model.leagueAverage || 125;

  const strength = state.normalizedRosters.length
    ? getCachedLeagueStrengthBaseline({ league: state.league, rosters: state.normalizedRosters, values: state.values })
    : null;
  const metricsByKey = new Map();
  strength?.metricsByRosterId.forEach((metrics, rosterId) => metricsByKey.set(String(rosterId), metrics));
  const starterValues = [...metricsByKey.values()].map((metrics) => metrics.starterValue);

  model.standings.forEach((team) => {
    const metrics = metricsByKey.get(String(team.rosterId));
    const percentile = metrics && starterValues.length > 1 ? percentileFromValues(starterValues, metrics.starterValue) : 0.5;
    const previous = previousRows.find((row) => row.ownerId && row.ownerId === team.ownerId)
      || previousRows.find((row) => row.rosterId === String(team.rosterId));
    const previousPpg = previous ? previous.pf / previous.games : null;
    priors.set(team.rosterId, blendSimPrior({ baseline, previousPpg, valuePercentile: percentile }));
  });
  return priors;
}

function buildPowerProfiles() {
  if (!state.league || state.normalizedRosters.length === 0) return [];
  const context = buildLeaguePowerContext({
    league: state.league,
    rosters: state.normalizedRosters,
    values: state.values,
  });
  return state.normalizedRosters
    .map((roster) => buildTeamPowerProfile({ roster, values: state.values, league: state.league, context }))
    .sort((a, b) => b.score - a.score || a.rank - b.rank || a.managerName.localeCompare(b.managerName));
}

function buildWindowCallForProfile(profile, { model = null, sim } = {}) {
  if (!profile) return null;
  const resolvedModel = model || getSeasonModel();
  const resolvedSim = sim !== undefined ? sim : getSimulation(resolvedModel);
  const standing = resolvedModel?.teams?.get(String(profile.rosterId)) || null;
  const simRow = resolvedSim?.byRosterId?.get(String(profile.rosterId)) || null;
  return analyzeWindowCall(windowCallInputFromDesk({
    profile,
    standing,
    simRow,
    model: resolvedModel,
    horizon: windowCallHorizon(state.league),
  }));
}

function buildLeagueWindowCalls({ profiles = null, model = null, sim } = {}) {
  const resolvedProfiles = profiles || buildPowerProfiles();
  const resolvedModel = model || getSeasonModel();
  const resolvedSim = sim !== undefined ? sim : getSimulation(resolvedModel);
  return resolvedProfiles.map((profile) => buildWindowCallForProfile(profile, {
    model: resolvedModel,
    sim: resolvedSim,
  })).filter(Boolean);
}

function getLensWindowCall({ profiles = null, model = null, sim } = {}) {
  const roster = getLensRoster();
  if (!roster) return null;
  const resolvedProfiles = profiles || buildPowerProfiles();
  const profile = resolvedProfiles.find((entry) => String(entry.rosterId) === String(roster.rosterId));
  return buildWindowCallForProfile(profile, { model, sim });
}

function getMyWindowCall({ profiles = null, model = null, sim } = {}) {
  const roster = getMyRoster();
  if (!roster) return null;
  const resolvedProfiles = profiles || buildPowerProfiles();
  const profile = resolvedProfiles.find((entry) => String(entry.rosterId) === String(roster.rosterId));
  return buildWindowCallForProfile(profile, { model, sim });
}

function managerForRosterId(rosterId) {
  const roster = findNormalizedRoster(rosterId);
  if (roster) return roster.manager;
  const team = getSeasonModel()?.teams.get(String(rosterId));
  if (team) return { displayName: team.name, avatar: team.avatar, teamName: team.teamName };
  const identity = resolveRosterIdentity(getFranchiseIndex(), { leagueId: state.leagueId, rosterId });
  return { displayName: identity.managerName, avatar: null };
}

function renderTeamIdentity(rosterId, { size = "sm", showTeamName = true, extra = "" } = {}) {
  const manager = managerForRosterId(rosterId);
  const isMe = String(rosterId) === String(state.meRosterId);
  const teamName = showTeamName ? (manager.teamName || "") : "";
  const subtitle = [teamName, extra].filter(Boolean).join(" · ");
  return `
    <span class="team-identity ${isMe ? "you" : ""}">
      ${renderAvatar(manager, { size })}
      <span class="team-identity-copy">
        <strong><span class="team-name">${escapeHtml(manager.displayName)}</span>${isMe ? `<span class="you-chip">You</span>` : ""}</strong>
        ${subtitle ? `<span>${escapeHtml(subtitle)}</span>` : ""}
      </span>
    </span>
  `;
}

function playerNameById(playerId) {
  const player = state.players?.[playerId];
  if (!player) return state.valueNameMap?.[`player:${playerId}`] || `Player ${playerId}`;
  return `${(player.first_name || "").trim()} ${(player.last_name || "").trim()}`.trim() || player.full_name || `Player ${playerId}`;
}

function playerPositionById(playerId) {
  return playerPositionForRaw(state.players?.[playerId]) || "";
}

function weekStatusChip(entry) {
  if (!entry) return "";
  const cls = entry.status === "live" ? "live" : entry.status === "final" ? "final" : "upcoming";
  const label = entry.status === "live" ? "Live" : entry.status === "final" ? "Final" : entry.status === "current" ? "This week" : "Upcoming";
  return `<span class="status-chip ${cls}">${label}</span>`;
}

function percentLabel(value) {
  return formatOddsPct(value);
}

function luckClass(luck) {
  if (!Number.isFinite(luck) || Math.abs(luck) < 0.5) return "";
  return luck > 0 ? "up" : "down";
}

function formatLuck(luck) {
  if (!Number.isFinite(luck)) return "—";
  return `${luck > 0 ? "+" : ""}${luck.toFixed(1)}`;
}

function seasonThroughLabel(model) {
  if (Number.isFinite(model?.finalThroughWeek) && model.finalThroughWeek > 0) {
    return `${model.season} through Week ${model.finalThroughWeek}`;
  }
  if (model?.featuredWeek) return `${model.season} · ${model.featuredWeek.label} still live`;
  return `${model.season} · waiting on Week 1`;
}

// ---------------------------------------------------------------------------
// League: Scores, Standings, Power
// ---------------------------------------------------------------------------

function leagueRoomEmptyState(host, copy) {
  if (!host) return false;
  if (!state.league || state.normalizedRosters.length === 0) {
    host.innerHTML = `<p class="muted">${copy}</p>`;
    return false;
  }
  return true;
}

function renderStartRoom() {
  const host = el.startDashboard;
  if (!host) return;
  if (!state.league || state.normalizedRosters.length === 0) {
    host.innerHTML = `<p class="muted">Load a league to pick a job.</p>`;
    return;
  }
  const me = String(getMyRoster()?.manager?.displayName || "").trim();
  const deskJobs = deskJobsForLeague(state.league);
  host.innerHTML = renderDeskJobsMarkup({
    heading: me ? `What do you want to do, ${me}?` : "What do you want to do?",
    hint: "Pick a job. Everything else stays one tap away in the tabs.",
    more: true,
    action: "go",
    jobs: deskJobs.jobs,
    moreJobs: deskJobs.more,
  });
}

function renderScoresRoom() {
  if (!leagueRoomEmptyState(el.scoresDashboard, "Load a league to open the scoreboard.")) return;
  const model = getSeasonModel();
  const sim = getSimulation(model);
  const profiles = buildPowerProfiles();
  el.scoresDashboard.innerHTML = `
    ${renderPulseStrip(model, sim, profiles)}
    ${renderScoreboardPanel(model, sim)}
    ${renderWeekAnglesPanel(model, sim)}
  `;
}

function renderStandingsRoom() {
  if (!leagueRoomEmptyState(el.standingsDashboard, "Load a league to open the standings.")) return;
  const model = getSeasonModel();
  const sim = getSimulation(model);
  el.standingsDashboard.innerHTML = `
    <div class="home-two-col">
      ${renderStandingsPanel(model, sim)}
      ${renderPlayoffOddsPanel(model, sim)}
    </div>
    ${renderLuckIndexPanel(model)}
  `;
}

function renderPowerRoom() {
  if (!leagueRoomEmptyState(el.powerBoardDashboard, "Load a league to rank the rosters.")) return;
  const model = getSeasonModel();
  const profiles = buildPowerProfiles();
  el.powerBoardDashboard.innerHTML = profiles.length
    ? renderHomePowerBoard(profiles, model)
    : `<p class="muted">Values are still syncing. The power board appears once market values load.</p>`;
}

function renderPulseStrip(model, sim, profiles) {
  const leader = model.standings[0] || null;
  const hasGames = model.standings.some((team) => team.gamesPlayed > 0);
  const favorite = sim?.results?.[0] || null;
  const champion = model.seasonComplete ? resolveCurrentChampion() : null;
  const deadline = Number(state.league?.settings?.trade_deadline);
  const tradeCount = state.transactions.filter((transaction) => transaction?.type === "trade" && transaction?.status === "complete").length;
  const hotTeam = model.standings
    .filter((team) => team.streak?.type === "W" && team.streak.length >= 2)
    .sort((a, b) => b.streak.length - a.streak.length)[0] || null;
  const topPower = profiles[0] || null;
  const matchPreview = buildTradeMatchPreview(profiles);
  const myCall = getMyWindowCall({ profiles, model, sim });
  const tiles = [
    {
      label: "Week",
      page: "league",
      room: "scores",
      value: model.seasonComplete ? "Final" : `Week ${model.currentWeek}`,
      detail: model.seasonComplete
        ? `${model.season} season complete`
        : !state.seasonLoaded
          ? "syncing matchups"
          : model.currentWeekEntry?.isLive
            ? "games in progress"
            : model.currentWeekEntry?.isPlayoff
              ? "playoff round"
              : `${model.remainingGames.length} regular-season games left`,
      tone: model.currentWeekEntry?.isLive ? "live" : "blue",
    },
    {
      label: hasGames ? "Standings leader" : "Preseason favorite",
      page: "league",
      room: "standings",
      value: hasGames ? leader?.name || "TBD" : favorite?.name || topPower?.managerName || "TBD",
      detail: hasGames ? `${leader?.recordLabel || ""} · ${formatPoints(leader?.pf || 0)} PF` : favorite ? `${percentLabel(favorite.titlePct)} title odds` : "value model",
      tone: "gold",
    },
    {
      label: champion ? "Champion" : "Title favorite",
      page: champion ? "league" : "league",
      room: champion ? "history" : "standings",
      value: champion ? champion.managerName : favorite?.name || "TBD",
      detail: champion ? `${model.season} league winner` : favorite ? `${percentLabel(favorite.titlePct)} title · ${percentLabel(favorite.playoffPct)} playoffs` : "simulation pending",
      tone: "green",
    },
    myCall
      ? {
        label: "Ticker call",
        page: "teams",
        room: "call",
        value: myCall.shortLabel,
        detail: myCall.headline,
        tone: myCall.tone === "gold" ? "gold" : myCall.tone === "rose" ? "rose" : "green",
      }
      : {
        label: hotTeam ? "Hot hand" : "Power leader",
        page: "league",
        room: hotTeam ? "standings" : "power",
        value: hotTeam ? hotTeam.name : topPower?.managerName || "TBD",
        detail: hotTeam ? `${hotTeam.streak.length} straight wins` : topPower ? `${topPower.score}/100 power score` : "values syncing",
        tone: "rose",
      },
    matchPreview
      ? {
        label: "Trade match",
        page: "trades",
        room: "match",
        value: `${matchPreview.need} hole`,
        detail: `${matchPreview.managerName} · ${matchPreview.laneLabel}`,
        tone: "gold",
      }
      : {
        label: "Trade board",
        page: "trades",
        room: "log",
        value: state.transactionsLoaded ? `${tradeCount} trade${tradeCount === 1 ? "" : "s"}` : "Syncing",
        detail: Number.isFinite(deadline) && deadline > 0
          ? model.currentWeek > deadline && !model.seasonComplete ? `deadline passed (Week ${deadline})` : `deadline Week ${deadline}`
          : "no trade deadline",
        tone: "blue",
      },
  ];
  return `
    <div class="pulse-grid">
      ${tiles.map((tile) => `
        <button type="button" class="pulse-tile ${tile.tone}" data-action="go" data-page="${tile.page}" data-room="${tile.room}" title="Open ${escapeHtml(ROOM_LABELS[tile.page]?.[tile.room] || tile.room)}">
          <span>${escapeHtml(tile.label)}</span>
          <strong>${escapeHtml(tile.value)}</strong>
          <small>${escapeHtml(tile.detail)}</small>
        </button>
      `).join("")}
    </div>
  `;
}

function resolveCurrentChampion() {
  const entry = state.leagueHistory.find((item) => item.isCurrent);
  if (!entry) return null;
  const snapshot = buildSeasonSnapshot(entry);
  return snapshot?.champion || null;
}

function resolveHomeWeekEntry(model) {
  const candidates = model.weeks.filter((entry) => entry.games.length > 0);
  if (candidates.length === 0) return null;
  const requested = state.homeWeek != null ? candidates.find((entry) => entry.week === Number(state.homeWeek)) : null;
  return requested || model.featuredWeek || candidates[0];
}

function renderScoreboardPanel(model, sim) {
  const entry = resolveHomeWeekEntry(model);
  if (!entry) {
    return `
      <section class="workspace-panel scoreboard-panel">
        <div class="panel-heading">
          <div>
            <span class="eyebrow">Scoreboard</span>
            <h2>Matchups</h2>
          </div>
          <p class="section-copy">${state.seasonLoaded ? escapeHtml(state.seasonLoadError || "Sleeper has not published a schedule for this league yet.") : "Syncing matchups from Sleeper…"}</p>
        </div>
      </section>
    `;
  }
  const weeksWithGames = model.weeks.filter((item) => item.games.length > 0).map((item) => item.week);
  const index = weeksWithGames.indexOf(entry.week);
  const previousWeek = index > 0 ? weeksWithGames[index - 1] : null;
  const nextWeek = index >= 0 && index < weeksWithGames.length - 1 ? weeksWithGames[index + 1] : null;
  const distributions = sim?.distributions || buildTeamDistributions(model, buildSimPriors(model));
  const caption = entry.status === "final"
    ? "Final scores. Win probability shown is what the ticker had before kickoff."
    : entry.status === "live"
      ? "Live scores from Sleeper. Probabilities are pre-game, from each roster's scoring profile."
      : "Pre-game win probability from each roster's scoring profile and simulated priors.";

  return `
    <section class="workspace-panel scoreboard-panel">
      <div class="panel-heading scoreboard-heading">
        <div>
          <span class="eyebrow">Scoreboard</span>
          <h2>${escapeHtml(entry.label)} ${weekStatusChip(entry)}</h2>
        </div>
        <div class="week-nav">
          <button type="button" class="ghost-btn" data-action="home-week" data-week="${previousWeek ?? ""}" ${previousWeek == null ? "disabled" : ""}>Prev</button>
          <span>${index + 1} / ${weeksWithGames.length}</span>
          <button type="button" class="ghost-btn" data-action="home-week" data-week="${nextWeek ?? ""}" ${nextWeek == null ? "disabled" : ""}>Next</button>
        </div>
      </div>
      <p class="muted small scoreboard-caption">${caption}</p>
      <div class="game-grid">
        ${entry.games.map((game) => renderGameCard(game, entry, model, distributions)).join("")}
        ${entry.byes.map((side) => `
          <article class="game-card bye">
            ${renderTeamIdentity(side.rosterId, { showTeamName: false })}
            <span class="muted small">Bye week</span>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function renderWeekAnglesPanel(model, sim) {
  const angles = scoreUpcomingWeekAngles(model, sim);
  if (!angles.cards.length) return "";
  return `
    <section class="workspace-panel week-angles-panel">
      <div class="panel-heading">
        <div>
          <span class="eyebrow">Upcoming week</span>
          <h2>${escapeHtml(angles.label || "This week")} · dark horses</h2>
        </div>
        <p class="section-copy">Win% from the scoring-profile sim (empirical-Bayes mean/std, Gaussian matchup CDF, Monte Carlo playoff bubble). Not a KTC roster check.</p>
      </div>
      <div class="award-grid week-angles-grid">
        ${angles.cards.map(renderAwardCard).join("")}
      </div>
    </section>
  `;
}

function renderGameCard(game, entry, model, distributions) {
  const [left, right] = game.sides;
  const leftTeam = model.teams.get(left.rosterId);
  const rightTeam = model.teams.get(right.rosterId);
  const leftDist = distributions.get(left.rosterId);
  const rightDist = distributions.get(right.rosterId);
  const leftProb = winProbability(leftDist, rightDist);
  const rightProb = 1 - leftProb;
  const showScores = entry.status !== "upcoming" && (game.played || entry.status === "final");
  const isFinal = entry.status === "final";
  const leftWon = isFinal && showScores && left.points > right.points;
  const rightWon = isFinal && showScores && right.points > left.points;
  const involvesMe = [left.rosterId, right.rosterId].includes(String(state.meRosterId));
  const renderSide = (side, team, dist, prob, won) => `
    <div class="game-side ${won ? "winner" : ""} ${String(side.rosterId) === String(state.meRosterId) ? "you" : ""}">
      ${renderTeamIdentity(side.rosterId, { extra: team?.recordLabel || "" })}
      <div class="game-side-score">
        ${showScores
          ? `<strong>${formatPoints(side.points)}</strong>`
          : `<strong class="proj">${percentLabel(prob * 100)}</strong>`}
        <small>${showScores ? `${percentLabel(prob * 100)} pre-game` : `proj ${formatPoints(dist?.mean || 0)}`}</small>
      </div>
    </div>
  `;
  return `
    <article class="game-card ${involvesMe ? "featured" : ""} ${entry.status}">
      ${renderSide(left, leftTeam, leftDist, leftProb, leftWon)}
      <div class="prob-bar" aria-hidden="true">
        <span class="prob-left" style="width:${Math.round(leftProb * 100)}%"></span>
        <span class="prob-right" style="width:${Math.round(rightProb * 100)}%"></span>
      </div>
      ${renderSide(right, rightTeam, rightDist, rightProb, rightWon)}
      <footer class="game-card-footer">
        <span>${entry.status === "final" ? "Final" : entry.status === "live" ? "Live" : "Kickoff pending"}</span>
        <span>${showScores && game.margin > 0 ? `Margin ${formatPoints(game.margin)}` : `Matchup ${game.matchupId}`}</span>
      </footer>
    </article>
  `;
}

function renderStandingsPanel(model, sim) {
  const hasGames = model.standings.some((team) => team.gamesPlayed > 0 || team.wins + team.losses > 0);
  const showDivisions = model.divisions.length > 1;
  const view = showDivisions && state.standingsView === "division" ? "division" : "overall";
  const rowOpts = { playoffTeams: model.playoffTeams, hasGames };
  const rowsHtml = view === "division"
    ? model.divisions.map((division) => `
        <div class="standings-division">
          <h4>${escapeHtml(division.name)}</h4>
          ${division.teams.map((team, index) => renderStandingsRow(team, sim, { ...rowOpts, showLine: false, position: index + 1, divisionLeader: index === 0 })).join("")}
        </div>
      `).join("")
    : model.standings.map((team, index) => renderStandingsRow(team, sim, {
        ...rowOpts,
        showLine: hasGames && index === model.playoffTeams - 1 && index < model.standings.length - 1,
        position: index + 1,
      })).join("");

  return `
    <section class="workspace-panel standings-panel">
      <div class="panel-heading">
        <div>
          <span class="eyebrow">Standings</span>
          <h2>${hasGames && model.finalThroughWeek > 0 ? `Through Week ${model.finalThroughWeek}` : "Season outlook"}</h2>
        </div>
        ${showDivisions ? `
          <div class="segmented" role="group" aria-label="Standings view">
            <button type="button" class="${view === "overall" ? "active" : ""}" data-action="standings-view" data-view="overall">Overall</button>
            <button type="button" class="${view === "division" ? "active" : ""}" data-action="standings-view" data-view="division">Divisions</button>
          </div>
        ` : ""}
      </div>
      <div class="standings-legend muted small">
        <span>All-play: record against every team each week.</span>
        <span>Luck: real wins minus all-play expected wins.</span>
        ${model.medianGames ? "<span>Includes weekly median games.</span>" : ""}
      </div>
      <div class="standings-table">
        <div class="standings-head">
          <span>#</span><span>Team</span><span>W-L</span><span class="col-pf">PF</span><span class="col-pa">PA</span><span class="col-streak">Strk</span><span class="col-allplay">All-play</span><span class="col-luck">Luck</span>
        </div>
        ${rowsHtml}
      </div>
      ${!hasGames ? `<p class="muted small">No finalized games yet. Projected wins come from ${sim ? sim.iterations.toLocaleString() : "the"} simulated seasons.</p>` : ""}
    </section>
  `;
}

function renderStandingsRow(team, sim, { showLine, position, divisionLeader = false, playoffTeams = 6, hasGames = false }) {
  const odds = sim?.byRosterId?.get(team.rosterId);
  const seed = team.seed;
  const badges = [];
  if (hasGames && seed && seed <= playoffTeams) badges.push(`<span class="seed-chip">${seed}</span>`);
  if (divisionLeader) badges.push(`<span class="mini-chip">Div lead</span>`);
  if (odds?.clinched) badges.push(`<span class="mini-chip green">Clinched</span>`);
  if (odds?.eliminated) badges.push(`<span class="mini-chip rose">Out</span>`);
  const streakLabel = team.streak?.length ? team.streak.label : "—";
  return `
    <div class="standings-row ${String(team.rosterId) === String(state.meRosterId) ? "you" : ""} ${showLine ? "playoff-line" : ""}" data-action="set-lens-teams" data-roster-id="${team.rosterId}">
      <span class="rank-number">${position}</span>
      <div class="standings-team">
        ${renderTeamIdentity(team.rosterId, { showTeamName: false })}
        <span class="standings-badges">${badges.join("")}</span>
      </div>
      <span class="mono">${escapeHtml(team.recordLabel)}</span>
      <span class="mono col-pf">${team.gamesPlayed ? formatPoints(team.pf) : odds ? `<em title="Projected wins">${odds.projectedWins.toFixed(1)} proj W</em>` : "—"}</span>
      <span class="mono col-pa">${team.gamesPlayed ? formatPoints(team.pa) : "—"}</span>
      <span class="streak col-streak ${team.streak?.type === "W" ? "up" : team.streak?.type === "L" ? "down" : ""}">${streakLabel}</span>
      <span class="mono col-allplay">${team.allPlayGames ? escapeHtml(team.allPlayRecord) : "—"}</span>
      <span class="mono luck col-luck ${luckClass(team.luck)}">${team.gamesPlayed ? formatLuck(team.luck) : "—"}</span>
    </div>
  `;
}

function renderPlayoffOddsPanel(model, sim) {
  if (model.seasonComplete) {
    const champion = resolveCurrentChampion();
    const snapshot = state.leagueHistory.find((item) => item.isCurrent) ? buildSeasonSnapshot(state.leagueHistory.find((item) => item.isCurrent)) : null;
    return `
      <section class="workspace-panel odds-panel">
        <div class="panel-heading">
          <div>
            <span class="eyebrow">Playoffs</span>
            <h2>Season complete</h2>
          </div>
        </div>
        <div class="champion-card">
          ${champion ? renderTeamIdentity(champion.rosterId, { size: "lg", extra: `${model.season} champion` }) : `<p class="muted">Champion not published by Sleeper yet.</p>`}
          ${snapshot?.runnerUp ? `<p class="muted small">Runner-up: ${escapeHtml(snapshot.runnerUp.managerName)}</p>` : ""}
        </div>
      </section>
    `;
  }
  if (!sim) {
    return `
      <section class="workspace-panel odds-panel">
        <div class="panel-heading">
          <div>
            <span class="eyebrow">Playoff Odds</span>
            <h2>Simulation pending</h2>
          </div>
          <p class="section-copy">Matchups are still syncing from Sleeper.</p>
        </div>
      </section>
    `;
  }
  const rows = sim.results.slice().sort((a, b) => b.playoffPct - a.playoffPct || b.titlePct - a.titlePct);
  const phase = model.regularSeasonComplete ? "bracket" : "regular";
  const preseason = !Number.isFinite(model.finalThroughWeek) || model.finalThroughWeek < 1;
  const heading = phase === "bracket" ? "Title odds" : `${model.playoffTeams} playoff spots`;
  const copy = preseason
    ? `${sim.remainingGameCount} games left. ${sim.iterations.toLocaleString()} simulated seasons. Each season draws team quality from the posterior so a stacked roster is not a Week 1 lock. Last year's pace and starter value still lean the board.`
    : `${sim.remainingGameCount} games left. ${sim.iterations.toLocaleString()} simulated seasons. Scores come from a blend of this year's results, last year's pace, and dynasty starter value, with team quality redrawn each season. 100% only if the playoff field cannot catch them.`;
  return `
    <section class="workspace-panel odds-panel">
      <div class="panel-heading stack">
        <div>
          <span class="eyebrow">Playoff Odds</span>
          <h2>${heading}</h2>
        </div>
        <p class="section-copy">${copy}</p>
      </div>
      <div class="odds-table">
        <div class="odds-head"><span>Team</span><span>Playoffs</span><span>Title</span><span>Proj W</span></div>
        ${rows.map((row) => renderOddsRow(row, sim)).join("")}
      </div>
      <p class="muted small">${model.divisionCount > 1 ? "Division winners take the top seeds (Sleeper default). " : ""}${sim.byeCount > 0 ? `Top ${sim.byeCount} seed${sim.byeCount === 1 ? "" : "s"} get a first-round bye.` : ""}</p>
    </section>
  `;
}

function renderOddsRow(row, sim) {
  const flags = [];
  if (row.clinched) flags.push(`<span class="mini-chip green">Clinched</span>`);
  if (row.eliminated) flags.push(`<span class="mini-chip rose">Eliminated</span>`);
  if (!row.clinched && !row.eliminated && sim.byeCount > 0 && row.byePct >= 50) flags.push(`<span class="mini-chip">Bye ${percentLabel(row.byePct)}</span>`);
  return `
    <div class="odds-row ${String(row.rosterId) === String(state.meRosterId) ? "you" : ""}">
      <div class="odds-team">
        ${renderTeamIdentity(row.rosterId, { showTeamName: false })}
        <span class="standings-badges">${flags.join("")}</span>
      </div>
      <div class="odds-meter">
        <div class="meter-track"><span style="width:${Math.max(1, Math.min(100, row.playoffPct))}%"></span></div>
        <strong>${percentLabel(row.playoffPct)}</strong>
      </div>
      <div class="odds-meter title">
        <div class="meter-track"><span style="width:${Math.max(1, Math.min(100, row.titlePct))}%"></span></div>
        <strong>${percentLabel(row.titlePct)}</strong>
      </div>
      <span class="mono">${row.projectedWins.toFixed(1)}</span>
    </div>
  `;
}

function renderHomePowerBoard(profiles, model) {
  if (profiles.length === 0) return "";
  const maxStarter = Math.max(1, ...profiles.map((profile) => profile.metrics.starterValue));
  const redraft = leagueTypeId(state.league) === "redraft";
  const showPicks = leagueUsesFuturePicks(state.league);
  const caveat = marketCaveat(state.league);
  return `
    <section class="workspace-panel power-board-panel">
      <div class="panel-heading stack">
        <div>
          <span class="eyebrow">Power Rankings</span>
          <h2>${redraft ? "This-year roster board" : "Dynasty value board"}</h2>
        </div>
        <p class="section-copy">${redraft
          ? `${caveat} Tap a team to open its scout card.`
          : "Optimal-lineup value, depth, pick capital, and roster age, scored 35-99. Tap a team to open its scout card."}</p>
      </div>
      <div class="power-board">
        ${profiles.map((profile, index) => {
          const team = model?.teams.get(String(profile.rosterId));
          return `
            <button type="button" class="power-board-row ${String(profile.rosterId) === String(state.meRosterId) ? "you" : ""}" data-action="set-lens-teams" data-roster-id="${profile.rosterId}">
              <span class="rank-number">${index + 1}</span>
              ${renderTeamIdentity(profile.rosterId, { extra: `${profile.laneLabel}${team?.gamesPlayed ? ` · ${team.recordLabel}` : ""}` })}
              <div class="power-board-meter">
                <div class="meter-track"><span style="width:${Math.round(profile.metrics.starterValue / maxStarter * 100)}%"></span></div>
                <small>${formatNumber(profile.metrics.starterValue)} starters${showPicks ? ` · ${formatNumber(profile.assetSummary.pickValue)} picks` : ""} · ${profile.assetSummary.averageAgeLabel}</small>
              </div>
              <span class="power-tier ${profile.tierClass}">${profile.grade}</span>
              <strong class="power-score">${profile.score}</strong>
            </button>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

// ---------------------------------------------------------------------------
// Teams explorer
// ---------------------------------------------------------------------------

function renderTeamsPage() {
  syncLeagueFormatCopy();
  renderTeamsGrid();
  renderPowerDashboard();
  renderRosterSheet();
  void ensureWeeklyValueContext();
}

function syncLeagueFormatCopy() {
  const teamsHint = document.querySelector("#teams-tab-hint");
  if (teamsHint) teamsHint.textContent = pageHintForLeague("teams", state.league) || "Roster, tank or contend, mock";
  const gridCopy = document.querySelector("#teams-grid-copy");
  if (gridCopy) {
    gridCopy.textContent = leagueTypeId(state.league) === "redraft"
      ? "Ranked by current power. Sit/start is this week. Tap a card for the scout."
      : "Ranked by dynasty power score. Your team is outlined. Tap any card to open its scout card, desk call, and lineup below, or start a trade.";
  }
  const powerCopy = document.querySelector("#power-section-copy");
  if (powerCopy) {
    powerCopy.textContent = leagueTypeId(state.league) === "redraft"
      ? "Power score, in-it-or-out call, sit/start, and Sleeper intel for the selected roster."
      : "Power score, tank-or-contend call, lineup rank, position map, and Sleeper intel for the selected roster.";
  }
}

function renderMockBoard() {
  const host = el.mockDashboard;
  if (!host) return;
  void ensureMockDraftsLoaded().then(() => {
    if (getRoom("teams") !== "mock") return;
    paintMockBoard();
  });
  paintMockBoard();
}

function paintMockBoard() {
  const host = el.mockDashboard;
  if (!host) return;
  const place = currentPlaceForOwner(
    state.meRosterId,
    buildCurrentPlaceLookup(state.rosters, getSeasonModel()?.standings)
  );
  const mySlot = projectedDraftSlot(place?.rank, place?.total);
  const board = buildMockBoardModel(state.mockDrafts, { mySlot });
  if (board.empty) {
    host.innerHTML = `<p class="muted">No stored rookie mock yet.</p>`;
    return;
  }
  const byline = [
    board.source,
    board.format === "superflex" ? "Superflex" : board.format,
    board.author,
    board.dateLabel,
  ].filter(Boolean).join(" · ");
  const sourceLink = board.url
    ? `<a class="inline-link" href="${escapeHtml(board.url)}" target="_blank" rel="noopener noreferrer">Open article</a>`
    : "";
  const slotLabels = mySlot
    ? `${formatPickSlotLabel(1, mySlot)} and ${formatPickSlotLabel(2, mySlot)}`
    : "";
  const mineNote = mySlot
    ? `You sit ${place.label} now, so your names are ${slotLabels}. 3rds stay pick labels. College names have no trade value.`
    : "1sts and 2nds get these names from current place. 3rds stay pick labels. College names have no trade value.";
  const focusId = state.mockFocus
    ? mockPickDomId(state.mockFocus.round, state.mockFocus.slot)
    : "";
  host.innerHTML = `
    <section class="workspace-panel mock-board">
      <div class="panel-heading">
        <div>
          <span class="eyebrow">Rookie mock</span>
          <h2>${escapeHtml(String(board.season || "Next"))} SF board</h2>
        </div>
        <p class="section-copy">${escapeHtml(byline)}${sourceLink ? ` · ${sourceLink}` : ""}</p>
      </div>
      <p class="muted mock-board-note">${escapeHtml(mineNote)}</p>
      <div class="sheet-grid">
        ${board.rounds.map((round) => `
          <section class="sheet-column">
            <h4>${escapeHtml(round.label)}</h4>
            ${round.picks.map((pick) => {
              const focused = Boolean(focusId && pick.id === focusId);
              const href = board.url
                ? ` href="${escapeHtml(board.url)}" target="_blank" rel="noopener noreferrer"`
                : "";
              const tag = board.url ? "a" : "div";
              return `
              <${tag} class="sheet-row pick mock-pick${pick.mine ? " mock-mine" : ""}${focused ? " mock-focus" : ""}"${pick.id ? ` id="${escapeHtml(pick.id)}"` : ""}${href}>
                <span class="sheet-slot">${escapeHtml(pick.pickLabel)}</span>
                <div class="sheet-player">
                  <strong>${escapeHtml(pick.name)}${pick.mine ? `<em class="mock-you"> your slot</em>` : ""}</strong>
                  <span>${escapeHtml([pick.pos, pick.school].filter(Boolean).join(" · "))}</span>
                </div>
                <span class="sheet-value muted">${escapeHtml(pick.pos)}</span>
              </${tag}>
            `;
            }).join("") || `<p class="muted small">No names this round.</p>`}
          </section>
        `).join("")}
      </div>
    </section>
  `;
  revealMockFocus();
}

function openMockBoardAt(round, slot) {
  const rnd = Number(round);
  const n = Number(slot);
  if (!Number.isFinite(rnd) || !Number.isFinite(n) || rnd < 1 || n < 1) return;
  state.mockFocus = { round: rnd, slot: n };
  const onMock = state.activePage === "teams" && getRoom("teams") === "mock";
  if (onMock) paintMockBoard();
  else openRoom("teams", "mock", { history: "push", scroll: "preserve" });
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => revealMockFocus());
  });
}

function revealMockFocus() {
  const focus = state.mockFocus;
  if (!focus) return;
  const node = document.getElementById(mockPickDomId(focus.round, focus.slot));
  if (!node) return;
  node.scrollIntoView({ behavior: "smooth", block: "center" });
}

function rosterManagerKey(roster) {
  if (!roster?.manager) return "";
  return buildManagerKey(roster.manager.userId, state.leagueId, roster.rosterId);
}

function playerIdsFromRoster(roster) {
  return (roster?.assets || [])
    .filter((asset) => asset.assetType === "player")
    .map((asset) => String(asset.assetId || "").replace(/^player:/, ""))
    .filter(Boolean);
}

function playerValueById(playerId) {
  const id = String(playerId || "").replace(/^player:/, "");
  if (!id) return 0;
  return Number(getAssetValue({
    assetId: `player:${id}`,
    assetType: "player",
    name: playerNameById(id),
    raw: state.players?.[id] || {},
  })) || 0;
}

function playerAgeById(playerId) {
  const id = String(playerId || "").replace(/^player:/, "");
  const age = Number(state.players?.[id]?.age);
  return Number.isFinite(age) ? age : null;
}

function gameResult(leftPoints, rightPoints) {
  if (Number(leftPoints) > Number(rightPoints)) return "W";
  if (Number(leftPoints) < Number(rightPoints)) return "L";
  return "T";
}

function seasonPlayerSetsForManager(managerKey) {
  const seasons = [];
  const seen = new Set();
  const pushSeason = (season, ids) => {
    const key = String(season || "");
    if (!key || seen.has(key)) return;
    seen.add(key);
    seasons.push({ season: key, ids: [...new Set((ids || []).map(String).filter(Boolean))] });
  };

  (state.leagueHistory || []).forEach((entry) => {
    const roster = (entry.rosters || []).find((item) => getHistoryRosterInfo(entry.leagueId, item.roster_id)?.managerKey === managerKey);
    if (!roster) return;
    pushSeason(entry.season || entry.league?.season, roster.players || []);
  });

  const current = state.normalizedRosters.find((roster) => rosterManagerKey(roster) === managerKey);
  if (current) pushSeason(state.league?.season, playerIdsFromRoster(current));
  return seasons.sort((a, b) => Number(a.season) - Number(b.season));
}

function previousSeasonPlayerIds(managerKey) {
  const seasons = seasonPlayerSetsForManager(managerKey);
  const current = String(state.league?.season || seasons.at(-1)?.season || "");
  const prev = [...seasons].reverse().find((row) => Number(row.season) < Number(current));
  return prev?.ids || [];
}

function collectCharmAppearances(roster) {
  const appearances = [];
  const rosterId = String(roster?.rosterId ?? "");
  const managerKey = rosterManagerKey(roster);
  const model = getSeasonModel();
  const currentSeason = String(model?.season || state.league?.season || "");

  (model?.weeks || []).forEach((week) => {
    if (!week?.hasPoints) return;
    (week.games || []).forEach((game) => {
      const mine = (game.sides || []).find((side) => String(side.rosterId) === rosterId);
      const opp = (game.sides || []).find((side) => String(side.rosterId) !== rosterId);
      if (!mine || !opp) return;
      if (!(mine.points > 0 || opp.points > 0)) return;
      const result = gameResult(mine.points, opp.points);
      const starters = new Set((mine.starters || []).map(String));
      const players = [...new Set((mine.players || mine.starters || []).map(String))];
      players.forEach((playerId) => {
        if (!playerId || playerId === "0") return;
        appearances.push({ playerId, started: starters.has(playerId), result, season: currentSeason, week: week.week });
      });
    });
  });

  (state.historyMatchups || []).forEach((matchup) => {
    if (String(matchup.season) === currentSeason) return;
    const mine = matchup.left?.managerKey === managerKey
      ? matchup.left
      : matchup.right?.managerKey === managerKey
        ? matchup.right
        : null;
    const opp = mine === matchup.left ? matchup.right : matchup.left;
    if (!mine || !opp) return;
    const result = gameResult(mine.points, opp.points);
    const starters = new Set((mine.starters || []).map(String));
    const players = [...new Set((mine.players || mine.starters || []).map(String))];
    players.forEach((playerId) => {
      if (!playerId || playerId === "0") return;
      appearances.push({ playerId, started: starters.has(playerId), result, season: matchup.season, week: matchup.week });
    });
  });
  return appearances;
}

function managerWinPct(roster) {
  const team = getSeasonModel()?.teams.get(String(roster?.rosterId));
  let wins = Number(team?.wins || 0);
  let losses = Number(team?.losses || 0);
  let ties = Number(team?.ties || 0);
  const managerKey = rosterManagerKey(roster);
  const currentSeason = String(state.league?.season || "");
  (state.historyMatchups || []).forEach((matchup) => {
    if (String(matchup.season) === currentSeason) return;
    const mine = matchup.left?.managerKey === managerKey
      ? matchup.left
      : matchup.right?.managerKey === managerKey
        ? matchup.right
        : null;
    const opp = mine === matchup.left ? matchup.right : matchup.left;
    if (!mine || !opp) return;
    const mark = gameResult(mine.points, opp.points);
    if (mark === "W") wins += 1;
    else if (mark === "L") losses += 1;
    else ties += 1;
  });
  return winPctFromRecord({ wins, losses, ties });
}

function managerGamesForAnalyzer(roster) {
  const games = [];
  const rosterId = String(roster?.rosterId ?? "");
  const managerKey = rosterManagerKey(roster);
  const model = getSeasonModel();
  const currentSeason = String(model?.season || state.league?.season || "");

  (model?.weeks || []).forEach((week) => {
    if (!week?.hasPoints) return;
    (week.games || []).forEach((game) => {
      const mine = (game.sides || []).find((side) => String(side.rosterId) === rosterId);
      const opp = (game.sides || []).find((side) => String(side.rosterId) !== rosterId);
      if (!mine || !opp) return;
      if (!(mine.points > 0 || opp.points > 0)) return;
      games.push({ season: currentSeason, week: week.week, result: gameResult(mine.points, opp.points) });
    });
  });

  (state.historyMatchups || []).forEach((matchup) => {
    if (String(matchup.season) === currentSeason) return;
    const mine = matchup.left?.managerKey === managerKey
      ? matchup.left
      : matchup.right?.managerKey === managerKey
        ? matchup.right
        : null;
    const opp = mine === matchup.left ? matchup.right : matchup.left;
    if (!mine || !opp) return;
    games.push({ season: String(matchup.season), week: Number(matchup.week) || 0, result: gameResult(mine.points, opp.points) });
  });
  return games;
}

function toKeyedTrade(transaction, focusKey = null) {
  const sourceLeagueId = String(transaction?.sourceLeagueId || state.leagueId || "");
  const movements = buildTradeMovements(transaction).map((movement) => {
    const fromInfo = getHistoryRosterInfo(sourceLeagueId, movement.fromRosterId);
    const toInfo = getHistoryRosterInfo(sourceLeagueId, movement.toRosterId);
    return {
      ...movement,
      fromRosterId: fromInfo?.managerKey || movement.fromRosterId,
      toRosterId: toInfo?.managerKey || movement.toRosterId,
      fromName: fromInfo?.managerName || "",
      toName: toInfo?.managerName || "",
    };
  });
  const participantKeys = [...new Set(movements
    .flatMap((movement) => [movement.fromRosterId, movement.toRosterId])
    .map(String)
    .filter(Boolean))];
  if (focusKey && !participantKeys.includes(String(focusKey))) return null;
  const others = participantKeys.filter((key) => key !== String(focusKey || ""));
  return {
    id: String(transaction.transaction_id || `${transaction.sourceSeason}-${transaction.created}`),
    season: String(transaction.sourceSeason || state.league?.season || ""),
    week: Number(transaction.leg || transaction.week || 0),
    partnerName: others.map((key) => managerNameByKey(key)).filter(Boolean).join(" / ") || "Rival",
    movements,
    created: Number(transaction.status_updated || transaction.created || 0),
    participantKeys,
  };
}

function loyaltyTradesForRoster(roster) {
  const managerKey = rosterManagerKey(roster);
  if (!managerKey) return [];
  return getArchiveTradeTransactions()
    .map((transaction) => toKeyedTrade(transaction, managerKey))
    .filter(Boolean);
}

function keyedArchiveTrades() {
  const seen = new Set();
  return getArchiveTradeTransactions()
    .map((transaction) => toKeyedTrade(transaction))
    .filter((trade) => {
      if (!trade?.id || seen.has(trade.id)) return false;
      seen.add(trade.id);
      return trade.movements.length > 0;
    });
}

function managerNameByKey(managerKey) {
  const key = String(managerKey || "");
  const live = state.normalizedRosters.find((roster) => rosterManagerKey(roster) === key);
  if (live) return live.manager.displayName;
  if (key.startsWith("user:")) {
    const named = getFranchiseIndex().names.get(key.slice(5));
    if (named) return named;
  }
  for (const entry of state.leagueHistory || []) {
    for (const roster of entry.rosters || []) {
      const info = getHistoryRosterInfo(entry.leagueId, roster.roster_id);
      if (info?.managerKey === key) return info.managerName;
    }
  }
  return "Manager";
}

function collectGamesByManager() {
  const map = new Map();
  const push = (managerKey, game) => {
    const key = String(managerKey || "");
    if (!key) return;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(game);
  };
  const model = getSeasonModel();
  const currentSeason = String(model?.season || state.league?.season || "");
  const rosterKey = new Map(state.normalizedRosters.map((roster) => [String(roster.rosterId), rosterManagerKey(roster)]));

  (model?.weeks || []).forEach((week) => {
    if (!week?.hasPoints) return;
    (week.games || []).forEach((game) => {
      const sides = game.sides || [];
      if (sides.length !== 2) return;
      const [left, right] = sides;
      if (!(left.points > 0 || right.points > 0)) return;
      const leftKey = rosterKey.get(String(left.rosterId));
      const rightKey = rosterKey.get(String(right.rosterId));
      push(leftKey, { season: currentSeason, week: week.week, result: gameResult(left.points, right.points) });
      push(rightKey, { season: currentSeason, week: week.week, result: gameResult(right.points, left.points) });
    });
  });

  (state.historyMatchups || []).forEach((matchup) => {
    if (String(matchup.season) === currentSeason) return;
    if (!matchup.left || !matchup.right) return;
    push(matchup.left.managerKey, {
      season: String(matchup.season),
      week: Number(matchup.week) || 0,
      result: gameResult(matchup.left.points, matchup.right.points),
    });
    push(matchup.right.managerKey, {
      season: String(matchup.season),
      week: Number(matchup.week) || 0,
      result: gameResult(matchup.right.points, matchup.left.points),
    });
  });
  return map;
}

function collectFinishesByManager() {
  const map = new Map();
  (state.leagueHistory || []).forEach((entry) => {
    const snapshot = buildSeasonSnapshot(entry);
    (snapshot?.standings || []).forEach((row) => {
      if (!map.has(row.managerKey)) map.set(row.managerKey, []);
      map.get(row.managerKey).push({
        season: snapshot.season,
        finishRank: row.finishRank,
        playoffFinish: row.playoffFinish,
        isCurrent: snapshot.isCurrent,
        label: row.playoffFinish === 1 ? "champion" : row.finishRank ? ordinal(row.finishRank) : "—",
      });
    });
  });
  return map;
}

function assetValueOf(item) {
  return Number(item?.value) || playerValueById(item?.assetId);
}

function leagueTradeSidesCacheKey() {
  return [
    state.leagueId,
    state.historyTransactions.length,
    state.transactions.length,
    valuationCacheVersion(),
    (state.historyMatchups || []).length,
    (state.leagueHistory || []).length,
    state.draftedPickByKey?.size || 0,
    state.seasonLoaded ? "1" : "0",
  ].join(":");
}

function leagueTradeSides() {
  const key = leagueTradeSidesCacheKey();
  if (leagueTradeSideCache.key === key) return leagueTradeSideCache.sides;
  const sides = analyzeLeagueTradeSides({
    trades: keyedArchiveTrades(),
    gamesByManager: collectGamesByManager(),
    finishesByManager: collectFinishesByManager(),
    valueOf: assetValueOf,
    nameOf: managerNameByKey,
  });
  leagueTradeSideCache = { key, sides };
  return sides;
}

function managerCareerSummary(managerKey) {
  let wins = 0;
  let losses = 0;
  let ties = 0;
  let titles = 0;
  const finishes = [];
  (state.leagueHistory || []).forEach((entry) => {
    const snapshot = buildSeasonSnapshot(entry);
    const standing = snapshot?.standings?.find((row) => row.managerKey === managerKey);
    if (!standing) return;
    wins += Number(standing.wins || 0);
    losses += Number(standing.losses || 0);
    ties += Number(standing.ties || 0);
    if (!entry.isCurrent && standing.playoffFinish === 1) titles += 1;
    if (Number.isFinite(Number(standing.finishRank))) finishes.push(Number(standing.finishRank));
  });
  return {
    wins,
    losses,
    ties,
    titles,
    recordLabel: formatRecordLine(wins, losses, ties),
    avgFinish: finishes.length ? finishes.reduce((sum, rank) => sum + rank, 0) / finishes.length : null,
  };
}

function loyaltyTierLabel(score) {
  if (score >= 78) return "Iron";
  if (score >= 58) return "Loyal";
  if (score >= 38) return "Core";
  return "Fresh";
}

function gradeClassName(grade) {
  return `grade-${String(grade || "C").replace("+", "plus").replace("-", "minus")}`;
}

function renderDnaChip(chip) {
  return `<div class="dna-chip"><span>${escapeHtml(chip.name)}</span><strong>${formatNumber(Math.round(chip.value || 0))}</strong></div>`;
}

function buildPassportBoard(roster, limit = 10) {
  const playerSeasons = new Map();
  const addStop = (playerId, season, managerKey, managerName) => {
    const id = String(playerId || "").replace(/^player:/, "");
    if (!id || id === "0") return;
    if (!playerSeasons.has(id)) playerSeasons.set(id, []);
    playerSeasons.get(id).push({ season: String(season || ""), managerKey, managerName: managerName || "Unknown" });
  };

  (state.leagueHistory || []).forEach((entry) => {
    (entry.rosters || []).forEach((item) => {
      const info = getHistoryRosterInfo(entry.leagueId, item.roster_id);
      (item.players || []).forEach((playerId) => addStop(playerId, entry.season || entry.league?.season, info?.managerKey, info?.managerName));
    });
  });

  state.normalizedRosters.forEach((entry) => {
    playerIdsFromRoster(entry).forEach((playerId) => {
      addStop(playerId, state.league?.season, rosterManagerKey(entry), entry.manager.displayName);
    });
  });

  const mine = new Set(playerIdsFromRoster(roster));
  return [...playerSeasons.entries()]
    .map(([playerId, seasons]) => {
      const unique = [];
      const seen = new Set();
      seasons
        .filter((row) => row.season && row.managerKey)
        .sort((a, b) => Number(a.season) - Number(b.season))
        .forEach((row) => {
          const stamp = `${row.season}|${row.managerKey}`;
          if (seen.has(stamp)) return;
          seen.add(stamp);
          unique.push(row);
        });
      return buildPlayerPassport({ playerId, name: playerNameById(playerId), seasons: unique });
    })
    .filter((row) => row.stops.length > 0)
    .sort((a, b) => {
      const aMine = mine.has(a.playerId) ? 1 : 0;
      const bMine = mine.has(b.playerId) ? 1 : 0;
      return bMine - aMine || b.stops.length - a.stops.length || playerValueById(b.playerId) - playerValueById(a.playerId);
    })
    .filter((row) => row.stops.length >= 2 || mine.has(row.playerId))
    .slice(0, limit);
}

function renderLensPicker(roster, { label = "Viewing", extra = "" } = {}) {
  const meId = String(state.meRosterId ?? "");
  const options = state.normalizedRosters
    .slice()
    .sort((a, b) => a.manager.displayName.localeCompare(b.manager.displayName))
    .map((entry) => `
      <option value="${entry.rosterId}" ${String(entry.rosterId) === String(roster.rosterId) ? "selected" : ""}>
        ${escapeHtml(entry.manager.displayName)}${String(entry.rosterId) === meId ? " (you)" : ""}
      </option>
    `)
    .join("");
  return `
    <div class="room-toolbar">
      <label class="lens-picker">
        <span>${escapeHtml(label)}</span>
        <select data-change="lens-roster" aria-label="Choose a roster to view">${options}</select>
      </label>
      ${isViewingOtherRoster(roster)
        ? `<button type="button" class="ghost-btn" data-action="lens-me">Back to my team</button>`
        : ""}
      ${extra}
    </div>
  `;
}

function renderWindowCallBanner(call) {
  if (!call) return "";
  return `
    <button type="button" class="window-call-banner ${call.tone}" data-action="go" data-page="teams" data-room="call">
      <span class="eyebrow">Desk call</span>
      <strong>${escapeHtml(call.label)}</strong>
      <small>${escapeHtml(call.headline)} · ${call.confidence}% confidence</small>
    </button>
  `;
}

function renderWindowCallDashboard() {
  const host = el.windowCallDashboard;
  if (!host) return;
  const roster = getLensRoster();
  const seasonCall = windowCallHorizon(state.league) === "season";
  if (!roster) {
    host.innerHTML = `<p class="muted">${seasonCall
      ? "Pick a manager. Desk says in it, bubble, or out."
      : "Pick a manager. Desk says tank, all in, or middle."}</p>`;
    return;
  }
  if (!state.playerMetadataLoaded) {
    host.innerHTML = `
      ${renderLensPicker(roster)}
      <div class="power-sync">
        <strong>${state.playerMetadataFailed ? "Player metadata unavailable" : "Syncing player metadata"}</strong>
        <p class="muted">${
          state.playerMetadataFailed
            ? (seasonCall
              ? "Need positions before the ticker can make an in-it / bubble / out call."
              : "Need positions and ages before the ticker can make a tank / all-in / middle call.")
            : (seasonCall
              ? "Waiting on Sleeper positions so the call is not a coin flip."
              : "Waiting on Sleeper positions, ages, and pick data so the call is not a coin flip.")
        }</p>
      </div>
    `;
    return;
  }

  const profiles = buildPowerProfiles();
  const model = getSeasonModel();
  const sim = getSimulation(model);
  const call = getLensWindowCall({ profiles, model, sim });
  if (!call) {
    host.innerHTML = `
      ${renderLensPicker(roster)}
      <p class="muted">Values still syncing. Call shows once the power board loads.</p>
    `;
    return;
  }

  const leagueCalls = buildLeagueWindowCalls({ profiles, model, sim });
  const groups = groupWindowCalls(leagueCalls);
  const other = isViewingOtherRoster(roster);
  const season = call.horizon === "season";
  const groupMeta = season
    ? [
      { id: "all-in", title: "In it", empty: "Nobody is a lock yet." },
      { id: "middle", title: "Bubble", empty: "No bubble teams." },
      { id: "tank", title: "Out", empty: "Everybody still has a pulse." },
    ]
    : [
      { id: "all-in", title: "All in", empty: "Nobody is a finished title team yet." },
      { id: "middle", title: "Middle", empty: "No one is sitting on the fence." },
      { id: "tank", title: "Tank", empty: "Nobody should be collecting firsts yet." },
    ];

  host.innerHTML = `
    ${renderLensPicker(roster)}
    <article class="window-call-hero ${call.tone}">
      <div>
        <span class="eyebrow">${other ? `${escapeHtml(roster.manager.displayName)} · desk call` : "Desk call"}</span>
        <h2>${escapeHtml(call.label)}</h2>
        <p>${escapeHtml(call.headline)}</p>
        <p class="muted">${escapeHtml(call.summary)}</p>
      </div>
      <div class="window-call-confidence">
        <span>Confidence</span>
        <strong>${call.confidence}%</strong>
        <small>${season ? `${call.nowScore} this year` : `${call.nowScore} this year · ${call.futureScore} future`}</small>
      </div>
    </article>
    <div class="window-call-axes">
      ${renderWindowCallAxis("This year", call.nowScore, "Playoff math plus current lineup juice.")}
      ${season ? "" : renderWindowCallAxis("Dynasty future", call.futureScore, "Age, youth share, and pick capital.")}
    </div>
    <div class="window-call-signals">
      ${call.signals.map(renderWindowCallSignal).join("")}
    </div>
    <section class="workspace-panel">
      <div class="panel-heading">
        <div>
          <span class="eyebrow">Next moves</span>
          <h2>What the ticker wants</h2>
        </div>
        <p class="section-copy">${
          season
            ? (call.id === "all-in"
              ? "Win this week. Start the studs. Stream the hole."
              : call.id === "tank"
                ? "This year is dead. Waivers over panic trades."
                : "Still alive. One start/sit upgrade, not a fire sale.")
            : (call.id === "all-in"
              ? "Win now. Buy starters. Do not collect dart throws."
              : call.id === "tank"
                ? "This year is for capital. Sell vets. Keep the kids."
                : "No fire sale, no farm sale. One clean upgrade.")
        }</p>
      </div>
      <ol class="window-call-moves">
        ${call.moves.map((move) => `<li>${escapeHtml(move)}</li>`).join("")}
      </ol>
      <div class="window-call-actions">
        <button type="button" class="ghost-btn" data-action="go" data-page="teams" data-room="roster">Scout card</button>
        ${other
          ? `<button type="button" class="ghost-btn" data-action="calc-with" data-roster-id="${roster.rosterId}">Build a trade</button>`
          : `<button type="button" class="ghost-btn" data-action="go" data-page="trades" data-room="lab">Find deals</button>`}
      </div>
    </section>
    <section class="workspace-panel">
      <div class="panel-heading">
        <div>
          <span class="eyebrow">League board</span>
          <h2>Who else is in which lane</h2>
        </div>
        <p class="section-copy">${season
          ? "Same call for every roster: playoff odds and this year's lineup. Tap a name to switch."
          : "Same call for every roster: playoff odds, lineup rank, age, and pick vault. Tap a name to switch."}</p>
      </div>
      <div class="window-call-league">
        ${groupMeta.map((group) => `
          <article class="window-call-group">
            <h3>${escapeHtml(group.title)} <em>${groups[group.id].length}</em></h3>
            ${groups[group.id].length
              ? groups[group.id].map((row) => renderWindowCallLeagueRow(row, roster)).join("")
              : `<p class="muted small">${escapeHtml(group.empty)}</p>`}
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function renderWindowCallAxis(label, score, detail) {
  return `
    <section class="window-call-axis">
      <div class="window-call-axis-top">
        <strong>${escapeHtml(label)}</strong>
        <span>${score}/99</span>
      </div>
      <div class="meter-track" aria-hidden="true"><span style="width:${score}%"></span></div>
      <p>${escapeHtml(detail)}</p>
    </section>
  `;
}

function renderWindowCallSignal(signal) {
  return `
    <section class="window-call-signal ${signal.lean || ""}">
      <span>${escapeHtml(signal.label)}</span>
      <strong>${escapeHtml(signal.value)}</strong>
      <small>${escapeHtml(signal.detail || "")}</small>
    </section>
  `;
}

function renderWindowCallLeagueRow(call, roster) {
  const active = String(call.rosterId) === String(roster.rosterId);
  const you = String(call.rosterId) === String(state.meRosterId ?? "");
  return `
    <button type="button" class="window-call-row ${active ? "active" : ""} ${you ? "you" : ""}" data-action="set-lens" data-roster-id="${call.rosterId}">
      ${renderTeamIdentity(call.rosterId, { showTeamName: false, extra: `${call.confidence}% · ${call.nowScore} now / ${call.futureScore} later` })}
      <span class="mini-chip ${call.tone === "green" ? "green" : call.tone === "rose" ? "rose" : "gold"}">${escapeHtml(call.shortLabel)}</span>
    </button>
  `;
}

function renderLoyaltyDashboard() {
  const host = el.loyaltyDashboard;
  if (!host) return;
  const roster = getLensRoster();
  if (!roster) {
    host.innerHTML = `<p class="muted">Pick a manager to open DNA, charms, and tenure.</p>`;
    return;
  }

  const currentIds = playerIdsFromRoster(roster);
  const managerKey = rosterManagerKey(roster);
  const takeover = getRosterTakeover(roster.rosterId);
  const seasons = seasonPlayerSetsForManager(managerKey);
  const dna = buildRosterDna({
    currentIds,
    previousIds: previousSeasonPlayerIds(managerKey),
    nameOf: playerNameById,
    valueOf: playerValueById,
    ageOf: playerAgeById,
  });
  const tenures = buildTenure({ currentIds, seasons }).map((row) => ({
    ...row,
    name: playerNameById(row.playerId),
    value: playerValueById(row.playerId),
  }));
  const appearances = collectCharmAppearances(roster);
  const charms = summarizeCharms(appearances, { teamWinPct: managerWinPct(roster), minGames: 3 });
  const trades = loyaltyTradesForRoster(roster);
  const miss = biggestTradeMiss(trades, {
    myRosterId: managerKey,
    valueOf: (item) => Number(item.value) || playerValueById(item.assetId),
  });
  const core = newCorePlayers(dna.added, { ageOf: playerAgeById, maxAge: 25 });
  const score = loyaltyScore({ tenures, charms, dna });
  const career = managerCareerSummary(managerKey);
  const iron = Math.round(ironRosterShare(tenures, 2) * 100);
  const longest = tenures[0] || null;

  host.innerHTML = `
    ${renderLensPicker(roster)}
    <article class="loyalty-hero">
      <div>
        <span class="eyebrow">Loyalty</span>
        <h3>${escapeHtml(roster.manager.displayName)}</h3>
        <p class="muted">${loyaltyTierLabel(score)} desk · iron share ${iron}%${longest ? ` · ${escapeHtml(longest.name)} ${longest.consecutiveSeasons} szn` : ""}</p>
        ${takeover ? `<p class="muted small takeover-note">Took over from ${escapeHtml(takeover.fromName)}.</p>` : ""}
      </div>
      <div class="loyalty-score">
        <span>Score</span>
        <strong>${score}</strong>
      </div>
    </article>
    <div class="career-strip">
      <div class="career-chip${career.titles ? " champ" : ""}"><span>Titles</span><strong>${career.titles}</strong></div>
      <div class="career-chip"><span>Career</span><strong>${escapeHtml(career.recordLabel)}</strong></div>
      <div class="career-chip"><span>Avg finish</span><strong>${career.avgFinish == null ? "—" : career.avgFinish.toFixed(1)}</strong></div>
      <div class="career-chip"><span>DNA keep</span><strong>${Math.round((dna.overlap || 0) * 100)}%</strong></div>
    </div>
    <div class="dna-board">
      <article class="dna-col kept">
        <h3>Kept</h3>
        ${dna.kept.map(renderDnaChip).join("") || `<p class="muted small">No overlap yet.</p>`}
      </article>
      <article class="dna-col lost">
        <h3>Gone</h3>
        ${dna.lost.map(renderDnaChip).join("") || `<p class="muted small">Nobody left.</p>`}
      </article>
      <article class="dna-col added">
        <h3>New</h3>
        ${dna.added.map(renderDnaChip).join("") || `<p class="muted small">No new blood.</p>`}
      </article>
    </div>
    <div class="loyalty-grid">
      <article class="loyalty-card">
        <span>Ironmen</span>
        <strong>${longest ? escapeHtml(longest.name) : "Need archive"}</strong>
        <small>${tenures.slice(0, 4).map((row) => `${row.name} ${row.consecutiveSeasons}y`).join(" · ") || "Need more seasons."}</small>
      </article>
      <article class="loyalty-card">
        <span>Luck charms</span>
        <strong>${charms[0] ? escapeHtml(playerNameById(charms[0].playerId)) : "Need starts"}</strong>
        <small>${charms.slice(0, 4).map((row) => `${playerNameById(row.playerId)} ${row.badge || row.roster.label}`).join(" · ") || "Need more weeks."}</small>
      </article>
      <article class="loyalty-card">
        <span>Biggest miss</span>
        <strong>${miss ? escapeHtml(miss.name) : "Clean books"}</strong>
        <small>${miss ? `Now ${formatNumber(Math.round(miss.value))} · ${miss.season || ""} W${miss.week || "?"} vs ${miss.partnerName || "rival"}` : "Nobody you shipped is a KTC monster."}</small>
      </article>
      <article class="loyalty-card">
        <span>New core</span>
        <strong>${core[0] ? escapeHtml(core[0].name) : "No young adds"}</strong>
        <small>${core.map((row) => `${row.name}${Number.isFinite(row.age) ? ` ${row.age}` : ""}`).join(" · ") || "Adds skew older."}</small>
      </article>
    </div>
    <div class="charm-list">
      ${charms.slice(0, 8).map((row) => `
        <div class="charm-row">
          <span>${escapeHtml(playerNameById(row.playerId))}${row.badge ? ` <em class="badge-${escapeHtml(row.badge)}">${escapeHtml(row.badge)}</em>` : ""}</span>
          <strong>on ${escapeHtml(row.roster.label)} · start ${escapeHtml(row.started.games ? row.started.label : "—")}</strong>
        </div>
      `).join("") || `<p class="muted small">Charms show once this roster logs a few games.</p>`}
    </div>
  `;
}

function renderTradeAssetLine(item) {
  const valueLabel = formatNumber(Math.round(item.value || 0));
  return `<li><span>${renderTradeAssetLabel(item)}</span><strong>${valueLabel}</strong></li>`;
}

function renderResultPills(games = []) {
  const shown = games.slice(-16);
  if (!shown.length) return `<p class="muted small">No games after this deal yet.</p>`;
  const extra = games.length - shown.length;
  return `<div class="result-pills" aria-label="Results since the trade">${shown.map((game) => {
    const mark = String(game.result || "").toUpperCase() || "T";
    return `<span class="result-pill ${mark === "W" ? "win" : mark === "L" ? "loss" : "tie"}" title="${escapeHtml(`${game.season} W${game.week}`)}">${escapeHtml(mark)}</span>`;
  }).join("")}${extra > 0 ? `<span class="muted small">+${extra} earlier</span>` : ""}</div>`;
}

function renderLaterFinishes(rows = []) {
  return `
    <div class="trade-later">
      <span class="trade-later-label">Later finishes</span>
      ${rows.length
        ? `<div class="finish-chips" aria-label="Finishes after this trade">${rows.map((row) => `<span class="finish-chip">${escapeHtml(row.season)} ${escapeHtml(row.label)}</span>`).join("")}</div>`
        : `<p class="muted small">No later finish locked yet.</p>`}
    </div>
  `;
}

function renderTradeDetail(row) {
  return `
    <section class="workspace-panel trade-file">
      <div class="panel-heading">
        <div>
          <button type="button" class="ghost-btn" data-action="close-trade">All trades</button>
          <span class="eyebrow">Trade file</span>
          <h2>${escapeHtml(row.season)} Week ${row.week || "?"} vs ${escapeHtml(row.partnerName)}</h2>
        </div>
        <p class="section-copy">${escapeHtml(row.managerName)}'s side. Record, market value now, and later finishes from this week forward.</p>
      </div>
      <div class="trade-file-hero">
        <div class="loyalty-card">
          <span>Since</span>
          <strong>${escapeHtml(row.since.label)}</strong>
          <small>${row.since.games ? `${Math.round(row.since.winPct * 100)}% · ${row.since.games} games later` : "Still waiting on the next kickoff"}</small>
        </div>
        <div class="loyalty-card">
          <span>Market now</span>
          <strong>${formatSignedNumber(Math.round(row.delta))}</strong>
          <small>Got ${formatNumber(Math.round(row.receivedNow))} · sent ${formatNumber(Math.round(row.sentNow))}</small>
        </div>
        <div class="loyalty-card ${gradeClassName(row.grade)}">
          <span>Grade</span>
          <strong class="grade-pill">${escapeHtml(row.grade)}</strong>
          <small>${row.verdict === "won" ? "Market win" : row.verdict === "lost" ? "Market loss" : "Even books"}</small>
        </div>
      </div>
      ${renderResultPills(row.after || [])}
      ${renderLaterFinishes(row.laterFinishes || [])}
      <div class="dna-board trade-file-sides">
        <article class="dna-col kept">
          <h3>Got</h3>
          <ul class="trade-asset-list">${row.received.map(renderTradeAssetLine).join("") || "<li class='muted'>Picks / nothing priced</li>"}</ul>
        </article>
        <article class="dna-col lost">
          <h3>Sent</h3>
          <ul class="trade-asset-list">${row.sent.map(renderTradeAssetLine).join("") || "<li class='muted'>Picks / nothing priced</li>"}</ul>
        </article>
      </div>
      <p class="trade-recap">${escapeHtml(row.recap)}</p>
    </section>
  `;
}

function renderTradeLogDesk() {
  const host = el.tradeLogDashboard;
  if (!host) return;
  const roster = getLensRoster();
  if (!roster) {
    host.innerHTML = `<p class="muted">Choose your team to grade past trades.</p>`;
    return;
  }

  const managerKey = rosterManagerKey(roster);
  const trades = loyaltyTradesForRoster(roster);
  const analyzed = analyzePastTrades({
    trades,
    myRosterId: managerKey,
    games: managerGamesForAnalyzer(roster),
    valueOf: assetValueOf,
    managerName: roster.manager.displayName,
    finishes: collectFinishesByManager().get(managerKey) || [],
  });
  let selected = null;
  if (state.selectedTradeId) {
    const wantKey = state.selectedTradeManagerKey || managerKey;
    selected = analyzed.find((row) => row.id === state.selectedTradeId && row.managerKey === wantKey)
      || leagueTradeSides().find((row) => row.id === state.selectedTradeId && row.managerKey === wantKey)
      || null;
  }
  if (selected) {
    host.innerHTML = renderTradeDetail(selected);
    return;
  }

  const other = isViewingOtherRoster(roster);
  const syncNote = !state.transactionsLoaded
    ? "Current-season trades are still syncing."
    : state.leagueHistory.length > 1 && !state.historyTransactionsLoaded
      ? "Archive seasons are still syncing."
      : "";
  host.innerHTML = `
    ${renderLensPicker(roster, { label: "Trade file" })}
    ${renderLeagueBoardMarkup(state.leagueBoard || emptyLeagueBoard(), {
      applied: state.applyLeagueBoard,
      formatNumber,
    })}
    <section class="workspace-panel trade-analyzer">
      <div class="panel-heading">
        <div>
          <span class="eyebrow">Graded deals</span>
          <h2>${other ? `${escapeHtml(roster.manager.displayName)}'s trade file` : "Your trade file"}</h2>
        </div>
        <p class="section-copy">Tap a deal for the recap, record since that week, and today's market. ${analyzed.length} in the archive.${syncNote ? ` ${syncNote}` : ""}</p>
      </div>
      <div class="trade-log">
        ${analyzed.map((row) => `
          <div class="trade-row ${gradeClassName(row.grade)} verdict-${escapeHtml(row.verdict)}" role="button" tabindex="0" data-action="open-trade" data-trade-id="${escapeHtml(row.id)}" data-manager-key="${escapeHtml(managerKey)}">
            <div class="trade-row-inner">
              <span class="trade-row-when">
                <span class="trade-row-week">${escapeHtml(row.season)} W${row.week || "?"}</span>
                <span class="trade-row-partner">${escapeHtml(row.partnerName)}</span>
              </span>
              ${renderTradeMove(row)}
              <span class="trade-row-since">${escapeHtml(row.since.games ? row.since.label : "—")}</span>
              <span class="grade-pill">${escapeHtml(row.grade)}</span>
            </div>
          </div>
        `).join("") || `<p class="muted">No completed trades in the loaded archive yet.</p>`}
      </div>
    </section>
    ${renderTradeWireBoard()}
    ${renderLeagueWirePanel()}
  `;
}

function renderLeagueWirePanel() {
  const archive = buildArchiveTradeAnalytics(getArchiveTradeTransactions());
  const market = getMyRoster() ? buildTradeMarketAnalytics(getMyRoster()) : null;
  return `
    <div class="analytics-two-col">
      <section class="analytics-panel">
        <div class="analytics-panel-heading">
          <h3>League wire</h3>
          <span>${archive.recentTrades.length} recent · ${escapeHtml(buildArchiveSyncLabel())}</span>
        </div>
        <div class="recent-trade-list">
          ${archive.recentTrades.length > 0
            ? archive.recentTrades.map((trade) => renderRecentTrade(trade)).join("")
            : `<p class="muted small analytics-empty">Trades appear here as Sleeper transactions sync.</p>`}
        </div>
      </section>
      ${market ? renderAssetMarketPanel(market) : ""}
    </div>
  `;
}

function passportStampLabel(stop) {
  if (stop.stamp === "origin") return "Origin";
  if (stop.stamp === "now") return "Now";
  return `${stop.years} yr${Number(stop.years) === 1 ? "" : "s"}`;
}

function renderPassportStamp(stop) {
  const kind = stop.stamp || "visa";
  return `
    <li class="passport-stamp ${escapeHtml(kind)}${stop.current ? " here" : ""}" style="--stamp-hue:${hashHue(stop.managerName)}">
      <span class="passport-stamp-dot" aria-hidden="true"></span>
      <span class="passport-stamp-year">${escapeHtml(formatSeasonSpan(stop.fromSeason, stop.toSeason))}</span>
      <strong>${escapeHtml(stop.managerName)}</strong>
      <small>${escapeHtml(passportStampLabel(stop))}</small>
    </li>
  `;
}

function renderPassportPage(row, { myManagerKey, currentSeason }) {
  const passport = decoratePassport(row, { myManagerKey, currentSeason });
  const pos = playerPositionById(row.playerId);
  const value = Math.round(playerValueById(row.playerId) || 0);
  const bits = [pos, passportJourneyLabel(passport)].filter(Boolean);
  return `
    <article class="passport-page">
      <header class="passport-page-head">
        <div>
          <strong>${escapeHtml(passport.name)}</strong>
          <span>${escapeHtml(bits.join(" · "))}</span>
        </div>
        ${value > 0 ? `<em class="passport-page-value">${formatNumber(value)}</em>` : ""}
      </header>
      <ol class="passport-timeline" data-stops="${passport.stops.length}">
        ${passport.stops.map(renderPassportStamp).join("")}
      </ol>
    </article>
  `;
}

function renderPassportDesk() {
  const host = el.passportDashboard;
  if (!host) return;
  const roster = getLensRoster();
  if (!roster) {
    host.innerHTML = `<p class="muted">Choose a team to open player passports.</p>`;
    return;
  }

  const managerKey = rosterManagerKey(roster);
  const currentSeason = String(state.league?.season || "");
  const passports = buildPassportBoard(roster, 12);
  const other = isViewingOtherRoster(roster);

  host.innerHTML = `
    ${renderLensPicker(roster)}
    <section class="workspace-panel passport-card">
      <div class="panel-heading">
        <div>
          <span class="eyebrow">Passport control</span>
          <h2>${other ? `${escapeHtml(roster.manager.displayName)}'s player passport` : "Player passport"}</h2>
        </div>
        <p class="section-copy">One passport per player on this roster, plus league journeymen. Origin is the first roster that held them; Now is who has them this season.</p>
      </div>
      ${passports.map((row) => renderPassportPage(row, { myManagerKey: managerKey, currentSeason })).join("") || `<p class="muted small">Need roster history to stamp passports.</p>`}
    </section>
  `;
}

function renderTeamsGrid() {
  if (!el.teamsGrid) return;
  const profiles = buildPowerProfiles();
  const model = getSeasonModel();
  const sim = getSimulation(model);
  const lens = getLensRoster();
  const callsByRoster = new Map(
    buildLeagueWindowCalls({ profiles, model, sim }).map((call) => [String(call.rosterId), call])
  );
  el.teamsGrid.innerHTML = profiles.map((profile) => {
    const team = model?.teams.get(String(profile.rosterId));
    const manager = managerForRosterId(profile.rosterId);
    const isActive = lens && String(lens.rosterId) === String(profile.rosterId);
    const call = callsByRoster.get(String(profile.rosterId));
    return `
      <article class="team-card ${isActive ? "active" : ""} ${String(profile.rosterId) === String(state.meRosterId) ? "you" : ""}">
        <button type="button" class="team-card-main" data-action="set-lens" data-roster-id="${profile.rosterId}">
          ${renderAvatar(manager, { size: "lg" })}
          <span class="team-card-copy">
            <strong>${escapeHtml(manager.displayName)}</strong>
            <span>${escapeHtml(manager.teamName || profile.laneLabel)}</span>
            <small>${team?.gamesPlayed ? `${escapeHtml(team.recordLabel)} · ${formatPoints(team.pf)} PF` : escapeHtml(profile.laneLabel)}${call ? ` · ${escapeHtml(call.shortLabel)}` : ""}</small>
          </span>
          <span class="team-card-score">
            <strong>${profile.score}</strong>
            <span class="power-tier ${profile.tierClass}">${profile.grade}</span>
          </span>
        </button>
        ${String(profile.rosterId) !== String(state.meRosterId) ? `<button type="button" class="team-card-trade" data-action="calc-with" data-roster-id="${profile.rosterId}">Build a trade</button>` : `<span class="team-card-trade muted">Your roster</span>`}
      </article>
    `;
  }).join("");
}

function weeklyValueCacheKey() {
  const season = String(state.nflState?.league_season || state.nflState?.season || "");
  const week = Number(state.nflState?.week) || 0;
  return `${season}:${week}`;
}

function rebuildWeeklyValueContext() {
  if (!state.weeklyValue?.loaded) return;
  state.weeklyValue.context = buildWeeklyContext({
    weekRows: state.weeklyValue.weekRows,
    schedule: state.weeklyValue.schedule,
    players: state.players,
    season: state.weeklyValue.season,
    week: state.weeklyValue.week,
  });
}

async function ensureWeeklyValueContext() {
  const key = weeklyValueCacheKey();
  if (!state.nflState || key.startsWith(":")) return null;
  if (state.weeklyValue.loaded && state.weeklyValue.key === key) {
    if (!state.weeklyValue.context) rebuildWeeklyValueContext();
    return state.weeklyValue;
  }
  if (state.weeklyValue.loading && state.weeklyValue.promise) return state.weeklyValue.promise;
  const season = String(state.nflState?.league_season || state.nflState?.season || "");
  const week = Number(state.nflState?.week) || 0;
  const previousSeason = String(state.nflState?.previous_season || Number(season) - 1);
  state.weeklyValue.loading = true;
  const promise = (async () => {
    try {
      const [schedule, seasonStats, weekRows] = await Promise.all([
        fetchNflSchedule(),
        apiGetWithRetry(`/stats/nfl/regular/${encodeURIComponent(season)}`, { timeoutMs: 20000, retries: 1 }).catch(() => ({})),
        loadWeeklyStatWeeks({
          apiGet: (path, options) => apiGetWithRetry(path, { retries: 1, ...options }),
          season,
          week,
          previousSeason,
        }),
      ]);
      if (weeklyValueCacheKey() !== key) return state.weeklyValue;
      state.weeklyValue.schedule = schedule;
      state.weeklyValue.seasonStats = seasonStats && typeof seasonStats === "object" ? seasonStats : {};
      state.weeklyValue.weekRows = weekRows;
      state.weeklyValue.season = season;
      state.weeklyValue.week = week;
      state.weeklyValue.previousSeason = previousSeason;
      state.weeklyValue.key = key;
      state.weeklyValue.loaded = true;
      state.weeklyValue.error = "";
      rebuildWeeklyValueContext();
      if (state.activePage === "teams") renderRosterSheet();
      return state.weeklyValue;
    } catch (err) {
      state.weeklyValue.error = err?.message || "Could not load weekly stats";
      state.weeklyValue.loaded = true;
      if (state.activePage === "teams") renderRosterSheet();
      return state.weeklyValue;
    } finally {
      state.weeklyValue.loading = false;
      state.weeklyValue.promise = null;
    }
  })();
  state.weeklyValue.promise = promise;
  return promise;
}

function setWeeklyScoreHelpOpen(open) {
  if (!state.weeklyValue) state.weeklyValue = emptyWeeklyValueState();
  state.weeklyValue.helpOpen = Boolean(open);
  renderRosterSheet();
  if (state.weeklyValue.helpOpen) {
    document.getElementById("weekly-help-close")?.focus();
  }
}

function syncWeeklyScoreHelp() {
  const open = Boolean(state.weeklyValue?.helpOpen);
  el.weeklyHelpBtn?.setAttribute("aria-expanded", open ? "true" : "false");
  if (el.weeklyHelpLayerHost) {
    el.weeklyHelpLayerHost.innerHTML = renderWeeklyScoreHelpPop({ open });
  }
}

function weeklyModelForAsset(asset) {
  if (!asset || asset.assetType !== "player" || !state.weeklyValue?.context) return null;
  const playerId = playerIdFromAssetId(asset.assetId);
  if (!playerId) return null;
  const cacheKey = `${state.weeklyValue.key || ""}:${valuationCacheVersion()}`;
  if (weeklyModelCache.key !== cacheKey) {
    weeklyModelCache.key = cacheKey;
    weeklyModelCache.models = new Map();
  }
  const assetKey = String(asset.assetId);
  if (weeklyModelCache.models.has(assetKey)) return weeklyModelCache.models.get(assetKey);
  const model = buildWeeklyPlayerModel({
    playerId,
    name: asset.name,
    position: playerPositionForAsset(asset),
    team: asset.raw?.team,
    dynastyValue: getAssetValue(asset),
    seasonStats: state.weeklyValue.seasonStats?.[playerId] || {},
    context: state.weeklyValue.context,
  });
  weeklyModelCache.models.set(assetKey, model);
  return model;
}

function renderRosterSheet() {
  if (!el.rosterSheet) {
    syncWeeklyScoreHelp();
    return;
  }
  const roster = getLensRoster();
  if (!roster) {
    el.rosterSheet.innerHTML = `<p class="muted">Choose a team to open the roster sheet.</p>`;
    syncWeeklyScoreHelp();
    return;
  }
  if (!state.playerMetadataLoaded) {
    el.rosterSheet.innerHTML = `<div class="power-sync"><strong>Syncing player metadata</strong><p class="muted">Names, positions, and ages arrive in a moment.</p></div>`;
    syncWeeklyScoreHelp();
    return;
  }
  const values = state.values;
  const strength = evaluateRosterStrength(roster, values, state.league);
  const picks = roster.assets
    .filter((asset) => asset.assetType === "pick")
    .sort((a, b) => Number(a.raw?.season) - Number(b.raw?.season) || Number(a.raw?.round) - Number(b.raw?.round) || getAssetValue(b, values) - getAssetValue(a, values));
  const showPicks = leagueUsesFuturePicks(state.league) || picks.length > 0;
  if (el.rosterSheetHeading) {
    el.rosterSheetHeading.textContent = showPicks
      ? `${roster.manager.displayName}: sit/start, bench, and picks`
      : `${roster.manager.displayName}: sit/start and bench`;
  }
  const model = getSeasonModel();
  const team = model?.teams.get(String(roster.rosterId));
  const summary = summarizeRosterAssets(roster, values);
  const selectedId = String(state.weeklyValue?.selectedPlayerId || "");
  const selectedAsset = roster.assets.find((asset) => asset.assetType === "player" && playerIdFromAssetId(asset.assetId) === selectedId) || null;
  const weeklyByAssetId = new Map();
  const weeklyFor = (asset) => {
    const key = String(asset?.assetId || "");
    if (!weeklyByAssetId.has(key)) weeklyByAssetId.set(key, weeklyModelForAsset(asset));
    return weeklyByAssetId.get(key);
  };
  const selectedWeekly = selectedAsset ? weeklyFor(selectedAsset) : null;
  const weeklyReady = Boolean(state.weeklyValue?.context);
  const sitStart = weeklyReady
    ? buildSitStart({
        week: state.weeklyValue.week,
        slots: getStarterRosterSlots(state.league),
        players: roster.assets
          .filter((asset) => asset.assetType === "player")
          .map((asset) => ({
            id: playerIdFromAssetId(asset.assetId),
            name: asset.name,
            position: playerPositionForAsset(asset),
            positions: playerPositionsForAsset(asset),
            dynastyValue: getAssetValue(asset, values),
            injuryStatus: asset.raw?.injury_status,
            playerStatus: asset.raw?.status,
            weekly: weeklyFor(asset),
            asset,
            canFill: (slot) => assetCanFillRosterSlot(asset, slot),
          })),
      })
    : null;
  const startRows = sitStart
    ? sitStart.starters
    : strength.lineup.map((entry) => ({
        slot: entry.slot,
        slotLabel: formatRosterSlotLabel(entry.slot),
        asset: entry.asset,
        player: entry.asset ? { id: playerIdFromAssetId(entry.asset.assetId) } : null,
        rowNote: "",
      }));
  const benchRows = sitStart
    ? sitStart.bench
    : roster.assets
        .filter((asset) => asset.assetType === "player" && !strength.lineup.some((entry) => entry.asset?.assetId === asset.assetId))
        .sort((a, b) => lineupFillValue({
          startChance: weeklyFor(b)?.score,
          dynastyValue: getAssetValue(b, values),
        }) - lineupFillValue({
          startChance: weeklyFor(a)?.score,
          dynastyValue: getAssetValue(a, values),
        }))
        .map((asset) => ({ asset, rowNote: "", sitReason: "" }));
  const renderPlayerRow = (asset, slotLabel, extra = {}) => {
    const playerId = playerIdFromAssetId(asset.assetId);
    const nickname = roster.nicknames?.[playerId];
    const injury = String(asset.raw?.injury_status || "").trim();
    const weekly = weeklyFor(asset);
    const weeklyLabel = state.weeklyValue?.loading && !state.weeklyValue?.context
      ? "…"
      : weeklyScoreChipLabel(weekly);
    const open = selectedId && selectedId === playerId;
    const note = String(extra.note || "").trim();
    const rowClass = [
      "sheet-row",
      isInjuryFlaggedAsset(asset) ? "flagged" : "",
      extra.sitCause ? "sit-cause" : "",
      extra.closeCall ? "close-call" : "",
      open ? "open" : "",
    ].filter(Boolean).join(" ");
    return `
      <button type="button" class="${rowClass}" data-action="open-player" data-player-id="${escapeHtml(playerId)}" aria-pressed="${open ? "true" : "false"}">
        <span class="sheet-slot">${escapeHtml(slotLabel)}</span>
        <div class="sheet-player">
          <strong>${escapeHtml(asset.name)}${nickname ? ` <em class="nickname">“${escapeHtml(nickname)}”</em>` : ""}</strong>
          <span>${escapeHtml(formatPlayerPositionLabel(asset))}${asset.raw?.team ? ` · ${escapeHtml(asset.raw.team)}` : ""}${Number.isFinite(playerAgeForAsset(asset)) ? ` · ${playerAgeForAsset(asset)}y` : ""}${injury ? ` · <span class="injury">${escapeHtml(injury)}</span>` : ""}</span>
          ${note ? `<small class="sheet-why">${escapeHtml(note)}</small>` : ""}
        </div>
        <span class="sheet-metrics">
          <span class="weekly-chip"${weekly?.missing?.length ? ` title="${escapeHtml(weekly.missing.join(", "))}"` : ""}>
            <small>${WEEKLY_SCORE_LABEL}</small>
            <strong>${escapeHtml(weeklyLabel)}</strong>
          </span>
          <span class="dynasty-chip">
            <small>Dynasty</small>
            <strong class="mono">${formatNumber(getAssetValue(asset, values))}</strong>
          </span>
        </span>
      </button>
    `;
  };
  const seasonLog = team?.results?.length
    ? `
      <div class="season-log">
        ${team.results.slice().sort((a, b) => a.week - b.week).map((result) => `
          <span class="log-chip ${result.result === "W" ? "up" : result.result === "L" ? "down" : ""}" title="Week ${result.week} vs ${escapeHtml(result.opponentName)}">
            <small>W${result.week}</small>
            <strong>${result.result}</strong>
            <span>${formatPoints(result.points)}-${formatPoints(result.opponentPoints)}</span>
          </span>
        `).join("")}
      </div>
    `
    : `<p class="muted small">No finalized games yet this season.</p>`;

  el.rosterSheet.innerHTML = `
    <div class="sheet-summary">
      ${renderPowerStat("Starters", formatNumber(strength.starterValue), `${strength.lineup.filter((entry) => entry.asset).length}/${strength.lineup.length} slots filled`)}
      ${renderPowerStat("Bench", formatNumber(strength.benchValue), `${strength.benchHighlights.length ? `${summary.playerCount} players rostered` : "no bench"}`)}
      ${showPicks ? renderPowerStat("Pick vault", formatNumber(summary.pickValue), `${summary.pickCount} picks · ${summary.firstRoundPickCount} firsts`) : ""}
      ${renderPowerStat("Avg age", summary.averageAgeLabel, `${summary.youthCount} youth · ${summary.veteranCount} vets · ${summary.injuredCount} flagged`)}
    </div>
    ${selectedWeekly
      ? renderWeeklyPlayerSheet(selectedWeekly, { helpOpen: Boolean(state.weeklyValue?.helpOpen) })
      : selectedAsset
        ? `<article class="player-week-sheet" data-player-id="${escapeHtml(selectedId)}">
            <header class="player-week-head">
              <div>
                <span class="player-week-kicker">
                  <span class="eyebrow">This week</span>
                  ${renderWeeklyScoreHelpButton({ open: Boolean(state.weeklyValue?.helpOpen) })}
                </span>
                <h3>${escapeHtml(selectedAsset.name)}</h3>
              </div>
            </header>
            <p class="player-week-note">${state.weeklyValue?.loading ? "Loading matchup and usage…" : WEEKLY_SCORE_HINT}</p>
            <button type="button" class="ghost-btn week-sheet-close" data-action="close-player">Close player</button>
          </article>`
        : ""}
    ${renderSitStartCallout(sitStart, {
      loading: Boolean(state.weeklyValue?.loading) && !weeklyReady,
      error: weeklyReady ? "" : (state.weeklyValue?.error || ""),
      week: state.weeklyValue?.week,
    })}
    <div class="sheet-grid">
      <section class="sheet-column">
        <h4>Start</h4>
        ${startRows.map((entry) => entry.asset
          ? renderPlayerRow(entry.asset, entry.slotLabel || formatRosterSlotLabel(entry.slot), {
              note: entry.rowNote,
              closeCall: String(entry.rowNote || "").startsWith("Close vs"),
            })
          : `<div class="sheet-row empty"><span class="sheet-slot">${escapeHtml(entry.slotLabel || formatRosterSlotLabel(entry.slot))}</span><div class="sheet-player"><strong class="muted">${escapeHtml(entry.rowNote || "Open slot")}</strong><small class="sheet-why">Bye, out, or missing opponent. Nobody silent-starts here.</small></div></div>`).join("")}
      </section>
      <section class="sheet-column">
        <h4>Sit</h4>
        ${benchRows.map((row) => renderPlayerRow(row.asset, row.sitReason ? "SIT" : (isTradeEligibleAsset(row.asset) ? "BN" : formatPlayerPositionLabel(row.asset)), {
          note: row.rowNote,
          sitCause: Boolean(row.sitReason),
          closeCall: String(row.rowNote || "").startsWith("Close vs"),
        })).join("") || `<p class="muted small">No bench players.</p>`}
        ${showPicks ? `
        <h4>Pick vault</h4>
        ${renderPickVaultIntro(picks)}
        ${picks.length
          ? picks.map((asset) => renderPickVaultRow(asset, values)).join("")
          : `<p class="muted small">No draft picks owned.</p>`}` : ""}
      </section>
    </div>
    <h4>Season log</h4>
    ${seasonLog}
  `;
  syncWeeklyScoreHelp();
}

// ---------------------------------------------------------------------------
// Awards
// ---------------------------------------------------------------------------

function renderAwardsPage() {
  if (!el.awardsDashboard) return;
  if (!state.league || state.normalizedRosters.length === 0) {
    el.awardsDashboard.innerHTML = `<p class="muted">Load a league to open the awards room.</p>`;
    return;
  }
  const model = getSeasonModel();
  const weeksWithPoints = model.weeks.filter((entry) => entry.hasPoints);
  const requested = state.awardsWeek != null ? weeksWithPoints.find((entry) => entry.week === Number(state.awardsWeek)) : null;
  const weekEntry = requested || model.featuredWeek || weeksWithPoints[weeksWithPoints.length - 1] || null;
  const weekly = weekEntry ? computeWeeklyAwards(model, weekEntry.week, {
    playerName: playerNameById,
    playerPosition: playerPositionById,
    optimalPoints: state.playerMetadataLoaded ? computeOptimalPointsForSide : null,
  }) : null;
  const superlatives = computeSeasonSuperlatives(model);

  el.awardsDashboard.innerHTML = `
    <section class="workspace-panel">
      <div class="panel-heading">
        <div>
          <span class="eyebrow">Weekly Honors</span>
          <h2>${weekEntry ? `${escapeHtml(weekEntry.label)} ${weekStatusChip(weekEntry)}` : "Weekly honors"}</h2>
        </div>
        <p class="section-copy">${weekly?.provisional ? "Games are still in progress, so these are provisional." : "Final-week honors from Sleeper box scores."}</p>
      </div>
      ${weeksWithPoints.length > 0 ? `
        <div class="week-chips">
          ${weeksWithPoints.map((entry) => `<button type="button" class="${weekEntry && entry.week === weekEntry.week ? "active" : ""}" data-action="awards-week" data-week="${entry.week}">Wk ${entry.week}</button>`).join("")}
        </div>
      ` : ""}
      ${weekly?.awards?.length
        ? `<div class="award-grid">${weekly.awards.map(renderAwardCard).join("")}</div>`
        : `<p class="muted analytics-empty">${state.seasonLoaded ? "No scores posted yet this season. Honors appear once Week 1 kicks off." : "Syncing matchups from Sleeper…"}</p>`}
    </section>

    <section class="workspace-panel">
      <div class="panel-heading">
        <div>
          <span class="eyebrow">Season Superlatives</span>
          <h2>${seasonThroughLabel(model)}</h2>
        </div>
        <p class="section-copy">Cumulative honors from every finalized regular-season week.</p>
      </div>
      ${superlatives.length
        ? `<div class="award-grid">${superlatives.map(renderAwardCard).join("")}</div>`
        : `<p class="muted analytics-empty">Superlatives unlock after the first finalized week.</p>`}
    </section>

    <div class="room-links">
      <button type="button" class="room-link" data-action="go" data-page="league" data-room="standings">
        <strong>Luck index</strong>
        <span>Who the schedule loves, next to the standings.</span>
      </button>
      <button type="button" class="room-link" data-action="go" data-page="league" data-room="history">
        <strong>League history</strong>
        <span>Last champion, titles, and a few records.</span>
      </button>
    </div>
  `;
}

function renderLuckIndexPanel(model) {
  const luckRows = model.standings.filter((team) => team.gamesPlayed > 0).slice().sort((a, b) => b.luck - a.luck);
  return `
    <section class="workspace-panel">
      <div class="panel-heading">
        <div>
          <span class="eyebrow">Luck Index</span>
          <h2>Who the schedule loves</h2>
        </div>
        <p class="section-copy">Expected wins come from the all-play record: how often each team would have won against every opponent each week.</p>
      </div>
      ${luckRows.length ? `
        <div class="luck-table">
          ${luckRows.map((team) => `
            <div class="luck-row ${String(team.rosterId) === String(state.meRosterId) ? "you" : ""}">
              ${renderTeamIdentity(team.rosterId, { extra: `${team.recordLabel} · all-play ${team.allPlayRecord}` })}
              <div class="luck-meter">
                <div class="luck-track"><span class="${luckClass(team.luck) || "flat"}" style="width:${Math.min(50, Math.abs(team.luck) / 4 * 50)}%; ${team.luck >= 0 ? "left:50%" : `right:50%`}"></span></div>
                <small>${team.expectedWins.toFixed(1)} expected wins</small>
              </div>
              <strong class="luck ${luckClass(team.luck)}">${formatLuck(team.luck)}</strong>
            </div>
          `).join("")}
        </div>
      ` : `<p class="muted analytics-empty">Luck needs at least one finalized week.</p>`}
    </section>
  `;
}

function renderAwardCard(award) {
  const manager = award.rosterId ? managerForRosterId(award.rosterId) : { displayName: award.teamName, avatar: award.avatar };
  return `
    <article class="award-card ${award.tone || ""}">
      <span class="analytics-kicker">${escapeHtml(award.title)}</span>
      <div class="award-body">
        ${renderAvatar(manager, { size: "md" })}
        <div>
          <strong>${escapeHtml(award.teamName)}</strong>
          <span class="award-value">${escapeHtml(award.valueLabel)}</span>
        </div>
      </div>
      <p>${escapeHtml(award.detail)}</p>
    </article>
  `;
}

function buildRecordBook(model) {
  const currentLeagueId = String(state.leagueId);
  const archiveGames = state.historyMatchups
    .filter((matchup) => String(matchup.leagueId) !== currentLeagueId)
    .map((matchup) => ({
      season: matchup.season,
      week: matchup.week,
      isPlayoff: matchup.isPlayoff,
      a: { managerKey: matchup.left.managerKey, managerName: matchup.left.managerName, rosterId: matchup.left.rosterId, points: matchup.left.points, avatar: avatarForManagerKey(matchup.left.managerKey) },
      b: { managerKey: matchup.right.managerKey, managerName: matchup.right.managerName, rosterId: matchup.right.rosterId, points: matchup.right.points, avatar: avatarForManagerKey(matchup.right.managerKey) },
    }));
  const currentGames = model.weeks
    .filter((entry) => entry.isFinal)
    .flatMap((entry) => entry.games.map((game) => {
      const [left, right] = game.sides;
      const leftTeam = model.teams.get(left.rosterId);
      const rightTeam = model.teams.get(right.rosterId);
      return {
        season: model.season,
        week: entry.week,
        isPlayoff: entry.isPlayoff,
        a: { managerKey: buildManagerKey(leftTeam?.ownerId, state.leagueId, left.rosterId), managerName: left.name, rosterId: left.rosterId, points: left.points, avatar: leftTeam?.avatar || null },
        b: { managerKey: buildManagerKey(rightTeam?.ownerId, state.leagueId, right.rosterId), managerName: right.name, rosterId: right.rosterId, points: right.points, avatar: rightTeam?.avatar || null },
      };
    }));
  const seasonRows = state.leagueHistory.flatMap((entry) => {
    const complete = entry.isCurrent ? model.regularSeasonComplete : true;
    const userById = new Map((entry.users || []).map((user) => [String(user.user_id), user]));
    return buildSeasonStandings(entry).map((row) => ({
      season: entry.season,
      managerName: row.managerName,
      rosterId: row.rosterId,
      avatar: userById.get(String(row.userId))?.avatar || null,
      wins: row.wins,
      losses: row.losses,
      points: row.points,
      complete,
    }));
  });
  return computeRecordBook({ games: [...archiveGames, ...currentGames], seasonRows });
}

function avatarForManagerKey(managerKey) {
  const userId = String(managerKey || "").startsWith("user:") ? String(managerKey).slice(5) : "";
  if (!userId) return null;
  const user = state.users.find((entry) => String(entry.user_id) === userId)
    || state.leagueHistory.flatMap((entry) => entry.users || []).find((entry) => String(entry.user_id) === userId);
  return user?.avatar || null;
}

// ---------------------------------------------------------------------------
// Trade calculator
// ---------------------------------------------------------------------------

function resetCalculatorState({ keepPartner = true } = {}) {
  state.calc.myAssetIds = new Set();
  state.calc.theirAssetIds = new Set();
  state.calc.myQuery = "";
  state.calc.theirQuery = "";
  if (!keepPartner) state.calc.partnerRosterId = null;
}

function getCalcPartnerRoster() {
  const me = getMyRoster();
  const others = state.normalizedRosters.filter((roster) => !me || roster.rosterId !== me.rosterId);
  const existing = others.find((roster) => String(roster.rosterId) === String(state.calc.partnerRosterId));
  if (existing) return existing;
  const fallback = others.slice().sort((a, b) => a.manager.displayName.localeCompare(b.manager.displayName))[0] || null;
  state.calc.partnerRosterId = fallback ? fallback.rosterId : null;
  return fallback;
}

function calcAssetsFor(roster, side) {
  const ids = side === "my" ? state.calc.myAssetIds : state.calc.theirAssetIds;
  return roster ? roster.assets.filter((asset) => ids.has(asset.assetId)) : [];
}

function renderCalculator() {
  if (!el.calculatorShell) return;
  const me = getMyRoster();
  if (!me) {
    el.calculatorShell.innerHTML = `<p class="muted">Choose your team in the rail to open the calculator.</p>`;
    return;
  }
  const partner = getCalcPartnerRoster();
  if (!partner) {
    el.calculatorShell.innerHTML = `<p class="muted">The calculator needs at least one other roster in the league.</p>`;
    return;
  }
  const others = state.normalizedRosters
    .filter((roster) => roster.rosterId !== me.rosterId)
    .sort((a, b) => a.manager.displayName.localeCompare(b.manager.displayName));
  el.calculatorShell.innerHTML = `
    ${renderValueBoardBar({
      applied: state.applyLeagueBoard,
      ready: Boolean(state.leagueBoard?.ready),
      marketHint: marketBoardHint(),
    })}
    <div class="panel-heading calc-heading">
      <div>
        <span class="eyebrow">Trade Calculator</span>
        <h2>You and ${escapeHtml(partner.manager.displayName)}</h2>
      </div>
      <label class="calc-partner">
        <span>Trade partner</span>
        <select data-change="calc-partner">
          ${others.map((roster) => `<option value="${roster.rosterId}" ${roster.rosterId === partner.rosterId ? "selected" : ""}>${escapeHtml(roster.manager.displayName)}${roster.manager.teamName ? ` · ${escapeHtml(roster.manager.teamName)}` : ""}</option>`).join("")}
        </select>
      </label>
    </div>
    <div class="calc-grid">
      ${renderCalcPane(me, "my")}
      ${renderCalcPane(partner, "their")}
    </div>
    <div id="calc-verdict" class="calc-verdict">${renderCalculatorVerdict(me, partner)}</div>
  `;
}

function renderCalcPane(roster, side) {
  const query = side === "my" ? state.calc.myQuery : state.calc.theirQuery;
  return `
    <section class="calc-pane ${side === "my" ? "team-a" : "team-b"}">
      <header class="calc-pane-head">
        ${renderTeamIdentity(roster.rosterId, { showTeamName: false, extra: side === "my" ? "sends" : "sends" })}
        <div class="calc-pane-total">
          ${renderCalcPaneTotal(roster, side)}
        </div>
      </header>
      <div class="calc-selected">
        ${renderCalcSelectedTokens(roster, side)}
      </div>
      ${renderCalcSearchInput({
        query,
        side,
        input: "calc-search",
        placeholder: `Filter ${side === "my" ? "your" : "their"} players and picks`,
      })}
      <div class="calc-list" id="calc-list-${side}">${renderCalcList(roster, side)}</div>
    </section>
  `;
}

function renderCalcPaneTotal(roster, side) {
  const selected = calcAssetsFor(roster, side);
  const total = selected.reduce((sum, asset) => sum + getAssetValue(asset, state.values), 0);
  return `
    <strong>${formatNumber(Math.round(total))}</strong>
    <small>${selected.length} asset${selected.length === 1 ? "" : "s"}</small>
  `;
}

function renderCalcSelectedTokens(roster, side) {
  const selected = calcAssetsFor(roster, side);
  if (!selected.length) {
    return `<span class="muted small">Tap assets below to add them to this side.</span>`;
  }
  return selected
    .sort((a, b) => getAssetValue(b, state.values) - getAssetValue(a, state.values))
    .map((asset) => `
      <button type="button" class="selected-token" data-action="calc-toggle" data-side="${side}" data-asset-id="${escapeHtml(asset.assetId)}" title="Remove">
        <span class="selected-token-label">${escapeHtml(asset.name)}</span>
        <span class="selected-token-remove" aria-hidden="true">×</span>
      </button>
    `)
    .join("");
}

function calcEligibleAssets(roster) {
  return (roster?.assets || [])
    .filter((asset) => isTradeEligibleAsset(asset) || asset.assetType === "pick")
    .sort((a, b) => sortAssetsByValueDesc(a, b, state.values));
}

function renderCalcList(roster, side) {
  const ids = side === "my" ? state.calc.myAssetIds : state.calc.theirAssetIds;
  const query = side === "my" ? state.calc.myQuery : state.calc.theirQuery;
  const assets = calcEligibleAssets(roster);
  if (assets.length === 0) return `<div class="player-item muted calc-empty">No matching assets.</div>`;
  const plan = planCalcListVisibility(assets, query, assetMatchesQuery, CALC_LIST_LIMIT);
  return `<div class="player-item muted calc-empty${plan.visibleCount ? " hidden" : ""}">No matching assets.</div>${assets.map((asset, index) => `
    <div class="player-item calc-item ${ids.has(asset.assetId) ? "selected" : ""}${plan.visibility[index] ? "" : " hidden"}" data-action="calc-toggle" data-side="${side}" data-asset-id="${escapeHtml(asset.assetId)}" role="button" tabindex="-1">
      ${buildAssetPickerMarkup(asset, { values: state.values })}
    </div>
  `).join("")}`;
}

function buildCalculatorIdea(me, partner, myAssets, theirAssets) {
  const values = state.values;
  const myValues = myAssets.map((asset) => getAssetValue(asset, values));
  const theirValues = theirAssets.map((asset) => getAssetValue(asset, values));
  const globalMaxValue = Math.max(state.globalMaxPlayerValue || KTC_GLOBAL_MAX_FALLBACK, ...myValues, ...theirValues, 1);
  const packageResult = calculatePackageAdjustment({ myValues, theirValues, globalMaxValue });
  const pctDiff = calculatePctDiff(packageResult.myAdjustedValue, packageResult.theirAdjustedValue);
  const baseline = getCachedLeagueStrengthBaseline({ league: state.league, rosters: state.normalizedRosters, values });
  return enrichTradeIdea({
    idea: {
      myAssets,
      theirAssets,
      ...packageResult,
      pctDiff: Number(pctDiff.toFixed(1)),
      counterpartyName: partner.manager.displayName,
      tags: [],
      summary: "",
      pitch: "",
    },
    myRoster: me,
    theirRoster: partner,
    values,
    leagueStrengthBaseline: baseline,
  });
}

function renderCalculatorVerdict(me, partner) {
  const myAssets = calcAssetsFor(me, "my");
  const theirAssets = calcAssetsFor(partner, "their");
  if (myAssets.length === 0 && theirAssets.length === 0) {
    return `<p class="muted calc-hint">Add at least one asset to each side and the ticker grades the deal: value balance, the piece that evens it up, power-score swing, and lineup impact for both rosters.</p>`;
  }
  if (Object.keys(state.values).length === 0) {
    return `<p class="muted calc-hint">Valuation data is still loading…</p>`;
  }
  const oneSided = myAssets.length === 0 || theirAssets.length === 0;
  if (oneSided) {
    const myTotal = Math.round(myAssets.reduce((sum, asset) => sum + getAssetValue(asset, state.values), 0));
    const theirTotal = Math.round(theirAssets.reduce((sum, asset) => sum + getAssetValue(asset, state.values), 0));
    const maxSide = Math.max(myTotal, theirTotal, 1);
    return `
      <section class="calc-summary">
        <div class="calc-summary-main">
          <span class="analytics-kicker">Ticker verdict</span>
          <h3>Add the other side</h3>
          <p>One side is empty, so this is a gift, not a trade.</p>
        </div>
        <div class="calc-bars">
          <div class="calc-bar team-a">
            <span>You send</span>
            <div class="meter-track"><span style="width:${Math.round(myTotal / maxSide * 100)}%"></span></div>
            <strong>${formatNumber(myTotal)}</strong>
          </div>
          <div class="calc-bar team-b">
            <span>You receive</span>
            <div class="meter-track"><span style="width:${Math.round(theirTotal / maxSide * 100)}%"></span></div>
            <strong>${formatNumber(theirTotal)}</strong>
          </div>
        </div>
        <div class="calc-actions">
          <button type="button" class="ghost-btn" data-action="calc-clear">Clear both sides</button>
        </div>
      </section>
    `;
  }
  const idea = buildCalculatorIdea(me, partner, myAssets, theirAssets);
  const gap = idea.theirAdjustedValue - idea.myAdjustedValue;
  const pct = idea.pctDiff;
  let verdictLabel;
  let verdictClass;
  if (pct <= 5) {
    verdictLabel = "Dead even";
    verdictClass = "good";
  } else if (pct <= 12) {
    verdictLabel = gap > 0 ? "Fair, leans your way" : `Fair, leans ${partner.manager.displayName}`;
    verdictClass = "good";
  } else if (pct <= 22) {
    verdictLabel = gap > 0 ? "Favors you" : `Favors ${partner.manager.displayName}`;
    verdictClass = gap > 0 ? "good" : "bad";
  } else {
    verdictLabel = gap > 0 ? "Lopsided in your favor" : `Lopsided for ${partner.manager.displayName}`;
    verdictClass = gap > 0 ? "good" : "bad";
  }
  const evenUp = Math.abs(gap) >= 150 ? findClosestValuationPick(Math.abs(gap), state.values, state.valueNameMap) : null;
  const evenSide = gap > 0 ? "You" : partner.manager.displayName;
  const maxSide = Math.max(idea.myAdjustedValue, idea.theirAdjustedValue, 1);
  const offerText = buildOfferText(me, partner, myAssets, theirAssets, idea, verdictLabel);
  return `
    <section class="calc-summary ${verdictClass}">
      <div class="calc-summary-main">
        <span class="analytics-kicker">Ticker verdict</span>
        <h3>${escapeHtml(verdictLabel)}</h3>
        <p>Adjusted value: you send ${formatNumber(idea.myAdjustedValue)}, you receive ${formatNumber(idea.theirAdjustedValue)} (${pct}% apart). Consolidation premium ${idea.packageAdjustment ? `${formatNumber(idea.packageAdjustment)} on ${idea.packageAdjustmentSide === "my" ? "your" : "their"} side` : "not needed"}.</p>
        ${evenUp ? `<p class="calc-even"><strong>Even it up:</strong> ${escapeHtml(evenSide)} add${evenSide === "You" ? "" : "s"} roughly ${formatNumber(Math.round(Math.abs(gap)))} in value, about a ${escapeHtml(evenUp.name)} (${formatNumber(evenUp.value)}).</p>` : ""}
      </div>
      <div class="calc-bars">
        <div class="calc-bar team-a">
          <span>You send</span>
          <div class="meter-track"><span style="width:${Math.round(idea.myAdjustedValue / maxSide * 100)}%"></span></div>
          <strong>${formatNumber(idea.myAdjustedValue)}</strong>
        </div>
        <div class="calc-bar team-b">
          <span>You receive</span>
          <div class="meter-track"><span style="width:${Math.round(idea.theirAdjustedValue / maxSide * 100)}%"></span></div>
          <strong>${formatNumber(idea.theirAdjustedValue)}</strong>
        </div>
      </div>
      <div class="calc-actions">
        <button type="button" class="ghost-btn" data-action="calc-copy" data-offer="${escapeHtml(offerText)}">Copy offer text</button>
        <button type="button" class="ghost-btn" data-action="calc-clear">Clear both sides</button>
        <span id="calc-copy-feedback" class="feedback-chip hidden">Copied</span>
      </div>
    </section>
    ${idea.powerUpgrade ? renderGameImpact(idea.powerUpgrade, idea) : ""}
    ${idea.impactAnalysis ? renderImpactAnalysis(idea.impactAnalysis, state.values) : ""}
  `;
}

function buildOfferText(me, partner, myAssets, theirAssets, idea, verdictLabel) {
  const list = (assets) => assets.map((asset) => `${asset.name} (${formatNumber(getAssetValue(asset, state.values))})`).join(", ") || "nothing";
  return `Trade proposal: ${me.manager.displayName} sends ${list(myAssets)} to ${partner.manager.displayName} for ${list(theirAssets)}. Adjusted value ${formatNumber(idea.myAdjustedValue)} vs ${formatNumber(idea.theirAdjustedValue)} (${idea.pctDiff}% apart). Ticker verdict: ${verdictLabel}.`;
}

function refreshCalculatorLists(side) {
  const sides = side === "their" || side === "my" ? [side] : ["my", "their"];
  sides.forEach((key) => applyCalcListFilter(key));
}

function applyCalcListFilter(side) {
  const roster = side === "their" ? getCalcPartnerRoster() : getMyRoster();
  const list = document.querySelector(`#calc-list-${side}`);
  if (!roster || !list) return;
  const assets = calcEligibleAssets(roster);
  const items = [...list.querySelectorAll(".calc-item[data-asset-id]")];
  if (items.length !== assets.length) {
    list.innerHTML = renderCalcList(roster, side);
    return;
  }
  const query = side === "their" ? state.calc.theirQuery : state.calc.myQuery;
  const plan = planCalcListVisibility(assets, query, assetMatchesQuery, CALC_LIST_LIMIT);
  const visibleById = new Map(assets.map((asset, index) => [asset.assetId, plan.visibility[index]]));
  items.forEach((item) => {
    item.classList.toggle("hidden", !visibleById.get(item.dataset.assetId));
  });
  const empty = list.querySelector(".calc-empty");
  if (empty) empty.classList.toggle("hidden", plan.visibleCount > 0);
}

function patchCalculatorAfterToggle(side) {
  const me = getMyRoster();
  const partner = getCalcPartnerRoster();
  if (!me || !partner || !el.calculatorShell?.querySelector(".calc-grid")) {
    renderCalculator();
    return;
  }
  const roster = side === "their" ? partner : me;
  const pane = el.calculatorShell.querySelector(side === "their" ? ".calc-pane.team-b" : ".calc-pane.team-a");
  if (!pane) {
    renderCalculator();
    return;
  }
  const ids = side === "their" ? state.calc.theirAssetIds : state.calc.myAssetIds;
  const totalEl = pane.querySelector(".calc-pane-total");
  if (totalEl) totalEl.innerHTML = renderCalcPaneTotal(roster, side);
  const selectedEl = pane.querySelector(".calc-selected");
  if (selectedEl) selectedEl.innerHTML = renderCalcSelectedTokens(roster, side);
  pane.querySelectorAll(".calc-item").forEach((item) => {
    item.classList.toggle("selected", ids.has(item.dataset.assetId));
  });
  const verdict = el.calculatorShell.querySelector("#calc-verdict");
  if (verdict) verdict.innerHTML = renderCalculatorVerdict(me, partner);
}

function openCalculatorWith(rosterId) {
  state.calc.partnerRosterId = Number(rosterId);
  resetCalculatorState({ keepPartner: true });
  invalidateResults();
  openRoom("trades", "calculator");
}

function addValueCalcAsset(side, assetId, name, value, kind) {
  if (!assetId) return;
  const asset = {
    assetId,
    name: name || assetId,
    value: Number(value) || 0,
    assetType: kind === "pick" || String(assetId).startsWith("pick:") ? "pick" : "player",
  };
  state.valueCalc = addValueCalcItem(state.valueCalc, side, asset);
  renderValueCalculator();
}

function renderValueCalculator() {
  const host = el.valueCalculatorShell;
  if (!host) return;
  if (Object.keys(state.values).length === 0) {
    host.innerHTML = `<p class="muted">Values are still loading. The blank calculator uses market prices, not a specific roster.</p>`;
    return;
  }
  const leftTotal = Math.round(sumValueCalcSide(state.valueCalc.left));
  const rightTotal = Math.round(sumValueCalcSide(state.valueCalc.right));
  host.innerHTML = `
    ${renderValueBoardBar({
      applied: state.applyLeagueBoard,
      ready: Boolean(state.leagueBoard?.ready),
      marketHint: marketBoardHint(),
    })}
    <div class="panel-heading calc-heading">
      <div>
        <span class="eyebrow">Trade Calculator</span>
        <h2>Any assets</h2>
      </div>
      <p class="section-copy">Search any player or pick, same box. Not tied to two rosters.</p>
    </div>
    <div class="calc-grid">
      ${renderValueCalcPane("left", "Give")}
      ${renderValueCalcPane("right", "Get")}
    </div>
    <div id="value-calc-verdict" class="calc-verdict">${renderValueCalculatorVerdict(leftTotal, rightTotal)}</div>
  `;
}

function renderValueCalcPane(side, label) {
  const selected = state.valueCalc[side] || [];
  const total = Math.round(sumValueCalcSide(selected));
  const query = side === "right" ? state.valueCalc.rightQuery : state.valueCalc.leftQuery;
  return `
    <section class="calc-pane ${side === "left" ? "team-a" : "team-b"}">
      <header class="calc-pane-head">
        <div>
          <span class="analytics-kicker">${escapeHtml(label)}</span>
          <strong>${escapeHtml(label)}</strong>
        </div>
        <div class="calc-pane-total">
          <strong>${formatNumber(total)}</strong>
          <small>${selected.length} asset${selected.length === 1 ? "" : "s"}</small>
        </div>
      </header>
      <div class="calc-selected">
        ${selected.length
          ? selected.map((item) => `
            <button type="button" class="selected-token" data-action="value-remove" data-side="${side}" data-uid="${escapeHtml(item.uid)}" title="Remove">
              <span class="selected-token-label">${escapeHtml(item.name)}</span>
              <span class="selected-token-remove" aria-hidden="true">×</span>
            </button>
          `).join("")
          : `<span class="muted small">Search a player or pick, like 2026 early 1st.</span>`}
      </div>
      ${renderCalcSearchInput({
        query,
        side,
        input: "value-search",
        placeholder: "Search players and picks",
      })}
      <div class="calc-list" id="value-list-${side}">${renderValueCalcAssetList(side)}</div>
    </section>
  `;
}

function renderValueCalcAssetList(side) {
  const query = side === "right" ? state.valueCalc.rightQuery : state.valueCalc.leftQuery;
  if (!query.trim()) {
    return `<div class="player-item muted">Type a player or pick, like 2026 early 1st.</div>`;
  }
  const assets = listValueCalcAssets(
    state.values,
    withPlayerDirectoryNames(state.valueNameMap, state.players),
    { query, limit: 40 }
  );
  if (assets.length === 0) return `<div class="player-item muted">No matching players or picks.</div>`;
  return assets.map((asset) => `
    <div class="player-item calc-item" data-action="value-add" data-side="${side}" data-asset-id="${escapeHtml(asset.assetId)}" data-name="${escapeHtml(asset.name)}" data-value="${asset.value}" data-kind="${asset.assetType === "pick" ? "pick" : "player"}" role="button" tabindex="-1">
      <div class="asset-row-top">
        <div class="asset-name-stack">
          <strong>${escapeHtml(asset.name)}</strong>
          <div class="asset-meta">
            <span class="asset-pill ${asset.assetType === "pick" ? "gold" : ""}">${asset.assetType === "pick" ? "Pick" : "Player"}</span>
          </div>
        </div>
        <span class="asset-value-badge">${formatNumber(Math.round(asset.value))}</span>
      </div>
    </div>
  `).join("");
}

function renderValueCalculatorVerdict(leftTotal, rightTotal) {
  if (!leftTotal && !rightTotal) {
    return `<p class="muted calc-hint">Blank board. Add any player or generic pick to either side.</p>`;
  }
  const verdict = valueCalcVerdict(leftTotal, rightTotal);
  const maxSide = Math.max(verdict.left, verdict.right, 1);
  return `
    <section class="calc-summary ${verdict.tone}">
      <div class="calc-summary-main">
        <span class="analytics-kicker">Ticker verdict</span>
        <h3>${escapeHtml(verdict.label)}</h3>
        <p>Give ${formatNumber(Math.round(verdict.left))} · Get ${formatNumber(Math.round(verdict.right))}${verdict.left && verdict.right ? ` (${verdict.pct}% apart)` : ""}.</p>
      </div>
      <div class="calc-bars">
        <div class="calc-bar team-a">
          <span>Give</span>
          <div class="meter-track"><span style="width:${Math.round(verdict.left / maxSide * 100)}%"></span></div>
          <strong>${formatNumber(Math.round(verdict.left))}</strong>
        </div>
        <div class="calc-bar team-b">
          <span>Get</span>
          <div class="meter-track"><span style="width:${Math.round(verdict.right / maxSide * 100)}%"></span></div>
          <strong>${formatNumber(Math.round(verdict.right))}</strong>
        </div>
      </div>
      <div class="calc-actions">
        <button type="button" class="ghost-btn" data-action="value-clear">Clear both sides</button>
      </div>
    </section>
  `;
}

function refreshValueCalculatorLists(side) {
  const host = el.valueCalculatorShell;
  if (!host?.querySelector(".calc-grid")) {
    renderValueCalculator();
    return;
  }
  const sides = side === "right" || side === "left" ? [side] : ["left", "right"];
  sides.forEach((key) => {
    const list = host.querySelector(`#value-list-${key}`);
    if (list) list.innerHTML = renderValueCalcAssetList(key);
  });
}

function openTradeFile(tradeId, managerKey) {
  const id = String(tradeId || "");
  if (!id) return;
  prepareDeskPush();
  state.selectedTradeId = id;
  state.selectedTradeManagerKey = String(managerKey || "");
  setRoom("trades", "log");
  if (state.activePage !== "trades") {
    setActivePage("trades", { history: "push", scroll: "top", prepared: true });
    return;
  }
  renderActivePage();
  window.scrollTo(0, 0);
  updateUrlState({ mode: "push" });
  syncDocumentMeta();
}

// ---------------------------------------------------------------------------
// Ticker
// ---------------------------------------------------------------------------

function renderTicker() {
  if (!el.ticker || !el.tickerTrack) return;
  if (!state.leagueId || !state.league) {
    tickerController?.destroy();
    tickerController = null;
    tickerFingerprint = "";
    el.ticker.classList.add("hidden");
    return;
  }
  const model = getSeasonModel();
  const items = [];
  const entry = model?.featuredWeek;
  if (entry?.games?.length) {
    entry.games.forEach((game) => {
      const [left, right] = game.sides;
      if (entry.status === "upcoming" || (!game.played && entry.status !== "final")) {
        items.push(`<span class="ticker-tag">Wk ${entry.week}</span>${escapeHtml(left.name)} vs ${escapeHtml(right.name)}`);
      } else {
        const leader = left.points >= right.points ? left : right;
        const trailer = leader === left ? right : left;
        items.push(`<span class="ticker-tag ${entry.status === "live" ? "live" : ""}">${entry.status === "live" ? "Live" : "Final"}</span>${escapeHtml(leader.name)} ${formatPoints(leader.points)} · ${escapeHtml(trailer.name)} ${formatPoints(trailer.points)}`);
      }
    });
  }
  state.transactions
    .filter((transaction) => transaction?.type === "trade" && transaction?.status === "complete")
    .slice(0, 4)
    .forEach((transaction) => {
      const summary = buildRecentTradeSummary(transaction);
      items.push(`<span class="ticker-tag gold">Trade</span>${escapeHtml(summary.preview)}`);
    });
  const sim = model && !model.seasonComplete ? getSimulation(model) : null;
  if (sim?.results?.length) {
    const top = sim.results.slice(0, 3).map((row) => `${escapeHtml(row.name)} ${percentLabel(row.titlePct)}`).join(" · ");
    items.push(`<span class="ticker-tag green">Title odds</span>${top}`);
  }
  if (items.length === 0) {
    tickerController?.destroy();
    tickerController = null;
    tickerFingerprint = "";
    el.ticker.classList.add("hidden");
    return;
  }
  const markup = items.map((item) => `<span class="ticker-item">${item}</span>`).join("");
  const fingerprint = items.join("|");
  const durationSeconds = tickerDurationSeconds(items.length);
  if (fingerprint === tickerFingerprint && tickerController) {
    el.ticker.classList.remove("hidden");
    return;
  }
  const paused = Boolean(tickerController?.paused);
  tickerController?.destroy();
  el.tickerTrack.innerHTML = `<span class="ticker-group">${markup}</span><span class="ticker-group" aria-hidden="true">${markup}</span>`;
  el.tickerTrack.style.setProperty("--ticker-duration", `${durationSeconds}s`);
  el.ticker.classList.remove("hidden");
  tickerFingerprint = fingerprint;
  tickerController = bindTicker(el.ticker, el.tickerTrack, {
    durationSeconds,
    paused,
    currentTime: 0,
  });
}

// ---------------------------------------------------------------------------
// Workspace event delegation
// ---------------------------------------------------------------------------

function handleWorkspaceKeydown(event) {
  if (event.key !== "Enter" && event.key !== " ") return;
  const target = event.target.closest("[data-action][role='button']");
  if (!target || event.target !== target || !el.workspace?.contains(target)) return;
  event.preventDefault();
  target.click();
}

function handleWorkspacePointerDown(event) {
  if (!shouldHoldCalcSearchFocus(event, document)) return;
  event.preventDefault();
}

function handleWorkspaceClick(event) {
  const target = event.target.closest("[data-action]");
  if (!target || !el.workspace?.contains(target)) return;
  if (target.dataset.action === "league-home") return;
  const action = target.dataset.action;
  switch (action) {
    case "go": {
      if (target.dataset.room === "mock") state.mockFocus = null;
      openRoom(target.dataset.page, target.dataset.room);
      break;
    }
    case "open-mock-pick": {
      openMockBoardAt(target.dataset.mockRound, target.dataset.mockSlot);
      break;
    }
    case "home-week": {
      if (target.disabled || target.dataset.week === "") return;
      state.homeWeek = Number(target.dataset.week);
      renderScoresRoom();
      updateUrlState({ mode: "replace" });
      break;
    }
    case "standings-view": {
      state.standingsView = target.dataset.view === "division" ? "division" : "overall";
      renderStandingsRoom();
      break;
    }
    case "set-lens": {
      setLensRoster(target.dataset.rosterId);
      renderActivePage();
      break;
    }
    case "lens-me": {
      setLensRoster(state.meRosterId);
      renderActivePage();
      break;
    }
    case "set-lens-teams": {
      setLensRoster(target.dataset.rosterId);
      openRoom("teams", "roster");
      el.powerSection?.scrollIntoView({ behavior: "smooth", block: "start" });
      break;
    }
    case "calc-with": {
      openCalculatorWith(target.dataset.rosterId);
      break;
    }
    case "open-player": {
      const playerId = String(target.dataset.playerId || "");
      if (!playerId) return;
      state.weeklyValue.selectedPlayerId = state.weeklyValue.selectedPlayerId === playerId ? "" : playerId;
      renderRosterSheet();
      document.querySelector(".player-week-sheet")?.scrollIntoView({ behavior: "smooth", block: "start" });
      break;
    }
    case "close-player": {
      state.weeklyValue.selectedPlayerId = "";
      renderRosterSheet();
      break;
    }
    case "toggle-weekly-help": {
      setWeeklyScoreHelpOpen(!state.weeklyValue?.helpOpen);
      break;
    }
    case "close-weekly-help": {
      setWeeklyScoreHelpOpen(false);
      break;
    }
    case "awards-week": {
      state.awardsWeek = Number(target.dataset.week);
      renderAwardsPage();
      break;
    }
    case "open-trade": {
      if (!String(target.dataset.tradeId || "")) return;
      openTradeFile(target.dataset.tradeId, target.dataset.managerKey);
      break;
    }
    case "close-trade": {
      if (typeof history.state?.selectedTradeId === "string" && history.state.selectedTradeId && typeof history.back === "function") {
        history.back();
        break;
      }
      state.selectedTradeId = "";
      state.selectedTradeManagerKey = "";
      renderTradeLogDesk();
      updateUrlState({ mode: "replace" });
      break;
    }
    case "calc-toggle": {
      const side = target.dataset.side === "their" ? "their" : "my";
      const ids = side === "my" ? state.calc.myAssetIds : state.calc.theirAssetIds;
      const assetId = target.dataset.assetId;
      if (!assetId) return;
      if (ids.has(assetId)) ids.delete(assetId);
      else ids.add(assetId);
      patchCalculatorAfterToggle(side);
      break;
    }
    case "calc-clear": {
      resetCalculatorState({ keepPartner: true });
      renderCalculator();
      break;
    }
    case "value-add": {
      addValueCalcAsset(target.dataset.side, target.dataset.assetId, target.dataset.name, Number(target.dataset.value), target.dataset.kind);
      break;
    }
    case "value-remove": {
      state.valueCalc = removeValueCalcItem(state.valueCalc, target.dataset.side, target.dataset.uid);
      renderValueCalculator();
      break;
    }
    case "value-clear": {
      state.valueCalc = clearValueCalcSides(state.valueCalc);
      renderValueCalculator();
      break;
    }
    case "calc-copy": {
      copyTextToClipboard(target.dataset.offer || "").then((copied) => {
        const feedback = document.querySelector("#calc-copy-feedback");
        if (!feedback) return;
        feedback.textContent = copied ? "Copied" : "Copy failed";
        feedback.classList.remove("hidden");
        setTimeout(() => feedback.classList.add("hidden"), 1600);
      });
      break;
    }
    case "toggle-league-board": {
      if (target.disabled) return;
      state.applyLeagueBoard = !state.applyLeagueBoard;
      writeApplyLeagueBoard(state.applyLeagueBoard);
      renderActivePage();
      renderSessionSnapshot();
      break;
    }
    default:
      break;
  }
}

function handleWorkspaceChange(event) {
  const target = event.target.closest("[data-change]");
  if (!target) return;
  switch (target.dataset.change) {
    case "lens-roster": {
      setLensRoster(target.value);
      renderActivePage();
      break;
    }
    case "calc-partner": {
      state.calc.partnerRosterId = Number(target.value);
      resetCalculatorState({ keepPartner: true });
      renderCalculator();
      break;
    }
    default:
      break;
  }
}

function handleWorkspaceInput(event) {
  const target = event.target.closest("[data-input]");
  if (!target || event.isComposing) return;
  if (target.dataset.input === "calc-search") {
    const side = target.dataset.side === "their" ? "their" : "my";
    if (side === "their") state.calc.theirQuery = target.value;
    else state.calc.myQuery = target.value;
    keepCalcSearchFocused(document, () => refreshCalculatorLists(side));
  }
  if (target.dataset.input === "value-search") {
    const side = target.dataset.side === "right" ? "right" : "left";
    if (side === "right") state.valueCalc.rightQuery = target.value;
    else state.valueCalc.leftQuery = target.value;
    keepCalcSearchFocused(document, () => refreshValueCalculatorLists(side));
  }
}

// ---------------------------------------------------------------------------
// History: Hall, Seasons, Records
// ---------------------------------------------------------------------------

function historyRoomRoster(host, copy) {
  if (!host) return null;
  const roster = getLensRoster();
  if (!state.league || state.normalizedRosters.length === 0 || !roster) {
    host.innerHTML = `<p class="muted">${copy}</p>`;
    return null;
  }
  return roster;
}

function renderLeagueHistoryRoom() {
  const host = el.historyDashboard;
  if (!host) return;
  const roster = historyRoomRoster(host, "Load a league to open league history.");
  if (!roster) return;
  const { history } = buildHistoryArchiveModel(roster);
  const recordBook = buildRecordBook(getSeasonModel());
  host.innerHTML = `
    ${renderArchiveHero(history)}
    ${renderHallBoard(history)}
    ${renderChampionYears(history)}
    ${renderSimpleRecordBook(recordBook)}
  `;
}

function renderChampionYears(history) {
  const crowns = [...(history?.seasonSnapshots || [])]
    .filter((snapshot) => snapshot?.champion && (snapshot.isComplete === true || !snapshot.isCurrent))
    .sort((a, b) => Number(b.season) - Number(a.season));
  if (!crowns.length) {
    return `
      <section class="workspace-panel">
        <div class="panel-heading">
          <div>
            <span class="eyebrow">Champions</span>
            <h2>Title years</h2>
          </div>
          <p class="section-copy">Need a finished season. Current first place is not the crown.</p>
        </div>
      </section>
    `;
  }
  return `
    <section class="workspace-panel">
      <div class="panel-heading">
        <div>
          <span class="eyebrow">Champions</span>
          <h2>Who won the league</h2>
        </div>
        <p class="section-copy">Previous season champions. Not this year's standings or power leader.</p>
      </div>
      <div class="champion-year-list">
        ${crowns.map((snapshot) => `
          <div class="champion-year-row">
            <strong>${escapeHtml(snapshot.season)}</strong>
            <span>${escapeHtml(snapshot.champion.managerName)}</span>
            <small>${snapshot.runnerUp
              ? `beat ${escapeHtml(snapshot.runnerUp.managerName)}`
              : "champion"}</small>
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

function renderSimpleRecordBook(recordBook) {
  const records = leagueHistoryRecords(recordBook, LEAGUE_HISTORY_RECORD_IDS);
  const gameCount = Number(recordBook?.gameCount) || 0;
  return `
    <section class="workspace-panel">
      <div class="panel-heading">
        <div>
          <span class="eyebrow">Record book</span>
          <h2>A few all-time marks</h2>
        </div>
        <p class="section-copy">${gameCount
          ? `${gameCount.toLocaleString()} games in the archive.`
          : "Records fill in as old matchups load."}</p>
      </div>
      ${records.length
        ? `<div class="record-list record-list-wide">${records.map((record) => `
            <div class="record-row ${escapeHtml(record.tone || "")}">
              <div>
                <span class="analytics-kicker">${escapeHtml(record.title)}</span>
                <strong>${escapeHtml(record.holder)}</strong>
                <p>${escapeHtml(record.detail)}</p>
              </div>
              <strong class="record-value">${escapeHtml(record.valueLabel)}</strong>
            </div>
          `).join("")}</div>`
        : `<p class="muted analytics-empty">Records populate as archive matchups load.</p>`}
    </section>
  `;
}

function renderHallRoom() {
  renderLeagueHistoryRoom();
}

function renderSeasonsRoom() {
  const roster = historyRoomRoster(el.seasonsDashboard, "Load a league to open the season ledger.");
  if (!roster) return;
  const { history } = buildHistoryArchiveModel(roster);
  history.comparison = buildHistoryComparison(history);
  el.seasonsDashboard.innerHTML = `
    ${renderSeasonArchivePanel(history)}
    ${renderHistoryComparisonPanel(history)}
  `;
}

function renderRecordsRoom() {
  const host = el.recordsDashboard;
  if (!host) return;
  if (!state.league || state.normalizedRosters.length === 0) {
    host.innerHTML = `<p class="muted">Load a league to open the record book.</p>`;
    return;
  }
  const recordBook = buildRecordBook(getSeasonModel());
  host.innerHTML = `
    <section class="workspace-panel">
      <div class="panel-heading">
        <div>
          <span class="eyebrow">Record Book</span>
          <h2>All-time marks</h2>
        </div>
        <p class="section-copy">${recordBook.gameCount ? `${recordBook.gameCount.toLocaleString()} games across ${recordBook.seasonCount} season${recordBook.seasonCount === 1 ? "" : "s"} of archive.` : state.historyMatchupsLoaded ? "No finalized games in the archive yet." : "Archive matchups are syncing."}</p>
      </div>
      ${recordBook.records.length
        ? `<div class="record-list record-list-wide">${recordBook.records.map((record) => `
            <div class="record-row ${record.tone}">
              <div>
                <span class="analytics-kicker">${escapeHtml(record.title)}</span>
                <strong>${escapeHtml(record.holder)}</strong>
                <p>${escapeHtml(record.detail)}</p>
              </div>
              <strong class="record-value">${escapeHtml(record.valueLabel)}</strong>
            </div>
          `).join("")}</div>`
        : `<p class="muted analytics-empty">Records populate as archive matchups load.</p>`}
    </section>
  `;
}

function buildHistoryArchiveModel(lensRoster) {
  const context = buildLeaguePowerContext({
    league: state.league,
    rosters: state.normalizedRosters,
    values: state.values,
  });
  const profiles = state.normalizedRosters
    .map((roster) => buildTeamPowerProfile({
      roster,
      values: state.values,
      league: state.league,
      context,
    }))
    .sort((a, b) => b.score - a.score || a.rank - b.rank || a.managerName.localeCompare(b.managerName));
  const lensProfile = profiles.find((profile) => String(profile.rosterId) === String(lensRoster.rosterId))
    || buildTeamPowerProfile({ roster: lensRoster, values: state.values, league: state.league, context });
  const market = buildTradeMarketAnalytics(lensRoster);
  const leagueAnalytics = buildLeagueAnalytics(context, profiles, market);
  const history = buildLeagueHistoryArchive({
    meRoster: lensRoster,
    meProfile: lensProfile,
    profiles,
    market,
    leagueAnalytics,
  });
  return { profiles, market, history };
}

function buildLeagueHistoryArchive({ meRoster, meProfile, profiles, market, leagueAnalytics }) {
  const historyEntries = state.leagueHistory.length > 0
    ? state.leagueHistory
    : [buildLeagueHistoryEntry(state.leagueId, {
        league: state.league,
        users: state.users,
        rosters: state.rosters,
        tradedPicks: state.tradedPicks,
      }, true)];
  const archiveTrades = buildArchiveTradeAnalytics(getArchiveTradeTransactions());
  const seasonSnapshots = historyEntries
    .map((entry) => buildSeasonSnapshot(entry, archiveTrades.byLeagueId.get(String(entry.leagueId))))
    .filter(Boolean)
    .sort((a, b) => Number(b.season) - Number(a.season) || Number(b.isCurrent) - Number(a.isCurrent));
  const dynastyRows = buildDynastyRows(seasonSnapshots, profiles);
  const managerLens = buildManagerHistoryLens(meRoster, meProfile, seasonSnapshots, dynastyRows, market);
  const storylines = buildLeagueStorylines(seasonSnapshots, dynastyRows, archiveTrades, leagueAnalytics);
  const completedSnapshots = seasonSnapshots.filter((snapshot) => !snapshot.isCurrent);
  const championKeys = new Set(
    completedSnapshots
      .map((snapshot) => snapshot.champion?.managerKey)
      .filter(Boolean)
  );
  const parityValues = seasonSnapshots
    .map((snapshot) => snapshot.parityScore)
    .filter((value) => Number.isFinite(value) && value > 0);
  const currentPowerLeader = profiles[0] || null;
  const archive = {
    seasonSnapshots,
    dynastyRows,
    managerLens,
    storylines,
    archiveTrades,
    seasonRange: formatSeasonRange(seasonSnapshots),
    completedSeasonCount: completedSnapshots.length,
    uniqueChampionCount: championKeys.size,
    averageParityScore: parityValues.length ? Math.round(average(parityValues)) : 0,
    currentPowerLeader,
    latestSnapshot: seasonSnapshots[0] || null,
    finishMatrixRows: dynastyRows.slice(0, Math.min(12, dynastyRows.length)),
    syncLabel: buildArchiveSyncLabel(),
    // Filled lazily by the Seasons room; the Hall never needs it.
    comparison: null,
  };
  return archive;
}

function getArchiveTradeTransactions() {
  const currentTransactions = state.transactions.map((transaction) => ({
    ...transaction,
    sourceLeagueId: state.leagueId,
    sourceSeason: state.league?.season,
  }));
  return [...currentTransactions, ...state.historyTransactions]
    .filter((transaction) => transaction?.type === "trade" && transaction?.status === "complete")
    .sort((a, b) => Number(b.status_updated || b.created || 0) - Number(a.status_updated || a.created || 0));
}

function buildArchiveTradeAnalytics(transactions) {
  const byLeagueId = new Map();
  const pairMap = new Map();
  const managerMap = new Map();
  let movedAssetCount = 0;
  let movedValue = 0;
  let multiTeamTradeCount = 0;

  transactions.forEach((transaction) => {
    const sourceLeagueId = String(transaction?.sourceLeagueId || state.leagueId || "");
    const sourceSeason = String(transaction?.sourceSeason || getHistoryEntryByLeagueId(sourceLeagueId)?.season || "");
    if (!byLeagueId.has(sourceLeagueId)) {
      byLeagueId.set(sourceLeagueId, {
        leagueId: sourceLeagueId,
        season: sourceSeason,
        tradeCount: 0,
        movedAssetCount: 0,
        movedValue: 0,
      });
    }
    const leagueBucket = byLeagueId.get(sourceLeagueId);
    leagueBucket.tradeCount += 1;

    const participantInfos = getTransactionParticipantIds(transaction)
      .map((rosterId) => getHistoryRosterInfo(sourceLeagueId, rosterId))
      .filter(Boolean);
    if (participantInfos.length > 2) multiTeamTradeCount += 1;

    participantInfos.forEach((info) => {
      if (!managerMap.has(info.managerKey)) {
        managerMap.set(info.managerKey, {
          managerKey: info.managerKey,
          managerName: info.managerName,
          tradeCount: 0,
          seasons: new Set(),
        });
      }
      const manager = managerMap.get(info.managerKey);
      manager.tradeCount += 1;
      if (sourceSeason) manager.seasons.add(sourceSeason);
    });

    const movements = buildTradeMovements(transaction);
    const transactionValue = movements.reduce((sum, movement) => sum + movement.value, 0);
    movedAssetCount += movements.length;
    movedValue += transactionValue;
    leagueBucket.movedAssetCount += movements.length;
    leagueBucket.movedValue += transactionValue;

    for (let i = 0; i < participantInfos.length; i += 1) {
      for (let j = i + 1; j < participantInfos.length; j += 1) {
        const pairInfos = [participantInfos[i], participantInfos[j]]
          .sort((a, b) => a.managerKey.localeCompare(b.managerKey));
        const key = pairInfos.map((info) => info.managerKey).join("|");
        if (!pairMap.has(key)) {
          pairMap.set(key, {
            managerKeys: pairInfos.map((info) => info.managerKey),
            managerNames: pairInfos.map((info) => info.managerName),
            count: 0,
            valueMoved: 0,
            seasons: new Set(),
          });
        }
        const pair = pairMap.get(key);
        pair.count += 1;
        pair.valueMoved += transactionValue;
        if (sourceSeason) pair.seasons.add(sourceSeason);
      }
    }
  });

  const pairLeaders = [...pairMap.values()]
    .map((pair) => ({
      ...pair,
      seasons: [...pair.seasons].sort((a, b) => Number(b) - Number(a)),
    }))
    .sort((a, b) => b.count - a.count || b.valueMoved - a.valueMoved || a.managerNames.join("").localeCompare(b.managerNames.join("")));
  const managerLeaderboard = [...managerMap.values()]
    .map((manager) => ({
      ...manager,
      seasons: [...manager.seasons].sort((a, b) => Number(b) - Number(a)),
    }))
    .sort((a, b) => b.tradeCount - a.tradeCount || a.managerName.localeCompare(b.managerName));

  return {
    tradeCount: transactions.length,
    movedAssetCount,
    movedValue: Math.round(movedValue),
    multiTeamTradeCount,
    byLeagueId,
    pairLeaders,
    managerLeaderboard,
    recentTrades: transactions.slice(0, ANALYTICS_RECENT_TRADE_LIMIT).map(buildArchiveRecentTradeSummary),
  };
}

function buildSeasonSnapshot(entry, tradeBucket = null) {
  if (!entry?.league || !Array.isArray(entry.rosters) || entry.rosters.length === 0) return null;
  const standings = buildSeasonStandings(entry);
  if (standings.length === 0) return null;

  const regularLeader = standings.slice().sort(compareRegularSeasonRows)[0] || null;
  const pointsLeader = standings.slice().sort((a, b) => b.points - a.points || compareRegularSeasonRows(a, b))[0] || null;
  const potentialPointsLeader = standings.slice().sort((a, b) => b.potentialPoints - a.potentialPoints || compareRegularSeasonRows(a, b))[0] || null;
  const champion = standings.find((row) => row.playoffFinish === 1)
    || (!entry.isCurrent ? standings[0] : null);
  const runnerUp = standings.find((row) => row.playoffFinish === 2) || null;
  const cellar = standings[standings.length - 1] || null;
  const points = standings.map((row) => row.points).filter((value) => Number.isFinite(value) && value > 0);
  const maxPoints = points.length ? Math.max(...points) : 0;
  const minPoints = points.length ? Math.min(...points) : 0;
  const scoringSpread = Math.max(0, maxPoints - minPoints);
  const parityScore = maxPoints > 0 ? clamp(Math.round(100 - (scoringSpread / maxPoints * 100)), 1, 99) : 0;
  const consolationWinner = buildConsolationWinner(entry);
  const status = String(entry.league?.status || "").replace(/_/g, " ");

  return {
    leagueId: String(entry.leagueId || ""),
    season: String(entry.season || entry.league?.season || ""),
    isCurrent: Boolean(entry.isCurrent),
    isComplete: String(entry.league?.status || "").toLowerCase() === "complete",
    statusLabel: status || (entry.isCurrent ? "current" : "archived"),
    standings,
    champion,
    runnerUp,
    regularLeader,
    pointsLeader,
    potentialPointsLeader,
    consolationWinner,
    cellar,
    scoringAverage: points.length ? Math.round(average(points)) : 0,
    scoringSpread: Math.round(scoringSpread),
    parityScore,
    tradeCount: tradeBucket?.tradeCount || 0,
    movedAssetCount: tradeBucket?.movedAssetCount || 0,
    movedValue: Math.round(tradeBucket?.movedValue || 0),
    tradedPickCount: Array.isArray(entry.tradedPicks) ? entry.tradedPicks.length : 0,
    playoffTeams: Number(entry.league?.settings?.playoff_teams || 0),
    rosterCount: standings.length,
  };
}

function buildSeasonStandings(entry) {
  const userById = new Map((entry.users || []).map((user) => [String(user.user_id), user]));
  const bracketFinishMap = buildBracketFinishMap(entry.winnersBracket);
  const rows = (entry.rosters || []).map((roster) => {
    const rosterId = normalizeRosterIdKey(roster?.roster_id);
    const identity = resolveRosterIdentity(getFranchiseIndex(), {
      userId: ownerIdFromRoster(roster),
      leagueId: entry.leagueId,
      rosterId,
    });
    const user = identity.userId ? userById.get(identity.userId) : null;
    const managerName = displayNameForUser(user, identity.managerName);
    const explicitRank = extractRosterFinishRank(roster);
    return {
      roster,
      rosterId,
      userId: identity.userId,
      managerKey: identity.managerKey,
      managerName,
      wins: Number(roster?.settings?.wins || 0),
      losses: Number(roster?.settings?.losses || 0),
      ties: Number(roster?.settings?.ties || 0),
      points: extractRosterDecimalStat(roster, "fpts", "fpts_decimal"),
      potentialPoints: extractRosterDecimalStat(roster, "ppts", "ppts_decimal"),
      pointsAgainst: extractRosterDecimalStat(roster, "fpts_against", "fpts_against_decimal"),
      playoffFinish: bracketFinishMap.get(rosterId) || null,
      explicitRank,
      regularRank: null,
      finishRank: null,
    };
  });

  rows.slice().sort(compareRegularSeasonRows).forEach((row, index) => {
    row.regularRank = index + 1;
  });
  rows.forEach((row) => {
    row.finishRank = row.playoffFinish || row.explicitRank || row.regularRank || null;
  });

  return rows.sort(compareSeasonFinishRows);
}

function buildBracketFinishMap(winnersBracket = []) {
  const finishMap = new Map();
  winnersBracket.forEach((match) => {
    const place = Number(match?.p);
    if (!Number.isFinite(place) || place <= 0) return;
    const winnerId = normalizeRosterIdKey(match?.w);
    const loserId = normalizeRosterIdKey(match?.l);
    if (winnerId) finishMap.set(winnerId, Math.min(finishMap.get(winnerId) || place, place));
    if (loserId) finishMap.set(loserId, Math.min(finishMap.get(loserId) || place + 1, place + 1));
  });
  return finishMap;
}

function buildConsolationWinner(entry) {
  const titleMatch = (entry.losersBracket || []).find((match) => Number(match?.p) === 1 && match?.w != null);
  if (!titleMatch) return null;
  return getHistoryRosterInfo(entry.leagueId, titleMatch.w);
}

function compareRegularSeasonRows(a, b) {
  return b.wins - a.wins
    || a.losses - b.losses
    || b.ties - a.ties
    || b.points - a.points
    || b.potentialPoints - a.potentialPoints
    || Number(a.rosterId) - Number(b.rosterId)
    || String(a.rosterId).localeCompare(String(b.rosterId));
}

function compareSeasonFinishRows(a, b) {
  return (a.finishRank || 999) - (b.finishRank || 999)
    || compareRegularSeasonRows(a, b);
}

function buildDynastyRows(seasonSnapshots, profiles) {
  const rowsByManager = new Map();
  const ensureRow = (managerKey, managerName, userId = "") => {
    if (!rowsByManager.has(managerKey)) {
      rowsByManager.set(managerKey, {
        managerKey,
        managerName,
        userId,
        records: [],
        titles: 0,
        runnerUps: 0,
        podiums: 0,
        seasons: 0,
        completedSeasons: 0,
        totalWins: 0,
        totalLosses: 0,
        totalTies: 0,
        totalPoints: 0,
        bestFinish: null,
        avgFinish: null,
        volatility: 0,
        currentScore: null,
        currentPowerRank: null,
        currentLaneLabel: "",
        currentRosterId: null,
        dynastyScore: 0,
      });
    }
    return rowsByManager.get(managerKey);
  };

  seasonSnapshots.forEach((snapshot) => {
    snapshot.standings.forEach((standing) => {
      const row = ensureRow(standing.managerKey, standing.managerName, standing.userId);
      const record = {
        season: snapshot.season,
        isCurrent: snapshot.isCurrent,
        leagueId: snapshot.leagueId,
        finishRank: standing.finishRank,
        regularRank: standing.regularRank,
        playoffFinish: standing.playoffFinish,
        wins: standing.wins,
        losses: standing.losses,
        ties: standing.ties,
        points: standing.points,
        powerRank: null,
        powerScore: null,
      };
      row.records.push(record);
      row.seasons += 1;
      row.totalWins += standing.wins;
      row.totalLosses += standing.losses;
      row.totalTies += standing.ties;
      row.totalPoints += standing.points;
      if (!snapshot.isCurrent) {
        row.completedSeasons += 1;
        if (standing.playoffFinish === 1) row.titles += 1;
        if (standing.playoffFinish === 2) row.runnerUps += 1;
        if (Number(standing.finishRank) <= 3) row.podiums += 1;
      }
    });
  });

  profiles.forEach((profile) => {
    const roster = state.normalizedRosters.find((entry) => String(entry.rosterId) === String(profile.rosterId));
    if (!roster) return;
    const managerKey = buildManagerKey(roster.manager.userId, state.leagueId, roster.rosterId);
    const row = ensureRow(managerKey, profile.managerName, roster.manager.userId);
    row.currentScore = profile.score;
    row.currentPowerRank = profile.rank;
    row.currentLaneLabel = profile.laneLabel;
    row.currentRosterId = profile.rosterId;
    const currentRecord = row.records.find((record) => record.isCurrent);
    if (currentRecord) {
      currentRecord.powerRank = profile.rank;
      currentRecord.powerScore = profile.score;
    }
  });

  rowsByManager.forEach((row) => {
    const finishRecords = row.records.filter((record) => Number.isFinite(record.finishRank) && !record.isCurrent);
    const fallbackRecords = finishRecords.length ? finishRecords : row.records.filter((record) => Number.isFinite(record.finishRank));
    const finishRanks = fallbackRecords.map((record) => record.finishRank);
    row.bestFinish = finishRanks.length ? Math.min(...finishRanks) : null;
    row.avgFinish = finishRanks.length ? average(finishRanks) : null;
    row.volatility = calculateRankVolatility(finishRanks);
    row.dynastyScore = Math.round(
      row.titles * 120
        + row.runnerUps * 54
        + row.podiums * 28
        + row.totalWins * 5
        + row.totalPoints / 75
        + (row.currentScore || 0) * 0.55
        - row.volatility * 2
    );
  });

  return [...rowsByManager.values()].sort((a, b) =>
    b.titles - a.titles
      || b.runnerUps - a.runnerUps
      || b.podiums - a.podiums
      || b.dynastyScore - a.dynastyScore
      || (a.avgFinish || 99) - (b.avgFinish || 99)
      || a.managerName.localeCompare(b.managerName)
  );
}

function buildManagerHistoryLens(meRoster, meProfile, seasonSnapshots, dynastyRows, market) {
  const managerKey = buildManagerKey(meRoster.manager.userId, state.leagueId, meRoster.rosterId);
  const row = dynastyRows.find((entry) => entry.managerKey === managerKey)
    || dynastyRows.find((entry) => entry.currentRosterId === meRoster.rosterId)
    || null;
  const records = (row?.records || []).slice().sort((a, b) => Number(b.season) - Number(a.season));
  const previousRecord = records.find((record) => !record.isCurrent) || null;
  const bestFinishLabel = row?.bestFinish ? ordinal(Math.round(row.bestFinish)) : "N/A";
  const avgFinishLabel = row?.avgFinish ? `${row.avgFinish.toFixed(1)} avg` : "No archive";
  const currentPowerLabel = `${ordinal(meProfile.rank)} power rank`;
  const tradeLabel = market.favoritePartner
    ? `${market.favoritePartner.otherManagerName} is the warmest trade lane`
    : market.myTradeCount > 0
      ? `${market.myTradeCount} current-season trade${market.myTradeCount === 1 ? "" : "s"}`
      : "No current-season trades";
  const nextChapter = buildManagerNextChapter(meProfile, row, market);

  return {
    managerKey,
    managerName: meProfile.managerName,
    headline: row?.titles
      ? `${row.titles} title${row.titles === 1 ? "" : "s"} in the archive`
      : previousRecord
        ? `Best archived finish: ${bestFinishLabel}`
        : "No completed archive season yet",
    shortStatus: `${meProfile.score}/100 | ${currentPowerLabel}`,
    bestFinishLabel,
    avgFinishLabel,
    titles: row?.titles || 0,
    podiums: row?.podiums || 0,
    completedSeasons: row?.completedSeasons || 0,
    recordLabel: row ? formatManagerRecord(row) : "0-0",
    currentPowerLabel,
    currentLaneLabel: meProfile.laneLabel,
    currentScore: meProfile.score,
    tradeLabel,
    nextChapter,
    records: records.slice(0, 5),
  };
}

function buildManagerNextChapter(profile, row, market) {
  if (profile.rank <= 3 && row?.titles === 0) {
    return "This is a real title window. The league archive says the next move should protect weekly ceiling, not just add abstract value.";
  }
  if (profile.assetSummary.firstRoundPickCount >= 4) {
    return "The selected roster controls enough future capital to shape the next league era if one pick becomes a weekly starter.";
  }
  if (profile.weakestPosition) {
    return `${profile.weakestPosition.position} is the cleanest pressure point if this manager wants to climb the current power board.`;
  }
  if (market.favoritePartner) {
    return `The archive points back to ${market.favoritePartner.otherManagerName}; that is the first negotiation lane to reopen.`;
  }
  return "The selected manager is a neutral archive profile right now: useful roster, no obvious league-history lever yet.";
}

function buildLeagueStorylines(seasonSnapshots, dynastyRows, archiveTrades, leagueAnalytics) {
  const completedSnapshots = seasonSnapshots.filter((snapshot) => !snapshot.isCurrent);
  const titleLeader = dynastyRows.slice().sort((a, b) => b.titles - a.titles || b.runnerUps - a.runnerUps || b.dynastyScore - a.dynastyScore)[0] || null;
  const heartbreakLeader = dynastyRows.slice().sort((a, b) => b.runnerUps - a.runnerUps || b.podiums - a.podiums)[0] || null;
  const uniqueChampions = new Set(completedSnapshots.map((snapshot) => snapshot.champion?.managerKey).filter(Boolean)).size;
  const parityRate = completedSnapshots.length ? Math.round(uniqueChampions / completedSnapshots.length * 100) : 0;
  const oldestCompleted = completedSnapshots[completedSnapshots.length - 1] || null;
  const newestCompleted = completedSnapshots[0] || null;
  const scoringDelta = oldestCompleted && newestCompleted
    ? newestCompleted.scoringAverage - oldestCompleted.scoringAverage
    : 0;
  const tradeLeader = archiveTrades.managerLeaderboard[0] || null;

  return [
    {
      title: titleLeader?.titles ? "Dynasty Gravity" : "Open Throne",
      body: titleLeader?.titles
        ? `${titleLeader.managerName} owns the strongest trophy profile with ${titleLeader.titles} title${titleLeader.titles === 1 ? "" : "s"} and ${titleLeader.podiums} podium finish${titleLeader.podiums === 1 ? "" : "es"}.`
        : "No repeat title pattern is visible in the loaded archive, so the league still reads like an open throne.",
      tone: "blue",
    },
    {
      title: "Parity Meter",
      body: completedSnapshots.length
        ? `${uniqueChampions} different champion${uniqueChampions === 1 ? "" : "s"} across ${completedSnapshots.length} completed season${completedSnapshots.length === 1 ? "" : "s"} (${parityRate}% title churn).`
        : `${leagueAnalytics.parityLabel} in the current power model, with completed history still limited.`,
      tone: parityRate >= 70 ? "green" : parityRate >= 40 ? "gold" : "rose",
    },
    {
      title: scoringDelta >= 0 ? "Scoring Boom" : "Scoring Squeeze",
      body: oldestCompleted && newestCompleted
        ? `Average points moved ${formatSignedNumber(scoringDelta)} from ${oldestCompleted.season} to ${newestCompleted.season}.`
        : `The current scoring spread is ${formatNumber(seasonSnapshots[0]?.scoringSpread || 0)} points across the league.`,
      tone: scoringDelta >= 0 ? "green" : "gold",
    },
    {
      title: tradeLeader ? "Market Maker" : "Quiet Market",
      body: tradeLeader
        ? `${tradeLeader.managerName} appears in ${tradeLeader.tradeCount} archived trade${tradeLeader.tradeCount === 1 ? "" : "s"} across ${tradeLeader.seasons.length || 1} season${tradeLeader.seasons.length === 1 ? "" : "s"}.`
        : "The trade archive has not found a dominant dealmaker yet.",
      tone: tradeLeader ? "blue" : "gold",
    },
    {
      title: heartbreakLeader?.runnerUps ? "Final Boss Scar" : "No Finals Scar Yet",
      body: heartbreakLeader?.runnerUps
        ? `${heartbreakLeader.managerName} has ${heartbreakLeader.runnerUps} runner-up finish${heartbreakLeader.runnerUps === 1 ? "" : "es"}, the archive's clearest near-miss profile.`
        : "No manager has a clear runner-up pattern in the loaded seasons.",
      tone: heartbreakLeader?.runnerUps ? "rose" : "green",
    },
  ];
}

function renderArchiveHero(history) {
  const crown = pickLatestCrown(history.seasonSnapshots);
  const championLabel = crown?.champion?.managerName || "TBD";
  const championDetail = crown ? `${crown.season} champion` : "previous season champion";
  const titleLeader = [...(history.dynastyRows || [])]
    .filter((row) => row.titles > 0)
    .sort((a, b) => b.titles - a.titles || b.podiums - a.podiums)[0] || null;
  const titleValue = titleLeader ? titleLeader.managerName : "Open";
  const titleDetail = titleLeader
    ? `${titleLeader.titles} title${titleLeader.titles === 1 ? "" : "s"}`
    : "no completed season in the archive yet";

  return `
    <div class="league-archive-hero">
      <div class="analytics-hero-main">
        <span class="analytics-kicker">${escapeHtml(state.leagueName || "League")} history</span>
        <h3>League history</h3>
        <p>${escapeHtml(history.seasonRange)} archive. Last champion, title hall, and a short record book.</p>
        <div class="power-badge-row">
          <span class="power-badge">${escapeHtml(`${history.seasonSnapshots.length} season${history.seasonSnapshots.length === 1 ? "" : "s"}`)}</span>
          <span class="power-badge">${escapeHtml(`${history.uniqueChampionCount} title winner${history.uniqueChampionCount === 1 ? "" : "s"}`)}</span>
        </div>
      </div>
      <div class="trophy-panel">
        <span>Latest Crown</span>
        <strong>${escapeHtml(championLabel)}</strong>
        <small>${escapeHtml(championDetail)}</small>
      </div>
    </div>

    <div class="analytics-metric-grid">
      ${renderAnalyticsMetric("Seasons", history.seasonRange, `${history.completedSeasonCount} completed`, "blue")}
      ${renderAnalyticsMetric("Most Titles", titleValue, titleDetail, "gold")}
    </div>
  `;
}

function ensureHistoryCompareDefaults(history) {
  const compare = state.historyCompare;
  const seasons = (history.seasonSnapshots || []).map((snapshot) => String(snapshot.season));
  if (!seasons.includes(String(compare.leftSeason))) {
    compare.leftSeason = seasons[1] || seasons[0] || "";
  }
  if (!seasons.includes(String(compare.rightSeason))) {
    compare.rightSeason = seasons[0] || "";
  }

  const managerKeys = (history.dynastyRows || []).map((row) => row.managerKey);
  const meKey = history.managerLens?.managerKey || "";
  if (!managerKeys.includes(compare.leftManagerKey)) {
    compare.leftManagerKey = (meKey && managerKeys.includes(meKey) ? meKey : managerKeys[0]) || "";
  }
  if (!managerKeys.includes(compare.rightManagerKey)) {
    compare.rightManagerKey = managerKeys.find((key) => key !== compare.leftManagerKey) || "";
  }
  if (compare.mode !== "managers") compare.mode = "seasons";
  return compare;
}

function buildHistoryComparison(history) {
  const compare = ensureHistoryCompareDefaults(history);
  const leftSnapshot = findSeasonSnapshot(history.seasonSnapshots, compare.leftSeason);
  const rightSnapshot = findSeasonSnapshot(history.seasonSnapshots, compare.rightSeason);
  const leftManager = findDynastyRow(history.dynastyRows, compare.leftManagerKey);
  const rightManager = findDynastyRow(history.dynastyRows, compare.rightManagerKey);

  return {
    mode: compare.mode,
    leftSeason: compare.leftSeason,
    rightSeason: compare.rightSeason,
    leftManagerKey: compare.leftManagerKey,
    rightManagerKey: compare.rightManagerKey,
    seasonOptions: (history.seasonSnapshots || []).map((snapshot) => ({
      value: snapshot.season,
      label: `${snapshot.season}${snapshot.isCurrent ? " (current)" : ""}`,
    })),
    managerOptions: (history.dynastyRows || []).map((row) => ({
      value: row.managerKey,
      label: row.managerName,
    })),
    seasonCompare: buildSeasonComparison(leftSnapshot, rightSnapshot, history.dynastyRows, history.managerLens),
    managerCompare: buildManagerComparison(leftManager, rightManager, history.seasonSnapshots, history.archiveTrades),
    matchupSyncLabel: buildMatchupSyncLabel(),
  };
}

function findSeasonSnapshot(snapshots = [], season) {
  return snapshots.find((snapshot) => String(snapshot.season) === String(season)) || null;
}

function findDynastyRow(rows = [], managerKey) {
  return rows.find((row) => row.managerKey === managerKey) || null;
}

function buildSeasonComparison(leftSnapshot, rightSnapshot, dynastyRows, managerLens) {
  if (!leftSnapshot || !rightSnapshot) {
    return { available: false, sameSeason: false, rows: [], movers: [], rosterDelta: null };
  }

  const sameSeason = String(leftSnapshot.season) === String(rightSnapshot.season);
  const standingRows = (dynastyRows || [])
    .map((row) => {
      const leftRecord = row.records.find((record) => String(record.season) === String(leftSnapshot.season));
      const rightRecord = row.records.find((record) => String(record.season) === String(rightSnapshot.season));
      if (!leftRecord && !rightRecord) return null;
      const leftRank = getComparableRank(leftRecord);
      const rightRank = getComparableRank(rightRecord);
      const rankDelta = Number.isFinite(leftRank) && Number.isFinite(rightRank) ? leftRank - rightRank : null;
      const pointsDelta = Number.isFinite(leftRecord?.points) && Number.isFinite(rightRecord?.points)
        ? rightRecord.points - leftRecord.points
        : null;
      return {
        managerKey: row.managerKey,
        managerName: row.managerName,
        selected: row.managerKey === managerLens?.managerKey,
        leftRank,
        rightRank,
        rankDelta,
        leftPoints: leftRecord?.points ?? null,
        rightPoints: rightRecord?.points ?? null,
        pointsDelta,
        leftRecord: formatSeasonRecord(leftRecord),
        rightRecord: formatSeasonRecord(rightRecord),
      };
    })
    .filter(Boolean)
    .sort((a, b) => (a.rightRank || 99) - (b.rightRank || 99) || (a.leftRank || 99) - (b.leftRank || 99) || a.managerName.localeCompare(b.managerName));

  const movers = standingRows
    .filter((row) => Number.isFinite(row.rankDelta) && row.rankDelta !== 0)
    .slice()
    .sort((a, b) => Math.abs(b.rankDelta) - Math.abs(a.rankDelta) || a.managerName.localeCompare(b.managerName));

  return {
    available: true,
    sameSeason,
    left: summarizeSeasonForCompare(leftSnapshot),
    right: summarizeSeasonForCompare(rightSnapshot),
    metrics: [
      {
        label: "Champion / leader",
        left: leftSnapshot.isCurrent ? leftSnapshot.regularLeader?.managerName || "TBD" : leftSnapshot.champion?.managerName || "TBD",
        right: rightSnapshot.isCurrent ? rightSnapshot.regularLeader?.managerName || "TBD" : rightSnapshot.champion?.managerName || "TBD",
      },
      {
        label: "Points king",
        left: `${leftSnapshot.pointsLeader?.managerName || "TBD"} (${formatNumber(leftSnapshot.pointsLeader?.points || 0)} PF)`,
        right: `${rightSnapshot.pointsLeader?.managerName || "TBD"} (${formatNumber(rightSnapshot.pointsLeader?.points || 0)} PF)`,
      },
      {
        label: "Scoring average",
        left: formatNumber(leftSnapshot.scoringAverage),
        right: formatNumber(rightSnapshot.scoringAverage),
        delta: rightSnapshot.scoringAverage - leftSnapshot.scoringAverage,
      },
      {
        label: "Scoring gap",
        left: formatNumber(leftSnapshot.scoringSpread),
        right: formatNumber(rightSnapshot.scoringSpread),
        delta: rightSnapshot.scoringSpread - leftSnapshot.scoringSpread,
      },
      {
        label: "Trades",
        left: formatNumber(leftSnapshot.tradeCount),
        right: formatNumber(rightSnapshot.tradeCount),
        delta: rightSnapshot.tradeCount - leftSnapshot.tradeCount,
      },
      {
        label: "Parity",
        left: leftSnapshot.parityScore ? `${leftSnapshot.parityScore}/100` : "N/A",
        right: rightSnapshot.parityScore ? `${rightSnapshot.parityScore}/100` : "N/A",
        delta: (rightSnapshot.parityScore || 0) - (leftSnapshot.parityScore || 0),
      },
    ],
    rows: standingRows,
    movers: movers.slice(0, 6),
    rosterDelta: sameSeason ? null : buildManagerRosterDelta(managerLens?.managerKey, leftSnapshot, rightSnapshot),
  };
}

function summarizeSeasonForCompare(snapshot) {
  return {
    season: snapshot.season,
    statusLabel: snapshot.statusLabel,
    isCurrent: snapshot.isCurrent,
    championLabel: snapshot.isCurrent
      ? snapshot.regularLeader?.managerName || "TBD"
      : snapshot.champion?.managerName || "TBD",
    championDetail: snapshot.isCurrent ? "current leader" : "champion",
  };
}

function getComparableRank(record) {
  if (!record) return null;
  if (record.isCurrent && Number.isFinite(record.powerRank)) return record.powerRank;
  if (Number.isFinite(record.finishRank)) return record.finishRank;
  if (Number.isFinite(record.regularRank)) return record.regularRank;
  return null;
}

function formatSeasonRecord(record) {
  if (!record) return "—";
  const ties = record.ties ? `-${record.ties}` : "";
  return `${record.wins}-${record.losses}${ties}`;
}

function buildManagerRosterDelta(managerKey, leftSnapshot, rightSnapshot) {
  if (!managerKey || !leftSnapshot || !rightSnapshot) return null;
  const leftStanding = leftSnapshot.standings.find((row) => row.managerKey === managerKey);
  const rightStanding = rightSnapshot.standings.find((row) => row.managerKey === managerKey);
  if (!leftStanding && !rightStanding) return null;

  const leftIds = new Set((leftStanding?.roster?.players || []).map((playerId) => String(playerId)));
  const rightIds = new Set((rightStanding?.roster?.players || []).map((playerId) => String(playerId)));
  const kept = [...rightIds].filter((playerId) => leftIds.has(playerId)).map(buildComparePlayerChip);
  const added = [...rightIds].filter((playerId) => !leftIds.has(playerId)).map(buildComparePlayerChip);
  const lost = [...leftIds].filter((playerId) => !rightIds.has(playerId)).map(buildComparePlayerChip);
  const sortChips = (chips) => chips.sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));

  return {
    managerName: rightStanding?.managerName || leftStanding?.managerName || "Selected manager",
    leftSeason: leftSnapshot.season,
    rightSeason: rightSnapshot.season,
    kept: sortChips(kept).slice(0, HISTORY_COMPARE_ROSTER_LIMIT),
    added: sortChips(added).slice(0, HISTORY_COMPARE_ROSTER_LIMIT),
    lost: sortChips(lost).slice(0, HISTORY_COMPARE_ROSTER_LIMIT),
    keptCount: kept.length,
    addedCount: added.length,
    lostCount: lost.length,
  };
}

function buildComparePlayerChip(playerId) {
  const player = state.players?.[playerId] || {};
  const name = `${(player.first_name || "").trim()} ${(player.last_name || "").trim()}`.trim()
    || player.full_name
    || `Player ${playerId}`;
  const assetId = `player:${playerId}`;
  const value = Number(getAssetValue({
    assetId,
    assetType: "player",
    name,
    raw: player,
  }));
  return {
    playerId,
    name,
    value: Number.isFinite(value) ? value : 0,
    valueLabel: Number.isFinite(value) ? formatNumber(value) : "—",
  };
}

function buildManagerComparison(leftManager, rightManager, seasonSnapshots, archiveTrades) {
  if (!leftManager || !rightManager) {
    return { available: false, sameManager: false };
  }

  const sameManager = leftManager.managerKey === rightManager.managerKey;
  const seasons = (seasonSnapshots || []).map((snapshot) => String(snapshot.season));
  const h2h = sameManager ? null : buildHeadToHeadComparison(leftManager, rightManager);
  const tradePair = sameManager
    ? null
    : (archiveTrades?.pairLeaders || []).find((pair) => {
        const keys = new Set(pair.managerKeys || []);
        return keys.has(leftManager.managerKey) && keys.has(rightManager.managerKey);
      }) || null;

  return {
    available: true,
    sameManager,
    left: summarizeManagerForCompare(leftManager),
    right: summarizeManagerForCompare(rightManager),
    seasons,
    yearRows: seasons.map((season) => ({
      season,
      left: buildManagerSeasonChip(leftManager, season),
      right: buildManagerSeasonChip(rightManager, season),
    })),
    h2h,
    tradePair,
  };
}

function summarizeManagerForCompare(row) {
  return {
    managerKey: row.managerKey,
    managerName: row.managerName,
    titles: row.titles,
    runnerUps: row.runnerUps,
    podiums: row.podiums,
    recordLabel: formatManagerRecord(row),
    avgFinishLabel: row.avgFinish ? row.avgFinish.toFixed(1) : "—",
    bestFinishLabel: row.bestFinish ? ordinal(Math.round(row.bestFinish)) : "—",
    dynastyScore: row.dynastyScore,
    currentScore: row.currentScore,
    currentPowerRank: row.currentPowerRank,
    currentLaneLabel: row.currentLaneLabel || "no current roster",
    selected: row.currentRosterId === state.meRosterId,
  };
}

function buildManagerSeasonChip(row, season) {
  const record = (row.records || []).find((item) => String(item.season) === String(season));
  if (!record) return { label: "—", rank: null, recordLabel: "absent" };
  const rank = getComparableRank(record);
  return {
    label: rank ? ordinal(rank) : "—",
    rank,
    recordLabel: formatSeasonRecord(record),
    isCurrent: Boolean(record.isCurrent),
  };
}

function buildHeadToHeadComparison(leftManager, rightManager) {
  const games = state.historyMatchups
    .map((matchup) => normalizeMatchupSides(matchup, leftManager.managerKey, rightManager.managerKey))
    .filter(Boolean)
    .sort((a, b) => Number(b.season) - Number(a.season) || b.week - a.week);

  const wins = games.filter((game) => game.leftPoints > game.rightPoints).length;
  const losses = games.filter((game) => game.leftPoints < game.rightPoints).length;
  const ties = games.filter((game) => game.leftPoints === game.rightPoints).length;
  const playoffGames = games.filter((game) => game.isPlayoff);
  const leftPoints = games.reduce((sum, game) => sum + game.leftPoints, 0);
  const rightPoints = games.reduce((sum, game) => sum + game.rightPoints, 0);
  const latest = games[0] || null;

  return {
    loaded: state.historyMatchupsLoaded,
    failed: state.historyMatchupsFailed,
    gameCount: games.length,
    wins,
    losses,
    ties,
    recordLabel: ties ? `${wins}-${losses}-${ties}` : `${wins}-${losses}`,
    playoffCount: playoffGames.length,
    playoffRecordLabel: playoffGames.length
      ? `${playoffGames.filter((game) => game.leftPoints > game.rightPoints).length}-${playoffGames.filter((game) => game.leftPoints < game.rightPoints).length}`
      : "none",
    leftPoints: Math.round(leftPoints),
    rightPoints: Math.round(rightPoints),
    latest: latest
      ? {
          label: `${latest.season} Wk ${latest.week}${latest.isPlayoff ? " playoff" : ""}`,
          score: `${formatNumber(latest.leftPoints)}-${formatNumber(latest.rightPoints)}`,
          winner: latest.leftPoints === latest.rightPoints
            ? "Tie"
            : latest.leftPoints > latest.rightPoints
              ? leftManager.managerName
              : rightManager.managerName,
        }
      : null,
    recent: games.slice(0, HISTORY_COMPARE_H2H_LIMIT),
  };
}

function normalizeMatchupSides(matchup, leftManagerKey, rightManagerKey) {
  const participants = [matchup.left, matchup.right];
  const left = participants.find((side) => side.managerKey === leftManagerKey);
  const right = participants.find((side) => side.managerKey === rightManagerKey);
  if (!left || !right) return null;
  return {
    season: matchup.season,
    week: matchup.week,
    isPlayoff: Boolean(matchup.isPlayoff),
    leftPoints: Number(left.points || 0),
    rightPoints: Number(right.points || 0),
  };
}

function buildMatchupSyncLabel() {
  const archiveSeasonCount = Math.max(1, state.leagueHistory.length);
  if (!state.historyMatchupsLoaded) {
    return `matchups syncing ${state.historyMatchupLeaguesLoaded}/${Math.min(archiveSeasonCount, HISTORY_MATCHUP_SEASON_LIMIT)}`;
  }
  if (state.historyMatchupsFailed) return state.historyMatchupLoadError || "matchups unavailable";
  return `${state.historyMatchupLeaguesLoaded} season${state.historyMatchupLeaguesLoaded === 1 ? "" : "s"} of matchups`;
}

function renderHistoryComparisonPanel(history) {
  const comparison = history.comparison;
  if (!comparison) return "";
  const isManagers = comparison.mode === "managers";
  return `
    <section class="analytics-panel analytics-panel-wide history-compare-panel">
      <div class="analytics-panel-heading">
        <h3>History Comparisons</h3>
        <span>${escapeHtml(comparison.matchupSyncLabel)}</span>
      </div>
      <div class="history-compare-toolbar">
        <div class="history-compare-mode-tabs" role="tablist" aria-label="Comparison mode">
          <button type="button" data-history-compare-mode="seasons" class="${isManagers ? "" : "active"}" aria-pressed="${isManagers ? "false" : "true"}">Seasons</button>
          <button type="button" data-history-compare-mode="managers" class="${isManagers ? "active" : ""}" aria-pressed="${isManagers ? "true" : "false"}">Managers</button>
        </div>
        <div class="history-compare-selects">
          ${isManagers
            ? renderHistoryCompareSelect("leftManagerKey", "Left manager", comparison.managerOptions, comparison.leftManagerKey)
              + `<span class="history-compare-vs">vs</span>`
              + renderHistoryCompareSelect("rightManagerKey", "Right manager", comparison.managerOptions, comparison.rightManagerKey)
            : renderHistoryCompareSelect("leftSeason", "Left season", comparison.seasonOptions, comparison.leftSeason)
              + `<span class="history-compare-vs">vs</span>`
              + renderHistoryCompareSelect("rightSeason", "Right season", comparison.seasonOptions, comparison.rightSeason)}
        </div>
      </div>
      ${isManagers ? renderManagerComparisonBody(comparison.managerCompare) : renderSeasonComparisonBody(comparison.seasonCompare)}
    </section>
  `;
}

function renderHistoryCompareSelect(field, label, options, selected) {
  return `
    <label class="history-compare-select">
      <span>${escapeHtml(label)}</span>
      <select data-history-compare-field="${escapeHtml(field)}">
        ${options.map((option) => `
          <option value="${escapeHtml(option.value)}" ${option.value === selected ? "selected" : ""}>${escapeHtml(option.label)}</option>
        `).join("")}
      </select>
    </label>
  `;
}

function renderSeasonComparisonBody(seasonCompare) {
  if (!seasonCompare?.available) {
    return `<p class="muted small analytics-empty">Need at least one archived or current season to compare.</p>`;
  }
  if (seasonCompare.sameSeason) {
    return `<p class="muted small analytics-empty">Pick two different seasons to see finish, scoring, and roster movement.</p>`;
  }

  return `
    <div class="compare-side-grid">
      ${renderCompareSeasonCard(seasonCompare.left, "left")}
      ${renderCompareSeasonCard(seasonCompare.right, "right")}
    </div>
    <div class="compare-metric-list">
      ${seasonCompare.metrics.map(renderCompareMetricRow).join("")}
    </div>
    ${seasonCompare.movers.length ? `
      <div class="compare-mover-row">
        ${seasonCompare.movers.map(renderCompareMoverChip).join("")}
      </div>
    ` : ""}
    <div class="finish-matrix-shell">
      <div class="compare-standings">
        <div class="compare-standings-head">Manager</div>
        <div class="compare-standings-head">${escapeHtml(seasonCompare.left.season)}</div>
        <div class="compare-standings-head">Delta</div>
        <div class="compare-standings-head">${escapeHtml(seasonCompare.right.season)}</div>
        ${seasonCompare.rows.map(renderSeasonCompareRow).join("")}
      </div>
    </div>
    ${seasonCompare.rosterDelta ? renderRosterDeltaPanel(seasonCompare.rosterDelta) : ""}
  `;
}

function renderCompareSeasonCard(side, tone) {
  return `
    <section class="compare-season-card ${tone}">
      <span>${escapeHtml(side.statusLabel)}</span>
      <strong>${escapeHtml(side.season)}</strong>
      <small>${escapeHtml(side.championLabel)} · ${escapeHtml(side.championDetail)}</small>
    </section>
  `;
}

function renderCompareMetricRow(metric) {
  const deltaLabel = Number.isFinite(metric.delta) ? formatSignedNumber(Math.round(metric.delta)) : "—";
  const tone = Number.isFinite(metric.delta) ? (metric.delta > 0 ? "up" : metric.delta < 0 ? "down" : "flat") : "flat";
  return `
    <div class="compare-metric-row">
      <span>${escapeHtml(metric.label)}</span>
      <strong>${escapeHtml(String(metric.left))}</strong>
      <em class="compare-delta ${tone}">${escapeHtml(deltaLabel)}</em>
      <strong>${escapeHtml(String(metric.right))}</strong>
    </div>
  `;
}

function renderCompareMoverChip(row) {
  const climbed = row.rankDelta > 0;
  return `
    <div class="compare-mover-chip ${climbed ? "up" : "down"}">
      <strong>${escapeHtml(row.managerName)}</strong>
      <span>${climbed ? "climbed" : "dropped"} ${Math.abs(row.rankDelta)} ${Math.abs(row.rankDelta) === 1 ? "spot" : "spots"}</span>
    </div>
  `;
}

function renderSeasonCompareRow(row) {
  return `
    <div class="compare-standings-name ${row.selected ? "selected" : ""}">
      <strong>${escapeHtml(row.managerName)}</strong>
      <span>${escapeHtml(row.leftRecord)} → ${escapeHtml(row.rightRecord)}</span>
    </div>
    <div class="finish-cell ${compareRankClass(row.leftRank, false)}">${escapeHtml(row.leftRank ? String(row.leftRank) : "—")}</div>
    <div class="finish-cell ${compareDeltaClass(row.rankDelta)}">${escapeHtml(formatRankDelta(row.rankDelta))}</div>
    <div class="finish-cell ${compareRankClass(row.rightRank, true)}">${escapeHtml(row.rightRank ? String(row.rightRank) : "—")}</div>
  `;
}

function compareRankClass(rank, isCurrentSide) {
  if (!Number.isFinite(rank)) return "empty";
  if (rank === 1) return "title";
  if (rank <= 3) return "podium";
  if (rank >= 9) return "bottom";
  return isCurrentSide ? "current" : "middle";
}

function compareDeltaClass(delta) {
  if (!Number.isFinite(delta) || delta === 0) return "middle";
  return delta > 0 ? "podium" : "bottom";
}

function formatRankDelta(delta) {
  if (!Number.isFinite(delta)) return "—";
  if (delta === 0) return "same";
  return delta > 0 ? `↑ ${delta}` : `↓ ${Math.abs(delta)}`;
}

function renderRosterDeltaPanel(delta) {
  return `
    <section class="roster-delta-panel">
      <div class="analytics-panel-heading">
        <h3>${escapeHtml(delta.managerName)} roster shift</h3>
        <span>${escapeHtml(delta.leftSeason)} → ${escapeHtml(delta.rightSeason)}</span>
      </div>
      <div class="roster-delta-grid">
        ${renderRosterDeltaColumn("Kept", delta.keptCount, delta.kept, "kept")}
        ${renderRosterDeltaColumn("Added", delta.addedCount, delta.added, "added")}
        ${renderRosterDeltaColumn("Lost", delta.lostCount, delta.lost, "lost")}
      </div>
    </section>
  `;
}

function renderRosterDeltaColumn(label, count, chips, tone) {
  return `
    <div class="roster-delta-col ${tone}">
      <div>
        <span>${escapeHtml(label)}</span>
        <strong>${count}</strong>
      </div>
      ${chips.length
        ? chips.map((chip) => `
            <div class="roster-delta-chip">
              <strong>${escapeHtml(chip.name)}</strong>
              <span>${escapeHtml(chip.valueLabel)}</span>
            </div>
          `).join("")
        : `<p class="muted small analytics-empty">None</p>`}
    </div>
  `;
}

function renderManagerComparisonBody(managerCompare) {
  if (!managerCompare?.available) {
    return `<p class="muted small analytics-empty">Need two managers in the archive to compare.</p>`;
  }
  if (managerCompare.sameManager) {
    return `<p class="muted small analytics-empty">Pick two different managers to compare titles, finishes, and head-to-head.</p>`;
  }

  const { left, right, h2h, tradePair } = managerCompare;
  return `
    <div class="compare-side-grid">
      ${renderCompareManagerCard(left, "left")}
      ${renderCompareManagerCard(right, "right")}
    </div>
    <div class="compare-metric-list">
      ${renderCompareMetricRow({ label: "Titles", left: String(left.titles), right: String(right.titles), delta: right.titles - left.titles })}
      ${renderCompareMetricRow({ label: "Podiums", left: String(left.podiums), right: String(right.podiums), delta: right.podiums - left.podiums })}
      ${renderCompareMetricRow({ label: "Archive record", left: left.recordLabel, right: right.recordLabel })}
      ${renderCompareMetricRow({ label: "Avg finish", left: left.avgFinishLabel, right: right.avgFinishLabel })}
      ${renderCompareMetricRow({ label: "Best finish", left: left.bestFinishLabel, right: right.bestFinishLabel })}
      ${renderCompareMetricRow({ label: "Dynasty score", left: formatNumber(left.dynastyScore), right: formatNumber(right.dynastyScore), delta: right.dynastyScore - left.dynastyScore })}
    </div>
    ${h2h ? renderHeadToHeadPanel(left, right, h2h, tradePair) : ""}
    <div class="finish-matrix-shell">
      <div class="compare-standings manager-year-grid" style="--season-count:${managerCompare.seasons.length}">
        <div class="compare-standings-head">Season</div>
        <div class="compare-standings-head">${escapeHtml(left.managerName)}</div>
        <div class="compare-standings-head">${escapeHtml(right.managerName)}</div>
        ${managerCompare.yearRows.map((row) => `
          <div class="compare-standings-name">
            <strong>${escapeHtml(row.season)}</strong>
          </div>
          <div class="finish-cell ${compareRankClass(row.left.rank, row.left.isCurrent)}" title="${escapeHtml(row.left.recordLabel)}">${escapeHtml(row.left.label)}</div>
          <div class="finish-cell ${compareRankClass(row.right.rank, row.right.isCurrent)}" title="${escapeHtml(row.right.recordLabel)}">${escapeHtml(row.right.label)}</div>
        `).join("")}
      </div>
    </div>
  `;
}

function renderCompareManagerCard(side, tone) {
  const powerLabel = side.currentPowerRank
    ? `${ordinal(side.currentPowerRank)} power · ${side.currentScore}/100`
    : "no current power score";
  return `
    <section class="compare-season-card ${tone} ${side.selected ? "selected" : ""}">
      <span>${escapeHtml(side.currentLaneLabel)}</span>
      <strong>${escapeHtml(side.managerName)}</strong>
      <small>${escapeHtml(powerLabel)}</small>
    </section>
  `;
}

function renderHeadToHeadPanel(left, right, h2h, tradePair) {
  if (!h2h.loaded) {
    return `<p class="muted small analytics-empty">Head-to-head still syncing from Sleeper matchups.</p>`;
  }
  if (h2h.failed && h2h.gameCount === 0) {
    return `<p class="muted small analytics-empty">Could not load matchup history for these two managers.</p>`;
  }
  if (h2h.gameCount === 0) {
    return `<p class="muted small analytics-empty">No completed head-to-head games in the loaded matchup archive yet.</p>`;
  }

  return `
    <div class="h2h-board">
      <div class="h2h-score">
        <span>${escapeHtml(left.managerName)}</span>
        <strong>${escapeHtml(h2h.recordLabel)}</strong>
        <span>${escapeHtml(right.managerName)}</span>
      </div>
      <div class="h2h-meta">
        <span>${h2h.gameCount} game${h2h.gameCount === 1 ? "" : "s"}</span>
        <span>${formatNumber(h2h.leftPoints)}-${formatNumber(h2h.rightPoints)} combined PF</span>
        <span>Playoffs ${escapeHtml(h2h.playoffRecordLabel)}</span>
        ${h2h.latest ? `<span>Last: ${escapeHtml(h2h.latest.label)} ${escapeHtml(h2h.latest.score)} (${escapeHtml(h2h.latest.winner)})</span>` : ""}
        ${tradePair ? `<span>${tradePair.count} archive trade${tradePair.count === 1 ? "" : "s"}</span>` : ""}
      </div>
      <div class="h2h-recent">
        ${h2h.recent.map((game) => `
          <div class="mini-season-chip ${game.leftPoints > game.rightPoints ? "current" : ""}">
            <strong>${escapeHtml(`${game.season} Wk ${game.week}${game.isPlayoff ? " P" : ""}`)}</strong>
            <span>${escapeHtml(`${formatNumber(game.leftPoints)}-${formatNumber(game.rightPoints)}`)}</span>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function renderSeasonArchivePanel(history) {
  return `
    <section class="analytics-panel analytics-panel-wide">
      <div class="analytics-panel-heading">
        <h3>Season Archive</h3>
        <span>${escapeHtml(history.seasonRange)}</span>
      </div>
      <div class="season-ledger">
        ${history.seasonSnapshots.map((snapshot) => renderSeasonLedgerCard(snapshot)).join("")}
      </div>
    </section>
  `;
}

function renderSeasonLedgerCard(snapshot) {
  const crown = snapshot.isCurrent
    ? snapshot.regularLeader
    : snapshot.champion || snapshot.regularLeader;
  const crownLabel = snapshot.isCurrent ? "Standings Leader" : "Champion";
  const pointsLeader = snapshot.pointsLeader?.managerName || "TBD";
  const recordLeader = snapshot.regularLeader
    ? `${snapshot.regularLeader.wins}-${snapshot.regularLeader.losses}${snapshot.regularLeader.ties ? `-${snapshot.regularLeader.ties}` : ""}`
    : "0-0";
  return `
    <section class="season-card ${snapshot.isCurrent ? "current" : ""}">
      <div class="season-card-title">
        <strong>${escapeHtml(snapshot.season)}</strong>
        <span>${escapeHtml(snapshot.statusLabel)}</span>
      </div>
      ${renderSeasonStat(crownLabel, crown?.managerName || "TBD", snapshot.runnerUp ? `beat ${snapshot.runnerUp.managerName}` : `${recordLeader} top record`)}
      ${renderSeasonStat("Points King", pointsLeader, `${formatNumber(snapshot.pointsLeader?.points || 0)} PF`)}
      ${renderSeasonStat("Scoring Gap", formatNumber(snapshot.scoringSpread), `${snapshot.parityScore || "N/A"} parity score`)}
      ${renderSeasonStat("Trade Ledger", formatNumber(snapshot.tradeCount), `${formatNumber(snapshot.movedAssetCount)} assets moved`)}
      ${renderSeasonStat("Pick Drift", formatNumber(snapshot.tradedPickCount), "traded pick records")}
    </section>
  `;
}

function renderSeasonStat(label, value, detail) {
  return `
    <div class="season-stat">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(String(value))}</strong>
      <small>${escapeHtml(detail || "")}</small>
    </div>
  `;
}

function renderHallBoard(history) {
  const hall = buildHallRows(history.dynastyRows || []);
  if (hall.length === 0) return "";
  const meRoster = getMyRoster();
  const meKey = meRoster ? rosterManagerKey(meRoster) : "";
  return `
    <section class="workspace-panel hall-board">
      <div class="panel-heading">
        <div>
          <span class="eyebrow">All-time hall</span>
          <h3>Titles, career W-L, playoff trips</h3>
        </div>
        <p class="section-copy">Who has the rings. Career W-L is the rest of the story.</p>
      </div>
      <div class="hall-table">
        <div class="hall-head">
          <span>#</span><span>Mgr</span><span>Titles</span><span>W-L</span><span>PO</span>
        </div>
        ${hall.map((row, index) => `
          <div class="hall-row ${row.managerKey === meKey ? "you" : ""}">
            <span>${index + 1}</span>
            <strong>${escapeHtml(row.managerName)}</strong>
            <span>${row.titles}</span>
            <span>${escapeHtml(row.recordLabel)}</span>
            <span>${row.playoffApps}</span>
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

function renderTradeAwardCard(title, blurb, side, tone = "") {
  if (!side) return "";
  return `
    <button type="button" class="trade-award ${tone}" data-action="open-trade" data-trade-id="${escapeHtml(side.id)}" data-manager-key="${escapeHtml(side.managerKey)}">
      <span>${escapeHtml(title)}</span>
      <strong>${escapeHtml(side.managerName)}</strong>
      <small>${escapeHtml(side.season)} W${side.week || "?"} vs ${escapeHtml(side.partnerName)}</small>
      <em>Since ${escapeHtml(side.since.games ? side.since.label : "no games yet")} · now ${formatSignedNumber(Math.round(side.delta))}${side.laterFinishes?.length ? ` · later ${escapeHtml(side.laterFinishes.map((row) => `${row.season} ${row.label}`).join(", "))}` : ""}</em>
      <p>${escapeHtml(blurb)}</p>
    </button>
  `;
}

function renderTradeWireBoard() {
  const awards = pickLeagueTradeAwards(leagueTradeSides());
  if (!awards.fleece && !awards.heater) return "";
  return `
    <section class="workspace-panel trade-wire" id="league-wire">
      <div class="panel-heading">
        <div>
          <span class="eyebrow">Trade wire</span>
          <h3>Hottest since and biggest fleece</h3>
        </div>
        <p class="section-copy">Hottest since is the Bayesian-shrunk record after the deal, with a Wilson floor so 2-0 cannot beat a real sample. Fleece is log-ratio plus package lopsidedness plus the star that moved — not a raw KTC dump.</p>
      </div>
      <div class="trade-wire-grid">
        ${renderTradeAwardCard("Hottest since", "Best shrunk record after the deal. Wilson sample required.", awards.heater, "won")}
        ${renderTradeAwardCard("Biggest fleece", "Log-ratio steal on today's board, even if games have not posted yet.", awards.fleece, "won")}
      </div>
    </section>
  `;
}

function renderManagerLensPanel(managerLens) {
  return `
    <section class="analytics-panel analytics-panel-wide manager-lens-panel">
      <div class="analytics-panel-heading">
        <h3>Manager in the archive</h3>
        <span>${escapeHtml(managerLens.currentLaneLabel)}</span>
      </div>
      <div class="manager-lens-hero">
        <div>
          <span class="analytics-kicker">${escapeHtml(managerLens.managerName)}</span>
          <strong>${escapeHtml(managerLens.headline)}</strong>
          <p>${escapeHtml(managerLens.nextChapter)}</p>
        </div>
        <div class="manager-score">
          <span>Now</span>
          <strong>${managerLens.currentScore}</strong>
          <small>${escapeHtml(managerLens.currentPowerLabel)}</small>
        </div>
      </div>
      <div class="manager-lens-grid">
        ${renderManagerLensStat("Best Finish", managerLens.bestFinishLabel)}
        ${renderManagerLensStat("Average", managerLens.avgFinishLabel)}
        ${renderManagerLensStat("Record", managerLens.recordLabel)}
        ${renderManagerLensStat("Trades", managerLens.tradeLabel)}
      </div>
      <div class="mini-season-list">
        ${managerLens.records.length
          ? managerLens.records.map(renderManagerSeasonChip).join("")
          : `<p class="muted small analytics-empty">No archive rows found for this manager.</p>`}
      </div>
    </section>
  `;
}

function renderManagerLensStat(label, value) {
  return `
    <section class="manager-lens-stat">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(String(value))}</strong>
    </section>
  `;
}

function renderManagerSeasonChip(record) {
  const rankLabel = record.isCurrent && record.powerRank
    ? `${ordinal(record.powerRank)} power`
    : record.finishRank
      ? `${ordinal(record.finishRank)} finish`
      : "unranked";
  return `
    <div class="mini-season-chip ${record.isCurrent ? "current" : ""}">
      <strong>${escapeHtml(record.season)}</strong>
      <span>${escapeHtml(rankLabel)}</span>
    </div>
  `;
}

function renderFinishMatrixPanel(history) {
  if (history.seasonSnapshots.length === 0) return "";
  const seasons = history.seasonSnapshots.map((snapshot) => snapshot.season);
  return `
    <section class="analytics-panel analytics-panel-wide">
      <div class="analytics-panel-heading">
        <h3>Finish Matrix</h3>
        <span>rank by season</span>
      </div>
      <div class="finish-matrix-shell">
        <div class="finish-matrix" style="--season-count:${seasons.length}">
          <div class="finish-matrix-head">Manager</div>
          ${seasons.map((season) => `<div class="finish-matrix-head">${escapeHtml(season)}</div>`).join("")}
          ${history.finishMatrixRows.map((row) => renderFinishMatrixRow(row, seasons)).join("")}
        </div>
      </div>
    </section>
  `;
}

function renderFinishMatrixRow(row, seasons) {
  const recordsBySeason = new Map(row.records.map((record) => [String(record.season), record]));
  return `
    <div class="finish-matrix-name ${row.currentRosterId === state.meRosterId ? "selected" : ""}">
      <strong>${escapeHtml(row.managerName)}</strong>
      <span>${row.titles}T / ${row.podiums}P</span>
    </div>
    ${seasons.map((season) => renderFinishMatrixCell(recordsBySeason.get(String(season)))).join("")}
  `;
}

function renderFinishMatrixCell(record) {
  if (!record) return `<div class="finish-cell empty">-</div>`;
  const rank = record.isCurrent && record.powerRank ? record.powerRank : record.finishRank;
  const label = record.isCurrent && record.powerRank
    ? `P${record.powerRank}`
    : rank ? String(rank) : "-";
  const className = record.isCurrent
    ? "current"
    : rank === 1
      ? "title"
      : rank && rank <= 3
        ? "podium"
        : rank && rank >= 9
          ? "bottom"
          : "middle";
  return `<div class="finish-cell ${className}" title="${escapeHtml(record.season)}">${escapeHtml(label)}</div>`;
}

function renderRivalryLedgerPanel(history) {
  return `
    <section class="analytics-panel">
      <div class="analytics-panel-heading">
        <h3>Rivalry Ledger</h3>
        <span>${formatNumber(history.archiveTrades.tradeCount)} trades</span>
      </div>
      <div class="analytics-list">
        ${history.archiveTrades.pairLeaders.length
          ? history.archiveTrades.pairLeaders.slice(0, 6).map(renderArchivePairRow).join("")
          : `<p class="muted small analytics-empty">No recurring trade roads in the loaded archive yet.</p>`}
      </div>
    </section>
  `;
}

function renderArchivePairRow(pair) {
  const seasonLabel = pair.seasons.length ? pair.seasons.join(", ") : "archive";
  return `
    <div class="analytics-row archive-pair-row">
      <div>
        <strong>${escapeHtml(pair.managerNames.join(" / "))}</strong>
        <span>${escapeHtml(seasonLabel)} | ${formatNumber(pair.valueMoved)} value moved</span>
      </div>
      <div class="row-meter" aria-hidden="true"><span style="width:${clamp(pair.count * 16, 10, 100)}%"></span></div>
      <em>${pair.count}</em>
    </div>
  `;
}

function renderLeagueStoryPanel(history) {
  return `
    <section class="analytics-panel">
      <div class="analytics-panel-heading">
        <h3>League Eras</h3>
        <span>${history.storylines.length} reads</span>
      </div>
      <div class="storyline-list">
        ${history.storylines.map((story) => `
          <section class="storyline-card ${story.tone || ""}">
            <strong>${escapeHtml(story.title)}</strong>
            <span>${escapeHtml(story.body)}</span>
          </section>
        `).join("")}
      </div>
    </section>
  `;
}

function buildArchiveRecentTradeSummary(transaction) {
  const sourceLeagueId = String(transaction?.sourceLeagueId || state.leagueId || "");
  const participantIds = getTransactionParticipantIds(transaction);
  const participantNames = participantIds.map((rosterId) => getHistoryRosterInfo(sourceLeagueId, rosterId)?.managerName || getRosterManagerName(rosterId));
  const movements = buildTradeMovements(transaction);
  const byRecipient = new Map();
  movements.forEach((movement) => {
    if (!byRecipient.has(movement.toRosterId)) byRecipient.set(movement.toRosterId, []);
    byRecipient.get(movement.toRosterId).push(movement);
  });
  const preview = participantIds
    .map((rosterId) => {
      const assets = byRecipient.get(rosterId) || [];
      const names = assets.slice(0, 3).map((asset) => asset.name);
      const suffix = assets.length > 3 ? ` +${assets.length - 3}` : "";
      const managerName = getHistoryRosterInfo(sourceLeagueId, rosterId)?.managerName || getRosterManagerName(rosterId);
      return `${managerName} got ${names.length ? names.join(", ") + suffix : "value"}`;
    })
    .join(" | ");
  const season = transaction?.sourceSeason ? `${transaction.sourceSeason} ` : "";
  const date = formatTransactionDate(transaction.status_updated || transaction.created);
  return {
    title: participantNames.join(" / "),
    subtitle: `${season}${date} | ${movements.length} asset${movements.length === 1 ? "" : "s"} moved`,
    preview: preview || "Trade details unavailable from Sleeper payload.",
  };
}

function buildArchiveSyncLabel() {
  const currentLabel = state.transactionsLoaded
    ? state.transactionsFailed
      ? "current trades unavailable"
      : `${state.transactionWeeksLoaded} current weeks`
    : "current trades syncing";
  const archiveSeasonCount = Math.max(0, state.leagueHistory.length - 1);
  if (archiveSeasonCount === 0) return currentLabel;
  const historyLabel = state.historyTransactionsLoaded
    ? state.historyTransactionsFailed
      ? "archive trades unavailable"
      : `${state.historyTransactionLeaguesLoaded}/${Math.min(archiveSeasonCount, HISTORY_TRANSACTION_SEASON_LIMIT)} archive seasons`
    : "archive trades syncing";
  return `${currentLabel}; ${historyLabel}`;
}

function formatSeasonRange(snapshots) {
  const seasons = snapshots
    .map((snapshot) => Number(snapshot.season))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  if (seasons.length === 0) return "Current season";
  if (seasons.length === 1) return String(seasons[0]);
  return `${seasons[0]}-${seasons[seasons.length - 1]}`;
}

function getHistoryEntryByLeagueId(leagueId) {
  const key = String(leagueId || "");
  return state.leagueHistory.find((entry) => String(entry.leagueId) === key) || null;
}

function getHistoryRosterInfo(leagueId, rosterId) {
  const rosterKey = normalizeRosterIdKey(rosterId);
  if (!rosterKey) return null;
  const entry = getHistoryEntryByLeagueId(leagueId) || (String(leagueId || "") === String(state.leagueId) ? state.leagueHistory.find((item) => item.isCurrent) : null);
  const source = entry || {
    leagueId: state.leagueId,
    users: state.users,
    rosters: state.rosters,
  };
  const roster = (source.rosters || []).find((item) => normalizeRosterIdKey(item?.roster_id) === rosterKey);
  const identity = resolveRosterIdentity(getFranchiseIndex(), {
    userId: ownerIdFromRoster(roster),
    leagueId: source.leagueId || leagueId,
    rosterId: rosterKey,
  });
  if (identity.userId) {
    return {
      rosterId: rosterKey,
      userId: identity.userId,
      managerKey: identity.managerKey,
      managerName: identity.managerName,
    };
  }
  if (!roster) {
    const currentRoster = state.normalizedRosters.find((item) => normalizeRosterIdKey(item.rosterId) === rosterKey);
    if (currentRoster) {
      return {
        rosterId: rosterKey,
        userId: currentRoster.manager.userId,
        managerKey: buildManagerKey(currentRoster.manager.userId, state.leagueId, rosterKey),
        managerName: currentRoster.manager.displayName,
      };
    }
  }
  return {
    rosterId: rosterKey,
    userId: identity.userId,
    managerKey: identity.managerKey,
    managerName: identity.managerName,
  };
}

function franchiseCacheKey() {
  return [
    state.leagueId,
    (state.rosters || []).map((roster) => `${roster.roster_id}:${roster.owner_id}`).join(","),
    (state.leagueHistory || []).map((entry) => (
      `${entry.leagueId}:${(entry.rosters || []).map((roster) => `${roster.roster_id}:${roster.owner_id}`).join("-")}`
    )).join("|"),
  ].join("::");
}

function getFranchiseIndex() {
  const key = franchiseCacheKey();
  if (franchiseIndexCache.key === key && franchiseIndexCache.index) return franchiseIndexCache.index;
  const users = [
    ...(state.users || []),
    ...(state.leagueHistory || []).flatMap((entry) => entry.users || []),
  ];
  const index = buildFranchiseIndex({
    currentRosters: state.rosters,
    historyEntries: state.leagueHistory,
    users,
    currentLeagueId: state.leagueId,
  });
  franchiseIndexCache = { key, index };
  return index;
}

function getRosterTakeover(rosterId) {
  return takeoverForRoster(getFranchiseIndex().takeovers, rosterId);
}

function buildManagerKey(userId, leagueId, rosterId) {
  return resolveRosterIdentity(getFranchiseIndex(), { userId, leagueId, rosterId }).managerKey;
}

function extractRosterDecimalStat(roster, wholeKey, decimalKey) {
  const settings = roster?.settings || {};
  const whole = Number(settings[wholeKey] || 0);
  const decimal = Number(settings[decimalKey] || 0);
  if (!Number.isFinite(whole) && !Number.isFinite(decimal)) return 0;
  return (Number.isFinite(whole) ? whole : 0) + (Number.isFinite(decimal) ? decimal : 0) / 100;
}

function calculateRankVolatility(ranks) {
  const numericRanks = ranks.filter(Number.isFinite);
  if (numericRanks.length <= 1) return 0;
  const avg = average(numericRanks);
  const variance = average(numericRanks.map((rank) => (rank - avg) ** 2));
  return Math.sqrt(variance);
}

function average(values) {
  const numericValues = values.filter(Number.isFinite);
  if (numericValues.length === 0) return 0;
  return numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length;
}

function formatManagerRecord(row) {
  if (!row) return "0-0";
  const ties = row.totalTies ? `-${row.totalTies}` : "";
  return `${row.totalWins}-${row.totalLosses}${ties}`;
}

function renderAnalyticsMetric(label, value, detail, tone = "") {
  return `
    <section class="analytics-metric ${tone}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(String(value))}</strong>
      <small>${escapeHtml(detail || "")}</small>
    </section>
  `;
}

function renderRecentTrade(trade) {
  return `
    <section class="recent-trade">
      <div>
        <strong>${escapeHtml(trade.title)}</strong>
        <span>${escapeHtml(trade.subtitle)}</span>
      </div>
      <p>${escapeHtml(trade.preview)}</p>
    </section>
  `;
}

function renderAssetMarketPanel(market) {
  return `
    <section class="analytics-panel">
      <div class="analytics-panel-heading">
        <h3>Asset Market</h3>
        <span>${formatNumber(market.totalMovedValue)} value moved</span>
      </div>
      <div class="analytics-list">
        ${market.assetLeaders.length > 0
          ? market.assetLeaders.slice(0, ANALYTICS_ASSET_LEADER_LIMIT).map((asset) => renderAssetMarketRow(asset, market.topMovedAssetCount)).join("")
          : `<p class="muted small analytics-empty">No traded assets to rank yet.</p>`}
      </div>
      <div class="manager-heat-list">
        ${market.managerLeaderboard.slice(0, 5).map((manager) => renderManagerHeatRow(manager, market.maxManagerTradeCount)).join("")}
      </div>
    </section>
  `;
}

function renderAssetMarketRow(asset, maxCount) {
  const width = maxCount > 0 ? clamp(Math.round(asset.count / maxCount * 100), 8, 100) : 8;
  return `
    <div class="analytics-row">
      <div>
        <strong>${escapeHtml(asset.name)}</strong>
        <span>${escapeHtml(asset.typeLabel)} • ${formatNumber(asset.totalValue)} value</span>
      </div>
      <div class="row-meter" aria-hidden="true"><span style="width:${width}%"></span></div>
      <em>${asset.count}</em>
    </div>
  `;
}

function renderManagerHeatRow(manager, maxTrades) {
  const width = maxTrades > 0 ? clamp(Math.round(manager.tradeCount / maxTrades * 100), 8, 100) : 8;
  return `
    <div class="manager-heat-row">
      <strong>${escapeHtml(manager.managerName)}</strong>
      <div class="meter-track" aria-hidden="true"><span style="width:${width}%"></span></div>
      <span>${manager.tradeCount} trades</span>
    </div>
  `;
}

function buildLeagueAnalytics(context, profiles, market) {
  const scores = profiles.map((profile) => profile.score).filter(Number.isFinite);
  const starterValues = context.starterValues.filter(Number.isFinite);
  const pickValues = context.pickValues.filter(Number.isFinite);
  const maxStarter = starterValues.length ? Math.max(...starterValues) : 0;
  const minStarter = starterValues.length ? Math.min(...starterValues) : 0;
  const powerGap = Math.max(0, maxStarter - minStarter);
  const parityScore = maxStarter > 0 ? clamp(Math.round(100 - (powerGap / maxStarter * 100)), 1, 99) : 50;
  const maxPick = pickValues.length ? Math.max(...pickValues) : 0;
  const minPick = pickValues.length ? Math.min(...pickValues) : 0;
  const pickSpread = Math.max(0, maxPick - minPick);
  const pickSpreadScore = maxPick > 0 ? clamp(Math.round(pickSpread / maxPick * 100), 1, 99) : 0;
  const contenderCount = profiles.filter((profile) => ["contender", "fragile-contender", "playoff-hunter"].includes(profile.lane.id)).length;
  const rebuildCount = profiles.filter((profile) => profile.lane.id === "rebuild").length;
  const middleCount = Math.max(0, profiles.length - contenderCount - rebuildCount);
  const topPickProfile = profiles.slice().sort((a, b) => b.assetSummary.pickValue - a.assetSummary.pickValue)[0];
  const youngestProfile = profiles
    .filter((profile) => Number.isFinite(profile.assetSummary.averageAge))
    .sort((a, b) => a.assetSummary.averageAge - b.assetSummary.averageAge)[0];
  const oldestProfile = profiles
    .filter((profile) => Number.isFinite(profile.assetSummary.averageAge))
    .sort((a, b) => b.assetSummary.averageAge - a.assetSummary.averageAge)[0];
  const medianScore = median(scores);

  return {
    contenderCount,
    rebuildCount,
    middleCount,
    parityScore,
    parityLabel: parityScore >= 72 ? "tight race" : parityScore >= 48 ? "tiered league" : "power gap",
    powerGapLabel: `${formatNumber(powerGap)} starter gap from top to bottom`,
    pickSpreadScore,
    pickSpreadLabel: `${formatNumber(pickSpread)} pick-value spread`,
    marketTempoLabel: market.tradeCount >= profiles.length ? "active trade room" : market.tradeCount > 0 ? "selective trade room" : "quiet trade room",
    medianScore,
    managerSpotlights: [
      topPickProfile ? {
        label: "Pick Vault Leader",
        value: `${topPickProfile.managerName} (${formatNumber(topPickProfile.assetSummary.pickValue)})`,
        tone: "gold",
      } : null,
      youngestProfile ? {
        label: "Youngest Core",
        value: `${youngestProfile.managerName} (${youngestProfile.assetSummary.averageAgeLabel})`,
        tone: "green",
      } : null,
      oldestProfile ? {
        label: "Oldest Core",
        value: `${oldestProfile.managerName} (${oldestProfile.assetSummary.averageAgeLabel})`,
        tone: "rose",
      } : null,
      profiles[0] ? {
        label: "Power Leader",
        value: `${profiles[0].managerName} (${profiles[0].score}/100)`,
        tone: "blue",
      } : null,
    ].filter(Boolean),
  };
}

function buildTradeMarketAnalytics(meRoster) {
  const tradeTransactions = state.transactions
    .filter((transaction) => transaction?.type === "trade" && transaction?.status === "complete")
    .sort((a, b) => Number(b.status_updated || b.created || 0) - Number(a.status_updated || a.created || 0));
  const allCompleteTransactions = state.transactions.filter((transaction) => transaction?.status === "complete");
  const meRosterKey = normalizeRosterIdKey(meRoster.rosterId);
  const pairMap = new Map();
  const managerStats = new Map();
  const assetMap = new Map();
  const weeklyMap = new Map();
  let movedAssetCount = 0;
  let pickMovementCount = 0;
  let playerMovementCount = 0;
  let totalMovedValue = 0;
  let multiTeamTradeCount = 0;

  state.normalizedRosters.forEach((roster) => {
    managerStats.set(normalizeRosterIdKey(roster.rosterId), {
      rosterId: roster.rosterId,
      managerName: roster.manager.displayName,
      tradeCount: 0,
      sentAssets: 0,
      receivedAssets: 0,
      sentValue: 0,
      receivedValue: 0,
    });
  });

  tradeTransactions.forEach((transaction) => {
    const participantIds = getTransactionParticipantIds(transaction);
    if (participantIds.length > 2) multiTeamTradeCount += 1;
    const movements = buildTradeMovements(transaction);
    const movedValue = movements.reduce((sum, movement) => sum + movement.value, 0);
    const week = Number(transaction.leg || transaction.week || 0);
    if (!weeklyMap.has(week)) weeklyMap.set(week, { week, count: 0, movedValue: 0 });
    weeklyMap.get(week).count += 1;
    weeklyMap.get(week).movedValue += movedValue;

    participantIds.forEach((rosterId) => {
      const stats = ensureManagerTradeStats(managerStats, rosterId);
      stats.tradeCount += 1;
    });

    for (let i = 0; i < participantIds.length; i++) {
      for (let j = i + 1; j < participantIds.length; j++) {
        const left = participantIds[i];
        const right = participantIds[j];
        const key = buildRosterPairKey(left, right);
        const pairMovements = movements.filter((movement) =>
          buildRosterPairKey(movement.fromRosterId, movement.toRosterId) === key
        );
        if (!pairMap.has(key)) {
          pairMap.set(key, {
            rosterIds: key.split("|"),
            count: 0,
            assetsMoved: 0,
            valueMoved: 0,
          });
        }
        const pair = pairMap.get(key);
        pair.count += 1;
        pair.assetsMoved += pairMovements.length || movements.length;
        pair.valueMoved += pairMovements.length
          ? pairMovements.reduce((sum, movement) => sum + movement.value, 0)
          : movedValue;
      }
    }

    movements.forEach((movement) => {
      movedAssetCount += 1;
      totalMovedValue += movement.value;
      if (movement.assetType === "pick") {
        pickMovementCount += 1;
      } else {
        playerMovementCount += 1;
      }

      const fromStats = ensureManagerTradeStats(managerStats, movement.fromRosterId);
      const toStats = ensureManagerTradeStats(managerStats, movement.toRosterId);
      fromStats.sentAssets += 1;
      fromStats.sentValue += movement.value;
      toStats.receivedAssets += 1;
      toStats.receivedValue += movement.value;

      if (!assetMap.has(movement.assetId)) {
        assetMap.set(movement.assetId, {
          assetId: movement.assetId,
          name: movement.name,
          assetType: movement.assetType,
          typeLabel: movement.assetType === "pick" ? "Pick" : movement.positionLabel || "Player",
          count: 0,
          totalValue: 0,
        });
      }
      const assetEntry = assetMap.get(movement.assetId);
      assetEntry.count += 1;
      assetEntry.totalValue += movement.value;
    });
  });

  const managerLeaderboard = [...managerStats.values()]
    .sort((a, b) => b.tradeCount - a.tradeCount || b.sentValue + b.receivedValue - (a.sentValue + a.receivedValue) || a.managerName.localeCompare(b.managerName));
  const myStats = managerStats.get(meRosterKey) || ensureManagerTradeStats(managerStats, meRosterKey);
  const myTradeRank = managerLeaderboard.findIndex((manager) => String(manager.rosterId) === String(meRoster.rosterId)) + 1;
  const pairLeaders = [...pairMap.values()]
    .map((pair) => ({
      ...pair,
      managerNames: pair.rosterIds.map(getRosterManagerName),
      sharePct: tradeTransactions.length > 0 ? Math.round(pair.count / tradeTransactions.length * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count || b.valueMoved - a.valueMoved || a.managerNames.join("").localeCompare(b.managerNames.join("")));
  const myPartners = pairLeaders
    .filter((pair) => pair.rosterIds.includes(meRosterKey))
    .map((pair) => {
      const otherRosterId = pair.rosterIds.find((rosterId) => rosterId !== meRosterKey);
      return {
        ...pair,
        otherRosterId,
        otherManagerName: getRosterManagerName(otherRosterId),
      };
    });
  const assetLeaders = [...assetMap.values()]
    .sort((a, b) => b.count - a.count || b.totalValue - a.totalValue || a.name.localeCompare(b.name));
  const weeklyTimeline = buildWeeklyTradeTimeline(weeklyMap);
  const maxWeeklyTradeCount = weeklyTimeline.reduce((max, week) => Math.max(max, week.count), 0);
  const maxManagerTradeCount = managerLeaderboard.reduce((max, manager) => Math.max(max, manager.tradeCount), 0);
  const topMovedAssetCount = assetLeaders.reduce((max, asset) => Math.max(max, asset.count), 0);
  const myMarketSharePct = tradeTransactions.length > 0 ? Math.round(myStats.tradeCount / tradeTransactions.length * 100) : 0;
  const chaosScore = calculateMarketChaosScore({
    tradeCount: tradeTransactions.length,
    rosterCount: state.normalizedRosters.length,
    pairCount: pairLeaders.length,
    movedAssetCount,
    multiTeamTradeCount,
    totalTransactions: allCompleteTransactions.length,
  });

  return {
    tradeCount: tradeTransactions.length,
    transactionCount: allCompleteTransactions.length,
    myTradeCount: myStats.tradeCount,
    myTradeRank,
    myTradeRankLabel: myTradeRank > 0 ? `${ordinal(myTradeRank)} of ${managerLeaderboard.length}` : "unranked",
    myMarketSharePct,
    favoritePartner: myPartners[0] || null,
    topPair: pairLeaders[0] || null,
    pairLeaders,
    myPartners,
    managerLeaderboard,
    assetLeaders,
    recentTrades: tradeTransactions.slice(0, ANALYTICS_RECENT_TRADE_LIMIT).map(buildRecentTradeSummary),
    weeklyTimeline,
    maxWeeklyTradeCount,
    maxManagerTradeCount,
    topMovedAssetCount,
    movedAssetCount,
    pickMovementCount,
    playerMovementCount,
    totalMovedValue: Math.round(totalMovedValue),
    multiTeamTradeCount,
    chaosScore,
    tradeStatusLabel: state.transactionsLoaded
      ? state.transactionsFailed ? "transactions unavailable" : `${tradeTransactions.length} completed trades`
      : "syncing transactions",
  };
}

function ensureManagerTradeStats(managerStats, rosterId) {
  const rosterKey = normalizeRosterIdKey(rosterId);
  if (!managerStats.has(rosterKey)) {
    managerStats.set(rosterKey, {
      rosterId,
      managerName: getRosterManagerName(rosterId),
      tradeCount: 0,
      sentAssets: 0,
      receivedAssets: 0,
      sentValue: 0,
      receivedValue: 0,
    });
  }
  return managerStats.get(rosterKey);
}

function getTransactionParticipantIds(transaction) {
  return [...new Set((transaction?.roster_ids || [])
    .map(normalizeRosterIdKey)
    .filter(Boolean))]
    .sort((a, b) => Number(a) - Number(b) || a.localeCompare(b));
}

function buildRosterPairKey(leftRosterId, rightRosterId) {
  return [normalizeRosterIdKey(leftRosterId), normalizeRosterIdKey(rightRosterId)]
    .filter(Boolean)
    .sort((a, b) => Number(a) - Number(b) || a.localeCompare(b))
    .join("|");
}

function getRosterManagerName(rosterId) {
  const rosterKey = normalizeRosterIdKey(rosterId);
  const roster = state.normalizedRosters.find((entry) => normalizeRosterIdKey(entry.rosterId) === rosterKey);
  if (roster?.manager?.displayName) return roster.manager.displayName;
  return resolveRosterIdentity(getFranchiseIndex(), {
    leagueId: state.leagueId,
    rosterId: rosterKey,
  }).managerName;
}

function buildTradeMovements(transaction) {
  const movements = [];
  const adds = transaction?.adds && typeof transaction.adds === "object" ? transaction.adds : {};
  const drops = transaction?.drops && typeof transaction.drops === "object" ? transaction.drops : {};

  Object.entries(adds).forEach(([playerId, toRosterId]) => {
    const fromRosterId = drops[playerId];
    if (fromRosterId == null || toRosterId == null || String(fromRosterId) === String(toRosterId)) return;
    const asset = buildTransactionPlayerAsset(playerId);
    const value = getAssetValue(asset, state.values);
    movements.push({
      assetId: asset.assetId,
      assetType: "player",
      name: asset.name,
      fromRosterId: normalizeRosterIdKey(fromRosterId),
      toRosterId: normalizeRosterIdKey(toRosterId),
      value: Number.isFinite(value) ? value : 0,
      positionLabel: formatPlayerPositionLabel(asset),
    });
  });

  (Array.isArray(transaction?.draft_picks) ? transaction.draft_picks : []).forEach((pick) => {
    const fromRosterId = pick?.previous_owner_id;
    const toRosterId = pick?.owner_id;
    if (fromRosterId == null || toRosterId == null || String(fromRosterId) === String(toRosterId)) return;
    const asset = buildTransactionPickAsset(pick, transaction);
    const pickValue = getAssetValue(asset, state.values);
    const value = Number(asset.draftedPlayerValue) > 0
      ? asset.draftedPlayerValue
      : (Number.isFinite(pickValue) ? pickValue : 0);
    movements.push({
      assetId: asset.assetId,
      assetType: "pick",
      name: asset.name,
      pickLabel: asset.pickLabel,
      draftedPlayerName: asset.draftedPlayerName,
      draftedPlayerValue: asset.draftedPlayerValue,
      fromRosterId: normalizeRosterIdKey(fromRosterId),
      toRosterId: normalizeRosterIdKey(toRosterId),
      value: Number.isFinite(value) ? value : 0,
      positionLabel: "Pick",
    });
  });

  return movements;
}

function buildTransactionPlayerAsset(playerId) {
  const assetId = `player:${playerId}`;
  const existingAsset = state.normalizedRosters
    .flatMap((roster) => roster.assets)
    .find((asset) => asset.assetId === assetId);
  if (existingAsset) return existingAsset;

  const raw = state.players?.[String(playerId)] || {};
  const name = raw.full_name
    || `${(raw.first_name || "").trim()} ${(raw.last_name || "").trim()}`.trim()
    || state.valueNameMap[assetId]
    || `Player ${playerId}`;
  return {
    assetId,
    name,
    assetType: "player",
    raw,
  };
}

function resolveDraftedPlayerName(selection) {
  if (!selection) return "";
  const mapped = selection.playerId ? playerNameById(selection.playerId) : "";
  if (mapped && !/^Player\s/i.test(mapped)) return mapped;
  return String(selection.metaName || "").trim() || mapped;
}

function lookupTradePickSelection(pick, transaction = null) {
  const season = pick?.season != null ? String(pick.season) : "";
  const round = Number(pick?.round);
  const originalRosterId = pick?.roster_id ?? pick?.original_owner;
  if (!season || !Number.isFinite(round) || originalRosterId == null || originalRosterId === "any") {
    return null;
  }
  const sourceLeagueId = transaction?.sourceLeagueId || state.leagueId;
  const ownerInfo = getHistoryRosterInfo(sourceLeagueId, originalRosterId);
  return lookupDraftedSelection(state.draftedPickByKey, {
    season,
    round,
    originalRosterId,
    ownerKey: ownerInfo?.managerKey || "",
  });
}

function buildTransactionPickAsset(pick, transaction = null) {
  const season = pick?.season != null ? String(pick.season) : "";
  const round = Number(pick?.round);
  const originalOwner = pick?.roster_id ?? pick?.original_owner ?? "any";
  const userById = new Map(state.users.map((user) => [String(user.user_id), user]));
  const rosterById = new Map(state.rosters.map((roster) => [String(roster.roster_id), roster]));
  const ownerName = resolvePickOwnerName(originalOwner, rosterById, userById);
  const roundLabel = Number.isFinite(round) ? ordinal(round) : "pick";
  const pickLabel = `${season} ${roundLabel}${ownerName ? ` from ${ownerName}` : ""}`.trim();
  const selection = lookupTradePickSelection(pick, transaction);
  const draftedPlayerName = resolveDraftedPlayerName(selection);
  const draftedPlayerValue = selection?.playerId ? playerValueById(selection.playerId) : 0;
  let name = formatPickWithSelection(pickLabel, draftedPlayerName, draftedPlayerValue, formatNumber);
  if (!draftedPlayerName && shouldAttachMock({ season, round }, state.mockDrafts)) {
    const place = currentPlaceForOwner(originalOwner, buildCurrentPlaceLookup(state.rosters, getSeasonModel()?.standings));
    const slot = projectedDraftSlot(place?.rank, place?.total);
    const mock = mockProspectAtSlot(state.mockDrafts, slot, round);
    name = formatHybridFirstName({
      season,
      round,
      ownerName,
      placeLabel: place?.label,
      mockName: mock?.label || "",
      mockSlot: slot,
    }) || name;
  }
  const normalizedPick = {
    ...pick,
    season,
    round,
    roster_id: originalOwner,
    original_owner: originalOwner,
    owner_id: pick?.owner_id ?? originalOwner,
  };
  return {
    assetId: `pick:${season}:r${round}:${originalOwner}`,
    valueAssetId: `pick:${season}:r${round}:any`,
    valueBucket: "any",
    name,
    pickLabel,
    draftedPlayerName,
    draftedPlayerValue,
    assetType: "pick",
    raw: normalizedPick,
  };
}

function buildWeeklyTradeTimeline(weeklyMap) {
  const endWeek = Math.max(
    TRANSACTION_WEEK_FALLBACK_END,
    ...[...weeklyMap.keys()].map((week) => Number(week)).filter(Number.isFinite)
  );
  const weeks = [];
  for (let week = TRANSACTION_WEEK_START; week <= endWeek; week++) {
    const entry = weeklyMap.get(week) || { week, count: 0, movedValue: 0 };
    weeks.push({
      week,
      count: entry.count,
      movedValue: Math.round(entry.movedValue || 0),
    });
  }
  return weeks;
}

function calculateMarketChaosScore({ tradeCount, rosterCount, pairCount, movedAssetCount, multiTeamTradeCount, totalTransactions }) {
  if (!rosterCount) return 1;
  const tradeDensity = tradeCount / rosterCount;
  const pairDensity = pairCount / Math.max(1, rosterCount);
  const transactionDensity = totalTransactions / Math.max(1, rosterCount * 6);
  return clamp(Math.round(
    tradeDensity * 28
      + pairDensity * 22
      + movedAssetCount * 1.6
      + multiTeamTradeCount * 8
      + transactionDensity * 18
  ), 1, 99);
}

function buildRecentTradeSummary(transaction) {
  const participantIds = getTransactionParticipantIds(transaction);
  const participantNames = participantIds.map(getRosterManagerName);
  const movements = buildTradeMovements(transaction);
  const byRecipient = new Map();
  movements.forEach((movement) => {
    if (!byRecipient.has(movement.toRosterId)) byRecipient.set(movement.toRosterId, []);
    byRecipient.get(movement.toRosterId).push(movement);
  });
  const preview = participantIds
    .map((rosterId) => {
      const assets = byRecipient.get(rosterId) || [];
      const names = assets.slice(0, 3).map((asset) => asset.name);
      const suffix = assets.length > 3 ? ` +${assets.length - 3}` : "";
      return `${getRosterManagerName(rosterId)} got ${names.length ? names.join(", ") + suffix : "value"}`;
    })
    .join(" | ");
  const date = formatTransactionDate(transaction.status_updated || transaction.created);
  return {
    title: participantNames.join(" / "),
    subtitle: `${date} • ${movements.length} asset${movements.length === 1 ? "" : "s"} moved`,
    preview: preview || "Trade details unavailable from Sleeper payload.",
  };
}

function formatTransactionDate(timestamp) {
  const numeric = Number(timestamp);
  if (!Number.isFinite(numeric) || numeric <= 0) return "Unknown date";
  try {
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(numeric));
  } catch {
    return "Unknown date";
  }
}

function median(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2) return sorted[middle];
  return Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

function renderPowerStat(label, value, detail) {
  return `
    <section class="power-stat">
      <span>${label}</span>
      <strong>${value}</strong>
      <small>${detail}</small>
    </section>
  `;
}

function renderPositionMeter(position) {
  return `
    <div class="position-meter">
      <div class="position-meter-top">
        <strong>${position.position}</strong>
        <span>${position.rankLabel}</span>
      </div>
      <div class="meter-track" aria-hidden="true">
        <span style="width:${Math.round(position.percentile * 100)}%"></span>
      </div>
      <p>${position.label}</p>
    </div>
  `;
}

function renderSleeperInsight(insight) {
  return `
    <section class="insight-item ${insight.tone || ""}">
      <strong>${insight.title}</strong>
      <span>${insight.body}</span>
    </section>
  `;
}

function buildLeaguePowerContext({ league, rosters, values, metricsByRosterId = null }) {
  const resolvedMetrics = metricsByRosterId || new Map();
  if (!metricsByRosterId) {
    rosters.forEach((roster) => {
      resolvedMetrics.set(roster.rosterId, evaluateRosterStrength(roster, values, league));
    });
  }

  const ranks = rankRosterMetrics(resolvedMetrics);
  const positions = getPowerPositions(league, rosters);
  const pickValues = rosters.map((roster) => summarizeRosterAssets(roster, values).pickValue);
  const positionValuesByPosition = new Map();

  positions.forEach((position) => {
    positionValuesByPosition.set(
      position,
      rosters.map((roster) => calculateRosterPositionValue(roster, values, league, position))
    );
  });

  return {
    league,
    rosters,
    values,
    metricsByRosterId: resolvedMetrics,
    ranks,
    totalTeams: rosters.length,
    starterValues: [...resolvedMetrics.values()].map((metrics) => metrics.starterValue),
    benchValues: [...resolvedMetrics.values()].map((metrics) => metrics.benchValue),
    totalValues: [...resolvedMetrics.values()].map((metrics) => metrics.totalValue),
    pickValues,
    positions,
    positionValuesByPosition,
  };
}

function buildTeamPowerProfile({ roster, values, league, context, metrics = null, rank = null }) {
  const resolvedMetrics = metrics || context.metricsByRosterId.get(roster.rosterId) || evaluateRosterStrength(roster, values, league);
  const resolvedRank = rank || context.ranks.get(roster.rosterId) || context.totalTeams;
  const assetSummary = summarizeRosterAssets(roster, values);
  const positionSummaries = context.positions.map((position) =>
    buildPositionPowerSummary(roster, values, league, context, position)
  );
  const strongestPosition = positionSummaries.slice().sort((a, b) => b.percentile - a.percentile)[0] || null;
  const weakestPosition = positionSummaries.slice().sort((a, b) => a.percentile - b.percentile)[0] || null;
  const starterPercentile = percentileFromValues(context.starterValues, resolvedMetrics.starterValue);
  const benchPercentile = percentileFromValues(context.benchValues, resolvedMetrics.benchValue);
  const totalPercentile = percentileFromValues(context.totalValues, resolvedMetrics.totalValue);
  const pickPercentile = percentileFromValues(context.pickValues, assetSummary.pickValue);
  const rankPercentile = context.totalTeams > 1 ? (context.totalTeams - resolvedRank) / (context.totalTeams - 1) : 1;
  const balancePercentile = positionSummaries.length
    ? positionSummaries.reduce((sum, entry) => sum + entry.percentile, 0) / positionSummaries.length
    : 0.5;
  const timelineScore = calculateTimelineScore(assetSummary);
  const score = clamp(Math.round(
    44
      + starterPercentile * 30
      + rankPercentile * 8
      + totalPercentile * 10
      + benchPercentile * 4
      + pickPercentile * 3
      + balancePercentile * 2
      + timelineScore * 2
  ), 35, 99);
  const lane = classifyPowerLane({ rank: resolvedRank, totalTeams: context.totalTeams, score, assetSummary, pickPercentile });
  const grade = formatPowerGrade(score);

  return {
    rosterId: roster.rosterId,
    managerName: roster.manager.displayName,
    score,
    grade: grade.label,
    tierClass: grade.className,
    rank: resolvedRank,
    totalTeams: context.totalTeams,
    lane,
    laneLabel: lane.label,
    starterPercentile,
    pickPercentile,
    timelineScore,
    metrics: resolvedMetrics,
    assetSummary,
    positionSummaries,
    strongestPosition,
    weakestPosition,
    badges: buildPowerBadges({ score, lane, assetSummary, strongestPosition, weakestPosition }),
    componentLabels: {
      starter: `${ordinal(Math.round(starterPercentile * 100))} percentile`,
      bench: `${ordinal(Math.round(benchPercentile * 100))} percentile`,
      timeline: assetSummary.averageAge ? `${assetSummary.youthCount} youth / ${assetSummary.veteranCount} vets` : "age data limited",
    },
  };
}

function summarizeRosterAssets(roster, values) {
  const playerEntries = roster.assets
    .filter((asset) => asset.assetType === "player" && isTradeEligibleAsset(asset))
    .map((asset) => ({ asset, value: getAssetValue(asset, values) }))
    .filter((entry) => Number.isFinite(entry.value))
    .sort((a, b) => b.value - a.value || a.asset.name.localeCompare(b.asset.name));
  const pickEntries = roster.assets
    .filter((asset) => asset.assetType === "pick")
    .map((asset) => ({ asset, value: getAssetValue(asset, values) }))
    .filter((entry) => Number.isFinite(entry.value))
    .sort((a, b) => b.value - a.value || a.asset.name.localeCompare(b.asset.name));
  const topWeightedAgeEntries = playerEntries.slice(0, 12).filter((entry) => Number.isFinite(playerAgeForAsset(entry.asset)));
  const totalAgeWeight = topWeightedAgeEntries.reduce((sum, entry) => sum + Math.max(1, entry.value), 0);
  const averageAge = totalAgeWeight > 0
    ? topWeightedAgeEntries.reduce((sum, entry) => sum + playerAgeForAsset(entry.asset) * Math.max(1, entry.value), 0) / totalAgeWeight
    : null;
  const teamStack = buildTopTeamStack(playerEntries);

  return {
    playerValue: playerEntries.reduce((sum, entry) => sum + entry.value, 0),
    pickValue: pickEntries.reduce((sum, entry) => sum + entry.value, 0),
    playerCount: playerEntries.length,
    pickCount: pickEntries.length,
    firstRoundPickCount: pickEntries.filter((entry) => isFirstRoundPick(entry.asset)).length,
    youthCount: playerEntries.filter((entry) => isYouthAsset(entry.asset)).length,
    veteranCount: playerEntries.filter((entry) => isVeteranAsset(entry.asset)).length,
    injuredCount: playerEntries.filter((entry) => isInjuryFlaggedAsset(entry.asset)).length,
    averageAge,
    averageAgeLabel: Number.isFinite(averageAge) ? `${averageAge.toFixed(1)}y` : "N/A",
    topPlayers: playerEntries.slice(0, 5),
    topPicks: pickEntries.slice(0, 4),
    teamStack,
  };
}

function buildTopTeamStack(playerEntries) {
  const byTeam = new Map();
  playerEntries.slice(0, 14).forEach((entry) => {
    const team = String(entry.asset.raw?.team || "").trim().toUpperCase();
    if (!team || team === "FA") return;
    if (!byTeam.has(team)) byTeam.set(team, []);
    byTeam.get(team).push(entry);
  });
  const stacks = [...byTeam.entries()]
    .map(([team, entries]) => ({
      team,
      entries,
      value: entries.reduce((sum, entry) => sum + entry.value, 0),
    }))
    .filter((stack) => stack.entries.length >= 2)
    .sort((a, b) => b.value - a.value || b.entries.length - a.entries.length);
  return stacks[0] || null;
}

function isInjuryFlaggedAsset(asset) {
  if (asset.assetType !== "player") return false;
  const injuryStatus = String(asset.raw?.injury_status || "").trim();
  const status = String(asset.raw?.status || "").trim().toLowerCase();
  return Boolean(injuryStatus) || status.includes("injured") || status.includes("ir") || status.includes("pup");
}

function getPowerPositions(league, rosters) {
  const priority = ["QB", "RB", "WR", "TE"];
  const playerPositions = new Set(
    rosters.flatMap((roster) =>
      roster.assets
        .filter((asset) => asset.assetType === "player")
        .flatMap((asset) => playerPositionsForAsset(asset))
    )
  );
  return priority.filter((position) => playerPositions.has(position) || getPositionStarterDemand(league, position) > 0);
}

function getPositionStarterDemand(league, position) {
  const slots = getStarterRosterSlots(league);
  const normalizedPosition = normalizePlayerPosition(position);
  const rawDemand = slots.reduce((sum, slot) => {
    const allowed = getAllowedPositionsForSlot(slot);
    if (!allowed.has(normalizedPosition)) return sum;
    return sum + (allowed.size === 1 ? 1 : 1 / allowed.size);
  }, 0);
  return Math.max(1, Math.round(rawDemand));
}

function calculateRosterPositionValue(roster, values, league, position) {
  const demand = getPositionStarterDemand(league, position);
  return roster.assets
    .filter((asset) => asset.assetType === "player" && playerPositionsForAsset(asset).includes(position))
    .map((asset) => getAssetValue(asset, values))
    .filter(Number.isFinite)
    .sort((a, b) => b - a)
    .slice(0, demand)
    .reduce((sum, value) => sum + value, 0);
}

function buildPositionPowerSummary(roster, values, league, context, position) {
  const value = calculateRosterPositionValue(roster, values, league, position);
  const percentile = percentileFromValues(context.positionValuesByPosition.get(position) || [], value);
  const rank = rankValueDescending(context.positionValuesByPosition.get(position) || [], value);
  const label = percentile >= 0.72
    ? "edge"
    : percentile <= 0.42
      ? "upgrade target"
      : "stable";
  return {
    position,
    value,
    percentile,
    rank,
    rankLabel: `${ordinal(rank)} / ${context.totalTeams}`,
    label: `${label} • ${formatNumber(value)}`,
  };
}

function percentileFromValues(values, value) {
  const numericValues = values.filter(Number.isFinite);
  if (numericValues.length === 0 || !Number.isFinite(value)) return 0.5;
  if (numericValues.length === 1) return 1;
  const minValue = Math.min(...numericValues);
  const maxValue = Math.max(...numericValues);
  if (minValue === maxValue) return maxValue <= 0 ? 0 : 0.5;
  const belowOrEqual = numericValues.filter((entry) => entry <= value).length;
  return clamp(belowOrEqual / numericValues.length, 0, 1);
}

function rankValueDescending(values, value) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => b - a);
  const index = sorted.findIndex((entry) => entry <= value);
  return index >= 0 ? index + 1 : sorted.length || 1;
}

function calculateTimelineScore(assetSummary) {
  if (!Number.isFinite(assetSummary.averageAge)) return 0.5;
  const ageScore = clamp((28.8 - assetSummary.averageAge) / 7, 0, 1);
  const youthScore = clamp(assetSummary.youthCount / Math.max(5, assetSummary.playerCount * 0.28), 0, 1);
  return ageScore * 0.55 + youthScore * 0.45;
}

function classifyPowerLane({ rank, totalTeams, score, assetSummary, pickPercentile }) {
  const topTier = Math.max(1, Math.ceil(totalTeams / 3));
  const bottomTierStart = Math.max(1, totalTeams - topTier + 1);

  if (rank <= topTier && score >= 82) {
    if (assetSummary.averageAge >= 27.8 && pickPercentile <= 0.35) {
      return { id: "fragile-contender", label: "Fragile Contender" };
    }
    return { id: "contender", label: "Contender" };
  }
  if (rank >= bottomTierStart && (pickPercentile >= 0.58 || assetSummary.youthCount >= assetSummary.veteranCount)) {
    return { id: "rebuild", label: "Rebuild Engine" };
  }
  if (score >= 78) return { id: "playoff-hunter", label: "Playoff Hunter" };
  return { id: "middle", label: "Middle Build" };
}

function formatPowerGrade(score) {
  if (score >= 95) return { label: "S", className: "elite" };
  if (score >= 90) return { label: "A+", className: "elite" };
  if (score >= 84) return { label: "A", className: "strong" };
  if (score >= 78) return { label: "B+", className: "strong" };
  if (score >= 70) return { label: "B", className: "" };
  if (score >= 62) return { label: "C", className: "watch" };
  return { label: "D", className: "watch" };
}

function buildPowerBadges({ score, lane, assetSummary, strongestPosition, weakestPosition }) {
  const badges = [lane.label];
  if (score >= 90) badges.push("Title Threat");
  if (strongestPosition?.percentile >= 0.75) badges.push(`${strongestPosition.position} Edge`);
  if (weakestPosition?.percentile <= 0.28) badges.push(`${weakestPosition.position} Quest`);
  if (assetSummary.firstRoundPickCount >= 3) badges.push("Pick Hoarder");
  if (assetSummary.youthCount >= 7) badges.push("Youth Core");
  if (assetSummary.teamStack) badges.push(`${assetSummary.teamStack.team} Stack`);
  return [...new Set(badges)].slice(0, 5);
}

function buildSleeperInsightCards(profile, context) {
  const insights = [];
  const formatInsight = describeLeagueFormat(context.league);
  insights.push({
    title: "League Format",
    body: formatInsight,
    tone: "blue",
  });

  if (profile.strongestPosition) {
    insights.push({
      title: "Best Edge",
      body: `${profile.strongestPosition.position} ranks ${profile.strongestPosition.rankLabel} by starter-caliber value.`,
      tone: "green",
    });
  }

  if (profile.weakestPosition && profile.weakestPosition.percentile <= 0.42) {
    insights.push({
      title: "Upgrade Quest",
      body: `${profile.weakestPosition.position} is your cleanest path to a power jump.`,
      tone: "gold",
    });
  }

  if (profile.assetSummary.firstRoundPickCount > 0) {
    const topPick = profile.assetSummary.topPicks[0]?.asset;
    insights.push({
      title: "Draft Ammo",
      body: `${profile.assetSummary.firstRoundPickCount} first-round pick${profile.assetSummary.firstRoundPickCount === 1 ? "" : "s"} in the vault${topPick ? `, led by ${topPick.name}` : ""}.`,
      tone: "gold",
    });
  }

  if (state.tradedPicks.length > 0) {
    insights.push({
      title: "Pick Market",
      body: `${state.tradedPicks.length} traded pick record${state.tradedPicks.length === 1 ? "" : "s"} loaded from Sleeper for this league.`,
      tone: "blue",
    });
  }

  if (profile.assetSummary.injuredCount > 0) {
    insights.push({
      title: "Injury Drag",
      body: `${profile.assetSummary.injuredCount} rostered player${profile.assetSummary.injuredCount === 1 ? "" : "s"} carry an injury/status flag in Sleeper metadata.`,
      tone: "rose",
    });
  }

  const trendInsight = buildTrendingInsight(profile);
  if (trendInsight) insights.push(trendInsight);

  if (profile.assetSummary.teamStack) {
    insights.push({
      title: "NFL Stack",
      body: `${profile.assetSummary.teamStack.entries.length} top roster pieces are tied to ${profile.assetSummary.teamStack.team}.`,
      tone: "blue",
    });
  }

  return insights.slice(0, 7);
}

function describeLeagueFormat(league) {
  const slots = getStarterRosterSlots(league);
  const hasSuperflex = slots.some((slot) => ["SUPER_FLEX", "OP"].includes(slot));
  const scoring = league?.scoring_settings || {};
  const receptionValue = Number(scoring.rec);
  const pprLabel = Number.isFinite(receptionValue)
    ? receptionValue >= 1 ? "PPR" : receptionValue > 0 ? `${receptionValue} PPR` : "standard"
    : "custom scoring";
  const taxiSlots = Number(league?.settings?.taxi_slots || 0);
  const draftRounds = Number(league?.settings?.draft_rounds || 0);
  const parts = [
    leagueTypeLabel(league),
    hasSuperflex ? "Superflex" : "1-QB",
    pprLabel,
    `${slots.length} starters`,
  ];
  if (tepLevel(league) > 0) parts.push("TE premium");
  if (leagueKeepsPlayers(league) && taxiSlots > 0) parts.push(`${taxiSlots} taxi`);
  if (leagueUsesFuturePicks(league) && draftRounds > 0) parts.push(`${draftRounds}-round rookie draft`);
  return parts.join(" • ");
}

function buildTrendingInsight(profile) {
  if (!state.trendingLoaded) return null;
  const rosterPlayerIds = new Set(
    state.normalizedRosters
      .find((roster) => roster.rosterId === profile.rosterId)
      ?.assets
      .filter((asset) => asset.assetType === "player")
      .map((asset) => asset.assetId.replace("player:", "")) || []
  );
  const hotRosterPlayer = state.trendingAdds.find((entry) => rosterPlayerIds.has(String(entry.player_id)));
  const coldRosterPlayer = state.trendingDrops.find((entry) => rosterPlayerIds.has(String(entry.player_id)));
  const hotPlayer = hotRosterPlayer || state.trendingAdds[0];
  if (!hotPlayer && !coldRosterPlayer) return null;

  if (hotRosterPlayer) {
    return {
      title: "Market Heat",
      body: `${formatTrendingPlayerName(hotRosterPlayer, "adds")} is on your roster and trending up on Sleeper adds.`,
      tone: "green",
    };
  }
  if (coldRosterPlayer) {
    return {
      title: "Market Risk",
      body: `${formatTrendingPlayerName(coldRosterPlayer, "drops")} is on your roster and showing up in Sleeper drops.`,
      tone: "rose",
    };
  }
  return {
    title: "Market Heat",
    body: `${formatTrendingPlayerName(hotPlayer, "adds")} is the current Sleeper add-market headliner.`,
    tone: "green",
  };
}

function formatTrendingPlayerName(trend, actionLabel = "adds") {
  const player = state.players?.[String(trend.player_id)] || {};
  const name = player.full_name
    || `${(player.first_name || "").trim()} ${(player.last_name || "").trim()}`.trim()
    || state.valueNameMap[`player:${trend.player_id}`]
    || `Player ${trend.player_id}`;
  return trend.count ? `${name} (${formatNumber(trend.count)} ${actionLabel})` : name;
}

function isTradeEligibleAsset(asset) {
  if (!asset) return false;
  if (asset.assetType === "pick") return true;
  if (asset.assetType !== "player") return false;

  const positions = playerPositionsForAsset(asset);
  if (positions.length === 0) return true;
  return !positions.some((position) => position === "K" || position === "DEF");
}

function assetTypeAllowed(asset, filters) {
  if (!isTradeEligibleAsset(asset)) return false;
  return (asset.assetType === "player" && filters.players) || (asset.assetType === "pick" && filters.picks);
}

function assetMatchesQuery(asset, query) {
  if (!query) return true;
  const pickSeason = asset.raw?.season != null ? String(asset.raw.season) : "";
  const pickRound = asset.raw?.round != null ? `round ${asset.raw.round}` : "";
  const pickBucket = asset.assetType === "pick" ? formatPickBucketLabel(getAssetPickBucket(asset)) : "";
  const position = playerPositionForAsset(asset);
  const haystack = [asset.name, pickSeason, pickRound, pickBucket, position, asset.assetType].join(" ").toLowerCase();
  return haystack.includes(query);
}

function sortAssetsByValueDesc(a, b, values = state.values) {
  const valueDiff = getAssetValue(b, values) - getAssetValue(a, values);
  if (valueDiff !== 0) return valueDiff;
  if (a.assetType !== b.assetType) return a.assetType === "player" ? -1 : 1;
  return a.name.localeCompare(b.name);
}

function sortAssetPickerOptions(a, b, values = state.values) {
  if (a.assetType !== b.assetType) return a.assetType === "player" ? -1 : 1;
  return sortAssetsByValueDesc(a, b, values);
}

function renderPlayerSearch() {
  const meRosterId = currentMeRosterId();
  if (!meRosterId) return;
  state.meRosterId = meRosterId;
  const mode = getTradeMode();

  const query = el.playerSearch.value.trim().toLowerCase();
  const selectedAsset = getCurrentPrimaryAsset();

  if (selectedAsset) {
    const selectedIsMine = selectedAsset.managerRosterId === meRosterId;
    const invalidForMode = mode === "shop"
      ? !selectedIsMine
      : selectedIsMine || !assetTypeAllowed(selectedAsset, state.targetFilters);
    if (invalidForMode) {
      if (mode === "shop") {
        state.shopAsset = null;
      } else {
        state.targetAsset = null;
      }
      if (el.playerSearch) el.playerSearch.value = "";
    }
  }

  syncTargetSearchUi();

  if (getCurrentPrimaryAsset() && !query) {
    el.playerResults.classList.add("hidden");
    el.playerResults.innerHTML = "";
    return;
  }

  el.playerResults.classList.remove("hidden");

  const rosterPool = mode === "shop"
    ? state.normalizedRosters.filter((roster) => roster.rosterId === meRosterId)
    : state.normalizedRosters.filter((roster) => roster.rosterId !== meRosterId);
  const typeFilters = mode === "shop" ? state.outgoingFilters : state.targetFilters;

  const candidates = rosterPool
    .flatMap((roster) =>
      roster.assets
        .filter((asset) => assetTypeAllowed(asset, typeFilters))
        .map((asset) => ({
          ...asset,
          managerName: roster.manager.displayName,
          managerRosterId: roster.rosterId,
        }))
    )
    .filter((asset) => assetMatchesQuery(asset, query))
    .sort((a, b) => sortAssetsByValueDesc(a, b, state.values))
    .slice(0, 150);

  el.playerResults.innerHTML = "";

  if (candidates.length === 0) {
    const emptyText = mode === "shop"
      ? "No matching assets found on your roster."
      : "No matching players or picks found.";
    el.playerResults.innerHTML = `<div class="player-item muted">${emptyText}</div>`;
    return;
  }

  for (const asset of candidates) {
    const row = document.createElement("div");
    row.className = "player-item";
    row.innerHTML = buildAssetPickerMarkup(asset, {
      values: state.values,
      contextLabel: mode === "shop" ? "Your roster" : asset.managerName,
    });
    row.addEventListener("click", () => {
      setCurrentPrimaryAsset(asset);
      el.playerSearch.value = "";
      el.resultsSection.classList.add("hidden");
      renderPlayerSearch();
      syncGenerateState();
    });
    el.playerResults.appendChild(row);
  }
}

function pruneSelectedOutgoingAssets() {
  const meRoster = getMyRoster();
  if (!meRoster) {
    state.selectedOutgoingAssetIds.clear();
    return;
  }

  const validAssetIds = new Set(meRoster.assets.filter(isTradeEligibleAsset).map((asset) => asset.assetId));
  state.selectedOutgoingAssetIds = new Set(
    [...state.selectedOutgoingAssetIds].filter(
      (assetId) => validAssetIds.has(assetId) && !state.excludedOutgoingAssetIds.has(assetId)
    )
  );
}

function pruneExcludedOutgoingAssets() {
  const meRoster = getMyRoster();
  if (!meRoster) {
    state.excludedOutgoingAssetIds.clear();
    return;
  }

  const validAssetIds = new Set(meRoster.assets.filter(isTradeEligibleAsset).map((asset) => asset.assetId));
  state.excludedOutgoingAssetIds = new Set(
    [...state.excludedOutgoingAssetIds].filter((assetId) => validAssetIds.has(assetId))
  );
}

function buildAssetPickerMarkup(asset, { values, contextLabel } = {}) {
  const pills = [];
  pills.push(`<span class="asset-pill ${asset.assetType === "pick" ? "gold" : ""}">${asset.assetType === "pick" ? "Pick" : formatPlayerPositionLabel(asset)}</span>`);

  if (asset.assetType === "player" && asset.raw?.age) {
    pills.push(`<span class="asset-pill">${asset.raw.age} yrs</span>`);
  }

  if (asset.assetType === "pick") {
    const pickBucket = getAssetPickBucket(asset);
    if (Number(asset.raw?.round) === 1 && pickBucket !== "any") {
      pills.push(`<span class="asset-pill gold">${formatPickBucketLabel(pickBucket)}</span>`);
    }
    if (asset.raw?.season) pills.push(`<span class="asset-pill">${asset.raw.season}</span>`);
    if (asset.raw?.round) pills.push(`<span class="asset-pill">R${asset.raw.round}</span>`);
  }

  return `
    <div class="asset-row-top">
      <div class="asset-name-stack">
        <strong>${asset.name}</strong>
        <div class="asset-meta">
          ${pills.join("")}
          ${contextLabel ? `<span class="asset-context">${contextLabel}</span>` : ""}
        </div>
      </div>
      <span class="asset-value-badge-slot">${renderAssetValueBadge(asset, values)}</span>
    </div>
  `;
}

function clearTradeMatchCache() {
  state.tradeMatch = {
    key: "",
    loading: false,
    error: "",
    payload: null,
  };
  syncMatchGenerateState();
}

function tradeMatchCacheKey(rosterId = state.meRosterId) {
  return [
    state.leagueId || "",
    rosterId || "",
    valuationCacheVersion(),
    state.playerMetadataLoaded ? "players" : "names",
  ].join(":");
}

function buildTradeMatchProfiles(powerProfiles = null) {
  const profiles = powerProfiles || buildPowerProfiles();
  const demand = {};
  profiles.forEach((profile) => {
    (profile.positionSummaries || []).forEach((entry) => {
      if (demand[entry.position] != null) return;
      demand[entry.position] = getPositionStarterDemand(state.league, entry.position);
    });
  });
  return profiles
    .map((powerProfile) => {
      const roster = findNormalizedRoster(powerProfile.rosterId);
      if (!roster) return null;
      return buildTradeMatchProfile({
        roster,
        powerProfile,
        values: state.values,
        getAssetValue,
        playerPositionForAsset,
        playerPositionsForAsset,
        playerAgeForAsset,
        positionDemand: demand,
      });
    })
    .filter(Boolean);
}

function buildTradeMatchPreview(powerProfiles = null) {
  const meRoster = getMyRoster();
  if (!meRoster || !Object.keys(state.values || {}).length) return null;
  const matchProfiles = buildTradeMatchProfiles(powerProfiles);
  const mine = matchProfiles.find((profile) => String(profile.rosterId) === String(meRoster.rosterId));
  if (!mine) return null;
  return previewBestMatch(
    mine,
    matchProfiles.filter((profile) => String(profile.rosterId) !== String(meRoster.rosterId))
  );
}

function syncMatchGenerateState() {
  const ready = Boolean(state.meRosterId && state.leagueId);
  if (el.matchGenerateBtn && !el.matchGenerateBtn.classList.contains("loading")) {
    el.matchGenerateBtn.disabled = !ready;
  }
  if (el.matchGenerateHelp) {
    el.matchGenerateHelp.textContent = !state.leagueId
      ? "Load a league and pick your team."
      : !state.meRosterId
        ? "Choose your team first."
        : "Looks at holes, surplus, and contend vs tank. No leftover thirds.";
  }
}

function setMatchGenerateError(message) {
  setFieldError(null, el.matchGenerateError, message);
}

function renderTradeMatchRoom() {
  syncMatchGenerateState();
  renderTradeMatchNeeds();
  const key = tradeMatchCacheKey();
  if (state.tradeMatch.loading) {
    renderTradeMatchDashboard();
    return;
  }
  if (state.tradeMatch.key === key && state.tradeMatch.payload) {
    renderTradeMatchDashboard();
    return;
  }
  if (state.meRosterId && state.leagueId && !state.playerMetadataLoaded && !state.playerMetadataFailed) {
    if (el.tradeMatchDashboard) {
      el.tradeMatchDashboard.innerHTML = `<p class="muted">Matching holes against the rest of the league…</p>`;
    }
    return;
  }
  if (state.meRosterId && state.leagueId) {
    void generateTradeMatches();
    return;
  }
  renderTradeMatchDashboard();
}

function renderTradeMatchNeeds() {
  if (!el.tradeMatchNeeds) return;
  const meRoster = getMyRoster();
  if (!meRoster) {
    el.tradeMatchNeeds.innerHTML = `<p class="muted">Pick your team to see holes and extra parts.</p>`;
    return;
  }
  if (!Object.keys(state.values || {}).length) {
    el.tradeMatchNeeds.innerHTML = `<p class="muted">Values are still loading.</p>`;
    return;
  }
  if (!state.playerMetadataLoaded && !state.playerMetadataFailed) {
    el.tradeMatchNeeds.innerHTML = `<p class="muted">Player names are still syncing.</p>`;
    return;
  }
  const mine = buildTradeMatchProfiles().find((profile) => String(profile.rosterId) === String(meRoster.rosterId));
  if (!mine) {
    el.tradeMatchNeeds.innerHTML = `<p class="muted">Need roster values before match can grade holes.</p>`;
    return;
  }
  const chips = [
    mine.laneLabel,
    mine.weakestPosition ? `Need ${mine.weakestPosition.position}` : "",
    mine.strongestPosition ? `Extra ${mine.strongestPosition.position}` : "",
    mine.timeline === "contending" ? "Win-now window" : mine.timeline === "rebuilding" ? "Tank / future" : "Flexible",
  ].filter(Boolean);
  const needLine = mine.needs.length
    ? `Holes: ${mine.needs.map((row) => `${row.position} (${row.rankLabel || row.grade})`).join(", ")}.`
    : "No loud positional hole. Match will look for a contend/tank window instead.";
  const surplusLine = mine.surplus.length
    ? `You can spare ${mine.surplus.map((row) => row.position).join(", ")}.`
    : "No obvious surplus; any deal still has to help your starters.";
  el.tradeMatchNeeds.innerHTML = `
    <div class="match-need-card">
      <div class="power-badge-row">
        ${chips.map((chip) => `<span class="power-badge">${escapeHtml(chip)}</span>`).join("")}
      </div>
      <p>${escapeHtml(needLine)} ${escapeHtml(surplusLine)}</p>
    </div>
  `;
}

function renderTradeMatchDashboard() {
  if (!el.tradeMatchDashboard) return;
  if (state.tradeMatch.loading) {
    el.tradeMatchDashboard.innerHTML = `<p class="muted">Matching holes against the rest of the league…</p>`;
    return;
  }
  if (state.tradeMatch.error) {
    el.tradeMatchDashboard.innerHTML = `<p class="muted">${escapeHtml(state.tradeMatch.error)}</p>`;
    return;
  }
  const payload = state.tradeMatch.payload;
  if (!payload) {
    el.tradeMatchDashboard.innerHTML = `<p class="muted">Find matches to pair your roster with complementary teams.</p>`;
    return;
  }
  if (!payload.groups?.length) {
    el.tradeMatchDashboard.innerHTML = `<p class="muted">${escapeHtml(payload.emptyText || "No complementary teams turned up a real roster-fit trade.")}</p>`;
    return;
  }
  el.tradeMatchDashboard.innerHTML = payload.groups.map((group) => `
    <article class="match-partner-card">
      <h3>${escapeHtml(group.title)}</h3>
      ${
        group.ideas.length > 0
          ? group.ideas.map((idea) => renderMatchTradeCard(idea)).join("")
          : `<p class="muted small idea-group-empty">${escapeHtml(group.emptyText || "Need fit is there, but no package stayed fair without filler.")}</p>`
      }
    </article>
  `).join("");
}

async function generateTradeMatches({ userRequested = false } = {}) {
  const meRoster = getMyRoster();
  if (!meRoster) {
    setMatchGenerateError("Load a league and choose your team first.");
    return;
  }
  if (state.tradeMatch.loading) return;

  setMatchGenerateError("");
  state.tradeMatch.loading = true;
  state.tradeMatch.error = "";
  renderTradeMatchDashboard();

  try {
    setButtonLoading(el.matchGenerateBtn, true, "Matching teams...");
    await ensureValuesLoaded("");
    await waitForNextPaint();
    if (!state.playerMetadataLoaded && !state.playerMetadataFailed) {
      state.tradeMatch.error = "Player names still syncing. Try again in a moment.";
      state.tradeMatch.payload = null;
      return;
    }
    const key = tradeMatchCacheKey(meRoster.rosterId);
    if (!userRequested && state.tradeMatch.key === key && state.tradeMatch.payload) {
      return;
    }
    state.tradeMatch.key = key;
    const fairnessPct = DEFAULT_FAIRNESS_PCT;
    const matchProfiles = buildTradeMatchProfiles();
    const myProfile = matchProfiles.find((profile) => String(profile.rosterId) === String(meRoster.rosterId));
    if (!myProfile) {
      state.tradeMatch.payload = { groups: [], emptyText: "Could not grade your roster for match." };
      return;
    }

    const ranked = rankPartnerMatches(
      myProfile,
      matchProfiles.filter((profile) => String(profile.rosterId) !== String(meRoster.rosterId))
    );
    const leagueStrengthBaseline = getCachedLeagueStrengthBaseline({
      league: state.league,
      rosters: state.normalizedRosters,
      values: state.values,
    });

    const groups = [];
    for (const { profile: theirProfile, match } of ranked) {
      await waitForNextPaint();
      const rawDeals = proposeMatchDeals({
        myProfile,
        theirProfile,
        match,
        values: state.values,
        getAssetValue,
        playerPositionForAsset,
        playerPositionsForAsset,
        playerAgeForAsset,
        fairnessPct,
        maxResults: 8,
      });
      const cheapIdeas = [];
      rawDeals.forEach((deal) => {
        if (packageLooksLikeFiller(deal.myAssets, deal.theirAssets, state.values, getAssetValue)) return;
        const packageResult = calculatePackageAdjustment({
          myValues: deal.myAssets.map((asset) => getAssetValue(asset, state.values)),
          theirValues: deal.theirAssets.map((asset) => getAssetValue(asset, state.values)),
          globalMaxValue: getGlobalMaxPlayerValue(
            state.values,
            Math.max(...deal.myAssets.concat(deal.theirAssets).map((asset) => getAssetValue(asset, state.values)), 0)
          ),
        });
        const pctDiff = Number(calculatePctDiff(packageResult.myAdjustedValue, packageResult.theirAdjustedValue).toFixed(2));
        if (pctDiff > Math.max(fairnessPct, 26)) return;
        cheapIdeas.push({ deal, packageResult, pctDiff });
      });
      cheapIdeas.sort((a, b) => {
        const loudest = myProfile.weakestPosition?.position;
        if (loudest) {
          const aHit = (a.deal.myHelp?.patchedNeeds || []).some((row) => row.position === loudest) ? 1 : 0;
          const bHit = (b.deal.myHelp?.patchedNeeds || []).some((row) => row.position === loudest) ? 1 : 0;
          if (aHit !== bHit) return bHit - aHit;
        }
        const bySize = (a.deal.myAssets.length + a.deal.theirAssets.length) - (b.deal.myAssets.length + b.deal.theirAssets.length);
        if (Math.abs(bySize) >= 2) return bySize;
        return (b.deal.helpScore || 0) - (a.deal.helpScore || 0) || a.pctDiff - b.pctDiff;
      });
      const ideas = [];
      for (const row of cheapIdeas) {
        const idea = enrichTradeIdea({
          idea: {
            myAssets: row.deal.myAssets,
            theirAssets: row.deal.theirAssets,
            ...row.packageResult,
            pctDiff: row.pctDiff,
            counterpartyName: theirProfile.managerName,
            counterpartyRosterId: theirProfile.rosterId,
            matchKind: row.deal.kind,
            myHelp: row.deal.myHelp,
          },
          myRoster: meRoster,
          theirRoster: theirProfile.roster,
          values: state.values,
          leagueStrengthBaseline,
          includePowerUpgrade: false,
        });
        if (!tradeMatchIdeaHelps(idea, myProfile, row.deal)) continue;
        ideas.push(idea);
        if (ideas.length >= 1) break;
      }

      groups.push({
        title: theirProfile.managerName,
        ideas,
        emptyText: "The rosters fit, but every fair package still looked like filler. Try Find deals on a specific name.",
      });
    }

    const withDeals = groups.filter((group) => group.ideas.length > 0);
    state.tradeMatch.payload = {
      groups: withDeals.length ? withDeals : groups.slice(0, 3),
      emptyText: ranked.length === 0
        ? "No complementary windows jumped out. Your roster may already be balanced, or the league is clustered the same way."
        : "Those complementary teams showed up, but no package helped your lineup without leftover thirds.",
    };
  } catch (err) {
    state.tradeMatch.error = `Could not build matches. ${err.message}`;
    state.tradeMatch.payload = null;
  } finally {
    state.tradeMatch.loading = false;
    setButtonLoading(el.matchGenerateBtn, false);
    syncMatchGenerateState();
    if (state.activePage === "trades" && getRoom("trades") === "match") {
      renderTradeMatchNeeds();
      renderTradeMatchDashboard();
    }
  }
}

function tradeMatchIdeaHelps(idea, myProfile, deal) {
  if (deal?.myHelp?.helped === false) return false;
  if (myProfile.timeline !== "contending") return true;
  const starterDelta = (idea.impactAnalysis?.mySide.after.starterValue || 0) - (idea.impactAnalysis?.mySide.before.starterValue || 0);
  const holePatched = Boolean(deal?.myHelp?.patchedNeeds?.length);
  const beforeRank = idea.impactAnalysis?.mySide.before.rank;
  const afterRank = idea.impactAnalysis?.mySide.after.rank;
  const rankImproved = Number.isFinite(beforeRank) && Number.isFinite(afterRank) && afterRank <= beforeRank;
  return holePatched || starterDelta >= -150 || rankImproved;
}

async function generateTradeIdeas() {
  if (el.generateBtn?.classList.contains("loading")) return;
  if (!state.meRosterId) {
    setGenerateError("Load a league and choose your team first.");
    return;
  }

  const mode = getTradeMode();
  const meRoster = getMyRoster();
  if (!meRoster) {
    setGenerateError("Could not resolve your roster.");
    return;
  }
  if (mode === "acquire" && !state.targetAsset) {
    setGenerateError("Select a target asset first.");
    return;
  }
  if (mode === "shop" && !state.shopAsset) {
    setGenerateError("Select one of your own assets to shop first.");
    return;
  }

  const fairnessPct = DEFAULT_FAIRNESS_PCT;
  const maxResults = DEFAULT_MAX_RESULTS;
  const tradeLab = getTradeLabSettings();
  setGenerateError("");

  try {
    setButtonLoading(el.generateBtn, true, "Building trade ideas...");
    await ensureValuesLoaded("");
    await waitForNextPaint();
    const leagueStrengthBaseline = getCachedLeagueStrengthBaseline({
      league: state.league,
      rosters: state.normalizedRosters,
      values: state.values,
    });
    let resultPayload = null;

    if (mode === "acquire") {
      const theirRoster = state.normalizedRosters.find((roster) => roster.rosterId === state.targetAsset.managerRosterId);
      if (!theirRoster) {
        setGenerateError("Could not resolve the other roster.");
        return;
      }
      resultPayload = await generateAcquisitionIdeaBuckets({
        meRoster,
        theirRoster,
        targetAsset: state.targetAsset,
        values: state.values,
        fairnessPct,
        maxResults,
        tradeLab,
        leagueStrengthBaseline,
      });
    } else if (mode === "shop") {
      resultPayload = await generateShopIdeaBuckets({
        meRoster,
        shopAsset: state.shopAsset,
        values: state.values,
        fairnessPct,
        maxResults,
        tradeLab,
        leagueStrengthBaseline,
      });
    } else if (mode === "surprise") {
      resultPayload = await generateSurpriseBlockbusterIdeas({
        meRoster,
        values: state.values,
        fairnessPct,
        maxResults,
        tradeLab,
      });
    }

    const totalIdeaCount = countIdeasInResultPayload(resultPayload);

    el.resultsSection.classList.remove("hidden");
    el.resultsSubtitle.textContent = buildResultsSubtitle({
      mode,
      meRoster,
      tradeLab,
      payload: resultPayload,
    });

    if (totalIdeaCount === 0) {
      el.resultsList.innerHTML = `<p class="muted">${buildNoIdeasMessage(tradeLab, mode)}</p>`;
      el.resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    await waitForNextPaint();
    el.resultsList.innerHTML = renderResultPayload(resultPayload, state.values);
    el.resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (err) {
    setGenerateError(`Could not load valuation source. ${err.message}`);
  } finally {
    setButtonLoading(el.generateBtn, false);
    syncGenerateState();
  }
}

function enrichTradeIdea({ idea, myRoster, theirRoster, values, leagueStrengthBaseline, includePowerUpgrade = true }) {
  const impactAnalysis = leagueStrengthBaseline
    ? buildTradeImpactAnalysis({
      baseline: leagueStrengthBaseline,
      league: state.league,
      rosters: state.normalizedRosters,
      myRoster,
      theirRoster,
      myAssets: idea.myAssets,
      theirAssets: idea.theirAssets,
      values,
    })
    : null;
  if (!includePowerUpgrade) {
    return {
      ...idea,
      impactAnalysis,
      powerUpgrade: null,
    };
  }
  const powerUpgrade = leagueStrengthBaseline
    ? buildTradePowerUpgrade({
      baseline: leagueStrengthBaseline,
      league: state.league,
      rosters: state.normalizedRosters,
      myRoster,
      myAssets: idea.myAssets,
      theirAssets: idea.theirAssets,
      values,
    })
    : null;
  const enriched = {
    ...idea,
    closestEvenPick: findClosestValuationPick(
      idea.evenValue,
      values,
      state.valueNameMap
    ),
    impactAnalysis,
    powerUpgrade,
  };

  return {
    ...enriched,
    tags: enriched.tags?.length ? enriched.tags : buildFallbackTradeTags(enriched),
    summary: enriched.summary || buildFallbackTradeSummary(enriched),
    pitch: enriched.pitch || buildFallbackTradePitch(enriched),
  };
}

function getTradeLabSettings() {
  return {
    allowPlayers: true,
    allowPicks: true,
    selectedOutgoingAssetIds: new Set(state.selectedOutgoingAssetIds),
    excludedOutgoingAssetIds: new Set(state.excludedOutgoingAssetIds),
    positionPremium: "none",
    tradeVibe: "balanced",
    teamState: getMyWindowCall()?.teamState || "middle",
  };
}

function countIdeasInResultPayload(payload) {
  if (!payload?.groups) return 0;
  return payload.groups.reduce((total, group) => total + (group.ideas?.length || 0), 0);
}

function renderResultPayload(payload, values) {
  if (!payload?.groups) return "";
  if (payload.kind === "multi-team") {
    return payload.groups.map((group) => renderMultiTeamIdeaGroup(group, values)).join("");
  }
  return payload.groups
    .map((group) => renderTradeIdeaGroup({
      title: group.title,
      subtitle: group.subtitle,
      emptyText: group.emptyText,
      ideas: group.ideas,
      values,
    }))
    .join("");
}

function buildResultsSubtitle({ mode, meRoster, tradeLab, payload }) {
  const notes = [];
  if (tradeLab.selectedOutgoingAssetIds.size > 0) {
    notes.push(`${tradeLab.selectedOutgoingAssetIds.size} locked in`);
  }
  if (tradeLab.excludedOutgoingAssetIds.size > 0) {
    notes.push(`${tradeLab.excludedOutgoingAssetIds.size} protected`);
  }
  const suffix = notes.length > 0 ? ` • ${notes.join(" • ")}` : "";

  if (mode === "shop") {
    return `${meRoster.manager.displayName} shopping ${payload?.focusAsset?.name || "one asset"} across the league${suffix}`;
  }
  if (mode === "surprise") {
    const participantCount = payload?.teamCount || 0;
    return `${meRoster.manager.displayName} exploring automatic ${participantCount}-team blockbusters${suffix}`;
  }
  return `${meRoster.manager.displayName} targeting ${payload?.focusAsset?.name || "a target"} from ${payload?.primaryCounterpartyName || "another manager"}${suffix}`;
}

function buildNoIdeasMessage(tradeLab, mode = "acquire") {
  const advice = [];
  if (tradeLab.selectedOutgoingAssetIds.size > 0) advice.push("require fewer included assets");
  if (tradeLab.excludedOutgoingAssetIds.size > 0) advice.push("exclude fewer assets");
  if (mode === "shop") {
    advice.push("shop a different asset");
  } else if (mode === "surprise") {
    advice.push("try again after values finish loading");
  } else {
    advice.push("change the target");
  }
  return `No offers cleared the value and roster-fit filters. Try to ${advice.join(", ")}.`;
}

function renderTradeIdeaGroup({ title, subtitle, emptyText, ideas, values }) {
  return `
    <section class="idea-group">
      <div class="idea-group-heading">
        <h3>${title}</h3>
        <p class="muted small">${subtitle}</p>
      </div>
      ${
        ideas.length > 0
          ? ideas.map((idea, idx) => renderTradeCard(idea, idx, values)).join("")
          : `<p class="muted small idea-group-empty">${emptyText}</p>`
      }
    </section>
  `;
}

function renderMultiTeamIdeaGroup(group, values) {
  return `
    <section class="idea-group">
      <div class="idea-group-heading">
        <h3>${group.title}</h3>
        <p class="muted small">${group.subtitle}</p>
      </div>
      ${
        group.ideas.length > 0
          ? group.ideas.map((idea, idx) => renderMultiTeamCard(idea, idx, values)).join("")
          : `<p class="muted small idea-group-empty">${group.emptyText}</p>`
      }
    </section>
  `;
}

function renderMultiTeamCard(idea, index, values) {
  return `
    <article class="multi-team-card">
      <div class="multi-team-card-header">
        <div>
          <h3>Idea ${index + 1}</h3>
          <p class="muted small">${idea.teamCount} teams • max ${idea.maxPctDiff}% diff • added value ${formatNumber(idea.extraMovedValueTotal || 0)} • common value ${formatNumber(idea.commonValue)}</p>
        </div>
        <div class="participant-pill-row">
          ${idea.tags.map((tag) => `<span class="participant-pill">${tag}</span>`).join("")}
        </div>
      </div>
      <div class="multi-team-party-grid">
        ${idea.participants.map((participant) => renderMultiTeamPartyCard(participant, values, idea.meRosterId)).join("")}
      </div>
      <p class="multi-team-flow">${idea.summary}</p>
    </article>
  `;
}

function renderMultiTeamPartyCard(participant, values, meRosterId) {
  const isMe = participant.roster.rosterId === meRosterId;
  const bridgeGapLabel = participant.netValueDelta === 0
    ? "even on raw value"
    : participant.netValueDelta > 0
      ? `receive +${formatNumber(participant.netValueDelta)} raw`
      : `send +${formatNumber(Math.abs(participant.netValueDelta))} raw`;
  const packageAdjustmentLabel = !participant.packageAdjustment
    ? "none"
    : `+${formatNumber(participant.packageAdjustment)} on ${participant.packageAdjustmentSide === "my" ? "your side" : "their side"}`;
  const receiveFromLabel = participant.receiveFromNames?.length
    ? participant.receiveFromNames.join(", ")
    : "trade partners";
  const sendToLabel = participant.sendToNames?.length
    ? participant.sendToNames.join(", ")
    : "trade partners";
  return `
    <section class="multi-team-party-card ${isMe ? "you" : "other"}">
      <h4>${isMe ? "You" : participant.roster.manager.displayName}</h4>
      <p class="muted small">${receiveFromLabel} to ${sendToLabel}</p>
      <div class="trade-body-grid">
        <section class="trade-side team-a">
          <div class="trade-side-heading">
            <span class="trade-side-kicker">Outgoing</span>
            <h4>Send</h4>
          </div>
          ${renderAssetList(participant.outgoingAssets, values, "team-a")}
        </section>
        <section class="trade-side team-b">
          <div class="trade-side-heading">
            <span class="trade-side-kicker">Incoming</span>
            <h4>Receive</h4>
          </div>
          ${renderAssetList(participant.incomingAssets, values, "team-b")}
        </section>
      </div>
      <div class="trade-metrics">
        <div class="trade-metric">
          <strong>Raw balance</strong>
          send ${formatNumber(participant.outgoingAdjustedValue)} vs receive ${formatNumber(participant.incomingAdjustedValue)} (${participant.pctDiff}% diff)
        </div>
        <div class="trade-metric">
          <strong>Bridge gap</strong>
          ${bridgeGapLabel}
        </div>
        <div class="trade-metric">
          <strong>Package adjustment</strong>
          ${packageAdjustmentLabel}
        </div>
      </div>
    </section>
  `;
}

function formatAssetNameList(assets) {
  return assets.map((asset) => asset.name).join(", ");
}

function renderMatchTradeCard(idea) {
  const copy = formatMatchIdeaCopy({
    sendNames: (idea.myAssets || []).map((asset) => asset.name),
    receiveNames: (idea.theirAssets || []).map((asset) => asset.name),
    beforeRank: idea.impactAnalysis?.mySide?.before?.rank,
    afterRank: idea.impactAnalysis?.mySide?.after?.rank,
    totalTeams: idea.impactAnalysis?.mySide?.before?.totalTeams
      || idea.impactAnalysis?.mySide?.after?.totalTeams,
  });
  return `
    <article class="match-trade-card">
      <p class="match-trade-offer">${escapeHtml(copy.offer)}</p>
      ${copy.rank ? `<p class="match-trade-rank">${escapeHtml(copy.rank)}</p>` : ""}
    </article>
  `;
}

function renderTradeCard(idea, index, values) {
  const evenValueLabel = formatEvenValueDisplay(idea);
  const isInitiallyOpen = index === 0;
  const powerLabel = idea.powerUpgrade
    ? `${idea.powerUpgrade.before.score} → ${idea.powerUpgrade.after.score}`
    : `${idea.labScore || 0}/99`;
  const powerDeltaLabel = idea.powerUpgrade
    ? formatSignedNumber(idea.powerUpgrade.delta)
    : `${idea.labScore || 0} fit`;
  const powerDeltaClass = idea.powerUpgrade?.delta > 0 ? "good" : idea.powerUpgrade?.delta < 0 ? "bad" : "";
  return `
    <details class="trade-card" ${isInitiallyOpen ? "open" : ""}>
      <summary class="trade-card-summary">
        <div>
          <h3>Idea ${index + 1}</h3>
          ${idea.counterpartyName ? `<p class="trade-card-context">with ${idea.counterpartyName}</p>` : ""}
          <p class="trade-card-preview">
            Send ${formatAssetNameList(idea.myAssets)} for ${formatAssetNameList(idea.theirAssets)}
          </p>
        </div>
        <div class="trade-summary-score ${powerDeltaClass}">
          <strong>${powerLabel}</strong>
          <span>${powerDeltaLabel}</span>
        </div>
        <span class="trade-card-toggle" aria-hidden="true"></span>
      </summary>
      <div class="trade-card-body">
        ${idea.powerUpgrade ? renderGameImpact(idea.powerUpgrade, idea) : ""}
        ${renderTradeNarrative(idea)}
        <div class="trade-body-grid">
          <section class="trade-side team-a">
            <div class="trade-side-heading">
              <span class="trade-side-kicker">Outgoing</span>
              <h4>You send</h4>
            </div>
            ${renderAssetList(idea.myAssets, values, "team-a")}
          </section>
          <section class="trade-side team-b">
            <div class="trade-side-heading">
              <span class="trade-side-kicker">Incoming</span>
              <h4>You receive</h4>
            </div>
            ${renderAssetList(idea.theirAssets, values, "team-b")}
          </section>
        </div>
        <div class="trade-metrics">
          <div class="trade-metric">
            <strong>Adjusted value</strong>
            you ${formatNumber(idea.myAdjustedValue)} vs them ${formatNumber(idea.theirAdjustedValue)} (${idea.pctDiff}% apart)
          </div>
          <div class="trade-metric">
            <strong>Elite premium</strong>
            Top players are weighted above raw KTC package value.
          </div>
          <div class="trade-metric">
            <strong>Even-up value</strong>
            ${evenValueLabel}
          </div>
        </div>
        ${idea.impactAnalysis ? renderImpactAnalysis(idea.impactAnalysis, values) : ""}
      </div>
    </details>
  `;
}

function formatEvenValueDisplay(idea) {
  if (!idea.closestEvenPick) return formatNumber(idea.evenValue);
  return `${idea.closestEvenPick.name} (${formatNumber(idea.closestEvenPick.value)})`;
}

function renderGameImpact(upgrade, idea) {
  const deltaClass = upgrade.delta > 0 ? "good" : upgrade.delta < 0 ? "bad" : "";
  return `
    <section class="game-impact ${deltaClass}">
      <div class="game-impact-main">
        <div>
          <span class="game-kicker">Power Quest</span>
          <h4>${upgrade.before.score} → ${upgrade.after.score} Team Power</h4>
          <p>${upgrade.summary}</p>
        </div>
        <div class="xp-chip ${deltaClass}">
          <strong>${formatSignedNumber(upgrade.delta)}</strong>
          <span>${formatNumber(upgrade.xp)} XP</span>
        </div>
      </div>
      <div class="power-progress-pair">
        ${renderPowerProgress("Current", upgrade.before.score)}
        ${renderPowerProgress("After Trade", upgrade.after.score)}
      </div>
      <div class="power-badge-row">
        ${upgrade.badges.map((badge) => `<span class="power-badge">${badge}</span>`).join("")}
        ${idea.labScore ? `<span class="power-badge muted-badge">Deal Fit ${idea.labScore}/99</span>` : ""}
      </div>
    </section>
  `;
}

function renderPowerProgress(label, score) {
  return `
    <div class="power-progress">
      <div class="position-meter-top">
        <strong>${label}</strong>
        <span>${score}/100</span>
      </div>
      <div class="meter-track" aria-hidden="true">
        <span style="width:${score}%"></span>
      </div>
    </div>
  `;
}

function renderTradeNarrative(idea) {
  const tags = idea.tags?.length
    ? `<div class="power-badge-row">${idea.tags.map((tag) => `<span class="power-badge">${tag}</span>`).join("")}</div>`
    : "";
  return `
    <section class="trade-narrative">
      ${tags}
      ${idea.summary ? `<p>${idea.summary}</p>` : ""}
      ${idea.pitch ? `<blockquote>${idea.pitch}</blockquote>` : ""}
    </section>
  `;
}

function renderImpactAnalysis(impactAnalysis, values) {
  return `
    <div class="impact-overview">
      ${renderImpactCard(impactAnalysis.mySide, "team-a")}
      ${renderImpactCard(impactAnalysis.theirSide, "team-b")}
    </div>
    <p class="muted small">${impactAnalysis.overallSummary}</p>
    <details class="lineup-details">
      <summary>View lineup impact</summary>
      <div class="lineup-details-body">
        <div class="lineup-comparison-grid">
          ${renderLineupStateCard("You After", impactAnalysis.mySide.after, values, "team-a")}
          ${renderLineupStateCard("Them After", impactAnalysis.theirSide.after, values, "team-b")}
          ${renderLineupStateCard("You Before", impactAnalysis.mySide.before, values, "team-a")}
          ${renderLineupStateCard("Them Before", impactAnalysis.theirSide.before, values, "team-b")}
        </div>
      </div>
    </details>
  `;
}

function renderImpactCard(side, teamClass = "") {
  return `
    <section class="impact-card ${teamClass}">
      <h4>${side.title}</h4>
      <span class="impact-verdict ${side.verdictClass}">${side.verdictLabel}</span>
      <p class="impact-summary">${side.summary}</p>
      <div class="impact-metric-list">
        <div class="impact-metric-row">
          <strong>Starter rank</strong>
          <span>${formatStarterRank(side.before.rank, side.before.totalTeams)} to ${formatStarterRank(side.after.rank, side.after.totalTeams)}</span>
        </div>
        <div class="impact-metric-row">
          <strong>Starter value</strong>
          <span>${formatDeltaPair(side.before.starterValue, side.after.starterValue)}</span>
        </div>
        <div class="impact-metric-row">
          <strong>Bench value</strong>
          <span>${formatDeltaPair(side.before.benchValue, side.after.benchValue)}</span>
        </div>
        <div class="impact-metric-row">
          <strong>Total roster value</strong>
          <span>${formatDeltaPair(side.before.totalValue, side.after.totalValue)}</span>
        </div>
      </div>
    </section>
  `;
}

function renderLineupStateCard(label, snapshot, values, teamClass = "") {
  return `
    <section class="lineup-state ${teamClass}">
      <h5>${label}</h5>
      <p>${formatStarterRank(snapshot.rank, snapshot.totalTeams)} lineup • ${formatNumber(snapshot.starterValue)} starters • ${formatNumber(snapshot.benchValue)} bench</p>
      <ul class="lineup-slot-list">
        ${snapshot.lineup
          .map((slotEntry) => `
            <li class="lineup-slot-item">
              <span class="lineup-slot-label">${formatRosterSlotLabel(slotEntry.slot)}</span>
              <span class="lineup-slot-player">${slotEntry.asset ? slotEntry.asset.name : "Open spot"}</span>
              <span class="lineup-slot-value">${slotEntry.asset ? formatNumber(getAssetValue(slotEntry.asset, values)) : "0"}</span>
            </li>
          `)
          .join("")}
      </ul>
      <p class="muted small">Bench headliners</p>
      <ul class="bench-list">
        ${snapshot.benchHighlights.length > 0
          ? snapshot.benchHighlights
            .map((asset) => `
              <li class="bench-item">
                <span class="lineup-slot-player">${asset.name}</span>
                <span class="lineup-slot-value">${formatNumber(getAssetValue(asset, values))}</span>
              </li>
            `)
            .join("")
          : `<li class="bench-item"><span class="lineup-slot-player muted">No bench players</span><span class="lineup-slot-value">0</span></li>`}
      </ul>
    </section>
  `;
}

function formatDeltaPair(before, after) {
  const delta = after - before;
  return `${formatNumber(before)} to ${formatNumber(after)} (${delta >= 0 ? "+" : ""}${formatNumber(delta)})`;
}

function getCachedLeagueStrengthBaseline({ league, rosters, values } = {}) {
  const resolvedLeague = league || state.league;
  const resolvedRosters = rosters || state.normalizedRosters;
  const resolvedValues = values || state.values;
  const rosterSig = (resolvedRosters || [])
    .map((roster) => `${roster.rosterId}:${(roster.assets || []).map((asset) => asset.assetId).join(",")}`)
    .join("|");
  const key = [
    resolvedLeague?.league_id || state.leagueId || "",
    valuationCacheVersion(),
    rosterSig,
  ].join("::");
  if (leagueStrengthCache.key === key && leagueStrengthCache.baseline) return leagueStrengthCache.baseline;
  const baseline = buildLeagueStrengthBaseline({
    league: resolvedLeague,
    rosters: resolvedRosters,
    values: resolvedValues,
  });
  leagueStrengthCache.key = key;
  leagueStrengthCache.baseline = baseline;
  return baseline;
}

function buildLeagueStrengthBaseline({ league, rosters, values }) {
  const metricsByRosterId = new Map();
  rosters.forEach((roster) => {
    metricsByRosterId.set(roster.rosterId, evaluateRosterStrength(roster, values, league));
  });

  return {
    metricsByRosterId,
    ranks: rankRosterMetrics(metricsByRosterId),
  };
}

function buildTradeImpactAnalysis({ baseline, league, rosters, myRoster, theirRoster, myAssets, theirAssets, values }) {
  const totalTeams = rosters.length || state.normalizedRosters.length || 0;
  const myBeforeMetrics = baseline.metricsByRosterId.get(myRoster.rosterId);
  const theirBeforeMetrics = baseline.metricsByRosterId.get(theirRoster.rosterId);
  const myAfterRoster = buildRosterAfterTrade(myRoster, theirAssets, myAssets);
  const theirAfterRoster = buildRosterAfterTrade(theirRoster, myAssets, theirAssets);
  const myAfterMetrics = evaluateRosterStrength(myAfterRoster, values, league);
  const theirAfterMetrics = evaluateRosterStrength(theirAfterRoster, values, league);

  const afterMetricsByRosterId = new Map(baseline.metricsByRosterId);
  afterMetricsByRosterId.set(myRoster.rosterId, myAfterMetrics);
  afterMetricsByRosterId.set(theirRoster.rosterId, theirAfterMetrics);

  const afterRanks = rankRosterMetrics(afterMetricsByRosterId);
  const mySide = buildTradeImpactSide({
    title: "You",
    managerName: myRoster.manager.displayName,
    beforeMetrics: myBeforeMetrics,
    afterMetrics: myAfterMetrics,
    beforeRank: baseline.ranks.get(myRoster.rosterId) || state.normalizedRosters.length,
    afterRank: afterRanks.get(myRoster.rosterId) || state.normalizedRosters.length,
    totalTeams,
  });
  const theirSide = buildTradeImpactSide({
    title: "Them",
    managerName: theirRoster.manager.displayName,
    beforeMetrics: theirBeforeMetrics,
    afterMetrics: theirAfterMetrics,
    beforeRank: baseline.ranks.get(theirRoster.rosterId) || state.normalizedRosters.length,
    afterRank: afterRanks.get(theirRoster.rosterId) || state.normalizedRosters.length,
    totalTeams,
  });

  return {
    mySide,
    theirSide,
    overallSummary: buildOverallTradeImpactSummary(mySide, theirSide),
  };
}

function buildTradePowerUpgrade({ baseline, league, rosters, myRoster, myAssets, theirAssets, values }) {
  const beforeContext = buildLeaguePowerContext({
    league,
    rosters,
    values,
    metricsByRosterId: baseline.metricsByRosterId,
  });
  const beforeProfile = buildTeamPowerProfile({
    roster: myRoster,
    values,
    league,
    context: beforeContext,
    metrics: baseline.metricsByRosterId.get(myRoster.rosterId),
    rank: baseline.ranks.get(myRoster.rosterId),
  });
  const afterRoster = buildRosterAfterTrade(myRoster, theirAssets, myAssets);
  const afterMetricsByRosterId = new Map(baseline.metricsByRosterId);
  afterMetricsByRosterId.set(myRoster.rosterId, evaluateRosterStrength(afterRoster, values, league));
  const afterRanks = rankRosterMetrics(afterMetricsByRosterId);
  const afterContext = buildLeaguePowerContext({
    league,
    rosters,
    values,
    metricsByRosterId: afterMetricsByRosterId,
  });
  const afterProfile = buildTeamPowerProfile({
    roster: afterRoster,
    values,
    league,
    context: afterContext,
    metrics: afterMetricsByRosterId.get(myRoster.rosterId),
    rank: afterRanks.get(myRoster.rosterId),
  });
  const delta = afterProfile.score - beforeProfile.score;

  return {
    before: beforeProfile,
    after: afterProfile,
    delta,
    xp: calculateTradeXp({ beforeProfile, afterProfile, delta }),
    badges: buildTradePowerBadges({ beforeProfile, afterProfile, delta, myAssets, theirAssets }),
    summary: buildTradePowerSummary({ beforeProfile, afterProfile, delta }),
  };
}

function calculateTradeXp({ beforeProfile, afterProfile, delta }) {
  const rankGain = Math.max(0, beforeProfile.rank - afterProfile.rank);
  const starterGain = Math.max(0, afterProfile.metrics.starterValue - beforeProfile.metrics.starterValue);
  const base = delta > 0 ? 120 : 45;
  return Math.round(base + Math.max(0, delta) * 95 + rankGain * 160 + Math.min(900, starterGain * 0.18));
}

function buildTradePowerBadges({ beforeProfile, afterProfile, delta, myAssets, theirAssets }) {
  const badges = [];
  if (delta >= 5) badges.push("Major Power-Up");
  if (delta > 0 && delta < 5) badges.push("Roster Buff");
  if (afterProfile.rank < beforeProfile.rank) badges.push(`Rank +${beforeProfile.rank - afterProfile.rank}`);
  if (afterProfile.metrics.starterValue > beforeProfile.metrics.starterValue + 300) badges.push("Lineup Boost");
  if (afterProfile.assetSummary.pickValue > beforeProfile.assetSummary.pickValue + 800) badges.push("Pick Vault Up");
  if (theirAssets.length < myAssets.length) badges.push("Consolidation");
  if (theirAssets.length > myAssets.length) badges.push("Depth Gain");
  if (afterProfile.weakestPosition?.position !== beforeProfile.weakestPosition?.position) badges.push("Hole Patched");
  if (badges.length === 0) badges.push(delta >= 0 ? "Clean Value" : "Risk-Reward");
  return badges.slice(0, 5);
}

function buildTradePowerSummary({ beforeProfile, afterProfile, delta }) {
  const parts = [];
  parts.push(delta > 0
    ? `adds ${delta} power point${delta === 1 ? "" : "s"}`
    : delta < 0
      ? `costs ${Math.abs(delta)} power point${Math.abs(delta) === 1 ? "" : "s"}`
      : "keeps your power score flat");

  if (afterProfile.rank < beforeProfile.rank) {
    parts.push(`lineup rank climbs from ${ordinal(beforeProfile.rank)} to ${ordinal(afterProfile.rank)}`);
  } else if (afterProfile.rank > beforeProfile.rank) {
    parts.push(`lineup rank falls from ${ordinal(beforeProfile.rank)} to ${ordinal(afterProfile.rank)}`);
  } else {
    parts.push(`lineup rank stays ${ordinal(afterProfile.rank)}`);
  }

  const starterDelta = afterProfile.metrics.starterValue - beforeProfile.metrics.starterValue;
  if (starterDelta !== 0) {
    parts.push(`starters ${starterDelta > 0 ? "gain" : "lose"} ${formatNumber(Math.abs(starterDelta))}`);
  }

  return `This trade ${parts.join(", ")}.`;
}

function buildTradeImpactSide({ title, managerName, beforeMetrics, afterMetrics, beforeRank, afterRank, totalTeams }) {
  const starterDelta = afterMetrics.starterValue - beforeMetrics.starterValue;
  const benchDelta = afterMetrics.benchValue - beforeMetrics.benchValue;
  const totalDelta = afterMetrics.totalValue - beforeMetrics.totalValue;
  const verdict = classifyTradeImpact({ starterDelta, beforeRank, afterRank, totalDelta });

  return {
    title,
    managerName,
    verdictLabel: verdict.label,
    verdictClass: verdict.className,
    summary: buildTradeImpactSummary({ beforeRank, afterRank, starterDelta, benchDelta, totalDelta }),
    detailSummary: `${managerName} • ${formatStarterRank(beforeRank, totalTeams)} to ${formatStarterRank(afterRank, totalTeams)} starting lineup`,
    before: {
      ...beforeMetrics,
      rank: beforeRank,
      totalTeams,
    },
    after: {
      ...afterMetrics,
      rank: afterRank,
      totalTeams,
    },
  };
}

function formatStarterRank(rank, totalTeams) {
  if (!Number.isFinite(rank)) return "";
  if (!Number.isFinite(totalTeams) || totalTeams <= 0) return ordinal(rank);
  return `${ordinal(rank)}/${totalTeams}`;
}

function classifyTradeImpact({ starterDelta, beforeRank, afterRank, totalDelta }) {
  if (afterRank < beforeRank || starterDelta >= 350) {
    return { label: "Better weekly lineup", className: "good" };
  }
  if (afterRank > beforeRank || starterDelta <= -350) {
    return { label: "Worse weekly lineup", className: "bad" };
  }
  if (totalDelta >= 350) {
    return { label: "More total value", className: "good" };
  }
  if (totalDelta <= -350) {
    return { label: "Paying a premium", className: "bad" };
  }
  return { label: "Mostly neutral", className: "" };
}

function buildTradeImpactSummary({ beforeRank, afterRank, starterDelta, benchDelta, totalDelta }) {
  const notes = [];

  if (afterRank < beforeRank) {
    notes.push(`starting lineup climbs from ${ordinal(beforeRank)} to ${ordinal(afterRank)}`);
  } else if (afterRank > beforeRank) {
    notes.push(`starting lineup falls from ${ordinal(beforeRank)} to ${ordinal(afterRank)}`);
  } else {
    notes.push(`starting lineup stays ${ordinal(afterRank)}`);
  }

  notes.push(buildDeltaPhrase("starters", starterDelta));
  notes.push(buildDeltaPhrase("bench", benchDelta));
  notes.push(buildDeltaPhrase("total value", totalDelta));

  return `${notes.slice(0, 3).join(", ")}.`;
}

function buildDeltaPhrase(label, delta) {
  if (delta === 0) return `${label} flat`;
  return `${label} ${delta > 0 ? "up" : "down"} ${formatNumber(Math.abs(delta))}`;
}

function buildOverallTradeImpactSummary(mySide, theirSide) {
  const myImproved = mySide.after.rank < mySide.before.rank || mySide.after.starterValue > mySide.before.starterValue;
  const theirImproved = theirSide.after.rank < theirSide.before.rank || theirSide.after.starterValue > theirSide.before.starterValue;

  if (myImproved && !theirImproved) {
    return `This trade improves your weekly lineup while making theirs weaker or thinner.`;
  }
  if (!myImproved && theirImproved) {
    return `This trade helps their weekly lineup more than yours, even if the value stays close.`;
  }
  if (myImproved && theirImproved) {
    return `This trade improves both starting lineups, so the deal is more about which team values the target archetype most.`;
  }
  return `This trade looks more like a value shuffle than a weekly-lineup upgrade for either side.`;
}

function buildRosterAfterTrade(roster, incomingAssets, outgoingAssets) {
  const outgoingIds = new Set(outgoingAssets.map((asset) => asset.assetId));
  return {
    ...roster,
    assets: [
      ...roster.assets.filter((asset) => !outgoingIds.has(asset.assetId)),
      ...incomingAssets,
    ],
  };
}

function evaluateRosterStrength(roster, values, league) {
  const starterSlots = getStarterRosterSlots(league);
  const lineupResult = buildOptimalStartingLineup(roster.assets, starterSlots, values);

  return {
    lineup: lineupResult.starters,
    starterValue: lineupResult.starterValue,
    benchValue: lineupResult.benchValue,
    benchHighlights: lineupResult.benchAssets.slice(0, 5),
    totalValue: Math.round(roster.assets.reduce((sum, asset) => sum + getAssetValue(asset, values), 0)),
  };
}

function rankRosterMetrics(metricsByRosterId) {
  const ranked = [...metricsByRosterId.entries()].sort((left, right) => {
    const strengthComparison = compareRosterStrength(left[1], right[1]);
    if (strengthComparison !== 0) return strengthComparison;
    return Number(left[0]) - Number(right[0]);
  });

  return ranked.reduce((acc, [rosterId], index) => {
    acc.set(rosterId, index + 1);
    return acc;
  }, new Map());
}

function compareRosterStrength(left, right) {
  if (right.starterValue !== left.starterValue) return right.starterValue - left.starterValue;
  if (right.benchValue !== left.benchValue) return right.benchValue - left.benchValue;
  return right.totalValue - left.totalValue;
}

function buildOptimalStartingLineup(assets, starterSlots, values) {
  const playerEntries = assets
    .filter((asset) => asset.assetType === "player")
    .map((asset) => ({
      asset,
      value: lineupFillValue({
        startChance: weeklyModelForAsset(asset)?.score,
        dynastyValue: getAssetValue(asset, values),
      }),
    }))
    .sort((a, b) => b.value - a.value);

  const candidates = buildLineupCandidatePool(playerEntries, starterSlots);
  const slotEntries = starterSlots
    .map((slot, index) => ({ slot, index }))
    .sort((left, right) => {
      const eligibleDiff = countEligibleCandidates(candidates, left.slot) - countEligibleCandidates(candidates, right.slot);
      if (eligibleDiff !== 0) return eligibleDiff;
      return getSlotFlexWeight(left.slot) - getSlotFlexWeight(right.slot);
    });

  const bestPlan = shouldUseExactLineupSolver(slotEntries, candidates)
    ? chooseBestLineup(slotEntries, candidates, 0, 0n, new Map())
    : chooseGreedyLineup(slotEntries, candidates);
  const starters = bestPlan.picks
    .map((candidateIndex, slotIndex) => ({
      slot: slotEntries[slotIndex].slot,
      originalIndex: slotEntries[slotIndex].index,
      asset: candidateIndex == null ? null : candidates[candidateIndex].asset,
    }))
    .sort((left, right) => left.originalIndex - right.originalIndex)
    .map(({ slot, asset }) => ({ slot, asset }));

  const starterIds = new Set(starters.filter((entry) => entry.asset).map((entry) => entry.asset.assetId));
  const benchAssets = playerEntries
    .filter((entry) => !starterIds.has(entry.asset.assetId))
    .map((entry) => entry.asset);

  return {
    starters,
    starterValue: Math.round(starters.reduce((sum, entry) => sum + (entry.asset ? getAssetValue(entry.asset, values) : 0), 0)),
    benchAssets,
    benchValue: Math.round(benchAssets.reduce((sum, asset) => sum + getAssetValue(asset, values), 0)),
  };
}

function shouldUseExactLineupSolver(slotEntries, candidates) {
  return slotEntries.length <= LINEUP_EXACT_SOLVER_SLOT_LIMIT
    && candidates.length <= LINEUP_EXACT_SOLVER_CANDIDATE_LIMIT;
}

function chooseBestLineup(slotEntries, candidates, slotIndex, usedMask, memo) {
  const memoKey = `${slotIndex}:${usedMask.toString()}`;
  if (memo.has(memoKey)) return memo.get(memoKey);
  if (slotIndex >= slotEntries.length) {
    const emptyResult = { score: 0, picks: [] };
    memo.set(memoKey, emptyResult);
    return emptyResult;
  }

  let bestResult = {
    score: Number.NEGATIVE_INFINITY,
    picks: [],
  };
  const slot = slotEntries[slotIndex].slot;

  for (let candidateIndex = 0; candidateIndex < candidates.length; candidateIndex += 1) {
    const candidateBit = 1n << BigInt(candidateIndex);
    if ((usedMask & candidateBit) !== 0n) continue;
    if (!assetCanFillRosterSlot(candidates[candidateIndex].asset, slot)) continue;

    const child = chooseBestLineup(slotEntries, candidates, slotIndex + 1, usedMask | candidateBit, memo);
    const totalScore = candidates[candidateIndex].value + child.score;
    if (totalScore > bestResult.score) {
      bestResult = {
        score: totalScore,
        picks: [candidateIndex, ...child.picks],
      };
    }
  }

  const skipChild = chooseBestLineup(slotEntries, candidates, slotIndex + 1, usedMask, memo);
  if (skipChild.score > bestResult.score) {
    bestResult = {
      score: skipChild.score,
      picks: [null, ...skipChild.picks],
    };
  }

  memo.set(memoKey, bestResult);
  return bestResult;
}

function chooseGreedyLineup(slotEntries, candidates) {
  const usedCandidateIndexes = new Set();
  const picks = [];
  let score = 0;

  for (const slotEntry of slotEntries) {
    let bestCandidateIndex = null;
    for (let candidateIndex = 0; candidateIndex < candidates.length; candidateIndex += 1) {
      if (usedCandidateIndexes.has(candidateIndex)) continue;
      if (!assetCanFillRosterSlot(candidates[candidateIndex].asset, slotEntry.slot)) continue;
      if (bestCandidateIndex == null || candidates[candidateIndex].value > candidates[bestCandidateIndex].value) {
        bestCandidateIndex = candidateIndex;
      }
    }

    if (bestCandidateIndex == null) {
      picks.push(null);
      continue;
    }

    usedCandidateIndexes.add(bestCandidateIndex);
    picks.push(bestCandidateIndex);
    score += candidates[bestCandidateIndex].value;
  }

  return { score, picks };
}

function buildLineupCandidatePool(playerEntries, starterSlots) {
  const candidateMap = new Map();
  const maxPerSlot = Math.min(
    playerEntries.length,
    Math.max(LINEUP_CANDIDATE_FLOOR, starterSlots.length + LINEUP_CANDIDATE_BUFFER)
  );

  starterSlots.forEach((slot) => {
    playerEntries
      .filter((entry) => assetCanFillRosterSlot(entry.asset, slot))
      .slice(0, maxPerSlot)
      .forEach((entry) => {
        candidateMap.set(entry.asset.assetId, entry);
      });
  });

  return [...candidateMap.values()].sort((a, b) => b.value - a.value);
}

function countEligibleCandidates(candidates, slot) {
  return candidates.reduce((count, candidate) => count + (assetCanFillRosterSlot(candidate.asset, slot) ? 1 : 0), 0);
}

function getStarterRosterSlots(league) {
  const defaultSlots = ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "SUPER_FLEX"];
  const starterlessSlots = new Set(["BN", "BENCH", "IR", "TAXI", "RESERVE", "PUP", "NA"]);
  const rosterPositions = Array.isArray(league?.roster_positions) && league.roster_positions.length > 0
    ? league.roster_positions
    : defaultSlots;

  return rosterPositions
    .map(normalizeRosterSlot)
    .filter((slot) => slot && !starterlessSlots.has(slot));
}

function normalizeRosterSlot(slot) {
  return String(slot || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");
}

function getSlotFlexWeight(slot) {
  return getAllowedPositionsForSlot(slot).size;
}

function getAllowedPositionsForSlot(slot) {
  const normalizedSlot = normalizeRosterSlot(slot);
  const explicitSlotMap = {
    FLEX: ["RB", "WR", "TE"],
    WRT: ["RB", "WR", "TE"],
    WRRB_FLEX: ["RB", "WR"],
    WRRB: ["RB", "WR"],
    RBWR_FLEX: ["RB", "WR"],
    REC_FLEX: ["WR", "TE"],
    WRTE_FLEX: ["WR", "TE"],
    SUPER_FLEX: ["QB", "RB", "WR", "TE"],
    OP: ["QB", "RB", "WR", "TE"],
    IDP_FLEX: ["DL", "DE", "DT", "LB", "DB", "CB", "S"],
    DL_LB_FLEX: ["DL", "DE", "DT", "LB"],
    DB_FLEX: ["DB", "CB", "S"],
    DL_DB_FLEX: ["DL", "DE", "DT", "DB", "CB", "S"],
  };

  if (explicitSlotMap[normalizedSlot]) return new Set(explicitSlotMap[normalizedSlot]);
  if (normalizedSlot.includes("/")) {
    return new Set(
      normalizedSlot
        .split("/")
        .flatMap((part) => [...getAllowedPositionsForSlot(part)])
    );
  }

  return new Set([normalizedSlot]);
}

function playerPositionsForAsset(asset) {
  const fantasyPositions = Array.isArray(asset?.raw?.fantasy_positions) ? asset.raw.fantasy_positions : [];
  const rawPositions = fantasyPositions.length > 0 ? fantasyPositions : [asset?.raw?.position].filter(Boolean);
  return rawPositions.map((position) => normalizePlayerPosition(position));
}

function normalizePlayerPosition(position) {
  const normalized = String(position || "").trim().toUpperCase();
  if (normalized === "D/ST" || normalized === "DST") return "DEF";
  return normalized;
}

function assetCanFillRosterSlot(asset, slot) {
  if (asset.assetType !== "player") return false;
  const playerPositions = playerPositionsForAsset(asset);
  const allowedPositions = getAllowedPositionsForSlot(slot);
  return playerPositions.some((position) => allowedPositions.has(position));
}

function formatRosterSlotLabel(slot) {
  const labels = {
    SUPER_FLEX: "SFlex",
    REC_FLEX: "Rec Flex",
    WRRB_FLEX: "RB/WR",
    RBWR_FLEX: "RB/WR",
    WRTE_FLEX: "WR/TE",
    FLEX: "Flex",
  };
  return labels[slot] || slot.replace(/_/g, " ");
}

function findClosestValuationPick(targetValue, values, valueNameMap) {
  if (!Number.isFinite(targetValue) || targetValue <= 0) return null;

  const catalog = state.pickValueCatalog.length > 0
    ? state.pickValueCatalog
    : buildPickValuationCatalog(values, valueNameMap);
  let closestPick = null;

  catalog.forEach((pick) => {
    const gap = Math.abs(pick.value - targetValue);
    if (!closestPick || gap < closestPick.gap || (gap === closestPick.gap && pick.value > closestPick.value)) {
      closestPick = {
        ...pick,
        gap,
      };
    }
  });

  return closestPick;
}

function getRequestedTierIds() {
  const tradeTier = getTradeTier();
  return tradeTier === "all" ? ["level-up", "even", "break-down"] : [tradeTier];
}

function getTradeTierCopy(tierId, mode, focusAssetName = "the target") {
  const byTier = {
    "level-up": {
      title: "Level Up",
      acquisitionSubtitle: `Add pieces to climb into ${focusAssetName}.`,
      shopSubtitle: `Use your asset as the anchor for a better player coming back.`,
      emptyText: "No level-up packages fit the current setup.",
    },
    even: {
      title: "Trade Even",
      acquisitionSubtitle: "Keep it tight with one-for-one or clean one-for-two structures.",
      shopSubtitle: "Look for sideways swaps that stay close to market.",
      emptyText: "No even swaps cleared the filters.",
    },
    "break-down": {
      title: "Break Down",
      acquisitionSubtitle: `${focusAssetName} plus extra pieces back from the other side.`,
      shopSubtitle: "Move one stronger asset for multiple useful pieces.",
      emptyText: "No break-down packages fit the current setup.",
    },
  };
  const copy = byTier[tierId];
  return {
    title: copy.title,
    subtitle: mode === "shop" ? copy.shopSubtitle : copy.acquisitionSubtitle,
    emptyText: copy.emptyText,
  };
}

function dedupeTwoTeamIdeas(ideas) {
  const seen = new Set();
  const output = [];
  for (const idea of ideas) {
    const key = [
      idea.counterpartyRosterId || "",
      idea.myAssets.map((asset) => asset.assetId).sort().join("|"),
      idea.theirAssets.map((asset) => asset.assetId).sort().join("|"),
    ].join("=>");
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(idea);
  }
  return output;
}

function classifyTwoTeamTradeTier(idea, focusAsset, values, { mode = "acquire" } = {}) {
  const myProfile = buildPackageProfile(idea.myAssets, values);
  const theirProfile = buildPackageProfile(idea.theirAssets, values);
  const leadOutgoingValue = myProfile.topValue || 0;
  const leadIncomingValue = theirProfile.topValue || 0;
  const incomingShare = theirProfile.totalValue > 0 ? leadIncomingValue / theirProfile.totalValue : 1;

  if (
    theirProfile.packageSize >= 2
    && (
      incomingShare < 0.72
      || leadOutgoingValue >= leadIncomingValue * (mode === "shop" ? 1.03 : 1.08)
      || (focusAsset && getAssetValue(focusAsset, values) > leadIncomingValue * 1.04)
    )
  ) {
    return "break-down";
  }

  if (
    leadIncomingValue >= leadOutgoingValue * 1.12
    || myProfile.packageSize > theirProfile.packageSize
    || (mode === "shop" && theirProfile.packageSize === 1 && leadIncomingValue > getAssetValue(focusAsset, values) * 1.08)
  ) {
    return "level-up";
  }

  return "even";
}

async function generateAcquisitionIdeaBuckets({
  meRoster,
  theirRoster,
  targetAsset,
  values,
  fairnessPct,
  maxResults,
  tradeLab,
  leagueStrengthBaseline,
}) {
  const targetValue = getAssetValue(targetAsset, values);
  const ideas = [];
  const plans = ["level-up", "even", "break-down"].flatMap((tierId) =>
    getAcquisitionTierPlans(tierId).map((plan) => ({ ...plan, tierId }))
  );
  const searchContext = buildTradeSearchContext({
    myRoster: meRoster,
    targetAsset,
    values,
    fairnessPct,
    tradeLab,
    maxOutgoingAssetsOverride: Math.max(...plans.map((plan) => plan.maxOutgoingAssets)),
  });

  if (searchContext) {
    for (const plan of plans) {
      await waitForNextPaint();
      const myPackages = searchContext.myPackages.filter((pkg) => pkg.assets.length <= plan.maxOutgoingAssets);
      ideas.push(
        ...suggestTrades({
          myRoster: meRoster,
          theirRoster,
          targetAsset,
          values,
          fairnessPct,
          maxResults: maxResults * 6,
          allowExtraTargetAssets: plan.allowExtraTargetAssets,
          requireExtraTargetAsset: plan.requireExtraTargetAsset,
          maxExtraTargetAssets: plan.maxExtraTargetAssets,
          maxExtraTargetAssetShare: plan.maxExtraTargetAssetShare,
          maxExtraTargetTotalShare: plan.maxExtraTargetTotalShare,
          tradeLab,
          searchContext: {
            ...searchContext,
            myPackages,
            maxOutgoingAssets: plan.maxOutgoingAssets,
          },
        }).map((idea) => ({
          ...idea,
          counterpartyName: theirRoster.manager.displayName,
          counterpartyRosterId: theirRoster.rosterId,
        }))
      );
    }
  }

  const finalizedIdeas = selectDiverseTradeIdeas(
    dedupeTwoTeamIdeas(ideas).sort((a, b) => compareTradeIdeas(a, b)),
    maxResults,
    values,
    tradeLab.selectedOutgoingAssetIds
  ).map((idea) => enrichTradeIdea({
    idea,
    myRoster: meRoster,
    theirRoster,
    values,
    leagueStrengthBaseline,
  })).sort(compareEnrichedTradeIdeas);

  return {
    kind: "two-team",
    focusAsset: targetAsset,
    primaryCounterpartyName: theirRoster.manager.displayName,
    groups: [{
      title: "Best Trade Ideas",
      subtitle: `Simple offers for ${targetAsset.name}.`,
      emptyText: "No trade ideas fit the current setup.",
      ideas: finalizedIdeas,
    }],
    referenceValue: targetValue,
  };
}

function getAcquisitionTierPlans(tierId) {
  if (tierId === "level-up") {
    return [
      {
        allowExtraTargetAssets: false,
        requireExtraTargetAsset: false,
        maxOutgoingAssets: ELITE_MAX_OUTGOING_PACKAGE_SIZE,
        maxExtraTargetAssets: 0,
        maxExtraTargetAssetShare: 0,
        maxExtraTargetTotalShare: 0,
      },
      {
        allowExtraTargetAssets: true,
        requireExtraTargetAsset: true,
        maxOutgoingAssets: DEFAULT_MAX_OUTGOING_PACKAGE_SIZE,
        maxExtraTargetAssets: 1,
        maxExtraTargetAssetShare: 0.18,
        maxExtraTargetTotalShare: 0.2,
      },
    ];
  }

  if (tierId === "break-down") {
    return [
      {
        allowExtraTargetAssets: true,
        requireExtraTargetAsset: true,
        maxOutgoingAssets: 2,
        maxExtraTargetAssets: 2,
        maxExtraTargetAssetShare: 0.65,
        maxExtraTargetTotalShare: 0.95,
      },
      {
        allowExtraTargetAssets: true,
        requireExtraTargetAsset: true,
        maxOutgoingAssets: 3,
        maxExtraTargetAssets: 3,
        maxExtraTargetAssetShare: 0.5,
        maxExtraTargetTotalShare: 0.85,
      },
    ];
  }

  return [
    {
      allowExtraTargetAssets: false,
      requireExtraTargetAsset: false,
      maxOutgoingAssets: 2,
      maxExtraTargetAssets: 0,
      maxExtraTargetAssetShare: 0,
      maxExtraTargetTotalShare: 0,
    },
    {
      allowExtraTargetAssets: true,
      requireExtraTargetAsset: true,
      maxOutgoingAssets: 2,
      maxExtraTargetAssets: 1,
      maxExtraTargetAssetShare: 0.22,
      maxExtraTargetTotalShare: 0.25,
    },
  ];
}

async function generateShopIdeaBuckets({
  meRoster,
  shopAsset,
  values,
  fairnessPct,
  maxResults,
  tradeLab,
  leagueStrengthBaseline,
}) {
  const tierBuckets = {
    "level-up": [],
    even: [],
    "break-down": [],
  };
  const otherRosters = state.normalizedRosters.filter((roster) => roster.rosterId !== meRoster.rosterId);

  for (const theirRoster of otherRosters) {
    await waitForNextPaint();
    suggestShopDealsWithRoster({
      meRoster,
      theirRoster,
      shopAsset,
      values,
      fairnessPct,
      tradeLab,
    }).forEach((idea) => {
      tierBuckets[idea.tradeTierId].push(idea);
    });
    await waitForNextPaint();
  }

  const ideas = selectDiverseTradeIdeas(
    dedupeTwoTeamIdeas([
      ...tierBuckets["level-up"],
      ...tierBuckets.even,
      ...tierBuckets["break-down"],
    ]).sort((a, b) => compareTradeIdeas(a, b)),
    maxResults,
    values,
    new Set([shopAsset.assetId])
  ).map((idea) => {
    const theirRoster = state.normalizedRosters.find((roster) => roster.rosterId === idea.counterpartyRosterId);
    if (!theirRoster) return idea;
    return enrichTradeIdea({
      idea,
      myRoster: meRoster,
      theirRoster,
      values,
      leagueStrengthBaseline,
    });
  }).sort(compareEnrichedTradeIdeas);

  return {
    kind: "two-team",
    focusAsset: shopAsset,
    primaryCounterpartyName: "the rest of the league",
    groups: [{
      title: "Best Trade Ideas",
      subtitle: `Best return packages for ${shopAsset.name}.`,
      emptyText: "No trade ideas fit the current setup.",
      ideas,
    }],
  };
}

function suggestShopDealsWithRoster({
  meRoster,
  theirRoster,
  shopAsset,
  values,
  fairnessPct,
  tradeLab,
}) {
  const shopValue = getAssetValue(shopAsset, values);
  if (!Number.isFinite(shopValue)) return [];

  const effectiveFairnessPct = getEffectiveFairnessPct(fairnessPct, tradeLab.tradeVibe);
  const coreAssetIds = getCoreAssetIdSet(meRoster, values);
  const myAssetPool = resolveOutgoingAssetPool({
    myRoster: meRoster,
    values,
    tradeLab,
    targetValue: shopValue,
    coreAssetIds,
  });
  const myPool = [
    shopAsset,
    ...myAssetPool.filter((asset) => asset.assetId !== shopAsset.assetId),
  ];
  const theirPool = buildWindowedCounterpartyPool(theirRoster.assets, values, shopValue);
  if (theirPool.length === 0) return [];

  const requiredOutgoingAssetIds = new Set(
    [shopAsset.assetId, ...tradeLab.selectedOutgoingAssetIds]
      .filter((assetId) => myPool.some((asset) => asset.assetId === assetId))
  );
  const tradeIdeas = [];
  const tierConfigs = [
    { id: "level-up", maxMyAssets: 3, maxTheirAssets: 2, minTheirAssets: 1, myLimit: 90, theirLimit: 90 },
    { id: "even", maxMyAssets: 2, maxTheirAssets: 2, minTheirAssets: 1, myLimit: 90, theirLimit: 90 },
    { id: "break-down", maxMyAssets: 2, maxTheirAssets: 3, minTheirAssets: 2, myLimit: 70, theirLimit: 110 },
  ];

  tierConfigs.forEach((config) => {
    const myPackages = limitPackageCandidates(
      buildPackages(myPool, values, config.maxMyAssets, {
        requiredAssetIds: requiredOutgoingAssetIds,
        targetValue: shopValue,
      }),
      shopValue,
      config.myLimit,
      { preferMultiple: config.id !== "level-up" }
    );
    const theirPackages = limitPackageCandidates(
      buildPackages(theirPool, values, config.maxTheirAssets, { targetValue: shopValue }),
      shopValue,
      config.theirLimit,
      { preferMultiple: config.id === "break-down", minimumAssets: config.minTheirAssets }
    );

    walkPackagePairs(myPackages, theirPackages, {
      fairnessPct: effectiveFairnessPct,
      visit(myPackage, theirPackage) {
        const packageResult = calculatePackageAdjustment({
          myValues: myPackage.values,
          theirValues: theirPackage.values,
          globalMaxValue: getGlobalMaxPlayerValue(values, Math.max(shopValue, theirPackage.totalValue || theirPackage.total || 0)),
        });
        const pctDiff = calculatePctDiff(packageResult.myAdjustedValue, packageResult.theirAdjustedValue);
        if (pctDiff > effectiveFairnessPct) return false;

        const idea = buildShopTradeIdea({
          myPackage,
          theirPackage,
          shopAsset,
          theirRoster,
          values,
          tradeLab,
          pctDiff,
          packageResult,
          coreAssetIds,
        });
        if (idea.tradeTierId !== config.id) return false;
        tradeIdeas.push(idea);
        return true;
      },
    });
  });

  return tradeIdeas;
}

function buildWindowedCounterpartyPool(assets, values, referenceValue) {
  return assets
    .filter(isTradeEligibleAsset)
    .map((asset) => ({ asset, value: getAssetValue(asset, values) }))
    .filter((entry) => Number.isFinite(entry.value))
    .sort((a, b) => {
      const distanceDiff = Math.abs(a.value - referenceValue) - Math.abs(b.value - referenceValue);
      if (distanceDiff !== 0) return distanceDiff;
      return b.value - a.value;
    })
    .slice(0, SHOP_COUNTERPARTY_POOL_LIMIT)
    .map((entry) => entry.asset);
}

function limitPackageCandidates(packages, referenceValue, limit, { preferMultiple = false, minimumAssets = 1 } = {}) {
  return packages
    .map((pkg) => ({
      ...pkg,
      totalValue: pkg.values.reduce((sum, value) => sum + value, 0),
    }))
    .filter((pkg) => pkg.assets.length >= minimumAssets)
    .sort((a, b) => {
      const multiBias = preferMultiple ? b.assets.length - a.assets.length : a.assets.length - b.assets.length;
      const referenceDiff = Math.abs(a.totalValue - referenceValue) - Math.abs(b.totalValue - referenceValue);
      if (referenceDiff !== 0) return referenceDiff;
      if (multiBias !== 0) return multiBias;
      return a.totalValue - b.totalValue;
    })
    .slice(0, limit);
}

function buildShopTradeIdea({
  myPackage,
  theirPackage,
  shopAsset,
  theirRoster,
  values,
  tradeLab,
  pctDiff,
  packageResult,
  coreAssetIds,
}) {
  const tradeTierId = classifyTwoTeamTradeTier({
    myAssets: myPackage.assets,
    theirAssets: theirPackage.assets,
  }, shopAsset, values, { mode: "shop" });
  const marketMyValue = calculatePerceivedPackageValue(myPackage.assets, values, tradeLab);
  const marketTheirValue = calculatePerceivedPackageValue(theirPackage.assets, values, tradeLab);
  const marketDelta = marketTheirValue - marketMyValue;
  const incomingProfile = buildPackageProfile(theirPackage.assets, values);
  const outgoingProfile = buildPackageProfile(myPackage.assets, values);
  const leadIncomingValue = incomingProfile.topValue || 0;
  const exposesCore = myPackage.assets.some((asset) => coreAssetIds.has(asset.assetId) && asset.assetId !== shopAsset.assetId);

  let labScore = 82;
  labScore -= pctDiff * (tradeLab.tradeVibe === "chaos" ? 0.45 : tradeLab.tradeVibe === "aggressive" ? 0.7 : 0.95);
  labScore += Math.max(-20, Math.min(20, marketDelta / 240));
  if (tradeTierId === "level-up" && leadIncomingValue > getAssetValue(shopAsset, values)) labScore += 8;
  if (tradeTierId === "even" && Math.abs(leadIncomingValue - outgoingProfile.topValue) <= Math.max(250, outgoingProfile.topValue * 0.08)) labScore += 6;
  if (tradeTierId === "break-down" && theirPackage.assets.length >= 2) labScore += 8;
  if (theirPackage.assets.some(isFirstRoundPick)) labScore += tradeLab.teamState === "rebuilding" ? 8 : 3;
  if (!exposesCore) labScore += 4;
  if (exposesCore) labScore -= 10;

  return {
    myAssets: myPackage.assets,
    theirAssets: theirPackage.assets,
    ...packageResult,
    pctDiff: Number(pctDiff.toFixed(2)),
    marketMyValue,
    marketTheirValue,
    marketDelta: Math.round(marketDelta),
    marketMetricLabel: "send",
    marketMetricOtherLabel: "receive",
    labScore: clamp(Math.round(labScore), 1, 99),
    primaryAssetId: incomingProfile.leadAssetId,
    primaryAssetValue: incomingProfile.leadAssetValue,
    counterpartyName: theirRoster.manager.displayName,
    counterpartyRosterId: theirRoster.rosterId,
    tradeTierId,
  };
}

function findRosterById(rosterId) {
  return state.normalizedRosters.find((roster) => roster.rosterId === rosterId) || null;
}

function findAssetOnRoster(roster, assetId) {
  return roster?.assets.find((asset) => asset.assetId === assetId) || null;
}

function validateCustomMultiTeamSetup() {
  const setup = resolveCustomMultiTeamSetup();
  return setup.ok ? { ok: true } : setup;
}

function resolveCustomMultiTeamSetup() {
  const meRoster = getMyRoster();
  if (!meRoster) {
    return { ok: false, message: "Choose your team first." };
  }

  const participantRosterIds = [meRoster.rosterId, ...state.customParticipantRosterIds.filter(Boolean)];
  if (participantRosterIds.length < DEFAULT_MULTI_TEAM_COUNT) {
    return { ok: false, message: "Choose at least two other owners for a multi-team trade." };
  }
  if (new Set(participantRosterIds).size !== participantRosterIds.length) {
    return { ok: false, message: "Each team can only appear once in the custom trade builder." };
  }

  const participantRosters = participantRosterIds.map((rosterId) => findRosterById(rosterId)).filter(Boolean);
  if (participantRosters.length !== participantRosterIds.length) {
    return { ok: false, message: "One or more selected teams could not be resolved." };
  }

  return {
    ok: true,
    meRoster,
    participantRosters,
  };
}

function buildOwnerSequenceFromRecipientMap(ownerToRecipient, startRosterId, expectedCount) {
  const sequence = [];
  const visited = new Set();
  let currentRosterId = startRosterId;

  while (!visited.has(currentRosterId)) {
    visited.add(currentRosterId);
    sequence.push(currentRosterId);
    const nextRosterId = ownerToRecipient.get(currentRosterId);
    if (!nextRosterId) return null;
    currentRosterId = nextRosterId;
  }

  if (currentRosterId !== startRosterId) return null;
  if (sequence.length !== expectedCount || visited.size !== expectedCount) return null;
  return sequence;
}

function generateCustomMultiTeamIdeas({
  meRoster,
  values,
  fairnessPct,
  maxResults,
  tradeLab,
}) {
  const setup = resolveCustomMultiTeamSetup();
  if (!setup.ok) {
    return {
      kind: "multi-team",
      teamCount: 0,
      groups: [{
        title: "Multi-Team Ideas",
        subtitle: "Finish picking the owners first.",
        emptyText: setup.message,
        ideas: [],
      }],
    };
  }

  const anchorPlans = buildCustomMultiTeamAnchorPlans({
    meRoster,
    participantRosters: setup.participantRosters,
    values,
    maxPlanCount: Math.max(CUSTOM_MULTI_TEAM_PLAN_LIMIT, maxResults * 4),
  });
  const ideas = anchorPlans.flatMap((plan) => buildMultiTeamIdeasFromAnchors({
    meRoster,
    participantRosters: plan.participantRosters,
    anchorTransfers: plan.anchorTransfers,
    values,
    fairnessPct,
    maxResults,
    tradeLab,
    focusLabel: "blockbuster anchors",
  }));
  const dedupedIdeas = dedupeMultiTeamIdeas(ideas)
    .sort((a, b) => compareMultiTeamIdeas(a, b))
    .slice(0, maxResults);

  return {
    kind: "multi-team",
    teamCount: setup.participantRosters.length,
    groups: [{
      title: `${setup.participantRosters.length}-Team Blockbusters`,
      subtitle: "Automatic blockbuster ideas built across the owners you selected.",
      emptyText: anchorPlans.length === 0
        ? "Could not find enough headline assets across those rosters to sketch a blockbuster."
        : "No multi-team structure stayed close enough to fair value.",
      ideas: dedupedIdeas,
    }],
  };
}

async function generateSurpriseBlockbusterIdeas({
  meRoster,
  values,
  fairnessPct,
  maxResults,
  tradeLab,
}) {
  const partnerCount = DEFAULT_MULTI_TEAM_COUNT - 1;
  const otherRosters = state.normalizedRosters.filter((roster) => roster.rosterId !== meRoster.rosterId);
  if (otherRosters.length < partnerCount) {
    return {
      kind: "multi-team",
      teamCount: 0,
      groups: [{
        title: "Surprise Blockbusters",
        subtitle: "Automatic multi-team search",
        emptyText: "This league needs at least three teams for a surprise blockbuster.",
        ideas: [],
      }],
    };
  }

  const participantSets = selectSurpriseBlockbusterParticipantSets({
    otherRosters,
    values,
    partnerCount,
    limit: Math.max(8, maxResults * 4),
  });
  const ideas = [];

  for (const participantSet of participantSets) {
    await waitForNextPaint();
    const participantRosters = [meRoster, ...participantSet.rosters];
    const anchorPlans = buildCustomMultiTeamAnchorPlans({
      meRoster,
      participantRosters,
      values,
      maxPlanCount: Math.max(6, maxResults * 3),
    });

    for (const plan of anchorPlans.slice(0, Math.max(4, maxResults * 2))) {
      ideas.push(
        ...buildMultiTeamIdeasFromAnchors({
          meRoster,
          participantRosters: plan.participantRosters,
          anchorTransfers: plan.anchorTransfers,
          values,
          fairnessPct,
          maxResults,
          tradeLab,
          focusLabel: "surprise blockbuster",
        })
      );
    }
  }

  const dedupedIdeas = dedupeMultiTeamIdeas(ideas)
    .sort((a, b) => compareMultiTeamIdeas(a, b))
    .slice(0, maxResults);

  return {
    kind: "multi-team",
    teamCount: DEFAULT_MULTI_TEAM_COUNT,
    groups: [{
      title: "Surprise Blockbusters",
      subtitle: "Automatic multi-team ideas. No extra setup.",
      emptyText: participantSets.length === 0
        ? "Could not find enough high-value assets across the league."
        : "No surprise blockbuster stayed close enough to fair value.",
      ideas: dedupedIdeas,
    }],
  };
}

function selectSurpriseBlockbusterParticipantSets({
  otherRosters,
  values,
  partnerCount,
  limit,
}) {
  const scoredRosters = otherRosters
    .map((roster) => ({
      roster,
      score: scoreSurpriseBlockbusterRoster(roster, values),
      topValue: getRosterTopTradeAssetValue(roster, values),
    }))
    .filter((entry) => entry.topValue >= 900)
    .sort((a, b) => b.score - a.score || a.roster.manager.displayName.localeCompare(b.roster.manager.displayName))
    .slice(0, Math.max(6, limit + partnerCount));

  return combinationsOfSize(scoredRosters, partnerCount)
    .map((combo) => {
      const topValues = combo.map((entry) => entry.topValue);
      const maxTopValue = Math.max(...topValues);
      const minTopValue = Math.min(...topValues);
      const spreadPenalty = (maxTopValue - minTopValue) * 0.16;
      return {
        rosters: combo.map((entry) => entry.roster),
        score: combo.reduce((sum, entry) => sum + entry.score, 0) - spreadPenalty,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function scoreSurpriseBlockbusterRoster(roster, values) {
  const entries = roster.assets
    .filter(isTradeEligibleAsset)
    .map((asset) => ({ asset, value: getAssetValue(asset, values) }))
    .filter((entry) => Number.isFinite(entry.value) && entry.value > 0)
    .sort((a, b) => b.value - a.value || a.asset.name.localeCompare(b.asset.name));

  if (entries.length === 0) return 0;

  const top = entries[0]?.value || 0;
  const second = entries[1]?.value || 0;
  const third = entries[2]?.value || 0;
  const firstRoundPickBonus = entries.slice(0, 10).filter((entry) => isFirstRoundPick(entry.asset)).length * 160;
  const youthBonus = entries.slice(0, 8).filter((entry) => isYouthAsset(entry.asset)).length * 70;
  return top * 0.9 + second * 0.34 + third * 0.16 + firstRoundPickBonus + youthBonus;
}

function getRosterTopTradeAssetValue(roster, values) {
  return roster.assets
    .filter(isTradeEligibleAsset)
    .reduce((maxValue, asset) => Math.max(maxValue, getAssetValue(asset, values) || 0), 0);
}

function getCustomMultiTeamAnchorCandidateLimit(participantCount) {
  if (participantCount >= 6) return 1;
  if (participantCount >= 5) return 2;
  return CUSTOM_MULTI_TEAM_BASE_ANCHOR_CANDIDATE_LIMIT;
}

function scoreCustomMultiTeamAnchorCandidate({
  asset,
  value,
  rosterPeakValue,
  blockbusterFloor,
  coreAssetIds,
  isMyRoster = false,
}) {
  let score = value;

  if (value >= blockbusterFloor) {
    score += Math.min(320, value * 0.03);
  } else {
    score -= (blockbusterFloor - value) * 0.18;
  }

  if (value >= rosterPeakValue * 0.92) {
    score -= coreAssetIds.has(asset.assetId) ? 260 : 120;
  } else if (value >= rosterPeakValue * 0.62) {
    score += 90;
  }

  if (coreAssetIds.has(asset.assetId)) score -= 120;
  if (asset.assetType === "pick") score += isFirstRoundPick(asset) ? 190 : 110;
  if (isYouthAsset(asset)) score += 85;
  if (isVeteranAsset(asset)) score -= 40;
  if (isMyRoster && state.selectedOutgoingAssetIds.has(asset.assetId)) score += 260;

  return score;
}

function listCustomMultiTeamAnchorCandidates({
  roster,
  values,
  participantCount,
  isMyRoster = false,
}) {
  const candidateLimit = getCustomMultiTeamAnchorCandidateLimit(participantCount);
  const coreAssetIds = getCoreAssetIdSet(roster, values);
  const eligibleEntries = roster.assets
    .filter(isTradeEligibleAsset)
    .filter((asset) => Number.isFinite(getAssetValue(asset, values)))
    .filter((asset) => !isMyRoster || !state.excludedOutgoingAssetIds.has(asset.assetId))
    .map((asset) => ({
      asset,
      value: getAssetValue(asset, values),
    }))
    .sort((a, b) => b.value - a.value || a.asset.name.localeCompare(b.asset.name));

  if (eligibleEntries.length === 0) return [];

  const rosterPeakValue = eligibleEntries[0].value;
  const blockbusterFloor = Math.max(
    900,
    rosterPeakValue * (participantCount <= DEFAULT_MULTI_TEAM_COUNT ? 0.44 : 0.38)
  );
  const scoredEntries = eligibleEntries
    .map((entry) => ({
      ...entry,
      score: scoreCustomMultiTeamAnchorCandidate({
        asset: entry.asset,
        value: entry.value,
        rosterPeakValue,
        blockbusterFloor,
        coreAssetIds,
        isMyRoster,
      }),
    }))
    .sort((a, b) => b.score - a.score || b.value - a.value || a.asset.name.localeCompare(b.asset.name));

  const picks = scoredEntries.filter((entry) => entry.value >= blockbusterFloor).slice(0, candidateLimit);
  if (picks.length >= candidateLimit || scoredEntries.length <= candidateLimit) return picks.length > 0 ? picks : scoredEntries.slice(0, candidateLimit);

  for (const entry of scoredEntries) {
    if (picks.length >= candidateLimit) break;
    if (picks.some((existing) => existing.asset.assetId === entry.asset.assetId)) continue;
    picks.push(entry);
  }

  return picks;
}

function listCustomMultiTeamSecondaryAnchorCandidates({
  roster,
  values,
  participantCount,
  primaryAsset,
  isMyRoster = false,
}) {
  if (!roster || !primaryAsset) return [];

  const primaryValue = getAssetValue(primaryAsset, values);
  if (!Number.isFinite(primaryValue) || primaryValue <= 0) return [];

  const coreAssetIds = getCoreAssetIdSet(roster, values);
  const minValue = Math.max(325, primaryValue * CUSTOM_MULTI_TEAM_SECONDARY_ANCHOR_MIN_SHARE);
  const maxValue = Math.max(
    900,
    Math.min(primaryValue * CUSTOM_MULTI_TEAM_SECONDARY_ANCHOR_MAX_SHARE, primaryValue - 180)
  );
  const targetValue = clamp(
    primaryValue * (participantCount <= DEFAULT_MULTI_TEAM_COUNT ? 0.42 : 0.34),
    minValue,
    maxValue
  );

  return roster.assets
    .filter(isTradeEligibleAsset)
    .filter((asset) => asset.assetId !== primaryAsset.assetId)
    .filter((asset) => Number.isFinite(getAssetValue(asset, values)))
    .filter((asset) => !isMyRoster || !state.excludedOutgoingAssetIds.has(asset.assetId))
    .map((asset) => ({
      asset,
      value: getAssetValue(asset, values),
    }))
    .filter((entry) => entry.value >= minValue && entry.value <= maxValue)
    .sort((left, right) => {
      const leftScore = Math.abs(left.value - targetValue)
        + (coreAssetIds.has(left.asset.assetId) ? 420 : 0)
        - (left.asset.assetType === "pick" ? 180 : 0)
        - (isYouthAsset(left.asset) ? 70 : 0);
      const rightScore = Math.abs(right.value - targetValue)
        + (coreAssetIds.has(right.asset.assetId) ? 420 : 0)
        - (right.asset.assetType === "pick" ? 180 : 0)
        - (isYouthAsset(right.asset) ? 70 : 0);
      if (leftScore !== rightScore) return leftScore - rightScore;
      return right.value - left.value;
    })
    .slice(0, CUSTOM_MULTI_TEAM_SECONDARY_ANCHOR_LIMIT);
}

function buildCustomMultiTeamCycleOrders({
  meRoster,
  participantRosters,
  limit = CUSTOM_MULTI_TEAM_ORDER_LIMIT,
}) {
  const partnerIds = participantRosters
    .filter((roster) => roster.rosterId !== meRoster.rosterId)
    .map((roster) => roster.rosterId);
  if (partnerIds.length === 0) return [];

  const seen = new Set();
  const orders = [];
  const maxOrderCount = Number.isFinite(limit) ? limit : Number.POSITIVE_INFINITY;
  const permutationLimit = partnerIds.length <= 3 ? Number.POSITIVE_INFINITY : maxOrderCount * 3;

  function pushOrder(partnerOrder) {
    if (orders.length >= maxOrderCount) return;
    const ownerSequence = [meRoster.rosterId, ...partnerOrder];
    const key = ownerSequence.join("|");
    if (seen.has(key)) return;
    seen.add(key);
    orders.push(ownerSequence);
  }

  pushOrder(partnerIds);
  pushOrder([...partnerIds].reverse());
  buildRosterIdPermutations(partnerIds, permutationLimit).forEach(pushOrder);

  return orders;
}

function buildRosterIdPermutations(rosterIds, limit = Number.POSITIVE_INFINITY) {
  if (rosterIds.length <= 1) return [rosterIds];

  const permutations = [];
  const used = new Array(rosterIds.length).fill(false);
  const current = [];

  function walk() {
    if (permutations.length >= limit) return true;
    if (current.length === rosterIds.length) {
      permutations.push([...current]);
      return permutations.length >= limit;
    }

    for (let index = 0; index < rosterIds.length; index += 1) {
      if (used[index]) continue;
      used[index] = true;
      current.push(rosterIds[index]);
      const shouldStop = walk();
      current.pop();
      used[index] = false;
      if (shouldStop) return true;
    }

    return false;
  }

  walk();
  return permutations;
}

function buildCustomMultiTeamPrimaryCycleTransfers({
  ownerSequence,
  primaryAnchorByOwner,
}) {
  return ownerSequence.map((ownerId, sequenceIndex) => ({
    fromRosterId: ownerId,
    toRosterId: ownerSequence[(sequenceIndex + 1) % ownerSequence.length],
    asset: primaryAnchorByOwner.get(ownerId),
    isRequested: true,
  })).filter((transfer) => transfer.asset);
}

function buildCustomMultiTeamAnchorPlanVariants({
  ownerSequence,
  primaryAnchorByOwner,
  secondaryCandidatesByOwner,
}) {
  const baseTransfers = buildCustomMultiTeamPrimaryCycleTransfers({
    ownerSequence,
    primaryAnchorByOwner,
  });
  const variants = [];
  const seen = new Set();

  function pushVariant(extraTransfers = [], variantScore = 0) {
    const anchorTransfers = [...baseTransfers, ...extraTransfers].filter((transfer) => transfer.asset);
    const key = anchorTransfers
      .map((transfer) => `${transfer.fromRosterId}:${transfer.asset.assetId}->${transfer.toRosterId}`)
      .sort()
      .join("|");
    if (seen.has(key)) return;
    seen.add(key);
    variants.push({
      anchorTransfers,
      variantScore,
    });
  }

  pushVariant([], 0);

  ownerSequence.forEach((ownerId, index) => {
    const candidates = secondaryCandidatesByOwner.get(ownerId) || [];
    const primaryRecipientId = ownerSequence[(index + 1) % ownerSequence.length];
    const alternateRecipientId = ownerSequence[(index + 2) % ownerSequence.length];

    candidates.forEach((candidate, candidateIndex) => {
      pushVariant([{
        fromRosterId: ownerId,
        toRosterId: primaryRecipientId,
        asset: candidate.asset,
        isRequested: true,
      }], 150 - candidateIndex * 18);

      if (alternateRecipientId !== ownerId && alternateRecipientId !== primaryRecipientId) {
        pushVariant([{
          fromRosterId: ownerId,
          toRosterId: alternateRecipientId,
          asset: candidate.asset,
          isRequested: true,
        }], 190 - candidateIndex * 18);
      }
    });
  });

  const topSecondaryEntries = ownerSequence
    .map((ownerId, index) => ({
      ownerId,
      index,
      candidate: (secondaryCandidatesByOwner.get(ownerId) || [])[0] || null,
    }))
    .filter((entry) => entry.candidate);
  let pairedVariantCount = 0;

  for (let leftIndex = 0; leftIndex < topSecondaryEntries.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < topSecondaryEntries.length; rightIndex += 1) {
      if (pairedVariantCount >= Math.max(2, ownerSequence.length - 1)) break;

      const leftEntry = topSecondaryEntries[leftIndex];
      const rightEntry = topSecondaryEntries[rightIndex];
      const leftPrimaryRecipientId = ownerSequence[(leftEntry.index + 1) % ownerSequence.length];
      const rightAlternateRecipientId = ownerSequence[(rightEntry.index + 2) % ownerSequence.length];
      const rightRecipientId = rightAlternateRecipientId === rightEntry.ownerId
        ? ownerSequence[(rightEntry.index + 1) % ownerSequence.length]
        : rightAlternateRecipientId;

      pushVariant([
        {
          fromRosterId: leftEntry.ownerId,
          toRosterId: leftPrimaryRecipientId,
          asset: leftEntry.candidate.asset,
          isRequested: true,
        },
        {
          fromRosterId: rightEntry.ownerId,
          toRosterId: rightRecipientId,
          asset: rightEntry.candidate.asset,
          isRequested: true,
        },
      ], 245 - pairedVariantCount * 22);
      pairedVariantCount += 1;
    }
  }

  return variants;
}

function scoreCustomMultiTeamAnchorPlan({
  ownerSequence,
  anchorAssetByOwner,
  values,
  candidateScoreTotal = 0,
}) {
  const anchorValues = ownerSequence
    .map((ownerId) => getAssetValue(anchorAssetByOwner.get(ownerId), values))
    .filter(Number.isFinite);
  if (anchorValues.length !== ownerSequence.length) return Number.NEGATIVE_INFINITY;

  const totalAnchorValue = anchorValues.reduce((sum, value) => sum + value, 0);
  const avgAnchorValue = totalAnchorValue / Math.max(anchorValues.length, 1);
  const maxAnchorValue = Math.max(...anchorValues);
  const minAnchorValue = Math.min(...anchorValues);
  const cyclicalGap = ownerSequence.reduce((sum, ownerId, index) => {
    const previousOwnerId = ownerSequence[(index - 1 + ownerSequence.length) % ownerSequence.length];
    const outgoingValue = getAssetValue(anchorAssetByOwner.get(ownerId), values);
    const incomingValue = getAssetValue(anchorAssetByOwner.get(previousOwnerId), values);
    return sum + Math.abs(outgoingValue - incomingValue);
  }, 0);
  const liquidityBonus = ownerSequence.reduce((sum, ownerId) => {
    const asset = anchorAssetByOwner.get(ownerId);
    if (isFirstRoundPick(asset)) return sum + 120;
    if (asset.assetType === "pick") return sum + 70;
    if (isYouthAsset(asset)) return sum + 45;
    return sum;
  }, 0);

  return (
    candidateScoreTotal * 0.3
    + totalAnchorValue * 0.72
    + avgAnchorValue * 0.88
    + liquidityBonus
    - cyclicalGap * 0.74
    - (maxAnchorValue - minAnchorValue) * 0.42
  );
}

function buildCustomMultiTeamAnchorPlans({
  meRoster,
  participantRosters,
  values,
  maxPlanCount = CUSTOM_MULTI_TEAM_PLAN_LIMIT,
}) {
  const participantCount = participantRosters.length;
  const cycleOrders = buildCustomMultiTeamCycleOrders({
    meRoster,
    participantRosters,
    limit: participantCount <= 4 ? Number.POSITIVE_INFINITY : CUSTOM_MULTI_TEAM_ORDER_LIMIT,
  });
  if (cycleOrders.length === 0) return [];

  const candidateLists = participantRosters.map((roster) => ({
    roster,
    candidates: listCustomMultiTeamAnchorCandidates({
      roster,
      values,
      participantCount,
      isMyRoster: roster.rosterId === meRoster.rosterId,
    }),
  }));
  if (candidateLists.some((entry) => entry.candidates.length === 0)) return [];

  const plans = [];
  const seen = new Set();
  const selection = [];

  function walk(index, candidateScoreTotal) {
    if (index >= candidateLists.length) {
      const anchorAssetByOwner = new Map(selection.map((entry) => [entry.roster.rosterId, entry.candidate.asset]));
      const secondaryCandidatesByOwner = new Map(selection.map((entry) => [
        entry.roster.rosterId,
        listCustomMultiTeamSecondaryAnchorCandidates({
          roster: entry.roster,
          values,
          participantCount,
          primaryAsset: entry.candidate.asset,
          isMyRoster: entry.roster.rosterId === meRoster.rosterId,
        }),
      ]));

      cycleOrders.forEach((ownerSequence) => {
        buildCustomMultiTeamAnchorPlanVariants({
          ownerSequence,
          primaryAnchorByOwner: anchorAssetByOwner,
          secondaryCandidatesByOwner,
        }).forEach((planVariant) => {
          const key = planVariant.anchorTransfers
            .map((transfer) => `${transfer.fromRosterId}:${transfer.asset?.assetId || "none"}->${transfer.toRosterId}`)
            .sort()
            .join("|");
          if (seen.has(key)) return;
          seen.add(key);
          plans.push({
            participantRosters,
            anchorTransfers: planVariant.anchorTransfers,
            score: scoreCustomMultiTeamAnchorPlan({
              ownerSequence,
              anchorAssetByOwner,
              values,
              candidateScoreTotal,
            }) + planVariant.variantScore,
          });
        });
      });
      return;
    }

    const entry = candidateLists[index];
    entry.candidates.forEach((candidate) => {
      selection.push({ roster: entry.roster, candidate });
      walk(index + 1, candidateScoreTotal + candidate.score);
      selection.pop();
    });
  }

  walk(0, 0);

  return plans
    .filter((plan) => Number.isFinite(plan.score))
    .sort((a, b) => b.score - a.score)
    .slice(0, maxPlanCount);
}

function generateAutoMultiTeamIdeas({
  meRoster,
  targetAsset,
  values,
  fairnessPct,
  maxResults,
  tradeLab,
}) {
  const targetOwner = findRosterById(targetAsset.managerRosterId);
  if (!targetOwner) {
    return {
      kind: "multi-team",
      teamCount: 0,
      focusAsset: targetAsset,
      groups: [{
        title: "Multi-Team Routes",
        subtitle: "Automatic helper search",
        emptyText: "Could not resolve the target manager for the selected asset.",
        ideas: [],
      }],
    };
  }

  const requestedTeamCount = clamp(
    Number(el.multiTeamCountSelect?.value || DEFAULT_MULTI_TEAM_COUNT),
    DEFAULT_MULTI_TEAM_COUNT,
    state.normalizedRosters.length
  );
  const helperCount = Math.max(0, requestedTeamCount - 2);
  const helperSets = buildAutoMultiTeamHelperSets({
    meRoster,
    targetOwner,
    helperCount,
    targetValue: getAssetValue(targetAsset, values),
    values,
  });
  const ideas = [];

  helperSets.forEach((helperSet) => {
    buildAutoMultiTeamAnchorPlans({
      meRoster,
      helperSet,
      targetOwner,
      targetAsset,
      values,
      tradeTier: getTradeTier(),
    }).forEach((plan) => {
      ideas.push(
        ...buildMultiTeamIdeasFromAnchors({
          meRoster,
          participantRosters: plan.participantRosters,
          anchorTransfers: plan.anchorTransfers,
          values,
          fairnessPct,
          maxResults,
          tradeLab,
          focusLabel: targetAsset.name,
        })
      );
    });
  });

  const dedupedIdeas = dedupeMultiTeamIdeas(ideas)
    .sort((a, b) => compareMultiTeamIdeas(a, b))
    .slice(0, maxResults);

  return {
    kind: "multi-team",
    focusAsset: targetAsset,
    teamCount: requestedTeamCount,
    groups: [{
      title: `${requestedTeamCount}-Team Routes`,
      subtitle: `Automatic multi-team paths built around landing ${targetAsset.name}.`,
      emptyText: "No multi-team routes cleared the value filters for that target.",
      ideas: dedupedIdeas,
    }],
  };
}

function buildMultiTeamIdeasFromAnchors({
  meRoster,
  participantRosters,
  anchorTransfers,
  values,
  fairnessPct,
  maxResults,
  tradeLab,
  focusLabel,
}) {
  const baseState = createMultiTeamTradeState({
    meRoster,
    participantRosters,
    anchorTransfers,
    values,
  });
  const balanceContext = buildMultiTeamBalanceContext(baseState, values);
  if (!balanceContext) return [];

  const compensationPlans = solveMultiTeamCompensationPlans({
    tradeState: baseState,
    balanceContext,
    meRoster,
    values,
    tradeLab,
    maxResults,
  });
  const ideas = [];

  for (const compensationPlan of compensationPlans) {
    const variantState = cloneMultiTeamTradeState(baseState);
    compensationPlan.transfers.forEach((transfer) => {
      addMultiTeamTransfer(variantState.stateByRosterId, {
        fromRosterId: transfer.fromRosterId,
        toRosterId: transfer.toRosterId,
        asset: transfer.asset,
        kind: "filler",
      });
    });

    const finalizedIdea = finalizeMultiTeamTradeIdea({
      tradeState: variantState,
      meRoster,
      values,
      tradeLab,
      fairnessPct,
      focusLabel,
      balanceContext,
      assignmentMeta: compensationPlan.meta,
    });
    if (finalizedIdea) ideas.push(finalizedIdea);
  }

  return dedupeMultiTeamIdeas(ideas).sort((a, b) => compareMultiTeamIdeas(a, b)).slice(0, maxResults);
}

function createMultiTeamTradeState({ meRoster, participantRosters, anchorTransfers, values }) {
  const stateByRosterId = new Map();

  participantRosters.forEach((roster) => {
    stateByRosterId.set(roster.rosterId, {
      roster,
      outgoingTransfers: [],
      incomingTransfers: [],
      coreAssetIds: getCoreAssetIdSet(roster, values),
    });
  });

  anchorTransfers.forEach((transfer) => {
    addMultiTeamTransfer(stateByRosterId, {
      fromRosterId: transfer.fromRosterId,
      toRosterId: transfer.toRosterId,
      asset: transfer.asset,
      kind: "anchor",
      isRequested: Boolean(transfer.isRequested),
    });
  });

  return {
    meRosterId: meRoster.rosterId,
    participantRosters,
    stateByRosterId,
  };
}

function cloneMultiTeamTradeState(baseState) {
  const clonedMap = new Map();
  baseState.stateByRosterId.forEach((participantState, rosterId) => {
    clonedMap.set(rosterId, {
      roster: participantState.roster,
      outgoingTransfers: participantState.outgoingTransfers.map((transfer) => ({ ...transfer })),
      incomingTransfers: participantState.incomingTransfers.map((transfer) => ({ ...transfer })),
      coreAssetIds: new Set(participantState.coreAssetIds),
    });
  });

  return {
    meRosterId: baseState.meRosterId,
    participantRosters: baseState.participantRosters,
    stateByRosterId: clonedMap,
  };
}

function addMultiTeamTransfer(stateByRosterId, { fromRosterId, toRosterId, asset, kind = "filler", isRequested = false }) {
  if (!asset || fromRosterId == null || toRosterId == null || fromRosterId === toRosterId) return;

  const senderState = stateByRosterId.get(fromRosterId);
  const receiverState = stateByRosterId.get(toRosterId);
  if (!senderState || !receiverState) return;

  const transferRecord = {
    asset,
    fromRosterId,
    toRosterId,
    kind,
    isRequested,
  };
  senderState.outgoingTransfers.push(transferRecord);
  receiverState.incomingTransfers.push(transferRecord);
}

function getMultiTeamParticipantMetrics(tradeState, values) {
  return [...tradeState.stateByRosterId.values()].map((participantState) => {
    const outgoingAssets = participantState.outgoingTransfers.map((transfer) => transfer.asset);
    const incomingAssets = participantState.incomingTransfers.map((transfer) => transfer.asset);
    const outgoingValue = outgoingAssets.reduce((sum, asset) => sum + getAssetValue(asset, values), 0);
    const incomingValue = incomingAssets.reduce((sum, asset) => sum + getAssetValue(asset, values), 0);
    const needReceive = Math.max(0, outgoingValue - incomingValue);
    const needSend = Math.max(0, incomingValue - outgoingValue);

    return {
      roster: participantState.roster,
      outgoingAssets,
      incomingAssets,
      outgoingValue,
      incomingValue,
      needReceive,
      needSend,
    };
  });
}

function solveMultiTeamTradeState(tradeState, { meRoster, values, tradeLab, variantIndex }) {
  for (let iteration = 0; iteration < 80; iteration += 1) {
    const participantMetrics = getMultiTeamParticipantMetrics(tradeState, values);
    const receivers = participantMetrics
      .filter((metric) => metric.needReceive > 140)
      .sort((left, right) => {
        if (variantIndex % 2 === 0) return right.needReceive - left.needReceive;
        return left.needReceive - right.needReceive;
      });
    const debtors = participantMetrics
      .filter((metric) => metric.needSend > 140)
      .sort((left, right) => {
        if (variantIndex % 3 === 0) return right.needSend - left.needSend;
        return left.needSend - right.needSend;
      });

    if (receivers.length === 0 || debtors.length === 0) break;

    const nextMove = selectBestMultiTeamFillerMove({
      tradeState,
      meRoster,
      values,
      tradeLab,
      variantIndex,
      receivers,
      debtors,
    });
    if (!nextMove) break;

    addMultiTeamTransfer(tradeState.stateByRosterId, {
      fromRosterId: nextMove.fromRosterId,
      toRosterId: nextMove.toRosterId,
      asset: nextMove.asset,
      kind: "filler",
    });
  }
}

function selectBestMultiTeamFillerMove({
  tradeState,
  meRoster,
  values,
  tradeLab,
  variantIndex,
  receivers,
  debtors,
}) {
  const bestMoves = [];

  debtors.forEach((debtorMetric) => {
    const participantState = tradeState.stateByRosterId.get(debtorMetric.roster.rosterId);
    const candidates = buildAvailableMultiTeamFillerAssets({
      participantState,
      meRoster,
      values,
      tradeLab,
      variantIndex,
    });
    if (candidates.length === 0) return;

    receivers
      .filter((receiverMetric) => receiverMetric.roster.rosterId !== debtorMetric.roster.rosterId)
      .forEach((receiverMetric) => {
        candidates.forEach((candidateAsset) => {
          const score = scoreMultiTeamFillerMove({
            asset: candidateAsset,
            debtorMetric,
            receiverMetric,
            participantState,
            meRoster,
            values,
            tradeLab,
            variantIndex,
          });
          if (!Number.isFinite(score)) return;
          bestMoves.push({
            fromRosterId: debtorMetric.roster.rosterId,
            toRosterId: receiverMetric.roster.rosterId,
            asset: candidateAsset,
            score,
          });
        });
      });
  });

  bestMoves.sort((left, right) => right.score - left.score);
  return bestMoves[0] || null;
}

function buildAvailableMultiTeamFillerAssets({
  participantState,
  meRoster,
  values,
  tradeLab,
  variantIndex,
  limit = MULTI_TEAM_FILLER_POOL_LIMIT,
}) {
  const sentAssetIds = new Set(participantState.outgoingTransfers.map((transfer) => transfer.asset.assetId));
  const isMyRoster = participantState.roster.rosterId === meRoster.rosterId;

  return participantState.roster.assets
    .filter(isTradeEligibleAsset)
    .filter((asset) => Number.isFinite(getAssetValue(asset, values)))
    .filter((asset) => !sentAssetIds.has(asset.assetId))
    .filter((asset) => !isMyRoster || !state.excludedOutgoingAssetIds.has(asset.assetId))
    .sort((left, right) => {
      const leftScore = scoreMultiTeamAssetLiquidity(left, participantState, meRoster, values, tradeLab, variantIndex);
      const rightScore = scoreMultiTeamAssetLiquidity(right, participantState, meRoster, values, tradeLab, variantIndex);
      if (rightScore !== leftScore) return rightScore - leftScore;
      return sortAssetsByValueDesc(left, right, values);
    })
    .slice(0, limit);
}

function scoreMultiTeamAssetLiquidity(asset, participantState, meRoster, values, tradeLab, variantIndex) {
  const assetValue = getAssetValue(asset, values);
  const isMyRoster = participantState.roster.rosterId === meRoster.rosterId;
  let score = assetValue;

  if (participantState.coreAssetIds.has(asset.assetId)) score -= isMyRoster ? 850 : 420;
  if (isMyRoster && state.selectedOutgoingAssetIds.has(asset.assetId)) score += 280;
  if (asset.assetType === "pick") score += tradeLab.teamState === "rebuilding" ? 90 : 35;
  if (tradeLab.teamState === "contending" && isVeteranAsset(asset)) score += 55;
  if (variantIndex % 3 === 1 && assetValue <= 2500) score += 40;
  if (variantIndex % 3 === 2 && assetValue >= 2500) score += 40;

  return score;
}

function scoreMultiTeamFillerMove({
  asset,
  debtorMetric,
  receiverMetric,
  participantState,
  meRoster,
  values,
  tradeLab,
  variantIndex,
}) {
  const assetValue = getAssetValue(asset, values);
  const targetGap = Math.max(180, Math.min(debtorMetric.needSend, receiverMetric.needReceive));
  const isMyRoster = participantState.roster.rosterId === meRoster.rosterId;
  let score = 10000;

  score -= Math.abs(assetValue - targetGap) * 1.35;
  score -= Math.abs(assetValue - debtorMetric.needSend) * 0.35;
  score -= Math.abs(assetValue - receiverMetric.needReceive) * 0.35;

  if (participantState.coreAssetIds.has(asset.assetId)) score -= isMyRoster ? 900 : 440;
  if (isMyRoster && state.selectedOutgoingAssetIds.has(asset.assetId)) score += 320;
  if (asset.assetType === "pick") score += tradeLab.teamState === "rebuilding" ? 80 : 25;
  if (tradeLab.teamState === "contending" && isVeteranAsset(asset)) score += 45;
  if (variantIndex % 4 === 1 && assetValue <= targetGap * 1.08) score += 55;
  if (variantIndex % 4 === 2 && assetValue >= targetGap * 0.92) score += 55;
  if (variantIndex % 4 === 3 && receiverMetric.roster.rosterId === meRoster.rosterId) score += 45;

  return score;
}

function finalizeMultiTeamTradeIdea({
  tradeState,
  meRoster,
  values,
  tradeLab,
  fairnessPct,
  focusLabel,
  balanceContext = null,
  assignmentMeta = null,
}) {
  const fairnessLimit = getMultiTeamFairnessLimit(fairnessPct, tradeLab, tradeState.participantRosters.length);
  const participants = [];

  for (const participantState of tradeState.stateByRosterId.values()) {
    const outgoingAssets = participantState.outgoingTransfers.map((transfer) => transfer.asset);
    const incomingAssets = participantState.incomingTransfers.map((transfer) => transfer.asset);
    if (outgoingAssets.length === 0 || incomingAssets.length === 0) return null;

    const tradeShape = summarizeMultiTeamParticipantShape(participantState, values);
    const fairnessMetrics = calculateMultiTeamParticipantFairness({
      outgoingAssets,
      incomingAssets,
      values,
      tradeLab,
      tradeShape,
    });
    const pctDiff = fairnessMetrics.pctDiff;
    if (pctDiff > fairnessLimit) return null;

    const sendToNames = [...new Set(
      participantState.outgoingTransfers
        .map((transfer) => findRosterById(transfer.toRosterId)?.manager.displayName)
        .filter(Boolean)
    )];
    const receiveFromNames = [...new Set(
      participantState.incomingTransfers
        .map((transfer) => findRosterById(transfer.fromRosterId)?.manager.displayName)
        .filter(Boolean)
    )];

    participants.push({
      roster: participantState.roster,
      sendToNames,
      receiveFromNames,
      outgoingAssets,
      incomingAssets,
      outgoingAdjustedValue: fairnessMetrics.outgoingRawValue,
      incomingAdjustedValue: fairnessMetrics.incomingRawValue,
      packageAdjustment: fairnessMetrics.packageAdjustment,
      packageAdjustmentSide: fairnessMetrics.packageAdjustmentSide,
      netValueDelta: fairnessMetrics.netValueDelta,
      marketPctDiff: fairnessMetrics.marketPctDiff,
      packageTaxPct: fairnessMetrics.packageTaxPct,
      pctDiff,
      requestedIncomingCount: tradeShape.requestedIncomingCount,
      tradeShape,
    });
  }

  const maxPctDiff = Number(Math.max(...participants.map((participant) => participant.pctDiff)).toFixed(2));
  const avgPctDiff = Number((
    participants.reduce((sum, participant) => sum + participant.pctDiff, 0) / participants.length
  ).toFixed(2));
  const totalAssetsMoved = participants.reduce((sum, participant) => sum + participant.outgoingAssets.length, 0);
  const requestedCount = participants.reduce((sum, participant) => sum + participant.requestedIncomingCount, 0);
  const fillerValueTotal = assignmentMeta?.fillerValueTotal ?? 0;
  const fillerAssetCount = assignmentMeta?.fillerAssetCount ?? 0;
  const fillerPairCount = assignmentMeta?.fillerPairCount ?? 0;
  const senderSplitCount = assignmentMeta?.senderSplitCount ?? 0;
  const receiverSplitCount = assignmentMeta?.receiverSplitCount ?? 0;
  const routingMetrics = collectMultiTeamRoutingMetrics(tradeState);
  const extraAnchorCount = Math.max(0, routingMetrics.anchorTransferCount - tradeState.participantRosters.length);
  const routeSplitCount = routingMetrics.senderSplitCount + routingMetrics.receiverSplitCount;
  const anchorValueTotal = balanceContext?.anchorValueTotal
    ?? participants.reduce((sum, participant) => {
      return sum + participant.outgoingAssets
        .filter((asset) => participantStateHasAssetOfKind(tradeState.stateByRosterId.get(participant.roster.rosterId), asset.assetId, "anchor"))
        .reduce((assetSum, asset) => assetSum + getAssetValue(asset, values), 0);
    }, 0);
  const requestedAnchorValueTotal = balanceContext?.requestedAnchorValueTotal ?? 0;
  const unrequestedAnchorValueTotal = balanceContext?.unrequestedAnchorValueTotal ?? Math.max(0, anchorValueTotal - requestedAnchorValueTotal);
  const requiredCompValue = balanceContext?.totalNeedReceive ?? 0;
  const fillerOverageValue = Math.max(0, fillerValueTotal - requiredCompValue);
  const extraMovedValueTotal = fillerValueTotal + unrequestedAnchorValueTotal;
  const fillerOverageRatio = requiredCompValue > 0 ? fillerOverageValue / requiredCompValue : 0;
  const fillerRatio = anchorValueTotal > 0 ? fillerValueTotal / anchorValueTotal : 0;
  const maxFillerRatio = getMultiTeamMaxFillerRatio(tradeState.participantRosters.length);
  const maxAllowedFillerAssets = tradeState.participantRosters.length + Math.max(1, Math.floor(tradeState.participantRosters.length / 2));
  const maxUnrequestedAnchorRatio = getMultiTeamMaxUnrequestedAnchorRatio(tradeState.participantRosters.length);
  const maxFillerOverageRatio = getMultiTeamMaxFillerOverageRatio(tradeState.participantRosters.length);
  const unrequestedAnchorRatio = requestedAnchorValueTotal > 0
    ? unrequestedAnchorValueTotal / requestedAnchorValueTotal
    : unrequestedAnchorValueTotal > 0 ? Number.POSITIVE_INFINITY : 0;
  const participantShapePenalty = participants.reduce((sum, participant) => sum + evaluateMultiTeamParticipantShape({
    tradeShape: participant.tradeShape,
    participantCount: tradeState.participantRosters.length,
  }).scorePenalty, 0);
  const avgPackageTaxPct = Number((
    participants.reduce((sum, participant) => sum + (participant.packageTaxPct || 0), 0) / participants.length
  ).toFixed(2));

  if (fillerAssetCount > maxAllowedFillerAssets) return null;
  if (fillerRatio > maxFillerRatio && fillerValueTotal > 1800) return null;
  if (unrequestedAnchorRatio > maxUnrequestedAnchorRatio && unrequestedAnchorValueTotal > 1200) return null;
  if (fillerOverageRatio > maxFillerOverageRatio && fillerOverageValue > 900) return null;
  if (fillerPairCount > Math.max(2, tradeState.participantRosters.length - 1)) return null;
  if (participants.some((participant) => !evaluateMultiTeamParticipantShape({
    tradeShape: participant.tradeShape,
    participantCount: tradeState.participantRosters.length,
  }).ok)) return null;

  const labScore = clamp(
    Math.round(
      96
      - maxPctDiff * 0.95
      - avgPctDiff * 0.45
      - fillerRatio * 38
      - unrequestedAnchorRatio * 28
      - fillerOverageRatio * 24
      - avgPackageTaxPct * 0.3
      - fillerAssetCount * 2.8
      - fillerPairCount * 2.9
      - senderSplitCount * 2.7
      - receiverSplitCount * 2.4
      - Math.max(0, totalAssetsMoved - participants.length) * 0.7
      - participantShapePenalty
      + requestedCount * 1.4
      + extraAnchorCount * 4.2
      + Math.min(3, routeSplitCount) * 1.35
    ),
    1,
    99
  );

  const structureTag = extraAnchorCount >= 2
    ? "Chaos Build"
    : extraAnchorCount === 1
      ? "Stacked Anchors"
      : requestedCount >= tradeState.participantRosters.length
        ? "Requested Anchors"
        : "Open Solver";
  const laneTag = routeSplitCount > 0 ? "Multi-Lane" : "Single Lane";

  return {
    teamCount: tradeState.participantRosters.length,
    commonValue: Math.round(
      participants.reduce((sum, participant) => sum + participant.incomingAdjustedValue, 0) / participants.length
    ),
    maxPctDiff,
    avgPctDiff,
    labScore,
    meRosterId: meRoster.rosterId,
    fillerValueTotal: Math.round(fillerValueTotal),
    extraMovedValueTotal: Math.round(extraMovedValueTotal),
    unrequestedAnchorValueTotal: Math.round(unrequestedAnchorValueTotal),
    fillerOverageValue: Math.round(fillerOverageValue),
    fillerAssetCount,
    fillerPairCount,
    fillerRatio: Number(fillerRatio.toFixed(3)),
    unrequestedAnchorRatio: Number.isFinite(unrequestedAnchorRatio) ? Number(unrequestedAnchorRatio.toFixed(3)) : 99,
    extraAnchorCount,
    routeSplitCount,
    participants,
    tags: [
      `${tradeState.participantRosters.length} Team`,
      structureTag,
      laneTag,
      extraMovedValueTotal <= Math.max(1400, requestedAnchorValueTotal * 0.18) ? "Lean Structure" : extraMovedValueTotal <= Math.max(2600, requestedAnchorValueTotal * 0.34) ? "Controlled Structure" : "Heavy Structure",
      maxPctDiff <= fairnessLimit * 0.55 ? "Tight Value" : "Flexible Value",
    ],
    summary: buildMultiTeamSummary(participants, focusLabel),
  };
}

function getMultiTeamFairnessLimit(fairnessPct, tradeLab, participantCount) {
  return getEffectiveFairnessPct(fairnessPct, tradeLab.tradeVibe)
    + MULTI_TEAM_BASE_FAIRNESS_BUFFER
    + Math.max(0, participantCount - DEFAULT_MULTI_TEAM_COUNT) * MULTI_TEAM_PER_TEAM_FAIRNESS_BUFFER;
}

function calculateMultiTeamParticipantFairness({
  outgoingAssets,
  incomingAssets,
  values,
  tradeLab,
  tradeShape,
}) {
  const globalMaxValue = getGlobalMaxPlayerValue(values);
  const outgoingRawValue = outgoingAssets.reduce((sum, asset) => sum + getAssetValue(asset, values), 0);
  const incomingRawValue = incomingAssets.reduce((sum, asset) => sum + getAssetValue(asset, values), 0);
  const outgoingMarketValue = calculatePerceivedPackageValue(outgoingAssets, values, tradeLab);
  const incomingMarketValue = calculatePerceivedPackageValue(incomingAssets, values, tradeLab);
  const packageResult = calculatePackageAdjustment({
    myValues: outgoingAssets.map((asset) => getAssetValue(asset, values)),
    theirValues: incomingAssets.map((asset) => getAssetValue(asset, values)),
    globalMaxValue,
  });
  const rawPctDiff = calculatePctDiff(outgoingRawValue, incomingRawValue);
  const marketPctDiff = calculatePctDiff(outgoingMarketValue, incomingMarketValue);
  const packageTaxPct = Math.max(
    outgoingRawValue,
    incomingRawValue,
    1
  ) > 0
    ? packageResult.packageAdjustment / Math.max(outgoingRawValue, incomingRawValue, 1) * 100
    : 0;
  const marketGapWeight = tradeShape.role === "level-up"
    ? 0.16
    : tradeShape.role === "break-down"
      ? 0.22
      : tradeShape.role === "bridge"
        ? 0.28
        : 0.24;
  const packageTaxWeight = tradeShape.role === "level-up"
    ? 0.16
    : tradeShape.role === "break-down"
      ? 0.08
      : tradeShape.role === "bridge"
        ? 0.12
        : 0.14;

  return {
    outgoingRawValue,
    incomingRawValue,
    outgoingMarketValue,
    incomingMarketValue,
    packageAdjustment: packageResult.packageAdjustment,
    packageAdjustmentSide: packageResult.packageAdjustmentSide || null,
    rawPctDiff: Number(rawPctDiff.toFixed(2)),
    marketPctDiff: Number(marketPctDiff.toFixed(2)),
    packageTaxPct: Number(packageTaxPct.toFixed(2)),
    pctDiff: Number((
      rawPctDiff
      + Math.max(0, marketPctDiff - rawPctDiff) * marketGapWeight
      + packageTaxPct * packageTaxWeight
    ).toFixed(2)),
    netValueDelta: Math.round(incomingRawValue - outgoingRawValue),
  };
}

function participantStateHasAssetOfKind(participantState, assetId, kind) {
  if (!participantState) return false;
  return participantState.outgoingTransfers.some((transfer) => transfer.asset.assetId === assetId && transfer.kind === kind);
}

function collectMultiTeamRoutingMetrics(tradeState) {
  const pairSet = new Set();
  const receiverBySender = new Map();
  const senderByReceiver = new Map();
  let anchorTransferCount = 0;
  let fillerTransferCount = 0;

  tradeState.stateByRosterId.forEach((participantState) => {
    participantState.outgoingTransfers.forEach((transfer) => {
      pairSet.add(`${transfer.fromRosterId}->${transfer.toRosterId}`);
      if (!receiverBySender.has(transfer.fromRosterId)) receiverBySender.set(transfer.fromRosterId, new Set());
      if (!senderByReceiver.has(transfer.toRosterId)) senderByReceiver.set(transfer.toRosterId, new Set());
      receiverBySender.get(transfer.fromRosterId).add(transfer.toRosterId);
      senderByReceiver.get(transfer.toRosterId).add(transfer.fromRosterId);

      if (transfer.kind === "anchor") anchorTransferCount += 1;
      if (transfer.kind === "filler") fillerTransferCount += 1;
    });
  });

  return {
    pairCount: pairSet.size,
    senderSplitCount: [...receiverBySender.values()].reduce((sum, receiverIds) => sum + Math.max(0, receiverIds.size - 1), 0),
    receiverSplitCount: [...senderByReceiver.values()].reduce((sum, senderIds) => sum + Math.max(0, senderIds.size - 1), 0),
    anchorTransferCount,
    fillerTransferCount,
  };
}

function getMultiTeamMaxFillerRatio(participantCount) {
  return MULTI_TEAM_MAX_FILLER_RATIO_BASE
    + Math.max(0, participantCount - DEFAULT_MULTI_TEAM_COUNT) * MULTI_TEAM_MAX_FILLER_RATIO_STEP;
}

function getMultiTeamMaxUnrequestedAnchorRatio(participantCount) {
  return MULTI_TEAM_MAX_UNREQUESTED_ANCHOR_RATIO_BASE
    + Math.max(0, participantCount - DEFAULT_MULTI_TEAM_COUNT) * MULTI_TEAM_MAX_UNREQUESTED_ANCHOR_RATIO_STEP;
}

function getMultiTeamMaxFillerOverageRatio(participantCount) {
  return MULTI_TEAM_MAX_FILLER_OVERAGE_RATIO_BASE
    + Math.max(0, participantCount - DEFAULT_MULTI_TEAM_COUNT) * MULTI_TEAM_MAX_FILLER_OVERAGE_RATIO_STEP;
}

function summarizeMultiTeamParticipantShape(participantState, values) {
  const outgoingTransfers = participantState.outgoingTransfers || [];
  const incomingTransfers = participantState.incomingTransfers || [];
  const outgoingValue = outgoingTransfers.reduce((sum, transfer) => sum + getAssetValue(transfer.asset, values), 0);
  const incomingValue = incomingTransfers.reduce((sum, transfer) => sum + getAssetValue(transfer.asset, values), 0);
  const outgoingAnchorValue = outgoingTransfers
    .filter((transfer) => transfer.kind === "anchor")
    .reduce((sum, transfer) => sum + getAssetValue(transfer.asset, values), 0);
  const requestedIncomingTransfers = incomingTransfers.filter((transfer) => transfer.isRequested);
  const requestedIncomingValue = requestedIncomingTransfers.reduce((sum, transfer) => sum + getAssetValue(transfer.asset, values), 0);
  const incomingProfile = buildPackageProfile(incomingTransfers.map((transfer) => transfer.asset), values);
  const role = inferMultiTeamParticipantRole({
    outgoingAnchorValue,
    requestedIncomingValue,
    requestedIncomingCount: requestedIncomingTransfers.length,
  });

  return {
    outgoingValue,
    incomingValue,
    outgoingAnchorValue,
    outgoingFillerValue: Math.max(0, outgoingValue - outgoingAnchorValue),
    requestedIncomingValue,
    requestedIncomingCount: requestedIncomingTransfers.length,
    incomingNonRequestedValue: Math.max(0, incomingValue - requestedIncomingValue),
    incomingAssetCount: incomingTransfers.length,
    outgoingAssetCount: outgoingTransfers.length,
    incomingFillerAssetCount: incomingTransfers.filter((transfer) => transfer.kind === "filler").length,
    outgoingFillerAssetCount: outgoingTransfers.filter((transfer) => transfer.kind === "filler").length,
    incomingProfile,
    role,
  };
}

function inferMultiTeamParticipantRole({
  outgoingAnchorValue,
  requestedIncomingValue,
  requestedIncomingCount,
}) {
  if (!requestedIncomingCount) return "bridge";
  if (!outgoingAnchorValue || requestedIncomingValue >= outgoingAnchorValue * 1.08) return "level-up";
  if (requestedIncomingValue <= outgoingAnchorValue * 0.82) return "break-down";
  return "even";
}

function evaluateMultiTeamParticipantShape({
  tradeShape,
  participantCount,
}) {
  const loosenessFactor = 1 + Math.max(0, participantCount - DEFAULT_MULTI_TEAM_COUNT) * 0.12;
  const incomingAssetCount = tradeShape.incomingAssetCount;
  const outgoingAssetCount = tradeShape.outgoingAssetCount;
  const extraIncomingValue = tradeShape.incomingNonRequestedValue;
  const incomingProfile = tradeShape.incomingProfile;
  let scorePenalty = 0;

  if (tradeShape.role === "level-up") {
    const maxBonusValue = Math.max(900, tradeShape.requestedIncomingValue * 0.18 * loosenessFactor);
    if (extraIncomingValue > maxBonusValue) return { ok: false, scorePenalty: 0 };
    if (incomingAssetCount > 3 || outgoingAssetCount > 4) return { ok: false, scorePenalty: 0 };
    scorePenalty += extraIncomingValue / 220 + Math.max(0, incomingAssetCount - 2) * 2.8;
  } else if (tradeShape.role === "even") {
    const maxBonusValue = Math.max(1400, tradeShape.requestedIncomingValue * 0.38 * loosenessFactor);
    if (extraIncomingValue > maxBonusValue) return { ok: false, scorePenalty: 0 };
    if (incomingAssetCount > 3 + (participantCount >= 5 ? 1 : 0)) return { ok: false, scorePenalty: 0 };
    scorePenalty += extraIncomingValue / 260 + Math.max(0, incomingAssetCount - 2) * 2.1;
  } else if (tradeShape.role === "break-down") {
    const maxAssets = 4 + (participantCount >= 5 ? 1 : 0);
    const topTwoShare = incomingProfile.totalValue > 0 ? incomingProfile.topTwoValue / incomingProfile.totalValue : 1;
    if (incomingAssetCount > maxAssets || tradeShape.incomingFillerAssetCount > 3 + (participantCount >= 5 ? 1 : 0)) {
      return { ok: false, scorePenalty: 0 };
    }
    if (incomingAssetCount >= 4 && topTwoShare < 0.66) return { ok: false, scorePenalty: 0 };
    scorePenalty += Math.max(0, incomingAssetCount - 3) * 2.2 + Math.max(0, 0.74 - topTwoShare) * 18;
  } else {
    const bridgeGap = Math.abs(tradeShape.incomingValue - tradeShape.outgoingValue);
    const maxBridgeGap = Math.max(1000, Math.max(tradeShape.incomingValue, tradeShape.outgoingValue) * 0.22 * loosenessFactor);
    const maxBridgeAssets = 3 + Math.ceil(Math.max(0, participantCount - DEFAULT_MULTI_TEAM_COUNT) / 2);
    if (incomingAssetCount > maxBridgeAssets || outgoingAssetCount > maxBridgeAssets) return { ok: false, scorePenalty: 0 };
    if (bridgeGap > maxBridgeGap) return { ok: false, scorePenalty: 0 };
    scorePenalty += bridgeGap / 240 + Math.max(0, incomingAssetCount - 2) * 2.6;
  }

  return {
    ok: true,
    scorePenalty,
  };
}

function buildMultiTeamBalanceContext(tradeState, values) {
  const participantMetrics = getMultiTeamParticipantMetrics(tradeState, values);
  const senderMetrics = participantMetrics
    .filter((metric) => metric.needSend > 140)
    .sort((left, right) => right.needSend - left.needSend);
  const receiverMetrics = participantMetrics
    .filter((metric) => metric.needReceive > 140)
    .sort((left, right) => right.needReceive - left.needReceive);
  const anchorValueTotal = [...tradeState.stateByRosterId.values()].reduce((sum, participantState) => {
    return sum + participantState.outgoingTransfers
      .filter((transfer) => transfer.kind === "anchor")
      .reduce((assetSum, transfer) => assetSum + getAssetValue(transfer.asset, values), 0);
  }, 0);
  const requestedAnchorValueTotal = [...tradeState.stateByRosterId.values()].reduce((sum, participantState) => {
    return sum + participantState.outgoingTransfers
      .filter((transfer) => transfer.kind === "anchor" && transfer.isRequested)
      .reduce((assetSum, transfer) => assetSum + getAssetValue(transfer.asset, values), 0);
  }, 0);
  const totalNeedSend = senderMetrics.reduce((sum, metric) => sum + metric.needSend, 0);
  const totalNeedReceive = receiverMetrics.reduce((sum, metric) => sum + metric.needReceive, 0);

  return {
    participantMetrics,
    senderMetrics,
    receiverMetrics,
    anchorValueTotal,
    requestedAnchorValueTotal,
    unrequestedAnchorValueTotal: Math.max(0, anchorValueTotal - requestedAnchorValueTotal),
    totalNeedSend,
    totalNeedReceive,
  };
}

function solveMultiTeamCompensationPlans({
  tradeState,
  balanceContext,
  meRoster,
  values,
  tradeLab,
  maxResults,
}) {
  const participantCount = tradeState.participantRosters.length;
  const candidatePools = buildMultiTeamCompensationCandidatePools({
    tradeState,
    meRoster,
    values,
    tradeLab,
  });
  const basePairSet = new Set(
    [...tradeState.stateByRosterId.values()]
      .flatMap((participantState) => participantState.outgoingTransfers.map((transfer) => `${transfer.fromRosterId}->${transfer.toRosterId}`))
  );
  const baseBalances = new Map(
    balanceContext.participantMetrics.map((metric) => [
      metric.roster.rosterId,
      Math.round(metric.outgoingValue - metric.incomingValue),
    ])
  );
  const initialState = {
    transfers: [],
    balanceByRosterId: baseBalances,
    usedAssetIds: new Set(),
    pairSet: new Set(),
    receiverBySender: new Map(),
    senderByReceiver: new Map(),
    totalCompValue: 0,
    corePenalty: 0,
  };

  const completeStates = [];
  const exploredStates = [];
  const seenStates = new Set();
  const beamWidth = Math.max(MULTI_TEAM_COMPENSATION_BEAM_WIDTH, maxResults * 4);
  const maxCompAssets = participantCount + Math.max(1, Math.floor(participantCount / 2));
  let beam = [initialState];

  function maybeCaptureState(state) {
    exploredStates.push({
      transfers: state.transfers,
      meta: {
        fillerValueTotal: state.totalCompValue,
        fillerAssetCount: state.transfers.length,
        fillerPairCount: state.pairSet.size,
        senderSplitCount: [...state.receiverBySender.values()].reduce((sum, receiverIds) => sum + Math.max(0, receiverIds.size - 1), 0),
        receiverSplitCount: [...state.senderByReceiver.values()].reduce((sum, senderIds) => sum + Math.max(0, senderIds.size - 1), 0),
      },
      stateScore: scoreMultiTeamCompensationState(state, baseBalances, participantCount),
    });

    const stateKey = createMultiTeamCompensationStateKey(state);
    if (seenStates.has(stateKey)) return;
    if (!isMultiTeamCompensationStateViable(state, baseBalances, participantCount)) return;
    seenStates.add(stateKey);
    completeStates.push({
      transfers: state.transfers,
      meta: {
        fillerValueTotal: state.totalCompValue,
        fillerAssetCount: state.transfers.length,
        fillerPairCount: state.pairSet.size,
        senderSplitCount: [...state.receiverBySender.values()].reduce((sum, receiverIds) => sum + Math.max(0, receiverIds.size - 1), 0),
        receiverSplitCount: [...state.senderByReceiver.values()].reduce((sum, senderIds) => sum + Math.max(0, senderIds.size - 1), 0),
      },
      stateScore: scoreMultiTeamCompensationState(state, baseBalances, participantCount),
    });
  }

  maybeCaptureState(initialState);

  for (let depth = 0; depth < maxCompAssets; depth += 1) {
    const nextStates = [];

    beam.forEach((beamState) => {
      const moveCandidates = buildMultiTeamCompensationMoves({
        tradeState,
        beamState,
        baseBalances,
        candidatePools,
        basePairSet,
        meRoster,
        values,
      });

      moveCandidates.forEach((move) => {
        const nextState = applyMultiTeamCompensationMove(beamState, move);
        nextStates.push(nextState);
        maybeCaptureState(nextState);
      });
    });

    if (nextStates.length === 0) break;

    const dedupedStates = [];
    const seenBeamKeys = new Set();
    nextStates
      .sort((left, right) => scoreMultiTeamCompensationState(left, baseBalances, participantCount) - scoreMultiTeamCompensationState(right, baseBalances, participantCount))
      .forEach((state) => {
        const key = createMultiTeamCompensationStateKey(state);
        if (seenBeamKeys.has(key)) return;
        seenBeamKeys.add(key);
        dedupedStates.push(state);
      });
    beam = dedupedStates.slice(0, beamWidth);
  }

  if (completeStates.length === 0) {
    return dedupeMultiTeamCompensationPlans(exploredStates)
      .sort((left, right) => left.stateScore - right.stateScore)
      .slice(0, Math.max(MULTI_TEAM_VARIANT_COUNT, maxResults * 2));
  }

  return dedupeMultiTeamCompensationPlans(completeStates)
    .sort((left, right) => left.stateScore - right.stateScore)
    .slice(0, Math.max(MULTI_TEAM_VARIANT_COUNT, maxResults * 3));
}

function dedupeMultiTeamCompensationPlans(plans) {
  const seen = new Set();
  const deduped = [];

  plans.forEach((plan) => {
    const key = plan.transfers
      .map((transfer) => `${transfer.fromRosterId}>${transfer.toRosterId}:${transfer.asset.assetId}`)
      .sort()
      .join("|");
    if (seen.has(key)) return;
    seen.add(key);
    deduped.push(plan);
  });

  return deduped;
}

function buildMultiTeamCompensationCandidatePools({
  tradeState,
  meRoster,
  values,
  tradeLab,
}) {
  const pools = new Map();

  tradeState.stateByRosterId.forEach((participantState, rosterId) => {
    const candidates = buildAvailableMultiTeamFillerAssets({
      participantState,
      meRoster,
      values,
      tradeLab,
      variantIndex: 0,
      limit: MULTI_TEAM_COMPENSATION_ASSET_POOL_LIMIT,
    }).slice(0, MULTI_TEAM_COMPENSATION_ASSET_POOL_LIMIT);
    pools.set(rosterId, candidates);
  });

  return pools;
}

function buildMultiTeamCompensationMoves({
  tradeState,
  beamState,
  baseBalances,
  candidatePools,
  basePairSet,
  meRoster,
  values,
}) {
  const donors = [...beamState.balanceByRosterId.entries()]
    .filter(([, balance]) => balance < -MULTI_TEAM_COMPENSATION_TOLERANCE)
    .sort((left, right) => left[1] - right[1])
    .slice(0, MULTI_TEAM_COMPENSATION_DONOR_LIMIT);
  const recipients = [...beamState.balanceByRosterId.entries()]
    .filter(([, balance]) => balance > MULTI_TEAM_COMPENSATION_TOLERANCE)
    .sort((left, right) => right[1] - left[1])
    .slice(0, MULTI_TEAM_COMPENSATION_RECIPIENT_LIMIT);
  const moveCandidates = [];

  recipients.forEach(([toRosterId, recipientBalance]) => {
    donors.forEach(([fromRosterId, donorBalance]) => {
      if (toRosterId === fromRosterId) return;

      moveCandidates.push(
        ...buildMultiTeamCompensationPackageMoves({
          tradeState,
          beamState,
          candidatePools,
          basePairSet,
          meRoster,
          values,
          fromRosterId,
          toRosterId,
          donorBalance,
          recipientBalance,
        })
      );
    });
  });

  return moveCandidates
    .sort((left, right) => left.score - right.score)
    .slice(0, MULTI_TEAM_COMPENSATION_BRANCH_LIMIT);
}

function buildMultiTeamCompensationPackageMoves({
  tradeState,
  beamState,
  candidatePools,
  basePairSet,
  meRoster,
  values,
  fromRosterId,
  toRosterId,
  donorBalance,
  recipientBalance,
}) {
  const participantState = tradeState.stateByRosterId.get(fromRosterId);
  const availableAssets = (candidatePools.get(fromRosterId) || []).filter((asset) => !beamState.usedAssetIds.has(asset.assetId));
  if (availableAssets.length === 0) return [];

  const targetGap = Math.min(Math.abs(donorBalance), recipientBalance);
  const maxAssets = getMultiTeamCompensationMaxPackageAssets(targetGap);
  const rawPackages = buildPackages(availableAssets, values, Math.min(maxAssets, availableAssets.length))
    .map((pkg) => ({
      assets: pkg.assets,
      values: pkg.values,
      totalValue: pkg.values.reduce((sum, value) => sum + value, 0),
    }))
    .filter((pkg) => pkg.totalValue > 0);
  const seen = new Set();
  const packageMoves = [];

  rawPackages
    .sort((left, right) => {
      const leftGap = Math.abs(left.totalValue - targetGap);
      const rightGap = Math.abs(right.totalValue - targetGap);
      if (leftGap !== rightGap) return leftGap - rightGap;
      if (left.assets.length !== right.assets.length) return left.assets.length - right.assets.length;
      return left.totalValue - right.totalValue;
    })
    .forEach((pkg) => {
      const key = pkg.assets.map((asset) => asset.assetId).sort().join("|");
      if (seen.has(key)) return;
      seen.add(key);

      const score = scoreMultiTeamCompensationPackage({
        pkg,
        participantState,
        fromRosterId,
        toRosterId,
        donorBalance,
        recipientBalance,
        beamState,
        basePairSet,
        meRoster,
        values,
      });
      if (!Number.isFinite(score)) return;

      packageMoves.push({
        fromRosterId,
        toRosterId,
        assets: pkg.assets,
        totalValue: pkg.totalValue,
        score,
      });
    });

  return packageMoves
    .sort((left, right) => left.score - right.score)
    .slice(0, MULTI_TEAM_COMPENSATION_BRANCH_LIMIT);
}

function scoreMultiTeamCompensationPackage({
  pkg,
  participantState,
  fromRosterId,
  toRosterId,
  donorBalance,
  recipientBalance,
  beamState,
  basePairSet,
  meRoster,
  values,
}) {
  const pairKey = `${fromRosterId}->${toRosterId}`;
  const existingPair = basePairSet.has(pairKey) || beamState.pairSet.has(pairKey);
  const totalValue = pkg.totalValue;
  const donorAfter = donorBalance + totalValue;
  const recipientAfter = recipientBalance - totalValue;
  const donorOvershoot = Math.max(0, donorAfter);
  const recipientOvershoot = Math.max(0, -recipientAfter);
  const donorTolerance = Math.max(MULTI_TEAM_MAX_FILLER_OVERSHOOT_BASE, Math.abs(donorBalance) * 0.9);
  const recipientTolerance = Math.max(MULTI_TEAM_MAX_FILLER_OVERSHOOT_BASE, recipientBalance * 0.72);

  if (donorOvershoot > donorTolerance) return Number.POSITIVE_INFINITY;
  if (recipientOvershoot > recipientTolerance) return Number.POSITIVE_INFINITY;

  const senderTargets = beamState.receiverBySender.get(fromRosterId) || new Set();
  const recipientSources = beamState.senderByReceiver.get(toRosterId) || new Set();
  const isMyRoster = fromRosterId === meRoster.rosterId;
  const targetGap = Math.min(Math.abs(donorBalance), recipientBalance);
  const corePenalty = pkg.assets.reduce((sum, asset) => {
    return sum + (participantState.coreAssetIds.has(asset.assetId) ? (isMyRoster ? 980 : 460) : 0);
  }, 0);
  const selectedBonus = isMyRoster
    ? pkg.assets.reduce((sum, asset) => sum + (state.selectedOutgoingAssetIds.has(asset.assetId) ? 190 : 0), 0)
    : 0;
  const microPiecePenalty = pkg.values.reduce((sum, value, index) => sum + (index >= 1 && value < 900 ? 120 : 0), 0);
  const closenessPenalty = Math.abs(totalValue - targetGap) * 1.35;
  const lanePenalty = existingPair ? -140 : 95;
  const senderSplitPenalty = senderTargets.size > 0 && !senderTargets.has(toRosterId) ? 170 : 0;
  const receiverSplitPenalty = recipientSources.size > 0 && !recipientSources.has(fromRosterId) ? 140 : 0;
  const donorFlipPenalty = Math.max(0, donorAfter) * 1.9;
  const recipientFlipPenalty = Math.max(0, -recipientAfter) * 2.25;
  const assetCountPenalty = Math.max(0, pkg.assets.length - 1) * 155;
  const overpayPenalty = Math.max(0, totalValue - targetGap) * 0.82;
  const underpayPenalty = Math.max(0, targetGap - totalValue) * 0.48;
  const valuePenalty = totalValue * 0.18;
  const improvementBonus = (Math.min(Math.abs(donorBalance), totalValue) + Math.min(recipientBalance, totalValue)) * 1.22;

  return (
    closenessPenalty
    + overpayPenalty
    + underpayPenalty
    + valuePenalty
    + lanePenalty
    + senderSplitPenalty
    + receiverSplitPenalty
    + corePenalty
    + assetCountPenalty
    + microPiecePenalty
    + donorFlipPenalty
    + recipientFlipPenalty
    - selectedBonus
    - improvementBonus
  );
}

function getMultiTeamCompensationMaxPackageAssets(targetGap) {
  if (!Number.isFinite(targetGap) || targetGap <= 0) return 1;
  if (targetGap >= 7000) return 4;
  if (targetGap >= 2600) return 3;
  return 2;
}

function applyMultiTeamCompensationMove(beamState, move) {
  const nextBalances = new Map(beamState.balanceByRosterId);
  nextBalances.set(move.fromRosterId, nextBalances.get(move.fromRosterId) + move.totalValue);
  nextBalances.set(move.toRosterId, nextBalances.get(move.toRosterId) - move.totalValue);

  const nextUsedAssetIds = new Set(beamState.usedAssetIds);
  move.assets.forEach((asset) => nextUsedAssetIds.add(asset.assetId));

  const nextPairSet = new Set(beamState.pairSet);
  nextPairSet.add(`${move.fromRosterId}->${move.toRosterId}`);

  const nextReceiverBySender = cloneMapOfSets(beamState.receiverBySender);
  if (!nextReceiverBySender.has(move.fromRosterId)) nextReceiverBySender.set(move.fromRosterId, new Set());
  nextReceiverBySender.get(move.fromRosterId).add(move.toRosterId);

  const nextSenderByReceiver = cloneMapOfSets(beamState.senderByReceiver);
  if (!nextSenderByReceiver.has(move.toRosterId)) nextSenderByReceiver.set(move.toRosterId, new Set());
  nextSenderByReceiver.get(move.toRosterId).add(move.fromRosterId);

  return {
    transfers: [
      ...beamState.transfers,
      ...move.assets.map((asset) => ({
        fromRosterId: move.fromRosterId,
        toRosterId: move.toRosterId,
        asset,
      })),
    ],
    balanceByRosterId: nextBalances,
    usedAssetIds: nextUsedAssetIds,
    pairSet: nextPairSet,
    receiverBySender: nextReceiverBySender,
    senderByReceiver: nextSenderByReceiver,
    totalCompValue: beamState.totalCompValue + move.totalValue,
    corePenalty: beamState.corePenalty,
  };
}

function isMultiTeamCompensationStateViable(state, baseBalances, participantCount) {
  const tolerance = getMultiTeamCompensationTolerance(participantCount);
  let largestPositive = 0;
  let largestNegative = 0;
  let roleFlipValue = 0;

  state.balanceByRosterId.forEach((balance, rosterId) => {
    if (balance > largestPositive) largestPositive = balance;
    if (balance < largestNegative) largestNegative = balance;
    const baseBalance = baseBalances.get(rosterId) || 0;
    if (baseBalance < 0 && balance > tolerance) roleFlipValue += balance;
    if (baseBalance > 0 && balance < -tolerance) roleFlipValue += Math.abs(balance);
  });

  return largestPositive <= tolerance && Math.abs(largestNegative) <= tolerance && roleFlipValue <= tolerance * 1.5;
}

function scoreMultiTeamCompensationState(state, baseBalances, participantCount) {
  let positiveResidual = 0;
  let negativeResidual = 0;
  let roleFlipValue = 0;

  state.balanceByRosterId.forEach((balance, rosterId) => {
    if (balance > 0) positiveResidual += balance;
    if (balance < 0) negativeResidual += Math.abs(balance);
    const baseBalance = baseBalances.get(rosterId) || 0;
    if (baseBalance < 0 && balance > 0) roleFlipValue += balance;
    if (baseBalance > 0 && balance < 0) roleFlipValue += Math.abs(balance);
  });

  const senderSplitCount = [...state.receiverBySender.values()].reduce((sum, receiverIds) => sum + Math.max(0, receiverIds.size - 1), 0);
  const receiverSplitCount = [...state.senderByReceiver.values()].reduce((sum, senderIds) => sum + Math.max(0, senderIds.size - 1), 0);
  const tolerance = getMultiTeamCompensationTolerance(participantCount);
  const unresolvedPenalty = Math.max(0, positiveResidual - tolerance * state.balanceByRosterId.size);

  return (
    unresolvedPenalty * 6.4
    + roleFlipValue * 4.1
    + state.totalCompValue * 1.15
    + state.transfers.length * 165
    + state.pairSet.size * 95
    + senderSplitCount * 145
    + receiverSplitCount * 130
  );
}

function getMultiTeamCompensationTolerance(participantCount) {
  return MULTI_TEAM_COMPENSATION_TOLERANCE + Math.max(0, participantCount - DEFAULT_MULTI_TEAM_COUNT) * 55;
}

function createMultiTeamCompensationStateKey(state) {
  return state.transfers
    .map((transfer) => `${transfer.fromRosterId}>${transfer.toRosterId}:${transfer.asset.assetId}`)
    .sort()
    .join("|");
}

function cloneMapOfSets(source) {
  const clone = new Map();
  source.forEach((value, key) => {
    clone.set(key, new Set(value));
  });
  return clone;
}

function buildMultiTeamPackageVariants({
  tradeState,
  balanceContext,
  meRoster,
  values,
  tradeLab,
}) {
  if (balanceContext.senderMetrics.length === 0 || balanceContext.receiverMetrics.length === 0) {
    return [{
      senderPackages: new Map(),
      totalFillerValue: 0,
      totalFillerAssets: 0,
      packageScore: 0,
    }];
  }

  const senderContexts = balanceContext.senderMetrics.map((metric) => ({
    metric,
    participantState: tradeState.stateByRosterId.get(metric.roster.rosterId),
    packageOptions: buildMultiTeamSenderPackageOptions({
      tradeState,
      metric,
      meRoster,
      values,
      tradeLab,
    }),
  }));

  if (senderContexts.some((context) => context.packageOptions.length === 0)) return [];

  const variants = [];
  const targetTotal = balanceContext.totalNeedReceive;

  function walk(index, senderPackages, totalFillerValue, totalFillerAssets, packageScore) {
    if (index >= senderContexts.length) {
      const totalMismatch = Math.abs(totalFillerValue - targetTotal);
      const overshoot = Math.max(0, totalFillerValue - targetTotal);
      if (overshoot > Math.max(MULTI_TEAM_MAX_FILLER_OVERSHOOT_BASE, targetTotal * 0.18)) return;
      variants.push({
        senderPackages: new Map(senderPackages),
        totalFillerValue,
        totalFillerAssets,
        packageScore: packageScore + totalMismatch * 2.3 + overshoot * 2.8 + totalFillerAssets * 55,
      });
      return;
    }

    const context = senderContexts[index];
    for (const packageOption of context.packageOptions) {
      const nextTotalFillerValue = totalFillerValue + packageOption.totalValue;
      const hardCeiling = targetTotal + Math.max(MULTI_TEAM_MAX_FILLER_OVERSHOOT_BASE, targetTotal * 0.22);
      if (nextTotalFillerValue > hardCeiling) continue;
      senderPackages.set(context.metric.roster.rosterId, packageOption);
      walk(
        index + 1,
        senderPackages,
        nextTotalFillerValue,
        totalFillerAssets + packageOption.assets.length,
        packageScore + packageOption.packagePenalty
      );
      senderPackages.delete(context.metric.roster.rosterId);
    }
  }

  walk(0, new Map(), 0, 0, 0);

  return variants
    .sort((left, right) => left.packageScore - right.packageScore)
    .slice(0, MULTI_TEAM_VARIANT_COUNT);
}

function buildMultiTeamSenderPackageOptions({
  tradeState,
  metric,
  meRoster,
  values,
  tradeLab,
}) {
  const participantState = tradeState.stateByRosterId.get(metric.roster.rosterId);
  const candidateAssets = buildAvailableMultiTeamFillerAssets({
    participantState,
    meRoster,
    values,
    tradeLab,
    variantIndex: 0,
  });
  const maxAssets = getMultiTeamMaxFillerAssetsForGap(metric.needSend);
  const packageTarget = metric.needSend;
  const packages = [];

  packages.push({
    assets: [],
    totalValue: 0,
    packagePenalty: packageTarget * 4.2,
  });

  buildPackages(candidateAssets, values, maxAssets)
    .map((pkg) => ({
      assets: pkg.assets,
      totalValue: pkg.values.reduce((sum, value) => sum + value, 0),
    }))
    .forEach((pkg) => {
      if (pkg.totalValue <= 0) return;
      if (pkg.totalValue > packageTarget + Math.max(MULTI_TEAM_MAX_FILLER_OVERSHOOT_BASE, packageTarget * 0.32)) return;

      const overshoot = Math.max(0, pkg.totalValue - packageTarget);
      const shortfall = Math.max(0, packageTarget - pkg.totalValue);
      const corePenalty = pkg.assets.reduce((sum, asset) => {
        return sum + (participantState.coreAssetIds.has(asset.assetId) ? (participantState.roster.rosterId === meRoster.rosterId ? 520 : 260) : 0);
      }, 0);
      const assetCountPenalty = pkg.assets.length * 165;
      const overshootPenalty = overshoot * 3.8;
      const shortfallPenalty = shortfall * 2.4;
      const rawPenalty = overshootPenalty + shortfallPenalty + assetCountPenalty + corePenalty;

      packages.push({
        assets: pkg.assets,
        totalValue: pkg.totalValue,
        packagePenalty: rawPenalty,
      });
    });

  const deduped = [];
  const seen = new Set();
  for (const pkg of packages.sort((left, right) => {
    if (left.packagePenalty !== right.packagePenalty) return left.packagePenalty - right.packagePenalty;
    if (left.assets.length !== right.assets.length) return left.assets.length - right.assets.length;
    return left.totalValue - right.totalValue;
  })) {
    const key = pkg.assets.map((asset) => asset.assetId).sort().join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(pkg);
    if (deduped.length >= MULTI_TEAM_SENDER_PACKAGE_OPTION_LIMIT) break;
  }

  return deduped;
}

function getMultiTeamMaxFillerAssetsForGap(valueGap) {
  if (!Number.isFinite(valueGap) || valueGap <= 0) return 0;
  if (valueGap >= 6000) return 3;
  if (valueGap >= 2600) return 2;
  return 1;
}

function assignMultiTeamFillers({
  tradeState,
  balanceContext,
  packageVariant,
  values,
}) {
  if (packageVariant.totalFillerAssets === 0) {
    return {
      transfers: [],
      meta: {
        fillerValueTotal: 0,
        fillerAssetCount: 0,
        fillerPairCount: 0,
        senderSplitCount: 0,
        receiverSplitCount: 0,
      },
    };
  }

  const fillerAssets = [...packageVariant.senderPackages.entries()]
    .flatMap(([fromRosterId, pkg]) => pkg.assets.map((asset) => ({
      fromRosterId,
      asset,
      value: getAssetValue(asset, values),
    })))
    .sort((left, right) => right.value - left.value || left.asset.name.localeCompare(right.asset.name));
  const receiverNeeds = new Map(balanceContext.receiverMetrics.map((metric) => [metric.roster.rosterId, metric.needReceive]));
  const basePairSet = new Set(
    [...tradeState.stateByRosterId.values()]
      .flatMap((participantState) => participantState.outgoingTransfers.map((transfer) => `${transfer.fromRosterId}->${transfer.toRosterId}`))
  );

  let bestResult = null;

  function walk(index, remainingNeeds, transfers, fillerPairSet, receiverBySender, senderByReceiver) {
    if (index >= fillerAssets.length) {
      const residualGap = [...remainingNeeds.values()].reduce((sum, gap) => sum + Math.abs(gap), 0);
      const overshootGap = [...remainingNeeds.values()].reduce((sum, gap) => sum + Math.max(0, -gap), 0);
      const fillerPairCount = fillerPairSet.size;
      const senderSplitCount = [...receiverBySender.values()].reduce((sum, receiverIds) => sum + Math.max(0, receiverIds.size - 1), 0);
      const receiverSplitCount = [...senderByReceiver.values()].reduce((sum, senderIds) => sum + Math.max(0, senderIds.size - 1), 0);
      const objective = residualGap * 3.8 + overshootGap * 5.6 + fillerPairCount * 160 + senderSplitCount * 170 + receiverSplitCount * 145 + transfers.length * 28;

      if (!bestResult || objective < bestResult.objective) {
        bestResult = {
          objective,
          transfers: [...transfers],
          meta: {
            fillerValueTotal: packageVariant.totalFillerValue,
            fillerAssetCount: fillerAssets.length,
            fillerPairCount,
            senderSplitCount,
            receiverSplitCount,
          },
        };
      }
      return;
    }

    const fillerAsset = fillerAssets[index];
    const receiverOptions = buildMultiTeamReceiverOptions({
      fillerAsset,
      remainingNeeds,
      basePairSet,
      fillerPairSet,
      receiverBySender,
      senderByReceiver,
    });
    if (receiverOptions.length === 0) return;

    for (const option of receiverOptions) {
      const nextNeeds = new Map(remainingNeeds);
      nextNeeds.set(option.toRosterId, option.remainingAfter);
      const nextTransfers = [...transfers, {
        fromRosterId: fillerAsset.fromRosterId,
        toRosterId: option.toRosterId,
        asset: fillerAsset.asset,
      }];
      const nextPairSet = new Set(fillerPairSet);
      nextPairSet.add(option.pairKey);
      const nextReceiverBySender = new Map(receiverBySender);
      const nextReceiverSet = new Set(nextReceiverBySender.get(fillerAsset.fromRosterId) || []);
      nextReceiverSet.add(option.toRosterId);
      nextReceiverBySender.set(fillerAsset.fromRosterId, nextReceiverSet);
      const nextSenderByReceiver = new Map(senderByReceiver);
      const nextSenderSet = new Set(nextSenderByReceiver.get(option.toRosterId) || []);
      nextSenderSet.add(fillerAsset.fromRosterId);
      nextSenderByReceiver.set(option.toRosterId, nextSenderSet);
      walk(index + 1, nextNeeds, nextTransfers, nextPairSet, nextReceiverBySender, nextSenderByReceiver);
    }
  }

  walk(0, receiverNeeds, [], new Set(), new Map(), new Map());
  return bestResult;
}

function buildMultiTeamReceiverOptions({
  fillerAsset,
  remainingNeeds,
  basePairSet,
  fillerPairSet,
  receiverBySender,
  senderByReceiver,
}) {
  const options = [];
  remainingNeeds.forEach((remainingNeed, toRosterId) => {
    if (toRosterId === fillerAsset.fromRosterId) return;

    const pairKey = `${fillerAsset.fromRosterId}->${toRosterId}`;
    const remainingAfter = remainingNeed - fillerAsset.value;
    const overshoot = Math.max(0, -remainingAfter);
    const maxOvershoot = Math.max(MULTI_TEAM_MAX_FILLER_OVERSHOOT_BASE, remainingNeed * 0.65);
    if (overshoot > maxOvershoot) return;

    const existingPair = basePairSet.has(pairKey) || fillerPairSet.has(pairKey);
    const senderTargets = receiverBySender.get(fillerAsset.fromRosterId) || new Set();
    const receiverSenders = senderByReceiver.get(toRosterId) || new Set();
    const newDestinationPenalty = !existingPair && senderTargets.size > 0 && !senderTargets.has(toRosterId) ? 1 : 0;
    const multiSenderPenalty = receiverSenders.size > 0 && !receiverSenders.has(fillerAsset.fromRosterId) ? 1 : 0;
    const closenessPenalty = Math.abs(fillerAsset.value - remainingNeed);
    const optionScore = closenessPenalty + overshoot * 1.1 + newDestinationPenalty * 260 + multiSenderPenalty * 190 + (existingPair ? -110 : 0);

    options.push({
      toRosterId,
      pairKey,
      remainingAfter,
      optionScore,
    });
  });

  return options
    .sort((left, right) => left.optionScore - right.optionScore)
    .slice(0, MULTI_TEAM_MAX_FILLER_PAIRS_PER_ASSET);
}

function buildCircularRecipientMap(ownerSequence) {
  const recipientMap = new Map();
  ownerSequence.forEach((rosterId, index) => {
    recipientMap.set(rosterId, ownerSequence[(index + 1) % ownerSequence.length]);
  });
  return recipientMap;
}

function buildAutoMultiTeamHelperSets({ meRoster, targetOwner, helperCount, targetValue, values }) {
  if (helperCount === 0) return [[]];

  const rankedHelpers = state.normalizedRosters
    .filter((roster) => roster.rosterId !== meRoster.rosterId && roster.rosterId !== targetOwner.rosterId)
    .map((roster) => ({
      roster,
      score: scoreAutoMultiTeamHelperRoster(roster, targetValue, values, helperCount),
    }))
    .sort((a, b) => b.score - a.score || a.roster.manager.displayName.localeCompare(b.roster.manager.displayName));

  const sets = [];
  const maxStart = Math.max(1, Math.min(4, rankedHelpers.length - helperCount + 1));
  for (let start = 0; start < maxStart; start += 1) {
    const slice = rankedHelpers.slice(start, start + helperCount).map((entry) => entry.roster);
    if (slice.length === helperCount) sets.push(slice);
  }
  if (sets.length === 0 && rankedHelpers.length >= helperCount) {
    sets.push(rankedHelpers.slice(0, helperCount).map((entry) => entry.roster));
  }
  return dedupeHelperRosterSets(sets);
}

function dedupeHelperRosterSets(sets) {
  const seen = new Set();
  const deduped = [];
  sets.forEach((set) => {
    const key = set.map((roster) => roster.rosterId).join("|");
    if (seen.has(key)) return;
    seen.add(key);
    deduped.push(set);
  });
  return deduped;
}

function scoreAutoMultiTeamHelperRoster(roster, targetValue, values, helperCount = 1) {
  const bridgeTarget = Math.max(900, targetValue / Math.max(2.4, helperCount + 1.6));
  const helperCap = targetValue * AUTO_MULTI_TEAM_HELPER_ANCHOR_CAP_SHARE;
  const coreAssetIds = getCoreAssetIdSet(roster, values);
  const topAssets = roster.assets
    .filter(isTradeEligibleAsset)
    .map((asset) => ({ asset, value: getAssetValue(asset, values) }))
    .filter((entry) => Number.isFinite(entry.value))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
  if (topAssets.length === 0) return Number.NEGATIVE_INFINITY;

  const bestBridgeScore = Math.max(...topAssets.map((entry) => {
    const overCapPenalty = entry.value > helperCap ? (entry.value - helperCap) * 1.1 : 0;
    const corePenalty = coreAssetIds.has(entry.asset.assetId) ? 620 : 0;
    const liquidityBonus = entry.asset.assetType === "pick" ? 140 : isYouthAsset(entry.asset) ? 60 : 0;
    return 10000 - Math.abs(entry.value - bridgeTarget) - overCapPenalty - corePenalty + liquidityBonus;
  }));
  const bridgeDepthBonus = topAssets.filter((entry) => (
    entry.value >= bridgeTarget * 0.55
    && entry.value <= helperCap
    && !coreAssetIds.has(entry.asset.assetId)
  )).length * 55;
  const starPenalty = topAssets.filter((entry) => entry.value > targetValue * 0.82).length * 110;

  return bestBridgeScore + bridgeDepthBonus - starPenalty;
}

function getResolvedMultiTeamTradeTier(tradeTier) {
  return tradeTier === "all" ? "even" : tradeTier;
}

function getAutoMultiTeamMyAnchorTargetValue(targetValue, helperCount, tradeTier) {
  const resolvedTradeTier = getResolvedMultiTeamTradeTier(tradeTier);
  const baseShare = resolvedTradeTier === "level-up"
    ? 0.68
    : resolvedTradeTier === "break-down"
      ? 0.92
      : 0.82;
  return Math.max(900, targetValue * Math.max(0.46, baseShare - helperCount * 0.06));
}

function buildAutoMultiTeamHelperTargetValues({ targetValue, myAnchorValue, helperCount }) {
  if (helperCount <= 0) return [];

  const targets = [];
  let nextTarget = Math.min(
    targetValue * 0.52,
    Math.max(850, (targetValue - myAnchorValue) * 0.72)
  );

  for (let index = 0; index < helperCount; index += 1) {
    const remainingHelpers = helperCount - index;
    const floor = Math.max(450, nextTarget * 0.4, (targetValue - myAnchorValue) / Math.max(remainingHelpers + 1, 2) * 0.55);
    const desiredValue = Math.round(Math.max(floor, nextTarget));
    targets.push(desiredValue);
    nextTarget = Math.max(450, desiredValue * 0.62);
  }

  return targets;
}

function listAutoMultiTeamAnchorCandidates({
  roster,
  targetValue,
  desiredValue,
  values,
  tradeTier,
  usedAssetIds = new Set(),
  protectRosterCore = false,
  isMyRoster = false,
  minValue = 0,
  maxValue = Number.POSITIVE_INFINITY,
  limit = 1,
  preferLiquidity = false,
}) {
  const coreAssetIds = protectRosterCore ? getCoreAssetIdSet(roster, values) : new Set();
  const lockedSelectedAssets = isMyRoster && state.selectedOutgoingAssetIds.size > 0
    ? roster.assets.filter((asset) => state.selectedOutgoingAssetIds.has(asset.assetId) && !usedAssetIds.has(asset.assetId))
    : [];
  if (lockedSelectedAssets.length > 0) {
    return [...lockedSelectedAssets]
      .filter((asset) => getAssetValue(asset, values) >= minValue)
      .sort((a, b) => sortAssetsByValueDesc(a, b, values))
      .slice(0, limit);
  }

  const resolvedTradeTier = getResolvedMultiTeamTradeTier(tradeTier);
  const fallbackDesiredValue = resolvedTradeTier === "level-up"
    ? targetValue * 0.72
    : resolvedTradeTier === "break-down"
      ? targetValue * 1.08
      : targetValue;
  const targetBand = Number.isFinite(desiredValue) && desiredValue > 0 ? desiredValue : fallbackDesiredValue;

  return roster.assets
    .filter(isTradeEligibleAsset)
    .filter((asset) => Number.isFinite(getAssetValue(asset, values)))
    .filter((asset) => !usedAssetIds.has(asset.assetId))
    .filter((asset) => !isMyRoster || !state.excludedOutgoingAssetIds.has(asset.assetId))
    .filter((asset) => {
      const value = getAssetValue(asset, values);
      return value >= minValue && value <= maxValue;
    })
    .sort((left, right) => {
      const leftValue = getAssetValue(left, values);
      const rightValue = getAssetValue(right, values);
      const leftScore = Math.abs(leftValue - targetBand)
        + (leftValue > maxValue ? (leftValue - maxValue) * 1.35 : 0)
        + (coreAssetIds.has(left.assetId) ? 650 : 0)
        - (preferLiquidity && left.assetType === "pick" ? 180 : 0)
        - (preferLiquidity && isYouthAsset(left) ? 60 : 0);
      const rightScore = Math.abs(rightValue - targetBand)
        + (rightValue > maxValue ? (rightValue - maxValue) * 1.35 : 0)
        + (coreAssetIds.has(right.assetId) ? 650 : 0)
        - (preferLiquidity && right.assetType === "pick" ? 180 : 0)
        - (preferLiquidity && isYouthAsset(right) ? 60 : 0);
      if (leftScore !== rightScore) return leftScore - rightScore;
      return rightValue - leftValue;
    })
    .slice(0, limit);
}

function buildAutoMultiTeamAnchorPlans({
  meRoster,
  helperSet,
  targetOwner,
  targetAsset,
  values,
  tradeTier,
}) {
  const targetValue = getAssetValue(targetAsset, values);
  if (!Number.isFinite(targetValue)) return [];

  const helperCount = helperSet.length;
  const myAnchorCandidates = listAutoMultiTeamAnchorCandidates({
    roster: meRoster,
    targetValue,
    desiredValue: getAutoMultiTeamMyAnchorTargetValue(targetValue, helperCount, tradeTier),
    values,
    tradeTier,
    usedAssetIds: new Set([targetAsset.assetId]),
    protectRosterCore: true,
    isMyRoster: true,
    minValue: 750,
    maxValue: targetValue * (getResolvedMultiTeamTradeTier(tradeTier) === "break-down" ? 1.15 : 0.96),
    limit: AUTO_MULTI_TEAM_MY_ANCHOR_CANDIDATE_LIMIT,
  });
  if (myAnchorCandidates.length === 0) {
    myAnchorCandidates.push(
      ...listAutoMultiTeamAnchorCandidates({
        roster: meRoster,
        targetValue,
        desiredValue: targetValue * 0.8,
        values,
        tradeTier,
        usedAssetIds: new Set([targetAsset.assetId]),
        protectRosterCore: true,
        isMyRoster: true,
        minValue: 650,
        maxValue: targetValue * 1.08,
        limit: AUTO_MULTI_TEAM_MY_ANCHOR_CANDIDATE_LIMIT,
      })
    );
  }
  if (myAnchorCandidates.length === 0) return [];

  const plans = [];
  myAnchorCandidates.forEach((myAnchor) => {
    for (let helperVariant = 0; helperVariant < AUTO_MULTI_TEAM_HELPER_ANCHOR_CANDIDATE_LIMIT; helperVariant += 1) {
      const usedAnchorIds = new Set([targetAsset.assetId, myAnchor.assetId]);
      const helperTargets = buildAutoMultiTeamHelperTargetValues({
        targetValue,
        myAnchorValue: getAssetValue(myAnchor, values),
        helperCount,
      });
      const helperAnchors = [];
      let failed = false;

      helperSet.forEach((helperRoster, helperIndex) => {
        const desiredValue = helperTargets[helperIndex] || Math.max(450, targetValue * 0.16);
        const primaryHelperCandidates = listAutoMultiTeamAnchorCandidates({
          roster: helperRoster,
          targetValue,
          desiredValue,
          values,
          tradeTier,
          usedAssetIds: usedAnchorIds,
          minValue: Math.max(350, desiredValue * 0.45),
          maxValue: Math.min(targetValue * AUTO_MULTI_TEAM_HELPER_ANCHOR_CAP_SHARE, desiredValue * 1.45 + 600),
          limit: AUTO_MULTI_TEAM_HELPER_ANCHOR_CANDIDATE_LIMIT,
          preferLiquidity: true,
        });
        const helperCandidate = primaryHelperCandidates[Math.min(helperVariant, primaryHelperCandidates.length - 1)] || listAutoMultiTeamAnchorCandidates({
          roster: helperRoster,
          targetValue,
          desiredValue,
          values,
          tradeTier,
          usedAssetIds: usedAnchorIds,
          minValue: Math.max(300, desiredValue * 0.38),
          maxValue: Math.min(targetValue * 0.82, desiredValue * 1.75 + 900),
          limit: 1,
          preferLiquidity: true,
        })[0];
        if (!helperCandidate) {
          failed = true;
          return;
        }
        helperAnchors.push({
          roster: helperRoster,
          asset: helperCandidate,
          value: getAssetValue(helperCandidate, values),
        });
        usedAnchorIds.add(helperCandidate.assetId);
      });

      if (failed) continue;

      const orderedHelperAnchors = helperAnchors
        .sort((left, right) => right.value - left.value || left.roster.manager.displayName.localeCompare(right.roster.manager.displayName));
      const participantRosters = [meRoster, ...orderedHelperAnchors.map((entry) => entry.roster), targetOwner];
      const anchorAssetByOwner = new Map([
        [meRoster.rosterId, myAnchor],
        [targetOwner.rosterId, targetAsset],
        ...orderedHelperAnchors.map((entry) => [entry.roster.rosterId, entry.asset]),
      ]);
      const ownerSequence = participantRosters.map((roster) => roster.rosterId);
      const anchorTransfers = ownerSequence
        .map((ownerId, index) => ({
          fromRosterId: ownerId,
          toRosterId: ownerSequence[(index + 1) % ownerSequence.length],
          asset: anchorAssetByOwner.get(ownerId),
          isRequested: ownerId === targetOwner.rosterId,
        }))
        .filter((transfer) => transfer.asset);

      if (anchorTransfers.length !== participantRosters.length) continue;
      plans.push({
        participantRosters,
        anchorTransfers,
      });
    }
  });

  return dedupeAutoMultiTeamAnchorPlans(plans).slice(0, AUTO_MULTI_TEAM_MY_ANCHOR_CANDIDATE_LIMIT + 1);
}

function dedupeAutoMultiTeamAnchorPlans(plans) {
  const seen = new Set();
  const deduped = [];
  plans.forEach((plan) => {
    const key = plan.anchorTransfers
      .map((transfer) => `${transfer.fromRosterId}:${transfer.asset.assetId}`)
      .sort()
      .join("|");
    if (seen.has(key)) return;
    seen.add(key);
    deduped.push(plan);
  });
  return deduped;
}

function pickAutoMultiTeamAnchorAsset({
  roster,
  targetValue,
  values,
  tradeTier,
  usedAssetIds = new Set(),
  protectRosterCore = false,
  isMyRoster = false,
}) {
  return listAutoMultiTeamAnchorCandidates({
    roster,
    targetValue,
    desiredValue: null,
    values,
    tradeTier,
    usedAssetIds,
    protectRosterCore,
    isMyRoster,
    limit: 1,
  })[0] || null;
}

function buildMultiTeamIdeasFromCycle({
  meRoster,
  participantRosters,
  ownerToRecipient,
  anchorAssetByOwner,
  ownerSequence,
  values,
  fairnessPct,
  maxResults,
  tradeLab,
  focusLabel,
}) {
  const anchorValues = [...anchorAssetByOwner.values()].map((asset) => getAssetValue(asset, values)).filter(Number.isFinite);
  if (anchorValues.length !== participantRosters.length) return [];

  const globalMaxValue = getGlobalMaxPlayerValue(values, Math.max(...anchorValues));
  const commonStartValue = Math.max(...anchorValues);
  const effectiveFairnessPct = getEffectiveFairnessPct(fairnessPct, tradeLab.tradeVibe);
  const lockedAnchorIds = new Set([...anchorAssetByOwner.values()].map((asset) => asset.assetId));
  const ideas = [];

  for (let variantIndex = 0; variantIndex < Math.max(maxResults, MULTI_TEAM_VALUE_VARIANTS); variantIndex += 1) {
    const commonValue = commonStartValue + variantIndex * MULTI_TEAM_VALUE_STEP;
    const outgoingByOwner = new Map();
    let failedVariant = false;

    for (const rosterId of ownerSequence) {
      const roster = findRosterById(rosterId);
      const anchorAsset = anchorAssetByOwner.get(rosterId);
      const packageVariants = buildOutgoingPackageVariantsForCommonValue({
        roster,
        anchorAsset,
        commonValue,
        values,
        participantIsMe: rosterId === meRoster.rosterId,
        lockedAnchorIds,
      });
      const chosenVariant = packageVariants[Math.min(variantIndex, packageVariants.length - 1)] || packageVariants[0];
      if (!chosenVariant) {
        failedVariant = true;
        break;
      }
      outgoingByOwner.set(rosterId, chosenVariant);
    }

    if (failedVariant) continue;

    const senderByRecipient = new Map();
    ownerToRecipient.forEach((recipientId, ownerId) => senderByRecipient.set(recipientId, ownerId));

    const participants = participantRosters.map((roster) => {
      const ownerId = roster.rosterId;
      const senderId = senderByRecipient.get(ownerId);
      const outgoingPackage = outgoingByOwner.get(ownerId);
      const incomingPackage = outgoingByOwner.get(senderId);
      const packageResult = calculatePackageAdjustment({
        myValues: outgoingPackage.values,
        theirValues: incomingPackage.values,
        globalMaxValue,
      });
      const pctDiff = Number(calculatePctDiff(packageResult.myAdjustedValue, packageResult.theirAdjustedValue).toFixed(2));

      return {
        roster,
        sendToName: findRosterById(ownerToRecipient.get(ownerId))?.manager.displayName || "next team",
        receiveFromName: findRosterById(senderId)?.manager.displayName || "previous team",
        outgoingAssets: outgoingPackage.assets,
        incomingAssets: incomingPackage.assets,
        outgoingAdjustedValue: packageResult.myAdjustedValue,
        incomingAdjustedValue: packageResult.theirAdjustedValue,
        packageAdjustment: packageResult.packageAdjustment,
        packageAdjustmentSide: packageResult.packageAdjustmentSide || null,
        pctDiff,
      };
    });

    if (participants.some((participant) => participant.pctDiff > effectiveFairnessPct)) continue;

    const maxPctDiff = Number(Math.max(...participants.map((participant) => participant.pctDiff)).toFixed(2));
    const avgPctDiff = Number((participants.reduce((sum, participant) => sum + participant.pctDiff, 0) / participants.length).toFixed(2));
    const totalExtraAssets = participants.reduce((sum, participant) => sum + Math.max(0, participant.outgoingAssets.length - 1), 0);
    const labScore = clamp(Math.round(91 - maxPctDiff * 1.25 - totalExtraAssets * 1.4 + (participants.length >= 4 ? 2 : 0)), 1, 99);

    ideas.push({
      teamCount: participantRosters.length,
      commonValue,
      maxPctDiff,
      avgPctDiff,
      labScore,
      meRosterId: meRoster.rosterId,
      participants,
      tags: [`${participantRosters.length} Team`, maxPctDiff <= 6 ? "Tight Value" : "Fair Value"],
      summary: buildMultiTeamSummary(participants, focusLabel),
    });
  }

  return dedupeMultiTeamIdeas(ideas).sort((a, b) => compareMultiTeamIdeas(a, b)).slice(0, maxResults);
}

function buildOutgoingPackageVariantsForCommonValue({
  roster,
  anchorAsset,
  commonValue,
  values,
  participantIsMe = false,
  lockedAnchorIds = new Set(),
}) {
  if (!roster || !anchorAsset) return [];

  const requiredExtraAssetIds = participantIsMe
    ? [...state.selectedOutgoingAssetIds].filter((assetId) => assetId !== anchorAsset.assetId && !state.excludedOutgoingAssetIds.has(assetId))
    : [];
  const supplementPool = buildSupplementAssetPool({
    roster,
    values,
    commonValue,
    participantIsMe,
    lockedAnchorIds,
    requiredExtraAssetIds,
  });
  const packagePool = [anchorAsset, ...supplementPool.filter((asset) => asset.assetId !== anchorAsset.assetId)];
  const requiredAssetIds = new Set([anchorAsset.assetId, ...requiredExtraAssetIds]);
  const packages = buildPackages(packagePool, values, 1 + MULTI_TEAM_MAX_EXTRAS_PER_SENDER, { requiredAssetIds })
    .map((pkg) => ({
      ...pkg,
      totalValue: pkg.values.reduce((sum, value) => sum + value, 0),
    }))
    .sort((a, b) => {
      const aDiff = Math.abs(a.totalValue - commonValue);
      const bDiff = Math.abs(b.totalValue - commonValue);
      if (aDiff !== bDiff) return aDiff - bDiff;
      if (a.assets.length !== b.assets.length) return a.assets.length - b.assets.length;
      return a.totalValue - b.totalValue;
    });

  return packages.slice(0, MULTI_TEAM_VALUE_VARIANTS + 1);
}

function buildSupplementAssetPool({
  roster,
  values,
  commonValue,
  participantIsMe = false,
  lockedAnchorIds = new Set(),
  requiredExtraAssetIds = [],
}) {
  const requiredSet = new Set(requiredExtraAssetIds);
  const allCandidates = roster.assets
    .filter(isTradeEligibleAsset)
    .filter((asset) => !lockedAnchorIds.has(asset.assetId))
    .filter((asset) => Number.isFinite(getAssetValue(asset, values)))
    .filter((asset) => !participantIsMe || !state.excludedOutgoingAssetIds.has(asset.assetId));
  const requiredAssets = allCandidates.filter((asset) => requiredSet.has(asset.assetId));
  const optionalAssets = allCandidates
    .filter((asset) => !requiredSet.has(asset.assetId))
    .sort((left, right) => {
      const leftGap = Math.abs(getAssetValue(left, values) - commonValue * 0.32);
      const rightGap = Math.abs(getAssetValue(right, values) - commonValue * 0.32);
      if (leftGap !== rightGap) return leftGap - rightGap;
      return sortAssetsByValueDesc(left, right, values);
    })
    .slice(0, MULTI_TEAM_FILLER_POOL_LIMIT);

  return [...requiredAssets, ...optionalAssets];
}

function buildMultiTeamSummary(participants, focusLabel) {
  const flow = participants
    .map((participant) => {
      const sendTargets = participant.sendToNames?.length ? participant.sendToNames.join(", ") : "the field";
      return `${participant.roster.manager.displayName} to ${sendTargets}`;
    })
    .join(" • ");
  return `Route centered on ${focusLabel}: ${flow}.`;
}

function dedupeMultiTeamIdeas(ideas) {
  const seen = new Set();
  const deduped = [];
  ideas.forEach((idea) => {
    const key = idea.participants
      .map((participant) => `${participant.roster.rosterId}:${participant.outgoingAssets.map((asset) => asset.assetId).sort().join("|")}`)
      .sort()
      .join("::");
    if (seen.has(key)) return;
    seen.add(key);
    deduped.push(idea);
  });
  return deduped;
}

function compareMultiTeamIdeas(a, b) {
  const byScore = b.labScore - a.labScore;
  if (byScore !== 0) return byScore;
  const byExtraAnchors = (b.extraAnchorCount || 0) - (a.extraAnchorCount || 0);
  if (byExtraAnchors !== 0) return byExtraAnchors;
  const byRouteSplit = (b.routeSplitCount || 0) - (a.routeSplitCount || 0);
  if (byRouteSplit !== 0) return byRouteSplit;
  const byAddedValue = (a.extraMovedValueTotal || 0) - (b.extraMovedValueTotal || 0);
  if (byAddedValue !== 0) return byAddedValue;
  const byFillerRatio = (a.fillerRatio || 0) - (b.fillerRatio || 0);
  if (byFillerRatio !== 0) return byFillerRatio;
  const byFillerAssets = (a.fillerAssetCount || 0) - (b.fillerAssetCount || 0);
  if (byFillerAssets !== 0) return byFillerAssets;
  const byMaxDiff = a.maxPctDiff - b.maxPctDiff;
  if (byMaxDiff !== 0) return byMaxDiff;
  const byAvgDiff = a.avgPctDiff - b.avgPctDiff;
  if (byAvgDiff !== 0) return byAvgDiff;
  return a.participants.reduce((sum, participant) => sum + participant.outgoingAssets.length, 0)
    - b.participants.reduce((sum, participant) => sum + participant.outgoingAssets.length, 0);
}

function suggestTrades({
  myRoster,
  theirRoster,
  targetAsset,
  values,
  fairnessPct,
  maxResults,
  allowExtraTargetAssets,
  requireExtraTargetAsset = false,
  maxExtraTargetAssets = 1,
  maxExtraTargetAssetShare = 0.3,
  maxExtraTargetTotalShare = 0.55,
  tradeLab,
  searchContext = null,
}) {
  const targetValue = searchContext?.targetValue ?? getAssetValue(targetAsset, values);
  if (!Number.isFinite(targetValue)) return [];

  const coreAssetIds = searchContext?.coreAssetIds || getCoreAssetIdSet(myRoster, values);
  const myAssetPool = searchContext?.myAssetPool
    || resolveOutgoingAssetPool({ myRoster, values, tradeLab, targetValue, coreAssetIds });
  if (myAssetPool.length === 0) return [];

  const globalMaxValue = searchContext?.globalMaxValue ?? getGlobalMaxPlayerValue(values, targetValue);
  const maxOutgoingAssets = searchContext?.maxOutgoingAssets ?? getMaxOutgoingPackageSize(targetValue);
  const requiredOutgoingAssetIds = searchContext?.requiredOutgoingAssetIds
    || new Set(
      [...tradeLab.selectedOutgoingAssetIds].filter((assetId) => myAssetPool.some((asset) => asset.assetId === assetId))
    );
  const myPackages = searchContext?.myPackages || buildPackages(myAssetPool, values, maxOutgoingAssets, {
    requiredAssetIds: requiredOutgoingAssetIds,
    targetValue,
  });
  const theirPackages = buildTargetPackages({
    theirRoster,
    targetAsset,
    values,
    allowExtraTargetAssets,
    maxExtraAssets: maxExtraTargetAssets,
    maxExtraAssetShare: maxExtraTargetAssetShare,
    maxExtraTotalShare: maxExtraTargetTotalShare,
  }).filter(
    (pkg) => (requireExtraTargetAsset ? pkg.assets.length > 1 : pkg.assets.length === 1)
  );
  const effectiveFairnessPct = searchContext?.effectiveFairnessPct ?? getEffectiveFairnessPct(fairnessPct, tradeLab.tradeVibe);
  const ideaStyle = requireExtraTargetAsset ? "throw-in-back" : "direct";

  const rawIdeas = [];
  walkPackagePairs(myPackages, theirPackages, {
    fairnessPct: effectiveFairnessPct,
    visit(myPackage, theirPackage) {
      const packageResult = calculatePackageAdjustment({
        myValues: myPackage.values,
        theirValues: theirPackage.values,
        globalMaxValue,
      });
      const pctDiff = calculatePctDiff(packageResult.myAdjustedValue, packageResult.theirAdjustedValue);
      if (pctDiff > effectiveFairnessPct) return false;
      const labDetails = scoreTradeIdea({
        myRoster,
        theirRoster,
        targetAsset,
        myAssets: myPackage.assets,
        theirAssets: theirPackage.assets,
        values,
        pctDiff,
        tradeLab,
        ideaStyle,
        coreAssetIds,
      });
      if (!labDetails.viable) return false;
      rawIdeas.push({
        myAssets: myPackage.assets,
        theirAssets: theirPackage.assets,
        ...packageResult,
        pctDiff: Number(pctDiff.toFixed(2)),
        ...labDetails,
      });
      return true;
    },
  });

  const deduped = [];
  const seen = new Set();
  for (const idea of rawIdeas) {
    const key = `${idea.myAssets.map((a) => a.assetId).sort().join("|")}=>${idea.theirAssets.map((a) => a.assetId).sort().join("|")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(idea);
  }

  deduped.sort((a, b) => compareTradeIdeas(a, b));

  return selectDiverseTradeIdeas(
    deduped,
    maxResults,
    values,
    tradeLab.selectedOutgoingAssetIds
  );
}

function buildTradeSearchContext({ myRoster, targetAsset, values, fairnessPct, tradeLab, maxOutgoingAssetsOverride = null }) {
  const targetValue = getAssetValue(targetAsset, values);
  if (!Number.isFinite(targetValue)) return null;

  const coreAssetIds = getCoreAssetIdSet(myRoster, values);
  const myAssetPool = resolveOutgoingAssetPool({ myRoster, values, tradeLab, targetValue, coreAssetIds });
  if (myAssetPool.length === 0) return null;
  const requiredOutgoingAssetIds = new Set(
    [...tradeLab.selectedOutgoingAssetIds].filter((assetId) => myAssetPool.some((asset) => asset.assetId === assetId))
  );
  const maxOutgoingAssets = maxOutgoingAssetsOverride || getMaxOutgoingPackageSize(targetValue);

  return {
    targetValue,
    coreAssetIds,
    myAssetPool,
    requiredOutgoingAssetIds,
    maxOutgoingAssets,
    myPackages: buildPackages(myAssetPool, values, maxOutgoingAssets, {
      requiredAssetIds: requiredOutgoingAssetIds,
      targetValue,
    }),
    globalMaxValue: Math.max(state.globalMaxPlayerValue || KTC_GLOBAL_MAX_FALLBACK, targetValue),
    effectiveFairnessPct: getEffectiveFairnessPct(fairnessPct, tradeLab.tradeVibe),
  };
}

function resolveOutgoingAssetPool({ myRoster, values, tradeLab, targetValue = 0, coreAssetIds = null }) {
  const pool = myRoster.assets.filter((asset) =>
    isTradeEligibleAsset(asset)
    && (
    !tradeLab.excludedOutgoingAssetIds.has(asset.assetId)
    && (
      (asset.assetType === "player" && tradeLab.allowPlayers)
      || (asset.assetType === "pick" && tradeLab.allowPicks)
    )
    )
  );

  if (tradeLab.selectedOutgoingAssetIds.size > 0) {
    const selectedAssets = pool.filter((asset) => tradeLab.selectedOutgoingAssetIds.has(asset.assetId));
    const optionalAssets = limitOutgoingAssetPool(
      pool.filter((asset) => !tradeLab.selectedOutgoingAssetIds.has(asset.assetId)),
      values,
      targetValue,
      {
        coreAssetIds: coreAssetIds || getCoreAssetIdSet(myRoster, values),
        teamState: tradeLab.teamState,
      }
    );
    return [...selectedAssets, ...optionalAssets];
  }

  const resolvedCoreAssetIds = coreAssetIds || getCoreAssetIdSet(myRoster, values);
  return limitOutgoingAssetPool(pool, values, targetValue, {
    coreAssetIds: resolvedCoreAssetIds,
    teamState: tradeLab.teamState,
  });
}

function limitOutgoingAssetPool(pool, values, targetValue, { coreAssetIds = new Set(), teamState = "middle" } = {}) {
  if (pool.length <= OUTGOING_POOL_LIMIT) return pool;

  const usefulValueFloor = Math.max(MIN_OUTGOING_ASSET_VALUE, Math.round(targetValue * 0.14));
  const eliteTarget = targetValue >= ELITE_TARGET_VALUE_THRESHOLD;
  const prioritized = pool
    .map((asset) => {
      const value = getAssetValue(asset, values);
      const relativeGap = targetValue > 0 ? Math.abs(value - targetValue) / targetValue : 0;
      let score = Math.max(0, 1.35 - Math.min(relativeGap, 1.35)) * 1000;
      score += Math.min(value, targetValue || value) * 0.02;
      if (value >= usefulValueFloor) score += 200;
      if (asset.assetType === "pick") score += isFirstRoundPick(asset) ? 220 : 60;
      if (coreAssetIds.has(asset.assetId)) score -= eliteTarget ? 120 : 260;
      if (teamState === "rebuilding" && isFirstRoundPick(asset)) score -= 90;
      if (teamState === "contending" && isFirstRoundPick(asset)) score += 40;
      return { asset, value, score };
    })
    .sort((a, b) => b.score - a.score || b.value - a.value || a.asset.name.localeCompare(b.asset.name));

  const kept = [];
  const seenAssetIds = new Set();
  const keepEntry = (entry) => {
    if (!entry || seenAssetIds.has(entry.asset.assetId)) return;
    kept.push(entry.asset);
    seenAssetIds.add(entry.asset.assetId);
  };

  prioritized
    .filter((entry) =>
      entry.value >= usefulValueFloor
      || isFirstRoundPick(entry.asset)
      || (eliteTarget && coreAssetIds.has(entry.asset.assetId))
    )
    .slice(0, OUTGOING_POOL_LIMIT)
    .forEach(keepEntry);

  for (const entry of prioritized) {
    if (kept.length >= OUTGOING_POOL_LIMIT) break;
    keepEntry(entry);
  }

  return kept;
}

function getMaxOutgoingPackageSize(targetValue) {
  if (Number.isFinite(targetValue) && targetValue >= ELITE_TARGET_VALUE_THRESHOLD) {
    return ELITE_MAX_OUTGOING_PACKAGE_SIZE;
  }
  return DEFAULT_MAX_OUTGOING_PACKAGE_SIZE;
}

function getEffectiveFairnessPct(fairnessPct, tradeVibe) {
  const vibeBuffer = {
    balanced: 0,
    aggressive: 4,
    chaos: 8,
  };
  return fairnessPct + (vibeBuffer[tradeVibe] || 0);
}

function buildPackageProfile(assets, values) {
  const entries = assets
    .map((asset) => ({ asset, value: getAssetValue(asset, values) }))
    .filter((entry) => Number.isFinite(entry.value))
    .sort((a, b) => b.value - a.value || a.asset.name.localeCompare(b.asset.name));

  const totalValue = entries.reduce((sum, entry) => sum + entry.value, 0);
  const topValue = entries[0]?.value || 0;
  const secondValue = entries[1]?.value || 0;

  return {
    entries,
    totalValue,
    topValue,
    secondValue,
    topTwoValue: topValue + secondValue,
    packageSize: entries.length,
    leadAssetId: entries[0]?.asset.assetId || "",
    leadAssetValue: topValue,
    topAssetIds: entries.slice(0, 2).map((entry) => entry.asset.assetId),
  };
}

function getRequiredAnchorShare(targetValue, packageSize) {
  if (!Number.isFinite(targetValue) || targetValue <= 0) return 0;

  const baseShare = targetValue >= ELITE_TARGET_VALUE_THRESHOLD
    ? ELITE_TARGET_ANCHOR_SHARE_BASE
    : targetValue >= STAR_TARGET_VALUE_THRESHOLD
      ? STAR_TARGET_ANCHOR_SHARE_BASE
      : 0.34;

  return Math.min(
    MAX_TARGET_ANCHOR_SHARE,
    baseShare + Math.max(0, packageSize - 2) * ANCHOR_SHARE_STEP_PER_EXTRA_ASSET
  );
}

function calculateFragmentationTax(targetValue, packageProfile) {
  const extraAssets = Math.max(0, packageProfile.packageSize - 1);
  if (!extraAssets || !Number.isFinite(targetValue) || targetValue <= 0) return 0;

  const perAssetTax = targetValue >= ELITE_TARGET_VALUE_THRESHOLD
    ? ELITE_FRAGMENTATION_TAX_PER_EXTRA_ASSET
    : targetValue >= STAR_TARGET_VALUE_THRESHOLD
      ? STAR_FRAGMENTATION_TAX_PER_EXTRA_ASSET
      : BASE_FRAGMENTATION_TAX_PER_EXTRA_ASSET;
  const requiredAnchorShare = getRequiredAnchorShare(targetValue, packageProfile.packageSize);
  const actualAnchorShare = packageProfile.topValue / targetValue;
  const anchorGap = Math.max(0, requiredAnchorShare - actualAnchorShare);
  const fillerFloor = Math.max(900, Math.round(targetValue * 0.14));
  const fillerCount = packageProfile.entries.filter((entry, index) => index >= 2 && entry.value < fillerFloor).length;

  return Math.round(
    extraAssets * perAssetTax
    + anchorGap * targetValue * 0.22
    + fillerCount * 90
  );
}

function evaluateTradeIdeaRealism({ targetAsset, myAssets, values }) {
  const packageProfile = buildPackageProfile(myAssets, values);
  const targetValue = getAssetValue(targetAsset, values);
  const targetIsPlayer = targetAsset?.assetType === "player";

  if (packageProfile.packageSize === 0) {
    return { viable: false, packageProfile, packageTax: 0, scoreAdjustment: 0 };
  }

  if (!targetIsPlayer || !Number.isFinite(targetValue)) {
    return { viable: true, packageProfile, packageTax: 0, scoreAdjustment: 0 };
  }

  const anchorShare = packageProfile.topValue / targetValue;
  const secondShare = packageProfile.secondValue / targetValue;
  const topTwoShare = packageProfile.topTwoValue / targetValue;
  const requiredAnchorShare = getRequiredAnchorShare(targetValue, packageProfile.packageSize);
  const strongAnchor = anchorShare >= requiredAnchorShare;
  const premiumTwoForOne = packageProfile.packageSize <= 2 && topTwoShare >= 0.94 && secondShare >= 0.4;

  if (targetValue >= ELITE_TARGET_VALUE_THRESHOLD && !strongAnchor && !premiumTwoForOne) {
    return { viable: false, packageProfile, packageTax: 0, scoreAdjustment: 0 };
  }

  if (targetValue >= STAR_TARGET_VALUE_THRESHOLD && packageProfile.packageSize >= 4 && !strongAnchor) {
    return { viable: false, packageProfile, packageTax: 0, scoreAdjustment: 0 };
  }

  let scoreAdjustment = 0;
  if (strongAnchor) scoreAdjustment += 8;
  if (premiumTwoForOne) scoreAdjustment += 6;
  if (packageProfile.packageSize <= 2) scoreAdjustment += 4;
  if (packageProfile.packageSize >= 4) scoreAdjustment -= (packageProfile.packageSize - 3) * 5;

  return {
    viable: true,
    packageProfile,
    packageTax: calculateFragmentationTax(targetValue, packageProfile),
    scoreAdjustment,
  };
}

function getComparableAssetIds(idea, lockedAssetIds = new Set()) {
  return idea.myAssets
    .map((asset) => asset.assetId)
    .filter((assetId) => !lockedAssetIds.has(assetId));
}

function getDiversityLeadAssetId(idea, values, lockedAssetIds = new Set()) {
  const unlockedProfile = buildPackageProfile(
    idea.myAssets.filter((asset) => !lockedAssetIds.has(asset.assetId)),
    values
  );
  return unlockedProfile.leadAssetId || idea.primaryAssetId || "";
}

function areTradeIdeasTooSimilar(candidate, picked, values, lockedAssetIds = new Set()) {
  const candidateIds = getComparableAssetIds(candidate, lockedAssetIds);
  const pickedIds = getComparableAssetIds(picked, lockedAssetIds);
  if (candidateIds.length === 0 || pickedIds.length === 0) return false;

  const pickedIdSet = new Set(pickedIds);
  const sharedIds = candidateIds.filter((assetId) => pickedIdSet.has(assetId));
  const overlapRatio = sharedIds.length / Math.min(candidateIds.length, pickedIds.length);

  const candidateProfile = buildPackageProfile(
    candidate.myAssets.filter((asset) => !lockedAssetIds.has(asset.assetId)),
    values
  );
  const pickedProfile = buildPackageProfile(
    picked.myAssets.filter((asset) => !lockedAssetIds.has(asset.assetId)),
    values
  );
  const sharedValue = sharedIds.reduce((sum, assetId) => {
    const match = candidateProfile.entries.find((entry) => entry.asset.assetId === assetId);
    return sum + (match?.value || 0);
  }, 0);
  const overlapValueRatio = sharedValue / Math.max(1, Math.min(candidateProfile.totalValue, pickedProfile.totalValue));

  const candidateLeadAssetId = getDiversityLeadAssetId(candidate, values, lockedAssetIds);
  const pickedLeadAssetId = getDiversityLeadAssetId(picked, values, lockedAssetIds);
  const sharedTopIds = candidateProfile.topAssetIds.filter((assetId) => pickedProfile.topAssetIds.includes(assetId));

  if (candidateLeadAssetId && candidateLeadAssetId === pickedLeadAssetId && overlapRatio >= 0.34) return true;
  if (sharedTopIds.length >= 2) return true;
  if (overlapRatio >= PACKAGE_DIVERSITY_OVERLAP_RATIO) return true;
  if (overlapValueRatio >= PACKAGE_DIVERSITY_VALUE_OVERLAP_RATIO) return true;
  return false;
}

function selectDiverseTradeIdeas(ideas, maxResults, values, lockedAssetIds = new Set()) {
  const selected = [];
  const heldBack = [];

  for (const idea of ideas) {
    if (selected.some((picked) => areTradeIdeasTooSimilar(idea, picked, values, lockedAssetIds))) {
      heldBack.push(idea);
      continue;
    }
    selected.push(idea);
    if (selected.length >= maxResults) return selected;
  }

  for (const idea of heldBack) {
    if (selected.length >= maxResults) break;
    selected.push(idea);
  }

  return selected;
}

function scoreTradeIdea({ myRoster, theirRoster, targetAsset, myAssets, theirAssets, values, pctDiff, tradeLab, ideaStyle, coreAssetIds = null }) {
  const realism = evaluateTradeIdeaRealism({ targetAsset, myAssets, values });
  if (!realism.viable) {
    return { viable: false };
  }

  const marketMyValue = Math.max(0, calculatePerceivedPackageValue(myAssets, values, tradeLab) - realism.packageTax);
  const marketTheirValue = calculatePerceivedPackageValue(theirAssets, values, tradeLab);
  const marketDelta = marketMyValue - marketTheirValue;
  const resolvedCoreAssetIds = coreAssetIds || getCoreAssetIdSet(myRoster, values);
  const exposesCore = myAssets.some((asset) => resolvedCoreAssetIds.has(asset.assetId));

  let labScore = 82;
  labScore -= pctDiff * (tradeLab.tradeVibe === "chaos" ? 0.55 : tradeLab.tradeVibe === "aggressive" ? 0.8 : 1.1);
  labScore += Math.max(-18, Math.min(18, marketDelta / 240));

  if (tradeLab.positionPremium !== "none" && myAssets.some((asset) => playerPositionForAsset(asset) === tradeLab.positionPremium)) {
    labScore += 6;
  }
  if (ideaStyle === "throw-in-back" && theirAssets.length > 1) labScore += 4;
  if (!exposesCore) labScore += 8;
  if (exposesCore) labScore -= 16;
  labScore += realism.scoreAdjustment;
  labScore += getTeamStateScoreAdjustment({ targetAsset, myAssets, theirAssets, tradeLab });
  if (tradeLab.tradeVibe === "aggressive") labScore += 3;
  if (tradeLab.tradeVibe === "chaos") labScore += 6;

  const reasoning = buildTradeReasoning({
    myRoster,
    theirRoster,
    targetAsset,
    myAssets,
    theirAssets,
    values,
    tradeLab,
    marketDelta,
    exposesCore,
    ideaStyle,
  });

  return {
    viable: true,
    labScore: clamp(Math.round(labScore), 1, 99),
    marketMyValue,
    marketTheirValue,
    marketDelta: Math.round(marketDelta),
    primaryAssetId: realism.packageProfile.leadAssetId,
    primaryAssetValue: realism.packageProfile.leadAssetValue,
    topOutgoingAssetIds: realism.packageProfile.topAssetIds,
    tags: reasoning.tags,
    summary: reasoning.summary,
    pitch: reasoning.pitch,
  };
}

function compareTradeIdeas(a, b) {
  const byLabScore = b.labScore - a.labScore;
  if (byLabScore !== 0) return byLabScore;

  const byDiff = Math.abs(a.pctDiff) - Math.abs(b.pctDiff);
  if (byDiff !== 0) return byDiff;

  const byPrimaryAsset = (b.primaryAssetValue || 0) - (a.primaryAssetValue || 0);
  if (byPrimaryAsset !== 0) return byPrimaryAsset;

  const byMarketDelta = b.marketDelta - a.marketDelta;
  if (byMarketDelta !== 0) return byMarketDelta;

  const byEvenValue = a.evenValue - b.evenValue;
  if (byEvenValue !== 0) return byEvenValue;

  return (a.myAssets.length + a.theirAssets.length) - (b.myAssets.length + b.theirAssets.length);
}

function compareEnrichedTradeIdeas(a, b) {
  const aDelta = a.powerUpgrade?.delta ?? 0;
  const bDelta = b.powerUpgrade?.delta ?? 0;
  if (bDelta !== aDelta) return bDelta - aDelta;

  const aAfterScore = a.powerUpgrade?.after?.score ?? 0;
  const bAfterScore = b.powerUpgrade?.after?.score ?? 0;
  if (bAfterScore !== aAfterScore) return bAfterScore - aAfterScore;

  return compareTradeIdeas(a, b);
}

function calculatePerceivedPackageValue(assets, values, tradeLab) {
  const total = assets.reduce((sum, asset) => sum + getPerceivedAssetValue(asset, values, tradeLab), 0);
  let packageAdjustment = 0;

  if (assets.length >= 2) {
    packageAdjustment -= 55 * (assets.length - 1);
    if (tradeLab.tradeVibe === "aggressive") packageAdjustment += 20 * (assets.length - 1);
    if (tradeLab.tradeVibe === "chaos") packageAdjustment += 35 * (assets.length - 1);
    if (tradeLab.teamState === "contending") packageAdjustment -= 20 * (assets.length - 1);
  }

  return Math.round(total + packageAdjustment);
}

function getPerceivedAssetValue(asset, values, tradeLab) {
  const baseValue = getAssetValue(asset, values);
  let multiplier = 1;

  if (tradeLab.positionPremium !== "none" && playerPositionForAsset(asset) === tradeLab.positionPremium) multiplier += 0.1;
  if (tradeLab.teamState === "rebuilding") {
    if (asset.assetType === "pick") multiplier += 0.09;
    if (isYouthAsset(asset)) multiplier += 0.08;
    if (isVeteranAsset(asset)) multiplier -= 0.06;
  }
  if (tradeLab.teamState === "contending") {
    if (asset.assetType === "pick") multiplier -= 0.04;
    if (isVeteranAsset(asset) || isWinNowTarget(asset)) multiplier += 0.07;
  }

  return Math.round(baseValue * multiplier);
}

function buildTradeReasoning({
  myRoster,
  theirRoster,
  targetAsset,
  myAssets,
  theirAssets,
  values,
  tradeLab,
  marketDelta,
  exposesCore,
  ideaStyle,
}) {
  const tags = [];
  const notes = [];

  if (tradeLab.positionPremium !== "none" && myAssets.some((asset) => playerPositionForAsset(asset) === tradeLab.positionPremium)) {
    tags.push(`${tradeLab.positionPremium} Premium`);
    notes.push(`${tradeLab.positionPremium.toLowerCase()} liquidity is doing part of the work here`);
  }
  if (!exposesCore) {
    tags.push("Core Intact");
    notes.push("you are not cutting into the spine of your roster");
  }
  if (tradeLab.teamState === "rebuilding") {
    tags.push("Rebuild Lens");
    if (isRebuildFriendlyTarget(targetAsset)) {
      notes.push(`the return keeps your timeline younger around ${targetAsset.name}`);
    }
    if (myAssets.some(isVeteranAsset)) {
      notes.push("you are cashing out win-now value instead of shipping your youngest insulation");
    }
  }
  if (tradeLab.teamState === "middle") {
    tags.push("Flexible Build");
    notes.push("the package stays balanced enough for a team that is not fully all-in or tearing it down");
  }
  if (tradeLab.teamState === "contending") {
    tags.push("Win-Now Push");
    notes.push(`this consolidates value into a player you actually want in your lineup now`);
    if (myAssets.length > theirAssets.length) {
      tags.push("Consolidation");
    }
  }
  if (ideaStyle === "throw-in-back" && theirAssets.length > 1) {
    tags.push("Throw-In Back");
    notes.push("the extra piece back keeps the offer from feeling too one-sided");
  }
  if (marketDelta >= 250) {
    tags.push("Market Leverage");
  }
  if (tags.length === 0) {
    tags.push("Fair Market");
    notes.push("this is mostly a straightforward value conversation");
  }

  const summary = notes.slice(0, 2).join(". ").replace(/\.$/, "") || "clean starter package with enough market logic to open the conversation";

  let pitch = `I'm trying to get to ${targetAsset.name} without wasting your time. This gives you ${myAssets.length > 1 ? `${myAssets.length} usable pieces` : "real value"} and keeps it close to market.`;
  if (tradeLab.positionPremium !== "none" && myAssets.some((asset) => playerPositionForAsset(asset) === tradeLab.positionPremium)) {
    pitch = `I know ${tradeLab.positionPremium}s carry extra juice in this league, so I built this around that premium instead of random filler.`;
  } else if (tradeLab.teamState === "rebuilding") {
    pitch = `I'm willing to move some win-now value, but I want the return to make sense for a younger timeline around ${targetAsset.name}.`;
  } else if (tradeLab.teamState === "contending") {
    pitch = `I'm trying to turn extra depth and future insulation into a starter I can actually use, and this keeps the value honest.`;
  } else if (ideaStyle === "throw-in-back" && theirAssets.length > 1) {
    pitch = `I'm good paying for ${targetAsset.name}, but I'd want the small add-on back so the deal lands closer to neutral for both sides.`;
  }

  return {
    tags: [...new Set(tags)].slice(0, 4),
    summary: `${summary}.`,
    pitch,
  };
}

function buildFallbackTradeTags(idea) {
  const tags = [];
  if (idea.powerUpgrade?.delta >= 5) tags.push("Power Spike");
  if (idea.powerUpgrade?.delta > 0) tags.push("Upgrade");
  if (idea.theirAssets?.length < idea.myAssets?.length) tags.push("Consolidation");
  if (idea.theirAssets?.length > idea.myAssets?.length) tags.push("Depth Return");
  if (idea.theirAssets?.some(isFirstRoundPick) || idea.myAssets?.some(isFirstRoundPick)) tags.push("Pick Leverage");
  if (idea.pctDiff <= 6) tags.push("Tight Value");
  if (tags.length === 0) tags.push("Fair Market");
  return [...new Set(tags)].slice(0, 4);
}

function buildFallbackTradeSummary(idea) {
  if (idea.powerUpgrade?.summary) return idea.powerUpgrade.summary;
  const incoming = formatAssetNameList(idea.theirAssets || []);
  const outgoing = formatAssetNameList(idea.myAssets || []);
  return `You turn ${outgoing} into ${incoming} while keeping the adjusted-value gap at ${idea.pctDiff}%.`;
}

function buildFallbackTradePitch(idea) {
  const incoming = formatAssetNameList(idea.theirAssets || []);
  const outgoing = formatAssetNameList(idea.myAssets || []);
  if (idea.powerUpgrade?.delta > 0) {
    return `I can move ${outgoing} because ${incoming} gives my roster a cleaner weekly build without pushing the value out of range.`;
  }
  return `This is close enough on value to be a real conversation, but I would treat it as a preference deal rather than a must-send offer.`;
}

function getTeamStateLabel(teamState) {
  return {
    rebuilding: "Rebuilding",
    middle: "Middle",
    contending: "Contending",
  }[teamState] || "Middle";
}

function getTeamStateScoreAdjustment({ targetAsset, myAssets, theirAssets, tradeLab }) {
  if (tradeLab.teamState === "rebuilding") {
    let score = 0;
    if (isRebuildFriendlyTarget(targetAsset)) score += 10;
    if (theirAssets.length > 1) score += 3;
    if (myAssets.some(isVeteranAsset)) score += 6;
    if (myAssets.some((asset) => isFirstRoundPick(asset) || isYouthAsset(asset))) score -= 8;
    return score;
  }

  if (tradeLab.teamState === "contending") {
    let score = 0;
    if (isWinNowTarget(targetAsset)) score += 10;
    if (myAssets.length > theirAssets.length) score += 5;
    if (myAssets.some((asset) => isFirstRoundPick(asset) || isYouthAsset(asset))) score += 5;
    return score;
  }

  let score = 0;
  const targetAge = playerAgeForAsset(targetAsset);
  if (Number.isFinite(targetAge) && targetAge >= 23 && targetAge <= 27) score += 4;
  if (myAssets.length <= 2) score += 3;
  return score;
}

function isVeteranAsset(asset) {
  if (asset.assetType !== "player") return false;
  const age = playerAgeForAsset(asset);
  const position = playerPositionForAsset(asset);
  if (!Number.isFinite(age)) return false;
  if (position === "RB") return age >= 26;
  return age >= 28;
}

function isRebuildFriendlyTarget(asset) {
  if (asset.assetType !== "player") return false;
  const age = playerAgeForAsset(asset);
  const position = playerPositionForAsset(asset);
  if (!Number.isFinite(age)) return position === "QB" || position === "WR";
  if (position === "QB" || position === "WR") return age <= 27;
  return age <= 25;
}

function isWinNowTarget(asset) {
  if (asset.assetType !== "player") return false;
  const age = playerAgeForAsset(asset);
  const position = playerPositionForAsset(asset);
  if (!Number.isFinite(age)) return position === "RB" || position === "TE";
  if (position === "RB") return age <= 27;
  if (position === "TE") return age <= 29;
  return age <= 30;
}

function formatPackageAdjustment(idea) {
  if (!idea.packageAdjustment) return "none";
  const side = idea.packageAdjustmentSide === "my" ? "your side" : "their side";
  return `+${formatNumber(idea.packageAdjustment)} on ${side}`;
}

function calculatePctDiff(a, b) {
  if (!a || !b) return 100;
  return Math.abs(a - b) / Math.max(a, b) * 100;
}

function calculateKtcRawAdjustment(playerValue, tradeMaxValue, globalMaxValue) {
  if (!Number.isFinite(playerValue) || playerValue <= 0 || !Number.isFinite(tradeMaxValue) || tradeMaxValue <= 0) return 0;

  return playerValue * (
    KTC_RAW_BASE
      + KTC_RAW_ELITE_WEIGHT * (playerValue / globalMaxValue) ** 8
      + KTC_RAW_TRADE_WEIGHT * (playerValue / tradeMaxValue) ** 1.3
      + KTC_RAW_DEPTH_WEIGHT * (playerValue / (globalMaxValue + 2000)) ** 1.28
  );
}

function findEvenValueForRawGap(targetRawGap, tradeMaxValue, globalMaxValue) {
  if (!Number.isFinite(targetRawGap) || targetRawGap <= 0) return 0;

  const maxReachableRaw = calculateKtcRawAdjustment(globalMaxValue, globalMaxValue, globalMaxValue);
  if (targetRawGap >= maxReachableRaw) {
    return Math.round(globalMaxValue);
  }

  let low = 0;
  let high = globalMaxValue;
  for (let i = 0; i < 50; i++) {
    const mid = (low + high) / 2;
    const rawValue = calculateKtcRawAdjustment(mid, Math.max(tradeMaxValue, mid), globalMaxValue);
    if (rawValue < targetRawGap) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return Math.max(0, Math.round(high));
}

function calculatePackageAdjustment({ myValues, theirValues, globalMaxValue }) {
  const myBaseValue = myValues.reduce((sum, value) => sum + value, 0);
  const theirBaseValue = theirValues.reduce((sum, value) => sum + value, 0);

  // A consolidation premium only makes sense when one side is actually consolidating.
  // Equal-sized packages, especially elite one-for-one swaps, should remain legible from
  // the displayed individual market values instead of receiving another nonlinear bump.
  if (myValues.length === theirValues.length) {
    return {
      myBaseValue,
      theirBaseValue,
      myAdjustedValue: myBaseValue,
      theirAdjustedValue: theirBaseValue,
      packageAdjustment: 0,
      packageAdjustmentSide: null,
      evenValue: 0,
    };
  }

  const tradeMaxValue = Math.max(0, ...myValues, ...theirValues);

  if (!tradeMaxValue) {
    return {
      myBaseValue,
      theirBaseValue,
      myAdjustedValue: myBaseValue,
      theirAdjustedValue: theirBaseValue,
      packageAdjustment: 0,
      packageAdjustmentSide: null,
      evenValue: 0,
    };
  }

  const myRawValue = myValues.reduce((sum, value) => sum + calculateKtcRawAdjustment(value, tradeMaxValue, globalMaxValue), 0);
  const theirRawValue = theirValues.reduce((sum, value) => sum + calculateKtcRawAdjustment(value, tradeMaxValue, globalMaxValue), 0);

  if (Math.abs(myRawValue - theirRawValue) < 1e-6) {
    return {
      myBaseValue,
      theirBaseValue,
      myAdjustedValue: myBaseValue,
      theirAdjustedValue: theirBaseValue,
      packageAdjustment: 0,
      packageAdjustmentSide: null,
      evenValue: 0,
    };
  }

  if (myRawValue > theirRawValue) {
    const evenValue = findEvenValueForRawGap(myRawValue - theirRawValue, tradeMaxValue, globalMaxValue);
    const packageAdjustment = Math.max(0, Math.round(theirBaseValue + evenValue - myBaseValue));
    return {
      myBaseValue,
      theirBaseValue,
      myAdjustedValue: myBaseValue + packageAdjustment,
      theirAdjustedValue: theirBaseValue,
      packageAdjustment,
      packageAdjustmentSide: packageAdjustment > 0 ? "my" : null,
      evenValue,
    };
  }

  const evenValue = findEvenValueForRawGap(theirRawValue - myRawValue, tradeMaxValue, globalMaxValue);
  const packageAdjustment = Math.max(0, Math.round(myBaseValue + evenValue - theirBaseValue));
  return {
    myBaseValue,
    theirBaseValue,
    myAdjustedValue: myBaseValue,
    theirAdjustedValue: theirBaseValue + packageAdjustment,
    packageAdjustment,
    packageAdjustmentSide: packageAdjustment > 0 ? "their" : null,
    evenValue,
  };
}

function buildPackages(assets, values, maxAssets, options = {}) {
  return buildCappedPackages(assets, values, maxAssets, {
    ...options,
    getAssetValue,
  });
}

function buildTargetPackages(options) {
  const roster = options.theirRoster;
  return buildCappedTargetPackages({
    ...options,
    theirRoster: roster
      ? { ...roster, assets: (roster.assets || []).filter(isTradeEligibleAsset) }
      : roster,
    getAssetValue,
  });
}

function renderAssetList(assets, values, teamClass = "") {
  const sortedAssets = [...assets].sort((a, b) => sortAssetsByValueDesc(a, b, values));
  return `
    <ul class="asset-list ${teamClass}">
      ${sortedAssets
        .map(
          (asset) => `
            <li class="asset-item">
              <span>${asset.name}</span>
              <span class="asset-value">${formatAssetSecondaryLabel(asset, values)}</span>
            </li>`
        )
        .join("")}
    </ul>`;
}

function setButtonLoading(button, isLoading, loadingText = "Loading...") {
  if (!button) return;
  if (!button.dataset.defaultLabel) button.dataset.defaultLabel = button.textContent;
  button.disabled = isLoading;
  button.classList.toggle("loading", isLoading);
  button.textContent = isLoading ? loadingText : button.dataset.defaultLabel;
}

function marketBoardHint() {
  const caveat = marketCaveat(state.league);
  const meta = state.valueBundles?.tradeMeta || state.tradeMarketBundle?.meta;
  const trades = Number(meta?.tradeCount);
  const leagues = Number(meta?.leagueCount);
  let hint = "";
  if (Number.isFinite(trades) && trades > 0 && Number.isFinite(leagues) && leagues > 0) {
    hint = `Sleeper trade market from ${formatNumber(trades)} completed dynasty trades across ${formatNumber(leagues)} leagues, mixed with KeepTradeCut.`;
  } else if (state.applyLeagueBoard) {
    hint = "Calculator, find-deals, and power now use this room's prices.";
  } else {
    hint = "Numbers are the Sleeper trade market mixed with KeepTradeCut. League prices stay on the side until you apply them.";
  }
  return caveat ? `${caveat} ${hint}` : hint;
}

function refreshLeagueBoard() {
  const trades = [...(state.transactions || []), ...(state.historyTransactions || [])];
  if (!Object.keys(state.values || {}).length) {
    state.leagueBoard = emptyLeagueBoard();
    return state.leagueBoard;
  }
  state.leagueBoard = buildLeagueBoard({
    trades,
    resolveAsset: resolveLeagueBoardAsset,
  });
  return state.leagueBoard;
}

function resolveLeagueBoardAsset(token) {
  if (token?.assetType === "player" || token?.playerId) {
    const asset = buildTransactionPlayerAsset(token.playerId);
    const marketValue = getAssetValue(asset, state.values, { applyLeagueBoard: false });
    return {
      ...token,
      asset,
      assetId: asset.assetId,
      name: asset.name,
      marketValue,
      position: playerPositionForAsset(asset),
      ageBucket: ageBucketForAsset(asset),
      boomBust: isBoomBustAsset(asset, marketValue),
    };
  }
  const asset = buildTransactionPickAsset(token.pick);
  const marketValue = getAssetValue(asset, state.values, { applyLeagueBoard: false });
  const season = asset.raw?.season != null ? String(asset.raw.season) : "";
  const round = Number(asset.raw?.round);
  const pickName = Number.isFinite(round)
    ? `${season} ${ordinal(round)}`.trim()
    : String(token.assetId || "Pick");
  return {
    ...token,
    asset,
    assetId: token.assetId || (Number.isFinite(round) ? `pick:${season}:r${round}:any` : asset.assetId),
    name: pickName,
    marketValue,
    position: "PICK",
    ageBucket: "pick",
    boomBust: false,
  };
}

function renderAssetValueBadge(asset, values = state.values) {
  const used = getAssetValue(asset, values);
  const market = getAssetValue(asset, values, { applyLeagueBoard: false });
  const league = getAssetValue(asset, values, { applyLeagueBoard: true });
  const showAlt = Boolean(state.leagueBoard?.ready) && shouldShowLeagueAlt(market, league);
  const altLabel = state.applyLeagueBoard ? "market" : "your league";
  const altValue = state.applyLeagueBoard ? market : league;
  return `
    <span class="asset-value-badge${showAlt ? " has-alt" : ""}">
      <strong>${formatNumber(used)}</strong>
      ${showAlt ? `<small class="value-alt">${altLabel} ${formatNumber(altValue)}</small>` : ""}
    </span>
  `;
}

function renderPickVaultIntro(picks = []) {
  const season = nextMockSeason(state.mockDrafts);
  if (!season) return "";
  const hasOverlay = picks.some((asset) => asset.raw?.mockProspectName);
  const note = hasOverlay ? `${formatMockSourceLine(state.mockDrafts)} ` : "";
  return `<p class="muted small pick-mock-note">${escapeHtml(note)}<button type="button" class="inline-link" data-action="go" data-page="teams" data-room="mock">Full board</button></p>`;
}

function renderPickVaultRow(asset, values) {
  const mockName = String(asset?.raw?.mockProspectName || "").trim();
  const ownerName = String(asset?.raw?.originalOwnerName || "").trim();
  const placeLabel = String(asset?.raw?.currentPlaceLabel || "").trim();
  const target = mockPickTarget(asset);
  const slotLabel = target ? formatPickSlotLabel(target.round, target.slot) : "";
  const placeBit = placeLabel ? `${placeLabel} place` : "";
  const mockBit = mockName ? `(${[slotLabel, mockName].filter(Boolean).join(" ")})` : "";
  const detail = mockName
    ? [ownerName ? `from ${ownerName}` : "", placeBit, mockBit]
      .filter(Boolean)
      .join(" · ")
      .replace(" · (", " (")
    : `Round ${asset?.raw?.round || "?"}`;
  const heading = mockName
    ? `${asset?.raw?.season || ""} ${ordinal(Number(asset?.raw?.round) || 1)}`.trim()
    : asset?.name || "Pick";
  const body = `
              <span class="sheet-slot">${escapeHtml(String(asset?.raw?.season || ""))}</span>
              <div class="sheet-player"><strong>${escapeHtml(heading)}</strong><span>${escapeHtml(detail)}</span></div>
              <span class="sheet-value mono">${renderAssetValuePlain(asset, values)}</span>
          `;
  if (target) {
    return `
            <button type="button" class="sheet-row pick mock-open" data-action="open-mock-pick" data-mock-round="${target.round}" data-mock-slot="${target.slot}" title="Open mock board at ${escapeHtml(formatPickSlotLabel(target.round, target.slot))}">
              ${body}
            </button>
          `;
  }
  return `
            <div class="sheet-row pick">
              ${body}
            </div>
          `;
}

function renderAssetValuePlain(asset, values = state.values) {
  const used = getAssetValue(asset, values);
  const market = getAssetValue(asset, values, { applyLeagueBoard: false });
  const league = getAssetValue(asset, values, { applyLeagueBoard: true });
  const showAlt = Boolean(state.leagueBoard?.ready) && shouldShowLeagueAlt(market, league);
  const altLabel = state.applyLeagueBoard ? "market" : "your league";
  const altValue = state.applyLeagueBoard ? market : league;
  return `${formatNumber(used)}${showAlt ? `<small class="value-alt">${altLabel} ${formatNumber(altValue)}</small>` : ""}`;
}

function formatAssetSecondaryLabel(asset, values) {
  const parts = [formatNumber(getAssetValue(asset, values))];
  const market = getAssetValue(asset, values, { applyLeagueBoard: false });
  const league = getAssetValue(asset, values, { applyLeagueBoard: true });
  if (state.leagueBoard?.ready && shouldShowLeagueAlt(market, league)) {
    parts.push(state.applyLeagueBoard ? `mkt ${formatNumber(market)}` : `league ${formatNumber(league)}`);
  }
  if (isEstimatedAsset(asset, values)) parts.push("est");
  if (asset.assetType === "player") {
    const position = formatPlayerPositionLabel(asset);
    if (position) parts.push(position);
    const age = playerAgeForAsset(asset);
    if (Number.isFinite(age)) parts.push(`${age}y`);
  } else {
    if (asset.raw?.season) parts.push(String(asset.raw.season));
    const pickBucket = getAssetPickBucket(asset);
    if (Number(asset.raw?.round) === 1 && pickBucket !== "any") parts.push(formatPickBucketLabel(pickBucket));
    if (asset.raw?.round) parts.push(`R${asset.raw.round}`);
  }
  return `(${parts.join(" • ")})`;
}

function getPlayerPositionRankLabel(asset) {
  if (asset?.assetType !== "player") return "";
  return state.playerPositionRankByAssetId[asset.assetId] || "";
}

function formatPlayerPositionLabel(asset) {
  return getPlayerPositionRankLabel(asset) || playerPositionForAsset(asset) || "Player";
}

function refreshPlayerPositionRanks() {
  const values = state.values && Object.keys(state.values).length ? state.values : ratherMarketValues();
  const names = state.valueNameMap || state.valueBundles?.names || {};
  const nflPlayers = state.players && Object.keys(state.players).length
    ? state.players
    : (ratherPromptContext.nflPlayers || {});
  const listed = [];
  Object.entries(values || {}).forEach(([assetId, value]) => {
    if (!String(assetId).startsWith("player:") || !Number.isFinite(value)) return;
    const playerId = assetId.slice("player:".length);
    const player = nflPlayers[playerId];
    const name = player?.full_name
      || `${(player?.first_name || "").trim()} ${(player?.last_name || "").trim()}`.trim()
      || names[assetId]
      || assetId;
    listed.push({ assetId, playerId, name, value });
  });
  const nextRankMap = {};
  buildRatherBoard(listed, nflPlayers, state.crowdShifts).forEach((row) => {
    if (row.position && row.positionRank) nextRankMap[row.assetId] = row.boardRank;
  });
  state.playerPositionRankByAssetId = nextRankMap;
}

function isYouthAsset(asset) {
  if (asset.assetType !== "player") return false;
  const age = playerAgeForAsset(asset);
  return Number.isFinite(age) && age <= 24;
}

function isFirstRoundPick(asset) {
  return asset.assetType === "pick" && Number(asset.raw?.round) === 1;
}

function getCoreAssetIdSet(myRoster, values) {
  const topPlayers = myRoster.assets
    .filter((asset) => asset.assetType === "player" && isTradeEligibleAsset(asset))
    .map((asset) => ({ assetId: asset.assetId, value: getAssetValue(asset, values) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 4)
    .map((entry) => entry.assetId);

  return new Set(topPlayers);
}

function normalizeRosterIdKey(value) {
  if (value == null || value === "") return null;
  return String(value);
}

function toNumericIfPossible(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && String(numeric) === String(value) ? numeric : value;
}

function normalizeOwnedPickRecord(pick, fallbackOwnerId = null) {
  const season = pick?.season != null ? String(pick.season) : "";
  const round = Number(pick?.round);
  if (!season || !Number.isFinite(round)) return null;

  const originalOwner = pick?.original_owner ?? pick?.roster_id ?? fallbackOwnerId ?? "any";
  const currentOwner = pick?.owner_id ?? fallbackOwnerId ?? originalOwner;

  return {
    ...pick,
    season,
    round,
    roster_id: originalOwner,
    original_owner: originalOwner,
    owner_id: currentOwner,
    previous_owner_id: pick?.previous_owner_id ?? currentOwner,
  };
}

function normalizeTradedPickRecord(pick) {
  const season = pick?.season != null ? String(pick.season) : "";
  const round = Number(pick?.round);
  const originalOwner = pick?.roster_id ?? pick?.original_owner;
  const currentOwner = pick?.owner_id;
  if (!season || !Number.isFinite(round) || originalOwner == null || currentOwner == null) {
    return null;
  }

  return {
    ...pick,
    season,
    round,
    roster_id: originalOwner,
    original_owner: originalOwner,
    owner_id: currentOwner,
    previous_owner_id: pick?.previous_owner_id ?? currentOwner,
  };
}

function getMinOpenPickSeason(currentDraftContext) {
  if (!isCompleteDraftStatus(currentDraftContext?.status)) return null;
  const draftedSeason = Number(currentDraftContext?.season);
  return Number.isFinite(draftedSeason) ? draftedSeason + 1 : null;
}

function isConsumedDraftPick(pick, currentDraftContext, assignedDraftSlot = null) {
  if (!pick || !currentDraftContext) return false;

  const pickSeason = String(pick.season || "");
  const draftSeason = String(currentDraftContext.season || "");
  if (!pickSeason || !draftSeason || pickSeason !== draftSeason) return false;
  if (isCompleteDraftStatus(currentDraftContext.status)) return true;

  const round = Number(pick.round);
  const originalOwnerKey = normalizeRosterIdKey(pick.original_owner ?? pick.roster_id);
  if (
    originalOwnerKey
    && Number.isFinite(round)
    && currentDraftContext.usedPickKeys?.has(buildOwnedPickKey(pickSeason, round, originalOwnerKey))
  ) {
    return true;
  }

  const slot = Number(assignedDraftSlot?.slot ?? pick.assignedDraftSlot);
  return Number.isFinite(round)
    && Number.isFinite(slot)
    && currentDraftContext.usedSlotKeys?.has(`${round}:${slot}`);
}

function inferLeaguePickSeasons(league, rosters, tradedPicks = [], pickValueCatalog = state.pickValueCatalog, currentDraftContext = null) {
  const explicitSeasons = rosters
    .flatMap((roster) => Array.isArray(roster?.picks) ? roster.picks : [])
    .map((pick) => Number(pick?.season))
    .filter(Number.isFinite);
  const tradedSeasons = tradedPicks
    .map((pick) => Number(pick?.season))
    .filter(Number.isFinite);
  const catalogSeasons = pickValueCatalog
    .map((pick) => Number(pick?.season))
    .filter(Number.isFinite);

  const configuredLeagueSeason = Number(league?.season);
  const baseSeason = Number.isFinite(configuredLeagueSeason) ? configuredLeagueSeason : new Date().getFullYear();
  const observedStartSeasons = [...explicitSeasons, ...tradedSeasons];
  let startSeason = observedStartSeasons.length > 0
    ? Math.min(...observedStartSeasons)
    : baseSeason;
  const minOpenSeason = getMinOpenPickSeason(currentDraftContext);
  if (Number.isFinite(minOpenSeason) && startSeason < minOpenSeason) {
    startSeason = minOpenSeason;
  }
  const endSeason = Math.max(
    startSeason + (observedStartSeasons.length > 0 ? 1 : 2),
    ...[...explicitSeasons, ...tradedSeasons, ...catalogSeasons]
  );

  const seasons = [];
  for (let season = startSeason; season <= endSeason; season++) {
    seasons.push(String(season));
  }
  return seasons;
}

function inferLeagueDraftRounds(league, rosters, tradedPicks = []) {
  const configuredRounds = Number(league?.settings?.draft_rounds);
  const explicitRounds = rosters
    .flatMap((roster) => Array.isArray(roster?.picks) ? roster.picks : [])
    .map((pick) => Number(pick?.round))
    .filter(Number.isFinite);
  const tradedRounds = tradedPicks
    .map((pick) => Number(pick?.round))
    .filter(Number.isFinite);

  if (Number.isFinite(configuredRounds) && configuredRounds > 0) {
    return Math.max(configuredRounds, ...explicitRounds, ...tradedRounds);
  }

  return Math.max(...explicitRounds, ...tradedRounds, 5);
}

function buildOwnedPickKey(season, round, originalOwnerKey) {
  return `${season}:${round}:${originalOwnerKey}`;
}

function buildOwnedPicksByRoster(league, rosters, tradedPicks = [], pickValueCatalog = state.pickValueCatalog, currentDraftContext = null) {
  const rosterKeys = rosters
    .map((roster) => normalizeRosterIdKey(roster.roster_id))
    .filter(Boolean);
  const ownedByRoster = new Map(rosterKeys.map((rosterKey) => [rosterKey, []]));
  const explicitPickCount = rosters.reduce(
    (total, roster) => total + (Array.isArray(roster?.picks) ? roster.picks.length : 0),
    0
  );

  if (explicitPickCount > 0) {
    rosters.forEach((roster) => {
      const rosterKey = normalizeRosterIdKey(roster.roster_id);
      if (!rosterKey) return;
      ownedByRoster.set(
        rosterKey,
        (Array.isArray(roster.picks) ? roster.picks : [])
          .map((pick) => normalizeOwnedPickRecord(pick, roster.roster_id))
          .filter((pick) => pick && !isConsumedDraftPick(pick, currentDraftContext))
      );
    });
    return ownedByRoster;
  }

  if (!leagueUsesFuturePicks(league)) {
    const rosterKeySet = new Set(rosterKeys);
    tradedPicks
      .map((pick) => normalizeTradedPickRecord(pick))
      .filter(Boolean)
      .forEach((pick) => {
        const currentOwnerKey = normalizeRosterIdKey(pick.owner_id);
        if (!currentOwnerKey || !rosterKeySet.has(currentOwnerKey)) return;
        const targetList = ownedByRoster.get(currentOwnerKey);
        if (!targetList) return;
        if (isConsumedDraftPick(pick, currentDraftContext)) return;
        targetList.push(pick);
      });
    return ownedByRoster;
  }

  const seasons = inferLeaguePickSeasons(league, rosters, tradedPicks, pickValueCatalog, currentDraftContext);
  const draftRounds = inferLeagueDraftRounds(league, rosters, tradedPicks);
  if (seasons.length === 0 || draftRounds <= 0) return ownedByRoster;

  const rosterKeySet = new Set(rosterKeys);
  const currentOwnerByPick = new Map();

  for (const season of seasons) {
    for (let round = 1; round <= draftRounds; round++) {
      for (const originalOwnerKey of rosterKeys) {
        currentOwnerByPick.set(buildOwnedPickKey(season, round, originalOwnerKey), originalOwnerKey);
      }
    }
  }

  tradedPicks
    .map((pick) => normalizeTradedPickRecord(pick))
    .filter(Boolean)
    .forEach((pick) => {
      const originalOwnerKey = normalizeRosterIdKey(pick.roster_id);
      const currentOwnerKey = normalizeRosterIdKey(pick.owner_id);
      if (
        !originalOwnerKey
        || !currentOwnerKey
        || !rosterKeySet.has(originalOwnerKey)
        || !rosterKeySet.has(currentOwnerKey)
      ) {
        return;
      }
      currentOwnerByPick.set(buildOwnedPickKey(pick.season, pick.round, originalOwnerKey), currentOwnerKey);
    });

  currentOwnerByPick.forEach((currentOwnerKey, ownershipKey) => {
    const targetList = ownedByRoster.get(currentOwnerKey);
    if (!targetList) return;

    const [season, roundToken, originalOwnerKey] = ownershipKey.split(":");
    const pick = {
      season,
      round: Number(roundToken),
      roster_id: toNumericIfPossible(originalOwnerKey),
      original_owner: toNumericIfPossible(originalOwnerKey),
      owner_id: toNumericIfPossible(currentOwnerKey),
      previous_owner_id: toNumericIfPossible(currentOwnerKey),
    };
    if (isConsumedDraftPick(pick, currentDraftContext)) return;
    targetList.push(pick);
  });

  ownedByRoster.forEach((picks) => {
    picks.sort((a, b) => {
      const seasonDiff = Number(a.season) - Number(b.season);
      if (seasonDiff !== 0) return seasonDiff;
      const roundDiff = Number(a.round) - Number(b.round);
      if (roundDiff !== 0) return roundDiff;
      return String(a.original_owner).localeCompare(String(b.original_owner));
    });
  });

  return ownedByRoster;
}

function normalizeRosters(league, rosters, users, players, previousContext = { league: null, users: [], rosters: [] }, tradedPicks = [], currentDraftContext = null) {
  const userById = new Map(users.map((u) => [String(u.user_id), u]));
  const rosterById = new Map(rosters.map((roster) => [String(roster.roster_id), roster]));
  const previousFinishLookup = buildPreviousFinishLookup(previousContext.league, previousContext.rosters);
  const ownedPicksByRoster = buildOwnedPicksByRoster(league, rosters, tradedPicks, state.pickValueCatalog, currentDraftContext);

  return rosters.map((roster) => {
    const identity = resolveRosterIdentity(getFranchiseIndex(), {
      userId: ownerIdFromRoster(roster),
      leagueId: league?.league_id || state.leagueId,
      rosterId: roster.roster_id,
    });
    const owner = userById.get(identity.userId) || userById.get(String(roster.owner_id)) || {};
    const playerAssets = (roster.players || []).map((playerId) => {
      const p = players[playerId] || {};
      const name = `${(p.first_name || "").trim()} ${(p.last_name || "").trim()}`.trim() || p.full_name || playerId;
      return {
        assetId: `player:${playerId}`,
        name,
        assetType: "player",
        raw: p,
      };
    });

    const pickAssets = (ownedPicksByRoster.get(String(roster.roster_id)) || []).flatMap((pick) => {
      const finishInfo = resolvePreviousFinishInfo(pick.original_owner, rosterById, previousFinishLookup);
      const pickBucket = Number(pick.round) === 1 ? finishInfo?.bucket || "any" : "any";
      const assignedDraftSlot = resolveAssignedDraftSlot(
        pick,
        currentDraftContext,
        finishInfo,
        previousContext?.league
      );
      if (isConsumedDraftPick(pick, currentDraftContext, assignedDraftSlot)) return [];
      const mockMeta = futureFirstMockMeta(pick, { userById, rosterById, assignedDraftSlot });
      return [{
        assetId: `pick:${pick.season}:r${pick.round}:${pick.original_owner || "any"}`,
        valueAssetId: buildPickValueAssetId(pick, pickBucket),
        valueBucket: pickBucket,
        name: formatPickName(pick, { userById, rosterById, previousFinishLookup, pickBucket, assignedDraftSlot }),
        assetType: "pick",
        raw: {
          ...pick,
          ktcBucket: pickBucket,
          assignedDraftSlot: assignedDraftSlot?.slot ?? null,
          assignedDraftSlotLabel: assignedDraftSlot?.label ?? null,
          previousFinishLabel: finishInfo?.label || null,
          ...mockMeta,
        },
      }];
    });

    const nicknames = {};
    Object.entries(roster?.metadata || {}).forEach(([key, value]) => {
      if (key.startsWith("p_nick_") && typeof value === "string" && value.trim()) {
        nicknames[key.slice("p_nick_".length)] = value.trim();
      }
    });

    return {
      rosterId: roster.roster_id,
      manager: {
        userId: identity.userId || roster.owner_id || "unknown",
        displayName: displayNameForUser(owner, identity.managerName),
        teamName: String(owner?.metadata?.team_name || "").trim(),
        avatar: owner?.avatar || null,
      },
      division: Number(roster?.settings?.division) || 0,
      nicknames,
      assets: [...playerAssets, ...pickAssets],
    };
  });
}

function avatarUrl(avatarId) {
  return avatarId ? `${SLEEPER_AVATAR_BASE}${avatarId}` : "";
}

function renderAvatar(manager, { size = "md", className = "" } = {}) {
  const name = String(manager?.displayName || manager?.name || "?");
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  const avatar = manager?.avatar;
  const hue = hashHue(name);
  return avatar
    ? `<span class="avatar avatar-${size} ${className}" style="--hue:${hue}"><img src="${avatarUrl(avatar)}" alt="${escapeHtml(name)}" loading="lazy" /></span>`
    : `<span class="avatar avatar-${size} ${className}" style="--hue:${hue}"><span>${escapeHtml(initial)}</span></span>`;
}

function hashHue(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  return hash % 360;
}

function displayNameForUser(user, fallback) {
  if (!user) return fallback;
  return user.display_name || user.username || fallback;
}

function extractRosterPoints(roster) {
  const settings = roster?.settings || {};
  if (settings.fpts == null) return null;
  return Number(settings.fpts) + Number(settings.fpts_decimal || 0) / 100;
}

function formatPreviousYearRankLabel(rank, totalTeams) {
  if (!Number.isFinite(rank) || !Number.isFinite(totalTeams) || totalTeams <= 0) {
    return "Previous Year";
  }
  return `${ordinal(rank)}/${ordinal(totalTeams)} in Previous Year`;
}

function buildPreviousFinishLookup(previousLeague, previousRosters = []) {
  if (!previousLeague || previousRosters.length === 0) {
    return { byRosterId: new Map(), byUserId: new Map() };
  }

  const season = String(previousLeague.season || "previous season");
  const ranked = previousRosters
    .map((roster) => ({
      rosterId: String(roster.roster_id),
      ownerId: roster.owner_id != null ? String(roster.owner_id) : null,
      explicitRank: extractRosterFinishRank(roster),
      wins: Number(roster?.settings?.wins || 0),
      losses: Number(roster?.settings?.losses || 0),
      ties: Number(roster?.settings?.ties || 0),
      points: extractRosterPoints(roster),
    }))
    .sort((a, b) => {
      if (Number.isFinite(a.explicitRank) && Number.isFinite(b.explicitRank)) return a.explicitRank - b.explicitRank;
      if (Number.isFinite(a.explicitRank)) return -1;
      if (Number.isFinite(b.explicitRank)) return 1;
      return b.wins - a.wins
        || a.losses - b.losses
        || b.ties - a.ties
        || (b.points || 0) - (a.points || 0)
        || Number(a.rosterId) - Number(b.rosterId);
    });

  const byRosterId = new Map();
  const byUserId = new Map();
  const totalTeams = ranked.length;
  ranked.forEach((entry, index) => {
    const finishRank = Number.isFinite(entry.explicitRank) ? entry.explicitRank : index + 1;
    const bucket = determineFirstRoundBucket(finishRank, totalTeams);
    const tierLabel = describeFinishTier(finishRank, totalTeams);
    const info = {
      rank: finishRank,
      season,
      totalTeams,
      bucket,
      tierLabel,
      label: formatPreviousYearRankLabel(finishRank, totalTeams),
    };
    byRosterId.set(entry.rosterId, info);
    if (entry.ownerId) byUserId.set(entry.ownerId, info);
  });

  return { byRosterId, byUserId };
}

function extractRosterFinishRank(roster) {
  const settings = roster?.settings || {};
  const candidates = [settings.rank, settings.final_rank, settings.standings_rank];
  for (const candidate of candidates) {
    const numeric = Number(candidate);
    if (Number.isFinite(numeric) && numeric > 0) return numeric;
  }
  return null;
}

function determineFirstRoundBucket(finishRank, totalTeams) {
  if (!Number.isFinite(finishRank) || !Number.isFinite(totalTeams) || totalTeams <= 0) return "any";
  const tierSize = Math.max(1, Math.floor(totalTeams / 3));
  if (finishRank <= tierSize) return "late";
  if (finishRank > totalTeams - tierSize) return "early";
  return "mid";
}

function describeFinishTier(finishRank, totalTeams) {
  if (!Number.isFinite(finishRank) || !Number.isFinite(totalTeams) || totalTeams <= 0) return "previous finish";
  const tierSize = Math.max(1, Math.floor(totalTeams / 3));
  const middleSize = Math.max(1, totalTeams - tierSize * 2);
  if (finishRank <= tierSize) return `top ${tierSize}`;
  if (finishRank > totalTeams - tierSize) return `bottom ${tierSize}`;
  return `middle ${middleSize}`;
}

function resolvePickOwnerName(originalOwner, rosterById, userById) {
  if (originalOwner == null) return null;

  const ownerKey = String(originalOwner);
  const roster = rosterById.get(ownerKey);
  if (roster) {
    const identity = resolveRosterIdentity(getFranchiseIndex(), {
      userId: ownerIdFromRoster(roster),
      leagueId: state.leagueId,
      rosterId: roster.roster_id,
    });
    const owner = identity.userId
      ? userById.get(identity.userId)
      : (roster.owner_id != null ? userById.get(String(roster.owner_id)) : null);
    return displayNameForUser(owner, identity.managerName);
  }

  const user = userById.get(ownerKey);
  if (user) return displayNameForUser(user, ownerKey);
  return null;
}

function resolvePreviousFinishInfo(originalOwner, rosterById, previousFinishLookup) {
  if (originalOwner == null) return null;

  const ownerKey = String(originalOwner);
  if (previousFinishLookup.byRosterId.has(ownerKey)) return previousFinishLookup.byRosterId.get(ownerKey);
  if (previousFinishLookup.byUserId.has(ownerKey)) return previousFinishLookup.byUserId.get(ownerKey);

  const roster = rosterById.get(ownerKey);
  if (!roster) return null;

  const rosterKey = String(roster.roster_id);
  if (previousFinishLookup.byRosterId.has(rosterKey)) return previousFinishLookup.byRosterId.get(rosterKey);

  const ownerId = roster.owner_id != null ? String(roster.owner_id) : null;
  if (ownerId && previousFinishLookup.byUserId.has(ownerId)) return previousFinishLookup.byUserId.get(ownerId);
  return null;
}

function resolvePreviousFinishLabel(originalOwner, rosterById, previousFinishLookup) {
  return resolvePreviousFinishInfo(originalOwner, rosterById, previousFinishLookup)?.label || null;
}

function formatAssignedPickSlot(round, slot, totalSlots = 0) {
  const roundNumber = Number(round);
  const slotNumber = Number(slot);
  if (!Number.isFinite(roundNumber) || !Number.isFinite(slotNumber)) return "";
  const padWidth = Math.max(2, String(Math.max(0, totalSlots)).length);
  return `${roundNumber}.${String(slotNumber).padStart(padWidth, "0")}`;
}

function resolveAssignedDraftSlot(pick, currentDraftContext, finishInfo = null, previousLeague = null) {
  const rosterKey = normalizeRosterIdKey(pick?.original_owner);
  if (rosterKey && currentDraftContext && String(pick?.season || "") === String(currentDraftContext.season || "")) {
    const slot = currentDraftContext.slotByRosterId?.get(rosterKey);
    if (Number.isFinite(slot)) {
      return {
        slot,
        totalSlots: Number(currentDraftContext.totalSlots) || 0,
        label: formatAssignedPickSlot(pick?.round, slot, currentDraftContext.totalSlots),
      };
    }
  }

  const pickSeason = Number(pick?.season);
  const previousSeason = Number(previousLeague?.season);
  const finishRank = Number(finishInfo?.rank);
  const totalTeams = Number(finishInfo?.totalTeams);
  if (
    Number.isFinite(pickSeason)
    && Number.isFinite(previousSeason)
    && pickSeason === previousSeason + 1
    && Number.isFinite(finishRank)
    && Number.isFinite(totalTeams)
    && totalTeams > 0
  ) {
    const slot = totalTeams - finishRank + 1;
    if (Number.isFinite(slot) && slot >= 1 && slot <= totalTeams) {
      return {
        slot,
        totalSlots: totalTeams,
        label: formatAssignedPickSlot(pick?.round, slot, totalTeams),
      };
    }
  }

  return null;
}

function buildPickValueAssetId(pick, pickBucket = "any") {
  const bucket = Number(pick?.round) === 1 ? normalizePickBucket(pickBucket) : "any";
  return `pick:${pick.season}:r${pick.round}:${bucket}`;
}

function formatPickName(pick, {
  userById,
  rosterById,
  previousFinishLookup,
  pickBucket = "any",
  assignedDraftSlot = null,
  currentPlaceLookup = null,
  mockDrafts = null,
} = {}) {
  const ownerName = resolvePickOwnerName(pick.original_owner, rosterById, userById);
  const mockBoard = mockDrafts || state.mockDrafts;
  const placeLookup = currentPlaceLookup || buildCurrentPlaceLookup(state.rosters, getSeasonModel()?.standings);
  if (shouldAttachMock(pick, mockBoard) && !assignedDraftSlot?.label) {
    const place = currentPlaceForOwner(pick.original_owner, placeLookup);
    const slot = projectedDraftSlot(place?.rank, place?.total);
    const mock = mockProspectAtSlot(mockBoard, slot, Number(pick.round) || 1);
    return formatHybridFirstName({
      season: pick.season,
      round: pick.round,
      ownerName,
      placeLabel: place?.label,
      mockName: mock?.label || "",
      mockSlot: slot,
    });
  }

  const details = [];
  if (ownerName) details.push(`from ${ownerName}`);
  const finishLabel = resolvePreviousFinishLabel(pick.original_owner, rosterById, previousFinishLookup);
  if (finishLabel) details.push(finishLabel);
  const suffix = details.length ? ` (${details.join(", ")})` : "";
  if (assignedDraftSlot?.label) {
    return `${pick.season} ${assignedDraftSlot.label}${suffix}`;
  }
  const bucketLabel = Number(pick.round) === 1 && normalizePickBucket(pickBucket) !== "any"
    ? ` ${formatPickBucketLabel(pickBucket)}`
    : "";
  return `${pick.season}${bucketLabel} ${ordinal(Number(pick.round) || 1)}${suffix}`;
}

function futureFirstMockMeta(pick, { userById, rosterById, assignedDraftSlot = null } = {}) {
  if (!shouldAttachMock(pick, state.mockDrafts) || assignedDraftSlot?.label) return {};
  const placeLookup = buildCurrentPlaceLookup(state.rosters, getSeasonModel()?.standings);
  const place = currentPlaceForOwner(pick.original_owner, placeLookup);
  const slot = projectedDraftSlot(place?.rank, place?.total);
  const mock = mockProspectAtSlot(state.mockDrafts, slot, Number(pick.round) || 1);
  return {
    originalOwnerName: resolvePickOwnerName(pick.original_owner, rosterById, userById) || "",
    currentPlaceRank: place?.rank ?? null,
    currentPlaceLabel: place?.label || "",
    projectedDraftSlot: slot,
    mockProspectName: mock?.label || "",
  };
}

async function loadValues(optionalUrl) {
  if (optionalUrl) {
    const payload = await fetch(optionalUrl).then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    });
    return coerceValueMap(payload);
  }

  const [ktcBundles, tradeBundle] = await Promise.all([
    fetchValuationBundles(),
    fetchTradeMarketBundle(),
  ]);
  state.ktcBundles = ktcBundles;
  state.tradeMarketBundle = tradeBundle;
  state.valueBundles = composeValuationBundles(ktcBundles, tradeBundle);
  return pickValueBundle(state.valueBundles, selectValueFormat(state.league));
}

function primeValuationData() {
  const format = selectValueFormat(state.league);
  if (state.valueBundles?.sf?.values && Object.keys(state.valueBundles.sf.values).length > 0) {
    applyValuationBundle(pickValueBundle(state.valueBundles, format));
    return;
  }
  state.valuationsPromise = null;
  ensureValuesLoaded("").catch((err) => {
    console.warn("Could not preload valuation data", err);
  });
}

async function ensureMockDraftsLoaded() {
  if (nextMockSeason(state.mockDrafts)) return state.mockDrafts;
  if (state.mockDraftsPromise) return state.mockDraftsPromise;
  state.mockDraftsPromise = fetchMockDrafts()
    .then((board) => {
      state.mockDrafts = board;
      return board;
    })
    .catch(() => {
      state.mockDraftsPromise = null;
      return state.mockDrafts;
    });
  return state.mockDraftsPromise;
}

async function ensureValuesLoaded(optionalUrl = "") {
  if (optionalUrl) {
    return applyValuationBundle(await loadValues(optionalUrl), { rerender: false });
  }

  const format = selectValueFormat(state.league);
  if (
    Object.keys(state.values).length > 0
    && state.pickValueCatalog.length > 0
    && state.valueFormat === format
  ) {
    return { values: state.values, nameMap: state.valueNameMap };
  }

  if (!state.valuationsPromise) {
    state.valuationsPromise = loadValues("")
      .then((bundle) => applyValuationBundle(bundle))
      .catch((err) => {
        state.valuationsPromise = null;
        throw err;
      });
  }

  return state.valuationsPromise;
}

function applyValuationBundle(bundle, { rerender = true } = {}) {
  state.valueFormat = selectValueFormat(state.league);
  state.values = bundle?.values && typeof bundle.values === "object" ? bundle.values : {};
  state.valueNameMap = bundle?.nameMap && typeof bundle.nameMap === "object" ? bundle.nameMap : {};
  refreshCrowdShifts();
  refreshPlayerPositionRanks();
  state.pickValueCatalog = buildPickValuationCatalog(state.values, state.valueNameMap);
  state.globalMaxPlayerValue = getGlobalMaxPlayerValue(state.values);
  refreshLeagueBoard();

  if (state.league && state.rosters.length > 0 && state.users.length > 0) {
    state.normalizedRosters = normalizeRosters(
      state.league,
      state.rosters,
      state.users,
      state.players,
      {
        league: state.previousLeague,
        users: state.previousUsers,
        rosters: state.previousRosters,
      },
      state.tradedPicks,
      state.currentDraftContext
    );
    pruneSelectedOutgoingAssets();
    pruneExcludedOutgoingAssets();
  }

  if (rerender) {
    renderPlayerSearch();
    renderActivePage();
    renderSessionSnapshot();
  }

  return {
    values: state.values,
    nameMap: state.valueNameMap,
  };
}

function setStatus(message, { ok = false, loading = false, error = false } = {}) {
  if (el.leagueStatusText) el.leagueStatusText.textContent = message;
  if (el.leagueStatus) {
    const tone = error ? "error" : ok ? "ok" : loading ? "loading" : "muted";
    el.leagueStatus.className = `status ${tone}`;
  }
  el.leagueStatusLoader?.classList.toggle("hidden", !loading);
}

function setFieldError(input, errorEl, message) {
  const invalid = Boolean(message);
  if (input) {
    input.classList.toggle("is-invalid", invalid);
    input.setAttribute("aria-invalid", String(invalid));
  }
  if (!errorEl) return;
  errorEl.textContent = message || "";
  errorEl.hidden = !invalid;
}

function setUsernameError(message) {
  setFieldError(el.sleeperUsername, el.usernameError, message);
  setFieldError(el.landingUsername, el.landingUsernameError, message);
}

function syncUsernameFields(source) {
  const value = String(source?.value || "");
  if (el.sleeperUsername && el.sleeperUsername !== source) el.sleeperUsername.value = value;
  if (el.landingUsername && el.landingUsername !== source) el.landingUsername.value = value;
}

function setGenerateError(message) {
  if (el.generateError) {
    el.generateError.textContent = message || "";
    el.generateError.hidden = !message;
  }
}

function focusUsernameSearch() {
  if (isPhoneLayout() && state.leagueId) setMobileRailOpen(true);
  const target = !state.leagueId && el.landingUsername
    ? el.landingUsername
    : (el.sleeperUsername || el.leagueId);
  target?.focus();
  target?.scrollIntoView({ behavior: "smooth", block: "center" });
}

function syncDocumentMeta() {
  const room = state.leagueId ? getRoom() : "";
  applyDocumentMeta(document, {
    title: buildDocumentTitle({
      page: state.leagueId ? state.activePage : "",
      leagueName: state.leagueName,
      loaded: Boolean(state.leagueId),
      room,
      league: state.league,
    }),
    description: buildPageDescription({
      page: state.leagueId ? state.activePage : "",
      leagueName: state.leagueName,
      loaded: Boolean(state.leagueId),
      room,
      league: state.league,
    }),
  });
}

async function bootLandingRather() {
  if (!el.landingRather) return;
  if (parseShareParams(window.location.search).leagueId) return;
  el.landingRather.innerHTML = renderLandingRatherPlaceholder();
  try {
    const [, context] = await Promise.all([
      (async () => {
        if (!state.valueBundles?.sf?.values || !Object.keys(state.valueBundles.sf.values).length) {
          const [ktcBundles, tradeBundle] = await Promise.all([
            fetchValuationBundles(),
            fetchTradeMarketBundle(),
          ]);
          state.ktcBundles = ktcBundles;
          state.tradeMarketBundle = tradeBundle;
          state.valueBundles = composeValuationBundles(ktcBundles, tradeBundle);
        }
      })(),
      loadRatherPromptContext(),
    ]);
    ratherPromptContext = context;
    await hydrateCrowdVotes();
    refreshCrowdShifts();
    refreshPlayerPositionRanks();
    showNextRatherMatchup();
  } catch (err) {
    console.warn("Could not open rather matchup", err);
    el.landingRather.innerHTML = "";
  }
}

async function loadRatherPromptContext() {
  const nflState = state.nflState || await apiGetWithRetry(`/state/nfl`, { timeoutMs: 8000, retries: 1 }).catch(() => null);
  if (nflState) state.nflState = nflState;
  const currentSeason = String(nflState?.league_season || nflState?.season || new Date().getUTCFullYear());
  const previousSeason = String(nflState?.previous_season || Number(currentSeason) - 1 || new Date().getUTCFullYear() - 1);
  const cachedPlayers = getPlayersCache()?.players || state.players || {};
  const [nflPlayers, seasonStats, draftPicks] = await Promise.all([
    Object.keys(cachedPlayers).length
      ? Promise.resolve(cachedPlayers)
      : loadPlayersWithCache().then((players) => {
        if (players && Object.keys(players).length) state.players = players;
        return players || {};
      }).catch(() => ({})),
    loadRatherSeasonStats(previousSeason).catch(() => ({})),
    fetchRatherDraftPicks().catch(() => ({})),
  ]);
  return { nflPlayers, seasonStats, draftPicks, currentSeason, previousSeason };
}

async function loadRatherSeasonStats(season) {
  const year = String(season || "").trim();
  if (!year) return {};
  if (ratherSeasonStatsCache.season === year && ratherSeasonStatsCache.stats) {
    return ratherSeasonStatsCache.stats;
  }
  const stats = await apiGet(`/stats/nfl/regular/${encodeURIComponent(year)}`, { timeoutMs: 20000 });
  const payload = stats && typeof stats === "object" ? stats : {};
  ratherSeasonStatsCache = { season: year, stats: payload };
  return payload;
}

function ratherMarketValues() {
  const format = state.valueFormat === "oneQb" ? "oneQb" : "sf";
  const selected = state.valueBundles?.[format]?.values;
  return selected && Object.keys(selected).length ? selected : state.values;
}

function crowdVoteSource() {
  if (state.crowdVotesLive && Array.isArray(state.crowdVotes)) return state.crowdVotes;
  return readRatherVotes();
}

function refreshCrowdShifts() {
  state.crowdShifts = crowdShiftsFromVotes(crowdVoteSource(), ratherMarketValues(), {
    format: state.valueFormat || "sf",
  });
  state.valuationRevision = Number(state.valuationRevision || 0) + 1;
}

let crowdRefreshTimer = null;

function applyRemoteCrowdVotes(remote, { rerender = true } = {}) {
  if (!Array.isArray(remote)) return false;
  const currentFingerprint = (state.crowdVotes || [])
    .map((vote) => vote.eventId || `${vote.winnerId}|${vote.loserId}|${vote.at}|${vote.format}`)
    .join(";");
  const nextFingerprint = remote
    .map((vote) => vote.eventId || `${vote.winnerId}|${vote.loserId}|${vote.at}|${vote.format}`)
    .join(";");
  state.crowdVotes = remote;
  state.crowdVotesLive = true;
  if (currentFingerprint === nextFingerprint) return true;
  refreshCrowdShifts();
  refreshPlayerPositionRanks();
  if (rerender && state.leagueId) {
    renderActivePage();
    renderSessionSnapshot();
  }
  return true;
}

function ensureCrowdRefreshTimer() {
  if (crowdRefreshTimer || typeof globalThis.setInterval !== "function") return;
  crowdRefreshTimer = globalThis.setInterval(async () => {
    if (document.hidden) return;
    const remote = await fetchRatherCrowdVotes();
    applyRemoteCrowdVotes(remote);
  }, 60_000);
}

async function hydrateCrowdVotes() {
  if (state.crowdVotesLive && Array.isArray(state.crowdVotes)) {
    ensureCrowdRefreshTimer();
    return true;
  }
  const remote = await fetchRatherCrowdVotes();
  if (!Array.isArray(remote)) return false;
  applyRemoteCrowdVotes(remote, { rerender: false });
  ensureCrowdRefreshTimer();
  return true;
}

function showNextRatherMatchup({ status = "" } = {}) {
  if (!el.landingRather) return;
  const names = state.valueBundles?.names || state.valueNameMap || {};
  const values = ratherMarketValues();
  const nflPlayers = Object.keys(ratherPromptContext.nflPlayers || {}).length
    ? ratherPromptContext.nflPlayers
    : (getPlayersCache()?.players || state.players || {});
  const listed = listRatherPlayers(values, names);
  const boarded = buildRatherBoard(
    listRatherPlayers(values, names, { minValue: 1 }),
    nflPlayers,
    state.crowdShifts
  );
  const rankById = new Map(boarded.map((row) => [row.assetId, row]));
  const pairPool = listed.map((row) => ({ ...row, ...(rankById.get(row.assetId) || {}) }));
  const picked = pickRatherPair(pairPool, {
    recentKeys: readRatherRecentKeys(),
    shifts: state.crowdShifts,
  });
  if (!picked) {
    el.landingRather.innerHTML = "";
    ratherPromptPair = null;
    return;
  }
  const extras = {
    currentSeason: ratherPromptContext.currentSeason,
    previousSeason: ratherPromptContext.previousSeason,
    seasonStats: ratherPromptContext.seasonStats,
    draftPicks: ratherPromptContext.draftPicks,
  };
  ratherPromptPair = {
    left: decorateRatherPlayer(picked.left, nflPlayers, extras),
    right: decorateRatherPlayer(picked.right, nflPlayers, extras),
    key: picked.key,
  };
  el.landingRather.innerHTML = renderRatherMarkup(ratherPromptPair, DEFAULT_RATHER_FORMAT, { status });
  bindRatherPhotos(el.landingRather);
}

function skipRatherMatchup() {
  if (ratherPromptPair?.key) pushRatherRecentKey(ratherPromptPair.key);
  showNextRatherMatchup({ status: "Skipped." });
}

async function chooseRatherPlayer(winnerId) {
  const pair = ratherPromptPair;
  if (!pair) {
    showNextRatherMatchup();
    return;
  }
  const ids = [pair.left?.assetId, pair.right?.assetId].filter(Boolean);
  const loserId = ids.find((id) => id !== winnerId) || "";
  const winnerName = winnerId === pair.left?.assetId ? pair.left?.name : pair.right?.name;
  if (!winnerId || !loserId) return;

  const vote = {
    winnerId,
    loserId,
    format: formatRatherDetail(DEFAULT_RATHER_FORMAT),
  };
  el.landingRather.innerHTML = renderRatherMarkup(pair, DEFAULT_RATHER_FORMAT, { status: "Saving vote…" });
  bindRatherPhotos(el.landingRather);
  el.landingRather.querySelectorAll?.("[data-rather-pick], #rather-skip").forEach((button) => {
    button.disabled = true;
  });

  const remote = await submitRatherCrowdVote(vote);
  if (!Array.isArray(remote)) {
    el.landingRather.innerHTML = renderRatherMarkup(pair, DEFAULT_RATHER_FORMAT, {
      status: "Vote not saved. Try again.",
    });
    bindRatherPhotos(el.landingRather);
    return;
  }

  recordRatherVote({ ...vote, at: Date.now(), format: DEFAULT_RATHER_FORMAT });
  applyRemoteCrowdVotes(remote);
  if (pair.key) pushRatherRecentKey(pair.key);

  const names = state.valueBundles?.names || state.valueNameMap || {};
  const nflPlayers = Object.keys(ratherPromptContext.nflPlayers || {}).length
    ? ratherPromptContext.nflPlayers
    : (getPlayersCache()?.players || state.players || {});
  const winnerRow = buildRatherBoard(
    listRatherPlayers(ratherMarketValues(), names, { minValue: 1 }),
    nflPlayers,
    state.crowdShifts
  ).find((row) => row.assetId === winnerId);
  const status = winnerName && winnerRow?.boardRank
    ? `Saved. ${winnerName} is ${winnerRow.boardRank} on the ticker.`
    : winnerName
      ? `Saved. ${winnerName}.`
      : "Saved.";
  showNextRatherMatchup({ status });
}

function handleLandingRatherClick(event) {
  const skip = event.target.closest?.("#rather-skip");
  const pick = event.target.closest?.("[data-rather-pick]");
  if (!skip && !pick) return;
  event.preventDefault();
  event.stopPropagation();
  if (skip) {
    skipRatherMatchup();
    return;
  }
  const winnerId = pick?.getAttribute("data-rather-pick");
  if (winnerId) chooseRatherPlayer(winnerId);
}

function bindRatherPhotos(root) {
  root?.querySelectorAll?.("img.rather-photo").forEach((img) => {
    img.addEventListener("error", () => {
      img.classList.add("is-broken");
    });
  });
}

function watchLandingSearchVisibility() {
  if (landingSearchObserver || typeof IntersectionObserver !== "function" || !el.landingUsernameForm) return;
  landingSearchObserver = new IntersectionObserver((entries) => {
    const entry = entries[0];
    landingSearchOffscreen = Boolean(entry) && entry.intersectionRatio < 0.35;
    syncSiteDock();
  }, { threshold: [0, 0.35, 1] });
  landingSearchObserver.observe(el.landingUsernameForm);
}

function syncSiteDock() {
  const stickyOpen = isPhoneLayout()
    && !state.leagueId
    && !document.body.classList.contains("rail-open")
    && landingSearchOffscreen;
  if (el.stickyMobileCta) el.stickyMobileCta.hidden = !stickyOpen;
  document.body.classList.toggle("dock-visible", stickyOpen);
}

function startLeagueLoadingUi() {
  if (el.loadLeagueBtn) {
    el.loadLeagueBtn.disabled = true;
    el.loadLeagueBtn.classList.add("loading");
    el.loadLeagueBtn.textContent = "Loading...";
  }
  el.leagueLoadForm?.setAttribute("aria-busy", "true");
  document.body.classList.add("league-loading");
  if (el.landingLoading) {
    el.landingLoading.classList.remove("hidden");
    if (el.landingLoadingText) el.landingLoadingText.textContent = "Opening league from Sleeper…";
  }
  if (el.stickyFindBtn) {
    el.stickyFindBtn.disabled = true;
    el.stickyFindBtn.textContent = "Opening…";
  }

  leagueLoadStartedAt = Date.now();
  setStatus("Loading Sleeper data...", { loading: true });

  clearInterval(leagueLoadAnimationTimer);
  leagueLoadAnimationTimer = setInterval(() => {
    const elapsedSec = Math.floor((Date.now() - leagueLoadStartedAt) / 1000);
    setStatus(`Loading Sleeper data • ${elapsedSec}s`, { loading: true });
    if (el.landingLoadingText) el.landingLoadingText.textContent = `Opening league from Sleeper… ${elapsedSec}s`;
  }, 850);
}

function stopLeagueLoadingUi() {
  clearInterval(leagueLoadAnimationTimer);
  leagueLoadAnimationTimer = null;
  document.body.classList.remove("league-loading");
  el.leagueLoadForm?.setAttribute("aria-busy", "false");
  el.landingLoading?.classList.add("hidden");
  if (el.stickyFindBtn) {
    el.stickyFindBtn.disabled = false;
    el.stickyFindBtn.textContent = "Find leagues";
  }
  if (!el.loadLeagueBtn) return;
  el.loadLeagueBtn.disabled = false;
  el.loadLeagueBtn.classList.remove("loading");
  el.loadLeagueBtn.textContent = "Load League";
}
