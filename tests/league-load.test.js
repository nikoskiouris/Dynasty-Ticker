import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createLeagueLoader } from "../docs/modules/league-load.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const app = readFileSync(join(root, "docs/app.js"), "utf8");

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

test("a second league request is not dropped", async () => {
  const loader = createLeagueLoader();
  const loaded = [];
  const gates = { a: deferred(), b: deferred() };

  const first = loader.run("league-a", async (id) => {
    loaded.push(`start:${id}`);
    await gates.a.promise;
    loaded.push(`done:${id}`);
  });
  const second = loader.run("league-b", async (id) => {
    loaded.push(`start:${id}`);
    await gates.b.promise;
    loaded.push(`done:${id}`);
  });

  assert.notEqual(first, second);
  gates.a.resolve();
  await first;
  assert.deepEqual(loaded, ["start:league-a", "done:league-a", "start:league-b"]);
  gates.b.resolve();
  await second;
  assert.deepEqual(loaded, ["start:league-a", "done:league-a", "start:league-b", "done:league-b"]);
});

test("the same league joins the load already running", async () => {
  const loader = createLeagueLoader();
  let runs = 0;
  const gate = deferred();
  const load = () => loader.run("league-a", async () => {
    runs += 1;
    await gate.promise;
  });

  const first = load();
  const second = load();
  assert.equal(first, second);
  gate.resolve();
  await first;
  assert.equal(runs, 1);
});

test("a request squeezed between two others never loads", async () => {
  const loader = createLeagueLoader();
  const loaded = [];
  const gates = { a: deferred(), c: deferred() };

  const first = loader.run("league-a", async (id, token) => {
    await gates.a.promise;
    if (!loader.isCurrent(token)) return;
    loaded.push(id);
  });
  const middle = loader.run("league-b", async (id, token) => {
    if (!loader.isCurrent(token)) return;
    loaded.push(id);
  });
  const last = loader.run("league-c", async (id, token) => {
    await gates.c.promise;
    if (!loader.isCurrent(token)) return;
    loaded.push(id);
  });

  gates.a.resolve();
  await first;
  await middle;
  gates.c.resolve();
  await last;
  assert.deepEqual(loaded, ["league-c"]);
});

test("a failed load does not block the next league", async () => {
  const loader = createLeagueLoader();
  const loaded = [];
  await loader.run("league-a", async () => {
    throw new Error("sleeper down");
  }).catch(() => {});
  await loader.run("league-b", async (id) => {
    loaded.push(id);
  });
  assert.deepEqual(loaded, ["league-b"]);
});

test("desk uses the league loader and drops stale player refreshes", () => {
  assert.match(app, /createLeagueLoader/);
  assert.match(app, /leagueLoader\.run\(leagueId,/);
  assert.doesNotMatch(app, /if \(leagueLoadPromise\) return leagueLoadPromise/);
  assert.match(app, /if \(!leagueLoader\.isCurrent\(token\)\) return/);
});
