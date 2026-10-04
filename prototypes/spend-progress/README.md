# Spend and progress prototype

Open `index.html` locally. Spanish operator UI uses ten authored synthetic cases, no actual profile/assets/pricing, and no requests or storage. Model, provider names, timestamps, token usage, amounts and estimate are fictional. `brand-run/v1` examples match the existing field layout; proposed app job/checkpoint/consent behavior is isolated and not a production contract.

Inspect next-action scope, reuse, real stage observations, partial outputs and recorded project spend. The modal binds the illustrative consent to the current scope; cancel/reopen/restart don't dispatch. A changed context requires a new scope. Local repair retains the previous failed attempt; same-attempt lookup never becomes automatic retry or completion of downstream work.

Use **Ver proyectos** / **Volver al trabajo** to preserve the in-memory view. The **Registro y pruebas** disclosure provides synthetic restart and changed-input controls. Real reload resets state; no actual background worker, credential store, journal import/export, download or provider is implemented.

Reproducible checks from the repo root:

```powershell
node --test test/spend-progress-prototype.test.js
$env:PLAYWRIGHT_MODULE = '<installed-playwright-package-path>'
$env:BROWSER_CHANNEL = 'msedge'
node prototypes/spend-progress/verify-browser.mjs
```

Browser screenshots/results go to Git-ignored `tmp/spend-progress-qa`. The test harness uses no production providers or real cases. The UI-skills router CLI was unavailable because the existing global npx installation is broken; the installed fixing-accessibility skill supplied the focused control/status guidance without dependency changes.

## Verification

Verified on Windows with Node 24.19.0, 2026-10-03: ten model tests and the full 79/79 repository suite passed, no skipped tests. A test writes/reads an actual synthetic `createRunRecord` journal and compares projection/imported attempt IDs and returned observations after validation failure, without changing the finished-record importer.

The Edge walkthrough passed paid-scope/error/cancel/Escape/focus, stale open consent, cache reuse, shared preparation, mixed currencies, local recovery versus paid retry, same-attempt lookup with explicit consent, in-memory reconnect and actual reload reset. Ten 390px scenarios and representative 320px views have no horizontal overflow; native dialog focus, 3px focus indicator, reduced motion and forced-colors emulation were checked. Desktop review, mobile currencies and mobile consent screenshots were inspected. No browser errors, HTTP(S) page traffic, localStorage/sessionStorage writes, real providers or private cases. This is page-level traffic checking, not an OS egress audit or Narrator/conformance certification.

Two initial walkthrough attempts needed harness fixes: opening the native recovery disclosure before clicking its hidden control, and respecting disclosure state preserved across renders. The final walkthrough passed. The [specification](../../docs/spend-progress.md) records journal/job mapping, accounting gaps and proposed future work. This prototype doesn't certify billing, durable recovery or publication.
