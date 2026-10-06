# Selective review and task authority

Tracking: [issue 55](https://github.com/ValenFelizia/instagram-to-opendesign/issues/55), VAL-100. This implements the reviewed [selective-review proposal](selective-review.md) through explicit new versions. It is a privileged main/core API, not guided renderer controls, an identity-verification service or a publication operation. Only synthetic material is used for verification.

## Contract decisions

| Contract | Meaning and compatibility |
| --- | --- |
| `exploration-request/v1` → `exploratory-context/v1` | A goal can produce bounded draft context without selecting execution. Hypotheses and candidate copy stay proposals; unapproved originals become placeholders without reusable paths. Applicable confirmed rules/copy remain constraints. |
| `design-request/v1` → `design-brief/v1` | Existing CLI validation, selected-asset/copy/direction/accessibility gates and cache semantics remain unchanged. New enum values and fields are refused under v1. |
| `design-request/v2` → `design-brief/v2` | Explicit app task input, accepted only through the versioned task API. Adds bounded conceptual landings and explicit inference bindings. Selected website edits require current authorized code context. Complete inputs have status `inputs-ready`, never automatic human execution approval. |
| `brand-decisions/v2` | An explicit sourced correction retains v1 fields plus typed before/after history. Existing v1 documents are not automatically migrated. Both versions preserve inference acceptance as a proposal. |
| `task-authority/v1` | Managed-project local task requests, directions, reviewed execution keys, exact publication records, revocations and history. It remains outside the frozen analysis input. |

These are implementation decisions for this source PR; there is no silent reinterpretation or blanket promotion of the earlier prototype. A new selected task must supply a complete v2 request and directions bound to its current context. The old `design-request.json` is not rewritten by task selection, and existing frozen deliveries are not modified. Generic delivery/history integration follows in issue 56; existing CLI exporters do not accept a goal-only envelope or a v2 document implicitly.

Conceptual landings require a confirmed audience/copy/action, target viewport, at least one authorized selected image and an explicit page scope: one to six unique sections from hero/products/about/process/contact/faq, including hero. Unknown business data must be omitted or raised as a question. This is a page-level conceptual request, not a renamed hero or permission to deploy. An earlier goal-only exploration can use placeholders and ask for those decisions.

## Portable context and selective dependencies

`src/task-authority.js` exports local preparation helpers through `src/core.js`. `prepareExploration(profileDir, request)` retains source attribution, uncertainty, current confirmation and relevant proposal decisions. Rejected/stale inference values are not recommended. A conflicting draft does not replace current confirmed copy. Source prose is evidence, never tool instructions. Local design permission does not imply publication rights.

`prepareSelectedTask(profileDir, request, directions)` reuses the actual canonical copy, asset provenance/permissions, fit/alt/resolution, scoped rules, direction and accessibility validators. Actual code files are hashed. Missing confirmation, stale evidence, unauthorized originals, unselected/stale directions or absent authorized editing context leave execution blocked. No provider is called.

V2 binds only explicitly selected inference IDs and sources used by the request, scoped rules, selected assets and code. A social-only correction does not invalidate a website approval. Relevant source/configuration/asset/code changes require new review; changing back a value does not revive an observed revocation. Selected request/direction changes always archive the old execution and publication authority. Legacy v1 cache behavior remains conservatively unchanged.

## Managed-project API

`desktop/task-authority.cjs` detaches submitted task/direction/review/correction arguments before asynchronous preparation, holds the job store's project lease during each operation and checks source inventory, authority revision and external code/artifact bytes before commit. Source/model text and renderer messages cannot invoke it; issue 57 must expose separately validated operator actions. Reviewer fields record explicit operator attestations, not cryptographic proof of identity, ownership or legal rights.

- `create(project, explorationRequest)` saves a draft task. It grants neither execution nor publication.
- `select(project, taskId, revision, requestV2, directions)` explicitly replaces the task input and archives dependent authority. Pending input can be saved.
- `preview(project, taskId)` reports relevant questions and current input key; observed stale authority is persistently revoked. It makes no provider call.
- `reviewExecution(project, taskId, revision, expectedKey, reviewer)` records a new human execution review only when the exact current inputs are complete. Opening or selecting a task does not perform this transition.
- `correctionPreview(project, command)` shows old/new rule values, base document hash and affected tasks. `correct(project, command, acknowledgment)` requires that exact preview hash and affected-task list.
- `acceptPublication(project, taskId, revision, input)` records human acceptance of exact artifact bytes for a specific platform/use. It returns `publicationOperationAuthorized: false`; sending, merging, deploying or uploading remains a separate operation.

The local task document uses optimistic revisions, retained original requests/directions and before/after history. Atomic checked writes flush the staged file before replacing the previous record. Bounds are 100 tasks, 1,000 history events and 16 MiB per authority document. No automatic history purge is introduced. Explicit project backups include this private history, but relocating/rebinding it to another project identity is later issue-56 work; unknown identities fail closed.

## Sourced corrections

A correction requires a current base hash, stable rule identity/scope/target, reason and a **new** source ID/file with current SHA-256, reviewer and timestamp. Original evidence is never overwritten. The corrected rule, source registration and complete typed before/after history commit as one `brand-decisions/v2` document. History chains must match the current rule/decision; unsupported changes or reused provenance are rejected. Subsequent scoped report inference imports preserve v2 history and never verify an inference.

The canonical correction and task-history write are separate durable file commits. If the second write fails, the sourced correction remains visible with its complete history; every execution check recomputes dependencies and refuses stale authority even before its revocation is persisted. The operator can reopen and inspect that partial result. No atomicity across SQLite and multiple files, power-loss guarantee or automatic replay is claimed. Unaffected approvals and prior valid generated outputs remain available; nothing reruns or deletes an artifact.

## Exact publication acceptance

Publication requires a current reviewed execution ID, one to 100 explicitly selected files under the managed project's `results/`, exact SHA-256 values, an explicit platform/use and a separately supplied scoped publication grant covering the selected assets. Missing/unknown permission or a local-design record alone is insufficient. Files are bounded to 32 MiB each and 256 MiB total; linked/aliased paths and traversal are rejected.

The rendered-review attestation binds the execution ID and sorted artifact inventory hash to a current registered human source. Web tasks require contrast, legibility, image alternatives, keyboard, responsive and behavior review. Static tasks require contrast, legibility, alternatives, transcription, platform overlays and destination review. These are explicit human checks, not automatically inferred from a screenshot or input preflight. The grant and rendered-review source hashes are retained with acceptance.

Changed/missing output bytes, rights sources, rendered-review sources or execution inputs revoke that acceptance. Restoring bytes after an observed revocation does not make the old record current. Acceptance is limited to this artifact/platform/use, never an unrelated variant, later revision, upload or deployment.

## Verification and remaining work

`test/task-authority.test.js` covers goal-only exploration/placeholders, explicit version rejection, conceptual scope and editing requirements, durable review/reopen, sourced corrections and unrelated channel approval, retained inference history, failure between correction/history writes, changed/restored sources and artifacts, explicit publication rights/checks, path rejection, writer contention and late callback fencing. Legacy brief/decision/report-review tests retain the v1 gates.

`desktop/verify.mjs --packaged` invokes this API inside actual Electron, selects/reviews v2 input, closes/reopens SQLite, observes the same reviewed execution and then revokes it after source changes without granting publication. Package audit checks current authority/core bytes and excludes private project data.

These checks do not establish actual rendered accessibility, legal permission, production creative quality, native Narrator acceptance or clean installation. Task-specific delivery/history remains issue 56; renderer workflow and scoped paid controls remain issue 57; release/native gates remain issues 51/52/58. Direct minimal UI and Spanish report defaults are unchanged.
