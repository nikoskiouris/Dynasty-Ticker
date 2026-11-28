import { renderPlayerLabel } from "./player-face.js";
import { formatPoints } from "./standings.js";
import { countLabel, escapeHtml, formatNumber } from "./html.js";
import { lineupAwards } from "./league-lineup-awards.js";
import { waiverAwards } from "./league-waiver-awards.js";
import { roundPrice } from "./price-units.js";

const e = (value) => escapeHtml(String(value ?? ""));
// Keep Sleeper fantasy points, FAAB dollars and dynasty value in their own units.
const points = (value) => formatPoints(value);
const valueLabel = (value) => Number.isFinite(value) ? formatNumber(roundPrice(value)) : "—";
const dollars = (value) => Number.isFinite(Number(value)) ? formatNumber(Math.round(Number(value))) : "—";
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
    : '<p class="muted">Too few complete records.</p>';
}
export function renderOperationsAwards(archive, { players = {}, values = {}, valueNames = {}, showLineup = false } = {}) {
  // Full exact-lineup evaluation across six seasons can be costly. Do it
  // only after the user requests the result, and cache the immutable archive.
  const lineup = showLineup ? cachedLineup(archive, players) : null;
  const waiver = waiverAwards(archive, { values });
  const playerName = (id) => renderPlayerLabel(valueNames[`player:${id}`] || `Player ${id}`, id, { size: "xs" });
  const waiverPlayer = (row) => row
    ? `<p><strong>${playerName(row.playerId)}</strong> · ${e(row.managerName)} (${e(row.season)}) ·
      ${points(row.startedPoints)} started points · ${valueLabel(row.currentRosterValue)} value still owned</p>
      ${row.starts.length ? `<p class="muted small">Started ${row.starts.length} week${row.starts.length === 1 ? "" : "s"}, first ${row.starts.slice(0, 2).map((game) =>
        `${e(game.season)} W${game.week} (${points(game.points)} pts)`).join(", ")}</p>` : ""}`
    : '<p class="muted">No pickup with complete records.</p>';
  return `<section class="workspace-panel">
    <h2>Lineup and waiver awards <span class="mini-chip">Historical estimate</span></h2>
    <div class="league-history-awards">
      ${lineup
        ? `<div><h3 data-lineup-award="best">Best lineup setter</h3>${person(lineup.best, (row) => `${percent(row.efficiency)} optimal · ${countLabel(row.weeks, "week")} · ${countLabel(row.gamesLostToBench, "game")} lost to bench`)}</div>
           <div><h3>Worst lineup setter</h3>${person(lineup.worst, (row) => `${percent(row.efficiency)} optimal · ${countLabel(row.weeks, "week")} · ${countLabel(row.gamesLostToBench, "game")} lost to bench · worst ${row.worstWeek?.season} W${row.worstWeek?.week}: ${points(row.worstWeek?.pointsLeft)} pts left`)}</div>`
        : '<div><button type="button" data-action="compute-lineup-awards">Calculate lineup awards</button></div>'}
      <div><h3>Best waiver manager</h3>${person(waiver.best, (row) => `${valueLabel(row.score)} score · ${points(row.startedPoints)} started points · ${countLabel(row.adds, "add")}`)}</div>
      <div><h3>Worst waiver manager</h3>${person(waiver.worst, (row) => `${valueLabel(row.score)} score · ${points(row.startedPoints)} started points · ${countLabel(row.adds, "add")}`)}</div>
      <div><h3>Best waiver pickup</h3>${waiverPlayer(waiver.bestPickup)}</div>
      <div><h3>FAAB efficiency</h3><p class="muted small">${waiver.best?.faabPerStartedPoint != null
        ? `${e(waiver.best.name)} · ${Number(waiver.best.faabPerStartedPoint).toFixed(2)} FAAB per started point · ${dollars(waiver.best.faabSpent)} spent on ${countLabel(waiver.best.faabKnownAdds, "pickup")} · ${points(waiver.best.faabStartedPoints)} started points`
        : "FAAB per point unavailable for the leading manager."}</p></div>
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
      <p class="muted small">${lineup ? `Lineups covered ${lineup.validWeeks} of ${lineup.examinedWeeks} team-weeks. ${lineup.unavailableWeeks} unavailable.` : ""} Waivers: ${waiver.evaluatedAdds} priced pickups · ${waiver.unpricedAdds + waiver.undatedAdds + waiver.invalidWeeks} skipped for missing data.</p>
    </details>
  </section>`;
}
