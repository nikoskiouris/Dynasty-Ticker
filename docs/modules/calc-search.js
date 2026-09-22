import { escapeHtml } from "./html.js";

export const CALC_LIST_LIMIT = 80;
export const CALC_SEARCH_INPUTS = Object.freeze(["calc-search", "value-search"]);

export function renderCalcSearchInput({
  query = "",
  side = "",
  input = "calc-search",
  placeholder = "Search players and picks",
} = {}) {
  return `<input type="text" class="calc-search" role="searchbox" placeholder="${escapeHtml(placeholder)}" value="${escapeHtml(query)}" data-input="${escapeHtml(input)}" data-side="${escapeHtml(side)}" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" enterkeyhint="search" inputmode="search" />`;
}

export function planCalcListVisibility(assets, query, matches, limit = CALC_LIST_LIMIT) {
  const needle = String(query || "").trim().toLowerCase();
  const matchFn = typeof matches === "function" ? matches : () => true;
  let shown = 0;
  const visibility = (Array.isArray(assets) ? assets : []).map((asset) => {
    const match = !needle || matchFn(asset, needle);
    const visible = Boolean(match && shown < limit);
    if (visible) shown += 1;
    return visible;
  });
  return { visibility, visibleCount: shown };
}

export function snapshotFocusedCalcSearch(doc = globalThis.document) {
  const active = doc?.activeElement;
  if (!active) return null;
  const kind = readAttr(active, "data-input");
  if (!CALC_SEARCH_INPUTS.includes(kind)) return null;
  return {
    kind,
    side: readAttr(active, "data-side") || "",
    start: active.selectionStart,
    end: active.selectionEnd ?? active.selectionStart,
  };
}

export function restoreFocusedCalcSearch(snapshot, doc = globalThis.document) {
  if (!snapshot || !doc?.querySelector) return false;
  const input = doc.querySelector(`[data-input="${snapshot.kind}"][data-side="${snapshot.side}"]`);
  if (!input) return false;
  if (typeof input.focus === "function") {
    try {
      input.focus({ preventScroll: true });
    } catch {
      input.focus();
    }
  }
  if (
    typeof input.setSelectionRange === "function"
    && snapshot.start != null
    && snapshot.end != null
  ) {
    try {
      input.setSelectionRange(snapshot.start, snapshot.end);
    } catch {
      // Some input types reject a caret range.
    }
  }
  return true;
}

export function keepCalcSearchFocused(doc, mutate, schedule) {
  const snapshot = snapshotFocusedCalcSearch(doc);
  try {
    if (typeof mutate === "function") mutate();
  } finally {
    restoreFocusedCalcSearch(snapshot, doc);
    if (!snapshot) return;
    const run = () => restoreFocusedCalcSearch(snapshot, doc);
    if (typeof schedule === "function") {
      schedule(run);
    } else if (typeof globalThis.requestAnimationFrame === "function") {
      globalThis.requestAnimationFrame(run);
    } else if (typeof globalThis.setTimeout === "function") {
      globalThis.setTimeout(run, 0);
    }
  }
}

export function shouldHoldCalcSearchFocus(event, doc = globalThis.document) {
  const item = event?.target?.closest?.(".calc-item[data-action]");
  if (!item) return false;
  const kind = readAttr(doc?.activeElement, "data-input");
  return CALC_SEARCH_INPUTS.includes(kind);
}

function readAttr(node, name) {
  if (!node) return "";
  if (typeof node.getAttribute === "function") return node.getAttribute(name) || "";
  return node.dataset ? String(node.dataset[attrToDatasetKey(name)] || "") : "";
}

function attrToDatasetKey(name) {
  return String(name || "").replace(/^data-/, "").replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}
