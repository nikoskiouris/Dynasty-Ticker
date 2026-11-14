import { renderPlayerPage } from "./player-page.js";
import { escapeHtml, formatNumber } from "./html.js";
import {
  playerValueTrend,
  renderTrendSoon,
  renderValueScaleExplainer,
  renderValueTierBadge,
  renderValueTrend,
  renderValuesFreshness,
} from "./value-scale.js";
import { sleeperAvatarUrl } from "./sleeper.js";
import { renderPlayerFace } from "./player-face.js";
import { ordinal } from "./standings.js";
import { isInactivePlayerAsset, parsePickAssetId, upcomingDraftSeason } from "./values.js";
import { playerInitials, sleeperPlayerThumbUrl } from "./player-face.js";
import { playerAgeFromNfl } from "./player-notes.js";

export const RANK_PAGE_SIZE = 50;
export const RANK_LIST_FLOOR = 1500;
export const RANK_POSITION_FLOOR = 700;
// A typed name finds any priced player; browsing lists keep their floors.
export const RANK_SEARCH_FLOOR = 0;
export const RANK_POSITIONS = Object.freeze(["ALL", "QB", "RB", "WR", "TE", "PICK"]);
export const RANK_FORMATS = Object.freeze(["sf"]);
const SKILL_POSITIONS = new Set(["QB", "RB", "WR", "TE"]);
const PICK_BUCKET_TIE = { any: 0, mid: 1, late: 2, early: 3 };
const PICK_CLOSE_RATIO = 0.08;
const PICK_FAR_RATIO = 1.8;

export function isRankAssetId(value) {
  const token = String(value || "").trim();
  if (/^player:\d+$/.test(token)) return true;
  return /^pick:\d{4}:r\d+:(?:any|early|mid|late)$/.test(token);
}

export function rankFormatLabel(format) {
  return "12-team Superflex PPR dynasty";
}

export function foldRankQuery(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function marketTape({ confidence = "", kind = "player" } = {}) {
  if (kind === "pick") {
    return { tone: "model", line: "Historical rookie-outcome estimate." };
  }
  if (confidence === "established") {
    return { tone: "model", line: "Estimate based on several NFL seasons." };
  }
  if (confidence === "developing") {
    return { tone: "model", line: "Estimate still settling: limited NFL games." };
  }
  if (confidence === "thin") {
    return { tone: "model", line: "Early estimate: few NFL games so far." };
  }
  return { tone: "model", line: "" };
}

export function pickEqualLine(value, pick, best) {
  const price = Number(value);
  const pickValue = Number(pick?.value);
  const bestValue = Number(best?.value);
  if (!(price > 0)) return "";
  if (best?.phrase && bestValue > 0 && price > bestValue * (1 + PICK_CLOSE_RATIO)) {
    return `Worth more than a ${best.phrase}.`;
  }
  if (!pick?.phrase || !(pickValue > 0)) return "";
  const ratio = price / pickValue;
  if (ratio > PICK_FAR_RATIO || ratio < 1 / PICK_FAR_RATIO) return `Closest pick is a ${pick.phrase}.`;
  if (ratio >= 1 - PICK_CLOSE_RATIO && ratio <= 1 + PICK_CLOSE_RATIO) return `Worth about a ${pick.phrase}.`;
  if (ratio > 1) return `A step above a ${pick.phrase}.`;
  return `A step under a ${pick.phrase}.`;
}

export function ownerLine(owner, { leagueOpen = false, kind = "player" } = {}) {
  if (kind !== "player") return "";
  if (!leagueOpen) return "Connect your league to see who owns him.";
  if (owner?.mine) return "You have him.";
  if (owner?.name) return `${owner.name} has him.`;
  return "Nobody in this league has him.";
}

export function rankBoardNote({ format = "sf", leagueFormat = "", caveat = "" } = {}) {
  return `Values: 12-team Superflex PPR dynasty.${caveat ? ` ${caveat}` : ""}`;
}

export function buildRankBoard({
  values = {},
  modelPlayers = {},
  names = {},
  nflPlayers = {},
  owners = {},
  noteFor = null,
  detailFor = null,
  minPickSeason = upcomingDraftSeason(),
} = {}) {
  const picks = collectRankPicks(values, minPickSeason);
  const pickById = new Map(picks.map((pick) => [pick.assetId, pick]));
  const bestPick = picks.reduce((best, pick) => (!best || pick.value > best.value ? pick : best), null);
  const players = [];

  for (const [assetId, rawValue] of Object.entries(values || {})) {
    if (!String(assetId).startsWith("player:")) continue;
    const value = Number(rawValue);
    // Every published price gets a row, even a low one, so his page opens with
    // that price. The lists below apply their own floors.
    if (!Number.isFinite(value) || value < 0) continue;
    const playerId = assetId.slice("player:".length);
    const raw = nflPlayers?.[playerId] || nflPlayers?.[String(playerId)] || null;
    if (raw && isInactivePlayerAsset({ assetType: "player", raw })) continue;
    const model = modelPlayers?.[assetId] || null;
    const position = playerPosition(raw) || String(model?.position || "").toUpperCase();
    if (position && !SKILL_POSITIONS.has(position)) continue;
    const name = playerName(assetId, names, raw);
    if (!name) continue;
    const age = playerAgeFromNfl(raw) ?? (Number.isFinite(Number(model?.age)) ? Number(model.age) : null);
    const team = String(raw?.team || model?.team || "").trim().toUpperCase();
    const pickEqual = closestPick(value, picks);
    const tape = marketTape({ confidence: model?.confidence, kind: "player" });
    players.push({
      assetId,
      playerId,
      kind: "player",
      name,
      value: Math.round(value),
      position,
      team: team && team !== "FA" ? team : "",
      age: Number.isFinite(age) ? age : null,
      pickEqual,
      pickLine: pickEqualLine(value, pickEqual, bestPick),
      tape,
      model,
      raw,
      ...(typeof detailFor === "function" ? detailFor(playerId, raw) : {}),
      owner: owners?.[assetId] || null,
      note: typeof noteFor === "function" ? String(noteFor(playerId, raw) || "") : "",
      photoUrl: sleeperPlayerThumbUrl(playerId),
      initials: playerInitials(name),
    });
  }

  const pickRows = picks
    .filter((pick) => pick.bucket === "any")
    .map((pick) => ({
      assetId: pick.assetId,
      playerId: "",
      kind: "pick",
      name: pick.phrase,
      value: Math.round(pick.value),
      position: "PICK",
      team: "",
      age: null,
      pickEqual: null,
      pickLine: "",
      tape: marketTape({ kind: "pick" }),
      model: null,
      owner: null,
      note: "",
      photoUrl: "",
      initials: "Pick",
      spread: firstRoundSpread(pick, pickById),
      season: pick.season,
      round: pick.round,
    }));

  const rows = [...players, ...pickRows].sort(byRankValue);
  const positionCounts = Object.create(null);

  return rows.map((row, index) => {
    // A zero price ties with hundreds of others; a rank there means nothing.
    const ranked = Number(row.value) >= 0;
    const positionRank = ranked && row.position
      ? (positionCounts[row.position] = (positionCounts[row.position] || 0) + 1)
      : null;
    return {
      ...row,
      positionRank,
      overallRank: ranked ? index + 1 : null,
      boardRank: positionRank ? `${row.position}${positionRank}` : "",
      listIndex: index,
    };
  });
}

export function filterRankRows(rows, { query = "", position = "ALL" } = {}) {
  const want = foldRankQuery(query);
  const pos = String(position || "ALL").toUpperCase();
  const floor = want ? RANK_SEARCH_FLOOR : (pos === "ALL" ? RANK_LIST_FLOOR : RANK_POSITION_FLOOR);
  return (Array.isArray(rows) ? rows : []).filter((row) => {
    if (pos === "PICK" && row.kind !== "pick") return false;
    if (pos !== "ALL" && pos !== "PICK" && row.position !== pos) return false;
    if (want && !foldRankQuery(row.name).includes(want)) return false;
    if (row.kind === "pick") return true;
    return Number(row.value) >= 0;
  }).map((row, index) => ({ ...row, listRank: index + 1 }));
}

export function sameMoney(rows, assetId, radius = 2) {
  const list = Array.isArray(rows) ? rows : [];
  const index = list.findIndex((row) => row?.assetId === assetId);
  if (index < 0) return [];
  const start = Math.max(0, index - radius);
  const end = Math.min(list.length, index + radius + 1);
  return list.slice(start, end).filter((row) => row.assetId !== assetId);
}

export function rankView({
  rows = [],
  query = "",
  position = "ALL",
  format = "sf",
  leagueFormat = "",
  selectedId = "",
  caveat = "",
  leagueOpen = false,
  loading = false,
  failed = false,
  leagueValueFor = null,
  shown = RANK_PAGE_SIZE,
  history = null,
  updated = null,
} = {}) {
  const visible = filterRankRows(rows, { query, position });
  const pageCount = Math.max(RANK_PAGE_SIZE, Number(shown) || RANK_PAGE_SIZE);
  const selected = rows.find((row) => row.assetId === selectedId) || null;
  let card = null;
  if (selected) {
    const leagueValue = typeof leagueValueFor === "function" ? Number(leagueValueFor(selected)) : NaN;
    card = {
      ...selected,
      neighbors: sameMoney(rows.filter(row => row.kind === "player"), selected.assetId, 3),
      leagueValue: Number.isFinite(leagueValue) && leagueValue > 0 ? Math.round(leagueValue) : null,
    };
  }
  let emptyLabel = "";
  if (!visible.length) {
    emptyLabel = !rows.length
      ? "Player values did not load."
      : (query ? "Nobody by that name." : "Nothing in this filter.");
  }
  return {
    loading: Boolean(loading),
    failed: Boolean(failed),
    query,
    position: RANK_POSITIONS.includes(position) ? position : "ALL",
    format: "sf",
    note: rankBoardNote({ format, leagueFormat, caveat }),
    rows: visible.slice(0, pageCount),
    hidden: Math.max(0, visible.length - pageCount),
    card,
    // A /player/<id> link to a player we have no price for.
    missing: Boolean(selectedId) && !selected && rows.length > 0 && !loading,
    emptyLabel,
    leagueOpen: Boolean(leagueOpen),
    history,
    updated: updated || null,
  };
}

export function renderPlayerConnect() {
  return `<form class="player-connect" data-player-connect>
      <input class="player-connect-user" name="username" aria-label="Sleeper username" placeholder="Sleeper username" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" enterkeyhint="search" />
      <button type="submit">Connect my league</button>
    </form>
    <div class="player-league-list league-picker" data-player-league-list hidden></div>`;
}

export function renderRanksToolbar(view) {
  return `
    <div class="ranks-toolbar" data-ranks-toolbar>
      <input class="ranks-search" type="search" aria-label="Search players and picks" placeholder="Search players and picks" value="${escapeHtml(view?.query || "")}" data-input="ranks-search" data-ranks-query autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" enterkeyhint="search" />
      <div class="ranks-filters" role="group" aria-label="Position">
        ${RANK_POSITIONS.map((pos) => renderRankChip("rank-pos", "pos", pos, pos === "ALL" ? "All" : (pos === "PICK" ? "Picks" : pos), view?.position)).join("")}
      </div>
      <p class="ranks-note muted">${escapeHtml(view?.note || "")}</p>
      ${renderValueScaleExplainer()}
    </div>
  `;
}

export function renderRanksMarkup(view) {
  if (view?.failed) {
    return `<div class="ranks" data-ranks-root><p class="muted" role="status">Couldn't load player values. <button type="button" class="ghost-btn" data-action="retry-values">Try again</button></p></div>`;
  }
  if (view?.loading) {
    return `<div class="ranks" data-ranks-root><p class="muted">Loading player values…</p></div>`;
  }
  return `
    <div class="ranks" data-ranks-root>
      ${renderRanksToolbar(view)}
      <div data-ranks-body>
        ${renderRanksBody(view)}
      </div>
    </div>
  `;
}

export function renderRanksBody(view) {
  if (view?.card) return renderPlayerPage(view.card, view);
  if (view?.missing) return `<article class="player-detail" role="status"><button type="button" class="ghost-btn player-return" data-action="player-rankings-return">Return to player rankings</button><h1>We can't find that player</h1><p>The link may be old, or we have no price for him right now. Dynasty Ticker does not guess one.</p></article>`;
  const rows = Array.isArray(view?.rows) ? view.rows : [];
  const table = rows.length ? `<div class="rankings-table-wrap"><table class="rankings-table"><caption class="sr-only">Player Rankings · 12-team Superflex PPR dynasty</caption><thead><tr><th scope="col" class="rank-face-col"><span class="sr-only">Face</span></th><th scope="col">Player</th><th scope="col"><span class="rank-wide-label">Overall </span>Rank</th><th scope="col"><span class="rank-wide-label">Position </span><span class="rank-narrow-label">Pos. </span>Rank</th><th scope="col">Age</th><th scope="col" class="rank-team-col">Team</th><th scope="col">Value</th></tr></thead><tbody>${rows.map(renderRankTableRow).join("")}</tbody></table></div>` : `<p class="muted ranks-empty">${escapeHtml(view?.emptyLabel || "Nothing in this filter.")}</p>`;
  const more = Number(view?.hidden) > 0 ? `<button type="button" class="ghost-btn ranks-more" data-action="ranks-more">Show more</button>` : "";
  return `${table}${more}<footer class="rankings-footnote"><p>Our algorithm is based around age, role and opportunity, how well a player scores, how often he plays, his NFL team and draft capital, and how long players at his position usually stay good, plus many other factors, updated daily.</p>${renderValueScaleExplainer()}${renderValuesFreshness(view?.updated, { align: "end" })}</footer>`;
}

function renderRankTableRow(row) {
  const pick = row.kind === "pick";
  const action = pick ? "rank-calc" : "rank-open";
  const attrs = `data-action="${action}" data-asset-id="${escapeHtml(row.assetId)}" data-name="${escapeHtml(row.name)}" data-kind="${escapeHtml(row.kind)}"`;
  const face = pick ? `<span class="rank-pick-token" aria-label="Draft pick">P</span>` : renderPlayerFace(row.playerId, row.name, { size: "sm" });
  const owner = row.owner?.mine ? "On your team" : row.owner?.name || "";
  return `<tr><td class="rank-face-col"><button type="button" class="link-btn" ${attrs} aria-label="${escapeHtml(row.name)}">${face}</button></td><th scope="row"><button type="button" class="link-btn rank-name-link" ${attrs}>${escapeHtml(row.name)}</button><small class="rank-position-tag">${escapeHtml(row.position || "")}</small>${owner ? `<small class="rank-owner">${escapeHtml(owner)}</small>` : ""}</th><td>${row.overallRank || "—"}</td><td>${escapeHtml(row.boardRank || "—")}</td><td>${!pick && Number.isFinite(row.age) ? Number(row.age).toFixed(1) : "—"}</td><td class="rank-team-col">${pick ? "—" : escapeHtml(row.team || "FA")}</td><td class="rank-table-value">${escapeHtml(formatNumber(row.value))}</td></tr>`;
}

function renderRanksShelf(rows) {
  const faces = (Array.isArray(rows) ? rows : [])
    .filter((row) => row?.kind === "player" && row.playerId)
    .slice(0, 8);
  if (faces.length < 4) return "";
  return `
    <div class="ranks-shelf" aria-label="Top names">
      ${faces.map((row) => `
        <button type="button" class="ranks-shelf-item" data-action="rank-open" data-asset-id="${escapeHtml(row.assetId)}" aria-label="${escapeHtml(row.name)}">
          ${renderPlayerFace(row.playerId, row.name, { size: "md" })}
          <span class="ranks-shelf-name">${escapeHtml(row.name)}</span>
          <strong>${escapeHtml(formatNumber(row.value))}</strong>
        </button>
      `).join("")}
    </div>
  `;
}

function renderRankChip(action, key, value, label, activeValue) {
  const on = value === activeValue;
  return `<button type="button" class="ranks-chip${on ? " active" : ""}" data-action="${action}" data-${key}="${escapeHtml(value)}" aria-pressed="${on ? "true" : "false"}">${escapeHtml(label)}</button>`;
}

function renderRankName(row) {
  const face = row?.kind === "player" ? renderPlayerFace(row.playerId, row.name, { size: "sm" }) : "";
  const name = escapeHtml(row?.name || "");
  if (!face) return `<strong>${name}</strong>`;
  return `<strong class="player-name">${face}<span class="player-name-text">${name}</span></strong>`;
}

function shownRankNumber(row) {
  if (row?.kind === "player" && Number(row.overallRank) > 0) return row.overallRank;
  return row?.listRank || "";
}

function rankTierTrend(row, view, { soon = false, spark = false } = {}) {
  if (row?.kind !== "player") return "";
  const tier = renderValueTierBadge(row.value);
  const trend = playerValueTrend(view?.history, row.assetId, view?.format || "sf");
  const trendHtml = trend ? renderValueTrend(trend, { spark }) : (soon ? renderTrendSoon() : "");
  return `${tier}${trendHtml}`;
}

function renderRankTrendSoon() {
  return `<span class="value-trend soon"><span aria-hidden="true">—</span><span class="sr-only">No trend yet</span></span>`;
}

function renderRankValue(row, view) {
  const player = row?.kind === "player";
  const trend = player ? playerValueTrend(view?.history, row.assetId, view?.format || "sf") : null;
  const trendHtml = trend ? renderValueTrend(trend) : (player ? renderRankTrendSoon() : "");
  const tier = player ? renderValueTierBadge(row.value) : "";
  return `<span class="ranks-value"><span class="ranks-value-num">${escapeHtml(formatNumber(row.value))}</span>${trendHtml}${tier}</span>`;
}

function renderRankRow(row, active, view) {
  const you = row.owner?.mine ? " you" : "";
  const meta = rankMeta(row);
  const tag = row.kind !== "pick" && row.tape?.line ? `<small class="ranks-tag">${escapeHtml(row.tape.line)}</small>` : "";
  return `
    <button type="button" class="ranks-row${active ? " active" : ""}${you}" data-action="rank-open" data-asset-id="${escapeHtml(row.assetId)}" aria-pressed="${active ? "true" : "false"}">
      <span class="ranks-num">${escapeHtml(String(shownRankNumber(row)))}</span>
      <span class="ranks-who">
        ${renderRankName(row)}
        ${meta ? `<small>${escapeHtml(meta)}</small>` : ""}
        ${tag}
      </span>
      ${renderRankValue(row, view)}
    </button>
  `;
}

function renderRankCard(row, view = {}) {
  const leagueOpen = Boolean(view?.leagueOpen);
  const held = ownerLine(row.owner, { leagueOpen, kind: row.kind });
  const league = Number.isFinite(row.leagueValue)
    ? `Your league: ${formatNumber(row.leagueValue)}.`
    : "";
  const components = row?.model?.components || {};
  const facts = [
    Number(components.recentPpg) > 0
      ? { label: "Recent points per game", value: Number(components.recentPpg).toFixed(1) }
      : null,
    components.availability != null && Number.isFinite(Number(components.availability))
      ? { label: "Games played since last season", value: `${Math.round(Number(components.availability) * 100)}%` }
      : null,
    Number(components.roleOppPerGame) > 0
      // player-values/build.py counts pass attempts + carries for a QB and
      // carries + targets for everyone else. Say which.
      ? { label: row.position === "QB" ? "Pass attempts + carries per game" : "Carries + targets per game", value: Number(components.roleOppPerGame).toFixed(1) }
      : null,
  ].filter(Boolean);
  const spread = Array.isArray(row.spread) && row.spread.length > 1
    ? row.spread.map((item) => `${item.label} ${formatNumber(item.value)}`).join(" · ")
    : "";
  const neighbors = Array.isArray(row.neighbors) ? row.neighbors : [];
  const photoSrc = sleeperAvatarUrl(row.photoUrl);
  const photo = photoSrc
    ? `<img class="rather-photo" src="${escapeHtml(photoSrc)}" alt="" />`
    : "";
  const calc = `<button type="button" data-action="rank-calc" data-asset-id="${escapeHtml(row.assetId)}" data-name="${escapeHtml(row.name)}" data-value="${escapeHtml(String(row.value))}" data-kind="${escapeHtml(row.kind)}">Check a trade with ${escapeHtml(row.kind === "pick" ? "this pick" : row.name)}</button>`;
  const shop = row.kind === "player" && leagueOpen && row.owner
    ? `<button type="button" class="ghost-btn" data-action="player-shop" data-asset-id="${escapeHtml(row.assetId)}">Shop ${escapeHtml(row.name)}</button>`
    : "";
  const role = roleLine(row);
  return `
    <article class="ranks-card">
      <button type="button" class="ghost-btn player-back" data-action="player-back" aria-label="Back"><span aria-hidden="true">←</span> Back</button>
      <div class="ranks-card-main">
        <div class="ranks-headshot" aria-hidden="true">
          <span class="rather-initials">${escapeHtml(row.initials || "?")}</span>
          ${photo}
        </div>
        <div class="ranks-card-copy">
          <p class="eyebrow">${escapeHtml(rankEyebrow(row))}</p>
          <h2>${escapeHtml(row.name)}</h2>
          <p class="ranks-card-meta">${escapeHtml(rankMeta(row))}</p>
          ${role ? `<p class="ranks-card-role">${escapeHtml(role)}</p>` : ""}
          ${row.note ? `<p class="ranks-card-note">${escapeHtml(row.note)}</p>` : ""}
          ${row.pickLine ? `<p class="ranks-pick-line">${escapeHtml(row.pickLine)}</p>` : ""}
          ${spread ? `<p class="ranks-spread">${escapeHtml(spread)}</p>` : ""}
        </div>
        <div class="ranks-card-price">
          <strong>${escapeHtml(formatNumber(row.value))}</strong>
          <span class="ranks-estimate">Our estimate</span>
          ${rankTierTrend(row, view, { soon: true, spark: true })}
        </div>
      </div>
      ${row.tape?.line ? `<p class="ranks-tape ranks-tape-${escapeHtml(row.tape?.tone || "crowd")}">${escapeHtml(row.tape.line)}</p>` : ""}
      ${facts.length ? `<dl class="ranks-facts">${facts.map((fact) => `<div><dt>${escapeHtml(fact.label)}</dt><dd>${escapeHtml(fact.value)}</dd></div>`).join("")}</dl>` : ""}
      ${held || league ? `<p class="ranks-held">${escapeHtml([held, league].filter(Boolean).join(" "))}</p>` : ""}
      ${neighbors.length ? `
        <h3>Similar value</h3>
        <div class="ranks-neighbors">
          ${neighbors.map((neighbor) => renderRankNeighbor(neighbor, view)).join("")}
        </div>
      ` : ""}
      <div class="ranks-card-actions">
        ${calc}
        ${shop}
        <button type="button" class="ghost-btn" data-action="rank-close">Close</button>
      </div>
    </article>
  `;
}

function renderRankNeighbor(row, view) {
  const meta = rankMeta(row);
  return `
    <button type="button" class="ranks-row ranks-neighbor" data-action="rank-open" data-asset-id="${escapeHtml(row.assetId)}">
      <span class="ranks-who">
        ${renderRankName(row)}
        ${meta ? `<small>${escapeHtml(meta)}</small>` : ""}
      </span>
      ${renderRankValue(row, view)}
    </button>
  `;
}

// Role and age context in plain words: position rank and prime years left.
const PRIME_END = Object.freeze({ QB: 33, RB: 27, WR: 29, TE: 30 });
export function roleLine(row) {
  if (row?.kind !== "player") return "";
  const pos = String(row?.position || "").toUpperCase();
  const posRank = Number(row?.positionRank);
  const parts = [];
  if (pos && Number.isFinite(posRank) && posRank > 0) parts.push(posRank === 1 ? `Best ${pos} by value` : `${ordinal(posRank)}-best ${pos} by value`);
  const age = Number(row?.age);
  const end = PRIME_END[pos];
  if (end && Number.isFinite(age) && age > 0) {
    const left = Math.floor(end - age);
    parts.push(left >= 1 ? `about ${left} prime year${left === 1 ? "" : "s"} left at ${pos}` : `past the usual ${pos} prime`);
  }
  if (!parts.length) return "";
  const text = parts.join(", ");
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}.`;
}

function rankMeta(row) {
  if (row?.kind === "pick") return "Pick";
  const age = Number.isFinite(Number(row?.age)) && Number(row.age) > 0 ? `${Math.round(Number(row.age))}y` : "";
  return [row?.boardRank || (row?.kind === "player" ? row?.position : ""), row?.team, age].filter(Boolean).join(" · ");
}

function rankEyebrow(row) {
  if (row?.kind === "pick") return "Pick";
  const overall = Number(row?.overallRank) > 0 ? `${ordinal(row.overallRank)} overall` : "";
  return [row?.boardRank, overall].filter(Boolean).join(" · ");
}

function collectRankPicks(values, minSeason) {
  const floor = Number(minSeason);
  const picks = [];
  for (const [assetId, rawValue] of Object.entries(values || {})) {
    const meta = parsePickAssetId(assetId);
    const value = Number(rawValue);
    if (!meta || !Number.isFinite(value) || value <= 0) continue;
    if (Number.isFinite(floor) && Number(meta.season) < floor) continue;
    if (meta.round < 1 || meta.round > 3) continue;
    if (meta.round > 1 && meta.bucket !== "any") continue;
    picks.push({
      assetId,
      value,
      season: meta.season,
      round: meta.round,
      bucket: meta.bucket,
      phrase: pickPhrase(meta),
    });
  }
  return picks;
}

function closestPick(value, picks) {
  let best = null;
  let bestGap = Infinity;
  let bestTie = Infinity;
  for (const pick of picks) {
    const gap = Math.abs(pick.value - value);
    const tie = PICK_BUCKET_TIE[pick.bucket] ?? 9;
    if (gap < bestGap - 0.5 || (Math.abs(gap - bestGap) <= 0.5 && tie < bestTie)) {
      best = pick;
      bestGap = gap;
      bestTie = tie;
    }
  }
  return best;
}

function firstRoundSpread(pick, pickById) {
  if (pick.round !== 1) return [];
  return ["early", "mid", "late"].map((bucket) => {
    const hit = pickById.get(`pick:${pick.season}:r1:${bucket}`);
    if (!hit) return null;
    const label = bucket.charAt(0).toUpperCase() + bucket.slice(1);
    return { bucket, label, value: Math.round(hit.value) };
  }).filter(Boolean);
}

function pickPhrase(meta) {
  const round = ordinal(meta.round);
  if (meta.round === 1 && meta.bucket === "early") return `${meta.season} early ${round}`;
  if (meta.round === 1 && meta.bucket === "late") return `${meta.season} late ${round}`;
  if (meta.round === 1 && meta.bucket === "mid") return `${meta.season} mid ${round}`;
  return `${meta.season} ${round}`;
}

function playerPosition(raw) {
  return String(raw?.position || raw?.fantasy_positions?.[0] || "").toUpperCase();
}

function playerName(assetId, names, raw) {
  const fromNfl = String(raw?.full_name || `${raw?.first_name || ""} ${raw?.last_name || ""}`).trim();
  return fromNfl || String(names?.[assetId] || "").trim();
}

function byRankValue(a, b) {
  return b.value - a.value || String(a.name).localeCompare(String(b.name));
}
