# Synthetic lifecycle spike

Issue #45 tests one uncertainty: can a worker checkpoint remain independent of a disposable view, and can recovery avoid automatically repeating an attempt with an unknown remote outcome?

This is a Node test harness, not an app. It has **no Electron, SQLite, provider call, real charge, credential, actual window, tray or real project**. The tiny single-writer file format is deliberately separate from canonical schemas and is not production persistence. `attempt-started`/`attempt-response` are synthetic event names; no network request is made.

Run from the repository root:

```powershell
node --test test/job-lifecycle-spike.test.js
```

Tests use real temporary files in Git-ignored `tmp/job-lifecycle-qa`, spawn a short-lived Node worker with an empty environment, remove a synthetic UI message listener, terminate the worker at checkpoint boundaries, and reopen records from disk. The test harness removes only its own checked child directories. A partial file is unpublished; malformed/gapped committed history fails closed. Recovery is read-only and never dispatches.

The lost observer is a stand-in for a closed renderer subscription. It does not test a native window, Electron main/utility-process lifetime, Windows restart or actual provider reconciliation. File synchronization and sequential writes do not prove power-loss durability, filesystem/database atomicity, concurrent writers, migrations or production encryption. Those remain acceptance gates in the [blueprint](../../docs/local-workspace.md).

## Verification

Verified on Windows with Node 24.19.0, 2026-10-03: all seven spike tests passed; the complete repository regression suite passed **69/69**, with no skipped tests. The sandboxed full-suite run initially could not read existing dependency files; the approved rerun outside that restriction passed without changing dependencies. No provider requests or app installation were performed. Do not treat a passing synthetic test as an installed app guarantee.
