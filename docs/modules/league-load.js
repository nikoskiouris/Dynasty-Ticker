// One league load at a time. A newer request waits, then runs.
// A request squeezed between two others never loads.

export function createLeagueLoader() {
  let serial = 0;
  let latestId = "";
  let inFlight = null;
  let inFlightOptions = null;

  return {
    isCurrent(token) {
      return token === serial;
    },

    run(leagueId, load, options = {}) {
      const id = String(leagueId || "");
      if (!id) return Promise.resolve();
      if (inFlight && latestId === id) {
        if (options.fromHistory && inFlightOptions) inFlightOptions.fromHistory = true;
        return inFlight;
      }

      latestId = id;
      const token = ++serial;
      const requestOptions = { fromHistory: Boolean(options.fromHistory) };
      inFlightOptions = requestOptions;
      const previous = inFlight;
      const job = (async () => {
        if (previous) {
          try {
            await previous;
          } catch {
            // The earlier load already reported its own failure.
          }
        }
        if (token !== serial) return;
        await load(id, token, requestOptions);
      })();

      const tracked = job.finally(() => {
        if (inFlight === tracked) inFlight = null;
      });
      inFlight = tracked;
      return tracked;
    },
  };
}
