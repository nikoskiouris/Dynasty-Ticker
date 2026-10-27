// Paint the example after the first frame. A top-level fetch of the values
// file holds the document load until that download finishes.
function afterFirstPaint(fn) {
  const run = () => {
    try {
      fn();
    } catch {
      // app.js paints the values error card if this fetch fails too.
    }
  };
  if (typeof requestAnimationFrame !== "function") {
    run();
    return;
  }
  requestAnimationFrame(() => {
    if (typeof requestIdleCallback === "function") requestIdleCallback(run, { timeout: 1200 });
    else requestAnimationFrame(run);
  });
}

if (document.body.classList.contains("launch-open")) {
  afterFirstPaint(() => {
    void (async () => {
      try {
        const { launchExampleMarkup } = await import("./modules/launch-landing.js");
        const { fetchValuationBundles, getGlobalMaxPlayerValue } = await import("./modules/values.js");
        const bundles = await fetchValuationBundles();
        const bundle = bundles?.sf;
        const values = bundle?.values || {};
        const host = document.querySelector("#launch-example");
        if (!host || host.getAttribute("aria-busy") === "false" || !Object.keys(values).length) return;
        host.innerHTML = launchExampleMarkup({
          values,
          names: bundle.nameMap || {},
          players: bundles.players || {},
          globalMaxValue: getGlobalMaxPlayerValue(values),
        });
        host.setAttribute("aria-busy", "false");
      } catch {
        // app.js paints the values error card if this fetch fails too.
      }
    })();
  });
}
