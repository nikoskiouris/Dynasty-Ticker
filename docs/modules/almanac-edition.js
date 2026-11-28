import { escapeHtml as e } from "./html.js";
import { leagueStories } from "./league-stories.js";

// Split a number from its unit to set the figure like a printed scorecard.
function scoreFigure(stat) {
  const [value, ...unit] = String(stat || "").split(" ");
  return `<div class="almanac-figure${value.length > 5 ? " almanac-long-figure" : ""}">
    <strong>${e(value)}</strong>${unit.length ? `<span>${e(unit.join(" "))}</span>` : ""}
  </div>`;
}

const CHAPTER_LABELS = {
  champions: "Champions wall", rivalries: "Head to head", standings: "All-time standings",
  trends: "League trends", records: "Record book",
};

export function renderAlmanacStory(story, { leagueName, leagueId, lead = false } = {}) {
  const matchup = story.matchup ? `?${new URLSearchParams({ matchup: story.matchup })}` : "";
  const recordHref = leagueId && CHAPTER_LABELS[story.section]
    ? `/l/${encodeURIComponent(leagueId)}/history${matchup}#archive-${story.section}` : "";
  const receipt = [leagueName, story.headline, story.detail, story.source].filter(Boolean).join("\n");
  return `<article class="almanac-story${lead ? " almanac-lead" : ""}">
    ${scoreFigure(story.stat)}
    <div class="almanac-story-copy">
      <p class="almanac-category">${e(story.category)}</p>
      <h3>${e(story.headline)}</h3>
      <p class="almanac-story-detail">${e(story.detail)}</p>
      <p class="almanac-source">${e(story.source)}</p>
      <div class="almanac-actions">
        <button type="button" data-action="copy-almanac-receipt" data-almanac-receipt="${e(receipt)}"${story.section ? ` data-receipt-chapter="archive-${e(story.section)}"` : ""}${story.matchup ? ` data-receipt-matchup="${e(story.matchup)}"` : ""}>Copy for the group chat</button>
        ${recordHref ? `<a href="${e(recordHref)}">${CHAPTER_LABELS[story.section]} <span aria-hidden="true">↗</span></a>` : ""}
        <span class="almanac-copy-status" role="status"></span>
      </div>
    </div>
  </article>`;
}

export function renderAlmanacMasthead({ leagueName, subtitle, edition, avatar = "" }) {
  return `<header class="almanac-masthead">
    <div class="almanac-dateline"><span>League Almanac</span><span>${e(edition)}</span></div>
    <div class="almanac-masthead-title">
      ${avatar ? `<img alt="" width="54" height="54" src="https://sleepercdn.com/avatars/thumbs/${encodeURIComponent(avatar)}">` : ""}
      <h2>${e(leagueName)}</h2>
    </div>
    ${subtitle ? `<p>${e(subtitle)}</p>` : ""}
  </header>`;
}

export function renderAlmanacEdition({ archive, leagueName, range, savedNote = "", caveat = "", openStories = false }) {
  const stories = leagueStories(archive);
  const [lead, ...more] = stories;
  const renderStory = (story, featured = false) => renderAlmanacStory(story, {
    leagueName,
    leagueId: archive.leagueId,
    lead: featured,
  });
  return `${renderAlmanacMasthead({ leagueName, subtitle: range, edition: "Record book", avatar: archive.seasons?.[0]?.league?.avatar })}
    ${savedNote ? `<p class="league-saved-note" role="status">${e(savedNote)}</p>` : ""}
    ${lead ? renderStory(lead, true) : `<p class="almanac-empty">No headline yet from the available results. You can browse the season records below.</p>`}
    ${more.length ? `<section class="almanac-dispatches" aria-label="More league stories">
      <h2>More from the league</h2>
      <div class="almanac-stories">${more.slice(0, 2).map(story => renderStory(story)).join("")}</div>
      ${more.length > 2 ? `<details class="almanac-more-stories"${openStories ? " open" : ""}><summary>Read ${more.length - 2} more ${more.length === 3 ? "story" : "stories"}</summary>
        <div class="almanac-stories">${more.slice(2).map(story => renderStory(story)).join("")}</div></details>` : ""}
    </section>` : ""}
    ${caveat ? `<p class="muted small calc-market-caveat">${e(caveat)}</p>` : ""}`;
}
