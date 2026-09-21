import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CLOSE_CALL_GAP,
  SIT_BYE,
  SIT_NO_ELIGIBLE,
  SIT_NO_OPPONENT,
  SIT_NO_TEAM,
  SIT_START_HINT,
  buildSitStart,
  closeCallReason,
  injurySitReason,
  renderSitStartCallout,
  sitStartEligibility,
} from "../docs/modules/sit-start.js";

const docs = join(dirname(fileURLToPath(import.meta.url)), "../docs");

function weekly({
  position = "WR",
  score = 70,
  bye = false,
  noTeam = false,
  opponentMissing = false,
  upcomingOpponent = "ARI",
  ease = "Easy",
  targetShare = 0.22,
  rushShare = null,
  recentPoints = 14,
  lastPts = 16,
  lastTgt = 8,
} = {}) {
  return {
    position,
    score,
    bye,
    noTeam,
    opponentMissing: noTeam ? true : opponentMissing,
    upcomingOpponent: opponentMissing || bye || noTeam ? "" : upcomingOpponent,
    opponentEase: ease ? { label: ease } : { label: "" },
    targetShare,
    rushShare,
    recentPoints,
    games: lastPts == null ? [] : [{ pts: lastPts, recTgt: lastTgt }],
  };
}

function player(id, extras = {}) {
  return {
    id,
    name: extras.name || id,
    position: extras.position || "WR",
    dynastyValue: extras.dynastyValue ?? 1000,
    injuryStatus: extras.injuryStatus || "",
    playerStatus: extras.playerStatus || "Active",
    weekly: extras.weekly === null ? null : (extras.weekly || weekly({ position: extras.position || "WR", ...extras })),
    asset: extras.asset || { assetId: `player:${id}`, name: extras.name || id },
  };
}

test("bye and missing opponent sit instead of silently starting", () => {
  const board = buildSitStart({
    slots: ["WR", "FLEX"],
    week: 5,
    players: [
      player("bye-star", { name: "Bye Star", dynastyValue: 9000, weekly: weekly({ score: 92, bye: true, targetShare: 0.28 }) }),
      player("no-opp", { name: "Ghost", dynastyValue: 8000, weekly: weekly({ score: 88, opponentMissing: true }) }),
      player("start-me", { name: "Nico", dynastyValue: 400, weekly: weekly({ score: 54, ease: "Easy", upcomingOpponent: "ARI", targetShare: 0.24 }) }),
      player("flex-me", { name: "Likely", position: "TE", dynastyValue: 350, weekly: weekly({ position: "TE", score: 51, ease: "Average", upcomingOpponent: "NE", targetShare: 0.18 }) }),
    ],
  });
  const started = board.starters.map((entry) => entry.player?.name);
  assert.deepEqual(started, ["Nico", "Likely"]);
  const byeRow = board.bench.find((row) => row.player.name === "Bye Star");
  const missingRow = board.bench.find((row) => row.player.name === "Ghost");
  assert.equal(byeRow.sitReason, SIT_BYE);
  assert.equal(missingRow.sitReason, SIT_NO_OPPONENT);
  assert.equal(sitStartEligibility(player("bye-star", { weekly: weekly({ bye: true }) })).eligible, false);
});

test("out sits, questionable can still start", () => {
  assert.equal(injurySitReason("Out"), "Sit — Out");
  assert.equal(injurySitReason("IR"), "Sit — IR");
  assert.equal(injurySitReason("Doubtful"), "Sit — Doubtful");
  assert.equal(injurySitReason("Questionable"), "");
  const board = buildSitStart({
    slots: ["RB", "RB"],
    players: [
      player("hurt", { name: "Hurt RB", position: "RB", injuryStatus: "Out", weekly: weekly({ position: "RB", score: 95, rushShare: 0.7, targetShare: 0.12 }) }),
      player("q", { name: "Q RB", position: "RB", injuryStatus: "Questionable", weekly: weekly({ position: "RB", score: 80, rushShare: 0.55, targetShare: 0.1 }) }),
      player("ok", { name: "OK RB", position: "RB", weekly: weekly({ position: "RB", score: 60, rushShare: 0.4, targetShare: 0.08 }) }),
    ],
  });
  assert.deepEqual(board.starters.map((entry) => entry.player?.name), ["Q RB", "OK RB"]);
  assert.equal(board.bench[0].player.name, "Hurt RB");
  assert.match(board.bench[0].sitReason, /Out/);
});

test("empty slot when nobody eligible", () => {
  const board = buildSitStart({
    slots: ["QB"],
    players: [
      player("bye-qb", { name: "Bye QB", position: "QB", weekly: weekly({ position: "QB", score: 90, bye: true }) }),
    ],
  });
  assert.equal(board.starters[0].player, null);
  assert.equal(board.starters[0].rowNote, SIT_NO_ELIGIBLE);
});

test("unsigned Tebow is 0% and sits as not on a team", () => {
  const board = buildSitStart({
    slots: ["QB", "SUPER_FLEX"],
    players: [
      player("tebow", {
        name: "Tim Tebow",
        position: "QB",
        dynastyValue: 9000,
        weekly: weekly({ position: "QB", score: 0, noTeam: true }),
      }),
      player("dart", {
        name: "Jaxson Dart",
        position: "QB",
        dynastyValue: 400,
        weekly: weekly({ position: "QB", score: 91, ease: "Average", upcomingOpponent: "NYG" }),
      }),
    ],
  });
  assert.equal(board.starters[0].player?.name, "Jaxson Dart");
  assert.notEqual(board.starters[0].player?.name, "Tim Tebow");
  assert.equal(board.starters[1].player, null);
  const tebow = board.bench.find((row) => row.player.name === "Tim Tebow");
  assert.equal(tebow.sitReason, SIT_NO_TEAM);
  assert.equal(sitStartEligibility(player("tebow", { position: "QB", weekly: weekly({ position: "QB", score: 0, noTeam: true }) })).eligible, false);
});

test("WR3 vs Flex close call uses matchup and usage, not dynasty", () => {
  const board = buildSitStart({
    slots: ["WR", "WR", "WR", "FLEX"],
    week: 2,
    players: [
      player("wr1", { name: "Lock WR", weekly: weekly({ score: 91, targetShare: 0.27, ease: "Average", upcomingOpponent: "DEN" }) }),
      player("wr2", { name: "WR2", weekly: weekly({ score: 82, targetShare: 0.21, ease: "Easy", upcomingOpponent: "NYG" }) }),
      player("nico", { name: "Nico", weekly: weekly({ score: 55, targetShare: 0.24, ease: "Easy", upcomingOpponent: "ARI", lastPts: 18, lastTgt: 9 }) }),
      player("diggs", { name: "Diggs", weekly: weekly({ score: 50, targetShare: 0.11, ease: "Hard", upcomingOpponent: "SF", lastPts: 8, lastTgt: 4 }), dynastyValue: 9000 }),
      player("rb", { name: "RB1", position: "RB", weekly: weekly({ position: "RB", score: 88, rushShare: 0.62, targetShare: 0.09, ease: "Average", upcomingOpponent: "CLE" }) }),
    ],
  });
  const wr3 = board.starters.find((entry) => entry.slotLabel === "WR3");
  assert.equal(wr3?.player?.name, "Nico");
  assert.equal(board.starters.find((entry) => entry.slot === "FLEX")?.player?.name, "RB1");
  assert.equal(board.starters.filter((entry) => entry.slot === "WR").length, 3);
  assert.ok(board.closeCalls.length >= 1, "expected a close call");
  const nicoCall = board.closeCalls.find((call) => call.starter.name === "Nico" && call.challenger.name === "Diggs");
  assert.ok(nicoCall, "Nico vs Diggs should be the close call");
  assert.match(nicoCall.reason, /WR3: Nico over Diggs/);
  assert.match(nicoCall.reason, /24% targets/);
  assert.match(nicoCall.reason, /Easy vs ARI/);
  assert.match(nicoCall.reason, /11% targets/);
  assert.match(nicoCall.reason, /Hard vs SF/);
  assert.doesNotMatch(nicoCall.reason, /dynasty/i);
  assert.doesNotMatch(nicoCall.reason, /9,000|9000/);
  assert.ok(nicoCall.gap <= CLOSE_CALL_GAP);
  const html = renderSitStartCallout(board);
  assert.match(html, /data-sit-start="ready"/);
  assert.match(html, /Sit \/ start/);
  assert.match(html, /Nico over Diggs/);
  assert.match(html, /<li>WR3: Nico over Diggs — Nico: 24% targets, Easy vs ARI\. Diggs: 11% targets, Hard vs SF<\/li>/);
  assert.doesNotMatch(html, /<li>[^<]*dynasty/i);
  assert.match(html, new RegExp(SIT_START_HINT.replaceAll("/", "\\/")));
});

test("close-call copy names matchup or usage", () => {
  const reason = closeCallReason({
    slotLabel: "WR3",
    starter: player("nico", { name: "Nico", weekly: weekly({ score: 55, targetShare: 0.24, ease: "Easy", upcomingOpponent: "ARI" }) }),
    challenger: player("diggs", { name: "Diggs", weekly: weekly({ score: 49, targetShare: 0.11, ease: "Hard", upcomingOpponent: "SF" }) }),
  });
  assert.match(reason, /WR3: Nico over Diggs/);
  assert.match(reason, /targets/);
  assert.match(reason, /vs ARI/);
  assert.doesNotMatch(reason, /dynasty/i);
});

test("locks with a fat gap are not close calls", () => {
  const board = buildSitStart({
    slots: ["WR"],
    players: [
      player("lock", { name: "Lock", weekly: weekly({ score: 93, targetShare: 0.3 }) }),
      player("sit", { name: "Sit", weekly: weekly({ score: 40, targetShare: 0.08, ease: "Hard", upcomingOpponent: "SF" }) }),
    ],
  });
  assert.equal(board.starters[0].player.name, "Lock");
  assert.equal(board.closeCalls.length, 0);
  const html = renderSitStartCallout(board);
  assert.match(html, /No close calls this week/);
});

test("deep rosters still solve the scarce slot instead of a greedy local pick", () => {
  const groups = [
    ["Q", "QB"],
    ["R", "RB"],
    ["W", "WR"],
    ["T", "TE"],
  ];
  const fillers = groups.flatMap(([slot, position]) => Array.from({ length: 6 }, (_, index) => ({
    id: `${slot}-${index}`,
    name: `${position} ${index}`,
    position,
    dynastyValue: 1000,
    weekly: weekly({ position, score: 60 - index }),
    canFill: (candidate) => candidate === slot,
  })));
  const board = buildSitStart({
    slots: ["A", "B", "Q", "R", "W", "T"],
    players: [
      { id: "X", name: "X", position: "RB", weekly: weekly({ score: 10 }), canFill: (slot) => slot === "A" || slot === "B" },
      { id: "Y", name: "Y", position: "RB", weekly: weekly({ score: 9 }), canFill: (slot) => slot === "A" },
      { id: "Z", name: "Z", position: "RB", weekly: weekly({ score: 3 }), canFill: (slot) => slot === "B" },
      ...fillers,
    ],
  });
  const bySlot = Object.fromEntries(board.starters.map((row) => [row.slot, row.player?.id]));
  assert.equal(bySlot.A, "Y");
  assert.equal(bySlot.B, "X");
});

test("sit/start callout has loading and error states", () => {
  assert.match(renderSitStartCallout(null, { loading: true, week: 2 }), /Loading this week's sit\/start/);
  assert.match(renderSitStartCallout({ week: 2 }, { error: "stats down" }), /stats down/);
  assert.equal(renderSitStartCallout(null), "");
  const css = readFileSync(join(docs, "styles.css"), "utf8");
  assert.match(css, /\.sit-start-board\s*\{/);
  assert.match(css, /\.sit-start-calls\s*\{/);
  assert.match(css, /\.sheet-why\s*\{/);
  const app = readFileSync(join(docs, "app.js"), "utf8");
  assert.match(app, /from "\.\/modules\/sit-start\.js"/);
  assert.match(app, /buildSitStart\(/);
  assert.match(app, />Start</);
  assert.match(app, />Sit</);
  const index = readFileSync(join(docs, "index.html"), "utf8");
  assert.match(index, /Sit\/start this week/);
  assert.match(index, /Close calls get a matchup or usage why/);
});
