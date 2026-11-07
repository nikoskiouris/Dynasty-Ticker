import test from "node:test";
import assert from "node:assert/strict";
import { escapeHtml, formatNumber, formatSignedNumber, clamp, copyTextToClipboard, playersAndPicksLabel, renderConnectGate, renderTradeAssetLabel, renderTradeMove } from "../docs/modules/html.js";

test("escapeHtml encodes markup", () => {
  assert.equal(escapeHtml(`<img src="x" alt='y'>`), "&lt;img src=&quot;x&quot; alt=&#39;y&#39;&gt;");
});

test("number helpers keep signs and locale digits", () => {
  assert.equal(formatSignedNumber(12), `+${formatNumber(12)}`);
  assert.equal(formatSignedNumber(-3), formatNumber(-3));
  assert.equal(clamp(12, 0, 10), 10);
  assert.equal(clamp(-2, 0, 10), 0);
  assert.equal(formatNumber(Number.NaN), "—");
  assert.equal(formatNumber(undefined), "—");
  assert.equal(playersAndPicksLabel(1), "1 player or pick");
  assert.equal(playersAndPicksLabel(4), "4 players & picks");
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

  const faced = renderTradeMove({
    received: [{ name: "Ja'Marr Chase", assetId: "player:11564", assetType: "player" }],
    sent: [{
      name: "2024 1st",
      pickLabel: "2024 1st",
      draftedPlayerName: "Malik Nabers",
      draftedPlayerId: "11631",
      assetType: "pick",
    }],
  });
  assert.match(faced, /trade-chip has-face/);
  assert.match(faced, /players\/thumb\/11564\.jpg/);
  assert.match(faced, /player-name-text">Ja&#39;Marr Chase/);
  assert.match(faced, /players\/thumb\/11631\.jpg/);
  assert.match(faced, /pick-selection">\(<span class="player-face/);
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

test("an empty league room has one connect button and no demo league", () => {
  const html = renderConnectGate();
  assert.match(html, /data-action="draft-connect"/);
  assert.match(html, /Connect my league/);
  assert.doesNotMatch(html, /Connect Sleeper/);
  assert.equal((html.match(/<button/g) || []).length, 1);
  assert.doesNotMatch(html, /demo league/i);
  assert.match(renderConnectGate({ copy: `<script>` }), /&lt;script&gt;/);
});

test("position articles follow how they are said: an RB, a QB", async () => {
  const { withArticle } = await import("../docs/modules/html.js");
  assert.equal(withArticle("RB"), "an RB");
  assert.equal(withArticle("QB"), "a QB");
  assert.equal(withArticle("WR"), "a WR");
  assert.equal(withArticle("TE"), "a TE");
  assert.equal(withArticle("LB"), "an LB");
  assert.equal(withArticle("DL"), "a DL");
  assert.equal(withArticle("K"), "a K");
  assert.equal(withArticle("edge rusher"), "an edge rusher");
  assert.equal(withArticle(""), "");
});
