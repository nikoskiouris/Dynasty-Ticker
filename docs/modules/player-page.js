import { escapeHtml, formatNumber } from "./html.js";
import { renderPlayerFace } from "./player-face.js";
import { playerValueTrend, renderValueTierBadge, renderValueTrend, renderValuesFreshness } from "./value-scale.js";

const show = (value, digits = 1) => value != null && Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : "—";

// The forecast already contains discounted points above replacement. Distribute
// the published price by those contributions; never invent another price.
export function playerForecastContributions(row) {
  const seasons = (row?.model?.forecast?.sf || []).filter(s => Number.isFinite(Number(s.discountedAdvantage)));
  const total = seasons.reduce((sum, s) => sum + Math.max(0, Number(s.discountedAdvantage)), 0);
  return seasons.map(s => ({ ...s, share: total > 0 ? Math.max(0, Number(s.discountedAdvantage)) / total : 0, value: total > 0 ? Number(row.value) * Math.max(0, Number(s.discountedAdvantage)) / total : 0 }));
}

export function renderPlayerPage(row, view = {}) {
  const model = row.model || {};
  const raw = row.raw || {};
  const components = model.components || {};
  const years = model.experience ?? raw.years_exp;
  const rookie = Number(years) === 0;
  const draft = row.draft;
  const draftLine = draft ? `${draft.year || ""} R${draft.round} P${draft.pick}`.trim() : Number(model.draftPick) > 0 ? `NFL draft pick ${model.draftPick}` : "NFL draft slot unavailable";
  const injury = String(raw.injury_status || raw.status || "");
  const trend = playerValueTrend(view.history, row.assetId, "sf");
  const forecast = playerForecastContributions(row);
  const confidence = rookie ? "Rookie, little NFL data" : { established: "Established: several NFL seasons", developing: "Developing: limited NFL games", thin: "Early estimate: few NFL games" }[model.confidence] || "Limited model data";
  const comparables = (row.neighbors || []).filter(n => n.kind === "player");
  const owner = row.owner?.mine ? "Owned by you" : row.owner?.name ? `Owned by ${row.owner.name}` : view.leagueOpen ? "Unrostered in your league" : "";
  return `<article class="player-detail" aria-labelledby="player-detail-name">
    <div class="player-detail-top"><p class="eyebrow">Player detail</p><button type="button" class="ghost-btn player-return" data-action="player-rankings-return">Return to player rankings</button></div>
    <header class="player-detail-header">${renderPlayerFace(row.playerId, row.name, { size: "md" })}<div><h1 id="player-detail-name">${escapeHtml(row.name)}</h1><p>${escapeHtml([row.position, row.team || "FA", `${show(row.age)} years old`, years != null ? `${years} years experience` : ""].filter(Boolean).join(" · "))}</p><p>${escapeHtml(draftLine)}${injury ? ` · ${escapeHtml(injury)}` : ""}</p>${owner ? `<p class="player-detail-owner">${escapeHtml(owner)}</p>` : ""}</div></header>
    <section class="player-detail-value" aria-label="Canonical player value"><strong>${escapeHtml(formatNumber(row.value))}</strong><span>Overall rank ${row.overallRank || "—"} · ${escapeHtml(row.boardRank || row.position)}</span>${renderValueTierBadge(row.value)}${trend ? renderValueTrend(trend, { spark: true }) : `<span class="muted">Price history is not available yet.</span>`}<p>Values: 12-team Superflex PPR dynasty</p>${renderValuesFreshness(view.updated)}</section>
    <div class="player-detail-grid"><section><h2>Why this value</h2><p class="muted">Forecast, not a promise. Each season contributes to today's published value after discounting.</p><p>${escapeHtml(confidence)}</p>${forecast.length ? `<div class="player-forecast" role="list" aria-label="Forecast contribution by season">${forecast.map(s => `<div class="player-forecast-row" role="listitem"><span>${escapeHtml(s.season)}</span><span class="player-forecast-track"><span style="width:${(s.share * 100).toFixed(2)}%"></span></span><span>${escapeHtml(formatNumber(Math.round(s.value)))}</span><small>${show(s.expectedAdvantage)} expected points above replacement · ${show(s.discount, 2)} discount</small></div>`).join("")}</div>` : `<p>Season-by-season forecast is unavailable for this player.</p>`}<dl class="player-detail-facts"><div><dt>Recent PPR points per game</dt><dd>${show(components.recentPpg)}</dd></div><div><dt>${row.position === "QB" ? "Pass attempts + carries" : "Carries + targets"} per game</dt><dd>${show(components.roleOppPerGame)}</dd></div><div><dt>Recent availability</dt><dd>${components.availability != null ? `${show(Number(components.availability) * 100, 0)}%` : "—"}</dd></div></dl></section>
    <section><h2>Production</h2>${row.production?.lastLine ? `<p>${escapeHtml(row.production.lastLine)}</p>` : row.note ? `<p>${escapeHtml(row.note)}</p>` : `<p>${rookie ? "Rookie, little NFL data." : "Last-season production is unavailable."}</p>`}<p>${components.currentSeasonGames != null ? `${Number(components.currentSeasonGames)} games played this season` : "Current-season games unavailable"}</p><p class="muted">Recent scoring above uses the model's available NFL sample. Full current-season totals and weekly points are not available in this snapshot.</p></section></div>
    <section><h2>Similar player values</h2>${comparables.length ? `<div class="player-comparables">${comparables.map(n => `<button type="button" class="ghost-btn" data-action="rank-open" data-asset-id="${escapeHtml(n.assetId)}">${renderPlayerFace(n.playerId, n.name, {size:"sm"})}<span>${escapeHtml(n.name)}<small>${escapeHtml(n.boardRank || n.position)} · ${escapeHtml(formatNumber(n.value))}</small></span></button>`).join("")}</div>` : `<p>No comparable player values available.</p>`}</section>
    <button type="button" class="player-trade-action" data-action="rank-calc" data-asset-id="${escapeHtml(row.assetId)}" data-name="${escapeHtml(row.name)}" data-kind="player">Add to a trade</button>
  </article>`;
}
