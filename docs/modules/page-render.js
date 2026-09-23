// Background data (loaders, live polls, crowd votes) asks for a page render instead of
// forcing one. Asks in the same frame collapse into one render, and none lands while the
// user is typing on the page: rebuilding the field drops the caret and closes the iPad
// keyboard. A held render runs once typing stops.
export function createPageRenderQueue({ render, isTyping, schedule, cancel } = {}) {
  let frame = 0;
  let held = false;

  const run = () => {
    frame = 0;
    if (isTyping()) {
      held = true;
      return;
    }
    render();
  };

  const request = () => {
    if (isTyping()) {
      held = true;
      return;
    }
    if (!frame) frame = schedule(run) || 0;
  };

  // A render just happened for another reason, so nothing queued is still needed.
  const settle = () => {
    held = false;
    if (frame) {
      cancel(frame);
      frame = 0;
    }
  };

  const release = () => {
    if (!held || isTyping()) return;
    held = false;
    request();
  };

  return {
    request,
    settle,
    release,
    isPending: () => Boolean(frame) || held,
  };
}

export function isTextEntry(node) {
  if (!node || typeof node.tagName !== "string") return false;
  const tag = node.tagName.toUpperCase();
  if (tag === "TEXTAREA") return true;
  if (tag !== "INPUT") return Boolean(node.isContentEditable);
  const type = String(node.type || "text").toLowerCase();
  return ["text", "search", "email", "number", "tel", "url", "password"].includes(type);
}
