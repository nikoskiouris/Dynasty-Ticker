import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { decodeTradeShare, shareSummary, encodeTradeShare } from "../docs/modules/trade-share.js";
import { draftMarketPrice, draftVerdictModel } from "../docs/modules/trade-draft.js";
import { getGlobalMaxPlayerValue, pickValueBundle } from "../docs/modules/values.js";
import { injectShareMeta } from "../netlify/lib/trade-share.js";

const root = dirname(fileURLToPath(import.meta.url));
const payload = JSON.parse(readFileSync(join(root, "../docs/data/player_values.json"), "utf8"));
const indexHtml = readFileSync(join(root, "../docs/index.html"), "utf8");

// What /trade computes for the same assets, via the calculator's own price lookup.
function clientModel(trade) {
  const { values, nameMap } = pickValueBundle(payload, trade.format);
  const price = (assetId) => draftMarketPrice(
    { assetId, assetType: assetId.startsWith("pick:") ? "pick" : "player" },
    { values, nameMap },
  ).value;
  return draftVerdictModel(trade.give.map(price), trade.get.map(price), { globalMaxValue: getGlobalMaxPlayerValue(values) });
}

const TRADES = [
  { give: ["player:9221"], get: ["player:11632", "pick:2027:r1:early", "pick:2028:r1:early", "pick:2027:r2:early"], format: "sf" },
  { give: ["player:9221"], get: ["pick:2027:r2:early"], format: "sf" },
  { give: ["player:9509", "pick:2027:r3:late"], get: ["pick:2027:r1:mid", "pick:2027:r2:mid", "pick:2028:r3:any"], format: "sf" },
  { give: ["pick:2027:r2:late", "pick:2027:r3:early"], get: ["pick:2027:r1:late"], format: "oneQb" },
];

for (const trade of TRADES) {
  test(`shared link and /trade agree: ${trade.give.join(",")} for ${trade.get.join(",")} (${trade.format})`, () => {
    const decoded = decodeTradeShare(encodeTradeShare(trade));
    const server = shareSummary(decoded, payload);
    const client = clientModel(decoded);
    assert.equal(server.giveTotal, client.give);
    assert.equal(server.getTotal, client.get);
    assert.deepEqual(server.credit ? { amount: server.credit.amount, side: server.credit.side } : null,
      client.adjustment ? { amount: Math.round(client.adjustment.amount), side: client.adjustment.side === "left" ? "give" : "get" } : null);
    for (const row of [...server.give, ...server.get]) {
      if (row.position === "PICK") assert.ok(row.value > 0, `${row.assetId} priced at 0`);
    }
  });
}

test("a 2nd is worth more than 0 and less than the same year's 1st, every bucket", () => {
  for (const format of ["sf", "oneQb"]) {
    const { values, nameMap } = pickValueBundle(payload, format);
    const v = (id) => draftMarketPrice({ assetId: id, assetType: "pick" }, { values, nameMap }).value;
    for (const year of ["2027", "2028"]) {
      for (const b of ["early", "mid", "late", "any"]) {
        const second = v(`pick:${year}:r2:${b}`);
        assert.ok(second > 0, `${format} ${year} r2 ${b} = ${second}`);
        assert.ok(second < v(`pick:${year}:r1:${b}`), `${format} ${year} r2 ${b} >= 1st`);
        const s = shareSummary(decodeTradeShare(encodeTradeShare({ give: ["player:9221"], get: [`pick:${year}:r2:${b}`], format })), payload);
        assert.equal(s.get[0].value, second);
      }
    }
  }
});

test("og/meta text for a lone 2nd no longer reads 'get 0'", () => {
  const code = encodeTradeShare({ give: ["player:9221"], get: ["pick:2027:r2:early"], format: "sf" });
  const summary = shareSummary(decodeTradeShare(code), payload);
  const html = injectShareMeta(indexHtml, { summary, code });
  assert.doesNotMatch(html, /get 0\b/);
});
