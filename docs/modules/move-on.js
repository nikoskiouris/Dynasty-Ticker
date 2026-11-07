// Ticket 007: named assets on my roster to move on from for capital.
//
// It follows My team's call. A rebuild sells aging producers. A team in
// between sells bench depth and aging running backs. A contender almost never
// sells its core: only aging bench pieces. Each name says why the window is
// wrong for him, what to ask for, and which teams in the league are natural
// buyers. Prices are the listed prices; nothing here changes them.

export const MOVE_ON_MIN_VALUE = 1500;
export const MOVE_ON_LIMIT = 6;

// Age at which a position's price usually starts to fall.
const AGING = Object.freeze({ QB: 31, RB: 26, WR: 28, TE: 29 });

// Thresholds sit on the published pick prices: a late 1st is about 4,200 and a
// 2nd about 1,700, so "ask for a 1st" only appears when he is worth one.
function askFor(value, teamState, position) {
  if (teamState === "rebuilding") {
    if (value >= 6500) return "a 1st and a young player";
    if (value >= 4000) return "a 1st";
    if (value >= 2500) return `a 2nd and a ${position} 24 or younger`;
    return "a 2nd";
  }
  if (value >= 7000) return "a 1st and a starter";
  if (value >= 4000) return "a 1st or a starter you need";
  if (value >= 2500) return "a 2nd and a young player";
  return "a 2nd";
}

// players: [{ assetId, name, position, value, age, starter }]
// buyers: [{ name, teamState, needs: ["RB", ...] }] (other teams)
export function buildMoveOnList({ players = [], teamState = "middle", buyers = [], limit = MOVE_ON_LIMIT } = {}) {
  const picked = [];
  for (const row of players) {
    const value = Number(row?.value) || 0;
    const age = Number(row?.age);
    const position = String(row?.position || "").toUpperCase();
    if (value < MOVE_ON_MIN_VALUE || !AGING[position]) continue;
    const old = Number.isFinite(age) && age >= AGING[position];
    let why = "";
    if (teamState === "rebuilding" && old) {
      why = `${position}, ${age}: his price usually falls before a rebuild pays off. Sell while it holds.`;
    } else if (teamState === "middle" && !row.starter) {
      why = `Bench ${position}: not in your best lineup, and worth more to a team that would start him.`;
    } else if (teamState === "middle" && old && position === "RB") {
      why = `RB, ${age}: running backs lose value fast at this age, and you are not all-in this year.`;
    } else if (teamState === "contending" && !row.starter && old) {
      why = `Bench ${position}, ${age}: not helping this year's run, and losing value.`;
    }
    if (!why) continue;
    const fits = (buyer) => (buyer.needs || []).includes(position);
    const contender = (buyer) => buyer.teamState === "contending";
    const ranked = buyers
      .filter((buyer) => buyer?.name && (fits(buyer) || contender(buyer)))
      .sort((a, b) => (Number(fits(b) && contender(b)) - Number(fits(a) && contender(a)))
        || (Number(fits(b)) - Number(fits(a)))
        || String(a.name).localeCompare(String(b.name)));
    picked.push({
      ...row,
      position,
      value,
      why,
      ask: askFor(value, teamState, position),
      buyers: ranked.slice(0, 2).map((buyer) => buyer.name),
    });
  }
  return picked.sort((a, b) => b.value - a.value).slice(0, limit);
}
