import { safeStorage } from "./modules/safe-storage.js";
import {
  handleBootIntent,
  keepUsernameFieldsEditable,
  mountHtmlPreservingUsernames,
  paintFindLeagueButtons,
  watchUsernameFields,
} from "./modules/boot-gate.js";
import { watchBootImport } from "./modules/boot-import.js";
import { PAGE_FILES } from "./modules/page-files.js";

const host = document.querySelector("#ui-pages");

function showBootError() {
  if (!host) return;
  host.innerHTML = `
    <section class="boot-error" role="alert">
      <h2>Page couldn’t load</h2>
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

// Production embeds the same four templates in the boot bundle. The unbuilt
// development site and older cached clients can still fetch their original URLs.
async function loadPageShells() {
  if (typeof __BUNDLED_PAGE_SHELLS__ === "string") return __BUNDLED_PAGE_SHELLS__;
  const parts = await Promise.all(PAGE_FILES.map(async (file) => {
    const response = await fetch(file);
    if (!response.ok) throw new Error(`Missing page ${file}`);
    return response.text();
  }));
  return parts.join("\n");
}

try {
  const html = await loadPageShells();
  if (!host) throw new Error("Missing #ui-pages");
  mountHtmlPreservingUsernames(host, html, document);
  armBootChrome();
} catch (err) {
  document.documentElement.removeAttribute("data-booting");
  showBootError();
  throw err;
}
await watchBootImport({
  importApp: async () => await import("./app.js"),
  host,
  onlineTarget: window,
  reload: () => location.reload(),
  storage: safeStorage("sessionStorage"),
});
document.documentElement.removeAttribute("data-booting");
