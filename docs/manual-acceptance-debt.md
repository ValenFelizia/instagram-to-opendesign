# Manual acceptance debt

This file lists every acceptance bullet from issues 51, 52, 57, and 58. The bullet text is copied from the Acceptance section of each issue. `pnpm app:cite` checks this file against `desktop/acceptance/registry.mjs`. It does not read GitHub, and it does not mark a manual row passed.

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
| clean-machine | The runner that starts the scripts has Node. The packaged and installed children see a System32-only PATH, but the machine is not clean. |
| windows-client | windows-latest is Windows Server. Windows 10 and Windows 11 client editions, the declared support floor, are not exercised by CI. |
| smartscreen | CI runs an unsigned installer from disk without a download mark, so SmartScreen and unknown-publisher prompts are not exercised. |
| real-upgrade | CI upgrades between two builds of one commit with synthetic data. A person upgrading a real installation with real projects is not exercised. |
| native-shell | The harness stubs file dialogs and keeps the window hidden. It does not drive the tray, the native folder picker, foreground activation, or Alt+F4. |
| assistive-technology | Keyboard Tab and axe run in the packaged renderer. They do not run Narrator, 200% zoom, or a person reading the status announcements. |
| network-observation | The harness does not capture network traffic from the installer, the uninstaller or the app. Absence of cloud or telemetry calls rests on configuration review and the blocked renderer requests. |
| release-decision | Signing, the Windows version floor, distribution and the uninstall data scope are an operator release decision on issue 58 (DEC-015, pending). This harness does not decide a release. |

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
| 58.clean-install | [#58](https://github.com/ValenFelizia/instagram-to-opendesign/issues/58) | partial | Install/open works on a clean supported Windows machine without external Node. | Silent per-user NSIS install registers a current-user uninstaller, starts nothing, writes no user data and ships no update metadata; Installed app finishes a rolled-back v1 to v2 job store migration keeping prior evidence, then writes a managed project, a DPAPI-protected credential and an unconfirmed queued job under the real per-user data roots; Installed app relaunch with a System32-only PATH lists the project, decrypts the credential and leaves the queued job undispatched | clean-machine, windows-client, smartscreen |
| 58.upgrade-retention | [#58](https://github.com/ValenFelizia/instagram-to-opendesign/issues/58) | partial | Upgrade/migration failure preserves prior recoverable projects and credentials; cannot erase evidence or automatically retry uncertain remote requests. | Installed app finishes a rolled-back v1 to v2 job store migration keeping prior evidence, then writes a managed project, a DPAPI-protected credential and an unconfirmed queued job under the real per-user data roots; Silent N to N+1 upgrade over a crashed paid attempt replaces the install, starts nothing and leaves the workspace and Chromium profile byte-identical; Upgraded app reports N+1, keeps projects, the DPAPI credential and the queued job, and marks the crashed paid attempt uncertain and interrupted without retrying it; Installed app refuses a job store newer than it supports with job-version-unsupported and changes no workspace byte; migration rollback and unsupported version fail closed without deleting valid snapshots; explicit shutdown fences a late fake response and restart never repeats the call; authorization expires on restart and project moves revoke approval while backups omit control locks | real-upgrade, windows-client |
| 58.shell-guarantees | [#58](https://github.com/ValenFelizia/instagram-to-opendesign/issues/58) | partial | Window/tray/Exit, crash recovery and restart are verified against their separate documented guarantees. | Packaged core/sharp, isolated renderer, keyboard close dialog and background worker/second instance; Renderer crash, menu reopen and observed completion retain the same worker; Explicit Exit terminates the worker; Fresh app launch retains projects and protected credential configuration; explicit key removal; Upgraded app reports N+1, keeps projects, the DPAPI credential and the queued job, and marks the crashed paid attempt uncertain and interrupted without retrying it; explicit Exit rejects new work and kills a worker after a bounded grace period | native-shell |
| 58.uninstall | [#58](https://github.com/ValenFelizia/instagram-to-opendesign/issues/58) | partial | Uninstall clearly identifies retained versus explicitly removed local data; no unintended deletion or cloud/telemetry behavior. | Default silent uninstall removes the install and its registration and leaves the workspace and Chromium profile byte-identical; Reinstall over retained data reopens the same project, credential, queued job and uncertain attempt without a reset or retry; Uninstall with --delete-app-data removes only the Chromium profile and leaves the workspace byte-identical | network-observation, release-decision |
| 58.support-matrix | [#58](https://github.com/ValenFelizia/instagram-to-opendesign/issues/58) | manual | Signing/update limitations and actual support matrix are documented without implying untested OS guarantees. | None | release-decision, windows-client |
| 58.packaged-checks | [#58](https://github.com/ValenFelizia/instagram-to-opendesign/issues/58) | partial | Packaged security/accessibility checks pass before distribution. | Packaged core/sharp, isolated renderer, keyboard close dialog and background worker/second instance; External navigation, popup, fetch blocked; narrow layout and high contrast focus; guided-keyboard-and-axe; shell IPC accepts fixed actions only and refuses foreign frames; IPC rejects arbitrary paths, scope injection, IDs, extra fields and foreign actions | assistive-technology |

## Issue 58

`runInstallerAcceptance` in `desktop/acceptance/install.mjs` runs these phases once, in this order, and stops at the first failure. Each phase declares its effect on three roots: the install directory, the Local workspace root `%LOCALAPPDATA%\Instagram to OpenDesign` and the Roaming profile root `%APPDATA%\Instagram to OpenDesign`. The machine snapshots every root after each phase and fails the phase when a root does not match its declared effect. The uninstall rows are the documented retention policy.

| Phase | Install directory | Local workspace | Roaming profile | Evidence |
| --- | --- | --- | --- | --- |
| preflight | absent | absent | absent | None |
| install | created | absent | absent | Silent per-user NSIS install registers a current-user uninstaller, starts nothing, writes no user data and ships no update metadata |
| plant-v1-store | byte-identical | created | absent | None |
| seed | byte-identical | present | created | Installed app finishes a rolled-back v1 to v2 job store migration keeping prior evidence, then writes a managed project, a DPAPI-protected credential and an unconfirmed queued job under the real per-user data roots |
| verify-installed | byte-identical | kept | present | Installed app relaunch with a System32-only PATH lists the project, decrypts the credential and leaves the queued job undispatched |
| plant-crashed-attempt | byte-identical | present | byte-identical | None |
| upgrade | replaced | byte-identical | byte-identical | Silent N to N+1 upgrade over a crashed paid attempt replaces the install, starts nothing and leaves the workspace and Chromium profile byte-identical |
| verify-upgraded | byte-identical | recovered | present | Upgraded app reports N+1, keeps projects, the DPAPI credential and the queued job, and marks the crashed paid attempt uncertain and interrupted without retrying it |
| refuse-newer-store | byte-identical | kept | present | Installed app refuses a job store newer than it supports with job-version-unsupported and changes no workspace byte |
| uninstall-keep | removed | byte-identical | byte-identical | Default silent uninstall removes the install and its registration and leaves the workspace and Chromium profile byte-identical |
| reinstall | created | byte-identical | byte-identical | None |
| verify-reinstalled | byte-identical | kept | present | Reinstall over retained data reopens the same project, credential, queued job and uncertain attempt without a reset or retry |
| uninstall-remove | removed | byte-identical | removed | Uninstall with --delete-app-data removes only the Chromium profile and leaves the workspace byte-identical |

- plant-v1-store: The harness opens the job store with a fault that rolls back the version 2 migration, then adds a prior-evidence file. The installed app must finish the migration and keep that file.
- plant-crashed-attempt: The harness dispatches a fake paid attempt and kills the process after the intent is recorded. The upgraded app must mark that attempt uncertain and its job interrupted, and must not retry it.
- refuse-newer-store: The harness stamps the store one version ahead, starts the app, then restores the version. Downgrade across a store version is refused; reinstalling the newer build is the recovery.
- uninstall-remove: Saved provider keys are encrypted with a key held in the Roaming profile. After this removal the encrypted files stay in the workspace but may no longer decrypt.

### Effects

| Effect | Meaning |
| --- | --- |
| absent | Does not exist after the step. |
| created | Did not exist before the step and exists after it. |
| byte-identical | Every file has the same bytes before and after the step. |
| kept | Every file other than the SQLite databases has the same bytes, and the job store version, job states and attempt states are unchanged. |
| recovered | As kept, except that running jobs become interrupted and intent attempts become uncertain. No job or attempt is added or acknowledged. The only files that may change are writer locks left by the stopped process, and they must be released. |
| present | Exists before and after the step. Contents may change. |
| replaced | Exists before and after the step with different bytes. |
| removed | Existed before the step and does not exist after it. |

### Install support

These statements are DEC-015 in `.csdd/decisions.md`, pending operator review. `docs/windows-app-shell.md` repeats them, and `pnpm app:cite` fails when either copy drifts.

| Topic | Statement |
| --- | --- |
| floor | Windows 10 and Windows 11, x64 only |
| tested | CI installs on GitHub windows-latest, which is Windows Server; Windows 10 and Windows 11 client editions are not exercised |
| installer | Assisted NSIS installer with a current-user default (oneClick false, perMachine false) |
| signing | Unsigned builds; SmartScreen and Mark-of-the-Web warnings are a known limitation |
| updates | Manual updates only; there is no auto-updater and no publish target |
| uninstall | Default uninstall keeps the Local workspace and the Roaming profile; --delete-app-data removes only the Roaming profile, and the Local workspace and chosen project folders stay |
| downgrade | A job store newer than user_version 2 is refused with job-version-unsupported; there is no downward migration |

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
