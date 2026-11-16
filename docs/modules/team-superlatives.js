// My Team superlatives (ticket 037). Pure: matchups, values and the price
// history in, a short list of cards out. A card with no data is left out,
// never shown as zero.
import { formatNumber } from "./html.js";
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
} = {}) {
  const nameOf = (id) => String(names[`player:${id}`] || names[id] || "").trim();
  const cards = [];
  const totals = [...seasonPlayerTotals(weekRows, rosterId, throughWeek).values()].filter((row) => nameOf(row.playerId));
  const top = (list, key) => list.filter((row) => row[key] > 0).sort((a, b) => b[key] - a[key])[0] || null;

  const mvp = top(totals, "startedPoints");
  if (mvp) cards.push({ key: "mvp", title: "MVP", playerId: mvp.playerId, name: nameOf(mvp.playerId), why: `${formatNumber(round1(mvp.startedPoints))} points started for you in ${mvp.starts} ${mvp.starts === 1 ? "week" : "weeks"}.` });

  const roster = rosterPlayerIds.map(String).filter((id) => nameOf(id));
  const priced = roster.map((id) => ({ id, value: Number(values[`player:${id}`]) })).filter((row) => row.value > 0).sort((a, b) => b.value - a.value);
  if (priced[0]) cards.push({ key: "asset", title: "Most valuable asset", playerId: priced[0].id, name: nameOf(priced[0].id), why: `Worth ${formatNumber(priced[0].value)}, the highest dynasty value on the roster.` });

  const trends = history ? roster.map((id) => ({ id, trend: playerValueTrend(history, `player:${id}`, "sf") })).filter((row) => row.trend && Number.isFinite(row.trend.delta)) : [];
  const riser = trends.filter((row) => row.trend.delta > 0).sort((a, b) => b.trend.delta - a.trend.delta)[0];
  if (riser) cards.push({ key: "riser", title: "Riser", playerId: riser.id, name: nameOf(riser.id), why: `Up ${formatNumber(riser.trend.delta)} in value ${formatSince(riser.trend.fromDate)}.` });
  const faller = trends.filter((row) => row.trend.delta < 0).sort((a, b) => a.trend.delta - b.trend.delta)[0];
  if (faller) cards.push({ key: "faller", title: "Faller", playerId: faller.id, name: nameOf(faller.id), why: `Down ${formatNumber(Math.abs(faller.trend.delta))} in value ${formatSince(faller.trend.fromDate)}.` });

  const bench = top(totals, "benchPoints");
  if (bench) cards.push({ key: "bench", title: "Bench warmer", playerId: bench.playerId, name: nameOf(bench.playerId), why: `${formatNumber(round1(bench.benchPoints))} points scored on your bench.` });

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
  return cards;
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
