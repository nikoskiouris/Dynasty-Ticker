import { escapeHtml } from "./html.js";
import { chooseBestLineup } from "./lineup.js";
import { weeklyPlayer, weeklyScoring, weeklyUnavailable } from "./weekly-slate.js";

const NON_STARTERS = new Set(["BN", "BENCH", "IR", "TAXI", "RES", "RESERVE", "PUP", "NA", "INJURED_RESERVE"]);
const unavailable = (message) => `<p class="muted">${escapeHtml(message)}</p>`;
const points = (number) => number.toFixed(1);
const playerId = (value) => value && String(value) !== "0" ? String(value) : null;

function rosterPlayer(id, directory, slate, reserve, owned, pointsKey, now) {
  const bio = directory?.[id];
  const row = weeklyPlayer(slate, id, bio);
  const kickoff = Date.parse(row?.kickoff);
  const locked = Boolean(row?.locked) || kickoff <= now;
  const unowned = !owned.has(id);
  const reason = locked ? "Game has started" : unowned ? "No longer eligible on this roster"
    : reserve.get(id) || weeklyUnavailable(row, now);
  const projection = row?.[pointsKey];
  const name = row?.name || bio?.full_name || [bio?.first_name, bio?.last_name].filter(Boolean).join(" ") || `Player ${id}`;
  const positions = row.positions?.length ? row.positions : bio?.fantasy_positions || [];
  const unknown = !row || row.availability === "unknown" || (!reason && !Number.isFinite(projection))
    || (!Number.isFinite(kickoff) && row.availability !== "bye" && row.availability !== "inactive");
  return {
    id, name, positions: positions.length ? positions : [row?.position || bio?.position].filter(Boolean),
    position: row?.position || bio?.position, opponent: row?.opponent, status: row?.status,
    points: projection, locked, unknown, unowned, kickoffKnown: Number.isFinite(kickoff) || row.availability === "bye",
    reserve: reserve.has(id), reason: reason || (unknown ? "Weekly data unavailable" : null),
  };
}

// A player eligible for several slots can keep their Sleeper slot when the
// same projected lineup fits. Only displace a teammate to seat a new starter.
function seatSelected(open, selected, canFill) {
  const byId = new Map(selected.map(player => [player.id, player]));
  const seated = open.map(({ current, slot }) => byId.has(current?.id) && canFill(current, slot) ? current : null);
  const incumbents = new Set(seated.filter(Boolean).map(player => player.id));
  function place(entrant) {
    // Follow the shortest chain to an empty seat. This avoids asking a manager
    // to swap two RB slots when the new starter can go directly into Flex.
    const queue = [{ player: entrant, from: -1 }];
    const parent = new Map();
    for (const { player, from } of queue) {
      for (let index = 0; index < open.length; index++) {
        if (parent.has(index) || !canFill(player, open[index].slot)) continue;
        parent.set(index, from);
        if (seated[index]) {
          queue.push({ player: seated[index], from: index });
          continue;
        }
        for (let to = index; to >= 0; to = parent.get(to)) {
          const previous = parent.get(to);
          seated[to] = previous < 0 ? entrant : seated[previous];
        }
        return;
      }
    }
  }
  for (const player of selected) {
    if (!incumbents.has(player.id)) place(player);
  }
  return seated;
}

function weekLineup({ league, roster, players, slate, pointsKey, now, canFill }) {
  const slots = (league.roster_positions || []).filter(slot => !NON_STARTERS.has(slot));
  const starters = (roster.starters || []).map(playerId);
  const currentIds = new Set(starters.filter(Boolean));
  if (!slots.length || slots.length !== starters.length || starters.filter(Boolean).length !== currentIds.size || !Array.isArray(roster.players)) return null;

  const reserve = new Map();
  for (const id of roster.reserve || []) reserve.set(String(id), "On injured reserve");
  for (const id of roster.taxi || []) reserve.set(String(id), "On the taxi squad");
  const owned = new Set(roster.players.map(playerId).filter(Boolean));
  // A started game can put an already-traded player in the weekly matchup
  // after they leave the roster. Keep their submitted points in their slot.
  const ids = new Set([...owned, ...currentIds]);
  const pool = [...ids].map(id => rosterPlayer(id, players, slate, reserve, owned, pointsKey, now));
  const byId = new Map(pool.map(player => [player.id, player]));
  const seats = slots.map((slot, index) => {
    const current = byId.get(starters[index]);
    // An unverified kickoff, projection, or eligibility cannot justify benching an incumbent.
    const hold = current && (current.locked || (current.unowned
      ? !current.kickoffKnown
      : current.unknown || !canFill(current, slot)));
    return { slot, current, suggested: hold ? current : null, hold };
  });
  const held = new Set(seats.filter(seat => seat.hold).map(seat => seat.current.id));
  const eligible = pool.filter(player => !held.has(player.id) && !player.reason && !player.locked && Number.isFinite(player.points));
  // Keep submitted starters when projections tie.
  eligible.sort((a, b) => Number(currentIds.has(b.id)) - Number(currentIds.has(a.id)));
  const open = seats.filter(seat => !seat.hold);
  // A legal full lineup comes first, even when a defense projects below zero.
  // This bonus favors every additional filled slot over any difference in score.
  const slotBonus = 1 + eligible.reduce((sum, player) => sum + Math.abs(player.points), 0);
  const plan = chooseBestLineup(open, eligible, canFill, { valueFor: player => slotBonus + player.points });
  if (!plan) return null;
  const selected = plan.picks.filter(index => index !== null).map(index => eligible[index]);
  const assignments = seatSelected(open, selected, canFill);
  open.forEach((seat, index) => { seat.suggested = assignments[index]; });
  return { seats, pool, eligible };
}

function playerDetail(player) {
  if (!player) return "Empty";
  const details = [];
  if (player.reason) details.push(player.reason);
  else {
    details.push(`${points(player.points)} projected`);
    if (player.opponent) details.push(`vs ${player.opponent}`);
    if (player.status) details.push(player.status);
  }
  return `<strong>${escapeHtml(player.name)}</strong><small>${escapeHtml(details.join(" · "))}</small>`;
}

function closestCall(seats, eligible, canFill) {
  const selected = new Set(seats.map(seat => seat.suggested?.id));
  let closest;
  for (const { slot, suggested, hold } of seats) {
    if (!suggested || hold) continue;
    for (const bench of eligible) {
      if (selected.has(bench.id) || !canFill(bench, slot)) continue;
      const gap = suggested.points - bench.points;
      if (gap >= 0 && gap <= 2 && (!closest || gap < closest.gap)) closest = { slot, suggested, bench, gap };
    }
  }
  return closest;
}

export function renderStartSit({ league, roster, players, slate, canFill, slotLabel, now = Date.now() }) {
  if (slate?.offSeason) return unavailable("Weekly recommendations return during the NFL regular season.");
  if (!slate?.week || !slate.season) return unavailable("Weekly projections are unavailable.");
  if (String(league.season) !== String(slate.season)) return unavailable(`Open your ${slate.season} league to see this week’s lineup.`);
  if (["pre_draft", "drafting", "complete"].includes(league.status)) return unavailable("Weekly recommendations are available while this league’s season is active.");
  if (Number(league.settings?.best_ball) === 1) return unavailable("Sleeper selects starters automatically in this best ball league.");
  const { pointsKey, label } = weeklyScoring(league);
  const model = weekLineup({ league, roster, players, slate, pointsKey, canFill, now });
  if (!model) return unavailable("A weekly lineup could not be matched to this roster’s starting slots.");
  const { pool, seats, eligible } = model;
  const stamp = new Date(slate.fetchedAt);
  const checked = Number.isFinite(stamp.getTime()) ? ` · Checked ${stamp.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : "";
  const source = `<p class="muted small">Week ${escapeHtml(slate.week)} · ${escapeHtml(label)} · Sleeper projections${escapeHtml(checked)}</p>`;
  const submitted = new Set(seats.map(seat => seat.current?.id));
  const projected = new Set(seats.map(seat => seat.suggested?.id));
  const changes = seats.filter(seat => seat.suggested && seat.suggested.id !== seat.current?.id);
  const review = seats.filter(seat => !seat.suggested || (seat.hold && !seat.current.locked));
  const unknownBench = pool.filter(player => player.unknown && !submitted.has(player.id) && !player.locked && !player.reserve);
  const bench = pool.filter(player => !projected.has(player.id));
  const close = closestCall(seats, eligible, canFill);
  const calls = changes.map(({ slot, current, suggested }) => {
    const action = submitted.has(suggested.id)
      ? `Move ${suggested.name} to ${slotLabel(slot)}`
      : `Start ${suggested.name} at ${slotLabel(slot)}`;
    const sit = current && !projected.has(current.id) ? `Sit ${current.name}` : "";
    const edge = current && !current.reason ? suggested.points - current.points : 0;
    const advantage = sit && edge > 0 ? ` · +${points(edge)} projected points` : "";
    const why = sit && current.reason ? ` · ${current.reason}` : advantage;
    return `<li><strong>${escapeHtml(action)}</strong><small>${escapeHtml([`${points(suggested.points)} projected`, suggested.opponent ? `vs ${suggested.opponent}` : "", suggested.status].filter(Boolean).join(" · "))}</small>${sit ? `<small>${escapeHtml(sit + why)}</small>` : ""}</li>`;
  }).join("");
  const allLocked = seats.every(seat => seat.current?.locked);
  const status = allLocked ? "All your starting slots are locked."
    : !eligible.length ? "No projected players are available for an unlocked change."
    : review.length || unknownBench.length ? "No suggested swap among the players compared."
    : "Keep your current starters.";
  const result = calls ? `<ul class="start-sit-calls">${calls}</ul>` : `<p><strong>${escapeHtml(status)}</strong></p>`;
  const closeText = close ? `<p><strong>Close call at ${escapeHtml(slotLabel(close.slot))}</strong> · ${escapeHtml(close.suggested.name)} ${points(close.suggested.points)} vs ${escapeHtml(close.bench.name)} ${points(close.bench.points)} projected.</p>` : "";
  const needsReview = review.map(({ current, slot }) => {
    if (!current || projected.has(current.id) && !current.reason) return slotLabel(slot);
    return `${current.name} (${current.reason || "slot eligibility unverified"})`;
  });
  const reviewText = needsReview.length ? `<p>Review in Sleeper · ${escapeHtml(needsReview.join(", "))}</p>` : "";
  const missing = unknownBench.length ? `<p class="muted small">Weekly data is incomplete for ${unknownBench.length} bench ${unknownBench.length === 1 ? "player" : "players"}.</p>` : "";
  const lineup = seats.map(({ slot, current, suggested }) => {
    const note = !suggested ? "Review slot" : current?.id === suggested.id ? "In your lineup" : "Suggested";
    const detail = suggested ? playerDetail(suggested) : "No projected starter";
    return `<li><span>${escapeHtml(slotLabel(slot))}</span><div>${detail}</div><small>${note}</small></li>`;
  }).join("");
  const benchRows = bench.sort((a, b) => (b.reason ? -Infinity : b.points) - (a.reason ? -Infinity : a.points) || a.name.localeCompare(b.name))
    .map(player => `<li>${playerDetail(player)}</li>`).join("");
  return `${source}${result}${closeText}${reviewText}${missing}
    <details><summary>View weekly lineup</summary><ul class="start-sit-lineup">${lineup}</ul>
    ${benchRows ? `<h3>Bench and unavailable players</h3><ul class="start-sit-calls">${benchRows}</ul>` : ""}
    <p class="muted small">Make lineup changes in Sleeper. These projections exclude custom scoring rules and bonuses.</p></details>`;
}
