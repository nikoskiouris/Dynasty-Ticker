import { escapeHtml, formatNumber } from "./html.js";
import { lineupAwards } from "./league-lineup-awards.js";
import { waiverAwards } from "./league-waiver-awards.js";

const e = (value) => escapeHtml(String(value ?? ""));
const points = (value) => Number.isFinite(Number(value)) ? formatNumber(Math.round(Number(value))) : "—";
const percent = (value) => Number.isFinite(Number(value)) ? `${Number(value).toFixed(1)}%` : "—";
let lastArchive, lastPlayers, lastLineup;
function cachedLineup(archive, players) {
  if (archive !== lastArchive || players !== lastPlayers) {
    lastArchive = archive;
    lastPlayers = players;
    lastLineup = lineupAwards(archive, { players });
  }
  return lastLineup;
}
function person(row, details) {
  return row
    ? `<p><strong>${e(row.name)}</strong> · ${e(details(row))}</p>`
    : '<p class="muted">No qualifying manager with enough complete records.</p>';
}
export function renderOperationsAwards(archive, { players = {}, values = {}, valueNames = {}, showLineup = false } = {}) {
  // Full exact-lineup evaluation across six seasons can be costly. Do it
  // only after the user requests the result, and cache the immutable archive.
  const lineup = showLineup ? cachedLineup(archive, players) : null;
  const waiver = waiverAwards(archive, { values });
  const playerName = (id) => e(valueNames[`player:${id}`] || `Player ${id}`);
  const waiverPlayer = (row) => row
    ? `<p><strong>${playerName(row.playerId)}</strong> · ${e(row.managerName)} (${e(row.season)}) · ${points(row.value)} current value</p>`
    : '<p class="muted">No fully priced transaction found.</p>';
  return `<section class="workspace-panel">
    <h2>Lineup and waiver awards <span class="mini-chip">Historical estimate</span></h2>
    <p class="muted small">Eligible managers only. Missing player prices, eligible positions or weekly scores are excluded rather than treated as zero.</p>
    <div class="league-history-awards">
      ${lineup
        ? `<div><h3>Best lineup setter</h3>${person(lineup.best, (row) => `${percent(row.efficiency)} of optimal weekly points · ${row.weeks} weeks`)}</div>
           <div><h3>Worst lineup setter</h3>${person(lineup.worst, (row) => `${percent(row.efficiency)} of optimal weekly points · ${row.weeks} weeks`)}</div>`
        : '<div><h3>Lineup awards</h3><p class="muted small">Calculate legal optimal lineups using historical player points and roster eligibility.</p><button type="button" data-action="compute-lineup-awards">Calculate lineup awards</button></div>'}
      <div><h3>Best waiver manager</h3>${person(waiver.best, (row) => `${points(row.averageNet)} avg net current value · ${row.moves} moves`)}</div>
      <div><h3>Worst waiver manager</h3>${person(waiver.worst, (row) => `${points(row.averageNet)} avg net current value · ${row.moves} moves`)}</div>
      <div><h3>Highest-value waiver pickup today</h3>${waiverPlayer(waiver.bestPickup)}</div>
      <div><h3>Highest-value player released today</h3>${waiverPlayer(waiver.mostValuableDrop)}</div>
    </div>
    <details><summary>Scoring rules and coverage</summary>
      ${lineup ? `<p class="muted small">${e(lineup.method)}</p>` : ""}
      <p class="muted small">${e(waiver.method)}</p>
      <p class="muted small">${lineup ? `Lineups: ${lineup.validWeeks} valid weekly team snapshots and ${lineup.unavailableWeeks} unavailable out of ${lineup.examinedWeeks}.` : "Lineup calculation not requested."} Waivers: ${waiver.evaluatedMoves} priced transaction sides and ${waiver.excludedMoves} excluded.</p>
    </details>
  </section>`;
}
