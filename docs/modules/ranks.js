import { playerAliasName } from "./player-aliases.js";
import { renderPlayerPage } from "./player-page.js";
import { escapeHtml, formatNumber } from "./html.js";
import {
  playerValueTrend,
  renderTrendSoon,
  renderValueTierBadge,
  tierForValue,
  renderValueTrend,
} from "./value-scale.js";
import { sleeperAvatarUrl } from "./sleeper.js";
import { renderPlayerFace } from "./player-face.js";
import { ordinal } from "./standings.js";
import { isInactivePlayerAsset, parsePickAssetId, upcomingDraftSeason } from "./values.js";
import { playerInitials, sleeperPlayerThumbUrl } from "./player-face.js";
import { playerAgeFromNfl } from "./player-notes.js";

export const RANK_PAGE_SIZE = 10;
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
  const scale = "Players and picks share a 0–100 scale. A 95 matches the historical benchmark for a top-three startup pick.";
  return caveat ? `${caveat} ${scale}` : scale;
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
    // Keep every published player available through a direct link or search.
    if (!Number.isFinite(value) || value < 0) continue;
    const playerId = assetId.slice("player:".length);
    const raw = nflPlayers?.[playerId] || nflPlayers?.[String(playerId)] || null;
    const model = modelPlayers?.[assetId] || null;
    if (!model && raw && isInactivePlayerAsset({ assetType: "player", raw })) continue;
    // A published WR can also play DB, and a priced free agent can lack a team.
    // Directory enrichment must not change his board position or remove him.
    const position = String(model?.position || playerPosition(raw)).toUpperCase();
    if (position && !SKILL_POSITIONS.has(position)) continue;
    const name = playerName(assetId, names, raw);
    if (!name) continue;
    // The values file carries a decimal age (24.6); Sleeper's directory a whole
    // number. Prefer the values file so the table reads the same with or
    // without a league loaded.
    const modelAge = Number(model?.age);
    const age = Number.isFinite(modelAge) && modelAge > 0 ? modelAge : playerAgeFromNfl(raw);
    const team = String(raw?.team || model?.team || "").trim().toUpperCase();
    const pickEqual = closestPick(value, picks);
    players.push({
      assetId,
      playerId,
      kind: "player",
      name,
      value,
      position,
      team: team && team !== "FA" ? team : "",
      age: Number.isFinite(age) ? age : null,
      pickEqual,
      pickLine: pickEqualLine(value, pickEqual, bestPick),
      model,
      tier: tierForValue(value, values),
      raw,
      ...(typeof detailFor === "function" ? detailFor(playerId, raw) : {}),
      owner: owners?.[assetId] || null,
      // Sleeper's game status ("IR", "Out", "Questionable") for the player page.
      injuryStatus: String(raw?.injury_status || "").trim(),
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
      value: pick.value,
      position: "PICK",
      team: "",
      age: null,
      pickEqual: null,
      pickLine: "",
      model: null,
      owner: null,
      note: "",
      photoUrl: "",
      initials: "Pick",
      spread: pickRoundSpread(pick, pickById),
      season: pick.season,
      round: pick.round,
    }));

  const rows = [...players, ...pickRows].sort(byRankValue);
  const positionCounts = Object.create(null);

  return rows.map((row, index) => {
    // A zero price ties with hundreds of others; a rank there means nothing.
    const ranked = Number(row.value) > 0;
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

// People type picks the way they say them: "2027 first", "1st round pick".
// Pick rows are named "2027 1st", so map ordinals and drop filler words.
const ORDINAL_WORDS = { first: "1st", second: "2nd", third: "3rd", fourth: "4th", fifth: "5th" };
export function pickQueryWords(value) {
  const text = String(value || "").toLowerCase()
    .replace(/\b(first|second|third|fourth|fifth)\b/g, (word) => ORDINAL_WORDS[word])
    .replace(/\b(?:round|rd)\s*([1-5])\b/g, (_, round) => ordinal(Number(round)))
    .replace(/[\u2018\u2019']\s*(\d\d)\b/g, "20$1"); // '27 -> 2027
  const round = text.match(/\b[1-5](?:st|nd|rd|th)\b/)?.[0];
  if (!round) return text;
  const year = text.match(/\b20\d\d\b/)?.[0];
  const bucket = text.match(/\b(early|mid|late)\b/)?.[0];
  // Keep an explicit slot qualifier: "late first in 2027" is priced
  // differently from an unspecified 2027 first.
  const remainder = text.replace(round, "").replace(year || "", "").replace(bucket || "", "")
    .replace(/\b(rounds?|rounders?|rd|picks?|draft|in|the)\b/g, "");
  return foldRankQuery(remainder) ? text : [year, bucket, round].filter(Boolean).join(" ");
}

export function filterRankRows(rows, { query = "", position = "ALL" } = {}) {
  const want = foldRankQuery(pickQueryWords(query));
  const pos = String(position || "ALL").toUpperCase();
  // "jsn" also finds Jaxon Smith-Njigba, and still finds any name containing "jsn".
  const alias = foldRankQuery(playerAliasName(query));
  const list = Array.isArray(rows) ? rows : [];
  // "DET", "kc", "FA": a query that is exactly an NFL team code (or FA, no
  // team) also lists that team's players, beside any name that matches.
  const code = String(query || "").trim().toUpperCase();
  const teamCode = /^[A-Z]{2,3}$/.test(code)
    && (code === "FA" || list.some((row) => row.kind !== "pick" && String(row.team || "").toUpperCase() === code)) ? code : "";
  const onTeam = (row) => teamCode && row.kind !== "pick"
    && (teamCode === "FA" ? !row.team || String(row.team).toUpperCase() === "FA" : String(row.team || "").toUpperCase() === teamCode);
  // Bucket prices are scenarios for a round. Only include one when the
  // manager asks for that slot so it never changes the overall board ranks.
  const bucket = String(query).toLowerCase().match(/\b(early|mid|late)\b/)?.[0];
  const candidates = bucket ? list.flatMap(row => {
    if (row.kind !== "pick") return [row];
    const slot = row.spread?.find(item => item.bucket === bucket);
    return slot ? [{ ...row, ...slot, overallRank: null, boardRank: "" }] : [];
  }).sort(byRankValue) : list;
  return candidates.filter((row) => {
    if (pos === "PICK" && row.kind !== "pick") return false;
    if (pos !== "ALL" && pos !== "PICK" && row.position !== pos) return false;
    if (want && !onTeam(row) && !foldRankQuery(row.name).includes(want) && !(alias && row.kind !== "pick" && foldRankQuery(row.name).includes(alias))) return false;
    if (row.kind === "pick") return true;
    return Number(row.value) > 0 || Boolean(want);
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

// A sortable column header: a button inside the th, aria-sort on the th.
function sortHeader(key, label, view = {}, cls = "") {
  const sort = view?.sort || "rank";
  const active = key === "age" ? sort.startsWith("age") : sort === key;
  const next = key === "age" ? (sort === "age-asc" ? "age-desc" : "age-asc") : key;
  const ariaSort = !active ? "none" : sort === "age-desc" ? "descending" : sort === "rank" ? "descending" : "ascending";
  const arrow = active ? (sort === "age-desc" || sort === "rank" ? " ↓" : " ↑") : "";
  const hint = key === "age" ? (next === "age-asc" ? "youngest first" : "oldest first") : key === "team" ? "A to Z" : "highest value first";
  return `<th scope="col"${cls ? ` class="${cls}"` : ""} aria-sort="${ariaSort}"><button type="button" class="rank-sort-btn" data-action="rank-sort" data-sort="${next}" aria-label="Sort by ${escapeHtml(label.replace(/<[^>]+>/g, ""))}, ${hint}">${label}<span class="rank-sort-arrow" aria-hidden="true">${arrow}</span></button></th>`;
}

function nextFirstRow(rows) {
  const firsts = rows.filter((row) => /^pick:\d{4}:r1:any$/.test(String(row.assetId)) && Number(row.value) > 0);
  firsts.sort((a, b) => Number(String(a.assetId).split(":")[1]) - Number(String(b.assetId).split(":")[1]));
  return firsts[0] ? { name: firsts[0].name, value: Number(firsts[0].value) } : null;
}

export function rankView({
  rows = [],
  query = "",
  position = "ALL",
  format = "sf",
  leagueFormat = "",
  selectedId = "",
  priceModel = null,
  caveat = "",
  leagueOpen = false,
  loading = false,
  failed = false,
  leagueValueFor = null,
  shown = RANK_PAGE_SIZE,
  history = null,
  updated = null,
  sort = "rank",
} = {}) {
  const sortKey = RANK_SORTS.includes(sort) ? sort : "rank";
  const filtered = filterRankRows(rows, { query, position });
  // Keep cross-asset search available from the default Players tab.
  const matches = position === "ALL" && !query.trim() ? filtered.filter(row => row.kind === "player") : filtered;
  const visible = sortRankRows(matches, sortKey);
  const requestedStart = Math.max(0, (Number(shown) || RANK_PAGE_SIZE) - RANK_PAGE_SIZE);
  const lastStart = Math.max(0, Math.floor((visible.length - 1) / RANK_PAGE_SIZE) * RANK_PAGE_SIZE);
  const start = Math.min(requestedStart, lastStart);
  const selected = rows.find((row) => row.assetId === selectedId) || null;
  let card = null;
  if (selected) {
    const leagueValue = typeof leagueValueFor === "function" ? Number(leagueValueFor(selected)) : NaN;
    card = {
      ...selected,
      neighbors: sameMoney(rows.filter(row => row.kind === "player"), selected.assetId, 3),
      leagueValue: Number.isFinite(leagueValue) && leagueValue > 0 ? leagueValue : null,
      // The next draft's 1st, the yardstick dynasty managers price players in.
      pickRef: selected.kind === "player" ? nextFirstRow(rows) : null,
    };
  }
  let emptyLabel = "";
  if (!visible.length) {
    emptyLabel = !rows.length
      ? "Player values did not load."
      : (query ? "No matching players or picks." : "Nothing in this filter.");
  }
  return {
    loading: Boolean(loading),
    failed: Boolean(failed),
    query,
    position: RANK_POSITIONS.includes(position) ? position : "ALL",
    format: "sf",
    note: rankBoardNote({ format, leagueFormat, caveat }),
    rows: visible.slice(start, start + RANK_PAGE_SIZE),
    total: visible.length,
    start,
    priceModel,
    hidden: Math.max(0, visible.length - start - RANK_PAGE_SIZE),
    card,
    // A /player/<id> link to a player we have no price for.
    missing: Boolean(selectedId) && !selected && rows.length > 0 && !loading,
    emptyLabel,
    leagueOpen: Boolean(leagueOpen),
    history,
    updated: updated || null,
    sort: sortKey,
  };
}

// Rank (value) is the default order. Age and Team re-sort the filtered list;
// picks have neither, so they go last. Ties keep value order.
export const RANK_SORTS = Object.freeze(["rank", "age-asc", "age-desc", "team"]);
export function sortRankRows(rows, sort = "rank") {
  const list = Array.isArray(rows) ? rows : [];
  if (sort === "rank") return list;
  const age = (row) => (row.kind !== "pick" && Number.isFinite(Number(row.age)) && Number(row.age) > 0 ? Number(row.age) : null);
  const team = (row) => (row.kind === "pick" ? null : String(row.team || "FA"));
  const keyed = list.map((row, index) => ({ row, index }));
  keyed.sort((a, b) => {
    const x = sort === "team" ? team(a.row) : age(a.row);
    const y = sort === "team" ? team(b.row) : age(b.row);
    if (x == null || y == null) return (x == null) - (y == null) || a.index - b.index;
    const diff = sort === "team" ? String(x).localeCompare(String(y)) : sort === "age-desc" ? y - x : x - y;
    return diff || a.index - b.index;
  });
  return keyed.map(({ row }) => row);
}

export function renderPlayerConnect() {
  return `<details class="player-ownership"><summary>League ownership</summary>
    <form class="player-connect" data-player-connect>
      <input class="player-connect-user" name="username" aria-label="Sleeper username" placeholder="Sleeper username" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" enterkeyhint="search" />
      <button type="submit">Connect my league</button>
    </form>
    <div class="player-league-list league-picker" data-player-league-list hidden></div></details>`;
}

// What a screen reader hears after a search or a position chip: the list
// changed under it, and only the count says how.
const RANK_POSITION_WORDS = { QB: "quarterbacks", RB: "running backs", WR: "wide receivers", TE: "tight ends", PICK: "picks" };
export function rankCountMessage(view) {
  if (!view || view.loading || view.failed) return "";
  const total = view.total;
  if (!total) return String(view.emptyLabel || "No results.");
  const where = view.position && view.position !== "ALL" ? ` among ${RANK_POSITION_WORDS[view.position] || view.position}` : "";
  const query = String(view.query || "").trim();
  return `${total} ${total === 1 ? "result" : "results"}${query ? ` for “${query}”` : ""}${where}.`;
}

export function renderRanksToolbar(view) {
  return `
    <div class="ranks-toolbar" data-ranks-toolbar>
      <div class="rank-tools">
        <div class="rank-asset-tabs" role="group" aria-label="Asset type">
          <button type="button" data-action="rank-pos" data-pos="ALL" data-player-tab aria-pressed="${view.position !== "PICK"}">Players</button>
          <button type="button" data-action="rank-pos" data-pos="PICK" aria-pressed="${view.position === "PICK"}">Draft picks</button>
        </div>
        <label class="rank-search-label">
          <span aria-hidden="true" class="rank-glass"></span>
          <input class="ranks-search" type="search" aria-label="Search players, picks or an NFL team" placeholder="${view.position === "PICK" ? "Search draft picks" : "Search players"}" value="${escapeHtml(view?.query || "")}" data-input="ranks-search" data-ranks-query autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" enterkeyhint="search" />
        </label>
      </div>
      <details class="rank-options">
        <summary>${view.position === "PICK" ? "Value scale" : "Filters &amp; sort"}</summary>
        <div class="rank-options-inner">
          <div class="ranks-filters" role="group" aria-label="Player position" ${view.position === "PICK" ? "hidden" : ""}>
            ${RANK_POSITIONS.filter(pos => pos !== "PICK").map(pos => renderRankChip("rank-pos", "pos", pos, pos === "ALL" ? "All positions" : pos, view?.position)).join("")}
          </div>
          <label class="rank-sort-label"${view.position === "PICK" ? " hidden" : ""}>Sort by <select data-change="ranks-sort">${[["rank", "Value"], ["age-asc", "Age · youngest first"], ["age-desc", "Age · oldest first"], ["team", "Team · A to Z"]].map(([key, label]) => `<option value="${key}"${view.sort === key ? " selected" : ""}>${label}</option>`).join("")}</select></label>
          <p class="ranks-note muted">${escapeHtml(view?.note || "")}</p>
        </div>
      </details>
      <p class="sr-only" role="status" data-ranks-count></p>
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
  if (view?.missing) return `<article class="player-detail" role="status"><button type="button" class="ghost-btn player-return" data-action="player-rankings-return">Rankings</button><h1>Player unavailable</h1><p>Check the link or search the rankings.</p></article>`;
  const rows = Array.isArray(view?.rows) ? view.rows : [];
  const isPicks = view.position === "PICK" || (rows.length > 0 && rows.every(row => row.kind === "pick"));
  const table = rows.length ? `<div class="rankings-table-wrap"><table class="rankings-table">
    <caption class="sr-only">Dynasty values on a scale of 0 to 100</caption>
    <colgroup><col class="col-rank"><col class="col-name"><col class="col-position"><col class="col-team"><col class="col-value"></colgroup>
    <thead><tr><th scope="col">Rank</th><th scope="col">${isPicks ? "Draft pick" : rows.some(row => row.kind === "pick") ? "Asset" : "Player"}</th>
      <th scope="col">${isPicks ? "Rd." : "Pos."}</th>
      ${isPicks ? '<th scope="col">Year</th>' : sortHeader("team", "Team", view)}
      ${sortHeader("rank", "Value / 100", view)}</tr></thead>
    <tbody>${rows.map(row => renderRankTableRow(row, isPicks)).join("")}</tbody>
  </table></div>` : `<p class="ranks-empty" role="status">${escapeHtml(view?.emptyLabel || "Nothing in this filter.")}</p>`;
  if (!rows.length) return table;
  const noun = view.query.trim() ? "result" : isPicks ? "draft pick" : "player";
  const count = view.total === 1 ? `1 ${noun}` : `${view.start + 1}–${view.start + rows.length} of ${view.total} ${noun}s`;
  return `${table}<nav class="rank-pager" aria-label="Rankings pages">
    <span role="status">${count}</span>
    <div><button type="button" data-action="ranks-page" data-shown="${view.start}"${view.start === 0 ? " disabled" : ""}>Previous</button>
    <button type="button" data-action="ranks-page" data-shown="${view.start + 2 * RANK_PAGE_SIZE}"${view.hidden ? "" : " disabled"}>Next <span aria-hidden="true">→</span></button></div>
  </nav>`;
}

function renderRankTableRow(row, isPicks) {
  const pick = row.kind === "pick";
  const label = pick ? `Add ${row.name} to a trade` : row.name;
  const owner = row.owner?.mine ? "On your team" : row.owner?.name || "";
  const more = [row.boardRank, !pick && Number.isFinite(row.age) ? `Age ${Number(row.age).toFixed(1)}` : ""].filter(Boolean).join(" · ");
  const name = `<button type="button" class="link-btn rank-name-link" data-action="${pick ? "rank-calc" : "rank-open"}" data-asset-id="${escapeHtml(row.assetId)}" data-name="${escapeHtml(row.name)}" data-kind="${escapeHtml(row.kind)}" aria-label="${escapeHtml(label)}">
      ${pick ? "" : renderPlayerFace(row.playerId, row.name, { size: "sm" })}
      <span>${escapeHtml(row.name)}${pick ? ' <small class="rank-add-hint" aria-hidden="true">+ Trade</small>' : ""}${owner ? `<small class="rank-owner">${escapeHtml(owner)}</small>` : ""}${more ? `<small class="rank-more-info">${escapeHtml(more)}</small>` : ""}</span>
    </button>`;
  return `<tr><td>${row.overallRank || "—"}</td><th scope="row">${name}</th>
    <td>${escapeHtml(isPicks ? row.round : row.position || "—")}</td>
    <td>${escapeHtml(isPicks ? row.season : pick ? "—" : row.team || "FA")}</td>
    <td class="rank-table-value">${row.value > 0 ? escapeHtml(formatNumber(row.value)) : '<span aria-label="Value unavailable">—</span>'}</td>
  </tr>`;
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
  const tier = renderValueTierBadge(row.tier);
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
  const tier = player ? renderValueTierBadge(row.tier) : "";
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
    if (meta.round < 1) continue;
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
    if (gap < bestGap - 0.005 || (Math.abs(gap - bestGap) <= 0.005 && tie < bestTie)) {
      best = pick;
      bestGap = gap;
      bestTie = tie;
    }
  }
  return best;
}

function pickRoundSpread(pick, pickById) {
  return ["early", "mid", "late"].map((bucket) => {
    const hit = pickById.get(`pick:${pick.season}:r${pick.round}:${bucket}`);
    if (!hit) return null;
    const label = bucket.charAt(0).toUpperCase() + bucket.slice(1);
    return { bucket, label, value: hit.value, assetId: hit.assetId, name: hit.phrase };
  }).filter(Boolean);
}

function pickPhrase(meta) {
  const round = ordinal(meta.round);
  return meta.bucket === "any" ? `${meta.season} ${round}` : `${meta.season} ${meta.bucket} ${round}`;
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
