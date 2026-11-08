import test from "node:test";
import assert from "node:assert/strict";
import { safeStorage } from "../docs/modules/safe-storage.js";
import { readStoredDraft, writeStoredDraft } from "../docs/modules/trade-draft.js";
import { readStorageNoticeDismissed } from "../docs/modules/site.js";

// Safari "Block all cookies" throws on the getter itself.
function withThrowingStorage(fn) {
  const saved = {};
  for (const name of ["localStorage", "sessionStorage"]) {
    saved[name] = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, {
      configurable: true,
      get() { throw new Error("SecurityError: denied"); },
    });
  }
  try {
    return fn();
  } finally {
    for (const name of ["localStorage", "sessionStorage"]) {
      if (saved[name]) Object.defineProperty(globalThis, name, saved[name]);
      else delete globalThis[name];
    }
  }
}

test("blocked storage reads as null instead of throwing", () => {
  withThrowingStorage(() => {
    assert.equal(safeStorage("localStorage"), null);
    assert.equal(safeStorage("sessionStorage"), null);
    // Callers that rely on the default store keep working.
    assert.equal(readStoredDraft(), null);
    assert.equal(writeStoredDraft({ left: [], right: [] }), true);
    assert.equal(typeof readStorageNoticeDismissed(), "boolean");
  });
});

test("a working store is returned as is", () => {
  const store = { getItem: () => null, setItem() {}, removeItem() {} };
  const saved = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: store });
  try {
    assert.equal(safeStorage("localStorage"), store);
  } finally {
    if (saved) Object.defineProperty(globalThis, "localStorage", saved);
    else delete globalThis.localStorage;
  }
});
