import {
  buildSeasonModel,
  simulateSeason,
  formatPoints,
  formatOddsPct,
  ordinal,
  blendSimPrior,
  compareRosterRecord,
  pointsAgainstFromSettings,
  sleeperPoints,
  weekRowsFingerprint,
} from "./modules/standings.js";
import {
  PLAYERS_CACHE_TTL_MS,
  SIM_ITERATIONS,
  NAV_TABS,
  PAGE_IDS,
  PAGE_LABELS,
  DEFAULT_PAGE,
  DEFAULT_ROOMS,
  HOME_ROOM,
  DEFAULT_FAIRNESS_PCT,
  MAX_HISTORY_SEASONS,
  PHONE_LAYOUT_QUERY,
} from "./modules/constants.js";
import { bindMobileChromeScroll } from "./modules/mobile-chrome-scroll.js";
import { state, sleeper, PLAYERS_CACHE_KEY } from "./modules/state.js";
import { createLeagueLoader, shouldBlankDeskForLeagueSwitch } from "./modules/league-load.js";
import {
  SLEEPER_UNREACHABLE_MESSAGE,
  createLeagueLoadRecovery,
  failedLeagueSwitch,
  isLeagueNotFound,
  leagueLoadErrorMessage,
  leagueLoadErrorVisibility,
  leagueNotFoundError,
  sleeperLeagueMissing,
  leagueNameForId,
  leagueSwitchFailureCopy,
} from "./modules/league-load-error.js";
import {
  apiGet,
  apiGetWithRetry,
  fetchUserLeagues,
  loadPlayersCacheEntry,
  savePlayersCacheEntry,
  playersCacheIsFresh,
  mergePlayerRecords,
  playersFromSlimFile,
  slimPlayersMap,
  sleeperAvatarUrl,
  previousLeagueId,
  sleeperLeaguePath,
} from "./modules/sleeper.js";
import {
  classifyLeagueInput,
  classifyLeagueField,
  classifyUsernameField,
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
  stampPickedLeagueSearch,
  INVALID_LEAGUE_LINK_MESSAGE,
} from "./modules/parse.js";
import {
  pickValueBundle,
  selectValueFormat,
  fetchValuationBundles,
  NFL_PLAYERS_SLIM_PATH,
  playersFromValueSnapshot,
  fetchPriceHistory,
  PRICE_HISTORY_INDEX_PATH,
  getAssetValue as marketAssetValue,
  isEstimatedAsset as marketIsEstimated,
  buildPickValuationCatalog,
  parsePickAssetId,
  normalizePickBucket,
  formatPickBucketLabel,
  chooseLeadPick,
  compareOwnedPickValue,
  formatGenericPickAssetLabel,
  getAssetPickBucket,
  tradablePickSeason,
  playerPositionForAsset,
  playerAgeForAsset,
  leagueHasSuperflex,
  tepLevel,
  getGlobalMaxPlayerValue,
} from "./modules/values.js";
import {
  playerValueTrend,
  renderTrendSoon,
  renderValueScaleExplainer,
  renderValueTierBadge,
  renderValueTrend,
  renderValuesFreshness,
  valuationStamp,
  valuesUpdatedStatus,
} from "./modules/value-scale.js";
import {
  copyTextToClipboard,
  escapeHtml,
  formatNumber,
  formatMatchIdeaCopy,
  clamp,
  renderConnectGate,
} from "./modules/html.js";
import {
  renderAvatar,
  renderPositionMeter,
  renderPowerHero,
  renderPowerStat,
  renderSleeperInsight,
} from "./modules/roster-markup.js";
import { facePlayerId, playerIdFromAssetId, renderPlayerFace, renderPlayerLabel } from "./modules/player-face.js";
import {
  addValueCalcItem,
  clearValueCalcSides,
  emptyValueCalcState,
  isGenericPickAssetId,
  isLeaguePickAssetId,
  listGenericPicks,
  pastPickSeasonHint,
  listValueCalcAssets,
  playerDisplayName,
  removeValueCalcItem,
  swapValueCalcSides,
  valueCalcAssetMatchesQuery,
  tradeRowName,
  withPlayerDirectoryNames,
} from "./modules/value-calc.js";
import {
  TRADE_TALK_MAX,
  applyTradeTalk,
  parseTradeTalk,
  priceNeighbors,
  tradeTalkReply,
} from "./modules/trade-talk.js";
import {
  describeDraftItem,
  draftFromReview,
  draftMarketPrice,
  draftMeterValues,
  draftNoticeText,
  evenUpTradePick,
  draftVerdictModel,
  draftSideForAsset,
  draftTeamSummary,
  isDraftEmpty,
  leaguePickForGeneric,
  placeAfterConnect,
  readStoredDraft,
  resolveDraftContext,
  reviewPayloadFor,
  useLeaguePick,
  writeStoredDraft,
} from "./modules/trade-draft.js";
import {
  calcListDomId,
  calcOptionAttrs,
  calcSuggestionItem,
  clearCalcSearchBox,
  handleCalcComboboxKey,
  keepCalcSearchFocused,
  renderCalcSearchInput,
  setCalcListOpen,
  shouldArmCalcSuggestion,
  shouldHoldCalcSearchFocus,
  shouldResetCalcSearchOnPick,
  syncCalcCombobox,
} from "./modules/calc-search.js";
import { calculatePackageAdjustment, calculatePctDiff } from "./modules/package-value.js";
import { jobById, landingSearchHint } from "./modules/jobs.js";
import {
  applyBootFieldValue,
  bootIsPending,
  queueFindForBoot,
  releaseBootGate,
  scheduleBootFind,
} from "./modules/boot-gate.js";
import { sampleRosterLabels } from "./modules/sample-voice.js";
import {
  buildTradeMatchProfile,
  countStartableAtPosition,
  packageLooksLikeFiller,
  proposeMatchDeals,
  rankPartnerMatches,
} from "./modules/trade-match.js";
import {
  describeUserSearchFailure,
  renderLeaguePickerMarkup,
  renderLeagueSearchNote,
  renderMeSelectOptions,
  resolveDefaultMeRoster,
  seasonSearchHardFailField,
  seasonSearchHardFailStatus,
  noTeamInLeagueCopy,
} from "./modules/league-search.js";
import {
  leagueKeepsPlayers,
  leagueTypeId,
  leagueTypeLabel,
  leagueUsesFuturePicks,
  marketCaveat,
  roomLabelFor,
  visibleRoomFor,
  windowCallHorizon,
} from "./modules/league-format.js";
import { buildFranchiseIndex, ownerIdFromRoster, resolveRosterIdentity } from "./modules/franchise.js";
import { buildDeskHistorySnapshot, scrollTopFromHistory } from "./modules/desk-history.js";
import {
  assetIdFromRoute,
  backTarget,
  decideHistoryWrite,
  matchRoute,
  historyModeAfterMenuChoice,
  pathForPlace,
  playerIdFromPathname,
  playerPathname,
  resolveLocation,
  routeIdFromAsset,
  sameHistoryPlace,
  selectionFromLocation,
  sleeperIdFrom,
  topOverlay,
  urlPath,
} from "./modules/history-route.js";
import {
  EVEN_UP_OFFER_ABOVE,
  ideaLimitMore,
  oldPctToMore,
  STAR_PREMIUM_KEY,
  TIER_EXPLAINER,
  FEWER_BETTER_LINE,
  PRICE_FACTORS_LINE,
  UNAVAILABLE_PRICE_LINE,
  barLabel,
  creditedTotalsLine,
  fewerBetterOffer,
  verdictCopy,
  verdictLineNamed,
} from "./modules/verdict-copy.js";
import { bestRowIsPick, bestRowName, starsPremiumMarkup } from "./modules/verdict-bars.js";
import { GLOSSARY, bindInfoTips, infoTipMarkup, renderPriceLegend, valuesWorkText } from "./modules/info-tip.js";
import {
  EXAMPLE_GET,
  EXAMPLE_GIVE,
  hotSleeperRows,
  launchErrorMarkup,
  launchExampleMarkup,
  launchTrendMarkup,
} from "./modules/launch-landing.js";
import { decodeTradeShare, encodeTradeShare, missingBoardNote, priceStamp, sameVerdict, shareMessage, sharePath, shareSummary, snapshotRequestForStamp, stampLabel } from "./modules/trade-share.js";
import { analyzeWindowCall, windowCallInputFromDesk } from "./modules/window-call.js";
import { chooseBestLineup } from "./modules/lineup.js";
import { createPageRenderQueue, isTextEntry } from "./modules/page-render.js";
import {
  buildOwnedPickKey,
  buildOwnedPicksByRoster,
  indexDraftSelections,
  isConsumedDraftPick,
  mergeDraftSelectionIndex,
  ownerKeyByRosterIdFromRosters,
  slotToRosterIdFromDraft,
} from "./modules/draft-picks.js";
import {
  compareTradeSearchPicks,
  formatPickLabel,
  projectPickSlots,
  resolvePickProjection,
  rosterRecordsReady,
  valuedAsMidFirstHint,
} from "./modules/pick-projection.js";
import { currentPlaceForOwner } from "./modules/draft-order.js";
import {
  applyDocumentMeta,
  buildDocumentTitle,
  holdDocumentTitle,
  buildPageDescription,
  clearSampleBannerDismissal,
  focusAfterSampleBannerDismiss,
  sampleBannerDismissed,
  sampleConnectEntryVisible,
} from "./modules/site.js";
import { recordSearchedUser, searchedUserPick } from "./modules/visits.js";
import { createBeaconAdapter, pageview as analyticsPageview, setAnalyticsAdapter, track as analyticsTrack, trackShareTapped, trackTradeLinkOpened } from "./modules/analytics.js";
import {
  buildPositionBoard,
  fetchNflDraftPicks,
  formatPlayerDetail,
  isRookiePlayer,
  lookupNflDraftPick,
} from "./modules/player-notes.js";
import {
  buildRankBoard,
  isRankAssetId,
  RANK_PAGE_SIZE,
  rankFormatLabel,
  rankView,
  renderPlayerConnect,
  renderRanksBody,
  renderRanksMarkup,
  renderRanksToolbar,
} from "./modules/ranks.js";
import {
  announceRoute,
  applyEscape,
  createRouteFocusMemory,
  ensureRouteLive,
  focusHeadingWhenPresent,
  focusViewHeading,
  focusWithoutScroll,
  headingRootFor,
  headingSelectorFor,
  restoreTriggerFocus,
  routeAnnouncement,
  routeDocumentTitle,
  syncAriaCurrent,
} from "./modules/route-a11y.js";

const routeFocus = createRouteFocusMemory();

const BOARD_STORAGE_KEY = "dynasty_ticker_board";
const LINEUP_CANDIDATE_FLOOR = 6;
const LINEUP_CANDIDATE_BUFFER = 2;
const TRENDING_PLAYERS_LIMIT = 30;
const TRENDING_LOOKBACK_HOURS = 24;
const leagueStrengthCache = { key: "", baseline: null };
const powerBoardCache = { key: "", profiles: null, context: null };
let teamsPaintGeneration = 0;

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
  leagueStatusRetry: document.querySelector("#league-status-retry"),
  landingSearchStatus: document.querySelector("#landing-search-status"),
  landingSearchStatusText: document.querySelector("#landing-search-status-text"),
  landingSearchRetry: document.querySelector("#landing-search-retry"),
  chromeLeagueLabel: document.querySelector("#chrome-league-label"),
  chromeManagerLabel: document.querySelector("#chrome-manager-label"),
  chromeModeLabel: document.querySelector("#chrome-mode-label"),
  mobileChromeViewing: document.querySelector("#mobile-chrome-viewing"),
  sampleChrome: document.querySelector("#sample-chrome"),
  sampleChromeTitle: document.querySelector("#sample-chrome-title"),
  sampleChromeViewing: document.querySelector("#sample-chrome-viewing"),
  sampleBanner: document.querySelector("#sample-banner"),
  identitySection: document.querySelector("#identity-section"),
  meSelect: document.querySelector("#me-select"),
  deskNav: document.querySelector("#desk-nav"),
  pageTabs: document.querySelector("#page-tabs"),
  powerSection: document.querySelector("#power-section"),
  powerDashboard: document.querySelector("#power-dashboard"),
  workspace: document.querySelector(".workspace"),
  pageTabButtons: document.querySelectorAll(".page-tab"),
  pages: Object.fromEntries(PAGE_IDS.map((page) => [page, document.querySelector(`#${page}-page`)])),
  startDashboard: document.querySelector("#start-dashboard"),
  standingsDashboard: document.querySelector("#standings-dashboard"),
  powerHeading: document.querySelector("#power-heading"),
  rosterSheet: document.querySelector("#roster-sheet"),
  rosterSheetHeading: document.querySelector("#roster-sheet-heading"),
  weeklyHelpBtn: document.querySelector("#weekly-help-btn"),
  weeklyHelpLayerHost: document.querySelector("#weekly-help-layer-host"),
  windowCallDashboard: document.querySelector("#window-call-dashboard"),
  tradeMatchNeeds: document.querySelector("#trade-match-needs"),
  tradeMatchDashboard: document.querySelector("#trade-match-dashboard"),
  matchGenerateBtn: document.querySelector("#match-generate-btn"),
  matchGenerateHelp: document.querySelector("#match-generate-help"),
  matchGenerateError: document.querySelector("#match-generate-error"),
  calculatorSection: document.querySelector("#calculator-section"),
  calculatorShell: document.querySelector("#calculator-shell"),
  ranksDashboard: document.querySelector("#ranks-dashboard"),
  homeBtn: document.querySelector("#home-btn"),
  landingFindBtn: document.querySelector("#landing-find-btn"),
  landingUsername: document.querySelector("#landing-username"),
  landingUsernameForm: document.querySelector("#landing-username-form"),
  landingTalkForm: document.querySelector("#landing-talk-form"),
  landingUsernameError: document.querySelector("#landing-username-error"),
  landingJobs: document.querySelector("#landing-jobs"),
  landingJobHint: document.querySelector("#landing-job-hint"),
  landingLeaguePicker: document.querySelector("#landing-league-picker"),
  landingLoading: document.querySelector("#landing-loading"),
  landingLoadingText: document.querySelector("#landing-loading-text"),
  usernameError: document.querySelector("#username-error"),
  leagueIdError: document.querySelector("#league-id-error"),
  stickyMobileCta: document.querySelector("#sticky-mobile-cta"),
  stickyFindBtn: document.querySelector("#sticky-find-btn"),
  mobileChromeTitle: document.querySelector("#mobile-chrome-title"),
  routeTitle: document.querySelector("#route-title"),
  mobileRailToggle: document.querySelector("#mobile-rail-toggle"),
  mobileRailClose: document.querySelector("#mobile-rail-close"),
  deskBoardClose: document.querySelector("#desk-board-close"),
  deskBoardOpen: document.querySelector("#desk-board-open"),
  boardTools: document.querySelector("#board-tools"),
  boardToolsSlot: document.querySelector("#board-tools-slot"),
  mobileHomeBtn: document.querySelector("#mobile-home-btn"),
  railBackdrop: document.querySelector("#rail-backdrop"),
  controlRail: document.querySelector("#control-rail"),
  phoneDesk: document.querySelector("#phone-desk"),
  heroTitle: document.querySelector("#hero-title"),
  heroLede: document.querySelector("#hero-lede"),
  heroEyebrow: document.querySelector("#hero-eyebrow"),
  leagueAvatar: document.querySelector("#league-avatar"),
};

const leagueLoader = createLeagueLoader();
const leagueLoadRecovery = createLeagueLoadRecovery({
  isCurrent: (token) => leagueLoader.isCurrent(token),
  load: (leagueId, job) => {
    void loadLeagueById(leagueId, { sample: Boolean(job?.sample) });
  },
  onlineTarget: window,
});
let userSearchGeneration = 0;
const userSearchRecovery = createLeagueLoadRecovery({
  isCurrent: (token) => token === userSearchGeneration,
  load: (username) => {
    void searchUserLeagues(username);
  },
  onlineTarget: window,
});
const pageRenderQueue = createPageRenderQueue({
  render: () => renderActivePage(),
  isTyping: () => typingInActivePage(),
  schedule: (run) => (typeof requestAnimationFrame === "function" ? requestAnimationFrame(run) : setTimeout(run, 16)),
  cancel: (id) => (typeof cancelAnimationFrame === "function" ? cancelAnimationFrame(id) : clearTimeout(id)),
});
let leagueLoadAnimationTimer = null;
let leagueLoadStartedAt = 0;
let livePoller = null;
let playerLoadEpoch = 0;
let playerLoadAbort = null;
let playersInflight = null;
let playersInflightEpoch = -1;
let playersIdb = null;
let liveVisibilityBound = false;
let userSearchPromise = null;
let missedLeagueSeasons = [];
let lastSimSignature = "";
let leagueTradeSideCache = { key: "", sides: [] };
let franchiseIndexCache = { key: "", index: null };
let applyingHistory = false;
let managerSelectorHydrating = false;
let managerSelectorHydrateEpoch = 0;
let seasonStatsCache = { season: "", stats: null };
let bootRoute = null;
let connectNextPlace = null;
// The draft a Review trade, a new partner, or Clear replaced, so one tap brings it back.
let draftReplaced = null;
// Describe-a-trade box: the last message and its reply (memory only), and a
// sentence typed before prices loaded.
let tradeTalkLog = [];
let pendingTradeTalk = "";
// Picking a suggestion cancels the click. Swallow the follow-up so it cannot
// land on Clear both sides after the list re-renders.
let swallowCalcClick = false;
let swallowCalcTimer = 0;
let ranksSearchTimer = 0;
let draftBasisCache = { bundles: null, format: "", basis: null };
let rankBoardCache = { key: "", rows: [] };
let rankContextPromise = null;
let playerNoteContext = {
  nflPlayers: {},
  seasonStats: {},
  draftPicks: {},
  currentSeason: "",
  previousSeason: "",
};

function getAssetValue(asset, values = state.values) {
  return marketAssetValue(asset, values, {
    valueNameMap: state.valueNameMap,
    pickCatalog: state.pickValueCatalog,
  });
}

function isEstimatedAsset(asset, values = state.values) {
  return marketIsEstimated(asset, values, {
    valueNameMap: state.valueNameMap,
    pickCatalog: state.pickValueCatalog,
  });
}

el.usernameSearchForm?.addEventListener("submit", requestFindLeagues);
el.leagueStatusRetry?.addEventListener("click", retryUserLeagueSearch);
el.landingSearchRetry?.addEventListener("click", retryUserLeagueSearch);
document.getElementById("landing-league-retry")?.addEventListener("click", retryFailedLeagueLoad);
document.getElementById("desk-load-retry")?.addEventListener("click", retryFailedLeagueLoad);
document.getElementById("sleeper-down-retry")?.addEventListener("click", retryFailedLeagueLoad);
document.getElementById("desk-load-dismiss")?.addEventListener("click", dismissFailedLeagueLoad);
el.leaguePicker?.addEventListener("click", handleLeaguePickClick);
el.landingLeaguePicker?.addEventListener("click", handleLeaguePickClick);
el.workspace?.addEventListener("click", (event) => {
  if (!event.target.closest?.("[data-player-league-list]")) return;
  handleLeaguePickClick(event);
});
el.workspace?.addEventListener("submit", (event) => {
  if (handleTradeTalkSubmit(event)) return;
  const form = event.target?.closest?.("[data-player-connect]");
  if (!form || !el.workspace.contains(form)) return;
  event.preventDefault();
  void openPlayerLeagueList(form);
});
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
    document.querySelector("#landing")?.classList.add("hidden");
    openRoom(button.dataset.page, button.dataset.room);
  });
});
el.pageTabs?.addEventListener("keydown", handlePageTabKeydown);
el.mobileRailToggle?.addEventListener("click", () => {
  const nextOpen = !document.body.classList.contains("rail-open");
  setMobileRailOpen(nextOpen);
  if (nextOpen) {
    requestAnimationFrame(() => {
      if (!document.body.classList.contains("rail-open")) return;
      el.mobileRailClose?.focus();
    });
  }
});
el.phoneDesk?.addEventListener("click", handlePhoneDeskClick);
el.mobileRailClose?.addEventListener("click", () => setMobileRailOpen(false));
el.railBackdrop?.addEventListener("click", () => setMobileRailOpen(false));
el.deskBoardClose?.addEventListener("click", () => {
  setDeskBoardShut(true);
  requestAnimationFrame(() => el.deskBoardOpen?.focus());
});
el.deskBoardOpen?.addEventListener("click", () => {
  setDeskBoardShut(false);
  requestAnimationFrame(() => el.deskBoardClose?.focus());
});
document.addEventListener("click", (event) => {
  const trigger = event.target?.closest?.("button, a, [role='button']");
  if (trigger) routeFocus.arm(trigger);
}, true);
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || event.defaultPrevented) return;
  const verdictInfo = state.verdictInfoOpen ? document.querySelector("[data-action='verdict-info'][aria-expanded='true']") : null;
  if (verdictInfo) {
    // Esc closes the ⓘ notes and puts focus back on the button.
    event.preventDefault();
    setVerdictInfoOpen(verdictInfo, false);
    verdictInfo.focus();
    return;
  }
  if (escapeRouteOverlay(event)) return;
  const field = event.target?.closest?.("input, textarea, select");
  if (field) return;
  if (!isPhoneLayout() && !document.documentElement.classList.contains("desk-shut")) {
    setDeskBoardShut(true);
    el.deskBoardOpen?.focus();
  }
});
document.addEventListener("click", handleLaunchClick);
document.addEventListener("click", (event) => {
  const home = event.target.closest("[data-action='league-home']");
  if (!home) return;
  event.preventDefault();
  goLeagueHome();
});
document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-sample-find]");
  if (!button || el.workspace?.contains(button)) return;
  event.preventDefault();
  openSampleConnect();
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
  setDeskBoardShut(readDeskBoardShut());
  if (state.activePage === "players") renderRankSurfaces();
  else releaseRankBoardTools();
});
el.landingUsernameForm?.addEventListener("submit", requestFindLeagues);
el.landingTalkForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const input = el.landingTalkForm.querySelector("input[name='say']");
  const say = event.submitter?.name === "try" ? event.submitter.value : (input?.value || "");
  if (input) input.value = "";
  openTradeWithTalk(say);
});
el.stickyFindBtn?.addEventListener("click", (event) => {
  if (bootIsPending()) {
    event.preventDefault();
    queueFindForBoot(String(el.sleeperUsername?.value || el.landingUsername?.value || ""));
    return;
  }
  focusUsernameSearch();
});
el.sleeperUsername?.addEventListener("input", () => {
  syncUsernameFields(el.sleeperUsername);
  setUsernameError("");
});
el.landingUsername?.addEventListener("input", () => {
  syncUsernameFields(el.landingUsername);
  setUsernameError("");
});
document.addEventListener("input", (event) => {
  const id = event.target?.id;
  if (id !== "sleeper-username" && id !== "landing-username") return;
  syncUsernameFields(event.target);
}, true);
el.leagueId?.addEventListener("input", () => setFieldError(el.leagueId, el.leagueIdError, ""));
el.workspace?.addEventListener("click", swallowArmedCalcClick, true);
el.workspace?.addEventListener("click", handleWorkspaceClick);
el.controlRail?.addEventListener("click", (event) => {
  if (!event.target.closest("#board-tools")) return;
  handleWorkspaceClick(event);
});
el.controlRail?.addEventListener("input", handleWorkspaceInput);
el.workspace?.addEventListener("keydown", handleWorkspaceKeydown);
el.workspace?.addEventListener("focusin", handleCalcSearchFocus);
el.workspace?.addEventListener("pointerdown", handleWorkspacePointerDown);
el.workspace?.addEventListener("change", handleWorkspaceChange);
el.workspace?.addEventListener("input", handleWorkspaceInput);
el.workspace?.addEventListener("focusout", () => {
  // Focus lands after focusout; a tap on another field keeps the render held.
  setTimeout(() => pageRenderQueue.release(), 0);
});
el.meSelect?.addEventListener("change", () => {
  if (managerSelectorHydrating) return;
  state.meRosterId = Number(el.meSelect.value);
  state.mePickedByUser = true;
  state.lensRosterId = null;
  clearTradeMatchCache();
  pruneSelectedOutgoingAssets();
  pruneExcludedOutgoingAssets();
  renderActivePage();
  renderSessionSnapshot();
  updateUrlState({ mode: "replace" });
});
el.matchGenerateBtn?.addEventListener("click", () => {
  void generateTradeMatches({ userRequested: true });
});

let sampleBannerOff = false;
let leagueMissing = false;
let sleeperUnreachable = false;
let connectAsked = false;
setDeskBoardShut(readDeskBoardShut());
state.valueCalc = readStoredDraft(globalThis.sessionStorage, globalThis.localStorage) || state.valueCalc;
renderSessionSnapshot();
let searchedUserNoted = false;
let appBooted = false;
let routeReports = 0;
let coldPlayerHeading = false;
let rankExtrasSettled = true;
let followHeadingsUntil = 0;
let routeFocusToken = 0;
let pendingPopstateFocus = 0;
let routeFocusHold = null;
let routeKeyboardUntil = 0;
let routeHeadingFocusVisible = false;
let historyFocusTakeover = false;
const routeSettleJobs = new Set();
let leagueOpenedInApp = false;
let slimDirectory = null;
let slimDirectoryPromise = null;
function noteSearchedUser(leagueId) {
  if (searchedUserNoted) return;
  const pick = searchedUserPick({ sleeperUser: state.sleeperUser, userLeagues: state.userLeagues, leagueId });
  if (!pick) return;
  searchedUserNoted = true;
  void recordSearchedUser(pick);
}
// First-party cookieless beacon to /api/collect. Set before bootFromUrl: boot
// rewrites the URL (updateUrlState -> reportRoute), and that can be the cold
// load's first pageview. Opt-outs (DNT, GPC, localhost, previews, automation)
// are enforced in modules/analytics.js before any send.
setAnalyticsAdapter(createBeaconAdapter());
bootFromUrl();
if (bootRoute?.leagueId) void loadSlimPlayersFile();
coldPlayerHeading = bootRoute?.name === "player";
document.addEventListener("focusin", (event) => {
  const target = event.target;
  if (!target || target === document.body || target === document.documentElement) return;
  if (target.id === "workspace") return;
  const tag = String(target.tagName || "");
  if (tag === "H1" || tag === "H2" || tag === "H3") return;
  // Closing the menu can move focus onto the close control after the room
  // heading. That is not the user staying in the menu.
  if (target.id === "mobile-rail-close" && !document.body.classList.contains("rail-open")) return;
  const cls = typeof target.className === "string" ? target.className : "";
  if (/(?:^|\s)(?:room-tab|page-tab|phone-desk-room|phone-desk-page)(?:\s|$)/.test(cls)) return;
  followHeadingsUntil = 0;
  coldPlayerHeading = false;
});
document.addEventListener("pointerdown", releaseRouteFocusHold, true);
document.addEventListener("keydown", releaseRouteFocusHold, true);
document.addEventListener("pointerdown", () => {
  routeKeyboardUntil = 0;
}, true);
document.addEventListener("keydown", () => {
  routeKeyboardUntil = Date.now() + 2500;
}, true);
document.addEventListener("focusin", () => {
  const hold = routeFocusHold;
  if (!hold || hold.token !== routeFocusToken) return;
  requestAnimationFrame(() => restoreHeldFocus());
}, true);
window.addEventListener("resize", syncDeskRailOffset);
if (bootRoute?.badLeague) {
  showLeagueNotFound();
} else if (!(bootRoute?.leagueId || parseShareParams(window.location.search).leagueId)) {
  const place = state.pendingPlace;
  const waitingOnLeague = place?.page === "league";
  if (!waitingOnLeague) state.pendingPlace = null;
  const page = place?.page === "trades" ? "trades" : "players";
  if (!waitingOnLeague && place?.page === page && place.room) setRoom(page, place.room);
  setActivePage(page, { history: "silent" });
  const showRanks = Boolean(state.ranks.selectedId) || bootRoute?.name === "players" || bootRoute?.legacy === "ranks";
  if (showRanks) document.querySelector("#landing")?.classList.add("hidden");
  if (bootRoute?.unknown) {
    document.querySelector("#landing")?.classList.remove("hidden");
    if (typeof history?.replaceState === "function") {
      history.replaceState({ ...historyPlaceNow(), pushed: false }, "", urlPath());
    }
  } else if (showRanks || bootRoute?.name === "trade" || bootRoute?.name === "player") {
    updateUrlState({ mode: "replace" });
  }
} else if (bootRoute?.name === "player") {
  // League is still loading. Hide the marketing page and wait for it.
  document.querySelector("#landing")?.classList.add("hidden");
  setActivePage(bootRoute.page || "players", { history: "silent" });
}
bindInfoTips(document);
void bootLaunchSurface();
if (typeof history.scrollRestoration === "string") history.scrollRestoration = "manual";
ensureRouteLive(document);
window.addEventListener("popstate", (event) => {
  // Skip to content only adds #workspace. That is not a desk move, and the
  // page-heading focus would take the workspace the link just targeted.
  if (window.location.hash === "#workspace" && !event.state?.tab) return;
  const raw = event.state?.idx;
  const next = Number.isFinite(Number(raw)) ? Number(raw) : Math.max(0, routeFocus.index() - 1);
  const before = routePlaceNow();
  const step = routeFocus.pop(next);
  const token = claimRouteFocus();
  pendingPopstateFocus = token;
  applyDeskPopState(event.state);
  const after = routePlaceNow();
  const focus = !appBooted ? "none" : (leagueRoomMove(before, after) ? "heading" : step.focus);
  void focusAfterPopstate({ focus, trigger: step.trigger, before, token });
  const followTitle = () => syncDocumentMeta();
  setTimeout(followTitle, 0);
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => setTimeout(followTitle, 0));
  reportRoute();
});
window.addEventListener("pageshow", (event) => {
  if (!event.persisted) return;
  syncDocumentMeta();
});
if (isPhoneLayout()) setMobileRailOpen(false);

syncDocumentMeta();
reportRoute();
appBooted = true;
focusColdPlayerHeading();
syncSiteDock();
bindMobileChromeScroll(window, {
  chrome: document.querySelector("#mobile-chrome"),
  isPhone: isPhoneLayout,
  prefersReducedMotion: () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  phoneMedia: window.matchMedia(PHONE_LAYOUT_QUERY),
  reduceMedia: window.matchMedia("(prefers-reduced-motion: reduce)"),
});
const runQueuedFind = releaseBootGate(document);
if (runQueuedFind) scheduleBootFind(() => requestFindLeagues());

// ---------------------------------------------------------------------------
// Desk navigation: three pages, each with a row of rooms
// ---------------------------------------------------------------------------

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
  const place = resolveDeskPlace({ tab: nextPage, view: room || "" });
  const aliased = place.page === nextPage ? place.room : "";
  const nextRoom = clampRoom(nextPage, isRoomOf(nextPage, room) ? room : (aliased || defaultRoomFor(nextPage)));
  const openingPlayers = history !== "silent" && nextPage === "players" && nextRoom === "ranks";
  const samePlace = state.activePage === nextPage && getRoom(nextPage) === nextRoom && !state.selectedTradeId;
  if (samePlace && history === "push") {
    const href = pathForPlace({
      page: nextPage,
      room: nextRoom,
      leagueId: state.leagueId,
      landing: openingPlayers ? false : landingVisible(),
      give: draftSideIds("left"),
      get: draftSideIds("right"),
      shareCode: activeShareCode(),
    });
    if (!href || href === window.location.pathname) return;
  }
  if (history === "push") prepareDeskPush();
  if (openingPlayers) document.querySelector("#landing")?.classList.add("hidden");
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
  syncLaunchChrome();
}

function showAppPages() {
  hideLeagueNotFound();
  el.deskNav?.classList.remove("hidden");
  el.homeBtn?.classList.remove("hidden");
  el.mobileHomeBtn?.classList.remove("hidden");
  const pending = state.pendingPlace || connectNextPlace;
  connectNextPlace = null;
  state.pendingPlace = null;
  state.pendingJobId = "";
  const page = pending && PAGE_IDS.includes(pending.page) ? pending.page : "league";
  if (pending?.room) setRoom(page, pending.room);
  else setRoom("league", "team");
  clampRoomsToLeague();
  setActivePage(page, { history: "replace", scroll: "top" });
  if (leagueOpenedInApp && typeof history?.replaceState === "function") {
    history.replaceState({ ...(history.state || {}), pushed: true }, "", `${window.location.pathname}${window.location.search}`);
    leagueOpenedInApp = false;
  }
}

function hideAppPages() {
  el.deskNav?.classList.add("hidden");
  el.homeBtn?.classList.add("hidden");
  el.mobileHomeBtn?.classList.add("hidden");
  PAGE_IDS.forEach((page) => {
    const pageEl = el.pages[page];
    pageEl?.classList.add("hidden");
    if (pageEl) pageEl.hidden = true;
  });
}

function setActivePage(page, { history = "replace", scroll = "preserve", prepared = false, landing = "" } = {}) {
  const nextPage = PAGE_IDS.includes(page) ? page : DEFAULT_PAGE;
  if (history === "push" && !prepared) prepareDeskPush();
  if (landing === "hide") document.querySelector("#landing")?.classList.add("hidden");
  if (landing === "show") document.querySelector("#landing")?.classList.remove("hidden");
  state.activePage = nextPage;
  if (nextPage !== "players") releaseRankBoardTools();

  PAGE_IDS.forEach((pageId) => {
    const pageEl = el.pages[pageId];
    const isActive = pageId === nextPage;
    pageEl?.classList.toggle("hidden", !isActive);
    if (pageEl) pageEl.hidden = !isActive;
  });
  scrollActiveTabIntoView();
  renderSessionSnapshot();
  renderActivePage();
  if (scroll === "top") window.scrollTo(0, 0);
  if (history !== "silent") updateUrlState({ mode: history });
  syncDocumentMeta();
  syncLaunchChrome();
  syncRouteAriaCurrent();
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
  if (isActiveNavTab(nextTab)) return;
  openRoom(nextTab.dataset.page, nextTab.dataset.room, { history: "push", scroll: "top" });
}

function renderActivePage() {
  pageRenderQueue.settle();
  if (state.leagueSwitching) {
    renderLeagueHero();
    hideAppPages();
    return;
  }
  refreshProjectedPickSlots();
  syncRoomUi();
  renderLeagueHero();
  const page = state.activePage;
  const room = getRoom(page);
  if (page === "trades") {
    renderTradesRoom(room);
    if (room === "calculator") {
      renderRankHost(el.ranksDashboard);
      if (!rankValuesReady() || !playerNoteContext?.previousSeason) void ensureRankExtras();
    }
  } else if (state.leagueId) {
    renderLeagueRoom(room);
  } else {
    renderLeagueGuest();
  }
}

function requestActivePageRender() {
  if (!state.leagueId && state.activePage === "league") return;
  pageRenderQueue.request();
}

function typingInActivePage() {
  const active = document.activeElement;
  return isTextEntry(active) && Boolean(el.pages[state.activePage]?.contains(active));
}

function renderLeagueRoom(room) {
  renderTeamsPage();
  renderWindowCallDashboard();
  renderStandingsRoom();
  focusLeagueRoomHeading(room);
}

function activeRankFormat() {
  if (state.ranks?.format === "oneQb" || state.ranks?.format === "sf") return state.ranks.format;
  if (state.league) return selectValueFormat(state.league);
  return "sf";
}

function rankValuesReady() {
  const values = state.valueBundles?.sf?.values || state.valueBundles?.oneQb?.values;
  return Boolean(values && Object.keys(values).length);
}

function rankNflPlayers() {
  if (state.players && Object.keys(state.players).length) return state.players;
  return playerNoteContext?.nflPlayers || {};
}

function rankOwners() {
  const owners = {};
  if (!state.leagueId) return owners;
  const me = String(state.meRosterId || "");
  for (const roster of state.normalizedRosters || []) {
    const mine = String(roster.rosterId) === me;
    const name = roster.manager?.displayName || "A team";
    for (const asset of roster.assets || []) {
      if (asset?.assetType !== "player" || !asset.assetId || owners[asset.assetId]) continue;
      owners[asset.assetId] = { name, mine };
    }
  }
  return owners;
}

function rankPlayerNote(playerId, raw) {
  if (!playerNoteContext?.previousSeason && !playerNoteContext?.seasonStats) return "";
  const position = String(raw?.position || raw?.fantasy_positions?.[0] || "").toUpperCase();
  const line = formatPlayerDetail({
    isRookie: isRookiePlayer(raw, playerNoteContext.currentSeason),
    draft: lookupNflDraftPick(playerId, playerNoteContext.draftPicks, raw),
    stats: playerNoteContext.seasonStats?.[playerId] || playerNoteContext.seasonStats?.[String(playerId)] || null,
    position,
    previousSeason: playerNoteContext.previousSeason,
  });
  if (!line || /^No \d{4} stats/.test(line)) return "";
  return line;
}

function cachedRankRows() {
  const format = activeRankFormat();
  const bundle = state.valueBundles?.[format];
  const values = bundle?.values || {};
  const players = rankNflPlayers();
  const key = [
    format,
    state.valuationRevision || 0,
    Object.keys(values).length,
    Object.keys(players).length,
    playerNoteContext?.previousSeason || "",
    state.leagueId || "",
    state.normalizedRosters?.length || 0,
    state.meRosterId || "",
    nextRookieDraftSeason(),
  ].join("|");
  if (rankBoardCache.key === key) return rankBoardCache.rows;
  rankBoardCache = {
    key,
    rows: buildRankBoard({
      values,
      names: state.valueBundles?.names || bundle?.nameMap || state.valueNameMap || {},
      modelPlayers: state.valueBundles?.players || {},
      nflPlayers: players,
      owners: rankOwners(),
      noteFor: rankPlayerNote,
      minPickSeason: nextRookieDraftSeason(),
    }),
  };
  return rankBoardCache.rows;
}

function leagueLoadBlocksPlayer() {
  const wanted = leagueLoader.inFlightId?.() || "";
  if (!wanted || String(state.leagueId || "") === String(wanted)) return false;
  return Boolean(state.ranks?.selectedId);
}

function rankViewModel() {
  if (!rankValuesReady() || leagueLoadBlocksPlayer()) {
    return rankView({ loading: true, format: activeRankFormat() });
  }
  return rankView({
    rows: cachedRankRows(),
    query: state.ranks?.query || "",
    position: state.ranks?.position || "ALL",
    shown: state.ranks?.shown || RANK_PAGE_SIZE,
    format: activeRankFormat(),
    leagueFormat: state.league ? selectValueFormat(state.league) : "",
    selectedId: state.ranks?.selectedId || "",
    caveat: state.league ? marketCaveat(state.league) : "",
    leagueOpen: Boolean(state.leagueId),
    history: state.valueHistory,
    updated: valuesFreshness(),
  });
}

function releaseRankBoardTools() {
  document.body.classList.remove("board-tools-live");
  if (el.boardTools) el.boardTools.hidden = true;
  if (el.boardToolsSlot) el.boardToolsSlot.replaceChildren();
}

function rankToolbarHome(host, park) {
  return park ? el.boardToolsSlot : host;
}

function paintRankToolbar(toolbar, view, typing) {
  if (!toolbar) return;
  toolbar.querySelectorAll("[data-action='rank-pos']").forEach((button) => {
    const on = button.dataset.pos === view.position;
    button.classList.toggle("active", on);
    button.setAttribute("aria-pressed", String(on));
  });
  toolbar.querySelectorAll("[data-action='rank-format']").forEach((button) => {
    const on = button.dataset.format === view.format;
    button.classList.toggle("active", on);
    button.setAttribute("aria-pressed", String(on));
  });
  const note = toolbar.querySelector(".ranks-note");
  if (note) note.textContent = view.note;
  const input = toolbar.querySelector("[data-ranks-query]");
  if (input && !typing) input.value = view.query;
}

function renderRankHost(host) {
  if (!host) return;
  const view = rankViewModel();
  const canPark = false;
  const park = canPark && !view.loading;

  if (host === el.ranksDashboard) {
    document.body.classList.toggle("board-tools-live", park);
    if (el.boardTools) el.boardTools.hidden = !park;
  }

  if (view.loading || !host.querySelector("[data-ranks-body]")) {
    host.innerHTML = renderRanksMarkup(view);
  }

  if (canPark && el.boardToolsSlot) {
    const parkedToolbar = el.boardToolsSlot.querySelector("[data-ranks-toolbar]");
    const hostToolbar = host.querySelector("[data-ranks-toolbar]");
    if (park) {
      if (hostToolbar) el.boardToolsSlot.appendChild(hostToolbar);
      else if (!parkedToolbar) el.boardToolsSlot.innerHTML = renderRanksToolbar(view);
    } else if (parkedToolbar) {
      const root = host.querySelector("[data-ranks-root]");
      if (root) root.prepend(parkedToolbar);
      else el.boardToolsSlot.replaceChildren();
    }
  }

  const toolbar = rankToolbarHome(host, park)?.querySelector("[data-ranks-toolbar]");
  const typing = Boolean(
    toolbar
    && document.activeElement?.matches?.("[data-input='ranks-search']")
    && toolbar.contains(document.activeElement)
  );
  if (!view.loading) paintRankToolbar(toolbar, view, typing);
  const body = host.querySelector("[data-ranks-body]");
  if (body && !view.loading) body.innerHTML = renderRanksBody(view);
  syncPlayerConnectSlot(host, view);
  bindPlayerPhotos(host);
  if (view.card?.kind === "player" && view.card?.name) {
    canonicalizePlayerUrl(view.card.playerId || view.card.assetId, view.card.name);
    syncDocumentMeta();
    focusColdPlayerHeading();
  }
}

function ranksBoardVisible() {
  return state.activePage === "trades" && getRoom("trades") === "calculator";
}

function renderRankSurfaces() {
  if (ranksBoardVisible()) renderRankHost(el.ranksDashboard);
}

async function ensureRankExtras() {
  rankExtrasSettled = false;
  try {
    if (!rankValuesReady()) {
      await ensureValuesLoaded("");
      if (!state.leagueId) {
        const bundle = pickValueBundle(state.valueBundles, activeRankFormat());
        state.values = bundle.values || {};
        state.valueNameMap = bundle.nameMap || {};
        state.valueFormat = activeRankFormat();
      }
    }
    if (!playerNoteContext?.previousSeason && !rankContextPromise) {
      rankContextPromise = loadPlayerNoteContext()
        .then((ctx) => {
          if (ctx) playerNoteContext = ctx;
          return ctx;
        })
        .catch(() => null);
    }
    if (rankContextPromise) await rankContextPromise;
  } catch (err) {
    console.warn("Could not load player ranks", err);
  }
  rankExtrasSettled = true;
  rankBoardCache = { key: "", rows: [] };
  if (ranksBoardVisible()) {
    renderRankSurfaces();
    renderTradeDraft();
  }
}

function openPlayerBoard({ history = "push" } = {}) {
  document.querySelector("#landing")?.classList.add("hidden");
  openRoom("trades", "calculator", { history });
  void ensureRankExtras();
}

function renderTradesRoom(room) {
  if (room === "find") {
    renderTradeMatchRoom();
    return;
  }
  renderTradeDraft();
}

function bootFromUrl() {
  sampleBannerOff = false;
  clearSampleBannerDismissal();
  const route = resolveLocation(window.location.pathname, window.location.search);
  bootRoute = route;
  const parsed = parseShareParams(window.location.search);
  if (parsed.invalidLeague) showInvalidLeagueLink();
  if (parsed.meRosterId) state.pendingMeRosterId = parsed.meRosterId;
  const hashToken = String(window.location.hash || "").replace(/^#/, "");
  const routeDrivesPlace = route.name !== "home" && !route.unknown && !route.badLeague;
  if (route.badLeague) {
    // Stay on /l/… The not-found state is painted after boot.
  } else if (route.name === "connect" && route.next) {
    const next = matchRoute(route.next);
    if (next) connectNextPlace = { page: next.page, room: next.room };
  } else if (routeDrivesPlace) {
    state.pendingPlace = { page: route.page, room: route.room };
  } else if (parsed.tab) {
    state.pendingPlace = { page: parsed.tab, room: parsed.view };
  } else if (hashToken) {
    // Old anchors like #league-hall still open the room they pointed at.
    state.pendingPlace = resolveDeskPlace({ view: hashToken });
  }
  if (parsed.week) state.pendingWeek = parsed.week;
  if (parsed.tone) state.pendingTone = parsed.tone;

  const fields = bootSearchFieldValues({ leagueFromUrl: parsed.sample ? "" : (route.leagueId || parsed.leagueId) });
  applyBootFieldValue(el.sleeperUsername, fields.username);
  applyBootFieldValue(el.landingUsername, fields.username);
  applyBootFieldValue(el.leagueId, fields.leagueId);

  const routedPlayer = assetIdFromRoute(route.playerId);
  if (routedPlayer) {
    state.ranks.selectedId = routedPlayer;
    if (!state.pendingPlace) state.pendingPlace = { page: route.page, room: route.room };
  } else if (parsed.view === "ranks" && parsed.asset && !routeDrivesPlace) {
    state.ranks.selectedId = parsed.asset;
  }
  if ((route.name === "trade") && (route.give.length || route.get.length || route.badShare || route.say)) {
    applyTradeRoute(route);
  }
  if (route.name === "connect") connectAsked = true;
  const leagueId = route.leagueId || parsed.leagueId;
  if (leagueId) {
    void loadLeagueById(leagueId, { sample: parsed.sample });
  } else if (!routeDrivesPlace && parsed.tab === "trades" && parsed.view === "ranks") {
    openPlayerBoard({ history: "silent" });
  } else if (route.legacy === "ranks" || route.name === "players") {
    openPlayerBoard({ history: "silent" });
  }
}

function activePlayerRouteId() {
  if (state.ranks?.selectedId && ranksBoardVisible()) {
    return routeIdFromAsset(state.ranks.selectedId);
  }
  return "";
}

function activeOverlay() {
  return topOverlay({
    rail: document.body.classList.contains("rail-open"),
    player: Boolean(activePlayerRouteId()),
    trade: Boolean(state.selectedTradeId),
  });
}

function historyPlaceNow() {
  const playerId = activePlayerRouteId();
  return {
    tab: state.activePage,
    view: getRoom(),
    playerId,
    overlay: activeOverlay(),
    selectedTradeId: state.selectedTradeId,
    selectedTradeManagerKey: state.selectedTradeManagerKey,
    scrollY: window.scrollY || 0,
    landing: landingVisible(),
  };
}

function deskUrlPath() {
  if (connectAsked && !state.leagueId && landingVisible()) return "/connect?next=/";
  const nextUrl = buildShareUrl({ origin: "" });
  return nextUrl || "/";
}

function prepareDeskPush() {
  if (applyingHistory) return;
  if (typeof history?.replaceState !== "function") return;
  const currentPath = `${window.location.pathname}${window.location.search}`;
  history.replaceState({
    ...historyPlaceNow(),
    pushed: Boolean(history.state?.pushed),
  }, "", currentPath);
}

function activeRouteElement() {
  const active = document.activeElement;
  if (!active || active === document.body || active === document.documentElement) return null;
  return active;
}

function historySnap(entry = {}) {
  return {
    overlay: String(entry.overlay || ""),
    tab: String(entry.tab || ""),
    view: String(entry.view || ""),
    playerId: String(entry.playerId || ""),
  };
}

function routePlaceNow() {
  const overlay = activeOverlay();
  const playerId = activePlayerRouteId();
  const playerName = routedPlayerName();
  const showPlayer = Boolean(playerName) && (Boolean(playerId) || overlay === "player");
  const onLanding = landingVisible()
    && !state.leagueId
    && !showPlayer
    && state.activePage === "players"
    && overlay !== "public-ranks";
  return {
    playerName: showPlayer ? playerName : "",
    playerId,
    tab: state.activePage,
    titleTab: onLanding ? "" : state.activePage,
    view: getRoom(),
    overlay,
    page: state.activePage,
  };
}

function syncRouteAriaCurrent() {
  const room = getRoom();
  syncAriaCurrent(el.pageTabButtons, isActiveNavTab);
  syncAriaCurrent(document.querySelectorAll("[data-phone-room]"), (button) => {
    return button.dataset.page === state.activePage && button.dataset.phoneRoom === room;
  });
}

function armHeadingFollow() {
  followHeadingsUntil = Date.now() + 45000;
}

function roomFocusVisible() {
  return Date.now() < routeKeyboardUntil;
}

function focusRouteHeading(selector, focusVisible = routeHeadingFocusVisible, takeover = false) {
  if (pendingPopstateFocus) return;
  if (!selector || Date.now() >= followHeadingsUntil) return;
  focusHeadingWhenPresent(document, selector, {
    stillWanted: () => Date.now() < followHeadingsUntil,
    focusVisible,
    takeover,
  });
}

function leagueRoomMove(before, after) {
  if (!before || !after) return false;
  if (before.overlay || after.overlay || before.playerId || after.playerId) return false;
  if ((before.page || before.tab) !== "league" || (after.page || after.tab) !== "league") return false;
  return String(before.view || "") !== String(after.view || "");
}

function focusLeagueRoomHeading(room) {
  if (pendingPopstateFocus) return;
  if (!appBooted || Date.now() >= followHeadingsUntil) return;
  if (room !== "team" && room !== "board" && room !== "scores" && room !== "activity" && room !== "history") return;
  if (state.activePage !== "league" || getRoom() !== room) return;
  const run = () => {
    if (pendingPopstateFocus || !appBooted || Date.now() >= followHeadingsUntil) return;
    if (state.activePage !== "league" || getRoom() !== room) return;
    focusHeadingWhenPresent(document, headingSelectorFor({ page: "league", view: room }), {
      stillWanted: () => Date.now() < followHeadingsUntil,
      focusVisible: roomFocusVisible(),
    });
  };
  if (routeFocusHold && routeFocusHold.token === routeFocusToken) {
    requestAnimationFrame(run);
    return;
  }
  run();
}

function focusColdPlayerHeading() {
  if (!coldPlayerHeading || !appBooted) return;
  armHeadingFollow();
  focusHeadingWhenPresent(document, ".ranks-card h2, .player-week-sheet h2", {
    onStuck() {
      if (!rankExtrasSettled) return;
      coldPlayerHeading = false;
      const message = routeAnnouncement(routePlaceNow(), {});
      if (message) announceRoute(document, message);
    },
  });
}

function claimRouteFocus() {
  routeFocusToken += 1;
  pendingPopstateFocus = 0;
  routeFocusHold = null;
  followHeadingsUntil = 0;
  return routeFocusToken;
}

function releaseRouteFocusHold() {
  routeFocusHold = null;
}

function focusHoldExempt(node) {
  if (!node) return false;
  const id = node.id || "";
  if (id === "mobile-rail-toggle" || id === "mobile-rail-close" || id === "desk-board-open" || id === "desk-board-close") return true;
  const cls = typeof node.className === "string" ? node.className : "";
  return cls.split(/\s+/).some((name) => (
    name === "room-tab" || name === "page-tab" || name === "phone-desk-room" || name === "phone-desk-page"
  ));
}

function shownElement(node) {
  let el = node;
  while (el && el.nodeType === 1) {
    if (el.hidden) return false;
    if (typeof el.classList?.contains === "function" && el.classList.contains("hidden")) return false;
    if (typeof getComputedStyle === "function") {
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") return false;
    }
    el = el.parentElement;
  }
  return Boolean(node);
}

function shownQuery(selector) {
  const nodes = document.querySelectorAll(selector);
  for (const node of nodes) {
    if (shownElement(node)) return node;
  }
  return null;
}

function visiblePageHeading() {
  const nodes = [
    document.querySelector("#landing-job-hint"),
    document.querySelector("#mobile-chrome-title"),
    document.querySelector("#route-title"),
  ];
  return nodes.find((node) => shownElement(node)) || null;
}

function focusPageHeading() {
  const heading = visiblePageHeading();
  if (!heading) return null;
  if (heading.getAttribute("tabindex") == null) heading.setAttribute("tabindex", "-1");
  focusWithoutScroll(heading, { focusVisible: routeHeadingFocusVisible });
  return heading;
}

function holdRouteFocus(token, getTarget, focusVisible = false) {
  routeFocusHold = { token, getTarget, fails: 0, focusVisible };
  requestAnimationFrame(() => restoreHeldFocus());
}

function restoreHeldFocus() {
  const hold = routeFocusHold;
  if (!hold || hold.token !== routeFocusToken) return;
  const target = hold.getTarget();
  if (!target || target.isConnected === false) return;
  if (document.activeElement === target) {
    hold.fails = 0;
    return;
  }
  if (focusHoldExempt(document.activeElement)) return;
  if (hold.fails > 4) return;
  if (target.getAttribute("tabindex") == null) target.setAttribute("tabindex", "-1");
  focusWithoutScroll(target, { focusVisible: Boolean(hold.focusVisible) });
  if (document.activeElement === target) hold.fails = 0;
  else hold.fails += 1;
}

function trackRouteSettle(promise) {
  const job = Promise.resolve(promise).finally(() => routeSettleJobs.delete(job));
  routeSettleJobs.add(job);
  return job;
}

async function waitForRouteToSettle(token) {
  const deadline = Date.now() + 5000;
  while (token === routeFocusToken && Date.now() < deadline) {
    if (!pageRenderQueue.isPending() && routeSettleJobs.size === 0) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      if (token !== routeFocusToken) return;
      if (!pageRenderQueue.isPending() && routeSettleJobs.size === 0) return;
      continue;
    }
    await Promise.race([
      routeSettleJobs.size ? Promise.all([...routeSettleJobs]) : Promise.resolve(),
      new Promise((resolve) => requestAnimationFrame(resolve)),
    ]);
  }
}

function visibleHeadingText(place) {
  const selector = headingSelectorFor(place);
  if (!selector) return "";
  return String(shownQuery(selector)?.textContent || "").replace(/\s+/g, " ").trim();
}

function clearRouteAnnouncement() {
  const node = document.getElementById("route-announcer");
  if (node && node.textContent) node.textContent = "";
}

function focusClickedRoute(before) {
  const focusVisible = routeHeadingFocusVisible;
  const takeover = historyFocusTakeover;
  armHeadingFollow();
  const place = routePlaceNow();
  const selector = headingSelectorFor(place);
  if (selector) {
    focusRouteHeading(selector, focusVisible, takeover);
    return;
  }
  const root = headingRootFor(document, place, before || {});
  if (!focusViewHeading(root, { focusVisible })) focusViewHeading(document.querySelector("main"), { focusVisible });
}

async function waitForHistoryLeague(token) {
  const deadline = Date.now() + 20000;
  while (token === routeFocusToken && state.leagueSwitching && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
}

async function focusAfterPopstate({ focus, trigger, before, token }) {
  const focusVisible = roomFocusVisible();
  if (focus === "none") {
    if (pendingPopstateFocus === token) pendingPopstateFocus = 0;
    syncRouteA11y({ focus: "none", trigger, before, settled: token, focusVisible });
    return;
  }
  await waitForRouteToSettle(token);
  if (token !== routeFocusToken) return;
  // Back to another league restores the URL before that room is on screen.
  // Wait until the restored room is the one in state, then focus its heading.
  await waitForHistoryLeague(token);
  if (token !== routeFocusToken) return;
  await new Promise((resolve) => requestAnimationFrame(resolve));
  if (token !== routeFocusToken) return;
  if (pendingPopstateFocus === token) pendingPopstateFocus = 0;
  const place = routePlaceNow();
  const selector = headingSelectorFor(place);
  const mode = selector ? "heading" : ((!place.overlay && !place.playerId) ? "page" : focus);
  if (mode === "heading") holdRouteFocus(token, () => shownQuery(selector), focusVisible);
  else if (mode === "page") holdRouteFocus(token, () => visiblePageHeading(), focusVisible);
  historyFocusTakeover = mode === "heading";
  syncRouteA11y({ focus: mode, trigger, before, settled: token, focusVisible });
  historyFocusTakeover = false;
}

function syncRouteA11y({ focus = "none", trigger = null, before = null, settled = 0, focusVisible = roomFocusVisible() } = {}) {
  syncDocumentMeta();
  syncRouteAriaCurrent();
  if (!appBooted || focus === "none") return;
  if (settled) {
    if (settled !== routeFocusToken) return;
  } else {
    claimRouteFocus();
  }
  routeHeadingFocusVisible = focusVisible;
  const place = routePlaceNow();
  const message = routeAnnouncement(place, before || {});
  const headingText = focus === "heading" ? visibleHeadingText(place) : "";
  if (message && message !== headingText) announceRoute(document, message);
  else if (message && headingText && message === headingText) clearRouteAnnouncement();
  if (focus === "heading") {
    focusClickedRoute(before);
    return;
  }
  if (focus === "page") {
    armHeadingFollow();
    focusPageHeading();
    return;
  }
  if (focus === "restore") restoreTriggerFocus(document, trigger || routeFocus.opener());
}

function overlayPushed(overlay) {
  const entry = history.state || {};
  if (!entry.pushed || !overlay) return false;
  if (overlay === "trade") return Boolean(entry.selectedTradeId);
  return entry.overlay === overlay;
}

function dismissRouteOverlay(overlay) {
  if (overlay === "rail") {
    setMobileRailOpen(false);
    return;
  }
  if (overlay === "player") {
    state.ranks.selectedId = "";
    if (state.activePage === "league" && getRoom() === "team") renderRosterSheet();
    renderRankSurfaces();
    updateUrlState({ mode: "replace" });
  }
}

function escapeRouteOverlay(event) {
  const overlay = activeOverlay();
  const action = applyEscape({
    overlay,
    pushed: overlayPushed(overlay),
    back() {
      if (typeof history.back === "function") history.back();
    },
    close() {
      dismissRouteOverlay(overlay);
    },
  });
  if (action === "none") return false;
  event.preventDefault();
  return true;
}

function updateUrlState({ mode = "replace", force = false } = {}) {
  // A broken /t/ link keeps its address: never rewrite it to the saved draft.
  if (mode === "replace" && state.badShareLink && /^\/t\//.test(window.location.pathname || "")) {
    routeFocus.forget();
    return;
  }
  if (applyingHistory) {
    routeFocus.forget();
    return;
  }
  if (typeof history?.replaceState !== "function") {
    routeFocus.forget();
    return;
  }
  const before = historySnap(history.state || {});
  const path = deskUrlPath();
  const snapshot = historyPlaceNow();
  const currentPath = `${window.location.pathname}${window.location.search}`;
  const nextPath = String(path || "").split("?")[0] || "/";
  const here = window.location.pathname || "/";
  const pathChanged = currentPath !== path;
  const placeWrite = decideHistoryWrite({
    current: history.state || {},
    next: snapshot,
    mode: sameHistoryPlace(history.state || {}, snapshot) && currentPath === path && mode === "push" ? "push" : mode,
  });
  // Leaving a cold /t stays on the trade calculator, so the place key does not
  // change and a normal push is downgraded to replace. Force one history entry
  // so Back and Forward can restore the shared title and the app title.
  const write = force && mode === "push" && pathChanged ? "push" : placeWrite;
  const pushed = write === "push" ? true : (write === "replace" && sameHistoryPlace(history.state || {}, snapshot) && Boolean(history.state?.pushed));
  const entry = { ...snapshot, pushed };
  // The history entry keeps whatever document.title is right now. Set the
  // rendered title first so Back cannot restore an outage title onto a team.
  syncDocumentMeta();
  if (write === "push" && typeof history.pushState === "function") {
    routeFocus.push(routeFocus.consumeArmed() || activeRouteElement());
    history.pushState(entry, "", path);
    reportRoute();
    syncRouteA11y({ focus: appBooted ? "heading" : "none", before });
    return;
  }
  if (write === "silent") {
    routeFocus.forget();
    return;
  }
  // A league is open. Keep the /l/ path, and still store the new history state.
  if (state.leagueId && nextPath === "/" && here.startsWith("/l/")) {
    routeFocus.forget();
    history.replaceState(entry, "", here);
    return;
  }
  routeFocus.forget();
  history.replaceState(entry, "", path);
  reportRoute();
  // A same-place replace (cold /t -> /trade) still has to drop the shared title.
  syncDocumentMeta();
  if (!appBooted) return;
  const after = historySnap(entry);
  const changed = before.overlay !== after.overlay
    || before.tab !== after.tab
    || before.view !== after.view
    || before.playerId !== after.playerId;
  if (!changed) return;
  const moved = before.tab !== after.tab || before.view !== after.view;
  if (before.overlay && !after.overlay && !(before.overlay === "rail" && moved)) {
    syncRouteA11y({ focus: "restore", trigger: routeFocus.opener(), before });
    return;
  }
  syncRouteA11y({ focus: "heading", before });
}

// One pageview per route change (templated, no ids), plus landing_view when
// the route lands on the home landing. The adapter is the first-party beacon
// set at boot (createBeaconAdapter).
// The first pageview that actually reaches an adapter carries the referrer
// and UTM (modules/analytics.js), whichever call it comes from.
function reportRoute() {
  const fresh = analyticsPageview(window.location.pathname);
  if (!fresh) return;
  routeReports += 1;
  if (window.location.pathname === urlPath() && landingVisible()) {
    analyticsTrack("landing_view", {}, { once: `route:${routeReports}` });
  }
}

function closeHistoryOverlay(kind) {
  if (applyingHistory) return false;
  if (history.state?.overlay === kind && history.state?.pushed && typeof history.back === "function") {
    history.back();
    return true;
  }
  return false;
}

function applyPlayerRoute(historyState, parsed) {
  const picked = selectionFromLocation({
    pathname: window.location.pathname,
    historyState,
    parsedAsset: parsed?.asset || "",
  });
  state.ranks.selectedId = picked.rankAssetId;
  if (picked.rankAssetId) document.querySelector("#landing")?.classList.add("hidden");
  setMobileRailOpen(picked.railOpen, { history: "silent" });
}

function applyDeskPopState(historyState) {
  const route = resolveLocation(window.location.pathname, window.location.search);
  const parsed = parseShareParams(window.location.search);
  const leagueId = route.leagueId || parsed.leagueId || "";
  const inflight = leagueLoader.inFlightId?.() || "";
  if (inflight && inflight !== String(leagueId)) {
    leagueLoader.drop();
    state.leagueSwitching = false;
    stopLeagueLoadingUi();
  }
  if (route.badLeague) {
    if (state.leagueId) unloadLeague();
    showLeagueNotFound();
    return;
  }
  hideLeagueNotFound();
  if (route.unknown) {
    if (state.leagueId) unloadLeague();
    document.querySelector("#landing")?.classList.remove("hidden");
    state.ranks.selectedId = "";
    applyDeskPlaceFromHistory(parsed, { ...(historyState || {}), tab: "players", view: "ranks" });
    if (typeof history?.replaceState === "function") {
      history.replaceState({ ...historyPlaceNow(), pushed: false }, "", urlPath());
    }
    restoreHistoryScroll(historyState);
    return;
  }
  if (route.name === "trade") applyTradeRoute(route);
  if (leagueId && String(leagueId) !== String(state.leagueId || "")) {
    state.pendingPlace = { page: route.page || parsed.tab, room: route.room || parsed.view };
    if (!state.pendingPlace.page && parsed.tab) state.pendingPlace = { page: parsed.tab, room: parsed.view };
    if (parsed.week) state.pendingWeek = parsed.week;
    if (parsed.meRosterId) state.pendingMeRosterId = parsed.meRosterId;
    void loadLeagueById(leagueId, { fromHistory: true, sample: parsed.sample });
    return;
  }
  if (!leagueId && state.leagueId) unloadLeague();
  const showLanding = route.name === "home" || route.name === "connect";
  document.querySelector("#landing")?.classList.toggle("hidden", !showLanding);
  if (!showLanding && (route.name === "players" || route.name === "player" || route.name === "trade" || route.leagueId)) {
    document.querySelector("#landing")?.classList.add("hidden");
  }
  if (showLanding) state.ranks.selectedId = "";
  if (!state.leagueId && !playerIdFromPathname(window.location.pathname) && !route.leagueId && route.name !== "players" && route.name !== "trade") {
    if (parsed.tab === "trades" && parsed.view === "ranks") {
      if (parsed.asset) state.ranks.selectedId = parsed.asset;
      else state.ranks.selectedId = "";
      openPlayerBoard({ history: "silent" });
      restoreHistoryScroll(historyState);
      return;
    }
  }
  if (route.name === "players" || route.legacy === "ranks") {
    document.querySelector("#landing")?.classList.add("hidden");
  }
  if (route.name === "home" || route.name === "connect") {
    document.querySelector("#landing")?.classList.remove("hidden");
    state.ranks.selectedId = "";
  }
  connectAsked = route.name === "connect" || Boolean(historyState?.connectAsked);
  const connectBox = document.querySelector("#landing-connect");
  if (connectBox) connectBox.hidden = !connectAsked;
  applyDeskPlaceFromHistory(parsed, historyState);
  syncLaunchChrome();
}

function applyDeskPlaceFromHistory(parsed, historyState) {
  applyingHistory = true;
  try {
    const route = resolveLocation(window.location.pathname, window.location.search);
    const routeKnown = Boolean(route?.name) && !route.unknown;
    let nextPage = routeKnown && PAGE_IDS.includes(route.page)
      ? route.page
      : (PAGE_IDS.includes(historyState?.tab)
        ? historyState.tab
        : (PAGE_IDS.includes(parsed.tab) ? parsed.tab : DEFAULT_PAGE));
    let nextView = routeKnown
      ? (route.room || defaultRoomFor(nextPage))
      : (historyState?.view || (parsed.tab ? parsed.view : "") || defaultRoomFor(nextPage));
    if (!state.leagueId && nextPage === "league" && !route.leagueId) {
      nextPage = DEFAULT_PAGE;
      nextView = defaultRoomFor(DEFAULT_PAGE);
    }
    setRoom(nextPage, nextView);
    applyPlayerRoute(historyState, parsed);
    if (route.name === "home" || route.name === "connect" || route.unknown) {
      state.ranks.selectedId = "";
      document.querySelector("#landing")?.classList.remove("hidden");
    }
    const snapshot = buildDeskHistorySnapshot(historyState || {});
    state.selectedTradeId = snapshot.selectedTradeId;
    state.selectedTradeManagerKey = snapshot.selectedTradeManagerKey;
    setActivePage(nextPage, { history: "silent", scroll: "preserve" });
    restoreHistoryScroll(snapshot);
  } finally {
    applyingHistory = false;
  }
}

function landingVisible() {
  const landing = document.querySelector("#landing");
  return Boolean(landing && !landing.classList.contains("hidden"));
}

function draftSideIds(side) {
  return (state.valueCalc?.[side] || []).map((item) => String(item?.assetId || "")).filter(Boolean);
}

function routedPlayerId() {
  return sleeperIdFrom(state.ranks?.selectedId);
}

function routedPlayerName() {
  const assetId = assetIdFromRoute(routedPlayerId());
  if (!assetId) return "";
  const row = cachedRankRows().find((entry) => entry.assetId === assetId);
  return row?.name || "";
}

function applyTradeRoute(route) {
  state.badShareLink = Boolean(route?.badShare);
  state.droppedPlayerNote = "";
  // Back from a just-shared /t/<code> lands on /trade and should stay there.
  state.sentShare = null;
  // A broken link leaves any saved draft alone, and the notice always shows.
  if (state.badShareLink) {
    state.sharedTrade = null;
    return;
  }
  // A described trade replaces the draft only once it is read, so Restore draft can undo it.
  if (route?.say && !route.give?.length && !route.get?.length) {
    state.sharedTrade = null;
    pendingTradeTalk = route.say;
    return;
  }
  // A shared link names its scoring. Without a league that sets the board format.
  if ((route?.format === "sf" || route?.format === "oneQb") && !state.leagueId) {
    if (!state.ranks) state.ranks = {};
    state.ranks.format = route.format;
  }
  let draft = emptyValueCalcState();
  const nameOf = (id) => state.valueNameMap?.[id] || id;
  for (const id of route?.give || []) draft = addValueCalcItem(draft, "left", { assetId: id, name: nameOf(id) });
  for (const id of route?.get || []) draft = addValueCalcItem(draft, "right", { assetId: id, name: nameOf(id) });
  state.valueCalc = draft;
  writeStoredDraft(draft);
  void loadSharedTrade(route?.shareCode, draft);
}

// Any /t/<code> link marks the draft as shared while it still matches the code:
// the address bar keeps /t/<code>, and the verdict speaks neutrally.
// A dated link also shows what the sharer saw, priced from the archived board.
// An undated stamp has no shared verdict, only today's.
// A dated stamp whose file was pruned still opens today's board, with a note.
async function loadSharedTrade(code, draft) {
  state.sharedTrade = null;
  state.sharedEditing = false;
  const decoded = decodeTradeShare(code || "");
  if (!decoded) return;
  const entry = { code, decoded, key: draftAssetKey(draft), snapshot: null, snapshotState: decoded.stamp ? "loading" : "none" };
  state.sharedTrade = entry;
  // #167: t_opened is sent once per open from the first verdict render after
  // the archive lookup settles, so drift matches what the page shows.
  const settle = () => {
    entry.settled = true;
    if (state.sharedTrade === entry && el.calculatorShell?.querySelector("#value-calc-verdict")) patchTradeDraft();
  };
  if (!decoded.stamp) return settle();
  try {
    // Index first. A stamp that is not listed is not fetched, so a pruned
    // board does not log a console 404.
    let index = null;
    const indexRes = await fetch(PRICE_HISTORY_INDEX_PATH);
    if (indexRes?.ok) index = await indexRes.json();
    const path = snapshotRequestForStamp(index, decoded.stamp);
    if (!path) {
      entry.snapshotState = "missing";
    } else {
      const res = await fetch(path);
      if (!res.ok) {
        entry.snapshotState = "missing";
      } else {
        const snapshot = await res.json();
        if (snapshot?.sf && snapshot?.oneQb) {
          entry.snapshot = snapshot;
          entry.snapshotState = "ready";
        } else {
          entry.snapshotState = "missing";
        }
      }
    }
  } catch {
    entry.snapshotState = "missing";
  }
  settle();
}

function activeSharedTrade(draft = state.valueCalc) {
  const entry = state.sharedTrade;
  return entry && entry.key === draftAssetKey(draft) ? entry : null;
}

function activeShareCode() {
  const sent = state.sentShare;
  if (sent && sent.key === draftAssetKey(state.valueCalc)) return sent.code;
  return activeSharedTrade()?.code || "";
}

// After Share, the sender's address bar shows the same /t/<code> they sent.
function rememberSentShare(code) {
  state.sentShare = { code, key: draftAssetKey(state.valueCalc) };
  if (typeof history?.replaceState !== "function") return;
  // A new entry, so Back returns to the /trade URL the sender was on.
  if (window.location.pathname === sharePath(code)) return;
  prepareDeskPush();
  history.pushState({ ...historyPlaceNow(), pushed: true }, "", sharePath(code));
}

function sharedOnCurrentPrices(stamp) {
  const current = priceStamp(state.valueBundles?.asOf);
  return Boolean(stamp && current && String(stamp) >= current);
}

function sharedVerdictFor(view) {
  const entry = activeSharedTrade(view.draft);
  if (!entry || !state.valueBundles) return null;
  const today = shareSummary(entry.decoded, state.valueBundles);
  const shared = entry.snapshot ? shareSummary(entry.decoded, entry.snapshot, {}, state.valueBundles) : null;
  const moved = Boolean(shared) && !sameVerdict(shared, today);
  if (entry.settled && !entry.reported) {
    entry.reported = true;
    trackTradeLinkOpened({ drift: moved });
  }
  return {
    today,
    shared: moved ? shared : null,
    date: stampLabel(entry.decoded.stamp),
    // A link shared on today's prices is current, not "no longer saved".
    missing: entry.snapshotState === "missing" && !sharedOnCurrentPrices(entry.decoded.stamp),
  };
}

function canonicalizePlayerUrl(playerId, name) {
  if (applyingHistory || typeof history?.replaceState !== "function") return;
  if (matchRoute(window.location.pathname)?.name !== "player") return;
  const next = playerPathname(playerId, name);
  if (!next || next === window.location.pathname) return;
  history.replaceState(history.state, "", `${next}${window.location.search}`);
}

function restoreHistoryScroll(historyState) {
  const scrollY = scrollTopFromHistory(historyState);
  if (scrollY == null) return;
  const go = () => window.scrollTo({ top: scrollY, left: 0, behavior: "instant" });
  go();
  requestAnimationFrame(go);
}

function syncLaunchChrome() {
  const trades = document.querySelector("#trades-page");
  const league = document.querySelector("#league-page");
  const onOther = (trades && !trades.classList.contains("hidden")) || (league && !league.classList.contains("hidden"));
  // A missing league and a Sleeper outage are still the no-league screen:
  // one h1, and no "Your Sleeper league" subtitle.
  const bare = (landingVisible() || leagueMissing || sleeperUnreachable) && !state.leagueId;
  const open = bare && !onOther;
  document.body.classList.toggle("launch-open", open);
}

function launchValueBundle() {
  return pickValueBundle(state.valueBundles, "sf");
}

function paintLaunchExample() {
  const host = document.querySelector("#launch-example");
  if (!host) return;
  const bundle = launchValueBundle();
  const values = bundle?.values || {};
  if (!Object.keys(values).length) {
    host.innerHTML = launchErrorMarkup();
    host.setAttribute("aria-busy", "false");
    return;
  }
  host.innerHTML = launchExampleMarkup({
    values,
    names: bundle.nameMap || state.valueNameMap || {},
    players: state.valueBundles?.players || {},
    globalMaxValue: getGlobalMaxPlayerValue(values),
  });
  host.setAttribute("aria-busy", "false");
}

function paintLaunchTrend(failed = false) {
  const host = document.querySelector("#launch-trend");
  if (!host) return;
  const bundle = launchValueBundle();
  const rows = hotSleeperRows(state.launchTrending || [], {
    values: bundle?.values || {},
    names: bundle?.nameMap || state.valueNameMap || {},
    players: state.valueBundles?.players || {},
  });
  host.innerHTML = launchTrendMarkup(rows, { failed });
  host.setAttribute("aria-busy", "false");
}

function revealLaunchConnect() {
  const box = document.querySelector("#landing-connect");
  if (box) box.hidden = false;
  document.querySelector(".launch-connect")?.setAttribute("hidden", "");
  connectAsked = true;
  document.querySelector("#landing-username")?.focus();
}

function openLaunchConnect() {
  revealLaunchConnect();
  updateUrlState({ mode: "replace" });
  syncLaunchChrome();
}

function draftFromAssetIds(ids, side, draft) {
  let next = draft;
  for (const id of ids) {
    next = addValueCalcItem(next, side, {
      assetId: id,
      name: state.valueNameMap?.[id] || id,
    });
  }
  return next;
}

function openExampleTrade() {
  let draft = emptyValueCalcState();
  draft = draftFromAssetIds(EXAMPLE_GIVE, "left", draft);
  draft = draftFromAssetIds(EXAMPLE_GET, "right", draft);
  replaceDraft(draft);
  openRoom("trades", "calculator", { history: "push", scroll: "top" });
  syncLaunchChrome();
}

function openEmptyTrade() {
  // "Build a trade" starts fresh. An older draft stays one tap away (Restore draft).
  state.sharedTrade = null;
  state.badShareLink = false;
  state.droppedPlayerNote = "";
  if (!isDraftEmpty(state.valueCalc)) replaceDraft(clearValueCalcSides(state.valueCalc), "Cleared both sides.");
  openRoom("trades", "calculator", { history: "push", scroll: "top" });
  syncLaunchChrome();
  requestAnimationFrame(() => {
    document.querySelector("[data-input='value-search'][data-side='left']")?.focus();
  });
}

function openLaunchPlayer(href) {
  const raw = String(href || "");
  const route = matchRoute(raw.split("?")[0], raw.includes("?") ? raw.slice(raw.indexOf("?")) : "");
  if (route?.name === "player" && route.playerId) {
    // Save the landing entry before the player is selected, so Back returns here.
    prepareDeskPush();
    state.ranks.selectedId = `player:${route.playerId}`;
    document.querySelector("#landing")?.classList.add("hidden");
    renderRankSurfaces();
    if (!rankValuesReady() || !playerNoteContext?.previousSeason) void ensureRankExtras();
    updateUrlState({ mode: "push" });
    syncLaunchChrome();
    syncDocumentMeta();
    window.scrollTo(0, 0);
    return;
  }
  if (route?.name === "trade") {
    applyTradeRoute(route);
    openRoom("trades", "calculator", { history: "push", scroll: "top" });
    syncLaunchChrome();
  }
}

function handleLaunchClick(event) {
  const row = event.target?.closest?.("a.launch-row");
  const hit = event.target?.closest?.("[data-launch]");
  const node = hit || row;
  if (!node) return;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button) return;
  const kind = hit?.getAttribute?.("data-launch") || "";
  if (!kind && !row) return;
  event.preventDefault();
  if (kind === "example") openExampleTrade();
  else if (kind === "empty") openEmptyTrade();
  else if (kind === "players") openPlayerBoard({ history: "push" });
  else if (kind === "connect") openLaunchConnect();
  else if (kind === "retry") void bootLaunchSurface();
  else if (row) openLaunchPlayer(row.getAttribute("href"));
}

function afterFirstPaint(fn) {
  const run = () => {
    try {
      fn();
    } catch (err) {
      console.warn(err);
    }
  };
  if (typeof requestAnimationFrame !== "function") {
    run();
    return;
  }
  requestAnimationFrame(() => {
    if (typeof requestIdleCallback === "function") requestIdleCallback(run, { timeout: 1200 });
    else requestAnimationFrame(run);
  });
}

async function bootLaunchSurface() {
  syncLaunchChrome();
  if (connectAsked) revealLaunchConnect();
  afterFirstPaint(() => {
    void loadLaunchSurface();
  });
}

async function loadLaunchSurface() {
  try {
    await ensureValuesLoaded("");
    if (!state.leagueId) {
      const bundle = launchValueBundle();
      if (bundle?.values) {
        state.values = bundle.values;
        state.valueNameMap = bundle.nameMap || {};
      }
    }
    relabelDraftNames();
    paintLaunchExample();
  } catch (err) {
    console.warn("Launch values did not load", err);
    const host = document.querySelector("#launch-example");
    if (host) {
      host.innerHTML = launchErrorMarkup();
      host.setAttribute("aria-busy", "false");
    }
  }
  let trendFailed = false;
  try {
    const adds = await apiGetWithRetry("/players/nfl/trending/add?lookback_hours=168&limit=25", { timeoutMs: 9000, retries: 1 });
    state.launchTrending = Array.isArray(adds) ? adds : [];
  } catch {
    state.launchTrending = [];
    trendFailed = true;
  }
  paintLaunchTrend(trendFailed);
  syncLaunchChrome();
}

function relabelDraftNames() {
  const map = state.valueNameMap || {};
  const draft = state.valueCalc;
  if (!draft) return;
  const fix = (items) => (items || []).map((item) => {
    const name = map[item.assetId];
    if (!name || (item.name && item.name !== item.assetId)) return item;
    return { ...item, name };
  });
  const left = fix(draft.left);
  const right = fix(draft.right);
  const changed = left.some((item, index) => item !== draft.left[index]) || right.some((item, index) => item !== draft.right[index]);
  if (!changed) return;
  state.valueCalc = { ...draft, left, right };
}

function buildShareUrl(overrides = {}) {
  const page = normalizeDeskTab(overrides.tab) || state.activePage;
  const room = overrides.view || getRoom(page);
  const week = room === "awards"
    ? state.awardsWeek || state.homeWeek
    : state.homeWeek;
  const playerId = overrides.playerId ?? routedPlayerId();
  const href = pathForPlace({
    page,
    room,
    playerId,
    playerName: routedPlayerName(),
    leagueId: state.leagueId,
    give: draftSideIds("left"),
    get: draftSideIds("right"),
    shareCode: activeShareCode(),
    landing: landingVisible(),
  });
  if (href) return `${overrides.origin ?? window.location.origin}${href}`;
  return buildShareUrlFromParts({
    origin: overrides.origin ?? window.location.origin,
    pathname: "/",
    leagueId: state.leagueId,
    sample: state.viewingSample,
    meRosterId: state.meRosterId,
    tab: page,
    view: room,
    week: overrides.week ?? week,
    asset: playerId ? "" : (room === "ranks" ? state.ranks?.selectedId : ""),
  });
}

function goLeagueHome() {
  if (!state.leagueId) {
    document.querySelector("#landing")?.scrollIntoView({ behavior: "smooth", block: "start" });
    el.landingUsername?.focus();
    return;
  }
  openRoom("league", "team");
}

function goSiteHome({ history = "push" } = {}) {
  state.ranks.selectedId = "";
  document.querySelector("#landing")?.classList.remove("hidden");
  if (history === "push") prepareDeskPush();
  setRoom("trades", "calculator");
  setActivePage("trades", { history, scroll: "top", prepared: history === "push" });
}

function isPhoneLayout() {
  return window.matchMedia(PHONE_LAYOUT_QUERY).matches;
}

function readDeskBoardShut() {
  try {
    return localStorage.getItem(BOARD_STORAGE_KEY) === "shut";
  } catch {
    return document.documentElement.classList.contains("desk-shut");
  }
}

function setDeskBoardShut(shut) {
  const next = Boolean(shut);
  document.documentElement.classList.toggle("desk-shut", next);
  el.deskBoardOpen?.setAttribute("aria-expanded", String(!next));
  if (next) el.deskBoardClose?.setAttribute("tabindex", "-1");
  else el.deskBoardClose?.removeAttribute("tabindex");
  if (!isPhoneLayout() && el.controlRail) {
    if (next) el.controlRail.setAttribute("inert", "");
    else el.controlRail.removeAttribute("inert");
  }
  try {
    localStorage.setItem(BOARD_STORAGE_KEY, next ? "shut" : "open");
  } catch {
    // The board still shuts for this visit.
  }
}

function setMobileRailOpen(open, { history = "auto" } = {}) {
  const shouldOpen = Boolean(open) && isPhoneLayout();
  const wasOpen = document.body.classList.contains("rail-open");
  if (!shouldOpen && wasOpen && history !== "silent" && closeHistoryOverlay("rail")) return;
  if (shouldOpen && !wasOpen && history !== "silent" && !applyingHistory) prepareDeskPush();
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
  if (shouldOpen) el.mobileRailClose?.removeAttribute("tabindex");
  else el.mobileRailClose?.setAttribute("tabindex", "-1");
  syncSiteDock();
  if (history === "silent" || applyingHistory) return;
  if (shouldOpen && !wasOpen) updateUrlState({ mode: "push" });
  else if (!shouldOpen && wasOpen) updateUrlState({ mode: "replace" });
}

function scrollChildIntoStrip(strip, child) {
  if (!strip || !child || typeof strip.getBoundingClientRect !== "function") return;
  const parentRect = strip.getBoundingClientRect();
  const childRect = child.getBoundingClientRect();
  if (childRect.left >= parentRect.left + 8 && childRect.right <= parentRect.right - 8) return;
  if (typeof strip.scrollTo !== "function") return;
  const delta = childRect.left - parentRect.left - (parentRect.width - childRect.width) / 2;
  strip.scrollTo({ left: (Number(strip.scrollLeft) || 0) + delta, behavior: "auto" });
}

function scrollActiveTabIntoView() {
  const active = [...(el.pageTabButtons || [])].find((button) => button.classList.contains("active"));
  scrollChildIntoStrip(el.pageTabs, active);
}

function sampleViewingLine() {
  return "Sample league";
}

function syncDeskRailOffset() {
  const rail = el.controlRail;
  if (!rail || isPhoneLayout()) return;
  const height = Math.ceil(rail.getBoundingClientRect().height);
  if (height > 0) document.documentElement.style.setProperty("--desk-rail-height", `${height}px`);
}

function guestRouteHeading() {
  const path = String(window.location.pathname || "/").replace(/\/+$/, "") || "/";
  if (path === "/trade" || path === "/players" || state.activePage === "trades") return "Check a trade";
  return "Dynasty Ticker";
}

function routeHeadingText() {
  if (state.leagueId && state.activePage === "league") {
    const labels = {
      team: "My team",
      board: "League",
      scores: "This week",
      activity: "Activity",
      history: "History",
    };
    if (labels[getRoom()]) return labels[getRoom()];
  }
  return guestRouteHeading();
}

function renderSessionSnapshot() {
  rebindUsernameInputs();
  const sampleOn = Boolean(state.viewingSample && state.leagueId);
  const you = getMyRoster()?.manager?.displayName || "";
  document.body.classList.toggle("league-loaded", Boolean(state.leagueId));
  document.body.classList.toggle("viewing-sample", sampleOn);
  if (state.leagueSwitching) {
    if (el.mobileChromeTitle) el.mobileChromeTitle.textContent = "Loading league…";
    if (el.chromeLeagueLabel) el.chromeLeagueLabel.textContent = "Loading…";
    if (el.chromeManagerLabel) el.chromeManagerLabel.textContent = "—";
    if (el.chromeModeLabel) el.chromeModeLabel.textContent = "—";
    renderLeagueHero();
    syncDocumentMeta();
    syncSiteDock();
    return;
  }
  // Cold /t/<code>: no "Your Sleeper league" subtitle under the wordmark.
  const coldShare = !state.leagueId && /^\/t\//.test(window.location.pathname);
  document.body.classList.toggle("cold-share", coldShare);
  if (el.mobileChromeTitle) el.mobileChromeTitle.hidden = coldShare;
  if (el.mobileChromeTitle && !coldShare) {
    el.mobileChromeTitle.textContent = sampleOn
        ? (state.leagueName || "Sample league")
        : state.leagueName
          ? (you ? `${you} · ${state.leagueName}` : state.leagueName)
          : guestRouteHeading();
  }
  if (el.routeTitle) el.routeTitle.textContent = routeHeadingText();
  if (el.mobileChromeViewing) {
    el.mobileChromeViewing.hidden = !sampleOn;
    el.mobileChromeViewing.textContent = sampleOn ? sampleViewingLine(you) : "";
  }
  document.querySelectorAll("[data-sample-chip]").forEach((chip) => {
    chip.hidden = !sampleOn;
  });
  if (el.sampleChrome) el.sampleChrome.hidden = !sampleOn;
  if (el.sampleChromeTitle) el.sampleChromeTitle.textContent = sampleOn ? (state.leagueName || "Sample league") : "";
  if (el.sampleChromeViewing) el.sampleChromeViewing.textContent = sampleOn ? sampleViewingLine(you) : "";
  if (el.sampleBanner) el.sampleBanner.hidden = !sampleOn || sampleBannerDismissed(sampleBannerOff);
  document.querySelectorAll("[data-sample-find]").forEach((button) => {
    button.hidden = !sampleConnectEntryVisible({ sampleOn, bannerDismissed: sampleBannerOff });
  });
  if (el.chromeLeagueLabel) {
    el.chromeLeagueLabel.textContent = state.leagueName || "Not loaded";
  }
  if (el.chromeManagerLabel) {
    el.chromeManagerLabel.textContent = sampleOn ? sampleViewingLine(you) : (you || "Select team");
  }
  if (el.chromeModeLabel) {
    el.chromeModeLabel.textContent = state.leagueId ? describeSeasonWeek() : "—";
  }
  renderLeagueHero();
  syncDocumentMeta();
  syncSiteDock();
  requestAnimationFrame(syncDeskRailOffset);
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
  if (state.leagueSwitching) {
    el.heroEyebrow.textContent = "Sleeper";
    el.heroTitle.textContent = "Loading league…";
    el.heroLede.textContent = "Pulling this league from Sleeper.";
    if (el.leagueAvatar) el.leagueAvatar.innerHTML = brandMarkAvatarHtml();
    return;
  }
  if (!state.leagueId || !state.league) {
    el.heroEyebrow.textContent = "Sleeper dynasty league";
    el.heroTitle.textContent = "Your Sleeper league";
    el.heroLede.textContent = "Type a username. Scores open first.";
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
  const roomLabel = room === HOME_ROOM ? "" : deskRoomLabel(state.activePage, room);
  el.heroEyebrow.textContent = `${pageLabel}${roomLabel ? ` / ${roomLabel}` : ""} · ${seasonLabel} · ${state.normalizedRosters.length} teams · ${model?.playoffTeams || league?.settings?.playoff_teams || "?"} playoff spots`;
  el.heroTitle.textContent = state.leagueName;
  const status = model?.seasonComplete
    ? "Season complete. The archive, awards, and record book are final."
    : !state.seasonLoaded
      ? "Matchups are syncing from Sleeper."
      : model?.currentWeekEntry?.isLive
        ? `Week ${model.currentWeek} is live. Scores, win probability, and playoff odds update as Sleeper posts points.`
        : model?.scheduleIncomplete
          ? "Odds update after this week's games."
          : model
            ? `Week ${model.currentWeek} is next. ${model.remainingGames.length} regular-season games left before the playoffs start in Week ${model.playoffStart}.`
            : "Matchups are syncing.";
  const sampleNote = state.viewingSample ? (sampleVoice()?.accountNote || "Public sample — not this account. ") : "";
  const formatTip = tepLevel(league) > 0
    ? ` ${infoTipMarkup({ id: "pop-hero-format", label: "Scoring", text: "Values use 1 point per catch at every position, even with the TE bonus." })}`
    : "";
  el.heroLede.innerHTML = `${escapeHtml(`${sampleNote}${format}. ${status}${trophy ? ` Reigning champion banner: "${trophy}".` : ""}`)}${formatTip}`;
  if (el.leagueAvatar) {
    const leagueAvatarSrc = sleeperAvatarUrl(league.avatar);
    el.leagueAvatar.innerHTML = leagueAvatarSrc
      ? `<img src="${escapeHtml(leagueAvatarSrc)}" alt="${escapeHtml(state.leagueName || "League")} logo" loading="lazy" />`
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
  renderRoomNav();
  renderPhoneDesk();
}

function isActiveNavTab(button) {
  return button.dataset.page === state.activePage && button.dataset.room === getRoom(state.activePage);
}

function renderRoomNav() {
  el.pageTabButtons?.forEach((button) => {
    const isActive = isActiveNavTab(button);
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-selected", String(isActive));
    button.tabIndex = isActive ? 0 : -1;
  });
  scrollActiveTabIntoView();
  syncRouteAriaCurrent();
}

function renderPhoneDesk() {
  if (!el.phoneDesk) return;
  el.phoneDesk.innerHTML = NAV_TABS.map((tab) => {
    const active = tab.page === state.activePage && tab.room === getRoom(tab.page);
    return `
      <button type="button" class="phone-desk-room${active ? " active" : ""}" data-phone-room="${escapeHtml(tab.room)}" data-page="${escapeHtml(tab.page)}">
        <strong>${escapeHtml(tab.label)}</strong>
        <small>${escapeHtml(tab.hint)}</small>
      </button>
    `;
  }).join("");
  syncRouteAriaCurrent();
}

function leavePhoneMenu(navigate) {
  const mode = historyModeAfterMenuChoice(history.state || {});
  setMobileRailOpen(false, { history: "silent" });
  navigate(mode);
  if (mode !== "replace" || typeof history.replaceState !== "function") return;
  const next = history.state || {};
  history.replaceState({
    ...next,
    pushed: true,
    overlay: next.overlay === "rail" ? "" : next.overlay,
  }, "", `${window.location.pathname}${window.location.search}`);
}

function scrollMotion() {
  const reduce = typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return reduce ? "auto" : "smooth";
}

function scrollCheckOfferIntoView() {
  const target = document.querySelector("#trades-page [data-room-panel='calculator']")
    || document.querySelector("#calculator-section");
  if (!target || typeof target.scrollIntoView !== "function") return;
  target.scrollIntoView({ behavior: scrollMotion(), block: "start" });
}

function handlePhoneDeskClick(event) {
  const roomButton = event.target.closest("[data-phone-room]");
  if (!roomButton) return;
  const page = roomButton.dataset.page;
  const room = roomButton.dataset.phoneRoom;
  document.querySelector("#landing")?.classList.add("hidden");
  leavePhoneMenu((mode) => {
    openRoom(page, room, { history: mode, scroll: "top" });
    if (page === "trades" && room === "calculator") scrollCheckOfferIntoView();
  });
}

function sampleVoice() {
  if (!state.viewingSample) return null;
  return sampleRosterLabels({
    viewingSample: true,
    ownerName: getMyRoster()?.manager?.displayName || "",
  });
}

function deskRoomLabel(page, room) {
  const voice = sampleVoice();
  if (voice && page === "league" && room === HOME_ROOM) return voice.teamTab;
  return roomLabelFor(page, room, state.league) || room || "";
}

function collapseLeaguePicker() {
  [el.leaguePicker, el.landingLeaguePicker].forEach((host) => {
    if (!host) return;
    host.classList.add("hidden");
    host.replaceChildren();
  });
  syncDeskRailOffset();
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
  const classified = classifyLeagueField(el.leagueId?.value, el.sleeperUsername?.value);
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

function retryUserLeagueSearch() {
  if (userSearchRecovery.retry()) return;
  const landingName = String(el.landingUsername?.value || "").trim();
  const railName = String(el.sleeperUsername?.value || "").trim();
  syncUsernameFields(landingName && !railName ? el.landingUsername : el.sleeperUsername);
  requestFindLeagues();
}

function requestFindLeagues(event) {
  event?.preventDefault?.();
  if (bootIsPending()) {
    const fromLanding = event?.currentTarget === el.landingUsernameForm || event?.target?.id === "landing-username";
    const source = fromLanding ? el.landingUsername : (event?.target?.id === "sleeper-username" ? el.sleeperUsername : null);
    if (source && String(source.value || "").length) syncUsernameFields(source);
    queueFindForBoot(String(source?.value || el.sleeperUsername?.value || el.landingUsername?.value || ""));
    return;
  }
  syncUsernameFields(event?.currentTarget === el.landingUsernameForm ? el.landingUsername : el.sleeperUsername);
  const classified = classifyUsernameField(el.sleeperUsername?.value || el.landingUsername?.value);
  if (classified.kind === "empty") {
    setUsernameError("Type your Sleeper username, then press Connect my league.");
    setStatus("Type your Sleeper username, then press Connect my league.", { error: true });
    (el.landingUsername || el.sleeperUsername)?.focus();
    return;
  }
  setUsernameError("");
  if (classified.kind === "league") {
    if (el.leagueId) el.leagueId.value = classified.leagueId;
    void loadLeagueById(classified.leagueId);
    return;
  }
  return searchUserLeagues(classified.username);
}

function syncPlayerConnectSlot(host, view) {
  const anchor = host?.closest?.("#ranks-section, #public-ranks") || host;
  if (!anchor) return;
  let slot = anchor.querySelector(":scope > [data-player-connect-slot]");
  if (!slot) {
    slot = document.createElement("div");
    slot.setAttribute("data-player-connect-slot", "");
    anchor.prepend(slot);
  }
  const want = Boolean(view?.card && !view.leagueOpen && !view.loading);
  if (!want) {
    if (slot.childElementCount) slot.replaceChildren();
    return;
  }
  if (slot.querySelector("[data-player-connect]")) return;
  slot.innerHTML = renderPlayerConnect();
}

async function openPlayerLeagueList(form) {
  const input = form.querySelector("input");
  const name = String(input?.value || "").trim();
  if (!name) {
    input?.focus();
    return;
  }
  if (el.landingUsername) el.landingUsername.value = name;
  syncUsernameFields(el.landingUsername);
  document.querySelector("#landing")?.classList.add("hidden");
  await requestFindLeagues();
  const host = form.closest("[data-player-connect-slot]")?.querySelector("[data-player-league-list]");
  if (!host || !el.landingLeaguePicker) return;
  host.innerHTML = el.landingLeaguePicker.innerHTML;
  const show = Boolean(host.innerHTML.trim()) && !el.landingLeaguePicker.classList.contains("hidden");
  host.hidden = !show;
  host.classList.toggle("hidden", !show);
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
  const token = ++userSearchGeneration;
  userSearchRecovery.clear();
  startFindLeaguesUi();
  missedLeagueSeasons = [];
  setStatus(`Looking up ${username} on Sleeper…`, { loading: true });
  let autoloadId = "";
  try {
    const nflState = await apiGetWithRetry(`/state/nfl`, { timeoutMs: 8000, retries: 1 }).catch(() => state.nflState);
    if (nflState) state.nflState = nflState;
    const season = String(nflState?.league_season || nflState?.season || new Date().getUTCFullYear());
    const { user, leagues, failedSeasons = [] } = await fetchUserLeagues(sleeper, username, uniqueSeasons(season, 1));
    state.sleeperUser = user;
    searchedUserNoted = false;
    state.userLeagues = sortUserLeagues(leagues, season);
    const failed = new Set(failedSeasons.map((item) => String(item)));
    const currentFailed = failed.has(String(season));
    missedLeagueSeasons = [...failed].filter((year) => year !== String(season));
    renderLeaguePicker(state.userLeagues, season);
    if (currentFailed) {
      setUsernameError(seasonSearchHardFailField(season));
      setStatus(seasonSearchHardFailStatus(season), { error: true, retry: true });
    } else if (state.userLeagues.length === 0) {
      setStatus(`Found ${user.display_name || username}, but no NFL leagues for ${season}/${Number(season) - 1}.`, { error: true });
      setUsernameError(`No NFL leagues for ${season}/${Number(season) - 1}.`);
    } else if (state.userLeagues.length === 1) {
      autoloadId = String(state.userLeagues[0].league_id || "");
      if (el.leagueId && autoloadId) el.leagueId.value = autoloadId;
      setUsernameError("");
      setStatus(`One league found. Opening ${state.userLeagues[0].name || "league"}…`, { loading: true });
    } else {
      setUsernameError("");
      setStatus(`Found ${state.userLeagues.length} leagues for ${user.display_name || username}. Pick one.`);
      el.landingLeaguePicker?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  } catch (err) {
    renderLeaguePicker([]);
    const failure = describeUserSearchFailure(err, username);
    setUsernameError(failure.message);
    setStatus(failure.message, { error: true, retry: failure.retry });
    if (failure.retry) userSearchRecovery.fail({ leagueId: username, token });
  } finally {
    stopFindLeaguesUi();
  }
  if (autoloadId) await loadLeagueById(autoloadId);
}

function renderLeaguePicker(leagues, season) {
  const hosts = [...new Set([el.leaguePicker, el.landingLeaguePicker].filter(Boolean))];
  if (!hosts.length) return;
  const list = leagues?.length ? renderLeaguePickerMarkup(leagues, season, state.leagueId) : "";
  const html = `${list}${renderLeagueSearchNote(missedLeagueSeasons)}`;
  hosts.forEach((host) => {
    host.classList.toggle("hidden", !html.trim());
    host.innerHTML = html;
  });
}

function startFindLeaguesUi() {
  [el.findLeaguesBtn, el.landingFindBtn].forEach((button) => {
    if (!button) return;
    button.disabled = true;
    button.setAttribute("aria-disabled", "true");
    button.setAttribute("aria-busy", "true");
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
    button.setAttribute("aria-disabled", "false");
    button.removeAttribute("aria-busy");
    button.style.pointerEvents = "";
    button.classList.remove("loading");
    button.textContent = button.dataset.idleLabel || "Connect my league";
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

function rememberPickedLeague(leagueId) {
  if (applyingHistory || typeof history?.replaceState !== "function") return;
  const nextSearch = stampPickedLeagueSearch(window.location.search, leagueId);
  if (!nextSearch) return;
  // An in-app switch pushes only after the new league loads. Pushing the
  // current league first leaves a duplicate, so the first Back does nothing.
  if (Boolean(state.leagueId) && String(state.leagueId) !== String(leagueId)) return;
  const here = window.location.pathname || "/";
  // Home has no league path. Push the place the manager is already on, or the team.
  // Do not replaceState onto "/".
  if ((here === "/" || here === "") && leagueOpenedInApp && typeof history.pushState === "function") {
    const place = historyPlaceNow();
    const picked = pathForPlace({
      ...place,
      leagueId,
      playerName: routedPlayerName(),
      give: draftSideIds("left"),
      get: draftSideIds("right"),
      shareCode: activeShareCode(),
    });
    const next = picked && picked !== urlPath() ? picked : urlPath("l", leagueId, "team");
    routeFocus.push(routeFocus.consumeArmed() || activeRouteElement());
    history.pushState({ ...place, pushed: true }, "", next);
    return;
  }
  if (leagueOpenedInApp && typeof history.pushState === "function") {
    routeFocus.push(routeFocus.consumeArmed() || activeRouteElement());
    history.pushState({ ...historyPlaceNow(), pushed: true }, "", `${window.location.pathname}${window.location.search}`);
  }
  history.replaceState(history.state, "", `${window.location.pathname}${nextSearch}`);
}

function dropFailedLeagueQuery() {
  if (applyingHistory || typeof history?.replaceState !== "function") return;
  const params = new URLSearchParams(String(window.location.search || "").replace(/^\?/, ""));
  if (!params.has("league")) return;
  params.delete("league");
  const query = params.toString();
  history.replaceState(history.state, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
}

async function loadLeagueById(leagueId, { fromHistory = false, sample = false } = {}) {
  if (!leagueId) return;
  leagueOpenedInApp = Boolean(appBooted) && !fromHistory;
  if (!fromHistory) rememberPickedLeague(leagueId);
  state.viewingSample = Boolean(sample);
  if (shouldBlankDeskForLeagueSwitch(state.leagueId, leagueId)) blankDeskForLeagueSwitch();
  return leagueLoader.run(leagueId, (id, token) => runLeagueLoad(id, token, { fromHistory }));
}

function unloadLeague() {
  leagueLoader.drop();
  stopLivePolling();
  stopLeagueLoadingUi();
  state.leagueSwitching = false;
  state.leagueId = "";
  state.leagueName = "";
  state.league = null;
  state.viewingSample = false;
  state.users = [];
  state.rosters = [];
  state.normalizedRosters = [];
  state.previousLeague = null;
  state.previousUsers = [];
  state.previousRosters = [];
  state.leagueHistory = [];
  state.meRosterId = null;
  state.mePickedByUser = false;
  state.pendingPlace = null;
  state.transactions = [];
  state.transactionsLoaded = false;
  el.identitySection?.classList.add("hidden");
  document.body.classList.remove("league-loaded", "viewing-sample");
  renderSessionSnapshot();
}

function blankDeskForLeagueSwitch() {
  state.leagueSwitching = true;
  pageRenderQueue.settle();
  stopLivePolling();
  invalidatePlayerLoads();
  startLeagueLoadingUi();
  hideAppPages();
  el.identitySection?.classList.add("hidden");
  renderSessionSnapshot();
}

async function runLeagueLoad(leagueId, token, { fromHistory = false } = {}) {
  try {
    if (!leagueLoader.isCurrent(token)) return;
    leagueLoadRecovery.clear();
    paintLeagueLoadError("");
    startLeagueLoadingUi();
    stopLivePolling();
    invalidatePlayerLoads();
    hideAppPages();

    const [coreData, nflState] = await Promise.all([
      loadLeagueCoreData(leagueId),
      apiGetWithRetry(`/state/nfl`, { timeoutMs: 8000, retries: 1 }).catch(() => null),
    ]);
    if (!leagueLoader.isCurrent(token)) return;
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
    const draftLoad = await loadCurrentSeasonDraftContext(leagueId, league, rosters, drafts);
    if (!leagueLoader.isCurrent(token)) return;

    const sameLeague = String(state.leagueId || "") === String(leagueId);
    // Switching leagues is a new place, so Back returns to the league you left.
    const switchingLeagues = Boolean(state.leagueId) && !sameLeague && !fromHistory;
    const keepPlace = placeAfterConnect({
      activePage: state.activePage,
      tradesRoom: getRoom("trades"),
      selectedAssetId: state.ranks?.selectedId || "",
      pendingPlace: state.pendingPlace,
    });
    if (switchingLeagues && typeof history?.pushState === "function") {
      prepareDeskPush();
      routeFocus.push(routeFocus.consumeArmed() || activeRouteElement());
      history.pushState(history.state, "", `${window.location.pathname}${window.location.search}`);
    }
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
    state.playerMetadataFailed = false;
    if (!sameLeague) {
      state.activePage = DEFAULT_PAGE;
      state.rooms = { ...DEFAULT_ROOMS };
      state.meRosterId = null;
      state.mePickedByUser = false;
      if (el.meSelect) el.meSelect.innerHTML = "";
      state.homeWeek = null;
      state.awardsWeek = null;
    }
    franchiseIndexCache = { key: "", index: null };
    state.transactions = [];
    state.transactionsLoaded = false;
    state.transactionsFailed = false;
    state.transactionWeeksLoaded = 0;
    state.transactionLoadError = "";
    state.leagueHistory = [];
    state.historyTransactions = [];
    state.historyTransactionsLoaded = false;
    state.historyTransactionsFailed = false;
    state.historyTransactionLeaguesLoaded = 0;
    state.historyTransactionLoadError = "";
    resetHistoryCompareState();
    resetSeasonState();
    state.nflState = nflState;
    state.lensRosterId = null;
    state.selectedTradeId = "";
    state.selectedTradeManagerKey = "";
    leagueTradeSideCache = { key: "", sides: [] };
    state.standingsView = "overall";
    if (!sameLeague) forgetDraftPartner();
    clearTradeMatchCache();
    (draftLoad?.ingested || []).forEach((row) => {
      ingestDraftSelections(row.season, row.draftDetails, row.picks, row.rosters);
    });

    state.leagueId = leagueId;
    state.leagueName = league?.name || `League ${leagueId}`;
    state.league = league;
    state.users = users;
    state.rosters = rosters;
    state.tradedPicks = tradedPicks;
    state.currentDraftContext = draftLoad?.context || null;
    state.players = seedPlayerDirectory();
    state.playerMetadataLoaded = Object.keys(state.players).length > 0;
    state.previousLeague = previousContext.league;
    state.previousUsers = previousContext.users;
    state.previousRosters = previousContext.rosters;
    state.leagueHistory = leagueHistory;
    state.normalizedRosters = normalizeRosters(league, rosters, users, state.players, previousContext, tradedPicks, state.currentDraftContext);
    state.leagueSwitching = false;
    collapseLeaguePicker();
    setLeagueSwitchStale(false);

    setFieldError(el.leagueId, el.leagueIdError, "");
    // No URL write yet: the landing is still showing, so it would replace the
    // route with "/" for a moment (an extra "/" pageview and landing_view).
    // showAppPages below writes the real route.
    hydrateManagerSelector({ syncUrl: false });
    renderSessionSnapshot();
    el.identitySection?.classList.remove("hidden");
    if (state.pendingWeek) {
      state.homeWeek = state.pendingWeek;
      state.awardsWeek = state.pendingWeek;
      state.pendingWeek = null;
    }
    if (keepPlace) state.pendingPlace = keepPlace;
    primeValuationData();
    if (!leagueLoader.isCurrent(token)) return;
    setMobileRailOpen(false, { history: "silent" });
    showAppPages();
    noteSearchedUser(leagueId);
    analyticsTrack("league_connected", { sample: state.viewingSample ? "yes" : "no" });
    scrollLoadedWorkspaceIntoView();
    const missingTeam = state.meRosterId ? "" : noTeamInLeagueCopy(state.sleeperUser);
    setStatus(
      missingTeam || (state.viewingSample
        ? (sampleVoice()?.statusSample || "Sample league — not this account.")
        : `Loaded ${state.leagueName}.`),
      missingTeam ? { error: true } : { loading: true },
    );
    loadTrendingPlayers();

    const playersEpoch = playerLoadEpoch;
    loadPlayersWithCache()
      .then((players) => {
        if (playersLoadStale(playersEpoch, token, leagueId)) return;
        commitPlayerDirectory(players, { epoch: playersEpoch, leagueId, hydrate: true });
        const me = getMyRoster();
        const missingTeam = me ? "" : noTeamInLeagueCopy(state.sleeperUser);
        setStatus(
          missingTeam
            ? missingTeam
            : me
              ? state.viewingSample
                ? `${sampleVoice()?.statusSample || "Sample league — not this account."} Viewing as ${me.manager?.displayName || "a roster"}; switch in Manager.`
                : `Loaded ${state.leagueName}. Viewing as ${me.manager?.displayName || "your team"}. Switch teams in the Manager panel.`
              : `Loaded ${state.leagueName}. Choose your team to continue.`,
          missingTeam ? { error: true } : { ok: true },
        );
      })
      .catch((err) => {
        if (playersLoadStale(playersEpoch, token, leagueId) || err?.name === "AbortError") return;
        // Value names are not the Sleeper directory. A roster that still has
        // a missing name or position stays failed when both player files are blocked.
        const gaps = state.normalizedRosters.some((roster) => (roster.assets || []).some((asset) => {
          const gap = assetMetadataGap(asset);
          return gap.name || gap.position;
        }));
        if (!gaps && Object.keys(state.players).length > 0) {
          console.warn("Could not refresh NFL player metadata", err);
          return;
        }
        state.playerMetadataLoaded = false;
        state.playerMetadataFailed = true;
        requestActivePageRender();
        setStatus(
          `Loaded ${state.leagueName}, but could not pull full NFL names (${err.message}). You can still use the app.`,
          { ok: true }
        );
      });
  } catch (err) {
    if (!leagueLoader.isCurrent(token)) return;
    state.leagueSwitching = false;
    state.pendingPlace = null;
    const season = String(state.nflState?.league_season || state.nflState?.season || "");
    renderLeaguePicker(state.userLeagues, season);
    const failedSwitch = failedLeagueSwitch({
      currentLeagueId: state.leagueId,
      nextLeagueId: leagueId,
    });
    if (isLeagueNotFound(err) && !failedSwitch) {
      showLeagueNotFound();
      return;
    }
    hideLeagueNotFound();
    const message = failedSwitch
      ? leagueSwitchFailureCopy({
          leagueId,
          leagueName: leagueNameForId(state.userLeagues, leagueId),
        })
      : leagueLoadErrorMessage(err);
    const unreachable = message === SLEEPER_UNREACHABLE_MESSAGE;
    setFieldError(el.leagueId, el.leagueIdError, unreachable || failedSwitch ? "" : message);
    setStatus(unreachable || failedSwitch ? "" : message, { error: true });
    leagueLoadRecovery.fail({ leagueId, token, sample: state.viewingSample });
    paintLeagueLoadError(message);
    if (state.league) {
      showAppPages();
    }
    setLeagueSwitchStale(failedSwitch);
    // An outage stays on /l/… Back can return to the league that already loaded.
    // Any other dead league url still goes home.
    if (!unreachable && !state.leagueId && String(window.location.pathname || "").startsWith("/l/") && typeof history?.replaceState === "function") {
      history.replaceState({ ...historyPlaceNow(), pushed: false }, "", urlPath());
      syncDocumentMeta();
    }
  } finally {
    if (leagueLoader.isCurrent(token)) stopLeagueLoadingUi();
  }
}

function resetSeasonState() {
  state.nflState = null;
  state.seasonWeekRows = new Map();
  state.seasonLoaded = false;
  state.seasonLoadError = "";
  state.pickProjectionReady = false;
  projectedPickKey = "";
  projectedPlaceState = { key: "", lookup: null };
  invalidateSeasonCaches();
}

// Matchup chunks update the standings table. They do not reprice picks.
// A complete roster W-L table publishes the slots on the first paint.
function settlePickProjection() {
  if (state.pickProjectionReady) return;
  state.pickProjectionReady = true;
  projectedPickKey = "";
  projectedPlaceState = { key: "", lookup: null };
}

function invalidateSeasonCaches() {
  state.seasonModelCache = { key: "", model: null };
  state.simCache = { key: "", result: null };
}

function valuationCacheVersion() {
  const sourceVersion = state.valueBundles?.asOf
    || state.valueBundles?.modelVersion
    || "local";
  return `${sourceVersion}:${Number(state.valuationRevision || 0)}`;
}

function simSignature(model) {
  if (!model) return "";
  return [
    state.leagueId,
    model.finalThroughWeek,
    model.remainingGames.length,
    model.scheduleIncomplete ? 1 : 0,
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

function handleLiveVisibility() {
  if (!livePoller?.running) return;
  if (!document.hidden) livePoller.resume();
}

async function loadLeagueCoreData(leagueId) {
  const endpointPlan = [
    { key: "league", label: "league profile", path: sleeperLeaguePath(leagueId) },
    { key: "users", label: "league managers", path: sleeperLeaguePath(leagueId, "users") },
    { key: "rosters", label: "league rosters", path: sleeperLeaguePath(leagueId, "rosters") },
    { key: "tradedPicks", label: "traded picks", path: sleeperLeaguePath(leagueId, "traded_picks"), optional: true },
    { key: "drafts", label: "league drafts", path: sleeperLeaguePath(leagueId, "drafts"), optional: true },
    { key: "winnersBracket", label: "playoff bracket", path: sleeperLeaguePath(leagueId, "winners_bracket"), optional: true },
    { key: "losersBracket", label: "consolation bracket", path: sleeperLeaguePath(leagueId, "losers_bracket"), optional: true },
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

  if (sleeperLeagueMissing(settled[0])) throw leagueNotFoundError(leagueId);

  if (failures.length > 0) {
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

async function loadCurrentSeasonDraftContext(leagueId, league, rosters, drafts = []) {
  const candidateIds = buildCurrentDraftDetailCandidateIds(league, drafts);
  const ingested = [];
  let context = null;
  for (const draftId of candidateIds) {
    try {
      const [draftDetails, draftPicks] = await Promise.all([
        apiGetWithRetry(`/draft/${draftId}`, { timeoutMs: 12000, retries: 1 }),
        apiGetWithRetry(`/draft/${draftId}/picks`, { timeoutMs: 12000, retries: 1 }).catch(() => []),
      ]);
      const picks = Array.isArray(draftPicks) ? draftPicks : [];
      ingested.push({
        season: draftDetails?.season || league?.season,
        draftDetails,
        picks,
        rosters,
      });
      if (!context) context = buildCurrentDraftContext(league, rosters, draftDetails, picks);
      if (context) break;
    } catch (err) {
      console.warn(`Could not load draft details for ${draftId}`, err);
    }
  }

  return { context, ingested };
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
  let olderLeagueId = previousLeagueId(currentCoreData?.league?.previous_league_id);

  for (let depth = 1; depth < MAX_HISTORY_SEASONS && olderLeagueId; depth += 1) {
    const historyLeagueId = olderLeagueId;
    if (seenLeagueIds.has(historyLeagueId)) break;
    seenLeagueIds.add(historyLeagueId);

    try {
      setStatus(`Loading league archive season ${depth + 1}...`, { loading: true });
      const historicalCore = await loadLeagueCoreData(historyLeagueId);
      entries.push(buildLeagueHistoryEntry(historyLeagueId, historicalCore, false));
      olderLeagueId = previousLeagueId(historicalCore?.league?.previous_league_id);
    } catch (err) {
      console.warn(`Could not load historical league ${historyLeagueId}`, err);
      break;
    }
  }

  return entries;
}

function invalidatePlayerLoads() {
  playerLoadEpoch += 1;
  playerLoadAbort?.abort();
  playerLoadAbort = null;
  playersInflight = null;
  playersInflightEpoch = -1;
}

function playersLoadStale(epoch, token, leagueId) {
  return epoch !== playerLoadEpoch
    || !leagueLoader.isCurrent(token)
    || String(state.leagueId) !== String(leagueId);
}

function cancelledPlayerLoad() {
  const error = new Error("Players load cancelled");
  error.name = "AbortError";
  return error;
}

function playersCacheAdapters() {
  if (!playersIdb) playersIdb = createPlayersIdb();
  return {
    localStorage: globalThis.localStorage,
    idb: playersIdb,
    key: PLAYERS_CACHE_KEY,
  };
}

function createPlayersIdb() {
  const dbName = "dynasty-ticker";
  const storeName = "kv";
  let opening = null;
  function open() {
    if (opening) return opening;
    opening = new Promise((resolve, reject) => {
      if (typeof indexedDB === "undefined" || typeof indexedDB.open !== "function") {
        reject(new Error("IndexedDB unavailable"));
        return;
      }
      const request = indexedDB.open(dbName, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(storeName)) db.createObjectStore(storeName);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("IndexedDB open failed"));
    });
    return opening;
  }
  return {
    async get(key) {
      const db = await open();
      return new Promise((resolve, reject) => {
        const request = db.transaction(storeName, "readonly").objectStore(storeName).get(key);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error || new Error("IndexedDB read failed"));
      });
    },
    async set(key, value) {
      const db = await open();
      return new Promise((resolve, reject) => {
        const request = db.transaction(storeName, "readwrite").objectStore(storeName).put(value, key);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error || new Error("IndexedDB write failed"));
      });
    },
  };
}

async function loadPlayersWithCache() {
  if (playersInflight && playersInflightEpoch === playerLoadEpoch) return playersInflight;
  const epoch = playerLoadEpoch;
  playerLoadAbort?.abort();
  const controller = new AbortController();
  playerLoadAbort = controller;
  const job = fetchPlayersForCache(epoch, controller.signal);
  playersInflight = job;
  playersInflightEpoch = epoch;
  try {
    return await job;
  } finally {
    if (playersInflight === job) playersInflight = null;
    if (playerLoadAbort === controller) playerLoadAbort = null;
  }
}

function seedPlayerDirectory() {
  const names = {
    ...(state.valueBundles?.names || {}),
    ...(state.valueNameMap || {}),
  };
  const fromValues = playersFromValueSnapshot(state.valueBundles?.players, names);
  const fromSlim = slimDirectory || {};
  return mergePlayerRecords(mergePlayerRecords(fromValues, fromSlim), state.players);
}

function commitPlayerDirectory(players, { failed = false, epoch = playerLoadEpoch, leagueId = state.leagueId, hydrate = false } = {}) {
  if (epoch !== playerLoadEpoch) return;
  if (leagueId && state.leagueId && String(leagueId) !== String(state.leagueId)) return;
  state.players = mergePlayerRecords(state.players, players);
  if (Object.keys(state.players).length > 0) {
    state.playerMetadataLoaded = true;
    state.playerMetadataFailed = false;
  } else if (failed) {
    state.playerMetadataLoaded = false;
    state.playerMetadataFailed = true;
  }
  if (!state.league || !state.rosters?.length) return;
  refreshPlayerPositionRanks();
  state.normalizedRosters = normalizeRosters(state.league, state.rosters, state.users, state.players, {
    league: state.previousLeague,
    users: state.previousUsers,
    rosters: state.previousRosters,
  }, state.tradedPicks, state.currentDraftContext);
  invalidateSeasonCaches();
  if (hydrate) hydrateManagerSelector();
  requestActivePageRender();
}

function loadSlimPlayersFile() {
  if (slimDirectory && Object.keys(slimDirectory).length) return Promise.resolve(slimDirectory);
  if (!slimDirectoryPromise) {
    slimDirectoryPromise = fetch(NFL_PLAYERS_SLIM_PATH, { cache: "default" })
      .then((response) => (response?.ok ? response.json() : null))
      .then((payload) => {
        const players = playersFromSlimFile(payload);
        if (!Object.keys(players).length) {
          // An empty or blocked file must not stick, so Retry can fetch it again.
          slimDirectoryPromise = null;
          return players;
        }
        slimDirectory = players;
        if (state.leagueId) commitPlayerDirectory(players, { hydrate: false });
        return players;
      })
      .catch((err) => {
        console.warn("Could not load slim player file", err);
        slimDirectoryPromise = null;
        return null;
      });
  }
  return slimDirectoryPromise;
}

function scheduleQuietPlayerRefresh(epoch, signal) {
  const timer = setTimeout(() => {
    if (signal.aborted || epoch !== playerLoadEpoch) return;
    void refreshPlayersQuietly(epoch, signal);
  }, 4000);
  signal.addEventListener?.("abort", () => clearTimeout(timer), { once: true });
}

async function refreshPlayersQuietly(epoch, signal) {
  let stateKey = null;
  let stateFailed = false;
  try {
    const nflState = await apiGetWithRetry(`/state/nfl`, { timeoutMs: 8000, retries: 1, signal });
    stateKey = `${nflState?.season || "na"}-${nflState?.league_season || "na"}-${nflState?.week || "na"}`;
  } catch (err) {
    if (err?.name === "AbortError" || signal.aborted || epoch !== playerLoadEpoch) return;
    stateFailed = true;
  }
  if (signal.aborted || epoch !== playerLoadEpoch) return;
  const fromCache = await loadPlayersCacheEntry(playersCacheAdapters()).catch(() => null);
  const now = Date.now();
  const fresh = stateFailed
    ? playersCacheIsFresh(fromCache, now, { ttlMs: PLAYERS_CACHE_TTL_MS })
    : playersCacheIsFresh(fromCache, now, { stateKey, ttlMs: PLAYERS_CACHE_TTL_MS });
  if (fresh) return;
  try {
    const raw = await apiGetWithRetry(`/players/nfl`, {
      timeoutMs: 30000,
      retries: 1,
      cache: "default",
      signal,
    });
    if (signal.aborted || epoch !== playerLoadEpoch) return;
    const slim = slimPlayersMap(raw);
    try {
      await savePlayersCacheEntry({ players: slim, savedAt: Date.now(), stateKey }, playersCacheAdapters());
    } catch (err) {
      console.warn("Could not save players cache", err);
    }
    commitPlayerDirectory(slim, { epoch, hydrate: false });
  } catch (err) {
    if (signal.aborted || epoch !== playerLoadEpoch || err?.name === "AbortError") return;
    console.warn("Could not refresh NFL player metadata", err);
  }
}

async function fetchPlayersForCache(epoch, signal) {
  const now = Date.now();
  const fromCache = await loadPlayersCacheEntry(playersCacheAdapters()).catch((err) => {
    console.warn("Could not read players cache", err);
    return null;
  });
  if (epoch !== playerLoadEpoch || signal.aborted) throw cancelledPlayerLoad();

  // Warm: the 6h slim cache is enough to paint. Revalidate the week key after.
  if (playersCacheIsFresh(fromCache, now, { ttlMs: PLAYERS_CACHE_TTL_MS })) {
    if (state.leagueId || bootRoute?.leagueId) scheduleQuietPlayerRefresh(epoch, signal);
    return slimPlayersMap(fromCache.players);
  }

  // Home and shared trades paint from the values file. The slim dump is for a league.
  if (!state.leagueId && !bootRoute?.leagueId) return null;

  const slim = await loadSlimPlayersFile();
  if (epoch !== playerLoadEpoch || signal.aborted) throw cancelledPlayerLoad();
  if (slim && Object.keys(slim).length) {
    scheduleQuietPlayerRefresh(epoch, signal);
    return slim;
  }

  const raw = await apiGetWithRetry(`/players/nfl`, {
    timeoutMs: 30000,
    retries: 1,
    cache: "default",
    signal,
  });
  if (epoch !== playerLoadEpoch || signal.aborted) throw cancelledPlayerLoad();
  const downloaded = slimPlayersMap(raw);
  try {
    await savePlayersCacheEntry({ players: downloaded, savedAt: now, stateKey: null }, playersCacheAdapters());
  } catch (err) {
    console.warn("Could not save players cache", err);
  }
  return downloaded;
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
    requestActivePageRender();
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

function hydrateManagerSelector({ syncUrl = true } = {}) {
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
  el.meSelect.innerHTML = renderMeSelectOptions(
    state.normalizedRosters,
    chosen?.rosterId,
    state.viewingSample ? { sample: true, rosterId: chosen?.rosterId } : null,
  );
  if (chosen) {
    state.meRosterId = chosen.rosterId;
    applyMeSelectValue(chosen.rosterId);
  } else {
    state.meRosterId = null;
  }
  pruneSelectedOutgoingAssets();
  pruneExcludedOutgoingAssets();
  renderSessionSnapshot();
  requestActivePageRender();
  if (syncUrl) updateUrlState({ mode: "replace" });
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

function assetMetadataGap(asset) {
  if (!asset || asset.assetType !== "player") return { name: false, position: false, team: false };
  const playerId = playerIdFromAssetId(asset.assetId);
  const named = playerDisplayName(playerId, asset.raw, state.valueNameMap) || String(asset.name || "").trim();
  const bare = !named || /^Player\s+\d+$/i.test(named);
  return {
    name: bare,
    position: !playerPositionForAsset(asset),
    team: !String(asset.raw?.team || "").trim(),
  };
}

function rosterGradeReady(roster) {
  const players = (roster?.assets || []).filter((asset) => asset.assetType === "player");
  if (!players.length) return false;
  return players.every((asset) => {
    const gap = assetMetadataGap(asset);
    return !gap.name && !gap.position;
  });
}

function pricesReady() {
  return Boolean(state.values && Object.keys(state.values).length > 0);
}

function renderMetadataPlaceholder() {
  return `<span class="meta-pending" aria-hidden="true">…</span>`;
}

function retryPlayerMetadata(event) {
  event?.preventDefault?.();
  if (!state.leagueId || !state.playerMetadataFailed) return;
  const leagueId = state.leagueId;
  const epoch = playerLoadEpoch;
  state.playerMetadataFailed = false;
  requestActivePageRender();
  loadPlayersWithCache()
    .then((players) => {
      if (epoch !== playerLoadEpoch || String(state.leagueId) !== String(leagueId)) return;
      if (players && Object.keys(players).length) {
        commitPlayerDirectory(players, { epoch, leagueId, hydrate: true });
      }
      if (epoch !== playerLoadEpoch || String(state.leagueId) !== String(leagueId)) return;
      const gaps = state.normalizedRosters.some((roster) => (roster.assets || []).some((asset) => {
        const gap = assetMetadataGap(asset);
        return gap.name || gap.position;
      }));
      if (!gaps) return;
      state.playerMetadataLoaded = false;
      state.playerMetadataFailed = true;
      requestActivePageRender();
    })
    .catch((err) => {
      if (epoch !== playerLoadEpoch || String(state.leagueId) !== String(leagueId) || err?.name === "AbortError") return;
      const gaps = state.normalizedRosters.some((roster) => (roster.assets || []).some((asset) => {
        const gap = assetMetadataGap(asset);
        return gap.name || gap.position;
      }));
      if (!gaps && Object.keys(state.players).length > 0) return;
      state.playerMetadataLoaded = false;
      state.playerMetadataFailed = true;
      requestActivePageRender();
    });
}

function renderRosterDirectory(roster) {
  const values = state.values;
  const players = roster.assets
    .filter((asset) => asset.assetType === "player")
    .slice()
    .sort((a, b) => getAssetValue(b, values) - getAssetValue(a, values) || String(a.name).localeCompare(String(b.name)));
  const picks = roster.assets.filter((asset) => asset.assetType === "pick");
  const showPicks = leagueUsesFuturePicks(state.league) || picks.length > 0;
  if (el.rosterSheetHeading) el.rosterSheetHeading.textContent = roster.manager.displayName;
  const namingGap = players.some((asset) => {
    const gap = assetMetadataGap(asset);
    return gap.name || gap.position;
  });
  const loadingPlayers = namingGap && !state.playerMetadataFailed;
  const failedPlayers = state.playerMetadataFailed && players.some((asset) => assetMetadataGap(asset).name);
  const failedNote = failedPlayers
    ? `<p class="muted small roster-names-note">Player names couldn't load. Values still work; try again later. <button type="button" class="ghost-btn roster-names-retry" data-action="retry-player-metadata">Retry</button></p>`
    : "";
  const loadingLabel = loadingPlayers ? `<span class="sr-only">Loading player</span>` : "";
  const failedLabel = failedPlayers ? `<span class="sr-only">Player details unavailable</span>` : "";
  const rowClass = loadingPlayers ? "sheet-row directory-row loading-row" : "sheet-row directory-row";
  writeRosterSheet(`
    ${failedNote}
    <div class="sheet-grid">
      <section class="sheet-column"${loadingPlayers ? ` aria-busy="true"` : ""}>
        <h4>Roster</h4>
        ${loadingLabel}
        ${failedLabel}
        ${players.map((asset) => {
          const gap = assetMetadataGap(asset);
          const name = gap.name
            ? (failedPlayers ? "Details unavailable" : renderMetadataPlaceholder())
            : escapeHtml(asset.name || "…");
          const position = gap.position
            ? (failedPlayers ? "" : renderMetadataPlaceholder())
            : escapeHtml(formatPlayerPositionLabel(asset));
          const team = gap.team
            ? (failedPlayers ? "" : renderMetadataPlaceholder())
            : escapeHtml(String(asset.raw?.team || ""));
          const meta = failedPlayers
            ? [position, team].filter(Boolean).join(" · ")
            : `${position}${team ? ` · ${team}` : ""}`;
          return `
            <div class="${rowClass}">
              <div class="sheet-player">
                <strong>${name}</strong>
                ${meta ? `<span>${meta}</span>` : ""}
              </div>
              <span class="sheet-value mono">${renderAssetValuePlain(asset, values)}</span>
            </div>
          `;
        }).join("") || `<p class="muted small">No players on this roster.</p>`}
        ${showPicks ? `
          <h4>Draft picks</h4>
          ${picks.map((asset) => renderPickVaultRow(asset, values)).join("") || `<p class="muted small">No draft picks owned.</p>`}
        ` : ""}
      </section>
    </div>
  `);
}

function renderPowerDashboard() {
  if (!el.powerDashboard) return;
  const meRoster = getLensRoster();
  if (el.powerHeading) {
    el.powerHeading.textContent = "Your team";
  }
  if (!meRoster || state.normalizedRosters.length === 0) {
    el.powerDashboard.innerHTML = `<p class="muted">Choose your team to generate a power score.</p>`;
    return;
  }
  if (!rosterGradeReady(meRoster) || !pricesReady()) {
    const ammo = draftAmmoInsightForRoster(meRoster);
    const ammoHtml = ammo ? `<div class="insight-list">${renderSleeperInsight(ammo)}</div>` : "";
    // Draft Ammo does not need player metadata. The score does. A missing
    // position stays on the score, not on a card whose picks are already final.
    el.powerDashboard.innerHTML = `
      ${ammoHtml}
      ${state.playerMetadataFailed
        ? `<p class="power-empty muted" role="status">Power score unavailable: player details did not load. Reload to try again.</p>`
        : `<p class="power-loading muted" role="status" aria-busy="true"><span class="name-skeleton" aria-hidden="true"></span> Scoring your roster…</p>`}
    `;
    return;
  }

  const { profiles, context } = getLeaguePowerBoard();
  const profile = profiles.find((entry) => String(entry.rosterId) === String(meRoster.rosterId))
    || buildTeamPowerProfile({
      roster: meRoster,
      values: state.values,
      league: state.league,
      context,
    });
  const insights = buildSleeperInsightCards(profile, context);
  const windowCall = buildWindowCallForProfile(profile);
  const showPicks = leagueUsesFuturePicks(state.league) || Number(profile.assetSummary.pickValue) > 0
    || Number(profile.assetSummary.firstRoundPickCount) > 0;
  el.powerDashboard.innerHTML = `
    ${renderPowerHero({
      score: profile.score,
      managerName: profile.managerName,
      grade: profile.grade,
      tierClass: profile.tierClass,
      badges: profile.badges,
    })}
    <div class="power-stat-grid">
      ${renderPowerStat("Starters", formatNumber(profile.metrics.starterValue), infoTipMarkup({ id: "pop-starters", label: "Starters", text: "Value of your best lineup." }))}
      ${renderPowerStat("Bench", formatNumber(profile.metrics.benchValue))}
      ${showPicks ? renderPowerStat("Draft picks", formatNumber(profile.assetSummary.pickValue)) : ""}
      ${renderPowerStat("Avg age", profile.assetSummary.averageAgeLabel)}
    </div>
    <div class="power-lanes">
      <section class="power-lane">
        <h4>By position</h4>
        <div class="position-meter-list">
          ${profile.positionSummaries.map(renderPositionMeter).join("")}
        </div>
      </section>
      ${insights[0] ? `<section class="power-lane"><div class="insight-list">${renderSleeperInsight(insights[0])}</div></section>` : ""}
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
  // A past week's best lineup is picked by the points that week, not this week's start chance.
  const lineup = buildOptimalStartingLineup(assets, getStarterRosterSlots(state.league), values);
  return lineup.starters.reduce((sum, entry) => sum + (entry.asset ? values[entry.asset.assetId] || 0 : 0), 0);
}

function getSimulation(model) {
  if (!model || model.scheduleIncomplete) return null;
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
        pf: sleeperPoints(settings.fpts, settings.fpts_decimal) ?? 0,
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
  return getLeaguePowerBoard().profiles;
}

function buildWindowCallForProfile(profile, { model = null, sim } = {}) {
  if (!profile) return null;
  const resolvedModel = model || getSeasonModel();
  const resolvedSim = sim !== undefined ? sim : getSimulation(resolvedModel);
  const standing = resolvedModel?.teams?.get(String(profile.rosterId)) || null;
  const simRow = resolvedSim?.byRosterId?.get(String(profile.rosterId)) || null;
  return analyzeWindowCall({
    ...windowCallInputFromDesk({
      profile,
      standing,
      simRow,
      model: resolvedModel,
      horizon: windowCallHorizon(state.league),
    }),
    sampleVoice: sampleVoice(),
  });
}

function getLensWindowCall({ profiles = null, model = null, sim } = {}) {
  const roster = getLensRoster();
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
        <strong><span class="team-name">${escapeHtml(manager.displayName)}</span>${isMe ? (state.viewingSample ? `<span class="mini-chip">Viewing</span>` : `<span class="you-chip">You</span>`) : ""}</strong>
        ${subtitle ? `<span>${escapeHtml(subtitle)}</span>` : ""}
      </span>
    </span>
  `;
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

// ---------------------------------------------------------------------------
// League: Scores, Standings, Power
// ---------------------------------------------------------------------------

function leagueRoomEmptyState(host, copy) {
  if (!host) return false;
  if (!state.leagueId) {
    host.innerHTML = renderConnectGate({ copy: connectCopy(copy) });
    return false;
  }
  if (!state.league || state.normalizedRosters.length === 0) {
    host.innerHTML = `<p class="muted">${escapeHtml(copy)}</p>`;
    return false;
  }
  return true;
}

function connectCopy(copy) {
  const text = String(copy || "").trim();
  if (!text) return "Connect my league to open this.";
  return text
    .replace(/^Load a league to /i, "Connect my league to ")
    .replace(/^Connect a league to /i, "Connect my league to ")
    .replace(/^Connect Sleeper to /i, "Connect my league to ");
}

function paintConnectGate(host, copy) {
  if (!host) return;
  host.innerHTML = renderConnectGate({ copy });
}

function clearHost(host) {
  if (host) host.innerHTML = "";
}

function renderLeagueGuest() {
  paintConnectGate(el.powerDashboard, "Connect my league to see your roster, outlook, standings, and playoff odds.");
  clearHost(el.windowCallDashboard);
  clearHost(el.standingsDashboard);
  clearHost(el.rosterSheet);
  document.querySelector("#roster-sheet-section")?.classList.add("hidden");
  if (el.rosterSheetHeading) el.rosterSheetHeading.textContent = "Roster";
}

function renderStandingsRoom() {
  if (!leagueRoomEmptyState(el.standingsDashboard, "Load a league to open the standings.")) return;
  const model = getSeasonModel();
  const sim = getSimulation(model);
  el.standingsDashboard.innerHTML = `
    ${renderStandingsPanel(model, sim)}
    ${renderPlayoffOddsPanel(model, sim)}
  `;
}

function resolveCurrentChampion() {
  const entry = state.leagueHistory.find((item) => item.isCurrent);
  if (!entry) return null;
  const snapshot = buildSeasonSnapshot(entry);
  return snapshot?.champion || null;
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
          <span>#</span><span>Team</span><span>Record</span><span class="col-pf">Points</span><span class="col-pa">Pts against</span><span class="col-streak">Streak</span><span class="col-allplay">All-play</span><span class="col-luck">Luck</span>
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
    <div class="standings-row ${String(team.rosterId) === String(state.meRosterId) ? "you" : ""} ${showLine ? "playoff-line" : ""}" data-action="set-lens-teams" data-roster-id="${escapeHtml(team.rosterId)}">
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
            <h2>Odds not in yet</h2>
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

// ---------------------------------------------------------------------------
// Teams explorer
// ---------------------------------------------------------------------------

function renderTeamsPage() {
  syncLeagueFormatCopy();
  const generation = ++teamsPaintGeneration;
  if (!peekLeaguePowerBoard()) {
    // Cold board solves every roster. Let the Teams tab paint before that work.
    void trackRouteSettle(finishTeamsPagePaint(generation));
    return;
  }
  renderPowerDashboard();
  renderRosterSheet();
}

function teamsRosterVisible() {
  return state.activePage === "league" && getRoom("league") === "team";
}

async function finishTeamsPagePaint(generation) {
  await waitForNextPaint();
  if (generation !== teamsPaintGeneration || !teamsRosterVisible()) return;
  try {
    getLeaguePowerBoard();
    if (generation !== teamsPaintGeneration || !teamsRosterVisible()) return;
    renderPowerDashboard();
    renderRosterSheet();
  } catch (err) {
    console.warn("Teams page failed to rank rosters", err);
  }
}

function syncLeagueFormatCopy() {
  const teamsHint = document.querySelector("#teams-tab-hint");
  if (teamsHint) teamsHint.textContent = "Roster, standings, playoff odds";
  const gridCopy = document.querySelector("#teams-grid-copy");
  if (gridCopy) {
    gridCopy.textContent = leagueTypeId(state.league) === "redraft"
      ? "Ranked by current power. Sit/start is this week. Tap a card for the scout."
      : (sampleVoice()?.teamOutlined || "Your team is outlined. Tap a team for the rank, the win-now or rebuild call, and the lineup.");
  }
  const powerCopy = document.querySelector("#power-section-copy");
  if (powerCopy) {
    powerCopy.textContent = leagueTypeId(state.league) === "redraft"
      ? "Power score, in-it-or-out call, sit/start, and one note for the selected roster."
      : "Power score, win-now or rebuild call, lineup rank, by position, and one idea for the selected roster.";
  }
}

function renderLensPicker(roster, { label = "Viewing", extra = "" } = {}) {
  const meId = String(state.meRosterId ?? "");
  const options = state.normalizedRosters
    .slice()
    .sort((a, b) => a.manager.displayName.localeCompare(b.manager.displayName))
    .map((entry) => `
      <option value="${escapeHtml(entry.rosterId)}" ${String(entry.rosterId) === String(roster.rosterId) ? "selected" : ""}>
        ${escapeHtml(entry.manager.displayName)}${String(entry.rosterId) === meId ? (state.viewingSample ? " · Example roster" : " (you)") : ""}
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

function renderWindowCallDashboard() {
  const host = el.windowCallDashboard;
  if (!host) return;
  const roster = getLensRoster();
  const seasonCall = windowCallHorizon(state.league) === "season";
  if (!roster) {
    host.innerHTML = `<p class="muted">${seasonCall
      ? "Pick a manager. Desk says in it, bubble, or out."
      : "Pick a manager. Desk says rebuild, win now, or hold."}</p>`;
    return;
  }
  if (!rosterGradeReady(roster) || !pricesReady()) {
    host.innerHTML = `
      ${renderLensPicker(roster)}
      <p class="muted small meta-pending">${state.playerMetadataFailed ? "Player metadata unavailable" : "…"}</p>
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

  const why = call.signals?.[0];
  host.innerHTML = `
    ${renderLensPicker(roster)}
    <p class="window-call-line ${call.tone}">
      <strong>${escapeHtml(call.label)}</strong>
      <span class="muted">${escapeHtml(call.horizon === "season" ? "This season" : "Contend or rebuild")}${why ? ` · ${escapeHtml(why.label)}: ${escapeHtml(why.value)}` : ""} · heuristic call, ${call.confidence}% lean</span>
    </p>
  `;
}

let rosterSheetMarkup = "";

// The sheet re-renders on background loads. Rewriting identical markup detaches
// the rows under a pointer or a test, so every write goes through here.
function writeRosterSheet(html) {
  if (!el.rosterSheet) return;
  if (html === rosterSheetMarkup && el.rosterSheet.innerHTML) return;
  rosterSheetMarkup = html;
  el.rosterSheet.innerHTML = html;
}

function renderRosterSheet() {
  const section = document.querySelector("#roster-sheet-section");
  const roster = getLensRoster();
  if (!state.leagueId || !roster) {
    section?.classList.add("hidden");
    writeRosterSheet("");
    return;
  }
  section?.classList.remove("hidden");
  if (!el.rosterSheet) return;
  if (!rosterGradeReady(roster) || !pricesReady()) {
    renderRosterDirectory(roster);
    return;
  }
  const values = state.values;
  const strength = evaluateRosterStrength(roster, values, state.league);
  const picks = roster.assets
    .filter((asset) => asset.assetType === "pick")
    .sort((a, b) => {
      const seasonDiff = Number(a.raw?.season) - Number(b.raw?.season);
      if (seasonDiff) return seasonDiff;
      const roundDiff = Number(a.raw?.round) - Number(b.raw?.round);
      if (roundDiff) return roundDiff;
      return compareOwnedPickValue(
        { asset: a, value: getAssetValue(a, values) },
        { asset: b, value: getAssetValue(b, values) },
      );
    });
  const showPicks = leagueUsesFuturePicks(state.league) || picks.length > 0;
  if (el.rosterSheetHeading) {
    el.rosterSheetHeading.textContent = roster.manager.displayName;
  }
  const summary = summarizeRosterAssets(roster, values);
  const startRows = strength.lineup.map((entry) => ({
    slot: entry.slot,
    slotLabel: formatRosterSlotLabel(entry.slot),
    asset: entry.asset,
  }));
  const benchRows = roster.assets
    .filter((asset) => asset.assetType === "player" && !strength.lineup.some((entry) => entry.asset?.assetId === asset.assetId))
    .sort((a, b) => getAssetValue(b, values) - getAssetValue(a, values));
  const renderPlayerRow = (asset, slotLabel, extra = {}) => {
    const playerId = playerIdFromAssetId(asset.assetId);
    const nickname = roster.nicknames?.[playerId];
    const injury = plainRosterStatus(asset.raw?.injury_status);
    const team = String(asset.raw?.team || "").trim();
    const rowClass = [
      "sheet-row",
      isInjuryFlaggedAsset(asset) ? "flagged" : "",
    ].filter(Boolean).join(" ");
    const meta = [
      team ? escapeHtml(team) : "",
      injury ? `<span class="injury">${escapeHtml(injury)}</span>` : "",
    ].filter(Boolean).join(" · ");
    return `
      <div class="${rowClass}" data-player-id="${escapeHtml(playerId)}">
        ${sheetSlotMarkup(extra.slot, slotLabel)}
        <div class="sheet-player">
          ${renderPlayerFace(playerId, asset.name, { size: "sm" })}
          <strong>${escapeHtml(asset.name)}${nickname ? ` <em class="nickname">“${escapeHtml(nickname)}”</em>` : ""}</strong>
          ${meta ? `<span>${meta}</span>` : ""}
        </div>
        <span class="sheet-metrics">
          <span class="dynasty-chip" title="Value">
            <small>Value</small>
            <strong class="mono">${formatNumber(getAssetValue(asset, values))}</strong>
            ${renderPlayerValueMarks(asset, values)}
          </span>
        </span>
      </div>
    `;
  };

  writeRosterSheet(`
    <div class="sheet-summary">
      ${renderPowerStat("Starters", formatNumber(strength.starterValue))}
      ${renderPowerStat("Bench", formatNumber(strength.benchValue))}
      ${showPicks ? renderPowerStat("Draft picks", formatNumber(summary.pickValue)) : ""}
      ${renderPowerStat("Avg age", summary.averageAgeLabel)}
    </div>
    ${renderValuesFreshness(valuesFreshness())}
    ${renderValueScaleExplainer()}
    <div class="sheet-grid">
      <section class="sheet-column">
        <h4>Best lineup by value</h4>
        ${startRows.map((entry) => entry.asset
          ? renderPlayerRow(entry.asset, entry.slotLabel, { slot: entry.slot })
          : `<div class="sheet-row empty">${sheetSlotMarkup(entry.slot, entry.slotLabel)}<div class="sheet-player"><strong>Open</strong></div></div>`).join("")}
      </section>
      <section class="sheet-column">
        <h4>Bench</h4>
        ${benchRows.map((asset) => renderPlayerRow(asset, isTradeEligibleAsset(asset) ? "Bench" : formatPlayerPositionLabel(asset))).join("") || `<p class="muted small">No bench players.</p>`}
        ${showPicks ? `
        <h4>Draft picks</h4>
        ${picks.length
          ? picks.map((asset) => renderPickVaultRow(asset, values)).join("")
          : `<p class="muted small">No draft picks owned.</p>`}` : ""}
      </section>
    </div>
  `);
}

// ---------------------------------------------------------------------------
// Awards
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Trade calculator: one draft, with or without a league
// ---------------------------------------------------------------------------

function setDraft(next) {
  state.valueCalc = next;
  writeStoredDraft(next);
  if (state.activePage === "trades" && getRoom("trades") === "calculator") {
    updateUrlState({ mode: "replace" });
  }
}

function draftAssetKey(draft) {
  const ids = (items) => (items || []).map((item) => `${item.assetId}@${item.leagueId || ""}`).join(",");
  return `${ids(draft?.left)}|${ids(draft?.right)}`;
}

function replaceDraft(next, note) {
  const current = state.valueCalc;
  draftReplaced = !isDraftEmpty(current) && draftAssetKey(current) !== draftAssetKey(next)
    ? { draft: current, note }
    : null;
  setDraft(next);
}

// Roster ids repeat across leagues, so a browse preference from one league means nothing in another.
function forgetDraftPartner() {
  if (state.valueCalc?.partnerRosterId == null) return;
  setDraft({ ...state.valueCalc, partnerRosterId: null });
}

function draftBasis() {
  if (state.leagueId && state.league) {
    return {
      connected: true,
      format: selectValueFormat(state.league),
      values: state.values,
      nameMap: state.valueNameMap,
      catalog: state.pickValueCatalog,
    };
  }
  const format = activeRankFormat();
  if (draftBasisCache.bundles !== state.valueBundles || draftBasisCache.format !== format || !draftBasisCache.basis) {
    const bundle = pickValueBundle(state.valueBundles, format);
    draftBasisCache = {
      bundles: state.valueBundles,
      format,
      basis: {
        connected: false,
        format,
        values: bundle.values || {},
        nameMap: bundle.nameMap || {},
        catalog: null,
      },
    };
  }
  return draftBasisCache.basis;
}

function draftAssetFor(item, context) {
  const row = context?.items.get(String(item.uid));
  if (row?.asset) return row.asset;
  const id = String(item.assetId || "");
  if (id.startsWith("player:")) {
    const playerId = id.slice("player:".length);
    const raw = state.players?.[playerId] || playerNoteContext?.nflPlayers?.[playerId] || {};
    return { assetId: id, name: item.name, assetType: "player", raw };
  }
  return { assetId: id, name: item.name, assetType: "pick", raw: {} };
}

function buildDraftView() {
  const basis = draftBasis();
  const draft = state.valueCalc;
  const me = basis.connected ? getMyRoster() : null;
  const context = basis.connected
    ? resolveDraftContext({ draft, rosters: state.normalizedRosters, meRosterId: me ? me.rosterId : null, leagueId: state.leagueId })
    : null;
  const priced = new Map();
  [...draft.left, ...draft.right].forEach((item) => {
    const asset = draftAssetFor(item, context);
    priced.set(String(item.uid), { asset, ...draftMarketPrice(asset, basis) });
  });
  const priceOf = (item) => priced.get(String(item.uid))?.value || 0;
  const partner = context?.partnerRosterId ? findNormalizedRoster(context.partnerRosterId) : null;
  const model = draftVerdictModel(draft.left.map(priceOf), draft.right.map(priceOf), {
    globalMaxValue: getGlobalMaxPlayerValue(basis.values),
  });
  return {
    basis,
    draft,
    me,
    context,
    priced,
    priceOf,
    partner,
    model,
    give: model.give,
    get: model.get,
  };
}

function draftValuesReady() {
  return Object.keys(draftBasis().values || {}).length > 0;
}

// A player id from the URL that is not a real player: say so, drop it, no verdict.
function dropUnknownDraftPlayers() {
  const players = state.players;
  if (!players || typeof players !== "object" || !Object.keys(players).length) return;
  const bundles = state.valueBundles || {};
  const known = (assetId) => {
    const id = String(assetId || "").replace(/^player:/, "");
    return Boolean(players[id] || bundles.sf?.[assetId] != null || bundles.oneQb?.[assetId] != null || state.valueNameMap?.[assetId]);
  };
  const isPlayer = (item) => /^player:/.test(String(item?.assetId || ""));
  const bad = [...(state.valueCalc?.left || []), ...(state.valueCalc?.right || [])].filter((item) => isPlayer(item) && !known(item.assetId));
  if (!bad.length) return;
  const ids = new Set(bad.map((item) => item.uid));
  state.valueCalc = {
    ...state.valueCalc,
    left: (state.valueCalc.left || []).filter((item) => !ids.has(item.uid)),
    right: (state.valueCalc.right || []).filter((item) => !ids.has(item.uid)),
  };
  writeStoredDraft(state.valueCalc);
  const names = bad.map((item) => String(item.assetId).replace(/^player:/, "")).join(", ");
  state.droppedPlayerNote = `Player not found (${names}). We removed it from the trade.`;
  updateUrlState({ mode: "replace" });
}

function renderDroppedPlayerNotice() {
  if (!state.droppedPlayerNote) return "";
  return `<div class="share-broken" role="alert"><p>${escapeHtml(state.droppedPlayerNote)}</p></div>`;
}

function renderTradeDraft() {
  const host = el.calculatorShell;
  if (!host) return;
  if (!draftValuesReady()) {
    host.innerHTML = `${renderBadShareNotice()}<p class="muted">Loading market prices…</p>`;
    if (!state.leagueId) void ensureRankExtras();
    return;
  }
  dropUnknownDraftPlayers();
  const view = buildDraftView();
  // Cold /t/<code>: the recipient sees what was sent first (M1). A "Shared
  // trade" header, the full verdict, then the sides; the model notes fold away.
  const shared = Boolean(activeSharedTrade(view.draft));
  host.dataset.sharedView = shared ? "1" : "";
  host.dataset.sharedEditing = shared && state.sharedEditing ? "1" : "";
  if (shared) {
    host.innerHTML = `
      <div class="shared-trade-head">
        <span class="eyebrow">Shared trade</span>
        <h1 id="shared-trade-title">${escapeHtml(sharedTradeTitle(view))}</h1>
      </div>
      <div id="draft-notice">${renderBadShareNotice()}${renderDroppedPlayerNotice()}${renderDraftNotice()}</div>
      <div id="value-calc-verdict" class="calc-verdict">${renderDraftVerdict(view)}</div>
      <div class="calc-grid">
        ${renderDraftPane("left", view)}
        ${renderDraftPane("right", view)}
      </div>
      ${state.sharedEditing ? "" : `<div class="shared-trade-cta">
        <button type="button" class="ghost-btn shared-edit-btn" data-action="shared-edit">Edit this trade</button>
      </div>`}
      <details class="shared-trade-about">
        <summary>About these prices</summary>
        ${renderPriceLegend(["model", "package"])}
        <div class="draft-basis" id="draft-basis">${renderDraftBasis(view)}</div>
      </details>
      <div id="draft-team" class="draft-team">${renderDraftTeam(view)}</div>
    `;
    return;
  }
  const talk = snapshotTradeTalkInput(host);
  host.innerHTML = `
    <div class="panel-heading calc-heading">
      <h2>${escapeHtml(sampleVoice()?.giveGetHeading || "Trade")}</h2>
      <div class="draft-basis" id="draft-basis">${renderDraftBasis(view)}</div>
      ${renderValuesFreshness(valuesFreshness())}
    </div>
    ${renderTradeTalk()}
    <div id="draft-notice">${renderBadShareNotice()}${renderDroppedPlayerNotice()}${renderDraftNotice()}</div>
    <div class="calc-grid has-meter">
      ${renderDraftPane("left", view)}
      <div id="draft-meter" class="draft-meter">${renderDraftMeter(view)}</div>
      ${renderDraftPane("right", view)}
    </div>
    <div id="value-calc-verdict" class="calc-verdict">${renderDraftVerdict(view)}</div>
    <div class="calc-price-notes">
      ${renderValueScaleExplainer()}
      ${renderPriceLegend(["model", "package"])}
    </div>
    <div id="draft-team" class="draft-team">${renderDraftTeam(view)}</div>
  `;
  restoreTradeTalkInput(host, talk);
  syncTradeStickyTop();
  if (pendingTradeTalk) {
    const say = pendingTradeTalk;
    pendingTradeTalk = "";
    queueMicrotask(() => runTradeTalk(say));
  }
}

// Side headers stick under whatever page chrome is pinned at this width.
function syncTradeStickyTop() {
  const host = el.calculatorShell;
  if (!host) return;
  let top = 0;
  for (const node of document.querySelectorAll("#control-rail, #desk-nav, #mobile-chrome")) {
    const cs = getComputedStyle(node);
    if ((cs.position !== "sticky" && cs.position !== "fixed") || !node.offsetHeight) continue;
    top = Math.max(top, (parseFloat(cs.top) || 0) + node.offsetHeight);
  }
  host.style.setProperty("--trade-sticky-top", `${Math.round(top)}px`);
}
window.addEventListener("resize", () => syncTradeStickyTop(), { passive: true });

// ---------------------------------------------------------------------------
// Describe-a-trade box. Rules in trade-talk.js read the sentence; the draft,
// prices and verdict are the calculator's own.
// ---------------------------------------------------------------------------

function snapshotTradeTalkInput(host) {
  const input = host?.querySelector?.("#trade-talk-input");
  if (!input) return null;
  return {
    value: input.value,
    focused: document.activeElement === input,
    start: input.selectionStart,
    end: input.selectionEnd,
  };
}

function restoreTradeTalkInput(host, snap) {
  const input = host?.querySelector?.("#trade-talk-input");
  if (!input || !snap) return;
  input.value = snap.value;
  if (!snap.focused) return;
  input.focus({ preventScroll: true });
  try {
    input.setSelectionRange(snap.start ?? snap.value.length, snap.end ?? snap.value.length);
  } catch {
    // Some input types reject a caret range.
  }
}

function tradeTalkExamples() {
  const season = nextRookieDraftSeason();
  return [
    `Gibbs and a ${season} 1st for Nabers`,
    `add my ${season + 1} 2nd`,
    "swap Nabers for Puka",
    "what could I get for Bijan",
  ];
}

function renderTradeTalk() {
  const example = tradeTalkLog.length
    ? `Keep going: add my ${nextRookieDraftSeason() + 1} 2nd`
    : `Describe a trade, like ${tradeTalkExamples()[0]}`;
  return `
    <section class="talk-box" aria-labelledby="trade-talk-label">
      <form class="talk-form" data-trade-talk novalidate>
        <label id="trade-talk-label" for="trade-talk-input" class="sr-only">Describe the trade in your own words</label>
        <div class="talk-row">
          <input id="trade-talk-input" name="say" type="text" maxlength="${TRADE_TALK_MAX}" placeholder="${escapeHtml(example)}" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" enterkeyhint="send" />
          <button type="submit" class="talk-send" aria-label="Build trade"><span aria-hidden="true">↑</span></button>
        </div>
      </form>
      <div id="talk-log" class="talk-log" aria-live="polite">${renderTradeTalkLog()}</div>
      <p id="talk-toast" class="talk-toast" role="status" hidden></p>
    </section>
  `;
}

function renderTalkChip(chip) {
  return `<button type="button" class="talk-chip" data-action="talk-add" data-side="${chip.side === "right" ? "right" : "left"}" data-asset-id="${escapeHtml(chip.assetId)}" data-name="${escapeHtml(chip.name)}" data-kind="${chip.assetType === "pick" ? "pick" : "player"}"${chip.leagueId ? ` data-league-id="${escapeHtml(chip.leagueId)}"` : ""}>${escapeHtml(chip.label || chip.name)}${chip.value ? ` <span class="talk-chip-value">${formatNumber(chip.value)}</span>` : ""}</button>`;
}

function renderTalkSayChips(texts, label) {
  if (!texts?.length) return "";
  return `<div class="talk-chips talk-next" role="group" aria-label="${escapeHtml(label)}">${texts.map((text) => `<button type="button" class="talk-chip talk-example" data-action="talk-example" data-say="${escapeHtml(text)}">${escapeHtml(text)}</button>`).join("")}</div>`;
}

// Confirmations ("Added Josh Allen to You give.") flash as a toast. Anything
// that needs an answer or explains a miss stays on screen.
function renderTradeTalkLog() {
  if (!tradeTalkLog.length) return renderTalkSayChips(tradeTalkExamples(), "Examples");
  return tradeTalkLog.slice(0, 1).map((turn) => `
    <div class="talk-turn">
      ${turn.sticky && turn.lines.length ? `<div class="talk-lines">${turn.lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}</div>` : ""}
      ${turn.connectLine && !state.leagueId ? `<div class="talk-lines"><p>${escapeHtml(turn.connectLine)}</p></div><button type="button" class="talk-connect" data-action="draft-connect">Connect my league</button>` : ""}
      ${turn.groups.map((group) => `
        <div class="talk-choice" role="group" aria-label="${escapeHtml(group.title)}">
          <p class="talk-choice-title">${escapeHtml(group.title)}</p>
          <div class="talk-chips">${group.chips.map(renderTalkChip).join("")}</div>
        </div>
      `).join("")}
      ${renderTalkSayChips(turn.next, "Keep going")}
    </div>
  `).join("");
}

let talkToastTimer = 0;
function showTalkToast(lines) {
  const toast = el.calculatorShell?.querySelector("#talk-toast");
  if (!toast) return;
  clearTimeout(talkToastTimer);
  const text = (lines || []).join(" ");
  toast.textContent = text;
  toast.hidden = !text;
  if (text) talkToastTimer = setTimeout(() => { toast.hidden = true; }, 3500);
}

// Follow-ups are offered only when the parser would actually add something.
function tradeTalkNext(view) {
  const { draft } = view;
  const season = nextRookieDraftSeason();
  const ctx = tradeTalkContext(view);
  const candidates = [];
  const gap = Number(view.model?.verdict?.gap) || 0;
  const more = draft.left.length && draft.right.length ? verdictCopy(view.model.verdict).more : null;
  if (more != null && more > EVEN_UP_OFFER_ABOVE && gap) {
    const pick = findEvenUpPick(view);
    const near = pick && Number(pick.value) > 0 && pick.value <= Math.abs(gap) * 1.5 && pick.value >= Math.abs(gap) * 0.67;
    if (pick?.closes && near && pick.name) {
      candidates.push(gap > 0 ? `add a ${pick.name}` : `they add a ${pick.name}`);
    } else {
      const partnerId = view.context?.partnerRosterId ?? null;
      const [player] = priceNeighbors(ctx.catalog, Math.abs(gap), {
        exclude: [...draft.left, ...draft.right].map((item) => item.assetId),
        ownerRosterId: gap > 0 ? ctx.meRosterId : partnerId,
        notOwnerRosterId: gap > 0 ? partnerId : ctx.meRosterId,
        limit: 1,
      });
      if (player) candidates.push(gap > 0 ? `add ${player.name}` : `they add ${player.name}`);
    }
  }
  const givePlayer = draft.left.find((item) => item.assetType !== "pick");
  if (givePlayer && !draft.right.length) candidates.push(`what could I get for ${givePlayer.name}`);
  if (draft.left.length || draft.right.length) candidates.push(`add my ${season + 1} 2nd`);
  const inDraft = new Set([...draft.left, ...draft.right].map((item) => String(item.assetId)));
  const keep = [];
  for (const text of candidates) {
    if (keep.length >= 3) break;
    const plan = parseTradeTalk(text, ctx);
    if (plan.misses.length || plan.asks.length) continue;
    if (plan.intent !== "shop" && !plan.adds.length) continue;
    if (plan.adds.some((add) => inDraft.has(String(add.asset.assetId)))) continue;
    keep.push(text);
  }
  if (draft.left.length || draft.right.length) keep.push("clear");
  return keep;
}

function setTradeTalkPlaceholder() {
  const input = el.calculatorShell?.querySelector("#trade-talk-input");
  if (input && tradeTalkLog.length) input.placeholder = `Keep going: add my ${nextRookieDraftSeason() + 1} 2nd`;
}

function patchTradeTalkLog() {
  const log = el.calculatorShell?.querySelector("#talk-log");
  if (log) log.innerHTML = renderTradeTalkLog();
  setTradeTalkPlaceholder();
}

function tradeTalkContext(view) {
  const { basis, draft } = view;
  const names = withPlayerDirectoryNames(basis.nameMap, state.players);
  const catalog = [];
  const seen = new Set();
  if (basis.connected) {
    for (const roster of state.normalizedRosters || []) {
      for (const asset of roster.assets || []) {
        if (!isTradeEligibleAsset(asset)) continue;
        const pick = asset.assetType === "pick";
        const name = pick ? asset.name : tradeRowName(asset, names);
        if (!name) continue;
        seen.add(asset.assetId);
        catalog.push({
          assetId: asset.assetId,
          name,
          assetType: pick ? "pick" : "player",
          value: Number(draftMarketPrice(asset, basis).value) || 0,
          ownerRosterId: roster.rosterId,
          originalRosterId: pick ? asset.raw?.original_owner ?? null : null,
          season: pick ? Number(asset.raw?.season) || null : null,
          round: pick ? Number(asset.raw?.round) || null : null,
          leagueId: isLeaguePickAssetId(asset.assetId) ? String(state.leagueId) : "",
        });
      }
    }
  }
  listValueCalcAssets(basis.values, names, { limit: 0, kinds: ["player"] }).forEach((row) => {
    if (seen.has(row.assetId)) return;
    catalog.push({ ...row, ownerRosterId: null });
  });
  const me = view.me;
  return {
    catalog,
    pickIds: new Set(Object.keys(basis.values || {}).filter((id) => id.startsWith("pick:"))),
    managers: basis.connected
      ? (state.normalizedRosters || []).map((roster) => ({
        rosterId: roster.rosterId,
        displayName: roster.manager?.displayName || "",
        teamName: roster.manager?.teamName || "",
      }))
      : [],
    meRosterId: me ? me.rosterId : null,
    partnerRosterId: view.context?.partnerRosterId ?? draft.partnerRosterId ?? null,
    season: nextRookieDraftSeason(),
    connected: basis.connected,
    draft,
  };
}

function runTradeTalk(text) {
  const say = String(text || "").trim().slice(0, TRADE_TALK_MAX);
  if (!say) return;
  if (!draftValuesReady()) {
    pendingTradeTalk = say;
    renderTradeDraft();
    return;
  }
  const view = buildDraftView();
  const ctx = tradeTalkContext(view);
  const plan = parseTradeTalk(say, ctx);
  const result = applyTradeTalk(state.valueCalc, plan);
  const voice = sampleVoice();
  const giveLabel = voice?.giveLabel || "You give";
  const getLabel = voice?.getLabel || "You get";
  const changed = draftAssetKey(result.draft) !== draftAssetKey(state.valueCalc)
    || result.draft.partnerRosterId !== state.valueCalc.partnerRosterId;
  if (changed) {
    if (plan.intent === "clear") replaceDraft(result.draft, "Cleared both sides.");
    else if (plan.replace) replaceDraft(result.draft, "Built a new trade from what you typed.");
    else setDraft(result.draft);
  }
  const after = buildDraftView();
  const lines = tradeTalkReply(plan, result, { giveLabel, getLabel });
  const groups = plan.asks.map((ask) => ({
    ask: true,
    title: ask.question || `Which one for “${ask.text}”?`,
    chips: ask.options.map((option) => ({ ...option, side: ask.side || "left" })),
  }));
  const bothSides = after.draft.left.length > 0 && after.draft.right.length > 0;
  const connectLine = plan.unknownPartner && !after.basis.connected
    ? `Connect your Sleeper league to use ${plan.unknownPartner}’s roster. Until then these are market picks and players. This trade stays here.`
    : "";
  if (plan.intent === "shop" && after.give > 0) {
    const partnerId = after.context?.partnerRosterId ?? null;
    const neighbors = priceNeighbors(ctx.catalog, after.give, {
      exclude: [...after.draft.left, ...after.draft.right].map((item) => item.assetId),
      ownerRosterId: partnerId,
      notOwnerRosterId: partnerId == null ? ctx.meRosterId : null,
    });
    const partnerName = partnerId != null ? findNormalizedRoster(partnerId)?.manager?.displayName : "";
    lines.push(`Worth ${formatNumber(after.give)} on our board. Tap a player to check him, or type what they offered.`);
    if (neighbors.length) {
      groups.push({
        title: partnerName ? `Single players on ${partnerName}’s roster priced near that` : "Single players priced near that",
        chips: neighbors.map((row) => ({ ...row, side: "right" })),
      });
    } else if (partnerName) {
      lines.push(`${partnerName} has no single player priced near that. Try a package.`);
    }
  }
  if (!bothSides && plan.intent === "verdict") {
    lines.push("Add pieces to both sides first, like “Gibbs for Nabers.”");
  }
  // A question needs an answer, so its reply stays on screen instead of a toast over it.
  const sticky = !changed || plan.misses.length > 0 || plan.notes.length > 0 || plan.asks.length > 0
    || Boolean(plan.unknownPartner) || plan.intent === "shop" || plan.intent === "verdict";
  tradeTalkLog = [{
    say,
    lines,
    sticky,
    groups,
    connectLine,
    next: tradeTalkNext(after),
  }];
  analyticsTrack("trade_described", { intent: plan.intent });
  patchTradeDraft(["left", "right"]);
  patchTradeTalkLog();
  showTalkToast(sticky ? [] : lines);
}

function addTalkChip(target) {
  const side = target.dataset.side === "right" ? "right" : "left";
  const added = addDraftAsset(side, {
    assetId: target.dataset.assetId,
    name: target.dataset.name,
    assetType: target.dataset.kind === "pick" ? "pick" : "player",
    leagueId: target.dataset.leagueId || "",
  });
  const label = side === "right" ? (sampleVoice()?.getLabel || "You get") : (sampleVoice()?.giveLabel || "You give");
  const after = buildDraftView();
  const last = tradeTalkLog[0];
  const line = added ? `Added ${target.dataset.name} to ${label}.` : `${target.dataset.name} is already in the trade.`;
  // "Jefferson and a first for Chase" asks twice. Answering one keeps the other.
  const answered = target.closest(".talk-choice")?.getAttribute("aria-label") || "";
  const groups = (last?.groups || []).filter((group) => !group.ask || group.title !== answered);
  const waiting = groups.some((group) => group.ask);
  tradeTalkLog = [{
    say: last?.say || target.dataset.name || "",
    lines: [line],
    sticky: waiting,
    groups: waiting ? groups : [],
    next: waiting ? [] : tradeTalkNext(after),
  }];
  patchTradeDraft(["left", "right"]);
  patchTradeTalkLog();
  showTalkToast(waiting ? [] : [line]);
}

function handleTradeTalkSubmit(event) {
  const form = event.target?.closest?.("[data-trade-talk]");
  if (!form || !el.workspace?.contains(form)) return false;
  event.preventDefault();
  const input = form.querySelector("#trade-talk-input");
  const say = input?.value || "";
  if (input) input.value = "";
  runTradeTalk(say);
  return true;
}

// Landing box and /trade?say=: open the calculator, then read the sentence.
function openTradeWithTalk(text) {
  const say = String(text || "").trim().slice(0, TRADE_TALK_MAX);
  state.sharedTrade = null;
  state.badShareLink = false;
  state.droppedPlayerNote = "";
  if (say) pendingTradeTalk = say;
  openRoom("trades", "calculator", { history: "push", scroll: "top" });
  syncLaunchChrome();
}

// Taps and background data refresh everything except the search boxes, so the
// keyboard stays up on phones and iPads.
function patchTradeDraft(listSides = []) {
  const host = el.calculatorShell;
  if (!host?.querySelector(".calc-grid") || !draftValuesReady()) {
    renderTradeDraft();
    return;
  }
  const before = state.droppedPlayerNote;
  dropUnknownDraftPlayers();
  if (state.droppedPlayerNote !== before) {
    renderTradeDraft();
    return;
  }
  const view = buildDraftView();
  // Editing a shared trade (or landing on one) switches layout: full render.
  if ((host.dataset.sharedView === "1") !== Boolean(activeSharedTrade(view.draft))) {
    renderTradeDraft();
    return;
  }
  ["left", "right"].forEach((side) => {
    const pane = host.querySelector(`[data-draft-side="${side}"]`);
    if (!pane) return;
    const title = pane.querySelector(".draft-pane-title");
    if (title) title.innerHTML = renderDraftPaneTitle(side, view);
    const total = pane.querySelector(".calc-pane-total");
    if (total) total.innerHTML = renderDraftTotal(side, view);
    const slot = pane.querySelector(".draft-partner-slot");
    if (slot) slot.innerHTML = renderDraftPartnerPicker(view);
    const tokens = pane.querySelector(".calc-selected");
    if (tokens) tokens.innerHTML = renderDraftTokens(side, view);
    const notes = pane.querySelector(".draft-notes");
    if (notes) notes.innerHTML = renderDraftNotes(side, view);
    if (listSides.includes(side)) patchDraftSuggestions(side, view);
  });
  const sharedTitle = host.querySelector("#shared-trade-title");
  if (sharedTitle) sharedTitle.textContent = sharedTradeTitle(view);
  const basisEl = host.querySelector("#draft-basis");
  if (basisEl) basisEl.innerHTML = renderDraftBasis(view);
  const notice = host.querySelector("#draft-notice");
  if (notice) notice.innerHTML = `${renderBadShareNotice()}${renderDroppedPlayerNotice()}${renderDraftNotice()}`;
  const verdict = host.querySelector("#value-calc-verdict");
  if (verdict) verdict.innerHTML = renderDraftVerdict(view);
  const meter = host.querySelector("#draft-meter");
  if (meter) meter.innerHTML = renderDraftMeter(view);
  const team = host.querySelector("#draft-team");
  if (team) team.innerHTML = renderDraftTeam(view);
}

function patchDraftSuggestions(side, view = buildDraftView()) {
  const list = el.calculatorShell?.querySelector(`#value-list-${side}`);
  if (!list) return;
  const query = side === "right" ? view.draft.rightQuery : view.draft.leftQuery;
  list.classList.toggle("is-browse", !String(query || "").trim());
  list.innerHTML = renderDraftSuggestions(side, view);
}

function refreshDraftSuggestions(side) {
  if (!el.calculatorShell?.querySelector(".calc-grid") || !draftValuesReady()) {
    renderTradeDraft();
    return;
  }
  const sides = side === "right" || side === "left" ? [side] : ["left", "right"];
  const view = buildDraftView();
  sides.forEach((key) => patchDraftSuggestions(key, view));
}

function renderDraftBasis(view) {
  const { basis } = view;
  return `
    <div class="draft-basis-row" role="group" aria-label="Scoring format">
      <div class="draft-format-toggle">
        ${["sf", "oneQb"].map((format) => `<button type="button" class="draft-format-btn${basis.format === format ? " active" : ""}" data-action="draft-format" data-format="${format}" aria-pressed="${basis.format === format ? "true" : "false"}" aria-label="PPR · ${escapeHtml(rankFormatLabel(format))}" title="PPR · ${escapeHtml(rankFormatLabel(format))}">${format === "sf" ? "SF" : "1QB"}</button>`).join("")}
      </div>
      ${infoTipMarkup({ id: "pop-format-trade", label: "Scoring and how values work", text: `${GLOSSARY.PPR} ${GLOSSARY.Superflex} ${GLOSSARY["1QB"]} ${valuesWorkText(String(state.valueBundles?.asOf || "").slice(0, 10))}` })}
    </div>
  `;
}

// /t/<code> that does not decode. The calculator stays usable underneath.
// "Bijan Robinson for Malik Nabers + 1 more"
// Before Sleeper names load an item's name is its raw id; never show that.
function sharedTradeTitle(view) {
  const raw = (name) => !name || /^(player|pick):/i.test(String(name)) || /^\d+$/.test(String(name));
  const all = [...view.draft.left, ...view.draft.right];
  if (all.some((item) => raw(item.name))) {
    return `${pieceCount(view.draft.left)} for ${pieceCount(view.draft.right)}`;
  }
  const side = (items) => {
    const names = items.map((item) => item.name).filter(Boolean);
    if (!names.length) return "nothing";
    return names.length > 1 ? `${names[0]} + ${names.length - 1} more` : names[0];
  };
  return `${side(view.draft.left)} for ${side(view.draft.right)}`;
}

function renderBadShareNotice() {
  if (!state.badShareLink) return "";
  return `
    <div class="share-broken" role="alert">
      <h3>This trade link is broken or expired</h3>
      <p>Part of the link may be missing. Ask for a new link, or check the trade yourself.</p>
      <a class="ghost-btn" href="/trade">Check a trade</a>
    </div>
  `;
}

function renderDraftNotice() {
  const text = draftNoticeText({
    note: draftReplaced?.note || "",
    saved: draftReplaced?.draft,
    current: state.valueCalc,
    voice: sampleVoice(),
  });
  if (!text) return "";
  return `
    <div class="draft-notice" role="status">
      <p>${escapeHtml(text)}</p>
      <div class="draft-notice-actions">
        <button type="button" class="ghost-btn" data-action="draft-restore">Restore draft</button>
        <button type="button" class="ghost-btn" data-action="draft-dismiss">Keep new</button>
      </div>
    </div>
  `;
}

function renderDraftPaneTitle(side, view) {
  const left = side === "left";
  // Cold /t: neutral column names, never the sender's name.
  if (activeSharedTrade(view.draft)) return `<span class="analytics-kicker">${left ? "Give side" : "Get side"}</span>`;
  const voice = sampleVoice();
  let name = "";
  if (view.basis.connected) {
    if (left) name = view.me?.manager?.displayName || "";
    else if (view.partner) name = `from ${view.partner.manager.displayName}`;
  }
  const kicker = voice
    ? (left ? voice.youGive : "Other side")
    : (left ? "You give" : "You get");
  const showName = Boolean(name) && !(voice && left && name === kicker);
  return `
    <span class="analytics-kicker">${escapeHtml(kicker)}</span>
    ${showName ? `<strong>${escapeHtml(name)}</strong>` : ""}
  `;
}

// "1 player", "2 picks", "1 player & 1 pick". Players first, then picks.
function pieceCount(items) {
  const list = Array.isArray(items) ? items : [];
  const players = list.filter((item) => {
    if (item?.assetType === "pick") return false;
    if (item?.assetType === "player") return true;
    return String(item?.assetId || "").startsWith("player:");
  }).length;
  const picks = list.length - players;
  const bit = (n, one, many) => (n === 1 ? `1 ${one}` : `${n} ${many}`);
  const parts = [];
  if (players) parts.push(bit(players, "player", "players"));
  if (picks) parts.push(bit(picks, "pick", "picks"));
  return parts.join(" & ");
}

function renderDraftTotal(side, view) {
  const items = view.draft[side] || [];
  const total = side === "left" ? view.give : view.get;
  return `
    <strong>${formatNumber(total)}</strong>
    <small title="${escapeHtml(items.length ? pieceCount(items) : "Nothing added")}">(${items.length})</small>
  `;
}

function renderDraftPartnerPicker(view) {
  if (!view.basis.connected || !view.me) return "";
  const others = state.normalizedRosters
    .filter((roster) => String(roster.rosterId) !== String(view.me.rosterId))
    .sort((a, b) => a.manager.displayName.localeCompare(b.manager.displayName));
  const selected = String(view.context?.partnerRosterId || "");
  return `
    <label class="draft-partner">
      <span>Browse</span>
      <select data-change="draft-partner" aria-label="Team to browse">
        <option value="" ${selected ? "" : "selected"}>Any team</option>
        ${others.map((roster) => `<option value="${escapeHtml(roster.rosterId)}" ${String(roster.rosterId) === selected ? "selected" : ""}>${escapeHtml(roster.manager.displayName)}${roster.manager.teamName ? ` · ${escapeHtml(roster.manager.teamName)}` : ""}</option>`).join("")}
      </select>
    </label>
  `;
}

function renderSelectedTokenLabel(asset) {
  const face = renderPlayerFace(facePlayerId(asset), asset?.name, { size: "sm" });
  if (!face) return `<span class="selected-token-label">${escapeHtml(asset?.name || "")}</span>`;
  return `<span class="selected-token-label player-name">${face}<span class="player-name-text">${escapeHtml(asset.name)}</span></span>`;
}

function draftItemMismatch(view, item) {
  const row = view.context?.items.get(String(item.uid));
  return Boolean(view.basis.connected && view.context && !view.context.needsTeam && row && row.status !== "ok");
}

// A routed or shared draft is built from ids before names load. Resolve the
// name at paint time: picks from the board's names (or "2027 Early 1st"),
// players from the board, then the Sleeper directory. "" means still loading.
function draftItemDisplayName(item, names) {
  const id = String(item?.assetId || "");
  const own = String(item?.name || "").trim();
  if (own && own !== id && !/^(?:player|pick):/.test(own) && !/^\d+$/.test(own)) return own;
  if (id.startsWith("pick:")) return String(names[id] || formatGenericPickAssetLabel(id) || "").replace(/^pick:.*$/, "");
  return String(names[id] || "").trim();
}

let draftNamesRequested = false;
function requestDraftPlayerNames() {
  if (draftNamesRequested) return;
  draftNamesRequested = true;
  const epoch = playerLoadEpoch;
  // A league uses the slim file. A shared trade has no league, so a missing
  // name still comes from Sleeper without downloading the slim dump.
  const job = (state.leagueId || bootRoute?.leagueId)
    ? loadPlayersWithCache()
    : apiGetWithRetry(`/players/nfl`, { timeoutMs: 30000, retries: 1, cache: "default" }).then((raw) => slimPlayersMap(raw));
  void job
    .then((players) => {
      if (epoch !== playerLoadEpoch || !players || !Object.keys(players).length) return;
      state.players = mergePlayerRecords(state.players, players);
      if (el.calculatorShell?.querySelector(".calc-grid")) patchTradeDraft();
    })
    .catch(() => {});
}

function renderDraftTokens(side, view) {
  const items = view.draft[side] || [];
  if (!items.length) return "";
  const names = withPlayerDirectoryNames(view.basis.nameMap, state.players);
  return items.map((rawItem) => {
    const price = view.priced.get(String(rawItem.uid));
    const name = draftItemDisplayName(rawItem, names);
    if (!name) requestDraftPlayerNames();
    // Keep the resolved name on the draft so notes and offer text read it too.
    else if (rawItem.name !== name && !Object.isFrozen(rawItem)) rawItem.name = name;
    const item = { ...rawItem, name };
    const label = name
      ? renderSelectedTokenLabel(item)
      : `<span class="selected-token-label is-loading"><span class="name-skeleton" aria-hidden="true"></span><span class="sr-only">Loading player name</span></span>`;
    const meta = draftItemMeta(item);
    return `
      <span class="selected-token${draftItemMismatch(view, item) ? " is-mismatch" : ""}" data-uid="${escapeHtml(item.uid)}">
        ${label.includes("player-face") ? "" : `<span class="token-face-blank" aria-hidden="true"></span>`}
        ${label}
        ${meta ? `<span class="selected-token-meta">${escapeHtml(meta)}</span>` : ""}
        <span class="selected-token-price" title="Value">${formatNumber(price?.value || 0)}${price?.estimated ? " est" : ""}</span>
        <button type="button" class="selected-token-remove" data-action="value-remove" data-side="${side}" data-uid="${escapeHtml(item.uid)}" aria-label="${escapeHtml(name ? `Remove ${name}` : "Remove")}"><span aria-hidden="true">×</span></button>
      </span>
    `;
  }).join("");
}

function draftItemMeta(item) {
  if (item.assetType === "pick" || String(item.assetId || "").startsWith("pick:")) {
    const season = parsePickAssetId(item.assetId)?.season || item.season || "";
    return season ? `${season} pick` : "Pick";
  }
  const id = facePlayerId(item);
  const record = state.valueBundles?.players?.[`player:${id}`] || state.players?.[id] || {};
  return [record.position, record.team].filter(Boolean).join(" · ");
}

let draftMeterOpen = false;

// One slim bar for the verdict: the split is the credited totals the verdict
// compares, so the bar, the label and the full breakdown always agree.
function renderDraftMeter(view) {
  const { draft, model } = view;
  if (!draft.left.length || !draft.right.length) {
    return `
      <div class="meter-head"><span class="meter-label muted">Add to both sides to see the verdict</span></div>
      <div class="meter-bar is-empty" aria-hidden="true"></div>
    `;
  }
  const { verdict } = model;
  const copy = verdictCopy(verdict);
  const give = Math.max(0, Number(verdict.left) || 0);
  const get = Math.max(0, Number(verdict.right) || 0);
  const giveShare = give + get > 0 ? (give / (give + get)) * 100 : 50;
  const tone = copy.tier === "even" ? "good" : copy.tier === "edge" ? "fair" : (copy.tone || "fair");
  const voice = sampleVoice();
  const giveLabel = voice?.giveLabel || "You give";
  const getLabel = voice?.getLabel || "You get";
  return `
    <button type="button" class="meter-head" data-action="meter-why" aria-expanded="${draftMeterOpen ? "true" : "false"}" aria-controls="meter-why">
      <strong class="meter-label tone-${tone}">${escapeHtml(copy.line)}</strong>
      <span class="meter-why-link">${draftMeterOpen ? "Hide" : "See why"} <span aria-hidden="true">›</span></span>
    </button>
    <div class="meter-bar tone-${tone}" role="img" aria-label="${escapeHtml(`${giveLabel} ${formatNumber(give)}, ${getLabel} ${formatNumber(get)}`)}">
      <span class="meter-give" style="width:${giveShare.toFixed(1)}%"></span>
      <span class="meter-get"></span>
    </div>
    ${draftMeterOpen ? renderDraftMeterWhy(view, { giveLabel, getLabel, give, get }) : ""}
  `;
}

function renderDraftMeterWhy(view, { giveLabel, getLabel, give, get }) {
  const { draft, model } = view;
  const rowsFor = (side) => (draft[side] || []).map((item) => {
    const price = view.priced.get(String(item.uid));
    return { name: price?.asset?.name || item.name || "", value: Number(price?.value) || 0 };
  });
  const sides = [
    { key: "left", label: giveLabel, rows: rowsFor("left"), total: give },
    { key: "right", label: getLabel, rows: rowsFor("right"), total: get },
  ];
  const max = Math.max(1, ...sides.flatMap((side) => side.rows.map((row) => row.value)));
  const adjustment = model.adjustment;
  const winner = give > get ? "left" : get > give ? "right" : "";
  return `
    <div class="meter-why" id="meter-why">
      ${sides.map((side) => `
        <div class="meter-why-side side-${side.key}${winner === side.key ? " is-win" : ""}">
          <p class="meter-why-title"><span>${escapeHtml(side.label)}</span><span class="meter-why-num">${formatNumber(side.total)}</span></p>
          ${side.rows.map((row) => `
            <div class="meter-why-row">
              <span class="meter-why-name">${escapeHtml(row.name)}</span>
              <span class="meter-why-track"><span style="width:${((row.value / max) * 100).toFixed(1)}%"></span></span>
              <span class="meter-why-num">${formatNumber(row.value)}</span>
            </div>
          `).join("")}
          ${adjustment?.side === side.key && adjustment.amount > 0 ? `
            <div class="meter-why-row is-credit">
              <span class="meter-why-name">Fewer, better players</span>
              <span class="meter-why-track"></span>
              <span class="meter-why-num">+${formatNumber(adjustment.amount)}</span>
            </div>
          ` : ""}
        </div>
      `).join("")}
      <button type="button" class="inline-link meter-full" data-action="meter-full">Full breakdown</button>
    </div>
  `;
}

function renderDraftNotes(side, view) {
  if (!view.basis.connected || !view.context || view.context.needsTeam) return "";
  const notes = (view.draft[side] || []).map((item) => {
    const row = view.context.items.get(String(item.uid));
    if (!row || row.status === "ok") return "";
    const owner = row.ownerRosterId != null ? findNormalizedRoster(row.ownerRosterId)?.manager?.displayName : "";
    const real = row.status === "generic" ? leaguePickForGeneric(item, side, {
      draft: view.draft,
      rosters: state.normalizedRosters,
      meRosterId: view.me?.rosterId ?? null,
      partnerRosterId: view.context.partnerRosterId || null,
    }) : null;
    if (real) {
      const partner = findNormalizedRoster(view.context.partnerRosterId)?.manager?.displayName;
      const whose = side === "left" ? (sampleVoice()?.roster || "your roster") : (partner ? `${partner}’s roster` : "their roster");
      const label = `${item.name.replace(/^(\d{4} )(?:early |mid |late )/i, "$1")} on ${whose}`;
      return `<li><strong>${escapeHtml(item.name)}:</strong> Generic pick at market price. <button type="button" class="inline-link" data-action="draft-use-league-pick" data-uid="${escapeHtml(item.uid)}" data-asset-id="${escapeHtml(real.assetId)}">Use the ${escapeHtml(label)}</button></li>`;
    }
    return `<li><strong>${escapeHtml(item.name)}:</strong> ${escapeHtml(describeDraftItem(row, { ownerName: owner, kind: item.assetType, voice: sampleVoice() }))}</li>`;
  }).filter(Boolean);
  return notes.length ? `<ul class="draft-note-list">${notes.join("")}</ul>` : "";
}

function draftSearchPlaceholder(side, view) {
  if (!view.basis.connected) return `+ Add player or pick, like ${nextRookieDraftSeason()} early 1st`;
  if (side === "left") return sampleVoice()?.draftSearchLeft || "Your players and picks";
  return "Their players and picks";
}

function renderDraftPane(side, view) {
  const left = side === "left";
  const query = String((left ? view.draft.leftQuery : view.draft.rightQuery) || "");
  const listId = calcListDomId(side);
  const suggestions = renderDraftSuggestions(side, view);
  const expanded = Boolean(query.trim()) && suggestions.includes('role="option"');
  return `
    <section class="calc-pane ${left ? "team-a" : "team-b"}" data-draft-side="${side}">
      <header class="calc-pane-head">
        <div class="draft-pane-title">${renderDraftPaneTitle(side, view)}</div>
        <div class="calc-pane-total">${renderDraftTotal(side, view)}</div>
      </header>
      ${left ? "" : `<div class="draft-partner-slot">${renderDraftPartnerPicker(view)}</div>`}
      <div class="calc-selected">${renderDraftTokens(side, view)}</div>
      <div class="draft-notes">${renderDraftNotes(side, view)}</div>
      <div class="calc-search-wrap">
        ${renderCalcSearchInput({
          query,
          side,
          input: "value-search",
          placeholder: draftSearchPlaceholder(side, view),
          listId,
          expanded,
        })}
        <div class="calc-list calc-suggest${query.trim() ? "" : " is-browse"}" id="${listId}" role="listbox">${suggestions}</div>
      </div>
    </section>
  `;
}

function draftSearchRow(asset) {
  const pick = asset.assetType === "pick";
  const bucket = pick ? getAssetPickBucket(asset) : "";
  return {
    assetId: asset.assetId,
    name: asset.name,
    assetType: asset.assetType,
    season: pick ? String(asset.raw?.season || parsePickAssetId(asset.assetId)?.season || "") : "",
    round: pick ? Number(asset.raw?.round || parsePickAssetId(asset.assetId)?.round || 0) : 0,
    bucket,
    bucketLabel: pick ? formatPickBucketLabel(bucket) : "",
  };
}

function draftSuggestionRows(side, view) {
  const { basis, draft } = view;
  const query = String((side === "right" ? draft.rightQuery : draft.leftQuery) || "").trim();
  const names = withPlayerDirectoryNames(basis.nameMap, state.players);
  if (!basis.connected) {
    if (!query) return [];
    const added = new Set([...draft.left, ...draft.right]
      .filter((item) => !isGenericPickAssetId(item.assetId))
      .map((item) => item.assetId));
    return listValueCalcAssets(basis.values, names, { query, limit: 40, minSeason: nextRookieDraftSeason() })
      .filter((row) => !added.has(row.assetId))
      .map((row) => ({
      assetId: row.assetId,
      name: row.name,
      assetType: row.assetType,
      value: Math.round(row.value),
      estimated: false,
      context: "",
      leagueId: "",
    }));
  }
  const meId = view.me ? String(view.me.rosterId) : "";
  const partnerId = String(view.context?.partnerRosterId || "");
  const taken = new Set([...draft.left, ...draft.right]
    .filter((item) => !isGenericPickAssetId(item.assetId))
    .map((item) => item.assetId));
  const rostered = new Set();
  const rows = [];
  for (const roster of state.normalizedRosters) {
    const rosterId = String(roster.rosterId);
    for (const asset of roster.assets || []) {
      if (!isTradeEligibleAsset(asset)) continue;
      rostered.add(asset.assetId);
      if (taken.has(asset.assetId)) continue;
      if (side === "right" && rosterId === meId) continue;
      if (!query) {
        const browseId = side === "left" ? meId : partnerId;
        if (!browseId || rosterId !== browseId) continue;
      } else if (!valueCalcAssetMatchesQuery(draftSearchRow(asset), query)) {
        continue;
      }
      const price = draftMarketPrice(asset, basis);
      if (asset.assetType !== "pick" && !(Number(price.value) > 0)) continue;
      const mine = rosterId === meId;
      rows.push({
        assetId: asset.assetId,
        name: asset.name,
        assetType: asset.assetType,
        position: asset.assetType === "player" ? formatPlayerPositionLabel(asset) : "",
        value: price.value,
        estimated: price.estimated,
        slot: Number(asset.raw?.projectedDraftSlot) || 0,
        round: Number(asset.raw?.round) || 0,
        context: mine ? (sampleVoice()?.roster || "Your roster") : roster.manager.displayName,
        leagueId: isLeaguePickAssetId(asset.assetId) ? String(state.leagueId) : "",
        hint: valuedAsMidFirstHint(asset, state.league?.season),
        group: side === "left" ? (mine ? 0 : 2) : (rosterId === partnerId ? 0 : 1),
      });
    }
  }
  if (query) {
    listValueCalcAssets(basis.values, names, { query, limit: 60 }).forEach((row) => {
      if (rostered.has(row.assetId) || taken.has(row.assetId)) return;
      rows.push({
        assetId: row.assetId,
        name: row.name,
        assetType: row.assetType,
        value: Math.round(row.value),
        estimated: false,
        context: row.assetType === "pick" ? "Generic pick" : "Not on a roster here",
        leagueId: "",
        group: 3,
      });
    });
  }
  return rows
    .sort((a, b) => (
      a.assetType === "pick" && b.assetType === "pick"
        ? compareTradeSearchPicks(a, b)
        : a.group - b.group || b.value - a.value || a.name.localeCompare(b.name)
    ))
    .slice(0, 40);
}

function renderDraftSuggestions(side, view) {
  const query = String((side === "right" ? view.draft.rightQuery : view.draft.leftQuery) || "").trim();
  const names = withPlayerDirectoryNames(view.basis.nameMap, state.players);
  const rawRows = draftSuggestionRows(side, view);
  const rows = rawRows.flatMap((row) => {
    if (row.assetType === "pick") return [row];
    const name = tradeRowName(row, names);
    return name ? [{ ...row, name }] : [];
  });
  if (!rows.length && rawRows.length) {
    if (!rankValuesReady()) {
      void ensureValuesLoaded("").catch((err) => {
        console.warn("Could not preload valuation data", err);
      });
    }
    return `<div class="player-item muted">Loading names…</div>`;
  }
  if (!rows.length && !view.basis.connected && query && !Object.keys(view.basis.values || {}).length) {
    void ensureValuesLoaded("").catch((err) => {
      console.warn("Could not preload valuation data", err);
    });
    return `<div class="player-item muted">Loading names…</div>`;
  }
  if (!rows.length) {
    if (query) {
      const past = pastPickSeasonHint(query, nextRookieDraftSeason(), view.basis.values);
      return `<div class="player-item muted" role="status">No matching players or picks.${past ? ` ${escapeHtml(past)}` : ""}</div>`;
    }
    if (view.basis.connected && side === "right" && view.me) return `<div class="player-item muted">Type a name, or pick a team to browse.</div>`;
    return "";
  }
  return rows.map((row, index) => `
    <div class="player-item calc-item" ${calcOptionAttrs({ side, assetId: row.assetId, index })} data-action="value-add" data-side="${side}" data-asset-id="${escapeHtml(row.assetId)}" data-name="${escapeHtml(row.name)}" data-kind="${row.assetType === "pick" ? "pick" : "player"}"${row.leagueId ? ` data-league-id="${escapeHtml(row.leagueId)}"` : ""}>
      <div class="asset-row-top">
        ${renderPlayerFace(facePlayerId(row), row.name, { size: "sm" })}
        <div class="asset-name-stack">
          <strong>${escapeHtml(row.name)}</strong>
          <div class="asset-meta">
            <span class="asset-pill ${row.assetType === "pick" ? "gold" : ""}">${row.assetType === "pick" ? "Pick" : escapeHtml(row.position || "Player")}</span>
            ${row.context ? `<span class="asset-context">${escapeHtml(row.context)}</span>` : ""}
            ${row.hint ? `<span class="pick-value-hint">${escapeHtml(row.hint)}</span>` : ""}
          </div>
        </div>
        <span class="asset-value-badge" title="Value">${formatNumber(row.value)}${row.estimated ? " est" : ""}</span>
      </div>
    </div>
  `).join("");
}

function nextRookieDraftSeason() {
  return tradablePickSeason(state.nflState);
}

// A future pick evens the gap only when its price actually covers it.
function findEvenUpPick(view) {
  const first = nextRookieDraftSeason();
  const picks = listGenericPicks(view.basis.values, view.basis.nameMap)
    .filter((pick) => Number(pick.season) >= first);
  return evenUpTradePick({
    giveValues: view.draft.left.map(view.priceOf),
    getValues: view.draft.right.map(view.priceOf),
    picks,
    globalMaxValue: getGlobalMaxPlayerValue(view.basis.values),
  });
}

function evenUpCopy(choice, side) {
  if (!choice) return "";
  const verb = side === "You" || side === "They" ? "add" : "adds";
  // Cite a pick only when its price is close to the gap.
  const near = Number(choice.value) > 0 && Number(choice.gap) > 0
    && choice.value <= choice.gap * 1.5 && choice.value >= choice.gap * 0.67;
  if (choice.closes && !near) {
    return `${side} ${verb} about ${formatNumber(choice.gap)} to even it up. No single pick is close to that.`;
  }
  if (choice.closes) {
    return `${side} ${verb} about ${formatNumber(choice.gap)}, roughly a ${choice.name} (${formatNumber(choice.value)}).`;
  }
  if (Number.isFinite(Number(choice.pct))) {
    const after = choice.verdict ? verdictLineNamed(choice.verdict) : "";
    return `No single pick closes this gap. Closest is a ${choice.name} (${formatNumber(choice.value)}).${after ? ` After that pick: ${after}.` : ""}`;
  }
  const short = choice.value < choice.gap;
  const why = short
    ? `It covers ${formatNumber(choice.value)} of a ${formatNumber(choice.gap)} gap, so it does not close.`
    : `It is ${formatNumber(choice.value - choice.gap)} more than the ${formatNumber(choice.gap)} gap.`;
  return `No single pick closes this gap. Closest is a ${choice.name} (${formatNumber(choice.value)}). ${why}`;
}

function renderDraftMethod(view) {
  const lines = [
    `Prices are our estimate, scored with a point per catch, ${rankFormatLabel(view.basis.format)}.`,
    PRICE_FACTORS_LINE,
  ];
  if ([...view.priced.values()].some((row) => row.estimated)) {
    lines.push(UNAVAILABLE_PRICE_LINE);
  }
  lines.push(FEWER_BETTER_LINE);
  lines.push(TIER_EXPLAINER);
  lines.push(sampleVoice()?.methodLineup || "Team impact is separate from price: it asks whether the move helps your starting lineup.");
  return lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("");
}

// trade_checked fires once per distinct give/get pair that reaches a verdict.
// The key stays in memory; only { mode } is sent.
function noteTradeChecked(draft) {
  const side = (rows) => rows.map((row) => String(row.assetId || row.uid || "")).sort().join(",");
  const mode = state.leagueId ? "league" : "public";
  const once = `${side(draft.left)}|${side(draft.right)}`;
  // setActivePage renders the verdict before it writes the URL. Send after the
  // current task's URL write so the event carries the route it was checked on
  // (/trade or /t/:code), not the page the user came from.
  queueMicrotask(() => analyticsTrack("trade_checked", { mode }, { once }));
}

function renderDraftVerdict(view) {
  const { draft, model } = view;
  if (!draft.left.length && !draft.right.length) {
    return `<p class="muted calc-hint">Type a name. Click a result, or press Enter, to add it. The verdict uses the same prices as Players.</p>`;
  }
  const bothSides = draft.left.length > 0 && draft.right.length > 0;
  if (bothSides) noteTradeChecked(draft);
  const them = view.partner?.manager?.displayName || "them";
  const voice = sampleVoice();
  const { verdict, adjustment } = model;
  const meters = draftMeterValues(model);
  // One verdict wording everywhere (verdict-copy.js): app, /t, card, meta, share text.
  const copy = verdictCopy(verdict);
  // The headline is the full line ("Lopsided · Give side worth 89% more"), like the card.
  const label = bothSides ? copy.line : copy.label;
  const sharedView = bothSides ? sharedVerdictFor(view) : null;
  // RECHECK4: on a cold /t the bars are sized on the credited totals the
  // verdict compares, with the stars credit as its own segment.
  const bars = sharedBarSegments(model, sharedView ? null : meters);
  const maxSide = Math.max(bars.give.total, bars.get.total, 1);
  // Same metric and bands as the headline (verdict-copy.js).
  const evenUp = bothSides && (copy.more == null || copy.more > EVEN_UP_OFFER_ABOVE) ? findEvenUpPick(view) : null;
  const evenSide = verdict.gap > 0 ? (voice ? voice.youGive : "You") : (view.partner ? them : "They");
  const giveLabel = sharedView ? "Give side" : (voice?.giveLabel || "You give");
  const getLabel = sharedView ? "Get side" : (voice?.getLabel || "You get");
  const creditedRows = (adjustment?.side === "left" ? draft.left : draft.right).map((item) => {
    const hit = view.priced?.get(String(item.uid));
    return { name: hit?.asset?.name || item.name || "", value: hit?.value || 0, uid: String(item.uid || "") };
  });
  const best = bestRowName(creditedRows);
  const bestPick = bestRowIsPick(creditedRows);
  return `
    <section class="calc-summary ${bothSides ? (sharedView ? copy.publicTone : copy.tone) : ""}">
      <div class="calc-summary-main">
        <span class="analytics-kicker">Market verdict</span>
        ${sharedView ? renderSharedVerdictHead(sharedView) : `<h3>${verdictLineHtml(label)}</h3>`}
        ${sharedView ? renderVerdictFinePrint(escapeHtml(sharedTotalsLine(model)), `
          ${starsPremiumMarkup(model, { best, pick: bestPick, shared: true })}
          ${evenUp ? `<p class="calc-even"><strong>To make it fair:</strong> ${escapeHtml(evenUpCopy(evenUp, verdict.gap > 0 ? "Give" : "Get"))}</p>` : ""}
          <div class="calc-method">${renderDraftMethod(view)}</div>
        `) : `
        <p>${escapeHtml(giveLabel)} ${formatNumber(model.give)}. ${escapeHtml(getLabel)} ${formatNumber(model.get)}.${!bothSides ? " One side is empty, so this is not a trade yet." : ""}</p>
        ${starsPremiumMarkup(model, { best, pick: bestPick })}
        ${evenUp ? `<p class="calc-even"><strong>Even it up:</strong> ${escapeHtml(evenUpCopy(evenUp, evenSide))}</p>` : ""}
        <details class="calc-method">
          <summary>How this number works</summary>
          ${renderDraftMethod(view)}
        </details>`}
      </div>
      <div class="calc-bars">${bars.give.stars || bars.get.stars ? `
        <p class="calc-legend"><span class="calc-legend-swatch" aria-hidden="true"></span>${escapeHtml(STAR_PREMIUM_KEY)}</p>` : ""}
        <div class="calc-bar team-a${sharedView && copy.side === "Give" ? " is-bigger" : ""}">
          <span>${sharedView && copy.side === "Give" ? `${calcPointer("◀")} ` : ""}${escapeHtml(giveLabel)}</span>
          ${meterTrack(bars.give, maxSide, barLabel("Give", bars.give.listed, bars.give.stars))}
          <strong>${formatNumber(bars.give.total)}</strong>
        </div>
        <div class="calc-bar team-b${sharedView && copy.side === "Get" ? " is-bigger" : ""}">
          <span>${escapeHtml(getLabel)}${sharedView && copy.side === "Get" ? ` ${calcPointer("▶")}` : ""}</span>
          ${meterTrack(bars.get, maxSide, barLabel("Get", bars.get.listed, bars.get.stars))}
          <strong>${formatNumber(bars.get.total)}</strong>
        </div>
      </div>
      <div class="calc-actions">
        ${sharedView ? `<a class="shared-own-btn" href="/trade" data-action="shared-check-own">Check your own trade</a>` : ""}
        ${bothSides && draftShareCode(view) ? `<button type="button" class="ghost-btn btn-sm calc-share" data-action="trade-share">Share trade</button>` : ""}
        ${sharedView ? "" : `<button type="button" class="ghost-btn" data-action="value-clear">Clear both sides</button>`}
        <p class="calc-share-status" role="status" aria-live="polite"></p>
      </div>
    </section>
  `;
}

// Bar segments: listed price plus a separate stars segment. Private /trade
// passes its meters (listed totals) and gets no stars segment.
function sharedBarSegments(model, meters = null) {
  const adj = model?.adjustment;
  const side = (key, listed) => {
    const stars = !meters && adj && (adj.side === "left") === (key === "give") ? Math.round(Number(adj.amount) || 0) : 0;
    const base = Math.round(Number(meters ? meters[key] : listed) || 0);
    return { listed: base, stars, total: base + stars };
  };
  return { give: side("give", model?.give), get: side("get", model?.get) };
}

// A bar with an extra segment carries a text label for screen readers
// ("Give 21,472 including 8,561 for fewer, better players"); the hatch has a visible key.
function meterTrack(seg, maxSide, label = "") {
  const pct = (value) => Math.round((value / maxSide) * 1000) / 10;
  if (!seg.stars) return `<div class="meter-track"><span style="width:${pct(seg.listed)}%"></span></div>`;
  return `<div class="meter-track meter-split" role="img" aria-label="${escapeHtml(label)}"><span style="width:${pct(seg.listed)}%"></span><span class="meter-stars" style="width:${pct(seg.stars)}%"></span></div>`;
}

// ◀/▶ beside the bigger side's bar on wide layouts; a plain dot on phones,
// where the stacked bars leave nothing to point at (RECHECK4).
function calcPointer(arrow) {
  return `<b class="calc-pointer" aria-hidden="true"><span class="calc-pointer-wide">${arrow}</span><span class="calc-pointer-narrow">●</span></b>`;
}

// Cold /t detail line: "Give 19,224 (11,811 + 7,413 for fewer, better players). Get 14,457."
function sharedTotalsLine(model) {
  const adj = model.adjustment;
  return creditedTotalsLine({
    giveListed: model.give,
    getListed: model.get,
    stars: adj ? adj.amount : 0,
    starSide: adj ? (adj.side === "left" ? "give" : "get") : "",
  });
}

// "Lopsided · Give side…": the dot gets real space on screen (the face's
// word space is narrow), while the text stays the plain " · " line.
function verdictLineHtml(line) {
  return String(line || "").split(" · ").map(escapeHtml).join(` <span class="verdict-dot">·</span> `);
}

// Shared link: the verdict line. When prices moved since it was shared, a
// compact two-row compare (sharer's date, then today in bold) and one line.
function renderSharedVerdictHead(shared) {
  if (!shared.shared) {
    const note = shared.missing ? missingBoardNote(shared.date) : "";
    return `<h3>${verdictLineHtml(shared.today.label)}</h3>${note ? `<p class="calc-shared-note">${escapeHtml(note)}</p>` : ""}`;
  }
  return `
    <h3 class="sr-only">Shared on ${escapeHtml(shared.date)}: ${escapeHtml(shared.shared.label)}. Today: ${escapeHtml(shared.today.label)}.</h3>
    <dl class="calc-shared">
      <div><dt>${escapeHtml(shared.date)}</dt><dd>${verdictLineHtml(shared.shared.label)}</dd></div>
      <div class="is-today"><dt>Today</dt><dd><strong>${verdictLineHtml(shared.today.label)}</strong></dd></div>
    </dl>
    <p class="calc-shared-note">Prices moved since this was shared.</p>
  `;
}

function setVerdictInfoOpen(button, open) {
  state.verdictInfoOpen = open;
  button.setAttribute("aria-expanded", String(open));
  const panel = document.getElementById(button.getAttribute("aria-controls") || "");
  if (panel) panel.hidden = !open;
}

let verdictInfoSeq = 0;
// The method, credit and even-up notes sit behind one ⓘ button on a shared
// link. The button sits inline at the end of the subline (leadHtml).
function renderVerdictFinePrint(leadHtml, inner) {
  verdictInfoSeq += 1;
  const id = `verdict-info-${verdictInfoSeq}`;
  const open = Boolean(state.verdictInfoOpen);
  return `
    <p class="calc-subline">${leadHtml} <button type="button" class="info-toggle verdict-info-toggle" data-action="verdict-info" aria-expanded="${open}" aria-controls="${id}">
      <span aria-hidden="true">ⓘ</span><span class="sr-only">How this verdict works</span>
    </button></p>
    <div class="verdict-fine-print" id="${id}"${open ? "" : " hidden"}>${inner}</div>
  `;
}

// Ids and scoring only. A league pick shares as that round's generic pick.
function draftShareCode(view) {
  const ids = (items) => items.map((item) => String(item.assetId || ""));
  return encodeTradeShare({
    give: ids(view.draft.left),
    get: ids(view.draft.right),
    format: view.basis.format === "oneQb" ? "oneQb" : "sf",
    asOf: state.valueBundles?.asOf || "",
  });
}

const SHARE_STATUS_MS = 4000;
let shareStatusTimer = 0;
let shareInFlight = false;
let shareToastTimer = 0;

// A toast the user can see wherever the button sits (the inline status can scroll away).
function showShareToast(text) {
  if (typeof document === "undefined" || !document.body) return;
  let toast = document.getElementById("share-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "share-toast";
    toast.className = "share-toast";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    document.body.appendChild(toast);
  }
  toast.textContent = text;
  toast.classList.add("is-visible");
  clearTimeout(shareToastTimer);
  shareToastTimer = setTimeout(() => toast.classList.remove("is-visible"), SHARE_STATUS_MS);
}

// A double click shares once.
async function shareDraftTrade(button) {
  if (shareInFlight) return;
  shareInFlight = true;
  try {
    await shareDraftTradeOnce(button);
  } finally {
    shareInFlight = false;
  }
}

async function shareDraftTradeOnce(button) {
  const view = buildDraftView();
  const code = draftShareCode(view);
  const status = button?.closest(".calc-actions")?.querySelector(".calc-share-status");
  const say = (text) => {
    if (!status) return;
    status.textContent = text;
    clearTimeout(shareStatusTimer);
    // "Link copied." and "Shared." clear after about 4s. A link to copy by hand stays.
    if (text && !text.startsWith("Copy this link")) {
      shareStatusTimer = setTimeout(() => {
        if (status.isConnected && status.textContent === text) status.textContent = "";
      }, SHARE_STATUS_MS);
    }
  };
  if (!code) {
    say("This trade can't be shared yet.");
    return;
  }
  const url = new URL(sharePath(code), window.location.origin).href;
  rememberSentShare(code);
  const text = shareMessage(shareSummary(decodeTradeShare(code), state.valueBundles));
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ title: "Dynasty Ticker trade check", text, url });
      trackShareTapped("webshare");
      say("Shared.");
      return;
    } catch (error) {
      if (error?.name === "AbortError") {
        say("");
        return;
      }
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    trackShareTapped("copy");
    say("Link copied.");
    showShareToast("Link copied");
  } catch {
    say(`Copy this link: ${url}`);
  }
}

function buildDraftImpact(view) {
  if (!view.me || !view.partner || !view.context?.ready) return null;
  const assetsFor = (items) => items.map((item) => view.context.items.get(String(item.uid))?.asset).filter(Boolean);
  return enrichTradeIdea({
    idea: {
      myAssets: assetsFor(view.draft.left),
      theirAssets: assetsFor(view.draft.right),
      counterpartyName: view.partner.manager.displayName,
      tags: [],
      summary: "",
      pitch: "",
    },
    myRoster: view.me,
    theirRoster: view.partner,
    values: state.values,
    leagueStrengthBaseline: getCachedLeagueStrengthBaseline({ league: state.league, rosters: state.normalizedRosters, values: state.values }),
    includePowerUpgrade: false,
  });
}

function buildDraftOfferText(view) {
  const list = (items) => items.map((item) => `${item.name} (${formatNumber(view.priceOf(item))})`).join(", ") || "nothing";
  const partnerName = view.partner?.manager?.displayName || "them";
  const { verdict, adjustment } = view.model;
  // Same metric and bands as the headline: "Favors one side · My side worth 25% more".
  const mySide = sampleVoice()?.sideLabel || "my side";
  const line = verdictLineNamed(verdict, { Give: `${mySide.charAt(0).toUpperCase()}${mySide.slice(1)}`, Get: view.partner?.manager?.displayName ? `${partnerName}'s side` : "The other side" });
  const creditSide = adjustment?.side === "left" ? (sampleVoice()?.sideLabel || "my side") : "their side";
  const credit = adjustment ? ` ${fewerBetterOffer(formatNumber(adjustment.amount), creditSide)}` : "";
  return `Trade idea: ${view.me?.manager?.displayName || "I"} sends ${list(view.draft.left)} to ${partnerName} for ${list(view.draft.right)}. Market ${formatNumber(view.give)} vs ${formatNumber(view.get)}.${credit} ${line}. Dynasty Ticker prices, ${rankFormatLabel(view.basis.format)}.`;
}

function renderDraftTeam(view) {
  if (!view.basis.connected) {
    return `
      <section class="draft-team-card">
        <div>
          <span class="analytics-kicker">Your team</span>
          <p>Connect my league to see who owns each piece and what this trade does to both rosters. This trade stays here.</p>
        </div>
        <button type="button" data-action="draft-connect">Connect my league</button>
      </section>
    `;
  }
  const { context, draft } = view;
  const partnerName = view.partner?.manager?.displayName || "";
  const splitNames = (context?.partnerIds || []).map((id) => findNormalizedRoster(id)?.manager?.displayName).filter(Boolean);
  const summary = draftTeamSummary(context, {
    leftCount: draft.left.length,
    rightCount: draft.right.length,
    partnerName,
    splitNames,
    voice: sampleVoice(),
  });
  if (!context?.ready) {
    if (isDraftEmpty(draft)) return "";
    return `
      <section class="draft-team-card is-waiting">
        <div>
          <span class="analytics-kicker">Team impact</span>
          <p>${escapeHtml(summary)}</p>
        </div>
        ${context?.canSwap ? `<button type="button" class="ghost-btn" data-action="draft-swap">Swap sides</button>` : ""}
      </section>
    `;
  }
  const idea = buildDraftImpact(view);
  return `
    <section class="draft-team-card is-ready">
      <div>
        <span class="analytics-kicker">Team impact</span>
        <h3>With ${escapeHtml(partnerName)}</h3>
        <p class="muted small">Starters ${infoTipMarkup({ id: "pop-draft-starters", label: "Starters", text: "Value of your best lineup." })}</p>
      </div>
      <div class="calc-actions">
        <button type="button" class="ghost-btn" data-action="calc-copy" data-offer="${escapeHtml(buildDraftOfferText(view))}">Copy offer text</button>
        <span id="calc-copy-feedback" class="feedback-chip hidden">Copied</span>
      </div>
    </section>
    ${idea?.impactAnalysis ? renderImpactAnalysis(idea.impactAnalysis, state.values) : ""}
  `;
}

function addDraftAsset(side, asset) {
  const next = addValueCalcItem(state.valueCalc, side === "right" ? "right" : "left", asset);
  if (next === state.valueCalc) return false;
  setDraft(next);
  return true;
}

function addDraftFromPlayers(assetId, name, kind) {
  if (!assetId) return;
  const me = state.leagueId ? getMyRoster() : null;
  const placement = state.leagueId
    ? draftSideForAsset(assetId, { rosters: state.normalizedRosters, meRosterId: me ? me.rosterId : null })
    : { side: "left", ownerRosterId: null };
  const hadGet = state.valueCalc.right.length > 0;
  const added = addDraftAsset(placement.side, { assetId, name, assetType: kind === "pick" ? "pick" : "player" });
  if (added && placement.side === "right" && !hadGet && placement.ownerRosterId != null) {
    setDraft({ ...state.valueCalc, partnerRosterId: placement.ownerRosterId });
  }
  openRoom("trades", "calculator");
}

function openCalculatorWith(rosterId) {
  const partner = Number(rosterId);
  const draft = state.valueCalc;
  const context = resolveDraftContext({ draft, rosters: state.normalizedRosters, meRosterId: currentMeRosterId(), leagueId: state.leagueId });
  const otherTeamOnGet = draft.right.some((item) => String(context.items.get(String(item.uid))?.ownerRosterId ?? "") !== String(partner));
  if (otherTeamOnGet) {
    const name = findNormalizedRoster(partner)?.manager?.displayName || "that team";
    replaceDraft({ ...emptyValueCalcState(), partnerRosterId: partner }, `Started a new trade with ${name}.`);
  } else {
    setDraft({ ...draft, partnerRosterId: partner });
  }
  openRoom("trades", "calculator");
}

function openReviewedTrade(encoded) {
  let payload = null;
  try {
    payload = JSON.parse(decodeURIComponent(String(encoded || "")));
  } catch {
    payload = null;
  }
  if (!payload) return;
  const next = draftFromReview(payload, {
    rosters: state.normalizedRosters,
    leagueId: state.leagueId,
    nameFor: (assetId) => state.valueNameMap?.[assetId] || "",
  });
  const partnerName = findNormalizedRoster(next.partnerRosterId)?.manager?.displayName || "";
  replaceDraft(next, partnerName ? `Opened the trade with ${partnerName}.` : "Opened that trade.");
  openRoom("trades", "calculator");
}

function settleCalcSearch(kind, side) {
  const input = document.querySelector(`[data-input="${kind}"][data-side="${side}"]`);
  clearCalcSearchBox(input);
  if (!input) return;
  try {
    input.focus({ preventScroll: true });
  } catch {
    input.focus();
  }
}

function openConnectPrompt() {
  const leaving = !state.leagueId && state.activePage !== "players";
  if (leaving) state.pendingPlace = { page: state.activePage, room: getRoom(state.activePage) };
  if (leaving) setActivePage("players", { history: "push", scroll: "top" });
  document.querySelector("#landing")?.classList.remove("hidden");
  focusUsernameSearch();
}

// ---------------------------------------------------------------------------
// Ticker
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Workspace event delegation
// ---------------------------------------------------------------------------

function armCalcClickSwallow() {
  swallowCalcClick = true;
  clearTimeout(swallowCalcTimer);
  swallowCalcTimer = setTimeout(() => {
    swallowCalcClick = false;
  }, 500);
}

function swallowArmedCalcClick(event) {
  if (!swallowCalcClick) return;
  swallowCalcClick = false;
  clearTimeout(swallowCalcTimer);
  event.preventDefault();
  event.stopPropagation();
}

function pickDraftSuggestion(item) {
  if (!item?.dataset?.assetId) return false;
  const side = item.dataset.side === "right" ? "right" : "left";
  const added = addDraftAsset(side, {
    assetId: item.dataset.assetId,
    name: item.dataset.name,
    assetType: item.dataset.kind === "pick" ? "pick" : "player",
    leagueId: item.dataset.leagueId || "",
  });
  if (!added) return false;
  if (shouldResetCalcSearchOnPick("value-add")) {
    if (side === "right") state.valueCalc.rightQuery = "";
    else state.valueCalc.leftQuery = "";
  }
  patchTradeDraft([side]);
  settleCalcSearch("value-search", side);
  return true;
}

function calcSearchList(side) {
  return el.calculatorShell?.querySelector(`#${calcListDomId(side)}`) || null;
}

function collapseCalcSearch(side) {
  const list = calcSearchList(side);
  const input = document.querySelector(`[data-input="value-search"][data-side="${side}"]`);
  if (list) setCalcListOpen(list, false);
  if (input) syncCalcCombobox(input, { open: false });
}

function revealCalcSuggestions(input, side) {
  const list = calcSearchList(side);
  if (!list || list.classList.contains("is-closed")) return;
  setCalcListOpen(list, true);
  const active = list.querySelector(".calc-item.is-active");
  syncCalcCombobox(input, {
    open: Boolean(list.querySelector("[role='option']")),
    activeId: active?.id || "",
  });
}

function handleCalcSearchFocus(event) {
  const search = event.target?.closest?.("[data-input='value-search']");
  if (!search || !el.workspace?.contains(search)) return;
  const side = search.dataset.side === "right" ? "right" : "left";
  revealCalcSuggestions(search, side);
}

function handleWorkspaceKeydown(event) {
  if (event.isComposing) return;
  const search = event.target?.closest?.("[data-input='value-search']");
  if (search && el.workspace?.contains(search)) {
    const side = search.dataset.side === "right" ? "right" : "left";
    const result = handleCalcComboboxKey(event, {
      input: search,
      list: calcSearchList(side),
      root: el.calculatorShell,
      side,
    });
    if (result.action === "pick" && pickDraftSuggestion(result.item)) collapseCalcSearch(side);
    if (result.handled) return;
  }
  if (event.key !== "Enter" && event.key !== " ") return;
  const target = event.target.closest("[data-action][role='button']");
  if (!target || event.target !== target || !el.workspace?.contains(target)) return;
  event.preventDefault();
  target.click();
}

function handleWorkspacePointerDown(event) {
  if (!shouldArmCalcSuggestion(event, document)) {
    if (!shouldHoldCalcSearchFocus(event, document)) return;
    event.preventDefault();
    return;
  }
  event.preventDefault();
  armCalcClickSwallow();
  pickDraftSuggestion(calcSuggestionItem(event));
}

function handleWorkspaceClick(event) {
  const target = event.target.closest("[data-action]");
  const inWorkspace = Boolean(target && el.workspace?.contains(target));
  const inBoard = Boolean(target && el.boardTools?.contains(target));
  if (!target || (!inWorkspace && !inBoard)) return;
  if (target.dataset.action === "league-home") return;
  const action = target.dataset.action;
  switch (action) {
    case "go": {
      if (target.dataset.room === "mock") state.mockFocus = null;
      openRoom(target.dataset.page, target.dataset.room);
      if (target.dataset.openMock === "1" || target.dataset.room === "mock") {
        window.requestAnimationFrame(() => {
          const fold = document.querySelector("#mock-fold");
          if (!fold) return;
          fold.open = true;
          fold.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
      break;
    }
    case "open-public-ranks":
      openPlayerBoard();
      break;
    case "retry-player-metadata":
      retryPlayerMetadata(event);
      break;
    case "find-my-leagues":
      if (leagueMissing || sleeperUnreachable) {
        openLandingFromMissingLeague();
        break;
      }
      if (!state.leagueId) document.querySelector("#landing")?.classList.remove("hidden");
      if (bootIsPending()) {
        queueFindForBoot(String(el.sleeperUsername?.value || el.landingUsername?.value || ""));
        break;
      }
      openSampleConnect();
      break;
    case "dismiss-sample-banner":
      sampleBannerOff = true;
      renderSessionSnapshot();
      focusAfterSampleBannerDismiss(document);
      break;
    case "rank-open": {
      const id = String(target.dataset.assetId || "");
      if (!isRankAssetId(id)) return;
      if (state.ranks.selectedId === id) {
        if (!closeHistoryOverlay("player")) {
          state.ranks.selectedId = "";
          renderRankSurfaces();
          updateUrlState({ mode: "replace" });
        }
        return;
      }
      routeFocus.remember(target);
      prepareDeskPush();
      state.ranks.selectedId = id;
      // Hide the landing after the history entry is saved, then drop launch chrome
      // so the player card is on screen. Back still returns to the landing.
      document.querySelector("#landing")?.classList.add("hidden");
      renderRankSurfaces();
      updateUrlState({ mode: "push" });
      syncLaunchChrome();
      document.querySelector(".ranks-card")?.scrollIntoView({ block: "nearest" });
      break;
    }
    case "rank-close":
      if (!closeHistoryOverlay("player")) {
        state.ranks.selectedId = "";
        renderRankSurfaces();
        updateUrlState({ mode: "replace" });
      }
      break;
    case "player-back":
      if (backTarget({ pushed: Boolean(history.state?.pushed) }) === "history" && typeof history.back === "function") {
        history.back();
        break;
      }
      goSiteHome({ history: "push" });
      break;
    case "rank-pos":
      state.ranks.position = target.dataset.pos || "ALL";
      state.ranks.shown = RANK_PAGE_SIZE;
      renderRankSurfaces();
      updateUrlState({ mode: "replace" });
      break;
    case "ranks-more":
      state.ranks.shown = (Number(state.ranks.shown) || RANK_PAGE_SIZE) + RANK_PAGE_SIZE;
      renderRankSurfaces();
      break;
    case "rank-format":
      state.ranks.format = target.dataset.format === "oneQb" ? "oneQb" : "sf";
      rankBoardCache = { key: "", rows: [] };
      renderRankSurfaces();
      updateUrlState({ mode: "replace" });
      break;
    case "rank-calc":
      addDraftFromPlayers(target.dataset.assetId, target.dataset.name, target.dataset.kind);
      break;
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
      openRoom("league", "team");
      el.powerSection?.scrollIntoView({ behavior: "smooth", block: "start" });
      break;
    }
    case "calc-with": {
      openCalculatorWith(target.dataset.rosterId);
      break;
    }
    case "review-trade": {
      openReviewedTrade(target.dataset.trade);
      break;
    }
    case "talk-example": {
      runTradeTalk(target.dataset.say || "");
      break;
    }
    case "talk-add": {
      addTalkChip(target);
      break;
    }
    case "meter-why": {
      draftMeterOpen = !draftMeterOpen;
      const meter = el.calculatorShell?.querySelector("#draft-meter");
      if (meter) meter.innerHTML = renderDraftMeter(buildDraftView());
      break;
    }
    case "meter-full": {
      el.calculatorShell?.querySelector("#value-calc-verdict")?.scrollIntoView({ behavior: "smooth", block: "start" });
      break;
    }
    case "value-add": {
      pickDraftSuggestion(target);
      // Clear the box and close the list so it never covers the verdict.
      collapseCalcSearch(target.dataset.side === "right" ? "right" : "left");
      break;
    }
    case "value-remove": {
      setDraft(removeValueCalcItem(state.valueCalc, target.dataset.side, target.dataset.uid));
      patchTradeDraft(["left", "right"]);
      break;
    }
    case "trade-share": {
      void shareDraftTrade(target);
      break;
    }
    case "verdict-info": {
      setVerdictInfoOpen(target, target.getAttribute("aria-expanded") !== "true");
      break;
    }
    case "shared-edit": {
      // Inputs stay hidden on a cold /t until the recipient asks to edit.
      state.sharedEditing = true;
      if (el.calculatorShell) el.calculatorShell.dataset.sharedEditing = "1";
      target.closest(".shared-trade-cta")?.remove();
      el.calculatorShell?.querySelector("[data-draft-side='left'] [data-input='value-search']")?.focus({ preventScroll: true });
      break;
    }
    case "shared-check-own": {
      event?.preventDefault?.();
      // Drop the share before the draft write. setDraft would otherwise
      // replace /t with /trade, and Back would leave the app.
      state.sharedTrade = null;
      state.sentShare = null;
      draftReplaced = null;
      state.valueCalc = clearValueCalcSides(state.valueCalc);
      writeStoredDraft(state.valueCalc);
      renderTradeDraft();
      updateUrlState({ mode: "push", force: true });
      el.calculatorShell?.querySelector("[data-input='value-search']")?.focus({ preventScroll: true });
      break;
    }
    case "value-clear": {
      if (isDraftEmpty(state.valueCalc)) break;
      replaceDraft(clearValueCalcSides(state.valueCalc), "Cleared both sides.");
      patchTradeDraft(["left", "right"]);
      el.calculatorShell?.querySelectorAll("[data-input='value-search']").forEach((input) => clearCalcSearchBox(input));
      break;
    }
    case "draft-swap": {
      setDraft(swapValueCalcSides(state.valueCalc));
      renderTradeDraft();
      break;
    }
    case "draft-restore": {
      if (!draftReplaced) return;
      const previous = draftReplaced.draft;
      draftReplaced = isDraftEmpty(state.valueCalc) ? null : { draft: state.valueCalc, note: "Switched drafts." };
      setDraft(previous);
      renderTradeDraft();
      break;
    }
    case "draft-dismiss": {
      draftReplaced = null;
      const notice = el.calculatorShell?.querySelector("#draft-notice");
      if (notice) notice.innerHTML = "";
      break;
    }
    case "draft-connect": {
      openConnectPrompt();
      break;
    }
    case "draft-use-league-pick": {
      const uid = target.dataset.uid;
      const item = [...state.valueCalc.left, ...state.valueCalc.right].find((entry) => String(entry.uid) === String(uid));
      const asset = (state.normalizedRosters || []).flatMap((roster) => roster.assets || []).find((entry) => entry.assetId === target.dataset.assetId);
      if (!item || !asset) break;
      setDraft(useLeaguePick(state.valueCalc, uid, asset, state.leagueId));
      renderTradeDraft();
      break;
    }
    case "draft-format": {
      state.ranks.format = target.dataset.format === "oneQb" ? "oneQb" : "sf";
      rankBoardCache = { key: "", rows: [] };
      patchTradeDraft(["left", "right"]);
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
    case "draft-partner": {
      const partner = Number(target.value);
      setDraft({ ...state.valueCalc, partnerRosterId: Number.isFinite(partner) && partner > 0 ? partner : null });
      patchTradeDraft(["right"]);
      break;
    }
    default:
      break;
  }
}

function handleWorkspaceInput(event) {
  const target = event.target.closest("[data-input]");
  if (!target || event.isComposing) return;
  if (target.dataset.input === "value-search") {
    const side = target.dataset.side === "right" ? "right" : "left";
    if (side === "right") state.valueCalc.rightQuery = target.value;
    else state.valueCalc.leftQuery = target.value;
    keepCalcSearchFocused(document, () => refreshDraftSuggestions(side));
    const list = calcSearchList(side);
    setCalcListOpen(list, true);
    revealCalcSuggestions(target, side);
  }
  if (target.dataset.input === "ranks-search") {
    state.ranks.query = target.value;
    state.ranks.shown = RANK_PAGE_SIZE;
    const host = target.closest("#ranks-dashboard, #public-ranks-board") || el.ranksDashboard;
    clearTimeout(ranksSearchTimer);
    ranksSearchTimer = setTimeout(() => {
      renderRankHost(host);
      updateUrlState({ mode: "replace" });
    }, 180);
  }
}

// ---------------------------------------------------------------------------
// History: Hall, Seasons, Records
// ---------------------------------------------------------------------------

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

function buildManagerKey(userId, leagueId, rosterId) {
  return resolveRosterIdentity(getFranchiseIndex(), { userId, leagueId, rosterId }).managerKey;
}

function extractRosterDecimalStat(roster, wholeKey, decimalKey) {
  const settings = roster?.settings || {};
  return sleeperPoints(settings[wholeKey], settings[decimalKey]) ?? 0;
}

function average(values) {
  const numericValues = values.filter(Number.isFinite);
  if (numericValues.length === 0) return 0;
  return numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length;
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
  const weakestPosition = positionSummaries
    .filter((row) => !positionRoomIsCovered(roster, values, league, row.position))
    .sort((a, b) => a.percentile - b.percentile)[0] || null;
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
    .sort(compareOwnedPickValue);
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
    leadFirst: chooseLeadPick(pickEntries.filter((entry) => isFirstRoundPick(entry.asset))),
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

function positionRoomIsCovered(roster, values, league, position) {
  const demand = getPositionStarterDemand(league, position);
  const startable = countStartableAtPosition(
    roster?.assets,
    position,
    (asset) => getAssetValue(asset, values),
    (asset) => playerPositionsForAsset(asset),
  );
  return startable >= demand;
}

function buildPositionPowerSummary(roster, values, league, context, position) {
  const value = calculateRosterPositionValue(roster, values, league, position);
  const percentile = percentileFromValues(context.positionValuesByPosition.get(position) || [], value);
  const rank = rankValueDescending(context.positionValuesByPosition.get(position) || [], value);
  const covered = positionRoomIsCovered(roster, values, league, position);
  const label = covered
    ? "stable"
    : percentile >= 0.72
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
      return { id: "fragile-contender", label: "Contender, thin depth" };
    }
    return { id: "contender", label: "Contender" };
  }
  if (rank >= bottomTierStart && (pickPercentile >= 0.58 || assetSummary.youthCount >= assetSummary.veteranCount)) {
    return { id: "rebuild", label: "Rebuilding well" };
  }
  if (score >= 78) return { id: "playoff-hunter", label: "Playoff team" };
  return { id: "middle", label: "Middle of the pack" };
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

function laterFirstHint(lead, roster) {
  const season = state.league?.season;
  const onLead = valuedAsMidFirstHint(lead, season);
  if (onLead) return onLead;
  const later = (roster?.assets || []).some((asset) => valuedAsMidFirstHint(asset, season));
  return later ? "Later 1sts are valued as a mid 1st." : "";
}

function inlineMidFirstHint(hint) {
  const text = String(hint || "").trim().replace(/\.+$/, "");
  return text ? ` (${text})` : "";
}

function draftAmmoInsight(firstRoundPickCount, lead, roster = null) {
  if (!(Number(firstRoundPickCount) > 0)) return null;
  const nextYear = Number(state.league?.season) + 1;
  const leadSeason = Number(lead?.raw?.season);
  const leadSlot = Number(lead?.raw?.projectedDraftSlot);
  const waitingOnSlot = leadSeason === nextYear && !(leadSlot > 0);
  const leadReady = state.pickProjectionReady && pricesReady() && Boolean(lead?.name) && !waitingOnSlot;
  if (!leadReady) {
    return {
      title: "Your picks",
      body: "Calculating…",
      tone: "gold",
      busy: true,
    };
  }
  const count = Number(firstRoundPickCount);
  const hint = inlineMidFirstHint(laterFirstHint(lead, roster));
  return {
    title: "Your picks",
    body: `${count} first-round pick${count === 1 ? "" : "s"} owned, led by ${lead.name}${hint}.`,
    tone: "gold",
  };
}

function draftAmmoInsightForRoster(roster) {
  const firsts = (roster?.assets || []).filter((asset) => isFirstRoundPick(asset));
  const lead = chooseLeadPick(firsts.map((asset) => ({
    asset,
    value: getAssetValue(asset, state.values),
  })));
  return draftAmmoInsight(firsts.length, lead, roster);
}

function buildSleeperInsightCards(profile, context) {
  const insights = [];
  const formatInsight = describeLeagueFormat(context.league);
  insights.push({
    title: "League Format",
    body: formatInsight,
    tone: "blue",
    tipHtml: tepLevel(context.league) > 0
      ? infoTipMarkup({ id: "pop-league-format", label: "Scoring", text: "Values use 1 point per catch at every position, even with the TE bonus." })
      : "",
  });

  if (profile.strongestPosition) {
    insights.push({
      title: "Your strongest spot",
      body: `${profile.strongestPosition.position} ranks ${profile.strongestPosition.rankLabel} by starter-caliber value.`,
      tone: "green",
    });
  }

  if (profile.weakestPosition && profile.weakestPosition.percentile <= 0.42) {
    insights.push({
      title: "Upgrade Quest",
      body: `${profile.weakestPosition.position} is ${sampleVoice()?.cleanestPath || "your cleanest path to a power jump."}`,
      tone: "gold",
    });
  }

  const ammo = draftAmmoInsight(profile.assetSummary.firstRoundPickCount, profile.assetSummary.leadFirst);
  if (ammo) {
    if (ammo.body.includes("led by") && !ammo.body.includes("valued as a mid 1st")) {
      const hint = inlineMidFirstHint(laterFirstHint(profile.assetSummary.leadFirst, findNormalizedRoster(profile.rosterId)));
      if (hint) ammo.body = ammo.body.replace(/\.\s*$/, `${hint}.`);
    }
    insights.push(ammo);
  }

  if (state.tradedPicks.length > 0) {
    insights.push({
      title: "Pick trades",
      body: `${state.tradedPicks.length} traded pick record${state.tradedPicks.length === 1 ? "" : "s"} loaded from Sleeper for this league.`,
      tone: "blue",
    });
  }

  if (profile.assetSummary.injuredCount > 0) {
    insights.push({
      title: "Injured players",
      body: `${profile.assetSummary.injuredCount} rostered player${profile.assetSummary.injuredCount === 1 ? "" : "s"} carry an injury/status flag in Sleeper metadata.`,
      tone: "rose",
    });
  }

  const trendInsight = buildTrendingInsight(profile);
  if (trendInsight) insights.push(trendInsight);

  if (profile.assetSummary.teamStack) {
    insights.push({
      title: "Same-team stack",
      body: `${profile.assetSummary.teamStack.entries.length} top roster pieces are tied to ${profile.assetSummary.teamStack.team}.`,
      tone: "blue",
    });
  }

  return insights.slice(0, 7);
}

function describeLeagueFormat(league) {
  const slots = getStarterRosterSlots(league);
  const hasSuperflex = leagueHasSuperflex(league);
  const scoring = league?.scoring_settings || {};
  const receptionValue = Number(scoring.rec);
  const pprLabel = Number.isFinite(receptionValue)
    ? receptionValue > 0
      ? `${receptionValue} ${receptionValue === 1 ? "point" : "points"} per catch`
      : "standard"
    : "custom scoring";
  const taxiSlots = Number(league?.settings?.taxi_slots || 0);
  const draftRounds = Number(league?.settings?.draft_rounds || 0);
  const parts = [
    leagueTypeLabel(league),
    hasSuperflex ? "Superflex" : "1-QB",
    pprLabel,
    `${slots.length} starters`,
  ];
  if (tepLevel(league) > 0) parts.push("TE bonus");
  if (leagueKeepsPlayers(league) && taxiSlots > 0) parts.push(`${taxiSlots} taxi spots`);
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
      title: "Rising on Sleeper",
      body: `${formatTrendingPlayerName(hotRosterPlayer, "adds")} ${sampleVoice()?.heatOnRoster || "is on your roster"} and trending up on Sleeper adds.`,
      tone: "green",
    };
  }
  if (coldRosterPlayer) {
    return {
      title: "Market Risk",
      body: `${formatTrendingPlayerName(coldRosterPlayer, "drops")} ${sampleVoice()?.heatOnRoster || "is on your roster"} and showing up in Sleeper drops.`,
      tone: "rose",
    };
  }
  return {
    title: "Rising on Sleeper",
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

function syncMatchGenerateState() {
  const ready = Boolean(state.meRosterId && state.leagueId);
  if (el.matchGenerateBtn && !el.matchGenerateBtn.classList.contains("loading")) {
    el.matchGenerateBtn.disabled = !ready;
  }
  if (el.matchGenerateHelp) {
    el.matchGenerateHelp.textContent = !state.leagueId
      ? "Connect my league and pick your team."
      : !state.meRosterId
        ? "Choose your team first."
        : "Looks at holes, surplus, and contend vs rebuild. No leftover thirds.";
  }
}

function setMatchGenerateError(message) {
  setFieldError(null, el.matchGenerateError, message);
}

function syncFindGuestChrome(guest) {
  document.querySelector("#match-action-panel")?.classList.toggle("hidden", guest);
  document.querySelector("#player-section")?.classList.toggle("hidden", guest);
  document.querySelector("#settings-section")?.classList.toggle("hidden", guest);
}

function renderTradeMatchRoom() {
  if (!state.leagueId) {
    syncFindGuestChrome(true);
    paintConnectGate(el.tradeMatchNeeds, "Connect your league to see trade partners. The trade checker works without it.");
    clearHost(el.tradeMatchDashboard);
    return;
  }
  syncFindGuestChrome(false);
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
    el.tradeMatchNeeds.innerHTML = `<p class="muted">${escapeHtml(sampleVoice()?.matchNeedsEmpty || "Pick your team. We find a partner who has your holes. Calculator is one tap away.")}</p>`;
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
    mine.timeline === "contending" ? "Contending" : mine.timeline === "rebuilding" ? "Rebuilding" : "In between",
  ].filter(Boolean);
  const needLine = mine.needs.length
    ? `Holes: ${mine.needs.map((row) => `${row.position} (${row.rankLabel || row.grade})`).join(", ")}.`
    : "No loud positional hole. Match will look for a contend/rebuild window instead.";
  const spareWho = sampleVoice()?.youGive || "You";
  const surplusLine = mine.surplus.length
    ? `${spareWho} can spare ${mine.surplus.map((row) => row.position).join(", ")}.`
    : (sampleVoice()?.surplusFallback || "No obvious surplus; any deal still has to help your starters.");
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
    el.tradeMatchDashboard.innerHTML = `<p class="muted">${escapeHtml(sampleVoice()?.matchDashboardEmpty || "Find a partner who has your holes, or open Find deals to shop a name. Calculator is one tap away.")}</p>`;
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
      state.tradeMatch.error = "Still loading players. One sec.";
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
      state.tradeMatch.payload = { groups: [], emptyText: sampleVoice()?.gradeRoster || "Could not grade your roster for match." };
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
        voice: sampleVoice(),
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
        if (pctDiff > ideaLimitMore(Math.max(fairnessPct, 26))) return;
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
        ? (sampleVoice()?.matchEmptyBalanced || "No complementary windows jumped out. Your roster may already be balanced, or the league is clustered the same way.")
        : (sampleVoice()?.matchEmptyLineup || "Those complementary teams showed up, but no package helped your lineup without leftover thirds."),
    };
  } catch (err) {
    state.tradeMatch.error = `Could not build matches. ${err.message}`;
    state.tradeMatch.payload = null;
  } finally {
    state.tradeMatch.loading = false;
    setButtonLoading(el.matchGenerateBtn, false);
    syncMatchGenerateState();
    if (state.activePage === "trades" && getRoom("trades") === "find") {
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
    benefit: idea.pitch || idea.summary || "",
  });
  return `
    <article class="match-trade-card">
      <p class="match-trade-offer">${escapeHtml(copy.offer)}</p>
      ${copy.why ? `<p class="match-trade-rank">${escapeHtml(copy.why)}</p>` : ""}
      ${copy.rank ? `<p class="match-trade-rank">${escapeHtml(copy.rank)}</p>` : ""}
      ${renderReviewTradeButton(idea)}
    </article>
  `;
}

function renderReviewTradeButton(idea) {
  const payload = encodeURIComponent(JSON.stringify(reviewPayloadFor(idea)));
  return `<button type="button" class="ghost-btn" data-action="review-trade" data-trade="${payload}">Review trade</button>`;
}

function renderImpactAnalysis(impactAnalysis, values) {
  return `
    <div class="impact-overview">
      ${renderImpactCard(impactAnalysis.mySide, "team-a")}
      ${renderImpactCard(impactAnalysis.theirSide, "team-b")}
    </div>
    <p class="muted small">${escapeHtml(impactAnalysis.overallSummary)}</p>
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
  const verdictClass = String(side.verdictClass || "").replace(/[^A-Za-z0-9_-]/g, "");
  return `
    <section class="impact-card ${teamClass}">
      <h4>${escapeHtml(side.title)}</h4>
      <span class="impact-verdict ${verdictClass}">${escapeHtml(side.verdictLabel)}</span>
      <p class="impact-summary">${escapeHtml(side.summary)}</p>
      <div class="impact-metric-list">
        <div class="impact-metric-row">
          <strong>Starter rank</strong>
          <span>${formatStarterRank(side.before.rank, side.before.totalTeams)} to ${formatStarterRank(side.after.rank, side.after.totalTeams)}</span>
        </div>
        <div class="impact-metric-row">
          <strong>Starters</strong>
          <span>${formatDeltaPair(side.before.starterValue, side.after.starterValue)}</span>
        </div>
        <div class="impact-metric-row">
          <strong>Bench</strong>
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
              <span class="lineup-slot-player">${slotEntry.asset ? renderPlayerLabel(slotEntry.asset.name, facePlayerId(slotEntry.asset), { size: "sm" }) : "Open spot"}</span>
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
                <span class="lineup-slot-player">${renderPlayerLabel(asset.name, facePlayerId(asset), { size: "sm" })}</span>
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

function leagueBoardCacheKey(rosters = state.normalizedRosters) {
  const rosterSig = (rosters || [])
    .map((roster) => `${roster.rosterId}:${(roster.assets || []).map((asset) => asset.assetId).join(",")}`)
    .join("|");
  return [
    state.league?.league_id || state.leagueId || "",
    valuationCacheVersion(),
    state.playerMetadataLoaded ? "players" : "names",
    rosterSig,
  ].join("::");
}

function peekLeaguePowerBoard() {
  const key = leagueBoardCacheKey();
  if (powerBoardCache.key === key && powerBoardCache.profiles && powerBoardCache.context) return powerBoardCache;
  return null;
}

function getLeaguePowerBoard() {
  if (!state.league || state.normalizedRosters.length === 0) {
    return { key: "", profiles: [], context: null };
  }
  const key = leagueBoardCacheKey();
  if (powerBoardCache.key === key && powerBoardCache.profiles && powerBoardCache.context) return powerBoardCache;
  const baseline = getCachedLeagueStrengthBaseline({
    league: state.league,
    rosters: state.normalizedRosters,
    values: state.values,
  });
  const context = buildLeaguePowerContext({
    league: state.league,
    rosters: state.normalizedRosters,
    values: state.values,
    metricsByRosterId: baseline.metricsByRosterId,
  });
  const profiles = state.normalizedRosters
    .map((roster) => buildTeamPowerProfile({
      roster,
      values: state.values,
      league: state.league,
      context,
      metrics: baseline.metricsByRosterId.get(roster.rosterId),
      rank: context.ranks.get(roster.rosterId),
    }))
    .sort((a, b) => b.score - a.score || a.rank - b.rank || a.managerName.localeCompare(b.managerName));
  powerBoardCache.key = key;
  powerBoardCache.profiles = profiles;
  powerBoardCache.context = context;
  return powerBoardCache;
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
    state.playerMetadataLoaded ? "players" : "names",
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
    title: state.viewingSample ? "Viewing" : "You",
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
  if (afterProfile.assetSummary.pickValue > beforeProfile.assetSummary.pickValue + 800) badges.push("Draft picks up");
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
      : (sampleVoice()?.powerFlat || "keeps your power score flat"));

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
    return { label: "Stronger starting lineup", className: "good" };
  }
  if (afterRank > beforeRank || starterDelta <= -350) {
    return { label: "Weaker starting lineup", className: "bad" };
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
    return sampleVoice()?.strengthens || `This trade strengthens your starting lineup while making theirs weaker or thinner.`;
  }
  if (!myImproved && theirImproved) {
    return sampleVoice()?.helpsThemMore || `This trade helps their starting lineup more than yours, even if the value stays close.`;
  }
  if (myImproved && theirImproved) {
    return `This trade improves both starting lineups, so the deal is more about which team values the target archetype most.`;
  }
  return `Neither starting lineup changes much. This is mostly a value or depth move for both sides.`;
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
  // Starter XP is dynasty price. This week's start chance belongs to sit/start only.
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
    .map((asset) => ({ asset, value: getAssetValue(asset, values) }))
    .sort((a, b) => b.value - a.value);

  const candidates = buildLineupCandidatePool(playerEntries, starterSlots);
  const slotEntries = starterSlots
    .map((slot, index) => ({ slot, index }))
    .sort((left, right) => {
      const eligibleDiff = countEligibleCandidates(candidates, left.slot) - countEligibleCandidates(candidates, right.slot);
      if (eligibleDiff !== 0) return eligibleDiff;
      return getSlotFlexWeight(left.slot) - getSlotFlexWeight(right.slot);
    });

  const bestPlan = chooseBestLineup(
    slotEntries,
    candidates,
    (candidate, slot) => assetCanFillRosterSlot(candidate.asset, slot),
  ) || chooseGreedyLineup(slotEntries, candidates);
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

function plainRosterStatus(status) {
  const key = String(status || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (key === "ir" || key === "injured_reserve") return "Injured reserve";
  return String(status || "").trim();
}

function formatRosterSlotLabel(slot) {
  const labels = {
    SUPER_FLEX: "Superflex",
    SUPERFLEX: "Superflex",
    SF: "Superflex",
    BN: "Bench",
    BENCH: "Bench",
    IR: "Injured reserve",
    REC_FLEX: "Rec Flex",
    WRRB_FLEX: "RB/WR",
    RBWR_FLEX: "RB/WR",
    WRTE_FLEX: "WR/TE",
    FLEX: "Flex",
  };
  const key = String(slot || "").trim().toUpperCase();
  return labels[key] || String(slot || "").replace(/_/g, " ");
}

function sheetSlotMarkup(slot, slotLabel) {
  const key = String(slot || "").trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (key === "SUPER_FLEX" || key === "SUPERFLEX" || key === "SF") {
    return `<span class="sheet-slot sheet-slot-superflex"><span class="sheet-slot-full">Superflex</span><abbr class="sheet-slot-short" title="Superflex">SF</abbr></span>`;
  }
  return `<span class="sheet-slot">${escapeHtml(slotLabel || "")}</span>`;
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

function buildFallbackTradeTags(idea) {
  const tags = [];
  if (idea.powerUpgrade?.delta >= 5) tags.push("Power Spike");
  if (idea.powerUpgrade?.delta > 0) tags.push("Upgrade");
  if (idea.theirAssets?.length < idea.myAssets?.length) tags.push("Consolidation");
  if (idea.theirAssets?.length > idea.myAssets?.length) tags.push("Depth Return");
  if (idea.theirAssets?.some(isFirstRoundPick) || idea.myAssets?.some(isFirstRoundPick)) tags.push("Pick Leverage");
  if (idea.pctDiff <= oldPctToMore(6)) tags.push("Tight Value");
  if (tags.length === 0) tags.push("Fair Market");
  return [...new Set(tags)].slice(0, 4);
}

function buildFallbackTradeSummary(idea) {
  if (idea.powerUpgrade?.summary) return idea.powerUpgrade.summary;
  const incoming = formatAssetNameList(idea.theirAssets || []);
  const outgoing = formatAssetNameList(idea.myAssets || []);
  return `${outgoing} turns into ${incoming}; after adjustments one side is worth ${idea.pctDiff}% more.`;
}

function buildFallbackTradePitch(idea) {
  const incoming = formatAssetNameList(idea.theirAssets || []);
  const outgoing = formatAssetNameList(idea.myAssets || []);
  if (idea.powerUpgrade?.delta > 0) {
    return `I can move ${outgoing} because ${incoming} gives my roster a cleaner weekly build without pushing the value out of range.`;
  }
  return `This is close enough on value to be a real conversation, but I would treat it as a preference deal rather than a must-send offer.`;
}

function isVeteranAsset(asset) {
  if (asset.assetType !== "player") return false;
  const age = playerAgeForAsset(asset);
  const position = playerPositionForAsset(asset);
  if (!Number.isFinite(age)) return false;
  if (position === "RB") return age >= 26;
  return age >= 28;
}

function setButtonLoading(button, isLoading, loadingText = "Loading...") {
  if (!button) return;
  if (!button.dataset.defaultLabel) button.dataset.defaultLabel = button.textContent;
  button.disabled = isLoading;
  button.classList.toggle("loading", isLoading);
  button.textContent = isLoading ? loadingText : button.dataset.defaultLabel;
}

function valuesFreshness(now = new Date()) {
  return valuesUpdatedStatus(valuationStamp(state.valueBundles), now);
}

function renderPlayerValueMarks(asset, values = state.values, { soon = false, spark = false } = {}) {
  if (asset?.assetType === "pick" || isEstimatedAsset(asset, values)) return "";
  const value = getAssetValue(asset, values);
  const trend = playerValueTrend(state.valueHistory, asset.assetId, state.valueFormat || "sf");
  const trendHtml = trend ? renderValueTrend(trend, { spark }) : (soon ? renderTrendSoon() : "");
  return `${renderValueTierBadge(value)}${trendHtml}`;
}

function renderPickVaultRow(asset, values) {
  const hint = valuedAsMidFirstHint(asset, state.league?.season);
  const body = `
              <span class="sheet-slot">${escapeHtml(String(asset?.raw?.season || ""))}</span>
              <div class="sheet-player"><strong>${escapeHtml(asset?.name || "Pick")}</strong>${hint ? `<span class="pick-value-hint">${escapeHtml(hint)}</span>` : ""}</div>
              <span class="sheet-value mono">${renderAssetValuePlain(asset, values)}</span>
          `;
  return `
            <div class="sheet-row pick">
              ${body}
            </div>
          `;
}

function renderAssetValuePlain(asset, values = state.values) {
  if (!values || Object.keys(values).length === 0) return "…";
  return isEstimatedAsset(asset, values) ? "Unavailable" : formatNumber(getAssetValue(asset, values));
}

function getPlayerPositionRankLabel(asset) {
  if (asset?.assetType !== "player") return "";
  return state.playerPositionRankByAssetId[asset.assetId] || "";
}

function formatPlayerPositionLabel(asset) {
  return getPlayerPositionRankLabel(asset) || playerPositionForAsset(asset) || "Player";
}

function refreshPlayerPositionRanks() {
  const values = state.values && Object.keys(state.values).length ? state.values : formatMarketValues();
  const names = state.valueNameMap || state.valueBundles?.names || {};
  const nflPlayers = state.players && Object.keys(state.players).length
    ? state.players
    : (playerNoteContext.nflPlayers || {});
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
  buildPositionBoard(listed, nflPlayers).forEach((row) => {
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

function normalizeRosterIdKey(value) {
  if (value == null || value === "") return null;
  return String(value);
}

function playerAssetsForRoster(roster, players) {
  return (roster.players || []).map((playerId) => {
    const p = players[playerId] || {};
    const name = playerDisplayName(playerId, p, state.valueNameMap);
    return {
      assetId: `player:${playerId}`,
      name,
      assetType: "player",
      raw: p,
    };
  });
}

// Slots come from projectPickSlots once the table is final. Roster settings
// are that table when every roster has wins, losses, and points. Week rows
// are used only when Sleeper did not send that table. A partial week chunk
// is not a place. Starter value breaks only a tied record.
let projectedPlaceState = { key: "", lookup: null };
let projectedPickKey = "";

function settledPickStandings(rosters, strengthByRosterId = null) {
  if (!state.pickProjectionReady) return { settled: false, rosters };
  if (rosterRecordsReady(rosters)) {
    return { settled: true, rosters, rows: [], strengthByRosterId };
  }
  const model = getSeasonModel();
  return {
    settled: true,
    rosters,
    rows: model?.hasComputedGames ? model.standings : [],
    strengthByRosterId,
  };
}

function lookupFromSlots(slots) {
  const byRosterId = new Map();
  slots?.forEach((row, id) => {
    byRosterId.set(id, { rank: row.rank, total: row.total, label: row.placeLabel });
  });
  return { byRosterId, total: slots?.size || 0 };
}

function projectedPlaceKey() {
  const settings = (state.rosters || []).map((roster) => [
    roster?.roster_id,
    roster?.settings?.wins,
    roster?.settings?.losses,
    roster?.settings?.ties,
    roster?.settings?.fpts,
    roster?.settings?.fpts_decimal,
    roster?.settings?.fpts_against,
    roster?.settings?.fpts_against_decimal,
  ].join(":")).join(",");
  return [
    state.leagueId,
    weekRowsFingerprint(state.seasonWeekRows),
    state.nflState?.week ?? "",
    state.nflState?.season_type ?? "",
    state.seasonLoaded ? 1 : 0,
    state.playerMetadataLoaded ? 1 : 0,
    valuationCacheVersion(),
    settings,
  ].join("|");
}

function rosterStrengthById(rosters = state.normalizedRosters) {
  if (!state.values || Object.keys(state.values).length === 0) return null;
  const map = new Map();
  (rosters || []).forEach((roster) => {
    const playerAssets = (roster.assets || []).filter((asset) => asset.assetType === "player");
    const metrics = evaluateRosterStrength({ assets: playerAssets }, state.values, state.league);
    const id = roster.rosterId ?? roster.roster_id;
    map.set(String(id), {
      starterValue: metrics.starterValue,
      benchValue: metrics.benchValue,
    });
  });
  return map.size ? map : null;
}

function currentProjectedPlaceLookup() {
  if (!state.pickProjectionReady) return { byRosterId: new Map(), total: 0 };
  const key = projectedPlaceKey();
  if (projectedPlaceState.key === key && projectedPlaceState.lookup) return projectedPlaceState.lookup;
  const slots = projectPickSlots(state.league, settledPickStandings(state.rosters, rosterStrengthById()));
  const lookup = lookupFromSlots(slots);
  projectedPlaceState = { key, lookup };
  return lookup;
}

function pickProjectionContext(placeLookup, previousContext = null) {
  const userById = new Map((state.users || []).map((user) => [String(user.user_id), user]));
  const rosterById = new Map((state.rosters || []).map((roster) => [String(roster.roster_id), roster]));
  const previousLeague = previousContext?.league ?? state.previousLeague;
  const previousRosters = previousContext?.rosters ?? state.previousRosters;
  return {
    userById,
    rosterById,
    previousFinishLookup: buildPreviousFinishLookup(previousLeague, previousRosters),
    currentDraftContext: state.currentDraftContext,
    previousLeague,
    placeLookup,
    rosterCount: state.rosters.length,
  };
}

function buildProjectedPickAsset(pick, ctx) {
  const finishInfo = resolvePreviousFinishInfo(pick.original_owner, ctx.rosterById, ctx.previousFinishLookup);
  const assignedDraftSlot = resolveAssignedDraftSlot(
    pick,
    ctx.currentDraftContext,
    finishInfo,
    ctx.previousLeague,
  );
  if (isConsumedDraftPick(pick, ctx.currentDraftContext, assignedDraftSlot)) return null;
  const place = currentPlaceForOwner(pick.original_owner, ctx.placeLookup);
  const projection = resolvePickProjection({
    season: pick.season,
    round: pick.round,
    leagueSeason: state.league?.season,
    place,
    assignedSlot: assignedDraftSlot?.slot,
    assignedTotal: assignedDraftSlot?.totalSlots || place?.total || ctx.rosterCount,
  });
  const pickBucket = projection.valueBucket;
  return {
    assetId: `pick:${pick.season}:r${pick.round}:${pick.original_owner || "any"}`,
    valueAssetId: buildPickValueAssetId(pick, pickBucket),
    valueBucket: pickBucket,
    name: formatPickName(pick, {
      userById: ctx.userById,
      rosterById: ctx.rosterById,
      assignedDraftSlot,
      currentPlaceLookup: ctx.placeLookup,
    }),
    assetType: "pick",
    raw: {
      ...pick,
      ktcBucket: pickBucket,
      assignedDraftSlot: assignedDraftSlot?.slot ?? null,
      assignedDraftSlotLabel: assignedDraftSlot?.label ?? null,
      projectedDraftSlot: projection.slot,
    },
  };
}

// Week chunks must not reprice slots. The first settled table is the only lead.
function refreshProjectedPickSlots() {
  if (!state.league || !state.normalizedRosters?.length || !state.rosters?.length) return false;
  if (!state.pickProjectionReady) return false;
  const key = projectedPlaceKey();
  if (key === projectedPickKey) return false;
  const ctx = pickProjectionContext(currentProjectedPlaceLookup());
  state.normalizedRosters.forEach((roster) => {
    roster.assets = (roster.assets || []).flatMap((asset) => {
      if (asset.assetType !== "pick") return [asset];
      const next = buildProjectedPickAsset(asset.raw, ctx);
      return next ? [next] : [];
    });
  });
  projectedPickKey = key;
  powerBoardCache.key = "";
  return true;
}

function normalizeRosters(league, rosters, users, players, previousContext = { league: null, users: [], rosters: [] }, tradedPicks = [], currentDraftContext = null) {
  if (!state.pickProjectionReady && rosterRecordsReady(rosters)) settlePickProjection();
  const userById = new Map(users.map((u) => [String(u.user_id), u]));
  const rosterById = new Map(rosters.map((roster) => [String(roster.roster_id), roster]));
  const previousFinishLookup = buildPreviousFinishLookup(previousContext.league, previousContext.rosters);
  const ownedPicksByRoster = buildOwnedPicksByRoster(league, rosters, tradedPicks, state.pickValueCatalog, currentDraftContext);
  const playerAssetsByRoster = new Map();
  const strengthByRosterId = new Map();
  const valuesReady = state.values && Object.keys(state.values).length > 0;
  rosters.forEach((roster) => {
    const playerAssets = playerAssetsForRoster(roster, players);
    playerAssetsByRoster.set(String(roster.roster_id), playerAssets);
    if (!valuesReady) return;
    const metrics = evaluateRosterStrength({ assets: playerAssets }, state.values, league);
    strengthByRosterId.set(String(roster.roster_id), {
      starterValue: metrics.starterValue,
      benchValue: metrics.benchValue,
    });
  });
  const slots = projectPickSlots(
    league,
    settledPickStandings(rosters, strengthByRosterId.size ? strengthByRosterId : null),
  );
  const placeLookup = lookupFromSlots(slots);
  const placeKey = projectedPlaceKey();
  projectedPlaceState = { key: slots ? placeKey : "", lookup: placeLookup };
  projectedPickKey = slots ? placeKey : "";
  const pickCtx = {
    userById,
    rosterById,
    previousFinishLookup,
    currentDraftContext,
    previousLeague: previousContext?.league,
    placeLookup,
    rosterCount: rosters.length,
  };

  return rosters.map((roster) => {
    const identity = resolveRosterIdentity(getFranchiseIndex(), {
      userId: ownerIdFromRoster(roster),
      leagueId: league?.league_id || state.leagueId,
      rosterId: roster.roster_id,
    });
    const owner = userById.get(identity.userId) || userById.get(String(roster.owner_id)) || {};
    const playerAssets = playerAssetsByRoster.get(String(roster.roster_id)) || [];

    const pickAssets = (ownedPicksByRoster.get(String(roster.roster_id)) || []).flatMap((pick) => {
      const asset = buildProjectedPickAsset(pick, pickCtx);
      return asset ? [asset] : [];
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

function displayNameForUser(user, fallback) {
  if (!user) return fallback;
  return user.display_name || user.username || fallback;
}

function extractRosterPoints(roster) {
  const settings = roster?.settings || {};
  if (settings.fpts == null) return null;
  return sleeperPoints(settings.fpts, settings.fpts_decimal);
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
      pointsAgainst: pointsAgainstFromSettings(roster?.settings),
    }))
    .sort((a, b) => {
      if (Number.isFinite(a.explicitRank) && Number.isFinite(b.explicitRank)) return a.explicitRank - b.explicitRank;
      if (Number.isFinite(a.explicitRank)) return -1;
      if (Number.isFinite(b.explicitRank)) return 1;
      return compareRosterRecord(a, b);
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
  assignedDraftSlot = null,
  currentPlaceLookup = null,
} = {}) {
  const ownerName = resolvePickOwnerName(pick.original_owner, rosterById, userById);
  const place = currentPlaceForOwner(pick.original_owner, currentPlaceLookup);
  const projection = resolvePickProjection({
    season: pick.season,
    round: pick.round,
    leagueSeason: state.league?.season,
    place,
    assignedSlot: assignedDraftSlot?.slot,
    assignedTotal: assignedDraftSlot?.totalSlots || place?.total,
  });
  return formatPickLabel({
    season: pick.season,
    round: pick.round,
    bucket: projection.nameBucket,
    ownerName,
    rank: projection.rank,
    total: projection.total,
    slot: projection.slot,
  });
}

async function loadValues() {
  state.valueBundles = await fetchValuationBundles();
  state.valueHistory = await fetchPriceHistory();
  return pickValueBundle(state.valueBundles, selectValueFormat(state.league));
}

function primeValuationData() {
  const format = selectValueFormat(state.league);
  if (state.valueBundles?.sf?.values && Object.keys(state.valueBundles.sf.values).length > 0) {
    applyValuationBundle(pickValueBundle(state.valueBundles, format));
    return;
  }
  ensureValuesLoaded("").catch((err) => {
    console.warn("Could not preload valuation data", err);
  });
}

async function ensureValuesLoaded(optionalUrl = "") {
  if (optionalUrl) {
    return applyValuationBundle(await loadValues(), { rerender: false });
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
  state.valuationRevision = Number(state.valuationRevision || 0) + 1;
  state.values = bundle?.values && typeof bundle.values === "object" ? bundle.values : {};
  state.valueNameMap = bundle?.nameMap && typeof bundle.nameMap === "object" ? bundle.nameMap : {};
  state.players = seedPlayerDirectory();
  if (Object.keys(state.players).length > 0) {
    state.playerMetadataLoaded = true;
    state.playerMetadataFailed = false;
  }
  refreshPlayerPositionRanks();
  state.pickValueCatalog = buildPickValuationCatalog(state.values, state.valueNameMap);
  state.globalMaxPlayerValue = getGlobalMaxPlayerValue(state.values);

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

  relabelDraftNames();
  paintLaunchExample();
  if (rerender) {
    requestActivePageRender();
    renderSessionSnapshot();
  }

  return {
    values: state.values,
    nameMap: state.valueNameMap,
  };
}

function showLeagueNotFound() {
  leagueMissing = true;
  hideSleeperUnreachable();
  hideAppPages();
  stopLeagueLoadingUi();
  document.querySelector("#landing")?.classList.add("hidden");
  paintLeagueLoadError("");
  setStatus("");
  const panel = document.getElementById("league-missing");
  if (panel) {
    panel.hidden = false;
    panel.classList.remove("hidden");
  }
  syncLaunchChrome();
  syncDocumentMeta();
  dropFailedLeagueQuery();
  document.getElementById("league-missing-title")?.focus();
}

function openLandingFromMissingLeague() {
  // Keep the outage title on this history entry, then push / with the landing title.
  prepareDeskPush();
  hideSleeperUnreachable();
  hideLeagueNotFound();
  const landing = document.querySelector("#landing");
  if (landing) {
    landing.classList.remove("hidden");
    landing.hidden = false;
  }
  setActivePage("players", { history: "silent", landing: "show", scroll: "top" });
  const box = document.querySelector("#landing-connect");
  if (box) box.hidden = false;
  document.querySelector(".launch-connect")?.setAttribute("hidden", "");
  connectAsked = true;
  syncLaunchChrome();
  syncDocumentMeta();
  if (typeof history?.pushState === "function") {
    history.pushState({
      ...historyPlaceNow(),
      tab: "players",
      landing: true,
      pushed: true,
      connectAsked: true,
    }, "", "/");
  }
  document.getElementById("landing-username")?.focus();
}

function hideLeagueNotFound() {
  const was = leagueMissing;
  leagueMissing = false;
  const panel = document.getElementById("league-missing");
  if (panel) {
    panel.hidden = true;
    panel.classList.add("hidden");
  }
  if (was) {
    syncLaunchChrome();
    syncDocumentMeta();
  }
}

function showInvalidLeagueLink() {
  const message = INVALID_LEAGUE_LINK_MESSAGE;
  setFieldError(el.leagueId, el.leagueIdError, message);
  setStatus(message, { error: true });
  const landing = document.getElementById("landing-league-error");
  const landingText = document.getElementById("landing-league-error-text");
  const retry = document.getElementById("landing-league-retry");
  if (landingText) landingText.textContent = message;
  if (landing) landing.classList.remove("hidden");
  if (retry) retry.classList.add("hidden");
}

function showSleeperUnreachable() {
  sleeperUnreachable = true;
  const missing = document.getElementById("league-missing");
  if (missing) {
    missing.hidden = true;
    missing.classList.add("hidden");
  }
  document.querySelector("#landing")?.classList.add("hidden");
  const panel = document.getElementById("sleeper-down");
  if (panel) {
    panel.hidden = false;
    panel.classList.remove("hidden");
  }
  syncLaunchChrome();
  syncDocumentMeta();
  dropFailedLeagueQuery();
  document.getElementById("sleeper-down-title")?.focus();
}

function hideSleeperUnreachable() {
  if (!sleeperUnreachable) {
    const panel = document.getElementById("sleeper-down");
    if (panel) {
      panel.hidden = true;
      panel.classList.add("hidden");
    }
    return;
  }
  sleeperUnreachable = false;
  const panel = document.getElementById("sleeper-down");
  if (panel) {
    panel.hidden = true;
    panel.classList.add("hidden");
  }
  if (!leagueMissing) {
    const landing = document.querySelector("#landing");
    if (landing) {
      landing.classList.remove("hidden");
      landing.hidden = false;
    }
  }
  syncLaunchChrome();
  syncDocumentMeta();
}

function paintLeagueLoadError(message = "") {
  const text = String(message || "");
  const loaded = document.body.classList.contains("league-loaded");
  if (text === SLEEPER_UNREACHABLE_MESSAGE && !loaded) {
    showSleeperUnreachable();
    return;
  }
  hideSleeperUnreachable();
  const where = leagueLoadErrorVisibility({
    message: text,
    leagueLoaded: loaded,
  });
  const landing = document.getElementById("landing-league-error");
  const landingText = document.getElementById("landing-league-error-text");
  const desk = document.getElementById("desk-load-alert");
  const deskText = document.getElementById("desk-load-alert-text");
  if (landing) landing.classList.toggle("hidden", !where.landing);
  if (landingText) landingText.textContent = where.landing ? text : "";
  const retry = document.getElementById("landing-league-retry");
  if (retry && where.landing) retry.classList.remove("hidden");
  if (desk) desk.classList.toggle("hidden", !where.desk);
  if (deskText) deskText.textContent = where.desk ? text : "";
}

function retryFailedLeagueLoad(event) {
  event?.preventDefault?.();
  leagueLoadRecovery.retry();
}

function dismissFailedLeagueLoad(event) {
  event?.preventDefault?.();
  leagueLoadRecovery.clear();
  paintLeagueLoadError("");
  setLeagueSwitchStale(false);
}

function setLeagueSwitchStale(on) {
  const stale = Boolean(on);
  document.body.classList.toggle("league-switch-stale", stale);
  ["workspace-header", "ui-pages", "desk-nav", "mobile-chrome-title"].forEach((id) => {
    const node = document.getElementById(id);
    if (!node) return;
    if (stale) node.setAttribute("aria-busy", "true");
    else node.removeAttribute("aria-busy");
  });
}

function setStatus(message, { ok = false, loading = false, error = false, retry = false } = {}) {
  if (el.leagueStatusText) el.leagueStatusText.textContent = message;
  if (el.leagueStatus) {
    const tone = error ? "error" : ok ? "ok" : loading ? "loading" : "muted";
    el.leagueStatus.className = `status ${tone}${message ? "" : " hidden"}`;
  }
  el.leagueStatusLoader?.classList.toggle("hidden", !loading);
  el.leagueStatusRetry?.classList.toggle("hidden", !retry);
  if (el.landingSearchStatus) {
    el.landingSearchStatus.classList.toggle("hidden", !retry);
    if (el.landingSearchStatusText) el.landingSearchStatusText.textContent = retry ? message : "";
  }
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

function rebindUsernameInputs() {
  [
    ["sleeperUsername", "sleeper-username"],
    ["landingUsername", "landing-username"],
  ].forEach(([key, id]) => {
    const cached = el[key];
    const live = document.getElementById(id);
    if (!live || live === cached) return;
    if (cached?.isConnected === false && String(cached.value || "").length && !String(live.value || "").length) {
      live.value = cached.value;
      const active = document.activeElement;
      const shouldFocus = !routeFocusHold && (!active || active === cached || active === document.body || active === document.documentElement);
      if (shouldFocus) {
        live.focus();
        try {
          live.setSelectionRange(cached.selectionStart ?? live.value.length, cached.selectionEnd ?? live.value.length);
        } catch {
          // The value is back even when this input type has no caret.
        }
      }
    }
    el[key] = live;
  });
  [
    ["usernameSearchForm", "username-search-form"],
    ["landingUsernameForm", "landing-username-form"],
  ].forEach(([key, id]) => {
    const cached = el[key];
    const live = document.getElementById(id);
    if (!live || live === cached) return;
    if (cached?.isConnected === false) live.addEventListener("submit", requestFindLeagues);
    el[key] = live;
  });
}

function syncUsernameFields(source) {
  rebindUsernameInputs();
  const value = String(source?.value || "");
  if (el.sleeperUsername && el.sleeperUsername !== source) el.sleeperUsername.value = value;
  if (el.landingUsername && el.landingUsername !== source) el.landingUsername.value = value;
}

function openSampleConnect() {
  document.body.classList.add("sample-connect-open");
  focusUsernameSearch();
}

function focusUsernameSearch() {
  rebindUsernameInputs();
  if (isPhoneLayout() && state.leagueId) setMobileRailOpen(true);
  const target = !state.leagueId && el.landingUsername
    ? el.landingUsername
    : (el.sleeperUsername || el.leagueId);
  target?.focus();
  target?.scrollIntoView({ behavior: "smooth", block: "center" });
}

// A cold /t/<code> arrives with a trade-specific <title> and meta from the
// server (trade-page). Read once, on the first sync (before anything rewrites
// the title), and keep it while the page still shows that link (L1).
function serverShareMeta() {
  if (serverShareMeta.value === undefined) {
    serverShareMeta.value = /^\/t\/[^/]+\/?$/.test(window.location.pathname) && /\| Dynasty Ticker$/.test(document.title)
      ? { path: window.location.pathname, title: document.title }
      : null;
  }
  return serverShareMeta.value;
}

function syncDocumentMeta() {
  if (leagueMissing) {
    applyDocumentMeta(document, {
      title: "We couldn't find that league · Dynasty Ticker",
      description: "The link may be wrong, or the league was deleted.",
    });
    return;
  }
  if (sleeperUnreachable) {
    applyDocumentMeta(document, {
      title: "Couldn't reach Sleeper · Dynasty Ticker",
      description: "Sleeper didn't answer. Your league is safe, so try again in a moment.",
    });
    return;
  }
  const shareMeta = serverShareMeta();
  if (shareMeta && window.location.pathname === shareMeta.path && !state.leagueId) {
    holdDocumentTitle(document, shareMeta.title);
    return;
  }
  if (state.leagueSwitching) {
    applyDocumentMeta(document, {
      title: "Loading league · Dynasty Ticker",
      description: "Opening a Sleeper league.",
    });
    return;
  }
  const place = routePlaceNow();
  const routedTitle = routeDocumentTitle({
    playerName: place.playerName,
    tab: place.titleTab,
    room: place.view,
  });
  const room = state.leagueId ? getRoom() : "";
  const description = buildPageDescription({
      page: state.leagueId ? state.activePage : (place.titleTab || ""),
      leagueName: state.leagueName,
      loaded: Boolean(state.leagueId),
      room,
      league: state.league,
      viewingSample: Boolean(state.viewingSample),
      ownerName: getMyRoster()?.manager?.displayName || "",
    });
  applyDocumentMeta(document, {
    title: routedTitle || buildDocumentTitle({
      page: state.leagueId ? state.activePage : "",
      leagueName: state.leagueName,
      loaded: Boolean(state.leagueId),
      room,
      league: state.league,
    }),
    description,
  });
  if (el.routeTitle) el.routeTitle.textContent = routeHeadingText();
}

async function loadPlayerNoteContext() {
  const nflState = state.nflState || await apiGetWithRetry(`/state/nfl`, { timeoutMs: 8000, retries: 1 }).catch(() => null);
  if (nflState) state.nflState = nflState;
  const currentSeason = String(nflState?.league_season || nflState?.season || new Date().getUTCFullYear());
  const previousSeason = String(nflState?.previous_season || Number(currentSeason) - 1 || new Date().getUTCFullYear() - 1);
  const cachedEntry = await loadPlayersCacheEntry(playersCacheAdapters()).catch(() => getPlayersCache());
  const cachedPlayers = cachedEntry?.players || state.players || {};
  const notePlayersEpoch = playerLoadEpoch;
  const [nflPlayers, seasonStats, draftPicks] = await Promise.all([
    Object.keys(cachedPlayers).length
      ? Promise.resolve(cachedPlayers)
      : loadPlayersWithCache().then((players) => {
        if (notePlayersEpoch !== playerLoadEpoch) return state.players || {};
        if (players && Object.keys(players).length) state.players = players;
        return players || {};
      }).catch(() => ({})),
    loadSeasonStats(previousSeason).catch(() => ({})),
    fetchNflDraftPicks().catch(() => ({})),
  ]);
  return { nflPlayers, seasonStats, draftPicks, currentSeason, previousSeason };
}

async function loadSeasonStats(season) {
  const year = String(season || "").trim();
  if (!year) return {};
  if (seasonStatsCache.season === year && seasonStatsCache.stats) {
    return seasonStatsCache.stats;
  }
  const stats = await apiGet(`/stats/nfl/regular/${encodeURIComponent(year)}`, { timeoutMs: 20000 });
  const payload = stats && typeof stats === "object" ? stats : {};
  seasonStatsCache = { season: year, stats: payload };
  return payload;
}

function formatMarketValues() {
  const format = state.valueFormat === "oneQb" ? "oneQb" : "sf";
  const selected = state.valueBundles?.[format]?.values;
  return selected && Object.keys(selected).length ? selected : state.values;
}

function bindPlayerPhotos(root) {
  root?.querySelectorAll?.("img.rather-photo, img.player-face-photo").forEach((img) => {
    img.addEventListener("error", () => {
      img.classList.add("is-broken");
    });
  });
}

document.addEventListener("error", (event) => {
  const img = event.target;
  if (!(img instanceof HTMLImageElement)) return;
  if (!img.classList.contains("player-face-photo") && !img.classList.contains("rather-photo")) return;
  img.classList.add("is-broken");
}, true);

function syncSiteDock() {
  // Connect my league stays in the landing form. Do not pin a second bar over the page.
  if (el.stickyMobileCta) el.stickyMobileCta.hidden = true;
  document.body.classList.remove("dock-visible");
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
    el.stickyFindBtn.textContent = el.stickyFindBtn.dataset.idleLabel || "Connect my league";
  }
  if (!el.loadLeagueBtn) return;
  el.loadLeagueBtn.disabled = false;
  el.loadLeagueBtn.classList.remove("loading");
  el.loadLeagueBtn.textContent = "Open league";
}
