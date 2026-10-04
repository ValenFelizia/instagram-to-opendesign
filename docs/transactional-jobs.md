# Transactional jobs and immutable snapshots

Tracking: [issue 53](https://github.com/ValenFelizia/instagram-to-opendesign/issues/53), VAL-100. The shell and managed-project source are merged through PR 60/61 at `dd4a1db`. Their native accessibility/installation gates remain open. This increment supplies a privileged persistence kernel; real core-stage orchestration is issue 54 and guided job controls are issue 57. Creating/opening projects still does not dispatch analysis.

## Runtime and records

The app uses Electron's bundled `node:sqlite` `DatabaseSync`, not an external native binding. The CLI keeps its Node >=20 contract: its portable filesystem interlock does not import SQLite. Development/tests use Node 24. The binding is tested inside the packaged executable without an external Node executable on PATH. [Node SQLite API](https://nodejs.org/api/sqlite.html).

`workspace/jobs/jobs.sqlite` has schema version 2, foreign keys, strict tables, rollback journaling and FULL synchronous mode. Each migration is one transaction; a newer version or unreadable database fails closed without replacing the database. Version 2 adds the [pipeline recipe/request/stage records](recoverable-pipeline.md); the version 1 kernel tables retain their contracts. The existing bounded JSON project registry and protected credentials remain separate. Large files live in inventoried project snapshots, not database blobs.

| Record | Authority |
| --- | --- |
| Plan | Project/task, operation, provider/model/configuration revision, task revision and frozen input inventory hash |
| Job | Opaque ID, plan/input reference, six-state status, writer epoch, fixed diagnostic code, optional output reference |
| Authorization | Single-use token bound to one job/plan and current main-process session; revoked on restart or project move |
| Attempt | Unique job/authorization, persisted intent before invoking the provider callback, acknowledged remote ID or uncertain outcome; optional original observation ID |
| Snapshot | Unique owner/session, input/output kind, preparing/ready/committed state, exact inventory and SHA-256 |
| Latest | Project/task pointer advanced only with a validated committed snapshot |

No keys, request/response text, URLs or arbitrary error payloads are copied into the kernel records above. Version 2's separate pipeline request metadata retains returned usage/billing and phase provenance; private raw payloads live in project files. `brand-run/v1` remains compatible. Issue 54 integrates response checkpoints and canonical schema validation; an acknowledged fake response alone is not a recoverable provider response.

## Authorization and ownership

1. `createJob` freezes the current bounded input tree and records the plan. Identical requests reuse the same job; no paid call occurs.
2. `authorize` requires the exact plan hash and current inputs/configuration. Settings and saved old authorizations confer no dispatch permission.
3. `dispatch` atomically consumes authorization, claims a unique attempt and records intent before calling the privileged callback. The callback receives the frozen input directory, scope and fencing token. At most one provider callback can be active across this store; one writer owns each project.
4. Changed bytes, configuration, task plan, foreign session or duplicate clicks cannot reuse authorization. Main's provider configuration revision includes provider/model and the protected credential record hash, never the plaintext key. Changed protected records invalidate old plans.
5. A lost acknowledgement is uncertain even if the provider never received the request. Reopening/restarting never calls a provider. `retryJob` explicitly creates a new plan/job, preserves the old attempt and requires fresh authorization; it does not dispatch. Same-attempt remote retrieval belongs to issue 54.

The main process holds a lifetime SQLite `BEGIN IMMEDIATE` transaction in the separate `writer.sqlite` database. Another store/process cannot open a writer while that transaction is held. Each filesystem mutation additionally claims a project `.writer-guard` directory using exclusive creation and an opaque token. Every dispatch/promotion checks the database lease, current session and matching marker. [SQLite writer locking](https://www.sqlite.org/lockingv3.html).

Recovery never guesses ownership from age or PID. After obtaining the exclusive SQLite writer, it reclaims only app markers matching the persisted workspace/session/token. Unknown, incomplete and CLI/workspace markers remain blocked for explicit repair. A worker from an old session has no promotion authority; it must never receive canonical/latest-output write access. Issue 54 must restrict workers to their isolated input/output staging and keep all promotions in main.

The provided CLI acquires the same marker for app-managed input and explicit output paths. Standalone legacy folders keep their existing workflow. Backup/trash/restore also claim the marker; backups exclude that control directory and project moves revoke job authorization. A project directory backup contains its evidence/snapshots, not the workspace-wide job/authorization database; portable job-history restore is not implemented. A crashed CLI/workspace operation may retain a fail-closed marker; stop all writers, preserve a backup and inspect the matching project identity before manual repair. There is no automatic timeout or destructive repair button. Arbitrary external programs and direct core API callers do not participate in this interlock.

## Snapshot commit and recovery

| Boundary | Recovery |
| --- | --- |
| Insert preparing record; write isolated `staging/<session>/<uuid>/payload` | Retain incomplete staging; never publish it |
| Require synchronous explicit validation; inventory/hash and sync each file; write/sync manifest | Invalid, changed, linked, unsupported or oversized content cannot become ready |
| Rename fresh staging directory to `snapshots/<uuid>` | A crash before the ready database record leaves an unreferenced snapshot, not completed work |
| Record ready inventory, then bind output to job | Ready alone does not advance latest |
| Validate bytes, inputs/configuration and ownership; transactionally commit snapshot/job/latest | All three metadata changes commit together; otherwise prior latest remains |
| Restart with ready output already bound to job | Only matching, valid, current output can finish local promotion under a fresh writer lease; paid jobs also require the retained acknowledged attempt |
| Latest output missing or corrupt | Mark it unavailable and select a prior valid committed output; a live view also refuses to present missing/corrupt bytes as completed |

Snapshots are append-only through the API; filesystem editing is detected through inventories, not prevented by OS permissions. Recovery retains abandoned staging and unreferenced snapshots rather than deleting or adopting unknown files. Retention/cleanup settings are later work. Copies currently include the whole bounded input tree: selective dependency invalidation/cache planning belongs to issue 54/55, so changing an unrelated input can conservatively require replanning.

The filesystem and database are not a single transaction. This protocol handles tested process interruption and ordinary storage failure; it does not guarantee power-loss durability, exactly-once remote execution/billing, remote cancellation, disk/SSD behavior or network/synchronized storage. Explicit Exit fences late results, persists uncertainty where possible and releases ownership; if persistence itself fails, restart reconciles retained running/intent records.

## States and next actions

| State | Next action |
| --- | --- |
| queued | Explicit authorization; stale plan requires replanning |
| running | Wait for the current writer; no duplicate dispatch |
| review-required | Review retained response/context; stale plan requires replanning |
| failed | Repair/replan; preserve previous valid output |
| interrupted | Reconcile uncertain attempt, or explicitly authorize/replan local work |
| completed | Open retained validated output; earlier revisions remain history |

The kernel exposes opaque IDs, fixed diagnostics, staleness and action codes to the future controller. It is not yet renderer IPC, a scheduler, progress accounting or a finished recovery UI.

## Verification

`test/jobs.test.js` uses synthetic temporary projects, actual SQLite files and separate disposable processes. Tests kill processes at intent/lost-ack boundaries and six file/DB commit boundaries; check stale input/configuration/task confirmation, double-clicks, explicit retry without inherited permission, CLI/app contention, unknown markers, missing outputs, rejected validators, restart/move revocation, late responses and migration rollback/newer-version refusal. Actual SQLite writer locks/capacity limits and Windows `FileShare.None` exercise real storage failures. No drive is deliberately filled; SQLite FULL is real, while whole-disk filesystem ENOSPC remains a release-environment limitation.

`desktop/verify.mjs --packaged` imports this kernel from ASAR, runs a fake attempt and inventoried snapshot, closes/reopens its SQLite store and checks retention. The existing actual packaged shell/project/DPAPI/lifecycle checks remain required. The ASAR allowlist includes the kernel and portable interlock and excludes private material/configuration.

Local checkpoint, 2026-10-04: full 111/111 synthetic suite passed, followed by 28/28 focused persistence/broker checks and 17/17 final job checks including altered metadata. Actual packaged Electron 44.5.1 ran SQLite 3.53.4 and the retained shell/projects/DPAPI checks. The final unsigned NSIS build and 648-entry package/source-byte audit passed. Windows CI is separate evidence after execution.

No provider request, actual business project or saved real credential is needed. Native picker/Narrator/clean install remain issues 51/52/58. Future integration must preserve these authorization, ownership and inventory gates rather than calling the old pipeline directly against a live project.
