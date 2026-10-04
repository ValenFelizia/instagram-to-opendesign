# Windows app shell

Tracking: [issue 51](https://github.com/ValenFelizia/instagram-to-opendesign/issues/51), [source PR 60](https://github.com/ValenFelizia/instagram-to-opendesign/pull/60), implementation coordinated by VAL-100. DEC-011's selected platform is now an executable shell, not the complete guided app. CLI/core/schema/readiness behavior is unchanged.

## Included

- Electron 44.5.1, electron-builder 26.15.3 and Playwright 1.62.1 pinned for reproducible builds/checks.
- Plain HTML/CSS/JavaScript for this small shell. No UI framework is selected for the future guided product.
- Isolated sandboxed renderer with a small preload: status, local check, explicit Exit and first-close explanation. No arbitrary channel, path, shell, credential or provider operation is exposed.
- Main-frame/document/request validation, denied navigation/popups/downloads/permissions and local-resource allowlist/CSP. The worker receives only required Windows temporary/system variables, not parent API keys or NODE_OPTIONS.
- A utility process imports the real canonical core and validates a generated in-memory PNG using native sharp. The ten-second background check is synthetic; it never ingests or analyzes a profile.
- Main-owned worker state survives window closure and renderer death. Reopen through the icon, menu or tray reconnects to the same process. A second instance activates the first. Ctrl+Q/menu/tray/button explicitly exit; Alt+F4 follows window-close behavior.
- Graceful Exit requests shutdown, then kills a nonresponsive worker after a bounded grace period. Worker loss reports interruption, with no automatic respawn or job retry. Memory-only state resets on a fresh app launch.

## Build and run

Development uses Node 24 and pnpm 11.19.0; the existing CLI still supports its declared Node >=20 runtime. `pnpm-workspace.yaml` permits Electron/sharp installation scripts and explicitly denies unused Squirrel/electron-winstaller scripts. A cold install must download Electron; no global npm/npx repair is needed.

```powershell
pnpm install --frozen-lockfile
pnpm app:dev
pnpm app:build
node desktop/audit-package.mjs
pnpm app:verify --packaged
```

The local unsigned per-user NSIS installer is `dist/app/instagram-to-opendesign-0.1.0-windows-x64-setup.exe`. The executable directory is `dist/app/win-unpacked`; keep that directory's resources together. Build outputs and test Chromium profiles are Git-ignored. No GitHub release or public installer distribution occurs automatically. Product branding/icons/signing/update strategy remains release work; this shell retains current naming and the default executable icon.

The build explicitly includes only shell/UI, source modules, schemas, the public example token template, runtime dependencies, license and package manifest. No evidence, private project, .env, history, provider keys, repository metadata or development tooling is included. sharp/@img native resources are unpacked from ASAR; npmRebuild is disabled because the existing sharp dependency uses Node-API/prebuilt binaries. The packaged sharp check, not an assumption about development imports, is the native feasibility evidence.

## Verification — 2026-10-04

On the current Windows x64 host (10.0.26300):

- Four new IPC/supervisor tests and the full **83/83** repository suite passed, no skips.
- NSIS build completed; packaged executable passed core/native PNG imports, same-worker progress after close/reopen, second instance, renderer crash/menu reopen/completion, explicit Exit and actual worker termination.
- The app subprocess PATH contains Windows System32 only, without an external Node directory. The harness still uses developer Node; this establishes bundled-runtime execution on this host, not a clean VM installation without Node.
- Packaged checks inspect sandbox/context isolation/no renderer Node, skip-link/Enter/Escape/dialog focus, 360px overflow, high-contrast/reduced-motion focus, blocked external navigation/popup/fetch and no page errors. A screenshot was inspected. Live status announces phase changes, not every heartbeat.
- Package inventory audit verifies the allowlist/private-data exclusion and Windows x64 sharp binary. Test reports/screenshots are in `tmp/app-shell-qa`, with isolated disposable test profiles.
- Development harness failures were corrected: normalized Windows launch paths/profile variables; waited for asynchronous native-dialog close/focus; avoided a Playwright locator wait after deliberately blocked navigation. Actual renderer failure now destroys the dead view so Open recreates it without replacing the worker.

The Windows CI workflow repeats suite/build/inventory/packaged checks and retains only the unsigned installer and generic test screenshot/report. The first runner suite failed because its TEMP used a Windows short-name alias, which existing canonical path guards deliberately reject; CI now creates an unaliased workspace temporary directory without relaxing the guards. Its result is separate evidence after execution; configuring it does not claim it passed. No live provider, private case, credential store, durable job, restart/power-loss recovery, clean VM install, actual Narrator/tray keyboard acceptance, signing or Windows 10 support was verified. Initial build target is Windows x64; the tested host is Windows 11. Final support floor/distribution acceptance remains issue 58.

## Manual acceptance before closing issue 51

1. On a disposable/clean supported Windows environment without external Node, install the NSIS build, open its shortcut and confirm both imports are available.
2. Start the local check, close the window, reopen the shortcut/tray and confirm it continued. Alt+F4 must close the view; Ctrl+Q or Exit must terminate the app. Invoke a second shortcut while the first is alive.
3. With Windows keyboard and Narrator, inspect the native menu/tray Open/Exit, first-close dialog/focus/status and zoom/high contrast. Browser automation does not establish native tray or screen-reader usability.

Keep issue 51 open for those acceptance gates even after the source PR merges. Managed projects/credentials are issue 52; transactional jobs/authorization are issue 53; real core stages and guided screens follow issues 54–57. This shell cannot start paid work or recover a real business project.

## API references

Implementation follows the official [utility process API](https://www.electronjs.org/docs/latest/api/utility-process), [Electron security guidance](https://www.electronjs.org/docs/latest/tutorial/security), [native-image API](https://www.electronjs.org/docs/latest/api/native-image), [Playwright Electron API](https://playwright.dev/docs/api/class-electron), [electron-builder configuration](https://www.electron.build/configuration/) and [pnpm build policy](https://pnpm.io/blog/releases/11.0). References were checked 2026-10-04; actual runtime verification above bounds the claims.
