// Paint the example before app.js. The promise and skeleton are already in the HTML.
import { launchExampleMarkup } from "./modules/launch-landing.js";
import { fetchValuationBundles, getGlobalMaxPlayerValue } from "./modules/values.js";

if (document.body.classList.contains("launch-open")) {
  try {
    const bundles = await fetchValuationBundles();
    const bundle = bundles?.sf;
    const values = bundle?.values || {};
    const host = document.querySelector("#launch-example");
    if (host && Object.keys(values).length) {
      host.innerHTML = launchExampleMarkup({
        values,
        names: bundle.nameMap || {},
        players: bundles.players || {},
        globalMaxValue: getGlobalMaxPlayerValue(values),
      });
      host.setAttribute("aria-busy", "false");
    }
  } catch {
    // app.js paints the values error card if this fetch fails too.
  }
}
