import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CALC_LIST_LIMIT,
  calcListDomId,
  calcOptionAttrs,
  calcOptionDomId,
  calcSuggestionFromList,
  clearCalcSearchBox,
  handleCalcComboboxKey,
  keepCalcSearchFocused,
  moveCalcSuggestion,
  planCalcListVisibility,
  renderCalcSearchInput,
  restoreFocusedCalcSearch,
  shouldArmCalcSuggestion,
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
    listId: "value-list-left",
    expanded: true,
    activeId: "calc-opt-left-player-1-0",
  });
  assert.match(html, /type="text"/);
  assert.doesNotMatch(html, /type="search"/);
  assert.match(html, /role="combobox"/);
  assert.match(html, /aria-autocomplete="list"/);
  assert.match(html, /aria-expanded="true"/);
  assert.match(html, /aria-controls="value-list-left"/);
  assert.match(html, /aria-activedescendant="calc-opt-left-player-1-0"/);
  assert.doesNotMatch(html, /role="searchbox"/);
  assert.match(html, /autocomplete="off"/);
  assert.match(html, /autocorrect="off"/);
  assert.match(html, /data-input="value-search"/);
  assert.match(html, /data-side="left"/);
  assert.match(html, /value="2"/);
  assert.match(html, /enterkeyhint="go"/);
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

test("a suggestion click is armed for mouse and Enter, not a right-click", () => {
  const input = mockSearchInput("value-search", "left", 4);
  const doc = mockDoc(input);
  const item = {
    closest(selector) {
      if (selector === ".calc-item[data-action='value-add']" || selector === ".calc-item[data-action]") return item;
      if (selector === ".calc-suggest, .calc-list") return { id: "list" };
      return null;
    },
  };
  assert.equal(shouldArmCalcSuggestion({ target: item, pointerType: "mouse", button: 0 }, doc), true);
  assert.equal(shouldArmCalcSuggestion({ target: item, pointerType: "mouse", button: 2 }, doc), false);
  const away = { activeElement: { getAttribute() { return ""; } } };
  assert.equal(shouldArmCalcSuggestion({ target: item, pointerType: "mouse", button: 0 }, away), true);
});

test("Enter takes the highlighted suggestion, or the first one", () => {
  const first = mockOption(false);
  const second = mockOption(true);
  const list = {
    querySelector(selector) {
      if (selector.startsWith(".calc-item.is-active")) return second;
      if (selector.startsWith(".calc-item")) return first;
      return null;
    },
  };
  const root = {
    querySelector(selector) {
      return selector === "#value-list-left" ? list : null;
    },
    querySelectorAll() {
      return [first, second];
    },
  };
  assert.equal(calcSuggestionFromList(root, "left"), second);
  const moved = moveCalcSuggestion(root, "left", -1);
  assert.equal(moved, first);
  assert.equal(first.active, true);
  assert.equal(second.active, false);
});

test("both calculator shells keep using the sticky text search", () => {
  const app = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../docs/app.js"), "utf8");
  assert.match(app, /renderCalcSearchInput\(/);
  assert.match(app, /keepCalcSearchFocused\(/);
  assert.match(app, /clearCalcSearchBox\(/);
  assert.match(app, /shouldResetCalcSearchOnPick\(/);
  assert.match(app, /pickDraftSuggestion\(/);
  assert.match(app, /swallowCalcClick/);
  assert.match(app, /<div class="player-item calc-item"/);
  assert.match(app, /role="listbox"/);
  assert.match(app, /handleCalcComboboxKey\(/);
  assert.doesNotMatch(app, /class="player-item calc-item"[^>]*role="button"/);
  assert.doesNotMatch(app, /class="player-item calc-item"[^>]*tabindex="-1"/);
  assert.doesNotMatch(app, /class="calc-search"[^>]*type="search"/);
  assert.doesNotMatch(app, /search\.blur\(\)/);
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

test("suggestion rows are listbox options with unique ids", () => {
  const first = calcOptionAttrs({ side: "left", assetId: "player:8110", index: 0 });
  const second = calcOptionAttrs({ side: "left", assetId: "player:8110", index: 1, selected: true });
  assert.match(first, /id="calc-opt-left-player-8110-0"/);
  assert.match(first, /role="option"/);
  assert.match(first, /aria-selected="false"/);
  assert.match(second, /id="calc-opt-left-player-8110-1"/);
  assert.match(second, /aria-selected="true"/);
  assert.notEqual(calcOptionDomId("left", "player:8110", 0), calcOptionDomId("right", "player:8110", 0));
  assert.equal(calcListDomId("right"), "value-list-right");
});

test("arrow keys move the highlight, Enter picks it, Esc closes, focus stays", () => {
  const input = mockComboInput();
  const first = mockOption(false, "calc-opt-left-a-0");
  const second = mockOption(false, "calc-opt-left-b-1");
  const list = mockComboList([first, second]);
  const root = {
    querySelector(selector) {
      return selector === "#value-list-left" ? list : null;
    },
    querySelectorAll() {
      return [first, second];
    },
  };
  const down = keyEvent("ArrowDown");
  const moved = handleCalcComboboxKey(down, { input, list, root, side: "left" });
  assert.equal(moved.handled, true);
  assert.equal(moved.action, "move");
  assert.equal(moved.item, first);
  assert.equal(first.active, true);
  assert.equal(first.selected, "true");
  assert.equal(second.selected, "false");
  assert.equal(input.attrs["aria-expanded"], "true");
  assert.equal(input.attrs["aria-activedescendant"], "calc-opt-left-a-0");
  assert.equal(down.defaultPrevented, true);
  assert.equal(input.focused, true);

  const up = keyEvent("ArrowUp");
  handleCalcComboboxKey(up, { input, list, root, side: "left" });
  assert.equal(second.active, true);
  assert.equal(input.attrs["aria-activedescendant"], "calc-opt-left-b-1");

  const enter = keyEvent("Enter");
  const picked = handleCalcComboboxKey(enter, { input, list, root, side: "left" });
  assert.equal(picked.action, "pick");
  assert.equal(picked.item, second);
  assert.equal(input.focused, true);
  assert.equal(input.attrs["aria-expanded"], "false");
  assert.equal(input.attrs["aria-activedescendant"], undefined);
  assert.equal(list.closed, true);

  const esc = keyEvent("Escape");
  const closed = handleCalcComboboxKey(esc, { input, list, root, side: "left" });
  assert.equal(closed.action, "close");
  assert.equal(list.closed, true);
  assert.equal(input.attrs["aria-expanded"], "false");
  assert.equal(input.attrs["aria-activedescendant"], undefined);
  assert.equal(second.active, false);
  assert.equal(input.focused, true);
  assert.equal(input.blurred, false);

  const hiddenEnter = keyEvent("Enter");
  const blocked = handleCalcComboboxKey(hiddenEnter, { input, list, root, side: "left" });
  assert.equal(blocked.handled, false);
});

test("Enter that adds a player closes the combobox", () => {
  const input = mockComboInput();
  input.attrs["aria-expanded"] = "true";
  input.attrs["aria-activedescendant"] = "calc-opt-left-a-0";
  const first = mockOption(true, "calc-opt-left-a-0");
  const list = mockComboList([first]);
  const root = {
    querySelector(selector) {
      return selector === "#value-list-left" ? list : null;
    },
    querySelectorAll() {
      return [first];
    },
  };
  const picked = handleCalcComboboxKey(keyEvent("Enter"), { input, list, root, side: "left" });
  assert.equal(picked.action, "pick");
  assert.equal(picked.item, first);
  assert.equal(input.attrs["aria-expanded"], "false");
  assert.equal("aria-activedescendant" in input.attrs, false);
  assert.equal(list.closed, true);
  assert.equal(input.focused, true);
  assert.equal(input.blurred, false);
});

test("shared keyboard focus ring is one outline and trade rows are not outline none", () => {
  const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../docs/styles.css"), "utf8");
  const rule = css.match(/input:focus-visible,[\s\S]*?\[role="button"\]:focus-visible \{[\s\S]*?\}/);
  assert.ok(rule);
  assert.match(rule[0], /\.page-tab:focus-visible/);
  assert.match(rule[0], /#open-public-ranks:focus-visible/);
  assert.match(rule[0], /\.ranks-chip:focus-visible/);
  assert.match(rule[0], /\.ranks-shelf-item:focus-visible/);
  assert.match(rule[0], /\.ranks-row:focus-visible/);
  assert.match(rule[0], /\.trade-row:focus-visible/);
  assert.match(rule[0], /outline:\s*2px solid var\(--text\);/);
  assert.match(rule[0], /outline-offset:\s*2px;/);
  assert.doesNotMatch(css, /\.trade-row:focus-visible\s*\{[^}]*outline:\s*none/);
  // The missing-league and Sleeper-outage headings drop their focus ring.
  // Every other control keeps the shared outline.
  const focusRings = css
    .replace(/#league-missing-title:focus:not\(:focus-visible\)\s*\{[^}]*\}/g, "")
    .replace(/#league-missing-title:focus,\s*#sleeper-down-title:focus\s*\{[^}]*\}/g, "");
  assert.match(css, /#league-missing-title:focus:not\(:focus-visible\)\s*\{[^}]*outline:\s*none/);
  assert.match(css, /#league-missing-title:focus,\s*#sleeper-down-title:focus\s*\{\s*outline:\s*none;\s*\}/);
  assert.doesNotMatch(focusRings, /outline:\s*none/);
});

function mockOption(active, id = "") {
  const option = {
    id,
    active,
    selected: active ? "true" : "false",
    classList: {
      contains(name) {
        return name === "is-active" && option.active;
      },
      toggle(name, on) {
        if (name === "is-active") option.active = Boolean(on);
      },
    },
    setAttribute(name, value) {
      if (name === "aria-selected") option.selected = value;
    },
    removeAttribute() {},
  };
  return option;
}

function mockComboInput() {
  const input = {
    focused: true,
    blurred: false,
    attrs: {},
    setAttribute(name, value) {
      this.attrs[name] = value;
    },
    removeAttribute(name) {
      delete this.attrs[name];
    },
    focus() {
      this.focused = true;
    },
    blur() {
      this.focused = false;
      this.blurred = true;
    },
  };
  return input;
}

function mockComboList(items) {
  const list = {
    closed: false,
    classList: {
      contains(name) {
        return name === "is-closed" && list.closed;
      },
      toggle(name, on) {
        if (name === "is-closed") list.closed = Boolean(on);
      },
      add(name) {
        if (name === "is-closed") list.closed = true;
      },
      remove(name) {
        if (name === "is-closed") list.closed = false;
      },
    },
    querySelector(selector) {
      if (String(selector).includes("is-active")) return items.find((item) => item.active) || null;
      if (String(selector).includes("calc-item")) return items[0] || null;
      return null;
    },
    querySelectorAll() {
      return items;
    },
  };
  return list;
}

function keyEvent(key) {
  return {
    key,
    defaultPrevented: false,
    preventDefault() {
      this.defaultPrevented = true;
    },
  };
}

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
