import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { emptyValueCalcState, listValueCalcAssets } from "../docs/modules/value-calc.js";
import {
  applyTradeTalk,
  parsePickPhrase,
  parseTradeTalk,
  priceNeighbors,
  tradeTalkReply,
} from "../docs/modules/trade-talk.js";

const here = dirname(fileURLToPath(import.meta.url));
const published = JSON.parse(readFileSync(join(here, "../docs/data/player_values.json"), "utf8"));
const publicCtx = {
  catalog: listValueCalcAssets(published.sf, published.names, { limit: 0, kinds: ["player"] }),
  pickIds: new Set(Object.keys(published.sf).filter((id) => id.startsWith("pick:"))),
  season: 2027,
};

// Say each line in order against one draft, like the box does.
function converse(lines, ctx = publicCtx, draft = emptyValueCalcState()) {
  let current = draft;
  const turns = [];
  for (const line of lines) {
    const plan = parseTradeTalk(line, { ...ctx, draft: current, partnerRosterId: current.partnerRosterId });
    const result = applyTradeTalk(current, plan);
    current = result.draft;
    turns.push({ plan, result, reply: tradeTalkReply(plan, result) });
  }
  return { draft: current, turns };
}

const names = (items) => items.map((item) => item.name);

test("a described trade builds both sides from the published board", () => {
  const { draft } = converse(["Gibbs and a 2027 1st for Nabers"]);
  assert.deepEqual(names(draft.left), ["Jahmyr Gibbs", "2027 1st"]);
  assert.deepEqual(names(draft.right), ["Malik Nabers"]);
  assert.equal(draft.left[1].assetId, "pick:2027:r1:any");
});

test("follow-ups edit the same draft instead of starting over", () => {
  const { draft, turns } = converse([
    "Gibbs and a 2027 1st for Nabers",
    "add my 2028 2nd",
    "swap Nabers for Puka",
    "remove the 2nd",
    "they add a 2029 early first",
  ]);
  assert.deepEqual(names(draft.left), ["Jahmyr Gibbs", "2027 1st"]);
  assert.deepEqual(names(draft.right), ["Puka Nacua", "2029 Early 1st"]);
  assert.equal(turns[1].plan.replace, false);
  assert.match(turns[1].reply.join(" "), /Added 2028 2nd to You give/);
});

test("'I got offered X for Y' puts the offer on the get side", () => {
  const { draft, turns } = converse(["I just got offered JSN and two 2nds for CMC, what do you think?"]);
  assert.deepEqual(names(draft.left), ["Christian McCaffrey"]);
  assert.deepEqual(names(draft.right), ["Jaxon Smith-Njigba", "2027 2nd", "2027 2nd"]);
  assert.equal(turns[0].plan.asked, true);
});

test("typos, nicknames and punctuation still find the player", () => {
  const { draft } = converse(["jahmyr gibs + ARSB for Ja'Marr Chase"]);
  assert.deepEqual(names(draft.left), ["Jahmyr Gibbs", "Amon-Ra St. Brown"]);
  assert.deepEqual(names(draft.right), ["Ja'Marr Chase"]);
});

test("a name that fits several players asks instead of guessing", () => {
  const { draft, turns } = converse(["brown"]);
  assert.equal(draft.left.length + draft.right.length, 0);
  assert.equal(turns[0].plan.asks.length, 1);
  assert.ok(turns[0].plan.asks[0].options.length >= 2);
  assert.match(turns[0].plan.asks[0].question, /Which Brown/);
});

test("words it cannot read are reported, and the draft is kept", () => {
  const start = converse(["Gibbs for Nabers"]).draft;
  const { draft, turns } = converse(["zzqx for blorp"], publicCtx, start);
  assert.deepEqual(names(draft.left), ["Jahmyr Gibbs"]);
  assert.deepEqual(names(draft.right), ["Malik Nabers"]);
  assert.match(turns[0].reply.join(" "), /Didn’t catch “zzqx”/);
});

test("'what could I get for' prices the give side and names an unconnected partner honestly", () => {
  const { draft, turns } = converse(["What could i get for Gibbs and a first from Chris"]);
  assert.deepEqual(names(draft.left), ["Jahmyr Gibbs", "2027 1st"]);
  assert.equal(draft.right.length, 0);
  assert.equal(turns[0].plan.intent, "shop");
  assert.equal(turns[0].plan.unknownPartner, "chris");
});

test("clear and flip are commands, and a picks year without prices says so", () => {
  const built = converse(["Gibbs for Nabers", "flip"]).draft;
  assert.deepEqual(names(built.left), ["Malik Nabers"]);
  assert.equal(converse(["Gibbs for Nabers", "clear"]).draft.left.length, 0);
  const { turns } = converse(["add a 2039 1st"]);
  assert.match(turns[0].reply.join(" "), /No price for 2039 1st/);
});

test("pick phrases", () => {
  assert.deepEqual(parsePickPhrase("2028 2nd", { season: 2027 }), { season: 2028, round: 2, bucket: "", count: 1 });
  assert.deepEqual(parsePickPhrase("next year's late first round pick", { season: 2027 }), { season: 2027, round: 1, bucket: "late", count: 1 });
  assert.deepEqual(parsePickPhrase("two firsts", { season: 2027 }), { season: 2027, round: 1, bucket: "", count: 2 });
  assert.equal(parsePickPhrase("Gibbs", { season: 2027 }), null);
});

// A small league: me (roster 1) and Chris (roster 2), each owning players and picks.
const league = {
  connected: true,
  meRosterId: 1,
  season: 2027,
  pickIds: new Set(["pick:2027:r1:any", "pick:2027:r2:any", "pick:2028:r2:any", "pick:2030:r1:any"]),
  managers: [
    { rosterId: 1, displayName: "niko", teamName: "Ticker Tape" },
    { rosterId: 2, displayName: "ChrisP", teamName: "Lions Den" },
    { rosterId: 3, displayName: "dana", teamName: "" },
  ],
  catalog: [
    { assetId: "player:1", name: "Jahmyr Gibbs", assetType: "player", value: 9000, ownerRosterId: 1 },
    { assetId: "player:2", name: "Malik Nabers", assetType: "player", value: 8000, ownerRosterId: 2 },
    { assetId: "player:3", name: "Puka Nacua", assetType: "player", value: 8600, ownerRosterId: 2 },
    { assetId: "player:4", name: "Drake London", assetType: "player", value: 7000, ownerRosterId: 3 },
    { assetId: "pick:2028:r2:1", name: "2028 2nd", assetType: "pick", value: 900, ownerRosterId: 1, originalRosterId: 1, season: 2028, round: 2, leagueId: "L1" },
    { assetId: "pick:2027:r1:2", name: "2027 1st (ChrisP)", assetType: "pick", value: 3000, ownerRosterId: 2, originalRosterId: 2, season: 2027, round: 1, leagueId: "L1" },
    { assetId: "pick:2027:r1:3", name: "2027 1st (dana)", assetType: "pick", value: 3000, ownerRosterId: 3, originalRosterId: 3, season: 2027, round: 1, leagueId: "L1" },
    { assetId: "pick:2027:r1:1", name: "2027 1st (niko)", assetType: "pick", value: 3000, ownerRosterId: 1, originalRosterId: 1, season: 2027, round: 1, leagueId: "L1" },
  ],
};

test("in a league, possessives pick the right owner's pick and set the partner", () => {
  const { draft } = converse(["Gibbs for Nabers and Chris's 2027 1st", "add my 2028 2nd"], league);
  assert.deepEqual(names(draft.left), ["Jahmyr Gibbs", "2028 2nd"]);
  assert.deepEqual(draft.right.map((item) => item.assetId), ["player:2", "pick:2027:r1:2"]);
  assert.equal(draft.right[1].leagueId, "L1");
  assert.equal(draft.partnerRosterId, 2);
});

test("in a league, a neutral 'A for B' written get-first is read by ownership", () => {
  const { draft } = converse(["Nabers for Gibbs"], league);
  assert.deepEqual(names(draft.left), ["Jahmyr Gibbs"]);
  assert.deepEqual(names(draft.right), ["Malik Nabers"]);
  assert.equal(draft.partnerRosterId, 2);
});

test("in a league, 'his' pick belongs to the team of the player named with it, not the last partner", () => {
  const start = converse(["Gibbs for London"], league).draft;
  assert.equal(start.partnerRosterId, 3);
  const { draft } = converse(["I got offered Nabers and his 2027 1st for Gibbs"], league, start);
  assert.deepEqual(draft.right.map((item) => item.assetId), ["player:2", "pick:2027:r1:2"]);
  assert.equal(draft.partnerRosterId, 2);
  const flipped = converse(["Nabers and his 2027 1st for Gibbs"], league).draft;
  assert.deepEqual(flipped.right.map((item) => item.assetId), ["player:2", "pick:2027:r1:2"]);
  assert.deepEqual(names(flipped.left), ["Jahmyr Gibbs"]);
});

test("in a league, a pick that team does not own is explained, not swapped", () => {
  const { draft, turns } = converse(["Gibbs for Nabers", "add chris's 2028 2nd"], league);
  assert.deepEqual(names(draft.right), ["Malik Nabers"]);
  assert.match(turns[1].reply.join(" "), /ChrisP has no 2028 2nd/);
});

test("in a league, a pick year the league has not made yet is labeled a generic market pick", () => {
  const { draft, turns } = converse(["Gibbs for Nabers", "add my 2030 1st"], league);
  assert.equal(draft.left[1].assetId, "pick:2030:r1:any");
  assert.match(turns[1].reply.join(" "), /No 2030 picks on rosters here, so 2030 1st is a generic pick at market price/);
});

test("in a league, 'what could I get from Chris' suggests his players priced near the give side", () => {
  const { turns } = converse(["what could I get from chris for Gibbs"], league);
  assert.equal(turns[0].plan.partnerRosterId, 2);
  const near = priceNeighbors(league.catalog, 9000, { ownerRosterId: 2, exclude: ["player:1"] });
  assert.deepEqual(near.map((row) => row.name), ["Puka Nacua", "Malik Nabers"]);
});

test("a shared name goes to the clearly bigger player, and a close call asks", () => {
  const rows = [
    { assetId: "player:a", name: "Josh Allen", assetType: "player", value: 9000 },
    { assetId: "player:b", name: "Keenan Allen", assetType: "player", value: 1200 },
    { assetId: "player:c", name: "Chris Godwin", assetType: "player", value: 3000 },
    { assetId: "player:d", name: "Chris Olave", assetType: "player", value: 3200 },
  ];
  const ctx = { ...publicCtx, catalog: rows };
  assert.deepEqual(names(converse(["Allen"], ctx).draft.left), ["Josh Allen"]);
  assert.equal(converse(["Chris"], ctx).turns[0].plan.asks.length, 1);
});
