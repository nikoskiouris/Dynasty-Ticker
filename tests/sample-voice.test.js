import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PAGE_ROOMS, ROOM_HINTS } from "../docs/modules/constants.js";
import { buildPageDescription } from "../docs/modules/site.js";
import { describeDraftItem, draftNoticeText, draftTeamSummary } from "../docs/modules/trade-draft.js";
import { describeMatchDeal, describePartnerMatch } from "../docs/modules/trade-match.js";
import { draftVerdictLabel, valueCalcVerdict } from "../docs/modules/value-calc.js";
import { analyzeWindowCall } from "../docs/modules/window-call.js";
import {
  SAMPLE_BANNED_VOICE,
  ownerPossessive,
  sampleMockNote,
  sampleRoomHint,
  sampleRosterLabels,
} from "../docs/modules/sample-voice.js";

const here = dirname(fileURLToPath(import.meta.url));
const app = readFileSync(join(here, "../docs/app.js"), "utf8");
const tradesHtml = readFileSync(join(here, "../docs/ui/trades.html"), "utf8");
const leagueHtml = readFileSync(join(here, "../docs/ui/league.html"), "utf8");
const indexHtml = readFileSync(join(here, "../docs/index.html"), "utf8");

test("sample mode drops first-person roster copy", () => {
  assert.equal(sampleRosterLabels({ viewingSample: false, ownerName: "Ada" }), null);
  const named = sampleRosterLabels({ viewingSample: true, ownerName: "Ada" });
  assert.equal(named.roster, "Ada's roster");
  assert.equal(named.oneOfMine, "One of Ada's");
  assert.equal(named.shopOption, "Shop a player or pick Ada owns");
  assert.equal(named.youGive, "Ada");
  assert.equal(named.heatOnRoster, "is on Ada's roster");
  assert.equal(named.teamTab, "Ada");
  assert.equal(named.mineLabel, "Ada");
  assert.equal(named.shopChoose, "Choose one of Ada's players or picks to shop.");
  assert.match(named.shopPick, /from Ada's roster/);
  assert.equal(named.shopSearch, "Search Ada's roster for the player or pick to move");
  assert.equal(named.draftSearchLeft, "Ada's players and picks");
  assert.equal(named.favor, "Ada's");
  assert.equal(named.giveGetHeading, "Ada gives / They get");
  assert.match(named.strengthens, /Ada's starting lineup/);
  assert.equal(named.tradeFile, "Ada's trade file");
  assert.match(named.teamOutlined, /Ada's team is outlined/);
  const trailing = sampleRosterLabels({ viewingSample: true, ownerName: "chrisalberts" });
  assert.equal(ownerPossessive("chrisalberts"), "chrisalberts'");
  assert.equal(ownerPossessive("Ada"), "Ada's");
  assert.equal(trailing.roster, "chrisalberts' roster");
  assert.equal(trailing.oneOfMine, "One of chrisalberts'");
  assert.equal(trailing.heatOnRoster, "is on chrisalberts' roster");
  assert.equal(trailing.favor, "chrisalberts'");
  assert.equal(trailing.tradeFile, "chrisalberts' trade file");
  assert.equal(trailing.draftSearchLeft, "chrisalberts' players and picks");
  assert.equal(trailing.shopSearch, "Search chrisalberts' roster for the player or pick to move");
  assert.equal(trailing.giveGetHeading, "chrisalberts gives / They get");
  assert.doesNotMatch(trailing.roster + trailing.shopPick + trailing.shopChoose + trailing.tradeFile + trailing.giveGetHeading + trailing.strengthens, /chrisalberts's|\byour\b|You give|You get|\bMine\b/);
  const anon = sampleRosterLabels({ viewingSample: true, ownerName: "  " });
  assert.equal(anon.roster, "This team's roster");
  assert.equal(anon.oneOfMine, "One of theirs");
  assert.equal(anon.shopOption, "Shop a player or pick this team owns");
  assert.equal(anon.youGive, "This team");
  assert.equal(anon.heatOnRoster, "is on this team's roster");
  assert.equal(anon.teamTab, "This team");
  assert.equal(anon.shopSearch, "Search this team's roster for the player or pick to move");
  assert.doesNotMatch(`${named.roster} ${named.oneOfMine} ${named.shopOption} ${named.youGive} ${named.heatOnRoster} ${named.teamTab}`, /Your roster|One of mine|I own|You give|your roster|My team/);
});

test("sample labels are what the desk renders", () => {
  assert.match(app, /function syncSampleTradeCopy/);
  assert.match(app, /sampleVoice\(\)\?\.heatOnRoster \|\| "is on your roster"/);
  assert.match(app, /sampleVoice\(\)\?\.roster \|\| "Your roster"/);
  assert.match(app, /voice && page === "league" && room === HOME_ROOM/);
  assert.match(app, /sampleVoice\(\)\?\.shopChoose/);
  assert.match(app, /sampleVoice\(\)\?\.shopPick/);
  assert.match(app, /voice\?\.shopSearch/);
  assert.match(app, /Search your roster for the player or pick you want to move/);
  assert.match(app, /voice\?\.mineLabel/);
  assert.match(app, /sampleVoice\(\)\?\.giveGetHeading/);
  assert.match(app, /sampleVoice\(\)\?\.draftSearchLeft/);
  assert.match(app, /sampleVoice\(\)\?\.tradeFile/);
  assert.match(app, /sampleVoice\(\)\?\.teamOutlined/);
  assert.match(app, /sampleVoice\(\)\?\.strengthens/);
  // The verdict heading is neutral now (verdict-copy.js); the offer text keeps the voice.
  assert.match(app, /const copy = verdictCopy\(verdict\);/);
  assert.match(app, /getFavor: sampleVoice\(\)\?\.favor/);
  assert.match(app, /sampleRoomHint\(/);
  assert.match(app, /voice\?\.findIntro/);
  assert.match(app, /voice\?\.shopIntro/);
  assert.match(app, /sampleVoice\(\)\?\.pageHintLeague/);
  assert.match(app, /voice\?\.banner/);
  assert.match(app, /viewingSample: Boolean\(state\.viewingSample\)/);
});

function paintSampleDesk(voice) {
  const swaps = [
    ["Start from a partner, one of yours, or one of theirs. Review trade fills the calculator.", voice.findIntro],
    ["One of yours, or one of theirs. Then search the name.", voice.shopIntro],
    [">Mine<", `>${voice.mineLabel}<`],
    ["Sell one of mine", voice.shopOption],
    ["One of mine", voice.oneOfMine],
    ["Pick one of your players or picks.", voice.shopPick],
    ['placeholder="Search player or pick"', `placeholder="${voice.shopSearch}"`],
    ["Your team is outlined. Tap a team to view it.", voice.teamOutlined],
    ["Your team, this week, the league", voice.pageHintLeague],
  ];
  let html = [
    tradesHtml,
    leagueHtml.replace(/<div class="empty-cta">[\s\S]*?<\/div>/g, ""),
    indexHtml.match(/<div id="sample-banner"[\s\S]*?<\/div>/)?.[0] || "",
    indexHtml.match(/<small id="teams-tab-hint">[\s\S]*?<\/small>/)?.[0] || "",
  ].join("\n");
  for (const [from, to] of swaps) {
    assert.equal(html.includes(from), true, `sample paint target missing: ${from}`);
    html = html.replaceAll(from, to);
  }
  return html;
}

function roomTitles(voice) {
  return Object.entries(PAGE_ROOMS).flatMap(([page, rooms]) => rooms.map((room) => {
    const title = sampleRoomHint(page, room, voice) || ROOM_HINTS[page]?.[room] || "";
    return `<button class="room-tab" role="tab" title="${title}" aria-label="${title}"></button>`;
  })).join("\n");
}

function outlookCopy(voice, overrides = {}) {
  const call = analyzeWindowCall({
    rosterId: "1",
    managerName: voice.youGive,
    rank: 6,
    totalTeams: 12,
    powerScore: 74,
    starterPercentile: 0.55,
    pickPercentile: 0.5,
    timelineScore: 0.5,
    averageAge: 26.2,
    youthCount: 6,
    veteranCount: 6,
    firstRoundPickCount: 2,
    weakestPosition: { position: "RB", percentile: 0.3, rankLabel: "8th / 12" },
    playoffPct: 42,
    titlePct: 6,
    lastPlacePct: 4,
    winPct: 0.5,
    gamesPlayed: 8,
    remainingTeamGames: 6,
    currentWeek: 9,
    startWeek: 1,
    playoffStart: 15,
    playoffTeams: 6,
    sampleVoice: voice,
    ...overrides,
  });
  return [call.headline, call.summary, ...(call.moves || []), ...(call.signals || []).map((row) => row.detail || "")].join("\n");
}

function renderSampleMode(ownerName) {
  const voice = sampleRosterLabels({ viewingSample: true, ownerName });
  const places = [
    ["trades", "calculator"],
    ["trades", "find"],
    ["league", "team"],
    ["league", "scores"],
    ["league", "board"],
    ["league", "activity"],
    ["league", "history"],
    ["players", "ranks"],
  ];
  const descriptions = places.map(([page, room]) => buildPageDescription({
    page,
    room,
    loaded: true,
    leagueName: "Public Sample",
    viewingSample: true,
    ownerName,
  }));
  const dynamic = [
    ...Object.values(voice),
    sampleMockNote(voice, { place: "3rd", slots: "1.03 and 2.03" }),
    describeDraftItem({ status: "already-yours" }, { kind: "player", voice }),
    describeDraftItem({ status: "already-yours" }, { kind: "pick", voice }),
    describeDraftItem({ status: "not-yours" }, { ownerName: "Ben", kind: "player", voice }),
    draftTeamSummary({ needsTeam: false, partnerIds: ["2"], mismatched: 2 }, { leftCount: 1, rightCount: 1, voice }),
    draftTeamSummary({ needsTeam: false, partnerIds: ["2", "3"], mismatched: 0 }, { leftCount: 1, rightCount: 2, splitNames: ["Chris", "Ben"], voice }),
    draftTeamSummary({ needsTeam: true, partnerIds: [], mismatched: 0 }, { leftCount: 1, rightCount: 1, voice }),
    draftNoticeText({ note: "Cleared both sides.", saved: { left: [{ name: "Bijan" }], right: [{ name: "Gibbs" }] }, voice }),
    describePartnerMatch(
      { takePositions: ["RB"], givePositions: ["WR"], timelinePairing: "contend-rebuild" },
      { weakestPosition: { position: "RB" } },
      { voice },
    ),
    describePartnerMatch(
      { takePositions: ["RB"], givePositions: [], timelinePairing: "" },
      { weakestPosition: { position: "RB" } },
      { voice },
    ),
    describeMatchDeal({
      match: { timelinePairing: "" },
      myHelp: { patchedNeeds: [{ position: "RB" }] },
      theirHelp: { patchedNeeds: [] },
      myProfile: { weakestPosition: { position: "RB" } },
      theirProfile: { managerName: "Ben" },
      voice,
    }),
    draftVerdictLabel(valueCalcVerdict(10000, 11000), { them: "Ben", getFavor: voice.favor, favorName: voice.youGive }),
    draftVerdictLabel(valueCalcVerdict(10000, 12000), { them: "Ben", getFavor: voice.favor, favorName: voice.youGive }),
    draftVerdictLabel(valueCalcVerdict(10000, 14000), { them: "Ben", getFavor: voice.favor, favorName: voice.youGive }),
    outlookCopy(voice, {
      rank: 1,
      powerScore: 93,
      starterPercentile: 0.96,
      pickPercentile: 0.2,
      averageAge: 28.5,
      youthCount: 3,
      veteranCount: 9,
      firstRoundPickCount: 1,
      playoffPct: 84,
      titlePct: 26,
      winPct: 0.78,
    }),
    outlookCopy(voice, {
      horizon: "season",
      rank: 1,
      powerScore: 93,
      starterPercentile: 0.96,
      pickPercentile: 0.2,
      averageAge: 28.5,
      youthCount: 3,
      veteranCount: 9,
      firstRoundPickCount: 1,
      playoffPct: 84,
      titlePct: 26,
      winPct: 0.78,
    }),
    outlookCopy(voice, { horizon: "season" }),
    ...descriptions,
  ];
  return [paintSampleDesk(voice), roomTitles(voice), dynamic.join("\n")].join("\n");
}

test("rendered sample mode has no your, yours, mine, or you give", () => {
  const ada = renderSampleMode("Ada");
  assert.doesNotMatch(ada, SAMPLE_BANNED_VOICE);
  assert.match(ada, /Search Ada's roster for the player or pick to move/);
  assert.match(ada, /Ada's outlook, then the roster/);
  assert.match(ada, /Ada gives and they get/);
  assert.doesNotMatch(ada, /Search your roster|one of yours|Your outlook|You give and you get/i);

  const trailing = renderSampleMode("chrisalberts");
  assert.doesNotMatch(trailing, SAMPLE_BANNED_VOICE);
  assert.doesNotMatch(trailing, /chrisalberts's/);
  assert.match(trailing, /Search chrisalberts' roster/);
  assert.match(trailing, /chrisalberts' outlook, then the roster/);

  const anon = renderSampleMode("");
  assert.doesNotMatch(anon, SAMPLE_BANNED_VOICE);
  assert.match(anon, /Search this team's roster/);
  assert.match(anon, /this team's outlook, then the roster/);
  assert.match(anon, /This team gives and they get/);
  assert.match(anon, /one from this team/);
});
