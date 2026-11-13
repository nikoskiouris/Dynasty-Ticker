import { resolveRosterIdentity } from "./franchise.js";

const id = (value) => String(value ?? "").trim();
const round2 = (value) => Math.round(value * 100) / 100;
const priceMap = (values) => values?.sf || values || {};
const isPrice = (value) => typeof value === "number" && Number.isFinite(value) && value >= 0;

function manager(archive, entry, rosterId) {
  const roster = (entry?.rosters || []).find((row) => id(row.roster_id) === id(rosterId));
  return resolveRosterIdentity(archive?.franchiseIndex, {
    userId: roster?.owner_id, leagueId: entry?.leagueId, rosterId,
  });
}
function eventWeek(season, week) {
  return Number(season) * 20 + Number(week);
}
function activeRosterPlayers(roster) {
  return new Set(["players", "reserve", "taxi", "starters"]
    .flatMap((field) => Array.isArray(roster?.[field]) ? roster[field] : []).map(id));
}
function currentOwnedBy(archive) {
  const current = (archive?.seasons || []).slice()
    .sort((a, b) => Number(b.season) - Number(a.season))[0];
  const owners = new Map();
  if (!current) return owners;
  for (const roster of current.rosters || []) {
    const identity = manager(archive, current, roster.roster_id);
    if (!owners.has(identity.managerKey)) owners.set(identity.managerKey, new Set());
    for (const playerId of activeRosterPlayers(roster)) owners.get(identity.managerKey).add(playerId);
  }
  return owners;
}

function weeklyStarts(archive) {
  const weeks = new Map();
  let invalidWeeks = 0;
  for (const entry of archive?.seasons || []) {
    for (const [week, rows] of Object.entries(archive?.matchups?.[id(entry.season)] || {})) {
      const order = eventWeek(entry.season, week);
      for (const row of rows || []) {
        const starters = row?.starters;
        const scores = row?.starters_points;
        if (!Array.isArray(starters) || !Array.isArray(scores)
          || starters.length !== scores.length || scores.some((point) =>
            !Number.isFinite(Number(point)))) {
          invalidWeeks++;
          continue;
        }
        const identity = manager(archive, entry, row.roster_id);
        const key = identity.managerKey;
        if (!weeks.has(key)) weeks.set(key, []);
        const started = new Map();
        starters.forEach((playerId, index) => {
          if (id(playerId) && id(playerId) !== "0") started.set(id(playerId), Number(scores[index]));
        });
        weeks.get(key).push({ order, season: id(entry.season), week: Number(week), started });
      }
    }
  }
  return { weeks, invalidWeeks };
}

function transactionEvents(archive) {
  const events = [];
  let undatedAdds = 0;
  for (const entry of archive?.seasons || []) {
    for (const transaction of archive?.transactions?.[id(entry.season)] || []) {
      if (transaction?.status !== "complete"
        || !["waiver", "free_agent", "trade"].includes(transaction?.type)) continue;
      const leg = Number(transaction.leg);
      if (!Number.isInteger(leg) || leg < 0 || leg > 18) {
        if (["waiver", "free_agent"].includes(transaction.type)) {
          undatedAdds += Object.keys(transaction.adds || {}).length;
        }
        continue; // Never infer an acquisition week from its calendar date.
      }
      const time = Number(transaction.status_updated || transaction.created || 0);
      const base = { season: id(entry.season), week: leg,
        order: eventWeek(entry.season, leg), time, transactionId: id(transaction.transaction_id),
        transactionType: transaction.type };
      for (const [field, action] of [["drops", "drop"], ["adds", "add"]]) {
        for (const [playerId, rosterId] of Object.entries(transaction[field] || {})) {
          if (!id(playerId) || rosterId == null) continue;
          const person = manager(archive, entry, rosterId);
          const faabBid = Number(transaction?.settings?.waiver_bid);
          events.push({ ...base, playerId: id(playerId), action,
            managerKey: person.managerKey, managerName: person.managerName,
            rosterId: id(rosterId), faabBid: action === "add" && transaction.type === "waiver"
              && Number.isFinite(faabBid) && faabBid >= 0 ? faabBid : null,
          });
        }
      }
    }
  }
  // A same-week trade's drop occurs before its add if timestamps tie.
  events.sort((a, b) => a.order - b.order || a.time - b.time
    || (a.action === "drop" ? -1 : 1));
  return { events, undatedAdds };
}

function pickupScore(pickup, events, allStarts, owners, prices) {
  const from = events.indexOf(pickup);
  let end = Infinity;
  for (let i = from + 1; i < events.length; i++) {
    const next = events[i];
    if (next.playerId !== pickup.playerId) continue;
    if (next.action === "add"
      || (next.action === "drop" && next.managerKey === pickup.managerKey)) {
      end = next.order;
      break;
    }
  }
  let startedPoints = 0;
  const starts = [];
  for (const week of allStarts.get(pickup.managerKey) || []) {
    if (week.order < pickup.order || week.order >= end) continue;
    if (!week.started.has(pickup.playerId)) continue;
    const points = week.started.get(pickup.playerId);
    startedPoints += points;
    starts.push({ season: week.season, week: week.week, points: round2(points) });
  }
  const stillOwned = end === Infinity && Boolean(owners.get(pickup.managerKey)?.has(pickup.playerId));
  const currentValue = stillOwned ? prices[`player:${pickup.playerId}`] : 0;
  if (!isPrice(currentValue)) return null;
  return { ...pickup, startedPoints: round2(startedPoints),
    currentRosterValue: currentValue, score: round2(startedPoints + currentValue),
    starts, stillOwned };
}

// Only documented waiver and free-agent adds count as pickups. Started points
// are attributed from the acquisition leg until a recorded drop/trade/next add.
// A current value bonus applies only when the same manager still owns the
// pickup; FAAB remains a separate cost-per-started-point statistic.
export function waiverAwards(archive = {}, { values = {}, minAdds = 5 } = {}) {
  const prices = priceMap(values);
  const owners = currentOwnedBy(archive);
  const { weeks, invalidWeeks } = weeklyStarts(archive);
  const { events, undatedAdds } = transactionEvents(archive);
  const byManager = new Map();
  const pickups = [];
  let unpricedAdds = 0;
  for (const event of events) {
    if (event.action !== "add" || !["waiver", "free_agent"].includes(event.transactionType)) continue;
    const pickup = pickupScore(event, events, weeks, owners, prices);
    if (!pickup) { unpricedAdds++; continue; }
    pickups.push(pickup);
    if (!byManager.has(pickup.managerKey)) byManager.set(pickup.managerKey, {
      key: pickup.managerKey, name: pickup.managerName,
      adds: 0, startedPoints: 0, currentRosterValue: 0, score: 0,
      faabSpent: 0, faabKnownAdds: 0, bestPickup: null,
    });
    const row = byManager.get(pickup.managerKey);
    row.name = pickup.managerName;
    row.adds++;
    row.startedPoints += pickup.startedPoints;
    row.currentRosterValue += pickup.currentRosterValue;
    row.score += pickup.score;
    if (pickup.faabBid != null) {
      row.faabSpent += pickup.faabBid;
      row.faabKnownAdds++;
    }
    if (!row.bestPickup || pickup.score > row.bestPickup.score) row.bestPickup = pickup;
  }
  const standings = [...byManager.values()].map((row) => ({
    ...row, eligible: row.adds >= minAdds, score: round2(row.score),
    startedPoints: round2(row.startedPoints),
    currentRosterValue: round2(row.currentRosterValue),
    faabSpent: round2(row.faabSpent),
    faabPerStartedPoint: row.faabKnownAdds > 0 && row.startedPoints > 0
      ? round2(row.faabSpent / row.startedPoints) : null,
  })).sort((a, b) => b.score - a.score || b.startedPoints - a.startedPoints);
  const eligible = standings.filter((row) => row.eligible);
  const bestPickup = pickups.slice().sort((a, b) => b.score - a.score)[0] || null;
  return {
    best: eligible[0] || null, worst: eligible.length > 1 ? eligible[eligible.length - 1] : null,
    standings, bestPickup, evaluatedAdds: pickups.length, unpricedAdds, undatedAdds,
    invalidWeeks, minAdds,
    method: "Waiver score = points earned in the manager's starting lineup after each documented free-agent/waiver pickup (until a recorded drop or transfer), plus the player's current SF value only if still rostered by that manager. Minimum 5 priced adds. FAAB cost is reported separately per started point when a bid is available; missing acquisition dates or values exclude pickups.",
  };
}
