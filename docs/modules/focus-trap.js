// Keyboard helpers for the phone drawer, ranks dialog, and league pick.

export function isKeyboardActivation(event) {
  if (!event) return false;
  if (event.key === "Enter" || event.key === " ") return true;
  return event.type === "click" && Number(event.detail) === 0;
}

// Where Tab should go to stay inside an open drawer or dialog.
// null means the browser can move to the next control inside the list.
export function tabWrapTarget(nodes, active, shiftKey) {
  const list = Array.isArray(nodes) ? nodes.filter(Boolean) : [];
  if (!list.length) return null;
  const index = list.indexOf(active);
  if (index < 0) return shiftKey ? list[list.length - 1] : list[0];
  if (shiftKey && index === 0) return list[list.length - 1];
  if (!shiftKey && index === list.length - 1) return list[0];
  return null;
}
