import test from "node:test";
import assert from "node:assert/strict";
import { escapeHtml, formatNumber, formatSignedNumber, formatMatchIdeaCopy, clamp, copyTextToClipboard, renderTradeAssetLabel, renderTradeMove } from "../docs/modules/html.js";

test("escapeHtml encodes markup", () => {
  assert.equal(escapeHtml(`<img src="x" alt='y'>`), "&lt;img src=&quot;x&quot; alt=&#39;y&#39;&gt;");
});

test("number helpers keep signs and locale digits", () => {
  assert.equal(formatSignedNumber(12), `+${formatNumber(12)}`);
  assert.equal(formatSignedNumber(-3), formatNumber(-3));
  assert.equal(clamp(12, 0, 10), 10);
  assert.equal(clamp(-2, 0, 10), 0);
});

test("partner idea copy is send/receive plus a starter rank line", () => {
  const copy = formatMatchIdeaCopy({
    sendNames: ["Ja'Marr Chase", "2027 1st"],
    receiveNames: ["Bijan Robinson"],
    beforeRank: 8,
    afterRank: 4,
    totalTeams: 12,
  });
  assert.equal(copy.offer, "Send Ja'Marr Chase and 2027 1st for Bijan Robinson");
  assert.equal(copy.rank, "It'll change your starting lineup rank from 8th/12 to 4th/12");
});

test("trade move chips keep pick names, players, and the swap arrow apart", () => {
  const html = renderTradeMove({
    received: [
      { name: "Jaxson Dart" },
      {
        name: "2026 3rd from chrisalberts (Michael Trigg, 1,168)",
        pickLabel: "2026 3rd from chrisalberts",
        draftedPlayerName: "Michael Trigg",
        draftedPlayerValue: 1168,
      },
    ],
    sent: [{ name: "Matthew Stafford" }],
  }, (value) => Number(value).toLocaleString("en-US"));

  assert.match(html, /class="trade-chip">Jaxson Dart<\/span>/);
  assert.match(html, /2026 3rd from chrisalberts <span class="pick-selection">\(Michael Trigg, 1,168\)<\/span>/);
  assert.match(html, /class="trade-arrow"[^>]*>←<\/span>/);
  assert.match(html, /class="trade-chip">Matthew Stafford<\/span>/);
  assert.equal(renderTradeAssetLabel({ name: "Cam Ward" }), "Cam Ward");
});

test("copyTextToClipboard uses the clipboard API then a textarea fallback", async () => {
  const writes = [];
  const ok = await copyTextToClipboard("hello", { writeText: async (text) => writes.push(text) });
  assert.equal(ok, true);
  assert.deepEqual(writes, ["hello"]);

  const doc = {
    body: {
      child: null,
      appendChild(node) {
        this.child = node;
      },
      removeChild() {
        this.child = null;
      },
    },
    createElement() {
      return {
        value: "",
        style: {},
        setAttribute() {},
        select() {},
      };
    },
    execCommand() {
      return true;
    },
  };
  const fallback = await copyTextToClipboard("paste me", { writeText: null }, doc);
  assert.equal(fallback, true);
});
