import { escapeHtml, formatNumber } from "./html.js";
import { renderPlayerFace } from "./player-face.js";
import { playerValueTrend, renderValueTierBadge, renderValueTrend, renderValuesFreshness } from "./value-scale.js";

const show = (value, digits = 1) => value != null && Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : "—";

function renderSleeperProjection(projection) {
  const { season, seasonPpr, week, weekPpr } = projection || {};
  const points = value => value == null ? "Unavailable" : escapeHtml(String(value));
  return `<h3>Sleeper projections</h3>${season
    ? `<dl class="player-detail-facts">${week ? `<div><dt>Week ${escapeHtml(week)} PPR points</dt><dd>${points(weekPpr)}</dd></div>` : ""}<div><dt>${escapeHtml(season)} season PPR points</dt><dd>${points(seasonPpr)}</dd></div></dl>`
    : "<p>Projections unavailable.</p>"}`;
}

function tradeEvidenceText(evidence) {
  if (!evidence) return "Trade evidence unavailable.";
  const { recentTrades, recentDays, completedTrades, limited } = evidence;
  if (!completedTrades) return "No completed trades in the training sample.";
  const count = `${recentTrades} completed ${recentTrades === 1 ? "trade" : "trades"} in the last ${recentDays} days (${completedTrades} in the training sample).`;
  return limited ? `${count} Limited recent trade evidence.` : count;
}

export function pickRefLine(value, ref) {
  const v = Number(value);
  const p = Number(ref?.value);
  if (!(v > 0) || !(p > 0) || !ref?.name) return "";
  const ratio = v / p;
  const word = ratio >= 1.05 ? "More than" : ratio <= 0.95 ? "Less than" : "About";
  return `${word} a ${ref.name} (${formatNumber(p)})`;
}

export function renderPlayerPage(row, view = {}) {
  const model = row.model || {};
  const raw = row.raw || {};
  const components = model.components || {};
  const years = model.experience ?? raw.years_exp;
  const rookie = Number(years) === 0;
  const draft = row.draft;
  // The draft file covers recent classes. Older players carry only the overall
  // pick; their class year is this season minus years of experience.
  const thisSeason = Number(model.projection?.season);
  const draftYear = Number.isFinite(thisSeason) && Number.isFinite(Number(years)) ? thisSeason - Number(years) : null;
  const draftLine = draft
    // Same words as older players' line ("2017 NFL draft, pick 10 overall"), not "R1 P4".
    ? `${draft.year ? `${draft.year} NFL draft, ` : "NFL draft, "}round ${draft.round}, pick ${draft.pick} overall`
    : Number(model.draftPick) > 0
      ? `${draftYear ? `${draftYear} NFL draft, ` : "NFL draft "}pick ${model.draftPick} overall`
      : "NFL draft slot unavailable";
  // Game status only. Sleeper's roster "status" (Active, Inactive) is not an injury.
  const injury = String(row.injuryStatus || raw.injury_status || "").trim();
  const trend = playerValueTrend(view.history, row.assetId, "sf");
  const priced = row.value > 0;
  const comparables = (row.neighbors || []).filter(n => n.kind === "player" && n.value > 0);
  const owner = row.owner?.mine ? "Owned by you" : row.owner?.name ? `Owned by ${row.owner.name}` : view.leagueOpen ? "Unrostered in your league" : "";
  return `<article class="player-detail" aria-labelledby="player-detail-name">
    <div class="player-detail-top"><p class="eyebrow">Player detail</p><button type="button" class="ghost-btn player-return" data-action="player-rankings-return">Return to player rankings</button></div>
    <header class="player-detail-header">${renderPlayerFace(row.playerId, row.name, { size: "md" })}<div><h1 id="player-detail-name">${escapeHtml(row.name)}</h1><p>${escapeHtml([row.position, row.team || "FA", `${show(row.age)} years old`, years != null ? (Number(years) === 0 ? "Rookie" : `${years} ${Number(years) === 1 ? "year" : "years"} experience`) : ""].filter(Boolean).join(" · "))}</p><p>${escapeHtml(draftLine)}${injury ? ` · ${escapeHtml(injury)}` : ""}</p>${owner ? `<p class="player-detail-owner">${escapeHtml(owner)}</p>` : ""}</div></header>
    <section class="player-detail-value" aria-label="Canonical player value"><strong>${priced ? escapeHtml(formatNumber(row.value)) : "Value unavailable"}</strong>${priced ? `<span>Overall rank ${row.overallRank} · ${escapeHtml(row.boardRank || row.position)}</span>` : ""}${renderValueTierBadge(row.value)}${trend ? renderValueTrend(trend, { spark: true, showWindow: true }) : ""}${pickRefLine(row.value, row.pickRef) ? `<p class="player-pick-ref">${escapeHtml(pickRefLine(row.value, row.pickRef))}</p>` : ""}<p>12-team Superflex PPR dynasty values</p>${view.updated?.stale ? renderValuesFreshness(view.updated) : ""}</section>
    <div class="player-detail-grid"><section><h2>Why this value</h2><p>${escapeHtml(tradeEvidenceText(model.tradeEvidence))}</p>${renderSleeperProjection(model.projection)}<dl class="player-detail-facts"><div><dt>Recent PPR points per game</dt><dd>${show(components.recentPpg)}</dd></div><div><dt>${row.position === "QB" ? "Pass attempts + carries" : "Carries + targets"} per game</dt><dd>${show(components.roleOppPerGame)}</dd></div><div><dt>Recent availability</dt><dd>${components.availability != null ? `${show(Number(components.availability) * 100, 0)}%` : "—"}</dd></div></dl></section>
    <section><h2>Production</h2>${row.production?.lastLine ? `<p>${escapeHtml(row.production.lastLine)}</p>` : row.note ? `<p>${escapeHtml(row.note)}</p>` : `<p>${rookie ? "Rookie, little NFL data." : "Last-season production is unavailable."}</p>`}<p>${components.currentSeasonGames != null ? `${Number(components.currentSeasonGames)} ${Number(components.currentSeasonGames) === 1 ? "game" : "games"} played this season` : "Current-season games unavailable"}</p></section></div>
    ${priced ? `<section><h2>Similar player values</h2>${comparables.length ? `<div class="player-comparables">${comparables.map(n => `<button type="button" class="ghost-btn" data-action="rank-open" data-asset-id="${escapeHtml(n.assetId)}">${renderPlayerFace(n.playerId, n.name, {size:"sm"})}<span>${escapeHtml(n.name)}<small>${escapeHtml(n.boardRank || n.position)} · ${escapeHtml(formatNumber(n.value))}</small></span></button>`).join("")}</div>` : `<p>No comparable player values available.</p>`}</section>
    <div class="player-detail-actions"><button type="button" class="player-trade-action" data-action="rank-calc" data-asset-id="${escapeHtml(row.assetId)}" data-name="${escapeHtml(row.name)}" data-kind="player">Add to a trade</button><button type="button" class="ghost-btn player-share" data-action="player-share" data-name="${escapeHtml(row.name)}" data-value="${escapeHtml(formatNumber(row.value))}">Share this player</button><p class="player-share-status" role="status" aria-live="polite"></p></div>` : ""}
  </article>`;
}
