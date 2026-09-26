export const TICKER_TAP_PX = 8;

export function wrapTickerOffset(px, cycleWidth) {
  const cycle = Number(cycleWidth) || 0;
  if (cycle <= 0) return 0;
  const value = Number(px) || 0;
  return ((value % cycle) + cycle) % cycle;
}

export function tickerOffsetFromTime(timeMs, durationMs, cycleWidth) {
  const duration = Number(durationMs) || 0;
  const cycle = Number(cycleWidth) || 0;
  if (duration <= 0 || cycle <= 0) return 0;
  return wrapTickerOffset((Number(timeMs) / duration) * cycle, cycle);
}

export function tickerTimeFromOffset(px, durationMs, cycleWidth) {
  const duration = Number(durationMs) || 0;
  const cycle = Number(cycleWidth) || 0;
  if (duration <= 0 || cycle <= 0) return 0;
  return (wrapTickerOffset(px, cycle) / cycle) * duration;
}

export function isTickerTap(movedPx, threshold = TICKER_TAP_PX) {
  return Math.abs(Number(movedPx) || 0) < Number(threshold);
}

export function tickerGestureIntent(dx, dy, threshold = TICKER_TAP_PX) {
  const x = Math.abs(Number(dx) || 0);
  const y = Math.abs(Number(dy) || 0);
  const gate = Number(threshold) || 0;
  if (x < gate && y < gate) return "pending";
  if (y > x) return "scroll";
  return "scrub";
}

export function bindTicker(root, track, {
  durationSeconds = 60,
  paused = false,
  currentTime = 0,
} = {}) {
  if (!root || !track) {
    return {
      paused: Boolean(paused),
      currentTime: 0,
      destroy() {},
    };
  }

  const viewport = root.querySelector(".ticker-viewport") || root;
  const durationMs = Math.max(1000, (Number(durationSeconds) || 60) * 1000);
  let isPaused = Boolean(paused);
  let armed = false;
  let dragging = false;
  let startX = 0;
  let startY = 0;
  let startTime = 0;
  let moved = 0;
  let animation = null;

  function cycleWidth() {
    const group = track.querySelector(".ticker-group");
    return group?.getBoundingClientRect().width || 0;
  }

  function ensureAnimation() {
    const cycle = cycleWidth();
    if (!cycle) return;
    const time = animation?.currentTime ?? currentTime ?? 0;
    animation?.cancel();
    animation = track.animate(
      [
        { transform: "translateX(0px)" },
        { transform: `translateX(${-cycle}px)` },
      ],
      { duration: durationMs, iterations: Infinity, easing: "linear" },
    );
    animation.currentTime = Number(time) % durationMs;
    if (isPaused) animation.pause();
    else animation.play();
  }

  function beginScrub(event) {
    dragging = true;
    armed = false;
    if (!animation) ensureAnimation();
    startTime = animation?.currentTime || 0;
    animation?.pause();
    viewport.classList.add("is-dragging");
    try {
      viewport.setPointerCapture?.(event.pointerId);
    } catch {
      // Capture is optional.
    }
  }

  function onPointerDown(event) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    armed = true;
    dragging = false;
    moved = 0;
    startX = event.clientX;
    startY = event.clientY;
    if (event.pointerType === "mouse") beginScrub(event);
  }

  function onPointerMove(event) {
    if (!armed && !dragging) return;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    if (!dragging) {
      const intent = tickerGestureIntent(dx, dy);
      if (intent !== "scrub") {
        if (intent === "scroll") armed = false;
        return;
      }
      beginScrub(event);
    }
    moved = Math.max(moved, Math.abs(event.clientX - startX));
    const cycle = cycleWidth();
    if (!animation || !cycle) return;
    const startOffset = tickerOffsetFromTime(startTime, durationMs, cycle);
    animation.currentTime = tickerTimeFromOffset(startOffset - (event.clientX - startX), durationMs, cycle);
  }

  function finishGesture() {
    const wasActive = dragging || armed;
    const tapped = wasActive && isTickerTap(moved);
    armed = false;
    dragging = false;
    viewport.classList.remove("is-dragging");
    if (!wasActive) return;
    if (tapped) isPaused = !isPaused;
    if (!animation) ensureAnimation();
    if (isPaused) animation?.pause();
    else animation?.play();
    root.classList.toggle("is-paused", isPaused);
    root.setAttribute("aria-pressed", String(isPaused));
  }

  function onPointerUp() {
    finishGesture();
  }

  function onPointerCancel() {
    const wasDragging = dragging;
    armed = false;
    dragging = false;
    viewport.classList.remove("is-dragging");
    if (wasDragging && animation && !isPaused) animation.play();
  }

  function onPointerLeave() {
    if (!dragging) armed = false;
  }

  root.classList.add("is-bound");
  root.classList.toggle("is-paused", isPaused);
  root.setAttribute("aria-pressed", String(isPaused));
  root.title = "Tap to pause or resume. Drag to scrub.";
  ensureAnimation();
  if (!animation && typeof requestAnimationFrame === "function") {
    requestAnimationFrame(ensureAnimation);
  }

  viewport.addEventListener("pointerdown", onPointerDown);
  viewport.addEventListener("pointermove", onPointerMove);
  viewport.addEventListener("pointerup", onPointerUp);
  viewport.addEventListener("pointercancel", onPointerCancel);
  viewport.addEventListener("pointerleave", onPointerLeave);

  return {
    get paused() {
      return isPaused;
    },
    get currentTime() {
      return animation?.currentTime || 0;
    },
    destroy() {
      animation?.cancel();
      animation = null;
      viewport.removeEventListener("pointerdown", onPointerDown);
      viewport.removeEventListener("pointermove", onPointerMove);
      viewport.removeEventListener("pointerup", onPointerUp);
      viewport.removeEventListener("pointercancel", onPointerCancel);
      viewport.removeEventListener("pointerleave", onPointerLeave);
      viewport.classList.remove("is-dragging");
      root.classList.remove("is-bound", "is-paused");
    },
  };
}
