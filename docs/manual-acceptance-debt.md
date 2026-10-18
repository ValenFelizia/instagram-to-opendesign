# Manual acceptance debt

This file lists every acceptance bullet from issues 51, 52, and 57. The bullet text is copied from the Acceptance section of each issue. `pnpm app:cite` checks this file against `desktop/acceptance/registry.mjs`. It does not read GitHub, and it does not mark a manual row passed.

A row is automated when it has evidence or unit tests and an empty manual list. A row is partial when it has both. A row is manual when it has limits and no evidence or tests. Partial and manual rows still need a person.

## Commands

The Windows workflow runs these commands on `windows-latest`, in this order.

```powershell
pnpm test
pnpm app:cite
pnpm app:build
node desktop/audit-package.mjs
pnpm app:verify --packaged
pnpm app:guided
```

`pnpm app:verify --packaged` launches `dist/app/win-unpacked/Instagram to OpenDesign.exe`. The packaged child `PATH` is `System32` only. The job that starts the script still has Node. `pnpm app:guided` uses that same unpacked executable in the same job.

## Limits

| Limit | Why it stays manual |
| --- | --- |
| clean-machine | The runner that starts the script has Node. The packaged child PATH is System32 only, and that child is not an NSIS install on a machine without Node. |
| native-shell | The harness stubs file dialogs and keeps the window hidden. It does not drive the tray, the native folder picker, foreground activation, or Alt+F4. |
| assistive-technology | Keyboard Tab and axe run in the packaged renderer. They do not run Narrator, 200% zoom, or a person reading the status announcements. |
| release-decision | Signing, the Windows version floor, and install or upgrade retention stay on issue 58. This harness does not decide a release. |

## Criteria

| Id | Issue | Disposition | Bullet | Proof | Manual |
| --- | --- | --- | --- | --- | --- |
| 51.clean-install | [#51](https://github.com/ValenFelizia/instagram-to-opendesign/issues/51) | partial | A clean Windows installation without external Node opens the packaged app. | Packaged child PATH is System32 with no NODE_OPTIONS or secret-like environment | clean-machine |
| 51.worker-lifecycle | [#51](https://github.com/ValenFelizia/instagram-to-opendesign/issues/51) | partial | Window close and renderer failure leave a synthetic worker alive; reopen reconnects to that worker; Exit stops it after a bounded grace period. | Packaged core/sharp, isolated renderer, keyboard close dialog and background worker/second instance; Renderer crash, menu reopen and observed completion retain the same worker; Explicit Exit terminates the worker; explicit Exit rejects new work and kills a worker after a bounded grace period | native-shell |
| 51.single-instance | [#51](https://github.com/ValenFelizia/instagram-to-opendesign/issues/51) | partial | A second instance activates the first. | Packaged core/sharp, isolated renderer, keyboard close dialog and background worker/second instance | native-shell |
| 51.isolation | [#51](https://github.com/ValenFelizia/instagram-to-opendesign/issues/51) | automated | Renderer isolation, narrow validated IPC and local content policy are verified; no credentials or arbitrary filesystem execution are exposed. | Packaged core/sharp, isolated renderer, keyboard close dialog and background worker/second instance; External navigation, popup, fetch blocked; narrow layout and high contrast focus; Managed create/import/open/backup/trash/restore, source byte equality, real Windows DPAPI and cleared password input; shell IPC accepts fixed actions only and refuses foreign frames; IPC rejects arbitrary paths, scope injection, IDs, extra fields and foreign actions | None |
| 51.native-dependencies | [#51](https://github.com/ValenFelizia/instagram-to-opendesign/issues/51) | partial | Packaging includes usable native dependencies and declared Windows support requirements. | Packaged core/sharp, isolated renderer, keyboard close dialog and background worker/second instance; Bundled node:sqlite intent, acknowledgement, inventoried snapshot and fresh-store recovery without external Node or network; Packaged core analysis/colors/compiler/report: private responses and stable request IDs survive report failure and database reopen, without another provider attempt | release-decision |
| 51.keyboard-shell | [#51](https://github.com/ValenFelizia/instagram-to-opendesign/issues/51) | partial | Keyboard-accessible Open/Exit and visible focus work in the actual Windows shell. | Packaged core/sharp, isolated renderer, keyboard close dialog and background worker/second instance; External navigation, popup, fetch blocked; narrow layout and high contrast focus; Explicit Exit terminates the worker | native-shell, assistive-technology |
| 52.import-bytes | [#52](https://github.com/ValenFelizia/instagram-to-opendesign/issues/52) | automated | Imported source bytes remain unchanged and imports never rewrite the source project. | Managed create/import/open/backup/trash/restore, source byte equality, real Windows DPAPI and cleared password input; native import copies exact bytes and source inventory without rewriting originals | None |
| 52.keys | [#52](https://github.com/ValenFelizia/instagram-to-opendesign/issues/52) | automated | No keys in renderer/browser storage, project exports, logs, IPC responses or public fixtures. Unavailable protection produces an actionable error. | Managed create/import/open/backup/trash/restore, source byte equality, real Windows DPAPI and cleared password input; Fresh app launch retains projects and protected credential configuration; explicit key removal; credential broker fails closed and never returns saved values or raw exceptions; backups are scoped, portable and credential-free; trash is reversible and source is retained; diagnostic responses never include secrets, paths or raw payloads; explicit originals are byte-identical; private configuration and recognizable secrets fail closed | None |
| 52.containment | [#52](https://github.com/ValenFelizia/instagram-to-opendesign/issues/52) | automated | Validate IPC, project identity and resolved containment, including Windows junctions, archive traversal, duplicate paths and malicious filenames. | Managed workspace resolves outside the repository without the shell-test-data redirect; IPC rejects arbitrary paths, scope injection, IDs, extra fields and foreign actions; Windows junctions and linked ancestors cannot import/export/delete outside scope; malicious names, archives, hidden keys and hardlink aliases are refused; normalized legacy profile identity is retained and conflicting URLs are refused | None |
| 52.scope | [#52](https://github.com/ValenFelizia/instagram-to-opendesign/issues/52) | automated | Export/delete require an explicit selected scope; deletion cannot escape that scope. | Managed create/import/open/backup/trash/restore, source byte equality, real Windows DPAPI and cleared password input; Windows junctions and linked ancestors cannot import/export/delete outside scope; backups are scoped, portable and credential-free; trash is reversible and source is retained | None |
| 52.registry-errors | [#52](https://github.com/ValenFelizia/instagram-to-opendesign/issues/52) | automated | Registry/import failures preserve existing projects and show recoverable, keyboard-accessible errors. | Managed create/import/open/backup/trash/restore, source byte equality, real Windows DPAPI and cleared password input; changed import and registry write failure preserve existing projects and source; registry corruption never resets or overwrites the registry or existing files | None |
| 57.reconnect | [#57](https://github.com/ValenFelizia/instagram-to-opendesign/issues/57) | automated | Reconnect/window close/worker failure show actual stages and available partial inventory; reopening never dispatches. | Packaged guided broker: scoped consent, real stages/partial inventory and spend projection survive reopen without dispatch, percentage or cancellation claims; worker interrupt and store reopen show interrupted state with partial inventory semantics; scoped authorization binds plan hash; stale consent and reopen never dispatch | None |
| 57.amounts | [#57](https://github.com/ValenFelizia/instagram-to-opendesign/issues/57) | automated | Null/zero, tiny positive amounts, mixed currencies, duplicate/conflicting IDs and partial coverage remain explicit. Token subsets are not added twice; wall time and human effort stay separate. | null billing stays null; returned zero and tiny amounts retain meaning; mixed currencies stay separate; shared preparation and identical records count each attempt once; token subsets are not added twice; conflicting IDs and malformed amounts or usage reject aggregation; wall time and human effort stay separate; unfinished journals still project for UI | None |
| 57.authorization | [#57](https://github.com/ValenFelizia/instagram-to-opendesign/issues/57) | automated | Authorization binds to current inputs/config/revision and rejects stale modal confirmation. | Packaged guided broker: scoped consent, real stages/partial inventory and spend projection survive reopen without dispatch, percentage or cancellation claims; guided-keyboard-and-axe; Packaged task authority: explicit v2 selection/review survives database reopen; changed confirmation revokes execution without granting publication; scoped authorization binds plan hash; stale consent and reopen never dispatch | None |
| 57.accessibility | [#57](https://github.com/ValenFelizia/instagram-to-opendesign/issues/57) | partial | Keyboard, focus, linked errors, status announcements, Narrator, zoom, high contrast and reduced motion are reviewed in the packaged Windows app. | guided-keyboard-and-axe; External navigation, popup, fetch blocked; narrow layout and high contrast focus; notification copy and accessibility contracts stay allowlisted | assistive-technology |
| 57.redaction | [#57](https://github.com/ValenFelizia/instagram-to-opendesign/issues/57) | automated | Errors/notifications contain no secret, profile identifier, raw payload or private path. | Packaged guided broker: scoped consent, real stages/partial inventory and spend projection survive reopen without dispatch, percentage or cancellation claims; diagnostic responses never include secrets, paths or raw payloads; notification copy and accessibility contracts stay allowlisted | None |
| 57.no-fake-progress | [#57](https://github.com/ValenFelizia/instagram-to-opendesign/issues/57) | automated | No fake percentage, fabricated invoice or unsupported cancellation claim. | Packaged guided broker: scoped consent, real stages/partial inventory and spend projection survive reopen without dispatch, percentage or cancellation claims; Packaged generic/OpenDesign task handoff: explicit inventory, portable export, immutable result/feedback and idempotent supplied effort survive store reopen; unknown billing stays null; projectStages never invent percentages and mark unreached stages; stop does not claim remote cancellation; notifications stay allowlisted; local completed run projects stages and available inventory without fake progress | None |

## Issue 58

`runInstallerAcceptance` in `desktop/acceptance/install.mjs` validates an installer spec and then throws `not implemented`. The Windows workflow does not call it. Install, upgrade, and uninstall remain open on [issue 58](https://github.com/ValenFelizia/instagram-to-opendesign/issues/58).

## Hosted runner risks

- GitHub-hosted `windows-latest` has Node so the job can start. The clean-machine limit stays open.
- `LOCALAPPDATA` on that runner is outside the checkout. The storage check resolves it to its long path before use, because an 8.3 short name fails the app path guards. The packaged-default launch throws when `dataRoot` is inside the repo, including when only the drive letter case differs. A runner that points `LOCALAPPDATA` at the workspace fails the storage check instead of passing it.
- CI sets `TEMP` and `TMP` to an unaliased directory under the workspace. Short 8.3 paths fail the canonical path guards. Do not point those variables at a short name.
- The guided window is hidden with `--shell-test-hidden`. Tab order is asserted on that window. A visible window can still differ. Narrator is not part of the job.
- axe fails the job on serious and critical impacts. Moderate and minor impacts stay in `tmp/app-shell-qa/guided/axe.json` and do not fail the job.
- The page CSP is `script-src 'self'`. The guided script injects axe with `webContents.executeJavaScript`. If that injection is blocked, change the test process. Do not weaken the page CSP.
- Verify and guided share one job, so the workflow does not upload the unpacked app between jobs. The job timeout is 30 minutes. A slow install plus the packaged launches can still hit that limit.
- The packaged-default launch uses the app user-data directory rather than `--shell-test-data`. A leftover process from an earlier run on the same machine can make that launch exit immediately.
- Chromium profiles are written under `tmp/app-shell-profiles` and are not part of the uploaded artifact. Reports, screenshots, and axe JSON are under `tmp/app-shell-qa`.
