import { escapeHtml, formatNumber } from "./html.js";
import { renderPlayerFace } from "./player-face.js";
import { playerValueTrend, renderValueTierBadge, renderValueTrend, renderValuesFreshness } from "./value-scale.js";

const show = (value, digits = 1) => value != null && Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : "—";

// The price is a learned mix of two inputs on one scale: the football forecast
// and the Superflex dynasty market. Both parts ship with the snapshot; never invent one.
// Owner rule: no other site is named on Dynasty Ticker.
export function playerPriceParts(row) {
  const price = row?.model?.price;
  if (!price || !Number.isFinite(Number(price.forecastShare))) return null;
  const share = Math.min(1, Math.max(0, Number(price.forecastShare)));
  return { forecast: Number(price.forecast) || 0, market: Number(price.market) || 0, rank: price.marketRank, share };
}

// Each season: forecast full-PPR points and games before the time discount (the
// age curve as forecast), and what the season adds to the forecast after the discount.
// While a season is under way, the first row is the weeks left and the last row
// is part of a season, so neither is a full season.
export function playerForecastContributions(row) {
  const seasons = (row?.model?.forecast?.sf || []).filter(s => Number.isFinite(Number(s.discountedAdvantage)));
  const total = seasons.reduce((sum, s) => sum + Math.max(0, Number(s.discountedAdvantage)), 0);
  const points = s => Number.isFinite(Number(s.expectedPoints)) ? Number(s.expectedPoints) : Number(s.expectedAdvantage) || 0;
  const healthy = s => Number.isFinite(Number(s.healthyPoints)) ? Number(s.healthyPoints) : points(s);
  // One bar scale for every player at the position (from the snapshot), so bars
  // compare across players and across both views. Older snapshots fall back to his own best.
  const scaleMax = Number(row?.model?.forecastScale?.max);
  const top = scaleMax > 0 ? scaleMax : Math.max(0, ...seasons.map(healthy), ...seasons.map(points));
  const pct = v => top > 0 ? Math.min(1, Math.max(0, Number(v) || 0) / top) : 0;
  const parts = playerPriceParts(row);
  const whole = parts ? parts.forecast : Number(row.value);
  const underway = seasons.length > 1 && Number(seasons[seasons.length - 1].weight) < 1;
  return seasons.map((s, index) => {
    const partial = underway && (index === 0 || index === seasons.length - 1);
    const label = underway && index === 0 ? `Rest of ${s.season}` : partial ? `Part of ${s.season}` : String(s.season);
    return { ...s, label, partial, rest: underway && index === 0, points: points(s), share: pct(points(s)),
      healthy: healthy(s), healthyShare: pct(healthy(s)),
      lineShare: Number.isFinite(Number(s.line)) ? pct(s.line) : null,
      healthyLineShare: Number.isFinite(Number(s.healthyLine)) ? pct(s.healthyLine) : null,
      value: total > 0 ? whole * Math.max(0, Number(s.discountedAdvantage)) / total : 0 };
  });
}

// The bars share one scale per position; the mark is that season's last weekly starter.
function forecastScaleNote(row) {
  const scale = row?.model?.forecastScale;
  if (!scale?.max) return "";
  const pos = escapeHtml(row.position);
  return `<p class="muted forecast-legend"><span class="forecast-legend-mark" aria-hidden="true"></span>Every ${pos} uses the same bar scale, so you can compare players. The mark is the ${pos}${escapeHtml(scale.starters)} line: the last weekly starter at ${pos} in a 12-team Superflex league that season.</p>`;
}

function renderPriceParts(parts) {
  if (!parts) return "";
  const pct = Math.round(parts.share * 100);
  const rank = parts.rank != null && Number.isFinite(Number(parts.rank)) ? `market rank ${show(parts.rank, 1)}` : "outside the market's ranked list";
  return `<dl class="player-price-parts"><div><dt>Football forecast · ${pct}%</dt><dd>${escapeHtml(formatNumber(parts.forecast))}</dd></div><div><dt>Market · ${100 - pct}%</dt><dd>${escapeHtml(formatNumber(parts.market))}</dd></div></dl><p class="muted">The price mixes what his production forecasts with where Superflex dynasty rankings put him (${escapeHtml(rank)}), on the same scale. The mix by position is learned from how both did against what players went on to score, 2020–2025.</p>`;
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
  const thisSeason = Number(model.forecast?.sf?.[0]?.season);
  const draftYear = Number.isFinite(thisSeason) && Number.isFinite(Number(years)) ? thisSeason - Number(years) : null;
  const draftLine = draft
    ? `${draft.year || ""} R${draft.round} P${draft.pick}`.trim()
    : Number(model.draftPick) > 0
      ? `${draftYear ? `${draftYear} NFL draft, ` : "NFL draft "}pick ${model.draftPick} overall`
      : "NFL draft slot unavailable";
  // Game status only. Sleeper's roster "status" (Active, Inactive) is not an injury.
  const injury = String(row.injuryStatus || raw.injury_status || "").trim();
  const trend = playerValueTrend(view.history, row.assetId, "sf");
  const forecast = playerForecastContributions(row);
  const parts = playerPriceParts(row);
  const confidence = rookie ? "Rookie, little NFL data" : { established: "Established: several NFL seasons", developing: "Developing: limited NFL games", thin: "Early estimate: few NFL games" }[model.confidence] || "Limited model data";
  const comparables = (row.neighbors || []).filter(n => n.kind === "player");
  const owner = row.owner?.mine ? "Owned by you" : row.owner?.name ? `Owned by ${row.owner.name}` : view.leagueOpen ? "Unrostered in your league" : "";
  return `<article class="player-detail" aria-labelledby="player-detail-name">
    <div class="player-detail-top"><p class="eyebrow">Player detail</p><button type="button" class="ghost-btn player-return" data-action="player-rankings-return">Return to player rankings</button></div>
    <header class="player-detail-header">${renderPlayerFace(row.playerId, row.name, { size: "md" })}<div><h1 id="player-detail-name">${escapeHtml(row.name)}</h1><p>${escapeHtml([row.position, row.team || "FA", `${show(row.age)} years old`, years != null ? (Number(years) === 0 ? "Rookie" : `${years} ${Number(years) === 1 ? "year" : "years"} experience`) : ""].filter(Boolean).join(" · "))}</p><p>${escapeHtml(draftLine)}${injury ? ` · ${escapeHtml(injury)}` : ""}</p>${owner ? `<p class="player-detail-owner">${escapeHtml(owner)}</p>` : ""}</div></header>
    <section class="player-detail-value" aria-label="Canonical player value"><strong>${escapeHtml(formatNumber(row.value))}</strong><span>Overall rank ${row.overallRank || "—"} · ${escapeHtml(row.boardRank || row.position)}</span>${renderValueTierBadge(row.value)}${trend ? renderValueTrend(trend, { spark: true }) : `<span class="muted">Price history is not available yet.</span>`}<p>Values: 12-team Superflex PPR dynasty</p>${renderValuesFreshness(view.updated)}</section>
    <div class="player-detail-grid"><section><h2>Why this value</h2>${renderPriceParts(parts)}<h3>Football forecast by season</h3>${forecast.length ? `<div class="forecast-mode" role="radiogroup" aria-label="Forecast view"><input type="radio" name="forecast-mode-${escapeHtml(row.assetId)}" id="fm-risk-${escapeHtml(row.assetId)}" class="forecast-mode-risk" checked><label for="fm-risk-${escapeHtml(row.assetId)}">With injury risk</label><input type="radio" name="forecast-mode-${escapeHtml(row.assetId)}" id="fm-full-${escapeHtml(row.assetId)}" class="forecast-mode-full"><label for="fm-full-${escapeHtml(row.assetId)}">Plays every game</label><p class="muted forecast-note-risk">Forecast full-PPR points each season, counting the chance he misses games or loses his role. This is the view the price uses. Uncertain futures include breakouts and slumps; later-season averages can shrink even for young players. This is not a predicted career arc.</p><p class="muted forecast-note-full">If he is on the field for every game: his forecast points per game, times every game. Not used in the price.</p>${forecastScaleNote(row)}<p>${escapeHtml(confidence)}</p><div class="player-forecast" role="list" aria-label="Forecast points by season">${forecast.map(s => `<div class="player-forecast-row${s.partial ? " is-partial" : ""}" role="listitem"><span>${escapeHtml(s.label)}</span><span class="player-forecast-track"><span class="bar-risk" style="width:${(s.share * 100).toFixed(2)}%"></span><span class="bar-full" style="width:${(s.healthyShare * 100).toFixed(2)}%"></span>${s.lineShare != null ? `<i class="forecast-line line-risk" style="left:${(s.lineShare * 100).toFixed(2)}%"></i>` : ""}${s.healthyLineShare != null ? `<i class="forecast-line line-full" style="left:${(s.healthyLineShare * 100).toFixed(2)}%"></i>` : ""}</span><span class="forecast-pts"><b class="pts-risk">${escapeHtml(show(s.points, 0))}</b><b class="pts-full">${escapeHtml(show(s.healthy, 0))}</b></span><small><span class="pts-risk">${s.rank ? `<strong>${escapeHtml(row.position)}${escapeHtml(s.rank)}</strong> · ` : ""}${s.expectedGames != null ? `${s.rest && s.possibleGames != null ? `${escapeHtml(show(s.possibleGames, 0))} games left` : `about ${escapeHtml(show(s.expectedGames, 0))} games · ${escapeHtml(show(Number(s.expectedGames) > 0 ? s.points / Number(s.expectedGames) : null, 1))} per game`}` : ""}</span><span class="pts-full">${s.healthyRank ? `<strong>${escapeHtml(row.position)}${escapeHtml(s.healthyRank)}</strong> · ` : ""}${s.possibleGames != null ? `${escapeHtml(show(s.possibleGames, 0))} games${s.rest ? " left" : ""} · ${escapeHtml(show(Number(s.possibleGames) > 0 ? s.healthy / Number(s.possibleGames) : null, 1))} per game` : ""}</span></small></div>`).join("")}</div></div>` : `<p>${escapeHtml(confidence)}</p><p>Season-by-season forecast is unavailable for this player.</p>`}<dl class="player-detail-facts"><div><dt>Recent PPR points per game</dt><dd>${show(components.recentPpg)}</dd></div><div><dt>${row.position === "QB" ? "Pass attempts + carries" : "Carries + targets"} per game</dt><dd>${show(components.roleOppPerGame)}</dd></div><div><dt>Recent availability</dt><dd>${components.availability != null ? `${show(Number(components.availability) * 100, 0)}%` : "—"}</dd></div></dl></section>
    <section><h2>Production</h2>${row.production?.lastLine ? `<p>${escapeHtml(row.production.lastLine)}</p>` : row.note ? `<p>${escapeHtml(row.note)}</p>` : `<p>${rookie ? "Rookie, little NFL data." : "Last-season production is unavailable."}</p>`}<p>${components.currentSeasonGames != null ? `${Number(components.currentSeasonGames)} ${Number(components.currentSeasonGames) === 1 ? "game" : "games"} played this season` : "Current-season games unavailable"}</p><p class="muted">Recent scoring above uses the model's available NFL sample. Full current-season totals and weekly points are not available in this snapshot.</p></section></div>
    <section><h2>Similar player values</h2>${comparables.length ? `<div class="player-comparables">${comparables.map(n => `<button type="button" class="ghost-btn" data-action="rank-open" data-asset-id="${escapeHtml(n.assetId)}">${renderPlayerFace(n.playerId, n.name, {size:"sm"})}<span>${escapeHtml(n.name)}<small>${escapeHtml(n.boardRank || n.position)} · ${escapeHtml(formatNumber(n.value))}</small></span></button>`).join("")}</div>` : `<p>No comparable player values available.</p>`}</section>
    <button type="button" class="player-trade-action" data-action="rank-calc" data-asset-id="${escapeHtml(row.assetId)}" data-name="${escapeHtml(row.name)}" data-kind="player">Add to a trade</button>
  </article>`;
}
