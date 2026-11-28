// Reprice real proposals with the committed Dynasty Ticker board available before each offer.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { decodeTradeShare, encodeTradeShare, shareSummary } from "../../docs/modules/trade-share.js";

const root = fileURLToPath(new URL("../../", import.meta.url));
const archiveRevision = "7aa07060e79b298a3722ef9561acf7d47ecbe21e";
const archiveDir = "docs/data/price-history";
const start = Date.parse("2026-11-14T00:00Z");
const split = Date.parse("2026-11-21T00:00Z");
const end = Date.parse("2026-11-28T00:00Z");
const maxAge = 72 * 3600_000;
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
const readBlob = (revision, file) => JSON.parse(git("show", revision + ":" + file));

function readArchives() {
  const boards = [];
  for (const row of readBlob(archiveRevision, archiveDir + "/index.json").snapshots) {
    const asOf = Date.parse(row.asOf);
    if (asOf < start - maxAge || asOf >= end) continue;
    const file = archiveDir + "/" + row.stamp + ".json";
    // The archive index was backfilled. Read the immutable blob from the first
    // integration-branch commit containing the file, never a later revision.
    const record = git("log", "--first-parent", "--diff-filter=A", "--reverse", "--format=%H %ct",
      archiveRevision, "--", file).trim().split("\n")[0];
    if (!record) throw new Error("Missing integration commit for " + file);
    const [commit, seconds] = record.split(" ");
    const payload = readBlob(commit, file);
    if (payload.asOf !== row.asOf) throw new Error("Archive date mismatch for " + file);
    boards.push({ ...row, asOf, available: Math.max(asOf, Number(seconds) * 1000 + 999), payload });
  }
  return boards.sort((a, b) => b.asOf - a.asOf);
}

function assetId(key) {
  if (!key.startsWith("pick:")) return "player:" + key;
  const [, year, round] = key.split(":");
  return `pick:${year}:r${round}:any`;
}

function median(values) {
  const sorted = values.slice().sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

const percent = (fraction) => (fraction * 100).toFixed(1) + "%";
const gap = (left, right) => (right - left) / (right + left);

function report(label, offers, boards, directory) {
  const results = [];
  let missingBoard = 0, unpriced = 0, unsupported = 0;
  for (const trade of offers) {
    const board = boards.find(b => b.available < trade.proposed && trade.proposed - b.asOf <= maxAge);
    if (!board) { missingBoard++; continue; }
    const sides = trade.sides.map(side => side.map(assetId)).sort((a, b) => a.length - b.length);
    const code = encodeTradeShare({ give: sides[0], get: sides[1], asOf: board.payload.asOf });
    if (!code) { unsupported++; continue; }
    const summary = shareSummary(decodeTradeShare(code), board.payload, {}, directory);
    if (!summary || summary.unpriced.length) { unpriced++; continue; }
    results.push({ trade, board, summary, code, unequal: sides[0].length < sides[1].length,
      listed: gap(summary.giveTotal, summary.getTotal), credited: gap(summary.giveCredited, summary.getCredited) });
  }
  console.log(`\n${label}: ${results.length}/${offers.length} covered, ${missingBoard} without timely board, ${unpriced} unpriced, ${unsupported} outside share limits.`);
  for (const [group, rows] of [["All", results], ["Unequal", results.filter(r => r.unequal)]]) {
    if (!rows.length) continue;
    console.log(group, rows.length, "deals in", new Set(rows.map(r => r.trade.league)).size, "leagues.",
      "Median absolute gap listed / credited:", ...["listed", "credited"].map(k => percent(median(rows.map(r => Math.abs(r[k]))))));
    if (group === "Unequal") console.log("Median signed gap toward larger package listed / credited:",
      ...["listed", "credited"].map(k => percent(median(rows.map(r => r[k])))));
  }
  for (const { trade, board, code, summary } of results) {
    const names = rows => rows.map(r => r.name).join(" + ");
    console.log(new Date(trade.proposed).toISOString(), trade.transaction, board.stamp, board.modelVersion,
      `${names(summary.give)} (${summary.giveTotal} → ${summary.giveCredited}) for`,
      `${names(summary.get)} (${summary.getTotal} → ${summary.getCredited}). ${summary.label}.`,
      `/t/${code}`, `https://api.sleeper.app/v1/league/${trade.league}/transactions/${trade.week}`);
  }
}

if (!process.argv[2]) throw new Error("Supply the independent-panel Sleeper transaction export (JSON).");
const input = JSON.parse(readFileSync(process.argv[2], "utf8"));
const panel = new Set(readFileSync(new URL("./market-leagues-independent-2026.txt", import.meta.url), "utf8").trim().split(/\s+/));
const offers = input.filter(t => panel.has(t.league) && start <= t.proposed && t.proposed <= t.accepted && t.accepted < end);
const boards = readArchives();
// Only names/positions for human-readable output come from the later directory.
const directory = readBlob(archiveRevision, "docs/data/player_values.json");
report("Nov 14–20 proposals", offers.filter(t => t.proposed < split), boards, directory);
report("Nov 21–27 proposals", offers.filter(t => t.proposed >= split), boards, directory);
