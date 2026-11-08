// Some browsers throw on the storage getter itself, not just on writes: Safari
// with "Block all cookies", some in-app browsers, sandboxed frames. Reading
// window.localStorage there throws a SecurityError. Callers get null instead
// and keep the value in memory for this visit.
export function safeStorage(name) {
  try {
    const storage = globalThis[name];
    return storage && typeof storage.getItem === "function" ? storage : null;
  } catch {
    return null;
  }
}
