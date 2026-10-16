const FIND_IDLE = "Connect my league";
const USERNAME_IDS = ["sleeper-username", "landing-username"];

// Shared with docs/boot-intent.js, which runs before this module downloads.
function bootBag() {
  const host = globalThis;
  if (!host.__dynastyBootFind) {
    host.__dynastyBootFind = { pending: true, queued: false, username: "" };
  }
  return host.__dynastyBootFind;
}

export function bootIsPending() {
  return bootBag().pending;
}

export function queueFindForBoot(username) {
  const bag = bootBag();
  if (!bag.pending) return false;
  bag.queued = true;
  const name = String(username ?? "").trim();
  if (name) bag.username = name;
  return true;
}

export function resetBootGate() {
  const bag = bootBag();
  bag.pending = true;
  bag.queued = false;
  bag.username = "";
}

// Runs after the current module finishes evaluating, so later `let` bindings exist.
export function scheduleBootFind(run) {
  if (typeof queueMicrotask === "function") queueMicrotask(run);
  else setTimeout(run, 0);
}

export function isFindLeagueButton(button) {
  if (!button || typeof button !== "object") return false;
  const tag = button.tagName ? String(button.tagName).toUpperCase() : "";
  if (tag && tag !== "BUTTON") return false;
  const action = button.dataset?.action || button.getAttribute?.("data-action") || "";
  if (action === "find-my-leagues") return true;
  const id = button.id || "";
  if (id === "find-leagues-btn" || id === "landing-find-btn" || id === "sticky-find-btn") return true;
  const idle = button.dataset?.idleLabel || button.getAttribute?.("data-idle-label") || "";
  return idle === FIND_IDLE;
}

export function collectFindLeagueButtons(root) {
  const nodes = root?.querySelectorAll?.("button") || [];
  return [...nodes].filter(isFindLeagueButton);
}

function buttonIdleLabel(button) {
  const idle = button.dataset?.idleLabel || button.getAttribute?.("data-idle-label") || "";
  if (idle) return idle;
  const text = String(button.textContent || "").trim();
  return text && text !== "Loading…" ? text : FIND_IDLE;
}

export function paintFindLeagueButtons(root, mode) {
  const loading = mode === "loading";
  collectFindLeagueButtons(root).forEach((button) => {
    const idle = buttonIdleLabel(button);
    if (button.dataset) button.dataset.idleLabel = idle;
    else button.setAttribute?.("data-idle-label", idle);
    // aria-disabled keeps the button clickable. The disabled attribute swallows the press.
    button.disabled = false;
    button.removeAttribute?.("disabled");
    if (button.style) button.style.pointerEvents = "";
    button.setAttribute?.("aria-disabled", loading ? "true" : "false");
    if (loading) {
      button.setAttribute?.("aria-busy", "true");
      button.setAttribute?.("data-boot-loading", "1");
      button.textContent = "Loading…";
    } else {
      button.removeAttribute?.("aria-busy");
      button.removeAttribute?.("data-boot-loading");
      button.textContent = idle;
    }
  });
}

export function keepUsernameFieldsEditable(root) {
  USERNAME_IDS.forEach((id) => {
    const input = root?.querySelector?.(`#${id}`);
    if (!input) return;
    input.disabled = false;
    input.readOnly = false;
    input.removeAttribute?.("disabled");
    input.removeAttribute?.("readonly");
  });
}

// Boot may only fill an empty box. A name the visitor already typed stays.
export function applyBootFieldValue(input, nextValue) {
  if (!input) return false;
  if (String(input.value || "").length) return false;
  const next = String(nextValue || "");
  if (!next) return false;
  input.value = next;
  return true;
}

export function coalesceUsernameFields(root) {
  const landing = root?.querySelector?.("#landing-username");
  const rail = root?.querySelector?.("#sleeper-username");
  const landingValue = String(landing?.value || "");
  const railValue = String(rail?.value || "");
  if (landingValue.trim() && !railValue.trim() && rail) rail.value = landingValue;
  else if (railValue.trim() && !landingValue.trim() && landing) landing.value = railValue;
}

function usernameField(root, id) {
  return root?.querySelector?.(`#${id}`) || null;
}

function caretOf(input) {
  const value = String(input?.value || "");
  const start = Number(input?.selectionStart);
  const end = Number(input?.selectionEnd);
  return {
    value,
    start: Number.isFinite(start) ? start : value.length,
    end: Number.isFinite(end) ? end : value.length,
  };
}

function placeCaret(input, start, end) {
  if (!input) return;
  const value = String(input.value || "");
  const nextStart = Number.isFinite(start) ? start : value.length;
  const nextEnd = Number.isFinite(end) ? end : value.length;
  try {
    input.setSelectionRange?.(nextStart, nextEnd);
  } catch {
    // Some input types refuse a caret. The value still sticks.
  }
}

// Read every username box before a render destroys the node.
export function captureUsernameControls(root) {
  const fields = {};
  const active = root?.activeElement;
  let focusedId = "";
  let remembered = "";
  USERNAME_IDS.forEach((id) => {
    const input = usernameField(root, id);
    if (!input) return;
    const caret = caretOf(input);
    fields[id] = caret;
    if (active === input) {
      focusedId = id;
      if (caret.value) remembered = caret.value;
    } else if (!remembered && caret.value) remembered = caret.value;
  });
  return { fields, focusedId, remembered };
}

function rememberedValue(snap, id) {
  const own = snap?.fields?.[id]?.value || "";
  if (own) return own;
  return snap?.remembered || "";
}

// Put the typed name back on whatever input the render just created.
export function restoreUsernameControls(root, snap) {
  if (!root || !snap) return;
  USERNAME_IDS.forEach((id) => {
    const input = usernameField(root, id);
    if (!input) return;
    const had = String(input.value || "");
    const next = had || rememberedValue(snap, id);
    if (!had && next) input.value = next;
    if (!had && next && snap.focusedId === id) {
      const caret = snap.fields?.[id] || {};
      input.focus?.();
      placeCaret(input, caret.start, caret.end);
    }
  });
}

// Swap markup without dropping a username the visitor already typed.
export function mountHtmlPreservingUsernames(host, html, root = globalThis.document) {
  const snap = captureUsernameControls(root);
  const held = new Map();
  USERNAME_IDS.forEach((id) => {
    const node = usernameField(root, id);
    if (!node || !host?.contains?.(node)) return;
    const caret = caretOf(node);
    held.set(id, { node, ...caret });
    node.remove?.();
  });
  if (host) host.innerHTML = html;
  held.forEach((saved, id) => {
    const fresh = usernameField(root, id);
    if (fresh && fresh !== saved.node) fresh.replaceWith?.(saved.node);
    if (snap.focusedId === id) {
      saved.node.focus?.();
      placeCaret(saved.node, saved.start, saved.end);
    }
  });
  restoreUsernameControls(root, snap);
}

function harvestUsernameNode(node, snap, touched) {
  if (!node || node.nodeType !== 1) return;
  const take = (input) => {
    if (!USERNAME_IDS.includes(input?.id)) return;
    const caret = caretOf(input);
    snap.fields[input.id] = caret;
    if (caret.value) snap.remembered = caret.value;
    touched?.add(input.id);
  };
  take(node);
  const nested = node.querySelectorAll?.("input") || [];
  [...nested].forEach(take);
}

// Any later render that throws the input away still owes the visitor that name.
export function watchUsernameFields(root) {
  const bag = bootBag();
  if (!root || bag.usernameWatch || typeof root.addEventListener !== "function") return;
  bag.usernameWatch = true;
  bag.drafts = bag.drafts || {};
  const remember = (input) => {
    if (!input || !USERNAME_IDS.includes(input.id)) return;
    const caret = caretOf(input);
    bag.drafts[input.id] = caret;
    if (caret.value) bag.remembered = caret.value;
    bag.focusedId = input.id;
  };
  root.addEventListener("input", (event) => remember(event?.target), true);
  root.addEventListener("focusin", (event) => {
    if (USERNAME_IDS.includes(event?.target?.id)) bag.focusedId = event.target.id;
  }, true);
  const target = root.documentElement || (root.nodeType === 1 ? root : null);
  if (!target || typeof MutationObserver !== "function") return;
  const observer = new MutationObserver((records) => {
    const snap = {
      fields: { ...(bag.drafts || {}) },
      focusedId: bag.focusedId || "",
      remembered: bag.remembered || "",
    };
    const touched = new Set();
    records.forEach((record) => {
      record.removedNodes?.forEach((node) => harvestUsernameNode(node, snap, touched));
    });
    if (!touched.size) return;
    bag.drafts = { ...bag.drafts, ...snap.fields };
    if (snap.remembered) bag.remembered = snap.remembered;
    touched.forEach((id) => {
      const live = usernameField(root, id);
      const saved = snap.fields[id];
      if (!live || !saved || String(live.value || "").length || !saved.value) return;
      live.value = saved.value;
      if ((bag.focusedId || snap.focusedId) === id) {
        live.focus?.();
        placeCaret(live, saved.start, saved.end);
      }
    });
  });
  observer.observe(target, { childList: true, subtree: true });
}

function usernameNear(event, root) {
  const target = event?.target;
  if (target && USERNAME_IDS.includes(target.id)) return String(target.value || "");
  const form = target?.tagName === "FORM" ? target : target?.closest?.("form");
  const scopes = [form, root].filter(Boolean);
  for (const scope of scopes) {
    for (const id of USERNAME_IDS) {
      const input = scope.querySelector?.(`#${id}`);
      const value = String(input?.value || "").trim();
      if (value) return value;
    }
  }
  return "";
}

function clickHitsFindButton(event, root) {
  const path = typeof event?.composedPath === "function" ? event.composedPath() : [];
  for (const node of path) {
    if (isFindLeagueButton(node)) return node;
  }
  const closest = event?.target?.closest?.("button");
  if (isFindLeagueButton(closest)) return closest;
  if (isFindLeagueButton(event?.target)) return event.target;
  if (event?.clientX == null || event?.clientY == null) return null;
  for (const button of collectFindLeagueButtons(root)) {
    const loading = button.dataset?.bootLoading === "1" || button.getAttribute?.("data-boot-loading") === "1";
    if (!loading) continue;
    const box = button.getBoundingClientRect?.();
    if (!box) continue;
    const x = event.clientX;
    const y = event.clientY;
    if (x >= box.left && x <= box.right && y >= box.top && y <= box.bottom) return button;
  }
  return null;
}

export function handleBootIntent(event, root = globalThis.document) {
  if (!bootBag().pending || !event) return false;
  if (event.type === "submit") {
    if (!collectFindLeagueButtons(event.target).length) return false;
    event.preventDefault?.();
    queueFindForBoot(usernameNear(event, root));
    return true;
  }
  if (event.type === "keydown") {
    if (event.key !== "Enter") return false;
    if (!USERNAME_IDS.includes(event.target?.id)) return false;
    event.preventDefault?.();
    queueFindForBoot(usernameNear(event, root));
    return true;
  }
  if (event.type === "click") {
    if (!clickHitsFindButton(event, root)) return false;
    event.preventDefault?.();
    event.stopPropagation?.();
    queueFindForBoot(usernameNear(event, root));
    return true;
  }
  return false;
}

function writeQueuedUsername(root, username) {
  const name = String(username || "").trim();
  if (!name) return;
  USERNAME_IDS.forEach((id) => {
    const input = root?.querySelector?.(`#${id}`);
    if (!input || String(input.value || "").trim()) return;
    input.value = name;
  });
}

export function releaseBootGate(root) {
  const bag = bootBag();
  const queued = bag.queued;
  const username = bag.username;
  bag.pending = false;
  bag.queued = false;
  bag.username = "";
  if (root) {
    if (queued) writeQueuedUsername(root, username);
    coalesceUsernameFields(root);
    paintFindLeagueButtons(root, "ready");
    keepUsernameFieldsEditable(root);
  }
  return queued ? { username } : null;
}
