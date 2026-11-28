import { escapeHtml, formatNumber } from "./html.js";
import { renderPlayerFace } from "./player-face.js";
import { playerValueTrend, renderValueTierBadge, renderValueTrend, renderValuesFreshness } from "./value-scale.js";

const show = (value, digits = 1) => value != null && Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : "—";

function renderProjectionInputs(projection, replacement) {
  const { season, seasonPpr, week, weekPpr, remainingPpr, remainingGames, actualPpr, gamesPlayed, recentPpr, recentTeamGames } = projection || {};
  if (!season) return "<p>Projections unavailable.</p>";
  const points = value => Number.isFinite(value) ? formatNumber(value) : "Unavailable";
  return `<h3>Remaining regular season</h3><dl class="player-detail-facts">
    <div><dt>Model PPR forecast${Number.isInteger(remainingGames) ? ` over ${remainingGames} remaining ${remainingGames === 1 ? "game" : "games"}` : ", rest of season"}</dt><dd>${points(remainingPpr)}</dd></div>
    <div><dt>Replacement starter, remaining PPR points</dt><dd>${points(Number.isFinite(replacement) ? Math.round(replacement * 10) / 10 : null)}</dd></div>
    </dl><h3>Sleeper scoring and projections</h3><dl class="player-detail-facts">
    <div><dt>${escapeHtml(season)} points already scored${Number.isFinite(gamesPlayed) ? ` (${formatNumber(gamesPlayed)} ${gamesPlayed === 1 ? "game" : "games"})` : ""}</dt><dd>${points(actualPpr)}</dd></div>
    ${Number.isFinite(recentPpr) && recentTeamGames > 0 ? `<div><dt>PPR points in the last ${formatNumber(recentTeamGames)} team ${recentTeamGames === 1 ? "game" : "games"}</dt><dd>${points(recentPpr)}</dd></div>` : ""}
    ${week ? `<div><dt>Week ${escapeHtml(week)} PPR projection</dt><dd>${points(weekPpr)}</dd></div>` : ""}
    <div><dt>Full-season PPR projection</dt><dd>${points(seasonPpr)}</dd></div>
    </dl>`;
}

function renderValueFactors(model, weights) {
  const coverage = new Set(model.coverage || []);
  const forecast = coverage.has("seasonProjection");
  const production = coverage.has("priorSeason") || coverage.has("currentSeason");
  const draftEligible = model.experience === 0 || model.experience === 1;
  const factors = [
    ["lineup", "Remaining-season lineup advantage", Number.isFinite(model.projection?.remainingPpr), "Forecast unavailable"],
    ["future", "Future production", forecast || production, "Production data unavailable"],
    ["draft", "Early-career draft capital", coverage.has("draftCapital"), draftEligible ? "Draft data unavailable" : "Not applied"],
    ["market", "Comparable market value", coverage.has("market"), "Quote unavailable"],
  ];
  const rows = factors.map(([key, label, available, missing]) => {
    const points = model.factors?.[key];
    return `<div><dt>${label}</dt><dd>${available && Number.isFinite(points) ? formatNumber(points) : missing}</dd></div>`;
  });
  const marketOnly = coverage.size === 1 && coverage.has("market");
  const summary = marketOnly ? "Only a market quote was available for this player." : "These contributions add up to the published value. Lineup advantage measures how many more PPR points he can still earn than a replacement starter.";
  const percent = (weight) => `${formatNumber(Math.round(1000 * weight) / 10)}%`;
  const recipe = weights && [weights.lineup, weights.future, weights.market].every(Number.isFinite)
    ? `<p>Current weights are ${percent(weights.lineup)} for remaining-season lineup advantage, ${percent(weights.future)} for future production (including early-career draft capital), and ${percent(weights.market)} for market value. As games are played, more weight shifts to future seasons.</p>` : "";
  return `<p>${summary}</p><dl class="player-detail-facts">${rows.join("")}</dl>${recipe}`;
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
  const years = model.experience ?? raw.years_exp;
  const rookie = years != null && Number(years) === 0;
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
    <section class="player-detail-value" aria-label="Canonical player value"><strong>${priced ? escapeHtml(formatNumber(row.value)) : "Value unavailable"}</strong>${priced ? `<span>Overall rank ${row.overallRank} · ${escapeHtml(row.boardRank || row.position)}</span>` : ""}${renderValueTierBadge(row.tier)}${trend ? renderValueTrend(trend, { spark: true, showWindow: true }) : ""}${pickRefLine(row.value, row.pickRef) ? `<p class="player-pick-ref">${escapeHtml(pickRefLine(row.value, row.pickRef))}</p>` : ""}<p>12-team Superflex PPR dynasty values</p>${view.updated?.stale ? renderValuesFreshness(view.updated) : ""}</section>
    <div class="player-detail-grid"><section><h2>Why this value</h2>${renderValueFactors(model, view.priceModel?.weights)}</section>
    <section><h2>Production</h2>${row.production?.lastLine ? `<p>${escapeHtml(row.production.lastLine)}</p>` : row.note ? `<p>${escapeHtml(row.note)}</p>` : `<p>${rookie ? "Rookie, little NFL data." : "Last-season production is unavailable."}</p>`}${renderProjectionInputs(model.projection, view.priceModel?.seasonReplacement?.[row.position])}</section></div>
    ${priced ? `<section><h2>Similar player values</h2>${comparables.length ? `<div class="player-comparables">${comparables.map(n => `<button type="button" class="ghost-btn" data-action="rank-open" data-asset-id="${escapeHtml(n.assetId)}">${renderPlayerFace(n.playerId, n.name, {size:"sm"})}<span>${escapeHtml(n.name)}<small>${escapeHtml(n.boardRank || n.position)} · ${escapeHtml(formatNumber(n.value))}</small></span></button>`).join("")}</div>` : `<p>No comparable player values available.</p>`}</section>
    <div class="player-detail-actions"><button type="button" class="player-trade-action" data-action="rank-calc" data-asset-id="${escapeHtml(row.assetId)}" data-name="${escapeHtml(row.name)}" data-kind="player">Add to a trade</button><button type="button" class="ghost-btn player-share" data-action="player-share" data-name="${escapeHtml(row.name)}" data-value="${escapeHtml(formatNumber(row.value))}">Share this player</button><p class="player-share-status" role="status" aria-live="polite"></p></div>` : ""}
  </article>`;
}
