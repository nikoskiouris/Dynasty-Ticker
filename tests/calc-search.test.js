import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CALC_LIST_LIMIT,
  clearCalcSearchBox,
  keepCalcSearchFocused,
  planCalcListVisibility,
  renderCalcSearchInput,
  restoreFocusedCalcSearch,
  shouldHoldCalcSearchFocus,
  shouldResetCalcSearchOnPick,
  snapshotFocusedCalcSearch,
} from "../docs/modules/calc-search.js";
import { listValueCalcAssets } from "../docs/modules/value-calc.js";

test("calculator search is a text box, not a search input that iPad blurs", () => {
  const html = renderCalcSearchInput({
    query: "2",
    side: "left",
    input: "value-search",
    placeholder: "Search players and picks",
  });
  assert.match(html, /type="text"/);
  assert.doesNotMatch(html, /type="search"/);
  assert.match(html, /role="searchbox"/);
  assert.match(html, /autocomplete="off"/);
  assert.match(html, /autocorrect="off"/);
  assert.match(html, /data-input="value-search"/);
  assert.match(html, /data-side="left"/);
  assert.match(html, /value="2"/);
});

test("search markup escapes the query", () => {
  const html = renderCalcSearchInput({ query: `2027 "early" <1st>`, side: "my", input: "calc-search" });
  assert.match(html, /value="2027 &quot;early&quot; &lt;1st&gt;"/);
});

test("roster filter hides extra hits instead of dropping later matches", () => {
  const assets = Array.from({ length: 90 }, (_, index) => ({ assetId: `pick:${index}` }));
  const empty = planCalcListVisibility(assets, "", () => true, 80);
  assert.equal(empty.visibleCount, 80);
  assert.equal(empty.visibility[79], true);
  assert.equal(empty.visibility[80], false);

  const filtered = planCalcListVisibility(
    assets,
    "late",
    (asset) => asset.assetId === "pick:85",
    CALC_LIST_LIMIT
  );
  assert.equal(filtered.visibleCount, 1);
  assert.equal(filtered.visibility[85], true);
});

test("rebuilding the result list puts the caret back in the filter box", () => {
  const input = mockSearchInput("value-search", "left", 1);
  const doc = mockDoc(input);
  keepCalcSearchFocused(doc, () => {
    input.blur();
    input.selectionStart = 0;
    input.selectionEnd = 0;
  }, (fn) => fn());
  assert.equal(input.focused, true);
  assert.equal(doc.activeElement, input);
  assert.equal(input.selectionStart, 1);
  assert.equal(input.selectionEnd, 1);
});

test("snapshot skips non-calculator fields", () => {
  const other = mockSearchInput("player-search", "left", 0);
  other.getAttribute = () => "player-search";
  const doc = mockDoc(other);
  assert.equal(snapshotFocusedCalcSearch(doc), null);
  assert.equal(restoreFocusedCalcSearch(null, doc), false);
});

test("picking a player clears the typed name and leaves the caret ready", () => {
  assert.equal(shouldResetCalcSearchOnPick("value-add"), true);
  assert.equal(shouldResetCalcSearchOnPick("calc-toggle", { fromList: true }), true);
  assert.equal(shouldResetCalcSearchOnPick("calc-toggle", { fromList: false }), false);
  assert.equal(shouldResetCalcSearchOnPick("value-remove"), false);
  const input = mockSearchInput("value-search", "left", 4);
  input.value = "Bijan";
  assert.equal(clearCalcSearchBox(input), true);
  assert.equal(input.value, "");
  assert.equal(input.selectionStart, 0);
  assert.equal(input.selectionEnd, 0);
  assert.equal(clearCalcSearchBox(null), false);
});

test("pointer down on a result keeps the filter box focused", () => {
  const input = mockSearchInput("calc-search", "my", 4);
  const doc = mockDoc(input);
  const event = {
    target: {
      closest(selector) {
        return selector === ".calc-item[data-action]" ? { dataset: { action: "calc-toggle" } } : null;
      },
    },
  };
  assert.equal(shouldHoldCalcSearchFocus(event, doc), true);
  assert.equal(shouldHoldCalcSearchFocus({ target: { closest: () => null } }, doc), false);
});

test("both calculator shells keep using the sticky text search", () => {
  const app = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../docs/app.js"), "utf8");
  assert.match(app, /renderCalcSearchInput\(/);
  assert.match(app, /keepCalcSearchFocused\(/);
  assert.match(app, /clearCalcSearchBox\(/);
  assert.match(app, /shouldResetCalcSearchOnPick\(/);
  assert.match(app, /tabindex="-1"/);
  assert.doesNotMatch(app, /class="calc-search"[^>]*type="search"/);
  assert.doesNotMatch(app, /type="search"[^>]*class="calc-search"/);
});

test("blank calculator still finds a 2027 early 1st from a typed query", () => {
  const rows = listValueCalcAssets(
    { "pick:2027:r1:early": 7000, "pick:2027:r1:late": 5400, "player:1": 9000 },
    { "pick:2027:r1:early": "2027 Early 1st Pick", "pick:2027:r1:late": "2027 Late 1st Pick" },
    { query: "2027 early 1st" }
  );
  assert.deepEqual(rows.map((row) => row.assetId), ["pick:2027:r1:early"]);
});

function mockSearchInput(kind, side, caret) {
  const input = {
    focused: true,
    selectionStart: caret,
    selectionEnd: caret,
    getAttribute(name) {
      if (name === "data-input") return kind;
      if (name === "data-side") return side;
      return "";
    },
    focus() {
      this.focused = true;
      this.doc.activeElement = this;
    },
    blur() {
      this.focused = false;
      this.doc.activeElement = { getAttribute() { return ""; } };
    },
    setSelectionRange(start, end) {
      this.selectionStart = start;
      this.selectionEnd = end;
    },
  };
  return input;
}

function mockDoc(input) {
  const doc = {
    activeElement: input,
    querySelector(selector) {
      const kind = input.getAttribute("data-input");
      const side = input.getAttribute("data-side");
      if (selector === `[data-input="${kind}"][data-side="${side}"]`) return input;
      return null;
    },
  };
  input.doc = doc;
  input.focus = input.focus.bind(input);
  input.blur = input.blur.bind(input);
  return doc;
}
