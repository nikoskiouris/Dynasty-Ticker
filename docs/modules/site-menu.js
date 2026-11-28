// All three destinations are always available, including before the app boots.
export function syncSiteNavigation({ tool, leagueId = "" }) {
  const nav = document.querySelector(".masthead-tools");
  if (!nav) return;
  for (const link of nav.querySelectorAll("[data-tool]")) {
    if (link.dataset.tool === tool) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
    if (link.dataset.tool === "leagues") link.href = leagueId ? `/l/${encodeURIComponent(leagueId)}` : "/leagues";
  }
}
