---
name: no-unit-tests
description: Owner-mandated Dynasty Ticker policy: do not generate unit tests or automated test suites. Consult when implementing or reviewing code changes.
---

# No unit tests

Dynasty Ticker's owner has chosen not to spend agent usage maintaining automated test suites.

- Never write unit tests or add automated test files, fixtures, mocks, snapshots, test-only dependencies, or test runner configuration unless the owner explicitly reverses this policy.
- Do not recreate the removed Node.js, Python, or Playwright test suites, `npm test`, or automated test workflows.
- Do not run automated tests. For code changes, use a concise manual browser/CLI walkthrough, appropriate syntax checks, and a clear PR description of what was verified.
- Preserve data-integrity checks, deployment preflights, and security safeguards. Those operational validations are not a unit test suite.
- If a task specifically requests tests, ask for an explicit policy override before adding them.
