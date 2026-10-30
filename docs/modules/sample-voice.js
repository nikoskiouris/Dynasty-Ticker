// Sample league (?sample=1) is someone else's team. Roster copy stays third person.

export const SAMPLE_BANNED_VOICE = /\byours?\b|\bmine\b|you give/i;

export function ownerPossessive(name) {
  const clean = String(name || "").trim();
  if (!clean) return "";
  return /s$/i.test(clean) ? `${clean}'` : `${clean}'s`;
}

export function sampleRosterLabels({ viewingSample = false, ownerName = "" } = {}) {
  if (!viewingSample) return null;
  const name = String(ownerName || "").trim();
  const poss = name ? ownerPossessive(name) : "this team's";
  const who = name || "This team";
  const oneOf = name ? `one of ${poss}` : "one from this team";
  const oneOfCap = name ? `One of ${poss}` : "One from this team";
  return {
    roster: name ? `${poss} roster` : "This team's roster",
    shopOption: name ? `Shop a player or pick ${name} owns` : "Shop a player or pick this team owns",
    oneOfMine: name ? `One of ${poss}` : "One of theirs",
    youGive: who,
    heatOnRoster: `is on ${poss} roster`,
    teamTab: who,
    mineLabel: who,
    shopPick: `Pick one player or pick from ${poss} roster. The app will shop it around the league.`,
    shopSearch: `Search ${poss} roster for the player or pick to move`,
    shopChoose: `Choose one of ${poss} players or picks to shop.`,
    draftSearchLeft: `${poss} players and picks`,
    favor: poss,
    strengthens: `This trade strengthens ${poss} starting lineup while making the other side weaker or thinner.`,
    tradeFile: `${poss} trade file`,
    teamOutlined: `${poss} team is outlined. Tap a team for the rank, the win-now or rebuild call, and the lineup.`,
    giveLabel: name ? `${name} gives` : "This team gives",
    getLabel: "They get",
    giveGetHeading: name ? `${name} gives / They get` : "This team gives / They get",
    findIntro: `Start from a partner, ${oneOf}, or one of theirs. Review trade fills the calculator.`,
    shopIntro: `${oneOfCap}, or one of theirs. Then search the name.`,
    banner: "This is a public sample league. Connect a Sleeper username anytime.",
    accountNote: "Public sample — not this account. ",
    statusSample: "Sample league — not this account.",
    roomHintCalculator: `${who} gives and they get. Works before a league is connected`,
    roomHintFind: `Shop ${oneOf}, target one of theirs, or find a partner`,
    roomHintTeam: `${poss} outlook, then the roster`,
    pageHintLeague: `${poss} roster, standings, and playoff odds`,
    pageDescTrades: `One calculator: ${who} gives and they get. Find a deal that opens in that same calculator.`,
    pageDescLeague: `${poss} outlook, roster, standings, and playoff odds.`,
    roomDescFind: `Trade ideas that fit ${poss} team and the other side. Review trade opens the calculator.`,
    roomDescActivity: `Past trades for ${name || "this team"} and the league.`,
    searchEmpty: `No matching players & picks found on ${poss} roster.`,
    gradeRoster: `Could not grade ${poss} roster for a match.`,
    selectAsset: `Select one of ${poss} players & picks to shop first.`,
    resolveRoster: `Could not resolve ${poss} roster.`,
    matchNeedsEmpty: `Pick ${name || "this team"}. The app finds a partner who has ${poss} holes. Calculator is one tap away.`,
    matchDashboardEmpty: `Find a partner who has ${poss} holes, or open Find deals to shop a name. Calculator is one tap away.`,
    surplusFallback: `No obvious surplus; any deal still has to help ${poss} starters.`,
    matchEmptyBalanced: `No complementary windows jumped out. ${poss} roster may already be balanced, or the league is clustered the same way.`,
    matchEmptyLineup: `Those complementary teams showed up, but no package helped ${poss} lineup without leftover thirds.`,
    methodLineup: `Team impact is separate from price: it asks whether the move helps ${poss} starting lineup.`,
    helpsThemMore: `This trade helps their starting lineup more than ${poss}, even if the value stays close.`,
    shopAnchor: `Use ${poss} asset as the anchor for a better player coming back.`,
    cleanestPath: `${poss} cleanest path to a power jump.`,
    powerFlat: `keeps ${poss} power score flat`,
    sideLabel: `${poss} side`,
    mockSlot: name ? `${poss} slot` : "their slot",
    draftAlreadyPick: `This pick is already on ${poss} roster.`,
    draftAlreadyPlayer: `He is already on ${poss} roster.`,
    draftNeedPieces: `Team impact needs pieces from ${poss} roster and pieces from one other team.`,
    draftRestoreNamed: "Started a new trade. Restore the saved draft?",
    draftRestoreLast: "Started a new trade. Restore the last draft?",
    coreIntact: `this does not cut into the spine of ${poss} roster`,
    youngerTimeline: "the return keeps the timeline younger",
    youngestInsulation: "this cashes out win-now value instead of shipping the youngest insulation",
    lineupNow: "this consolidates value into a player for the lineup now",
    pitchOpen: "This offers real value and keeps it close to market.",
  };
}

export function sampleDescription({ page = "", room = "", voice = null } = {}) {
  if (!voice) return "";
  if (page === "trades" && room === "find") return voice.roomDescFind;
  if (page === "trades") return voice.pageDescTrades;
  if (page === "league" && room === "activity") return voice.roomDescActivity;
  if (page === "league" && room && room !== "team") return "";
  if (page === "league") return voice.pageDescLeague;
  return "";
}

