// All three destinations are always available, including before the app boots.
export function syncSiteNavigation({ tool }) {
  const nav = document.querySelector(".masthead-tools");
  if (!nav) return;
  for (const link of nav.querySelectorAll("[data-tool]")) {
    if (link.dataset.tool === tool) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
}
