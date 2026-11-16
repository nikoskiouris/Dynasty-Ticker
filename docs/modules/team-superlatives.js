// My Team superlatives (ticket 037). Pure: matchups, values and the price
// history in, a short list of cards out. A card with no data is left out,
// never shown as zero.
import { formatNumber } from "./html.js";
import { formatPoints } from "./standings.js";
import { formatSince, playerValueTrend } from "./value-scale.js";

const round1 = (value) => Math.round(Number(value) * 10) / 10;

// Final weeks only: a live week's partial points would crown the wrong MVP.
function finalWeeks(weekRows, throughWeek) {
  const last = Number(throughWeek) || 0;
  return [...(weekRows instanceof Map ? weekRows.entries() : [])]
    .filter(([week]) => Number(week) >= 1 && Number(week) <= last)
    .sort((a, b) => Number(a[0]) - Number(b[0]));
}

export function seasonPlayerTotals(weekRows, rosterId, throughWeek) {
  const totals = new Map();
  const touch = (id) => {
    if (!totals.has(id)) totals.set(id, { playerId: id, startedPoints: 0, benchPoints: 0, starts: 0, benchWeeks: 0 });
    return totals.get(id);
  };
  for (const [, rows] of finalWeeks(weekRows, throughWeek)) {
    const row = (rows || []).find((entry) => String(entry?.roster_id) === String(rosterId));
    if (!row) continue;
    const starters = new Set((row.starters || []).map(String).filter((id) => id && id !== "0"));
    const points = row.players_points || {};
    for (const id of (row.players || []).map(String)) {
      if (!id || id === "0") continue;
      const entry = touch(id);
      const scored = Number(points[id]) || 0;
      if (starters.has(id)) {
        entry.startedPoints += scored;
        entry.starts += 1;
      } else {
        entry.benchPoints += scored;
        entry.benchWeeks += 1;
      }
    }
  }
  return totals;
}

export function buildTeamSuperlatives({
  rosterId,
  rosterPlayerIds = [],
  weekRows,
  throughWeek,
  values = {},
  names = {},
  ages = {},
  history = null,
  latestStarters = [],
  acquisitions = null,
} = {}) {
  const nameOf = (id) => String(names[`player:${id}`] || names[id] || "").trim();
  const cards = [];
  const totals = [...seasonPlayerTotals(weekRows, rosterId, throughWeek).values()].filter((row) => nameOf(row.playerId));
  const top = (list, key) => list.filter((row) => row[key] > 0).sort((a, b) => b[key] - a[key])[0] || null;

  const mvp = top(totals, "startedPoints");
  if (mvp) cards.push({ key: "mvp", title: "MVP", playerId: mvp.playerId, name: nameOf(mvp.playerId), why: `${formatPoints(mvp.startedPoints)} points started for you in ${mvp.starts} ${mvp.starts === 1 ? "week" : "weeks"}.` });

  const roster = rosterPlayerIds.map(String).filter((id) => nameOf(id));
  const priced = roster.map((id) => ({ id, value: Number(values[`player:${id}`]) })).filter((row) => row.value > 0).sort((a, b) => b.value - a.value);
  if (priced[0]) cards.push({ key: "asset", title: "Most valuable asset", playerId: priced[0].id, name: nameOf(priced[0].id), why: `Worth ${formatNumber(priced[0].value)}, the highest dynasty value on the roster.` });

  const trends = history ? roster.map((id) => ({ id, trend: playerValueTrend(history, `player:${id}`, "sf") })).filter((row) => row.trend && Number.isFinite(row.trend.delta)) : [];
  const riser = trends.filter((row) => row.trend.delta > 0).sort((a, b) => b.trend.delta - a.trend.delta)[0];
  if (riser) cards.push({ key: "riser", title: "Riser", playerId: riser.id, name: nameOf(riser.id), why: `Up ${formatNumber(riser.trend.delta)} in value ${formatSince(riser.trend.fromDate)}.` });
  const faller = trends.filter((row) => row.trend.delta < 0).sort((a, b) => a.trend.delta - b.trend.delta)[0];
  if (faller) cards.push({ key: "faller", title: "Faller", playerId: faller.id, name: nameOf(faller.id), why: `Down ${formatNumber(Math.abs(faller.trend.delta))} in value ${formatSince(faller.trend.fromDate)}.` });

  const bench = top(totals, "benchPoints");
  if (bench) cards.push({ key: "bench", title: "Bench warmer", playerId: bench.playerId, name: nameOf(bench.playerId), why: `${formatPoints(bench.benchPoints)} points scored on your bench.` });

  // Most starts; a tie goes to the one who scored more, and the card says so.
  const mostStarts = Math.max(0, ...totals.map((row) => row.starts));
  const tied = totals.filter((row) => row.starts === mostStarts && mostStarts > 0).sort((a, b) => b.startedPoints - a.startedPoints);
  if (tied[0]) {
    const iron = tied[0];
    const others = tied.length - 1;
    cards.push({ key: "iron", title: "Iron man", playerId: iron.playerId, name: nameOf(iron.playerId), why: `Started ${iron.starts} ${iron.starts === 1 ? "week" : "weeks"}${others ? `, tied with ${others} ${others === 1 ? "other" : "others"} (most points of them)` : ", the most on the team"}.` });
  }

  const starters = latestStarters.map(String).filter((id) => nameOf(id) && Number(ages[id]) > 0).map((id) => ({ id, age: Number(ages[id]) }));
  if (starters.length >= 2) {
    const sorted = [...starters].sort((a, b) => b.age - a.age);
    cards.push({ key: "oldest", title: "Oldest starter", playerId: sorted[0].id, name: nameOf(sorted[0].id), why: `${round1(sorted[0].age)} years old.` });
    const young = sorted[sorted.length - 1];
    cards.push({ key: "youngest", title: "Youngest starter", playerId: young.id, name: nameOf(young.id), why: `${round1(young.age)} years old.` });
  }
  // Best young asset: the highest value at 24 or younger.
  const young = priced.filter((row) => Number(ages[row.id]) > 0 && Number(ages[row.id]) <= 24);
  if (young[0]) cards.push({ key: "young", title: "Best young asset", playerId: young[0].id, name: nameOf(young[0].id), why: `Worth ${formatNumber(young[0].value)} at ${round1(ages[young[0].id])}.` });

  // How players got here, from the league archive's loaded seasons. Hidden
  // until it loads; only players still on this roster count.
  const bestOf = (map) => (map ? priced.find((row) => map.has(row.id)) : null);
  const drafted = bestOf(acquisitions?.drafted);
  if (drafted) {
    const pick = acquisitions.drafted.get(drafted.id);
    cards.push({ key: "drafted", title: "Best recent draft pick", playerId: drafted.id, name: nameOf(drafted.id), why: `Taken ${pick.label} in the ${pick.season} draft; worth ${formatNumber(drafted.value)} now. Drafts checked: ${acquisitions.span}.` });
  }
  const pickup = bestOf(acquisitions?.waivered);
  if (pickup) {
    const add = acquisitions.waivered.get(pickup.id);
    cards.push({ key: "pickup", title: "Best recent waiver pickup", playerId: pickup.id, name: nameOf(pickup.id), why: `Added ${add.type === "free_agent" ? "as a free agent" : "off waivers"} in ${add.season}${add.week ? ` week ${add.week}` : ""}; worth ${formatNumber(pickup.value)} now. Seasons checked: ${acquisitions.span}.` });
  }
  return cards;
}

// Draft picks made and waiver/free-agent adds by this roster, from the league
// archive (seasons it has loaded). Latest event per player wins.
export function rosterAcquisitions(archive, rosterId) {
  if (!archive) return null;
  const id = String(rosterId);
  const drafted = new Map();
  const waivered = new Map();
  for (const entry of archive.seasons || []) {
    const season = String(entry.season);
    for (const draft of archive.drafts?.[season] || []) {
      for (const pick of draft.picks || []) {
        if (String(pick.roster_id) !== id || !pick.player_id) continue;
        const slot = Number(pick.draft_slot) || 0;
        const label = slot ? `${pick.round}.${String(slot).padStart(2, "0")}` : `in round ${pick.round}`;
        if (!drafted.has(String(pick.player_id))) drafted.set(String(pick.player_id), { season: String(draft.season || season), round: pick.round, label });
      }
    }
    for (const move of archive.transactions?.[season] || []) {
      if (move.type !== "waiver" && move.type !== "free_agent") continue;
      for (const [playerId, to] of Object.entries(move.adds || {})) {
        if (String(to) !== id || waivered.has(playerId)) continue;
        waivered.set(playerId, { season, week: Number(move.leg) || 0, type: move.type });
      }
    }
  }
  // Only seasons whose moves loaded: the cards say which.
  const years = (archive.seasons || []).map((entry) => String(entry.season)).filter((season) => archive.transactions?.[season] || archive.drafts?.[season]).map(Number).sort((a, b) => a - b);
  const span = years.length ? (years[0] === years[years.length - 1] ? String(years[0]) : `${years[0]}–${years[years.length - 1]}`) : "";
  return { drafted, waivered, span };
}

// Start-to-sit record for the stat strip: last final week's starters.
export function latestStartersFor(weekRows, rosterId, throughWeek) {
  const weeks = finalWeeks(weekRows, throughWeek);
  for (let index = weeks.length - 1; index >= 0; index -= 1) {
    const row = (weeks[index][1] || []).find((entry) => String(entry?.roster_id) === String(rosterId));
    const starters = (row?.starters || []).map(String).filter((id) => id && id !== "0");
    if (starters.length) return starters;
  }
  return [];
}
