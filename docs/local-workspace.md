# Local app, workspace and durable jobs

Tracking: [GitHub #45](https://github.com/ValenFelizia/instagram-to-opendesign/issues/45) / [VAL-106](https://linear.app/valenf/issue/VAL-106/define-a-contained-local-app-workspace-for-evidence-and-deliverables).

Review: [PR #49](https://github.com/ValenFelizia/instagram-to-opendesign/pull/49). VAL-106 is In Review for the scoped blueprint; production app work remains separate.

**Status:** architecture blueprint; no packaged app or production scheduler exists. In the joint interview, the operator selected an installable Windows-first app, closing the window keeps work running, explicit **Exit** stops work, projects default to an app-managed local folder, and Electron is accepted for the first version. See DEC-011. UI library, storage binding, recovery and implementation details below are proposals unless explicitly recorded as accepted. Existing CLI, schemas and selected-brief gates remain unchanged.

## Platform comparison

This compares documented capabilities and integration costs, not measured installer sizes, RAM, performance or accessibility conformance. A browser UI is not a background service; a desktop window is not a durable worker.

| Criterion | Local browser UI + Node host | Electron + Node worker | Tauri + Node sidecar |
| --- | --- | --- | --- |
| First use | Technical operator installs Node/dependencies and starts a host; a launcher could later bundle these | Installer bundles runtime, icon and native dialogs; matches the selected journey | Installer and icon; existing Node core also needs a bundled sidecar/runtime |
| Windows operation | Browser-independent host can outlive tabs; operator must manage host lifetime | App lifecycle and tray can keep main/worker alive after window close | Native window/tray can keep host alive; sidecar lifetime needs explicit supervision |
| Local files | Browser picker is limited; privileged host must implement scoped file access | Native selection plus brokered file capabilities; never unrestricted renderer paths | Scoped commands/capabilities plus native selection; sidecar must share the same limits |
| Credentials | Host needs a separately chosen OS secret-storage integration | OS-backed `safeStorage` available in privileged process; renderer never receives saved secrets | Requires an explicit secret-storage choice and Rust/sidecar boundary; no automatic secure secret store claim |
| Packaging/updates | Least shell code, but installation/lifecycle burden shifts to operator | Bundles Chromium and Node; runtime updates and native module compatibility become maintenance work | Uses Windows WebView2; adds Rust build prerequisites and per-target sidecar packaging |
| Accessibility | Native HTML semantics; browser/AT combinations still need review | Native HTML and Chromium accessibility facilities; Windows Narrator, zoom and tray/exit need actual tests | WebView2 HTML accessibility; Windows Narrator, zoom and native bridges need actual tests |
| Core reuse | Direct Node imports, compatible with current development | Node utility process imports current core; packaged `sharp` must be checked | Node sidecar preserves core, but executable/module/native asset packaging must be checked |
| Fit for this increment | Good development harness/fallback; does not meet selected contained first-use experience yet | Recommended: smaller integration scope around the current Node core | Viable alternative if runtime footprint becomes a measured constraint worth the additional toolchain |

**Recommendation:** Electron for the Windows app, an isolated Node utility process for core work, and a thin HTML UI with explicit IPC operations. Keep UI library selection separate. Do not build parallel Electron/Tauri apps or replace the Node core in Rust. Accept runtime/package footprint as a trade-off, then measure the actual installer and native dependencies before a release. [Electron utility processes](https://www.electronjs.org/docs/latest/api/utility-process), [application packaging](https://www.electronjs.org/docs/latest/tutorial/application-distribution), [Tauri sidecars](https://v2.tauri.app/develop/sidecar/), [Node sidecar packaging](https://v2.tauri.app/learn/sidecar-nodejs/).

Tauri's Windows development requirements include Rust and C++ build tools, and it uses WebView2. Its footprint advantage must be evaluated with our Node runtime and `sharp`, not assumed from an empty shell. [Prerequisites](https://v2.tauri.app/start/prerequisites/), [webview versions](https://v2.tauri.app/reference/webview-versions/). Electron native modules may need platform/runtime-specific handling; a dev-mode import is insufficient release evidence. [Native Node modules](https://www.electronjs.org/docs/latest/tutorial/using-native-node-modules).

## App ownership and lifecycle

The app main process owns the project registry, credential broker, tray, worker supervision and snapshots. The renderer is a disposable view. Workers perform bounded core operations; persisted state is authoritative, not IPC delivery or renderer memory. Use one app instance and one writer/active core operation per real profile directory, including aliases to the same directory. External CLI writes must be coordinated or detected before app writes; app-only locks do not protect against the unchanged CLI.

After a main crash, prove ownership ended or safely fence/stop a surviving worker before granting another writer. A stale timestamp/PID alone is insufficient (PID reuse and OS scheduling pauses are possible). On a fresh launch, paused queues remain inspectable until explicit resume; persisted old authorization alone cannot start paid work. Reopening a window in the same still-running app only reconnects to the existing worker.

| Event | Proposed behavior | Guarantee and limit |
| --- | --- | --- |
| Navigate away / close window | Unsubscribe view, keep main and worker; tray has Open and Exit | Work continues while app/OS is alive; no renderer timers own it |
| Open icon again | Activate existing main; recreate window; load latest saved job state | Does not start another provider request or duplicate writer |
| Explicit Exit | Stop accepting jobs/dispatches, save state, request bounded safe stop, terminate workers and quit | Partial work remains; dispatched remote work may continue remotely |
| Worker crash | Main records interruption; preserve snapshots and attempt state | Never resend an ambiguous paid attempt automatically |
| Main/process crash | On next launch acquire ownership and reconcile active jobs | Stale running means interrupted, not completed; no restart loop |
| Windows restart/logout | Same recovery on next explicit launch | No reliable quit callback assumed; no work while machine is off |
| Sleep/offline | Preserve checkpoint; reconcile provider status after wake if supported | No promise that requests progress while asleep or disconnected |
| App update | Wait for safe stop, checkpoint, migrate backed-up metadata and reopen | No force restart during paid work; no automatic paid continuation |

Electron can keep the app alive after all windows close when lifecycle events are handled explicitly; Windows shutdown may omit quit events. This requires on-disk attempt boundaries, not only a shutdown save. [App lifecycle](https://www.electronjs.org/docs/latest/api/app). No startup-at-login service is proposed for v1; reopening the app recovers state. A future opt-in startup option is separate from permission to spend.

On first background close, explain once that work continues and where to exit. Exit remains accessible from both app menu and tray; do not require a notification balloon to discover it. Reopen shows **Running**, **Review required**, **Completed**, **Failed** or **Interrupted**, last completed stage, reusable output and the next action. Technical events/IDs remain in a disclosure. Completion is always in-app; optional OS notifications default off and use a generic title such as "A task needs attention", with no brand name, profile, path, image, caption or cost. Suppressing notifications never loses completion history.

## Workspace layout and compatibility

Proposed default root: an app-owned folder under Windows LocalAppData, separate from installation files, Git checkouts and browser persistence. The final product folder name remains a packaging choice; current repo/package/schema names are retained. Project IDs are opaque UUIDs, not public profile handles. App-managed storage is not whole-project encryption: normal OS file permissions apply. Never create a remote backup, telemetry event or sync relationship automatically. Advanced location selection must explain that a user-chosen synced/network directory changes the local-only assumption; v1 concurrent active storage is local disk only.

```text
<local-app-root>/
  settings.json                 # provider aliases/options, notification choice; no keys
  credentials/                  # OS-protected encrypted blobs, never portable exports
  workspace.sqlite              # proposed registry/jobs/leases/attempt authorization
  projects/<project-id>/
    project.json                # version, display name, source bindings, creation time
    data/<profile>/             # existing core-compatible layout (private)
      instagram-source.json
      assets/                   # downloaded originals, immutable provenance retained
      evidence/                 # index, contact sheet, corpus, classifications
      manual/                   # supplied originals, documents, fonts
      brand-analysis.json
      analysis-state.json
      color-proposals.json
      brand-decisions.json
      asset-review.json
      asset-catalog.json
      design-request.json
      creative-directions.json
      brief/                    # existing compiled context
      runs/                     # existing brand-run/v1 accounting, unchanged
      brand-report.html         # existing Spanish report; explicit English alternative
    brand-output/               # existing optional adapter output layout
    tasks/<task-id>/             # app request revision, dependencies, review state
    snapshots/<snapshot-id>/     # source/review/output inventories, append-only revisions
    handoffs/<handoff-id>/       # immutable reviewed export snapshots
    results/<result-id>/         # artifact, brief snapshot, original feedback/revisions
    staging/                    # unpublished partial files owned by one job
```

The existing pipeline accepts `dataRoot`/`outputRoot`, so a wrapper can keep canonical profile-relative paths inside the project. `brand-run/v1` is accounting, not the job database; preserve its IDs/status values and finished-record import rules. UI "Completed" maps to `complete` only where the core actually completed. Report building/translation happens after `runPipeline` in today's CLI and is outside its journal. Direction generation and exports also need their own future job/paid boundaries; don't claim the pipeline journal covers all tasks.

Create validates the URL and intent locally; persisting a project alone has no paid effect. Open/resume loads the project and latest valid inventories. Import of an existing CLI project uses a native picker, inventories the permitted tree, previews what is copied, retains originals and initializes app metadata separately. Preserve the existing project in place; don't quietly relocate or upgrade its schemas. Validate path rebasing and a complete compile/export on synthetic copied projects before shipping. Existing CLI commands continue to work; advanced external edits require an explicit reload/fingerprint comparison before a write.

## Job and persistence blueprint

Propose SQLite transactions for coordination metadata, a single supervised writer, and immutable inventoried file snapshots for large evidence/output. SQLite is a recommendation, not a dependency added here. Choose the binding only after testing compatibility with the selected Electron runtime and native packaging. Persist authoritative metadata before notifying the UI. Use actual transactions, not repeated browser-storage writes. [SQLite commit design](https://www.sqlite.org/atomiccommit.html).

A proposed `workspace-job/v1` record contains job/project/task IDs; status; revision; dependency/input hashes; core/schema versions; stage plan; last completed stage; timestamps; worker session/lease; error code; staged/snapshot references; and linked `brand-run/v1` IDs. Each provider attempt has a stable ID, authorized scope/input hash, provider/model/configuration, dispatch intent, optional remote ID, response checkpoint, validation state and actual accounting reference. Credentials and arbitrary error/provider payloads never enter this record.

| Status | Meaning | Next action |
| --- | --- | --- |
| queued | Saved plan, no current worker | Claim only in active authorized session; fresh launch awaits explicit resume and matching inputs/permission |
| running | Owned by current worker; stage/attempt persisted | Show real stage, allow leaving view; safe stop at boundary |
| review-required | Missing human input or stale/uncertain recovery | Inspect question/consequence; resume only after applicable decision |
| completed | All requested stages validated; committed output snapshot linked | Open/export result; publication remains separate |
| failed | Operation/validation failed; error code and partial data retained | Inspect; explicit retry or local repair; don't discard last valid output |
| interrupted | Ownership lost or explicit stop before completion | Recover known results; resolve unknown remote outcome before retry |

Staleness is an orthogonal dependency condition, not a success/failure shortcut. Changes to original bytes, source evidence, relevant classifications, confirmed rules, task copy/assets/direction/code inventory, provider configuration or compiler/schema versions invalidate their dependent plan/cache/approval only. Unrelated tasks and immutable prior output remain inspectable, labeled as an earlier revision. Recheck immediately before dispatch and before committing outputs. Running work uses a frozen input snapshot; stale results can be retained as history but cannot replace the latest reviewed context.

### Paid dispatch and recovery

1. Record an explicit authorization for a bounded plan (provider, purpose, configuration, inputs and available estimate/unknowns). Settings do not authorize spending. Cache hits/local stages do not need another paid confirmation.
2. Transactionally reserve a unique attempt and save dispatch intent **before** crossing the provider boundary. Limit initial paid dispatch concurrency to one, with per-profile serialization. Reopening/loading a project never grants authorization.
3. Capture remote run/response ID and accounting as soon as observed; checkpoint a validated or unvalidated response privately before dependent local steps. Separate provider completion from structured-output validation and publication of new outputs.
4. After crash/restart, a sent or uncertain attempt is **not replayed**. If a remote ID exists and the provider supports it, offer status/result retrieval for that same attempt. Verify retrieval behavior/cost; don't assume free polling or a provider idempotency guarantee. If no identifiable remote result exists, show outcome/charge unknown and require explicit authorization for a *new* attempt.
5. A checkpointed response can be revalidated/compiled locally when hashes match. Never pay again because local validation, file writing, UI reconnection or report rendering failed. Unknown usage/billing stays null; old valid output and malformed returned response stay distinguishable.

Exactly-once billing is not promised across a remote/local crash boundary. A request may have reached the provider before its acknowledgement was saved. Persisted intent prevents silent retries at the expense of asking for reconciliation in ambiguous cases. Current providers/pipeline lack complete recoverable stage dispatch/cancellation; this blueprint requires separate integration, not an automatic rerun of `runPipeline` on startup.

Stopping dispatch prevents *new* calls; it does not prove that a remotely running actor stopped or that a charge was refunded. Explicit Exit persists pending/uncertain state and shuts down locally after a bounded grace period. No new attempt ID is issued by recovery itself. A reviewed retry creates a new authorization/attempt and retains the old record.

### File/database commit boundary

The database and filesystem are not one transaction. Build in job-owned staging; validate canonical schemas and inventory; write and sync a completed immutable snapshot; record its committed inventory/path in a metadata transaction; only then advance latest-output references and notify. On startup, ignore incomplete staging, reconcile completed-but-unreferenced snapshots and never mark an absent/corrupt artifact completed. Keep old valid snapshots through failed promotion. Delete abandoned staging only after checking ownership and resolved containment.

Current `src/atomic.js` protects ordinary replacement failures, but its rename-to-backup sequence has a crash window and does not establish power-loss durability. Do not claim it implements this whole commit protocol. Test abrupt termination at file/DB boundaries, out-of-space errors, migration rollback and Windows file locks before release. SQLite transactions don't make external files, network calls or SSD guarantees atomic.

## Credentials, trusted operations and diagnostics

Provider keys are operator-wide named credentials; projects store references/configuration only. Proposed Electron storage uses OS-backed encryption in the privileged process; fail closed if unavailable, with an explicitly session-only alternative. Saved values are write-only from the UI's perspective: show configured/not configured and permit replace/remove, never return the saved key. Exclude secrets from localStorage/IndexedDB, reports, handoffs, snapshots, logs, crash payloads and diagnostic exports. Don't copy existing `.env.local` into a project; importing a key requires a separate visible settings action.

On Windows, Electron's OS storage relies on DPAPI and does not protect against other applications running as the same user. Project evidence itself is not automatically encrypted. Use the supported API of the release-pinned version and test unavailable/decryption-failure cases; don't adopt an API solely from unversioned examples. [safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage).

Renderer has no Node integration, no arbitrary filesystem API or shell commands, no saved secrets and no remote page with privileged IPC. Use isolation/sandboxing, a constrained preload API, origin/sender/schema validation and opaque project/artifact handles resolved by the broker. Untrusted captions, HTML reports and files are data; open report previews without privileged APIs and never execute imported scripts. Normalize/realpath-check chosen files and block traversal, symlink/junction escapes and unapproved extensions before open/write/delete/export. Native dialogs mint limited path capabilities, not general path authorization. [Electron security](https://www.electronjs.org/docs/latest/tutorial/security).

Diagnostics default to structured codes, stage, version, correlation ID and numeric timings/usage. Redaction is allowlist-based: omit profile names, URLs, local paths, captions, request/response text, headers, credentials and arbitrary provider errors. A diagnostic bundle requires preview and explicit export; disable crash upload/telemetry/cloud sync by default. API calls necessarily send authorized selected inputs to providers; "local app" is not "offline analysis". Account configuration alone doesn't authorize those transfers.

## Open, export and delete

| Action | Proposed behavior |
| --- | --- |
| Open report/evidence/output | Resolve an inventoried artifact handle, preserve original, use a safe preview or explicit native open; no arbitrary command strings |
| Open external source | Validated http/https URL opened explicitly in default browser; refuse file/javascript/custom command URLs from imported data |
| Import output/feedback | Copy selected allowed files, hash and bind to exact handoff/task revision; preserve original feedback, don't infer publication acceptance |
| Export for agent | Run current canonical compiler/handoff validation; preview included assets/evidence/status/permission; create immutable portable snapshot; never include settings/keys/registry/logs |
| Export project backup | Separate from agent context; explicitly list private original evidence/history and exclude credentials; validate archive paths, hashes, size/count limits on restore |
| Remove from recent projects | Registry change only; no file deletion |
| Delete project | Show exact project and consequence; stop local jobs, revoke queued dispatch, explain unresolved remote work, then move managed data to app trash before later explicit purge |
| Remove imported/external source | Remove only copied managed bytes/references; never recursively delete a linked external folder or the original CLI project |

Before any destructive action verify resolved absolute containment under that managed project root, including junctions; block deletion of workspace root, installation, credential store, repos or unrelated selected folders. Retain independent exported snapshots unless explicitly selected for deletion. Keys have their own settings removal flow. Trash is recoverable while retained; don't silently purge by age or promise secure erasure. Retention limits require later operator settings/review.

## Interaction and accessibility contract

Keep the accepted flow and minimal direct UI: Projects, Report, Review, Tasks, Files and Settings as destinations, not six mandatory pages. Project summary shows last saved stage and next meaningful action. Show only useful state, with evidence/IDs/technical detail on demand. No editorial SaaS headings or decorative progress claims.

Keyboard can reach project creation/open/resume, settings, recovery, export and Exit without a pointer. Native controls have persistent labels; errors link to fields and focus the first problem; modal close returns focus. Status uses text, not only color, and meaningful transitions use a restrained live region without announcing every poll. Reopening doesn't steal focus on each job update. Completion notification activation opens the appropriate saved state without auto-dispatch. Support zoom/narrow windows, readable tables or stacked summaries, high contrast and reduced motion. Narrator and Windows tray/menu navigation require actual packaged-app testing. Browser prototypes aren't that evidence. [Electron accessibility](https://www.electronjs.org/docs/latest/tutorial/accessibility).

## Bounded implementation backlog

These are proposed follow-up slices, not created/adopted issues or work implemented by #45. Follow #46's spend/progress design before integrating paid controls. Reuse #43's accepted flow and #44's reviewed authority proposal; their production contract work is still outstanding.

| Slice | Deliverable | Acceptance gate |
| --- | --- | --- |
| 1. Windows shell and packaging feasibility | Pinned Electron, minimal local UI, tray/Open/Exit, worker imports of current core and `sharp` | Clean Windows install without Node; renderer crash/window close leaves worker alive; Exit kills it; second instance activates first; package/native import works |
| 2. Managed project/credential broker | Registry, native selection, read-only legacy import, OS-protected keys, redacted errors | Private files stay outside repo/browser storage; source copied unchanged; unavailable key store fails safely; invalid IPC/path/junction/archive blocked |
| 3. Transactional job store and snapshots | SQLite binding/schema, writer ownership, attempt/authorization records and commit/recovery protocol | Kill at every commit boundary, out-of-space/locks; preserve last valid snapshot; unknown attempt never resends; metadata migration rollback |
| 4. Core stage integration | Bounded phase planning/caching/remote reconciliation, report and translation coverage, CLI write coordination | Synthetic cache/validation/stale cases, real module-level integration; no automatic paid retry; current contracts preserved |
| 5. Review and task contracts | Separate reviewed schema/authority implementation from #44; relevant questions and invalidation | Existing strict CLI compatibility/migration fixtures; unknown fact/permission remains bounded; corrections preserve history |
| 6. Handoff and result history | Generic exporter, optional adapter, portable inventories and original feedback | Canonical readback/byte checks; no keys/config/private diagnostics leaked; old deliveries immutable; rendering/publication remains human acceptance |
| 7. First-use and progress wiring | Guided screens, scope/authorization, reconnect, optional generic notifications | #46 maps actual journals/attempts and unknowns; keyboard/Narrator/high-contrast/zoom review in packaged app |
| 8. Release/update acceptance | Versioned migrations, installer signing strategy, explicit update/install and retained projects | Install/upgrade/uninstall on Windows; no force paid-work restart; database/evidence/credentials preserved as promised |

Manual version checks/updates are the initial recommendation; no silent updater launch/restart or telemetry. A signing/distribution strategy, precise Windows support floor and installer format remain release work, not promised by the platform choice. [Electron updates](https://www.electronjs.org/docs/latest/tutorial/updates).

## Evidence and limits

Platform sources were checked 2026-10-03. The existing code was inspected at main `4b50917`: Node >=20, `sharp`, core data/output-root options, separate report stage, private `brand-run/v1` attempts, ingestion's retained manual/brief/runs and current replacement helpers. These establish reuse points and gaps, not app guarantees.

An isolated synthetic lifecycle spike in [`prototypes/job-lifecycle`](../prototypes/job-lifecycle/README.md) tests the specific uncertainty around a lost UI observer, worker termination and a persisted paid-intent boundary. It has no Electron, SQLite, actual provider, credentials, real cases or core import; it is not production persistence. Verification results are recorded there after execution. It cannot establish tray/installer behavior, power-loss durability, encryption, remote cancellation, SQLite transactions, native-module packaging or accessibility.

The next decision is implementation sequencing after this blueprint and #46, not another paid design run or a visual-polishing round.
