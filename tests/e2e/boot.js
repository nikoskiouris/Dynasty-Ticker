// app.js is a deferred module. Until it has attached its listeners and
// released the boot gate, a Load League click is dropped (boot-intent.js
// queues only Find presses), and the URL never leaves "/". The gate flag
// flips after the listeners exist, so wait on it instead of on time.
export async function waitForAppBoot(page) {
  await page.waitForFunction(() => window.__dynastyBootFind?.pending === false);
}
