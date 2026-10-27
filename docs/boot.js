import {
  handleBootIntent,
  keepUsernameFieldsEditable,
  mountHtmlPreservingUsernames,
  paintFindLeagueButtons,
  watchUsernameFields,
} from "./modules/boot-gate.js";
import { watchBootImport } from "./modules/boot-import.js";

const PAGE_FILES = [
  "./ui/landing.html",
  "./ui/players.html",
  "./ui/trades.html",
  "./ui/league.html",
];

const host = document.querySelector("#ui-pages");

function showBootError() {
  if (!host) return;
  host.innerHTML = `
    <section class="boot-error" role="alert">
      <h2>The desk did not open</h2>
      <p>The page files did not load. Refresh and try again.</p>
      <button type="button" data-boot-refresh>Refresh</button>
    </section>
  `;
  host.querySelector("[data-boot-refresh]")?.addEventListener("click", () => location.reload());
}

function armBootChrome() {
  paintFindLeagueButtons(document, "loading");
  keepUsernameFieldsEditable(document);
}

function onBootIntent(event) {
  handleBootIntent(event, document);
}

// boot-intent.js (classic, in <head>) queues the same presses before this module loads.
document.addEventListener("submit", onBootIntent, true);
document.addEventListener("keydown", onBootIntent, true);
document.addEventListener("click", onBootIntent, true);
watchUsernameFields(document);
armBootChrome();

try {
  const parts = await Promise.all(PAGE_FILES.map(async (file) => {
    const response = await fetch(file);
    if (!response.ok) throw new Error(`Missing page ${file}`);
    return response.text();
  }));
  if (!host) throw new Error("Missing #ui-pages");
  const paintedExample = document.querySelector("#launch-example");
  const paintedHtml = paintedExample?.getAttribute("aria-busy") === "false" ? paintedExample.innerHTML : "";
  mountHtmlPreservingUsernames(host, parts.join("\n"), document);
  if (paintedHtml) {
    const nextExample = document.querySelector("#launch-example");
    if (nextExample) {
      nextExample.innerHTML = paintedHtml;
      nextExample.setAttribute("aria-busy", "false");
    }
  }
  armBootChrome();
} catch (err) {
  showBootError();
  throw err;
}
await watchBootImport({
  importApp: async () => await import("./app.js"),
  host,
  onlineTarget: window,
  reload: () => location.reload(),
  storage: sessionStorage,
});
