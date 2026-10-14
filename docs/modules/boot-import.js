// A failed dynamic import stays failed in the browser module map.
// Coming back online reloads the page once. The Reload button always reloads.

export const BOOT_IMPORT_RETRY_KEY = "dynasty-ticker-boot-retry";

export function bootImportErrorMarkup() {
  return `<section class="boot-error" role="alert">
      <h2>Couldn't load</h2>
      <p>The app did not finish loading. Reload to try again.</p>
      <button type="button" data-boot-reload>Reload</button>
    </section>`;
}

export function mountBootImportError(host, onReload) {
  if (!host) return null;
  host.innerHTML = bootImportErrorMarkup();
  const button = host.querySelector("[data-boot-reload]");
  button?.addEventListener("click", () => onReload());
  button?.focus?.();
  return button;
}

function readRetryFlag(storage) {
  try {
    return storage?.getItem?.(BOOT_IMPORT_RETRY_KEY) === "1";
  } catch {
    return false;
  }
}

function writeRetryFlag(storage) {
  try {
    storage?.setItem?.(BOOT_IMPORT_RETRY_KEY, "1");
  } catch {
    // Private mode can reject storage. The reload still runs.
  }
}

function clearRetryFlag(storage) {
  try {
    storage?.removeItem?.(BOOT_IMPORT_RETRY_KEY);
  } catch {
    // Ignore.
  }
}

export async function watchBootImport({
  importApp,
  host,
  onlineTarget,
  reload,
  storage,
} = {}) {
  let failed = false;
  let reloading = false;
  let onlineDuringAttempt = false;

  function autoReload() {
    if (!failed || reloading || readRetryFlag(storage)) return false;
    reloading = true;
    writeRetryFlag(storage);
    reload();
    return true;
  }

  function userReload() {
    if (reloading) return false;
    reloading = true;
    writeRetryFlag(storage);
    reload();
    return true;
  }

  const onOnline = () => {
    onlineDuringAttempt = true;
    autoReload();
  };
  onlineTarget?.addEventListener?.("online", onOnline);

  try {
    const loaded = await importApp();
    clearRetryFlag(storage);
    onlineTarget?.removeEventListener?.("online", onOnline);
    return loaded;
  } catch (error) {
    failed = true;
    mountBootImportError(host, userReload);
    if (onlineDuringAttempt) autoReload();
    return { ok: false, error };
  }
}
