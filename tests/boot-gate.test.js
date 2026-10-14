import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import {
  applyBootFieldValue,
  coalesceUsernameFields,
  handleBootIntent,
  keepUsernameFieldsEditable,
  paintFindLeagueButtons,
  mountHtmlPreservingUsernames,
  queueFindForBoot,
  releaseBootGate,
  resetBootGate,
  scheduleBootFind,
} from "../docs/modules/boot-gate.js";

const app = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../docs/app.js"), "utf8");

function button(id, extra = {}) {
  const attrs = new Map();
  const node = {
    id,
    tagName: "BUTTON",
    textContent: extra.text || "Find my leagues",
    disabled: false,
    dataset: { ...(extra.dataset || {}) },
    style: {},
    setAttribute(name, value) {
      attrs.set(name, value);
      if (name === "data-boot-loading") node.dataset.bootLoading = value;
      if (name === "data-idle-label") node.dataset.idleLabel = value;
    },
    getAttribute(name) {
      return attrs.get(name) || null;
    },
    removeAttribute(name) {
      attrs.delete(name);
      if (name === "data-boot-loading") delete node.dataset.bootLoading;
    },
  };
  return node;
}

function input(id, value) {
  return {
    id,
    value,
    disabled: true,
    readOnly: true,
    removeAttribute() {
      this.disabled = false;
      this.readOnly = false;
    },
  };
}

function rootOf(nodes) {
  return {
    querySelector(selector) {
      const id = String(selector || "").replace("#", "");
      return nodes.find((node) => node.id === id) || null;
    },
    querySelectorAll(selector) {
      if (selector === "button") return nodes.filter((node) => node.tagName === "BUTTON");
      return [];
    },
  };
}

test("boot leaves a typed username alone and only fills an empty field", () => {
  const typed = input("sleeper-username", "nikos");
  assert.equal(applyBootFieldValue(typed, ""), false);
  assert.equal(typed.value, "nikos");
  assert.equal(applyBootFieldValue(typed, "other"), false);
  assert.equal(typed.value, "nikos");
  const empty = input("league-id", "");
  assert.equal(applyBootFieldValue(empty, ""), false);
  assert.equal(empty.value, "");
  assert.equal(applyBootFieldValue(empty, "1315"), true);
  assert.equal(empty.value, "1315");
});

test("find buttons stay loading and username boxes stay editable until boot ends", () => {
  resetBootGate();
  const find = button("find-leagues-btn", { dataset: { idleLabel: "Find my leagues" } });
  const landing = button("landing-find-btn");
  const sticky = button("sticky-find-btn");
  const banner = button("sample-find", { dataset: { action: "find-my-leagues" }, text: "Find my leagues" });
  const name = input("sleeper-username", "kept");
  const landingName = input("landing-username", "");
  const root = rootOf([find, landing, sticky, banner, name, landingName]);
  paintFindLeagueButtons(root, "loading");
  keepUsernameFieldsEditable(root);
  for (const node of [find, landing, sticky, banner]) {
    assert.equal(node.disabled, false);
    assert.equal(node.getAttribute("disabled"), null);
    assert.equal(node.getAttribute("aria-disabled"), "true");
    assert.equal(node.getAttribute("aria-busy"), "true");
    assert.equal(node.style.pointerEvents, "");
    assert.equal(node.textContent, "Loading…");
  }
  assert.equal(name.disabled, false);
  assert.equal(name.readOnly, false);
  assert.equal(name.value, "kept");
  name.value = "typed-during-load";
  const queued = handleBootIntent({
    type: "keydown",
    key: "Enter",
    target: name,
    preventDefault() { this.defaultPrevented = true; },
  }, root);
  assert.equal(queued, true);
  assert.equal(queueFindForBoot(), true);
  landingName.value = "";
  const run = releaseBootGate(root);
  assert.deepEqual(run, { username: "typed-during-load" });
  for (const node of [find, landing, sticky, banner]) {
    assert.equal(node.disabled, false);
    assert.equal(node.getAttribute("aria-disabled"), "false");
    assert.equal(node.getAttribute("aria-busy"), null);
    assert.equal(node.textContent, "Find my leagues");
  }
  assert.equal(name.value, "typed-during-load");
  assert.equal(landingName.value, "typed-during-load");
  assert.equal(handleBootIntent({ type: "submit", target: root, preventDefault() {} }, root), false);
});

test("a find click or form submit during boot is queued once", () => {
  resetBootGate();
  const find = button("find-leagues-btn", { dataset: { idleLabel: "Find my leagues", bootLoading: "1" } });
  find.setAttribute("data-boot-loading", "1");
  find.getBoundingClientRect = () => ({ left: 0, top: 0, right: 40, bottom: 20 });
  const form = {
    tagName: "FORM",
    querySelectorAll() { return [find]; },
  };
  const root = rootOf([find]);
  let prevented = 0;
  const submit = handleBootIntent({
    type: "submit",
    target: form,
    preventDefault() { prevented += 1; },
  }, root);
  const click = handleBootIntent({
    type: "click",
    target: { id: "under" },
    clientX: 10,
    clientY: 10,
    preventDefault() { prevented += 1; },
    stopPropagation() {},
  }, root);
  assert.equal(submit, true);
  assert.equal(click, true);
  assert.equal(prevented, 2);
  assert.deepEqual(releaseBootGate(root), { username: "" });
  assert.equal(releaseBootGate(root), null);
});

test("a press during boot keeps the typed name even if the field is cleared", () => {
  resetBootGate();
  const name = input("landing-username", "earlyname");
  const rail = input("sleeper-username", "");
  const root = rootOf([name, rail, button("landing-find-btn")]);
  const queued = handleBootIntent({
    type: "keydown",
    key: "Enter",
    target: name,
    preventDefault() {},
  }, root);
  assert.equal(queued, true);
  name.value = "";
  const run = releaseBootGate(root);
  assert.deepEqual(run, { username: "earlyname" });
  assert.equal(name.value, "earlyname");
  assert.equal(rail.value, "earlyname");
});

test("a search queued during boot runs after init without a TDZ throw", async () => {
  resetBootGate();
  const name = input("sleeper-username", "queued");
  const root = rootOf([name, button("find-leagues-btn", { dataset: { idleLabel: "Find my leagues" } })]);
  assert.equal(handleBootIntent({
    type: "submit",
    target: {
      tagName: "FORM",
      querySelectorAll() { return [root.querySelector("#find-leagues-btn")]; },
      querySelector(selector) {
        return selector === "#sleeper-username" ? name : null;
      },
    },
    preventDefault() {},
  }, root), true);
  const queued = releaseBootGate(root);
  assert.deepEqual(queued, { username: "queued" });
  let threw = null;
  let ran = false;
  scheduleBootFind(() => {
    try {
      ran = missedLeagueSeasons.length >= 0;
    } catch (err) {
      threw = err;
    }
  });
  let missedLeagueSeasons = [];
  assert.equal(ran, false);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(threw, null);
  assert.equal(ran, true);
  const init = app.slice(0, app.indexOf("function visibleRooms"));
  const releaseAt = init.lastIndexOf("releaseBootGate(document)");
  const tail = init.slice(releaseAt, releaseAt + 220);
  assert.match(tail, /scheduleBootFind\(\(\) => requestFindLeagues\(\)\)/);
  assert.ok(app.indexOf("let missedLeagueSeasons") < releaseAt);
  assert.equal(app.indexOf("if (runQueuedFind) requestFindLeagues()"), -1);
});

test("boot-intent queues Enter and a click before app.js loads", () => {
  const inputNode = { id: "sleeper-username", value: "early", tagName: "INPUT" };
  const buttonNode = {
    id: "find-leagues-btn",
    tagName: "BUTTON",
    getAttribute(attr) {
      return attr === "data-idle-label" ? "Find my leagues" : null;
    },
    closest() { return this; },
  };
  const listeners = [];
  const documentStub = {
    addEventListener(type, fn) { listeners.push({ type, fn }); },
    querySelector(selector) {
      return selector === "#sleeper-username" ? inputNode : null;
    },
  };
  const sandbox = { document: documentStub };
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../docs/boot-intent.js"), "utf8"), sandbox);
  let prevented = 0;
  listeners.find((row) => row.type === "keydown").fn({
    key: "Enter",
    target: inputNode,
    preventDefault() { prevented += 1; },
  });
  assert.equal(sandbox.__dynastyBootFind.queued, true);
  assert.equal(sandbox.__dynastyBootFind.username, "early");
  inputNode.value = "";
  listeners.find((row) => row.type === "click").fn({
    target: buttonNode,
    preventDefault() { prevented += 1; },
    stopPropagation() {},
  });
  assert.equal(prevented, 2);
  assert.equal(sandbox.__dynastyBootFind.username, "early");
  const index = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../docs/index.html"), "utf8");
  const intentAt = index.indexOf('src="./boot-intent.js"');
  const bootAt = index.indexOf('src="./boot.js"');
  assert.ok(intentAt > 0 && intentAt < bootAt);
});

test("app boot does not clear the username and does not fetch values before the gate opens", () => {
  const bootFn = app.slice(app.indexOf("function bootFromUrl"), app.indexOf("function currentDeskSnapshot"));
  assert.match(bootFn, /applyBootFieldValue/);
  assert.doesNotMatch(bootFn, /el\.sleeperUsername\.value\s*=/);
  assert.doesNotMatch(bootFn, /el\.landingUsername\.value\s*=/);
  const rather = app.slice(app.indexOf("async function bootLandingRather"), app.indexOf("async function loadRatherPromptContext"));
  assert.match(rather, /ensureValuesLoaded/);
  assert.doesNotMatch(rather, /fetchValuationBundles/);
  const init = app.slice(0, app.indexOf("function visibleRooms"));
  const releaseAt = init.lastIndexOf("releaseBootGate(document)");
  const ratherAt = init.lastIndexOf("void bootLandingRather()");
  assert.ok(releaseAt > ratherAt);
});

test("blank username fields are not wiped when boot coalesces them", () => {
  const rail = input("sleeper-username", "");
  const landing = input("landing-username", "");
  coalesceUsernameFields(rootOf([rail, landing]));
  assert.equal(rail.value, "");
  assert.equal(landing.value, "");
});

test("a landing re-render keeps the typed username, focus, and caret", () => {
  const nodes = {};
  const root = {
    activeElement: null,
    querySelector(selector) {
      return nodes[String(selector || "").replace("#", "")] || null;
    },
  };
  function field(id, value) {
    const node = input(id, value);
    node.selectionStart = String(value).length;
    node.selectionEnd = String(value).length;
    node.remove = () => {
      if (nodes[id] === node) delete nodes[id];
      if (root.activeElement === node) root.activeElement = null;
    };
    node.replaceWith = (next) => {
      nodes[id] = next;
    };
    node.focus = () => {
      root.activeElement = node;
    };
    node.setSelectionRange = (start, end) => {
      node.selectionStart = start;
      node.selectionEnd = end;
    };
    nodes[id] = node;
    return node;
  }
  const landing = field("landing-username", "nikos");
  landing.selectionStart = 2;
  landing.selectionEnd = 2;
  root.activeElement = landing;
  const rail = field("sleeper-username", "");
  const host = {
    contains(node) {
      return node === landing;
    },
    set innerHTML(_html) {
      field("landing-username", "");
    },
  };
  mountHtmlPreservingUsernames(host, "<section id=\"landing\"></section>", root);
  assert.equal(nodes["landing-username"], landing);
  assert.equal(landing.value, "nikos");
  assert.equal(landing.selectionStart, 2);
  assert.equal(landing.selectionEnd, 2);
  assert.equal(root.activeElement, landing);
  assert.equal(rail.value, "nikos");
  const boot = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../docs/boot.js"), "utf8");
  assert.match(boot, /mountHtmlPreservingUsernames\(host, parts\.join/);
  assert.match(boot, /watchUsernameFields\(document\)/);
  assert.match(app, /function rebindUsernameInputs/);
});

test("a landing re-render keeps a name typed in the rail username box", () => {
  const nodes = {};
  const root = {
    activeElement: null,
    querySelector(selector) {
      return nodes[String(selector || "").replace("#", "")] || null;
    },
  };
  const rail = input("sleeper-username", "early");
  rail.selectionStart = 5;
  rail.selectionEnd = 5;
  nodes["sleeper-username"] = rail;
  root.activeElement = rail;
  const host = {
    contains() {
      return false;
    },
    set innerHTML(_html) {
      nodes["landing-username"] = input("landing-username", "");
    },
  };
  mountHtmlPreservingUsernames(host, "<input id=\"landing-username\">", root);
  assert.equal(nodes["landing-username"].value, "early");
  assert.equal(rail.value, "early");
  assert.equal(root.activeElement, rail);
});
