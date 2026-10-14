const FIND_IDLE = "Find my leagues";
const USERNAME_IDS = ["sleeper-username", "landing-username"];

let bootPending = true;
let bootQueued = false;

export function bootIsPending() {
  return bootPending;
}

export function queueFindForBoot() {
  if (!bootPending) return false;
  bootQueued = true;
  return true;
}

export function resetBootGate() {
  bootPending = true;
  bootQueued = false;
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
    button.disabled = loading;
    button.setAttribute?.("aria-disabled", loading ? "true" : "false");
    if (loading) {
      button.setAttribute?.("aria-busy", "true");
      button.setAttribute?.("data-boot-loading", "1");
      if (button.style) button.style.pointerEvents = "none";
      button.textContent = "Loading…";
    } else {
      button.removeAttribute?.("aria-busy");
      button.removeAttribute?.("data-boot-loading");
      if (button.style) button.style.pointerEvents = "";
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
  if (!bootPending || !event) return false;
  if (event.type === "submit") {
    if (!collectFindLeagueButtons(event.target).length) return false;
    event.preventDefault?.();
    bootQueued = true;
    return true;
  }
  if (event.type === "keydown") {
    if (event.key !== "Enter") return false;
    if (!USERNAME_IDS.includes(event.target?.id)) return false;
    event.preventDefault?.();
    bootQueued = true;
    return true;
  }
  if (event.type === "click") {
    if (!clickHitsFindButton(event, root)) return false;
    event.preventDefault?.();
    event.stopPropagation?.();
    bootQueued = true;
    return true;
  }
  return false;
}

export function releaseBootGate(root) {
  const run = bootQueued;
  bootPending = false;
  bootQueued = false;
  if (root) {
    coalesceUsernameFields(root);
    paintFindLeagueButtons(root, "ready");
    keepUsernameFieldsEditable(root);
  }
  return run;
}
