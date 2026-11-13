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
    ? `<p><strong>${playerName(row.playerId)}</strong> · ${e(row.managerName)} (${e(row.season)}) ·
      ${points(row.startedPoints)} started points + ${points(row.currentRosterValue)} value still owned</p>
      ${row.starts.length ? `<p class="muted small">Weeks started: ${row.starts.slice(0, 2).map((game) =>
        `${e(game.season)} W${game.week} (${points(game.points)} pts)`).join(", ")}</p>` : ""}`
    : '<p class="muted">No fully sourced pickup found.</p>';
  return `<section class="workspace-panel">
    <h2>Lineup and waiver awards <span class="mini-chip">Historical estimate</span></h2>
    <p class="muted small">Eligible managers only. Missing player prices, eligible positions or weekly scores are excluded rather than treated as zero.</p>
    <div class="league-history-awards">
      ${lineup
        ? `<div><h3>Best lineup setter</h3>${person(lineup.best, (row) => `${percent(row.efficiency)} optimal · ${row.weeks} weeks · ${row.gamesLostToBench} games lost to bench`)}</div>
           <div><h3>Worst lineup setter</h3>${person(lineup.worst, (row) => `${percent(row.efficiency)} optimal · ${row.weeks} weeks · ${row.gamesLostToBench} games lost to bench · worst ${row.worstWeek?.season} W${row.worstWeek?.week}: ${points(row.worstWeek?.pointsLeft)} pts left`)}</div>`
        : '<div><h3>Lineup awards</h3><p class="muted small">Calculate legal optimal lineups using historical player points and roster eligibility.</p><button type="button" data-action="compute-lineup-awards">Calculate lineup awards</button></div>'}
      <div><h3>Best waiver manager</h3>${person(waiver.best, (row) => `${points(row.score)} score · ${points(row.startedPoints)} started points · ${row.adds} adds`)}</div>
      <div><h3>Worst waiver manager</h3>${person(waiver.worst, (row) => `${points(row.score)} score · ${points(row.startedPoints)} started points · ${row.adds} adds`)}</div>
      <div><h3>Highest-scoring waiver pickup</h3>${waiverPlayer(waiver.bestPickup)}</div>
      <div><h3>FAAB efficiency</h3><p class="muted small">${waiver.best?.faabPerStartedPoint != null
        ? `${points(waiver.best.faabPerStartedPoint)} FAAB units per started point for ${e(waiver.best.name)}`
        : "No fully sourced FAAB cost-per-point figure for the leading eligible manager."}</p></div>
    </div>
    <details><summary>Best pickup by manager</summary>
      <ul>${waiver.standings.map((row) => `<li><strong>${e(row.name)}</strong>:
        ${row.bestPickup ? waiverPlayer(row.bestPickup) : "No priced pickup"}
        ${row.eligible ? "" : `<span class="muted">Not enough data (${row.adds} / ${waiver.minAdds} adds)</span>`}
      </li>`).join("")}</ul>
    </details>
    <details><summary>Scoring rules and coverage</summary>
      ${lineup ? `<p class="muted small">${e(lineup.method)}</p>` : ""}
      <p class="muted small">${e(waiver.method)}</p>
      <p class="muted small">${lineup ? `Lineups: ${lineup.validWeeks} valid weekly team snapshots and ${lineup.unavailableWeeks} unavailable out of ${lineup.examinedWeeks}.` : "Lineup calculation not requested."} Waivers: ${waiver.evaluatedAdds} priced pickups, ${waiver.unpricedAdds} unpriced, ${waiver.undatedAdds} without documented transaction weeks, and ${waiver.invalidWeeks} missing weekly lineup score rows.</p>
    </details>
  </section>`;
}
