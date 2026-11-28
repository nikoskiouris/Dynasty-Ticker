import { escapeHtml, formatNumber } from "./html.js";
import { drafterAwards } from "./league-drafter-awards.js";
import { roundPrice } from "./price-units.js";

const e = (value) => escapeHtml(String(value ?? ""));
const number = (value) => Number.isFinite(value) ? formatNumber(roundPrice(value)) : "—";
const nameFor = (playerId, names) => e(names[`player:${playerId}`] || `Player ${playerId}`);
const leader = (row, values, names, kind) => {
  if (!row) return '<p class="muted">Not enough draft history or comparable picks to name a leader.</p>';
  const examples = kind === "high" ? row.hits : row.busts;
  return `<p><strong>${e(row.name)}</strong> · ${row.picks} comparable picks · ${number(row.averageSurplus)} avg surplus today</p>
    ${examples.length ? `<p class="muted small">Examples: ${examples.map((pick) =>
      `${nameFor(pick.playerId, names)} (${pick.surplus > 0 ? "+" : ""}${number(pick.surplus)})`).join(", ")}</p>` : ""}`;
};
export function renderDrafterAwards(archive, { values = {}, valueNames = {} } = {}) {
  const awards = drafterAwards(archive, values);
  return `<section class="workspace-panel">
    <h2>Draft awards · hindsight only</h2>
    <div class="league-history-awards">
      <div><h3>Highest-value drafter</h3>${leader(awards.best, values, valueNames, "high")}</div>
      <div><h3>Lowest-value drafter</h3>${leader(awards.worst, values, valueNames, "low")}</div>
    </div>
    <details><summary>Draft scoring method</summary>
      <p class="muted small">${e(awards.method)}</p>
      <p class="muted small">${awards.comparablePicks} picks graded; ${awards.missingPrices} had no price; ${awards.tooEarly} too recent.</p>
    </details>
  </section>`;
}
