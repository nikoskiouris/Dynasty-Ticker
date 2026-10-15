// Temp-dir cleanup for tests that spawn headless Chrome. Chrome can still be
// writing its profile for a moment after SIGKILL, which made rmdir fail with
// ENOTEMPTY on CI. Wait for the process to exit, retry the removal, and never
// fail a test over cleanup: log instead.
import { rm } from "node:fs/promises";

export function exitOf(proc) {
  return new Promise((resolve) => {
    if (proc.exitCode != null || proc.signalCode != null) resolve();
    else proc.once("exit", () => resolve());
  });
}

export async function removeTempDir(dir) {
  if (!dir) return;
  try {
    await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  } catch (error) {
    console.warn(`test cleanup: could not remove ${dir}: ${error?.code || error?.message || error}`);
  }
}

// Kill Chrome, wait for it to exit (bounded), then remove its profile dir.
export async function stopChrome(proc, dir, { waitMs = 5000 } = {}) {
  const exited = exitOf(proc);
  try {
    proc.kill("SIGKILL");
  } catch {
    // Already gone.
  }
  await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, waitMs))]);
  await removeTempDir(dir);
}
