import { escapeHtml } from "./html.js";
import { resolveRosterIdentity } from "./franchise.js";
import { allTimeStandings } from "./league-records.js";
import { traderAwards } from "./league-trader-awards.js";
import { drafterAwards } from "./league-drafter-awards.js";
import { waiverAwards } from "./league-waiver-awards.js";

// Best / worst manager (ticket 041): a heuristic composite, shown with its parts.
// Weights are the ticket's, not validated: a reader can disagree with them.
//   Results 50%: z(win %) and z(postseason rate), averaged. Postseason rate =
//     (playoff trips + finals + 3 × titles) per finished season.
//   Points 20%: z(points per game ÷ that season's league average), luck-neutral.
//   Roster building 30%: average of the z-scores the manager qualifies for
//     among trade net, draft surplus and waiver score.
// A part with no data is left out and the remaining weights are rescaled.
// Each z-score is computed among eligible managers (2+ finished seasons).
export const MANAGER_WEIGHTS = Object.freeze({ results: 0.5, points: 0.2, roster: 0.3 });
const MIN_SEASONS = 2;

const id = (value) => String(value ?? "").trim();
const num = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const fpts = (settings = {}, key) => num(settings[key]) + num(settings[`${key}_decimal`]) / 100;

function zScores(rows, pick) {
  const values = rows.map(pick).filter(Number.isFinite);
  if (values.length < 2) return new Map();
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const sd = Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);
  const out = new Map();
  for (const row of rows) {
    const value = pick(row);
    if (Number.isFinite(value)) out.set(row.key, sd > 0 ? (value - mean) / sd : 0);
  }
  return out;
}
const average = (list) => list.length ? list.reduce((sum, value) => sum + value, 0) / list.length : null;

// Finished seasons and points-per-game index per manager.
function seasonFacts(archive) {
  const facts = new Map();
  for (const entry of archive.seasons || []) {
    if (entry?.league?.status !== "complete") continue;
    const rows = (entry.rosters || []).map((roster) => {
      const s = roster.settings || {};
      const games = num(s.wins) + num(s.losses) + num(s.ties);
      return { roster, ppg: games ? fpts(s, "fpts") / games : NaN };
    });
    const leaguePpg = average(rows.map((row) => row.ppg).filter(Number.isFinite));
    for (const { roster, ppg } of rows) {
      const identity = resolveRosterIdentity(archive.franchiseIndex, { userId: roster.owner_id, leagueId: entry.leagueId, rosterId: roster.roster_id });
      if (!facts.has(identity.managerKey)) facts.set(identity.managerKey, { finished: 0, indexes: [] });
      const row = facts.get(identity.managerKey);
      row.finished += 1;
      if (Number.isFinite(ppg) && leaguePpg > 0) row.indexes.push(ppg / leaguePpg);
    }
  }
  return facts;
}

export function managerComposite(archive = {}, { values = {}, valueNames = {} } = {}) {
  const facts = seasonFacts(archive);
  const base = allTimeStandings(archive).map((row) => {
    const fact = facts.get(row.key) || { finished: 0, indexes: [] };
    return {
      key: row.key, name: row.name, finished: fact.finished, winPct: row.winPct,
      postseason: fact.finished ? (row.playoffAppearances + row.finals + 3 * row.titles) / fact.finished : NaN,
      pointsIndex: average(fact.indexes) ?? NaN,
      eligible: fact.finished >= MIN_SEASONS,
    };
  });
  const eligible = base.filter((row) => row.eligible);
  const trader = new Map(traderAwards(archive, { values, valueNames }).standings.filter((row) => row.eligible).map((row) => [row.managerKey, row.totalNet]));
  const drafter = new Map((drafterAwards(archive, values).leaders || []).map((row) => [row.key, row.averageSurplus]));
  const waiver = new Map(waiverAwards(archive, { values }).standings.filter((row) => row.eligible).map((row) => [row.key, row.score]));
  const z = {
    win: zScores(eligible, (row) => row.winPct),
    post: zScores(eligible, (row) => row.postseason),
    points: zScores(eligible, (row) => row.pointsIndex),
    trader: zScores(eligible, (row) => trader.has(row.key) ? trader.get(row.key) : NaN),
    drafter: zScores(eligible, (row) => drafter.has(row.key) ? drafter.get(row.key) : NaN),
    waiver: zScores(eligible, (row) => waiver.has(row.key) ? waiver.get(row.key) : NaN),
  };
  const scored = eligible.map((row) => {
    const results = average([z.win.get(row.key), z.post.get(row.key)].filter(Number.isFinite));
    const points = z.points.get(row.key) ?? null;
    const rosterParts = [["trades", z.trader], ["drafts", z.drafter], ["waivers", z.waiver]]
      .filter(([, map]) => map.has(row.key));
    const roster = average(rosterParts.map(([, map]) => map.get(row.key)));
    const parts = [["results", results], ["points", points], ["roster", roster]].filter(([, value]) => Number.isFinite(value));
    const weight = parts.reduce((sum, [key]) => sum + MANAGER_WEIGHTS[key], 0);
    const score = weight ? parts.reduce((sum, [key, value]) => sum + MANAGER_WEIGHTS[key] * value, 0) / weight : null;
    return { ...row, results, points, roster, rosterBasis: rosterParts.map(([label]) => label), score };
  }).filter((row) => Number.isFinite(row.score)).sort((a, b) => b.score - a.score);
  return {
    best: scored[0] || null,
    worst: scored.length > 1 ? scored[scored.length - 1] : null,
    rows: scored,
    notEnough: base.filter((row) => !row.eligible),
    minSeasons: MIN_SEASONS,
  };
}

const e = (value) => escapeHtml(String(value ?? ""));
const signed = (value) => Number.isFinite(value) ? `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toFixed(2)}` : "—";

export function renderManagerAward(archive, { values = {}, valueNames = {} } = {}) {
  const award = managerComposite(archive, { values, valueNames });
  const line = (row) => row
    ? `<p><strong>${e(row.name)}</strong> · score ${signed(row.score)} · results ${signed(row.results)}, points ${signed(row.points)}, roster building ${signed(row.roster)}</p>`
    : '<p class="muted">Requires two completed seasons.</p>';
  return `<section class="workspace-panel">
    <h2>Manager awards <span class="mini-chip">Heuristic</span></h2>
    <p class="muted small">League average is 0. Minimum ${award.minSeasons} completed seasons.</p>
    <details><summary>Score weights</summary><p>Results (wins, playoffs, titles) 50% · Points scored 20% · Roster building (trades, drafts, waivers) 30%.</p></details>
    <div class="league-history-awards">
      <div><h3>Best manager</h3>${line(award.best)}</div>
      <div><h3>Worst manager</h3>${line(award.worst)}</div>
    </div>
    ${award.rows.length ? `<details><summary>Scores by manager</summary>
      <div class="league-history-scroll" role="region" aria-label="Manager score breakdown" tabindex="0">
      <table class="league-history-table"><thead><tr><th scope="col">Manager</th><th scope="col">Score</th><th scope="col">Results</th><th scope="col">Points</th><th scope="col">Roster building</th><th scope="col">Roster parts used</th></tr></thead><tbody>
      ${award.rows.map((row) => `<tr><th scope="row">${e(row.name)}</th><td>${signed(row.score)}</td><td>${signed(row.results)}</td><td>${signed(row.points)}</td><td>${signed(row.roster)}</td><td>${e(row.rosterBasis.join(", ") || "none")}</td></tr>`).join("")}
      ${award.notEnough.map((row) => `<tr><th scope="row">${e(row.name)}</th><td colspan="5" class="muted">Not enough history (${row.finished} of ${award.minSeasons} finished seasons)</td></tr>`).join("")}
      </tbody></table></div></details>` : ""}
  </section>`;
}
