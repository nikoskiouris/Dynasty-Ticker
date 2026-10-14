const FIND_IDLE = "Find my leagues";
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
