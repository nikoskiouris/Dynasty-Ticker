import { countLabel, escapeHtml } from "./html.js";
import { renderPlayerFace } from "./player-face.js";

const pointFormat = new Intl.NumberFormat(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 });
const points = n => pointFormat.format(n);
const timeOfGame = new Intl.DateTimeFormat(undefined, {
  weekday: "short", hour: "numeric", minute: "2-digit", timeZoneName: "short",
});
const checkedTime = new Intl.DateTimeFormat(undefined, {
  month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
});

function playerCard(player, role, showWorkload = false) {
  if (!player) return `<div class="ss-player"><div class="ss-player-info"><small class="ss-player-role">${escapeHtml(role)}</small><strong>Empty slot</strong></div></div>`;
  const kickoff = Date.parse(player.kickoff);
  const game = [player.position, player.team, player.opponent ? `${player.away ? "at" : "vs"} ${player.opponent}` : ""].filter(Boolean).join(" · ");
  const condition = player.reason || [player.status, Number.isFinite(kickoff) ? timeOfGame.format(kickoff) : ""].filter(Boolean).join(" · ");
  const score = Number.isFinite(player.points) && (!player.reason || player.locked)
    ? `<span class="ss-points">${points(player.points)}<small>proj.</small></span>` : "";
  return `<div class="ss-player">${renderPlayerFace(player.id, player.name, { size: "sm" })}
    <div class="ss-player-info">${role ? `<small class="ss-player-role">${escapeHtml(role)}</small>` : ""}
      <strong>${escapeHtml(player.name)}</strong>
      <small class="ss-player-meta">${escapeHtml(game)}</small>
      ${condition ? `<small class="ss-player-meta">${escapeHtml(condition)}</small>` : ""}
      ${showWorkload && player.workload.length ? `<small class="ss-player-meta">Projected volume · ${escapeHtml(player.workload.join(", "))}</small>` : ""}</div>${score}</div>`;
}

function compareButton(seats, seat, label, benchId) {
  const index = seats.indexOf(seat);
  const id = `ss-compare-${index}-${label.replaceAll(" ", "-").toLowerCase()}`;
  return `<button id="${id}" class="ss-link" type="button" data-ss-compare="${index}" data-bench-id="${escapeHtml(benchId || "")}">${label}</button>`;
}

function summary(model) {
  const { seats, changes, review, unknownBench, projectedGain } = model;
  const locked = seats.filter(seat => seat.current?.locked).length;
  const tone = changes.length ? "move" : locked === seats.length ? "locked" : review.length || unknownBench.length ? "review" : "keep";
  const title = {
    move: `Update ${countLabel(changes.length, "starting slot")}`,
    keep: "Keep your starters",
    locked: "Your starters are locked",
    review: "Your lineup needs a closer look",
  }[tone];
  let detail;
  if (tone === "move") detail = "Suggested changes to your submitted Sleeper lineup.";
  if (tone === "keep") detail = "Your submitted starters already match the highest projected lineup available.";
  if (tone === "locked") detail = "Every submitted starter’s game has started.";
  if (tone === "review") detail = "Check the flagged slots and players before setting your lineup.";
  const showGain = changes.length && Number.isFinite(projectedGain) && projectedGain !== 0;
  return `<div class="ss-summary" data-tone="${tone}"><div><h3>${escapeHtml(title)}</h3><p>${detail}</p></div>
    ${showGain ? `<div class="ss-gain"><strong>${projectedGain > 0 ? "+" : ""}${points(projectedGain)}</strong><small>projected points</small></div>` : ""}</div>`;
}

function renderDecisions(model, slotLabel) {
  const { seats, changes, closeCalls, review, unknownBench } = model;
  const calls = changes.map(seat => {
    const { current, suggested, slot } = seat;
    const from = seats.find(other => other.current?.id === suggested.id);
    const to = current && seats.find(other => other.suggested?.id === current.id);
    const inRole = from ? `Move from ${slotLabel(from.slot)}` : "Start";
    const outRole = to ? `Move to ${slotLabel(to.slot)}` : current ? "Sit" : "Submitted";
    let why;
    if (!current) why = "Fill the open starting slot.";
    else if (to || from) why = "Make the listed moves together to keep every player in an eligible slot.";
    else if (current.reason) why = `${current.name} · ${current.reason}`;
    else {
      const diff = suggested.points - current.points;
      why = diff > 0 ? `${suggested.name} projects ${points(diff)} points higher.` : "This change is part of the highest projected lineup.";
    }
    return `<li class="ss-call"><div class="ss-call-head"><span class="ss-slot">${escapeHtml(slotLabel(slot))}</span><strong>${from ? "Move starter" : current ? "Change starter" : "Fill slot"}</strong></div>
      <div class="ss-duel">${playerCard(suggested, inRole)}${playerCard(current, outRole)}</div>
      <p class="ss-note">${escapeHtml(why)}</p>
      ${seat.alternatives.length ? compareButton(seats, seat, "Compare alternatives", current?.id) : ""}</li>`;
  }).join("");
  const closest = closeCalls[0];
  const close = closest ? `<div class="ss-close"><strong>Close call · ${escapeHtml(slotLabel(closest.seat.slot))}</strong>
    <p>${escapeHtml(closest.seat.suggested.name)} and ${escapeHtml(closest.bench.name)} ${closest.gap === 0 ? "are tied on projected points" : `are ${points(closest.gap)} projected points apart`}.</p>
    ${compareButton(seats, closest.seat, "Compare these players", closest.bench.id)}</div>` : "";
  const warnings = review.map(seat => {
    const player = seat.current;
    const detail = !player ? "Empty slot" : player.reason ? `${player.name} · ${player.reason}` : player.name;
    return `<li>${escapeHtml(slotLabel(seat.slot))} · ${escapeHtml(detail)}${!seat.suggested ? " · No eligible replacement projected" : ""}</li>`;
  }).join("");
  const missing = unknownBench.length ? `Weekly data is incomplete for ${countLabel(unknownBench.length, "bench player")}. See Full lineup for their names.` : "";
  const injuryWatch = seats.filter(seat => !seat.hold && seat.suggested?.status?.toLowerCase() === "questionable").map(seat => {
    const player = seat.suggested;
    const backup = seat.alternatives[0];
    const fallback = backup ? ` ${backup.name} is the highest projected alternative${Date.parse(backup.kickoff) < Date.parse(player.kickoff) ? " and plays earlier" : ""}.` : "";
    return `<li>${escapeHtml(player.name)} is questionable.${escapeHtml(fallback)} ${backup ? compareButton(seats, seat, "Compare backup", backup.id) : ""}</li>`;
  }).join("");
  const alert = warnings || missing || injuryWatch ? `<div class="ss-alert"><strong>Check before kickoff</strong>${warnings || injuryWatch ? `<ul>${warnings}${injuryWatch}</ul>` : ""}${missing ? `<p>${escapeHtml(missing)}</p>` : ""}</div>` : "";
  return `${calls ? `<ol class="ss-calls">${calls}</ol>` : ""}${alert}${close}`;
}

function comparison(model, view, slotLabel) {
  const { seats } = model;
  const comparable = seats.filter(seat => seat.suggested && !seat.hold && seat.alternatives.length);
  if (!comparable.length) return '<p class="ss-empty">There are no unlocked starters with an eligible, projected bench alternative this week.</p>';
  const seat = comparable.includes(seats[view.seat]) ? seats[view.seat] : model.closeCalls[0]?.seat || comparable[0];
  const bench = seat.alternatives.find(player => player.id === view.benchId) || seat.alternatives[0];
  const pick = seat.suggested;
  const gap = Math.round((pick.points - bench.points) * 100) / 100;
  const slotOptions = comparable.map(other => `<option value="${seats.indexOf(other)}"${other === seat ? " selected" : ""}>${escapeHtml(slotLabel(other.slot))} · ${escapeHtml(other.suggested.name)}</option>`).join("");
  const benchOptions = seat.alternatives.map(player => `<option value="${escapeHtml(player.id)}"${player === bench ? " selected" : ""}>${escapeHtml(player.name)} · ${points(player.points)} pts</option>`).join("");
  const verdict = gap === 0 ? "Tied on projected points."
    : `${pick.name} projects ${points(gap)} points higher at ${slotLabel(seat.slot)}.`;
  return `<div class="ss-selectors"><label class="ss-field">Starting slot<select id="ss-seat" data-ss-seat>${slotOptions}</select></label>
      <label class="ss-field">Compare against<select id="ss-alternative" data-ss-bench>${benchOptions}</select></label></div>
    <div class="ss-comparison"><div class="ss-duel">${playerCard(pick, "Suggested starter", true)}${playerCard(bench, "Alternative", true)}</div>
      <p class="ss-note" role="status">${escapeHtml(verdict)}${gap > 0 && gap <= 2 ? " This is a close call." : ""}</p></div>`;
}

function lineup(model, slotLabel) {
  const rows = model.seats.map(seat => {
    const player = seat.suggested;
    const state = player?.locked ? "Locked" : seat.hold || !seat.suggested ? "Review" : player.id === seat.current?.id ? "Keep" : "Suggested";
    return `<li><span class="ss-slot">${escapeHtml(slotLabel(seat.slot))}</span>${playerCard(player, "")}<small class="ss-tag">${state}</small></li>`;
  }).join("");
  const bench = model.bench.map(player => `<li>${playerCard(player, "")}</li>`).join("");
  return `<h4>Suggested starters</h4><ul class="ss-lineup">${rows}</ul>
    ${bench ? `<details class="ss-bench"><summary id="ss-bench-toggle">Bench and unavailable players (${model.bench.length})</summary><ul>${bench}</ul></details>` : ""}`;
}

export function renderStartSit({ model, view, slate, league, slotLabel }) {
  if (model.message) return `<p class="ss-empty" role="status">${escapeHtml(model.message)}</p>`;
  const stamp = Date.parse(slate.fetchedAt);
  const checked = Number.isFinite(stamp) ? `<span>Checked ${escapeHtml(checkedTime.format(stamp))}</span>` : "";
  const tabs = [["decisions", "Decisions"], ["compare", "Compare players"], ["lineup", "Full lineup"]];
  const content = view.tab === "compare" ? comparison(model, view, slotLabel)
    : view.tab === "lineup" ? lineup(model, slotLabel) : renderDecisions(model, slotLabel);
  const nav = tabs.map(([key, label]) => `<button type="button" id="ss-tab-${key}" data-ss-tab="${key}" aria-controls="ss-view" aria-pressed="${key === view.tab}">${label}</button>`).join("");
  return `<div class="ss-board"><div class="ss-context"><strong>Week ${escapeHtml(slate.week)}</strong>
      <span>${escapeHtml(model.scoring.label)}</span>${checked}</div>
    ${summary(model)}
    <div class="ss-nav" role="group" aria-label="Weekly lineup views">${nav}</div>
    <div class="ss-body" id="ss-view">${content}</div>
    <div class="ss-footer"><p>Sleeper projections · ESPN game schedule. ${escapeHtml(model.scoring.note || "")}</p>
      <a id="ss-open-sleeper" href="https://sleeper.com/leagues/${encodeURIComponent(league.league_id)}" target="_blank" rel="noopener noreferrer">Open league in Sleeper ↗</a></div></div>`;
}
