import test from "node:test";
import assert from "node:assert/strict";
import { createLivePoller, liveUpdateMatchesLeague, shouldPollLive, shouldRefreshSim, weekRowsFingerprint } from "../docs/modules/live.js";

test("shouldPollLive only when the featured week is live", () => {
  assert.equal(shouldPollLive({ currentWeekEntry: { isLive: true } }), true);
  assert.equal(shouldPollLive({ currentWeekEntry: { isLive: false } }), false);
  assert.equal(shouldPollLive(null), false);
});

test("shouldPollLive also arms on NFL windows before points post", () => {
  const model = { currentWeek: 2, finalThroughWeek: 1, seasonComplete: false, currentWeekEntry: { isLive: false } };
  assert.equal(shouldPollLive(model, { season_type: "regular" }, new Date("2026-09-13T18:00:00Z")), true);
  assert.equal(shouldPollLive(model, { season_type: "regular" }, new Date("2026-09-16T18:00:00Z")), false);
  assert.equal(shouldPollLive(model, { season_type: "pre" }, new Date("2026-09-13T18:00:00Z")), false);
  assert.equal(shouldPollLive({ ...model, seasonComplete: true }, { season_type: "regular" }, new Date("2026-09-13T18:00:00Z")), false);
});

test("sim refresh is skipped for live score ticks and fires when a week finals", () => {
  assert.equal(shouldRefreshSim({
    previousFinalThroughWeek: 1,
    nextFinalThroughWeek: 1,
    previousRemaining: 6,
    nextRemaining: 6,
  }), false);
  assert.equal(shouldRefreshSim({
    previousFinalThroughWeek: 1,
    nextFinalThroughWeek: 2,
    previousRemaining: 6,
    nextRemaining: 5,
  }), true);
});

test("weekRowsFingerprint changes when points move", () => {
  const a = new Map([[1, [{ roster_id: 1, points: 10 }]]]);
  const b = new Map([[1, [{ roster_id: 1, points: 12 }]]]);
  assert.notEqual(weekRowsFingerprint(a), weekRowsFingerprint(b));
});

test("live poller fetches scores, skips paused tabs, and rate-limits sims", async () => {
  let now = 1000;
  let fetches = 0;
  let scores = 0;
  let sims = 0;
  let hidden = false;
  const timers = [];
  const poller = createLivePoller({
    intervalMs: 30,
    simRefreshMs: 80,
    now: () => now,
    isLive: () => true,
    shouldPause: () => hidden,
    fetchUpdate: async () => {
      fetches += 1;
      return { points: fetches };
    },
    onScores: () => {
      scores += 1;
    },
    onSimRefresh: () => {
      sims += 1;
    },
    setIntervalFn: (fn, ms) => {
      const id = { fn, ms };
      timers.push(id);
      return id;
    },
    clearIntervalFn: (id) => {
      const index = timers.indexOf(id);
      if (index >= 0) timers.splice(index, 1);
    },
  });

  await poller.start();
  assert.equal(fetches, 1);
  assert.equal(scores, 1);
  assert.equal(sims, 0);

  now = 1100;
  hidden = true;
  const paused = await poller.tick();
  assert.equal(paused.reason, "paused");
  hidden = false;

  now = 1070;
  await poller.tick();
  assert.equal(sims, 0);

  now = 1000 + 80;
  await poller.tick();
  assert.equal(sims, 1);
  poller.stop();
  assert.equal(poller.running, false);
});

test("a stopped poll drops scores that arrive after the league changed", async () => {
  let release;
  let scores = 0;
  const poller = createLivePoller({
    isLive: () => true,
    fetchUpdate: () => new Promise((resolve) => {
      release = resolve;
    }),
    onScores: () => {
      scores += 1;
    },
    setIntervalFn: () => ({ id: 1 }),
    clearIntervalFn: () => {},
  });
  const started = poller.start();
  poller.stop();
  release({ leagueId: "a" });
  const result = await started;
  assert.equal(result.reason, "stopped");
  assert.equal(scores, 0);
  assert.equal(liveUpdateMatchesLeague("a", "a"), true);
  assert.equal(liveUpdateMatchesLeague("a", "b"), false);
  assert.equal(liveUpdateMatchesLeague("", "b"), false);
});
