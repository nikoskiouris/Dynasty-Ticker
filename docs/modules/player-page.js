import { pathForPlace } from "./history-route.js";
import { escapeHtml, formatNumber } from "./html.js";
import { renderPlayerFace } from "./player-face.js";
import { playerValueTrend, renderValueTrend, renderValuesFreshness } from "./value-scale.js";

function fact(label, value) {
  if (value == null || value === "") return "";
  return `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`;
}

function points(value) {
  return Number.isFinite(value) ? formatNumber(value) : null;
}

function renderProjectionInputs(projection = {}, replacement) {
  const { season, seasonPpr, week, weekPpr, remainingPpr, remainingGames, actualPpr, gamesPlayed, recentPpr, recentTeamGames } = projection;
  if (!season) return "";
  const games = n => `${formatNumber(n)} ${n === 1 ? "game" : "games"}`;
  const forecastRows = [
    fact(Number.isInteger(remainingGames) ? `Next ${games(remainingGames)}` : "Rest of season", points(remainingPpr)),
    fact("Replacement starter, rest of season", points(Number.isFinite(replacement) ? Math.round(replacement * 10) / 10 : null)),
  ].join("");
  const sleeperRows = [
    fact(`${season} scored${Number.isFinite(gamesPlayed) ? ` · ${games(gamesPlayed)}` : ""}`, points(actualPpr)),
    recentTeamGames > 0 ? fact(`Last ${recentTeamGames} team ${recentTeamGames === 1 ? "game" : "games"}`, points(recentPpr)) : "",
    week ? fact(`Week ${week} projection`, points(weekPpr)) : "",
    fact(`${season} full-season projection`, points(seasonPpr)),
  ].join("");
  return `${forecastRows ? `<h3>Model forecast · PPR points</h3><dl class="player-detail-facts">${forecastRows}</dl>` : ""}
    ${sleeperRows ? `<h3>Sleeper · PPR points</h3><dl class="player-detail-facts">${sleeperRows}</dl>` : ""}`;
}

function renderValueFactors(model, priceModel) {
  if (model.priceBasis === "market" || model.priceBasis === "football") {
    const hasQuote = model.priceBasis === "market";
    const scores = [
      fact("Trade market", hasQuote ? points(model.marketScore) : "Quote unavailable"),
      fact("Football estimate", points(model.footballScore)),
    ].join("");
    const basis = hasQuote
      ? "The market quote sets this trade price."
      : "The football estimate sets this trade price because there is no market quote.";
    const forecast = Number.isFinite(model.footballScore)
      ? " The football estimate uses projected points above replacement for the rest of this season and the next two." : "";
    return `<dl class="player-detail-facts">${scores}</dl><p>${basis}${forecast}</p>`;
  }
  if (!model.factors && !Number.isFinite(model.footballSurplus) && !Number.isFinite(model.marketShare)) return "";
  const coverage = new Set(model.coverage || []);
  const factors = [
    ["lineup", "Rest-of-season lineup advantage", Number.isFinite(model.projection?.remainingPpr)],
    ["future", "Future production", coverage.has("seasonProjection") || coverage.has("priorSeason") || coverage.has("currentSeason")],
    ["draft", "Early-career draft capital", coverage.has("draftCapital") && model.experience <= 1],
    ["market", "Trade market", coverage.has("market")],
  ];
  const scores = factors.map(([key, label, applies]) => {
    const value = model.factors?.[key];
    return applies || value > 0 ? fact(label, points(value)) : "";
  }).join("");
  const share = model.marketShare;
  const discount = priceModel?.horizonDiscount;
  const elite = priceModel?.scoreAnchors?.find(anchor => anchor.score === priceModel.ratingReference?.eliteScore);
  const benchmark = Number.isFinite(elite?.surplus)
    ? fact(`${formatNumber(elite.score)}-point football benchmark`, `${formatNumber(elite.surplus)} discounted PPR pts`) : "";
  const modelRows = [
    Number.isFinite(share) ? fact("Weights", `${formatNumber((1 - share) * 100)}% football · ${formatNumber(share * 100)}% market`) : "",
    fact("Above replacement, rest of season + next two", Number.isFinite(model.footballSurplus) ? `${formatNumber(model.footballSurplus)} discounted PPR pts` : ""),
    Number.isFinite(discount) ? fact("Future surplus weights", `Year 2 · ${formatNumber(discount * 100)}% / Year 3 · ${formatNumber(discount ** 2 * 100)}%`) : "",
    benchmark,
  ].join("");
  return `${scores ? `<h3>Points toward value</h3><dl class="player-detail-facts">${scores}</dl>` : ""}
    ${modelRows ? `<h3>Model inputs</h3><dl class="player-detail-facts">${modelRows}</dl>` : ""}`.trim();
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
  const draft = row.draft;
  const thisSeason = Number(model.projection?.season);
  const draftYear = draft?.year || (thisSeason && years != null && Number.isFinite(Number(years)) ? thisSeason - Number(years) : "");
  const pick = draft?.pick || model.draftPick;
  const draftLine = pick > 0 ? `${draftYear ? draftYear + " NFL draft" : "NFL draft"} · ${draft?.round ? `Round ${draft.round}, ` : ""}pick ${pick} overall` : "";
  const career = years == null ? "" : Number(years) === 0 ? "Rookie" : `${years} ${Number(years) === 1 ? "year" : "years"} of experience`;
  const injury = String(row.injuryStatus || raw.injury_status || "").trim();
  const bio = [row.position, row.team || "FA", Number(row.age) > 0 ? `Age ${Number(row.age).toFixed(1)}` : "", injury].filter(Boolean).join(" · ");
  const trend = playerValueTrend(view.history, row.assetId, "sf");
  const priced = row.value > 0;
  const comparison = pickRefLine(row.value, row.pickRef);
  const valueFactors = priced ? renderValueFactors(model, view.priceModel) : "";
  const production = row.production?.lastLine || row.note || "";
  const stats = renderProjectionInputs(model.projection || {}, view.priceModel?.seasonReplacement?.[row.position]);
  const comparables = (row.neighbors || []).filter(n => n.kind === "player" && n.value > 0);
  const owner = row.owner?.mine ? "On your team" : row.owner?.name ? `Owned by ${row.owner.name}` : view.leagueOpen ? "Unrostered in your league" : "";
  return `<article class="player-detail" data-profile-id="${escapeHtml(row.assetId)}" aria-labelledby="player-detail-name">
    <div class="player-detail-top"><button type="button" class="ghost-btn player-return" data-action="player-rankings-return"><span aria-hidden="true">←</span> Rankings</button></div>
    <header class="player-detail-header">${renderPlayerFace(row.playerId, row.name, { size: "md" })}<div><h1 id="player-detail-name">${escapeHtml(row.name)}</h1><p>${escapeHtml(bio)}</p>${owner ? `<p class="player-detail-owner">${escapeHtml(owner)}</p>` : ""}</div></header>
    <section class="player-detail-value" aria-label="Dynasty player value">
      <span class="player-value-caption">Dynasty value</span>
      <strong>${priced ? `${escapeHtml(formatNumber(row.value))}<small> / 100</small>` : "Unavailable"}</strong>
      ${priced ? `<span>${escapeHtml([row.overallRank ? `#${row.overallRank} overall` : "", row.boardRank].filter(Boolean).join(" · "))}</span>` : ""}
      ${trend && priced ? renderValueTrend(trend, { spark: true, showWindow: true }) : ""}
      ${comparison ? `<p class="player-pick-ref">${escapeHtml(comparison)}</p>` : ""}
      <div class="player-price-meta"><span>12-team Superflex · Full PPR</span>${renderValuesFreshness(view.updated)}</div>
    </section>
    ${priced ? `<div class="player-detail-actions"><button type="button" class="player-trade-action" data-action="rank-calc" data-asset-id="${escapeHtml(row.assetId)}" data-name="${escapeHtml(row.name)}" data-kind="player">Add to trade</button><button type="button" class="ghost-btn player-share" data-action="player-share" data-name="${escapeHtml(row.name)}" data-value="${escapeHtml(formatNumber(row.value))}">Share player</button><p class="player-share-status" role="status" aria-live="polite"></p></div>` : ""}
    <div class="player-evidence">
      ${valueFactors ? `<details data-player-section="value"><summary>Value breakdown</summary>${valueFactors}</details>` : ""}
      ${stats || production || draftLine || career ? `<details data-player-section="production"><summary>Stats &amp; projections</summary>
        ${production ? `<p>${escapeHtml(production)}</p>` : ""}
        ${stats}
        ${career || draftLine ? `<p>${escapeHtml([career, draftLine].filter(Boolean).join(" · "))}</p>` : ""}
      </details>` : ""}
    </div>
    ${priced && comparables.length ? `<section><h2>Similar values</h2><div class="player-comparables">${comparables.map(n => `<a href="${escapeHtml(pathForPlace({ playerId: n.playerId, playerName: n.name, leagueId: view.leagueId }))}" class="ghost-btn" data-action="rank-open" data-asset-id="${escapeHtml(n.assetId)}">${renderPlayerFace(n.playerId, n.name, {size:"sm"})}<span>${escapeHtml(n.name)}<small>${escapeHtml(n.boardRank || n.position)} · ${escapeHtml(formatNumber(n.value))}</small></span></a>`).join("")}</div></section>` : ""}
  </article>`;
}
