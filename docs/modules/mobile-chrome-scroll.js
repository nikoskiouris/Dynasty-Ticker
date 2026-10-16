// Phone top bar only. Scroll down hides it, scroll up shows it, and it stays
// put near the top. Connect my league is not part of this.

export const MOBILE_CHROME_SCROLL_DELTA = 10;
export const MOBILE_CHROME_NEAR_TOP = 48;

export function nextMobileChromeScroll({
  phone = false,
  y = 0,
  previousY = 0,
  hidden = false,
  reducedMotion = false,
} = {}) {
  const nextY = Math.max(0, Number(y) || 0);
  const prevY = Math.max(0, Number(previousY) || 0);
  const delta = nextY - prevY;
  const instant = Boolean(reducedMotion);
  if (!phone || nextY <= MOBILE_CHROME_NEAR_TOP) {
    return { hidden: false, instant, y: nextY };
  }
  let nextHidden = Boolean(hidden);
  if (delta >= MOBILE_CHROME_SCROLL_DELTA) nextHidden = true;
  else if (delta <= -MOBILE_CHROME_SCROLL_DELTA) nextHidden = false;
  return { hidden: nextHidden, instant, y: nextY };
}

export function bindMobileChromeScroll(win, {
  chrome,
  isPhone = () => false,
  prefersReducedMotion = () => false,
  phoneMedia = null,
  reduceMedia = null,
} = {}) {
  if (!win || !chrome || typeof win.addEventListener !== "function") return () => {};
  let previousY = Math.max(0, Number(win.scrollY) || 0);
  let hidden = false;
  let queued = false;
  let frame = 0;
  let lastHeight = 0;

  const paint = (state) => {
    hidden = state.hidden;
    previousY = state.y;
    chrome.classList.toggle("is-away", state.hidden);
    chrome.classList.toggle("is-instant", state.instant);
    if (state.hidden) chrome.setAttribute("inert", "");
    else chrome.removeAttribute("inert");
    const root = win.document?.documentElement;
    if (!isPhone() || !root?.style?.setProperty || !chrome.getBoundingClientRect) return;
    const height = Math.ceil(chrome.getBoundingClientRect().height || 0);
    if (height <= 0 || height === lastHeight) return;
    lastHeight = height;
    root.style.setProperty("--mobile-chrome-space", `${height}px`);
  };

  const read = () => nextMobileChromeScroll({
    phone: Boolean(isPhone()),
    y: win.scrollY,
    previousY,
    hidden,
    reducedMotion: Boolean(prefersReducedMotion()),
  });

  const schedule = () => {
    if (queued) return;
    queued = true;
    frame = win.requestAnimationFrame(() => {
      queued = false;
      frame = 0;
      paint(read());
    });
  };

  const onScroll = () => schedule();
  const onResize = () => {
    lastHeight = 0;
    schedule();
  };

  win.addEventListener("scroll", onScroll, { passive: true });
  win.addEventListener("resize", onResize);
  phoneMedia?.addEventListener?.("change", onResize);
  reduceMedia?.addEventListener?.("change", onResize);
  paint(read());

  return () => {
    win.removeEventListener("scroll", onScroll);
    win.removeEventListener("resize", onResize);
    phoneMedia?.removeEventListener?.("change", onResize);
    reduceMedia?.removeEventListener?.("change", onResize);
    if (frame && win.cancelAnimationFrame) win.cancelAnimationFrame(frame);
  };
}
