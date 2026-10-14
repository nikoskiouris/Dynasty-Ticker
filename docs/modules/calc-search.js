import { escapeHtml } from "./html.js";

export const CALC_LIST_LIMIT = 80;
export const CALC_SEARCH_INPUTS = Object.freeze(["calc-search", "value-search"]);

export function calcListDomId(side) {
  return `value-list-${side === "right" ? "right" : "left"}`;
}

export function calcOptionDomId(side, assetId, index = 0) {
  const safeSide = side === "right" ? "right" : "left";
  const safe = String(assetId || "row").replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "row";
  return `calc-opt-${safeSide}-${safe}-${index}`;
}

export function calcOptionAttrs({ side = "", assetId = "", index = 0, selected = false } = {}) {
  const id = calcOptionDomId(side, assetId, index);
  return `id="${escapeHtml(id)}" role="option" aria-selected="${selected ? "true" : "false"}"`;
}

export function renderCalcSearchInput({
  query = "",
  side = "",
  input = "calc-search",
  placeholder = "Search players and picks",
  listId = "",
  expanded = false,
  activeId = "",
} = {}) {
  const controls = listId ? ` aria-controls="${escapeHtml(listId)}"` : "";
  const active = activeId ? ` aria-activedescendant="${escapeHtml(activeId)}"` : "";
  const open = expanded ? "true" : "false";
  return `<input type="text" class="calc-search" role="combobox" aria-autocomplete="list" aria-expanded="${open}"${controls}${active} placeholder="${escapeHtml(placeholder)}" value="${escapeHtml(query)}" data-input="${escapeHtml(input)}" data-side="${escapeHtml(side)}" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" enterkeyhint="go" inputmode="search" />`;
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

export function shouldResetCalcSearchOnPick(action, { fromList = true } = {}) {
  if (action === "value-add") return true;
  if (action === "calc-toggle") return Boolean(fromList);
  return false;
}

export function clearCalcSearchBox(input) {
  if (!input) return false;
  input.value = "";
  if (typeof input.setSelectionRange === "function") {
    try {
      input.setSelectionRange(0, 0);
    } catch {
      // Some input types reject a caret range.
    }
  }
  return true;
}

export function shouldHoldCalcSearchFocus(event, doc = globalThis.document) {
  const item = event?.target?.closest?.(".calc-item[data-action]");
  if (!item) return false;
  const kind = readAttr(doc?.activeElement, "data-input");
  return CALC_SEARCH_INPUTS.includes(kind);
}

// A result row in the offer list. Click and Enter both add this row.
export function calcSuggestionItem(event) {
  return event?.target?.closest?.(".calc-item[data-action='value-add']") || null;
}

export function shouldArmCalcSuggestion(event, doc = globalThis.document) {
  const item = calcSuggestionItem(event);
  if (!item) return false;
  if (event?.pointerType === "mouse" && event.button != null && event.button !== 0) return false;
  if (shouldHoldCalcSearchFocus(event, doc)) return true;
  return Boolean(item.closest?.(".calc-suggest, .calc-list"));
}

export function calcSuggestionFromList(root, side) {
  if (!root?.querySelector) return null;
  const list = root.querySelector(`#${calcListDomId(side)}`);
  if (!list?.querySelector) return null;
  return list.querySelector(".calc-item.is-active[data-action='value-add']")
    || list.querySelector(".calc-item[data-action='value-add']");
}

export function moveCalcSuggestion(root, side, delta) {
  if (!root?.querySelectorAll) return null;
  const items = [...root.querySelectorAll(`#${calcListDomId(side)} .calc-item[data-action="value-add"]`)];
  if (!items.length) return null;
  const current = items.findIndex((item) => item.classList?.contains("is-active"));
  const step = delta < 0 ? -1 : 1;
  const next = current < 0
    ? (step > 0 ? 0 : items.length - 1)
    : (current + step + items.length) % items.length;
  items.forEach((item, index) => {
    const on = index === next;
    item.classList?.toggle("is-active", on);
    item.setAttribute?.("aria-selected", on ? "true" : "false");
  });
  return items[next];
}

export function setCalcListOpen(list, open) {
  if (!list?.classList?.toggle) return false;
  list.classList.toggle("is-closed", !open);
  return true;
}

export function syncCalcCombobox(input, { open = false, activeId = "" } = {}) {
  if (!input?.setAttribute) return false;
  input.setAttribute("aria-expanded", open ? "true" : "false");
  if (open && activeId) input.setAttribute("aria-activedescendant", activeId);
  else input.removeAttribute?.("aria-activedescendant");
  return true;
}

function clearCalcHighlight(list) {
  const items = list?.querySelectorAll?.(".calc-item");
  if (!items) return;
  [...items].forEach((item) => {
    item.classList?.toggle("is-active", false);
    item.setAttribute?.("aria-selected", "false");
  });
}

// Arrow keys move the highlight. Enter adds it. Esc closes the list.
// Focus stays on the input the whole time.
export function handleCalcComboboxKey(event, { input, list, root, side } = {}) {
  if (!event || event.isComposing || !input || !list) return { handled: false };
  const key = event.key;
  if (key === "ArrowDown" || key === "ArrowUp") {
    setCalcListOpen(list, true);
    const item = moveCalcSuggestion(root, side, key === "ArrowDown" ? 1 : -1);
    if (!item) return { handled: false };
    event.preventDefault?.();
    syncCalcCombobox(input, { open: true, activeId: item.id || "" });
    if (typeof item.scrollIntoView === "function") item.scrollIntoView({ block: "nearest" });
    return { handled: true, action: "move", item };
  }
  if (key === "Enter") {
    if (list.classList?.contains?.("is-closed")) return { handled: false };
    const item = calcSuggestionFromList(root, side);
    if (!item) return { handled: false };
    event.preventDefault?.();
    return { handled: true, action: "pick", item };
  }
  if (key === "Escape") {
    event.preventDefault?.();
    clearCalcHighlight(list);
    setCalcListOpen(list, false);
    syncCalcCombobox(input, { open: false });
    return { handled: true, action: "close" };
  }
  return { handled: false };
}

function readAttr(node, name) {
  if (!node) return "";
  if (typeof node.getAttribute === "function") return node.getAttribute(name) || "";
  return node.dataset ? String(node.dataset[attrToDatasetKey(name)] || "") : "";
}

function attrToDatasetKey(name) {
  return String(name || "").replace(/^data-/, "").replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}
