// For a completed two-for-one, hold the main player on each side fixed.
// Find the price of the throw-in that would make the official calculator even.
// Convert that price to the units of contemporaneous quotes BEFORE measuring
// the error. Rescaling all listed prices cannot improve this check by itself.
import {readFileSync} from "node:fs";
import {calculatePackageAdjustment} from "../../docs/modules/package-value.js";

const [quoteFile, dealFile, boardFile, start, end] = process.argv.slice(2);
if (!end) throw new Error("Supply quote boards, trades, model boards, start and end dates");
const read = file => JSON.parse(readFileSync(file));
const quoteBoards = read(quoteFile);
const modelBoards = read(boardFile);
const dates = Object.keys(quoteBoards).map(Number).sort((a, b) => a-b);
const maxAge = 7 * 86400000;
const rows = [];
for (const deal of read(dealFile)) {
  const {proposed, accepted} = deal;
  if (!(Date.parse(start) <= proposed && proposed <= accepted && accepted < Date.parse(end))) continue;
  const date = dates.findLast(t => t < proposed);
  if (date == null || proposed-date > maxAge) continue;
  const quotes = quoteBoards[date], board = modelBoards[date];
  if (!board || !deal.sides.every(side => side.every(k => quotes[k] > 0 && board[k] > 0))) continue;
  const [single, pair] = [...deal.sides].sort((a,b) => a.length-b.length);
  if (single.length !== 1 || pair.length !== 2 || single[0].startsWith("pick:")) continue;
  const [core, addon] = [...pair].sort((a,b) => quotes[b]-quotes[a] || a.localeCompare(b));
  if (core.startsWith("pick:")) continue;

  // Compare replacement assets of the same class. A pick stays in its draft
  // year. The model can also predict zero if the core alone covers the offer.
  const isPick = addon.startsWith("pick:");
  const group = isPick ? addon.split(":").slice(0,2).join(":")+":" : null;
  const candidates = Object.keys(board).filter(k => k !== single[0] && k !== core && quotes[k] > 0 &&
    (isPick ? k.startsWith(group) : !k.startsWith("pick:")));
  const max = Math.max(...Object.entries(board).filter(([k]) => !k.startsWith("pick:")).map(([,v])=>v));
  let best = Infinity;
  let implied = [];
  for (const k of [null,...candidates]) {
    const r = calculatePackageAdjustment({myValues: [board[single[0]]],
      theirValues: k ? [board[core],board[k]] : [board[core]], globalMaxValue: max});
    const cents = Math.round(100*Math.abs(r.myAdjustedValue-r.theirAdjustedValue));
    if (cents < best) { best = cents; implied = []; }
    if (cents === best) implied.push(k ? quotes[k] : 0);
  }
  const estimated = implied.reduce((a,b)=>a+b,0)/implied.length;
  rows.push({league:deal.league, transaction:deal.transaction, type:isPick?"pick":"player",
    // Express error relative to the single player's quote, fixed for every model.
    error:Math.abs(estimated-quotes[addon])/quotes[single[0]], estimated, actual:quotes[addon]});
}
process.stdout.write(JSON.stringify(rows));
