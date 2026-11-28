import { safeStorage } from "./modules/safe-storage.js";
import {
  handleBootIntent,
  keepUsernameFieldsEditable,
  paintFindLeagueButtons,
  watchUsernameFields,
} from "./modules/boot-gate.js";
import { watchBootImport } from "./modules/boot-import.js";

const host = document.querySelector("#ui-pages");

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

await watchBootImport({
  importApp: async () => await import("./app.js"),
  host,
  onlineTarget: window,
  reload: () => location.reload(),
  storage: safeStorage("sessionStorage"),
});
document.documentElement.removeAttribute("data-booting");
