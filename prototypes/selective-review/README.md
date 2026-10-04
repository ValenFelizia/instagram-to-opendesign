# Selective review interaction prototype

Open `index.html` locally. No installation, API keys, server or real profile is needed. This isolates the proposed review behavior for [GitHub issue 44](https://github.com/ValenFelizia/instagram-to-opendesign/issues/44), without changing the existing onboarding UI or canonical contracts.

Read the [authority/transition proposal and compatibility map](../../docs/selective-review.md). All content and confirmations are fictional. The UI is in Spanish; titles are direct and technical references are disclosed on demand.

## Try these interactions

1. Reject or defer the optional voice interpretation. Prepare exploration: confirmed copy and applicable rules remain unchanged.
2. Select a direction and review execution. Publication acceptance stays unavailable until the separate mock render/platform review.
3. Correct confirmed text. The dialog explains consequences and requires a reason; the old snapshot and unrelated voice/rules survive, while dependent direction/execution/output review is revoked.
4. Switch scenarios: incomplete evidence, collaborator photo, low resolution, missing site access or conflicting web/social rules. Only relevant mandatory questions appear.
5. Change task or simulate a changed text source. Inspect the preserved source/decision history and the current blockers.

Every “simulate” control is a demonstration shortcut. Real source verification, asset measurement, site access and human provenance require separate core/app implementation. The context preview is not an export accepted by current schemas. No calls, files, approvals or publication are performed. State is memory-only and resets on reload. Existing production schemas/gates are unchanged.

## Verification

State/authority tests are included in `pnpm test`. Browser verification uses an operator-supplied Playwright package and local browser, with no new app dependency:

```powershell
$env:PLAYWRIGHT_MODULE = 'C:\path\to\existing\node_modules\playwright'
$env:BROWSER_CHANNEL = 'msedge' # Or omit for installed Playwright Chromium.
node prototypes/selective-review/verify-browser.mjs
```

Synthetic screenshots/results go to Git-ignored `tmp/selective-review-qa/`. Browser checks cover keyboard/errors/focus, correction consequences, permissions, scoped rules, preservation of unrelated decisions, escaping, viewport overflow and no HTTP(S) traffic/storage writes. Inspect screenshots independently; these checks do not certify accessibility or a real output.
