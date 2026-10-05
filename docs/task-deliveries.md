# Task deliveries and local result history

Tracking: [issue #56](https://github.com/ValenFelizia/instagram-to-opendesign/issues/56), VAL-100. This privileged project broker builds on [versioned task authority](task-authority.md). It makes no provider call, sends no message and performs no installation, generation or publication. Native picker/IPC and guided renderer controls follow in #57. Public verification uses fictional material only.

## Contracts and disclosure

`Deliveries` in `desktop/deliveries.cjs` owns managed-project `delivery-history.json` (`delivery-history/v1`). Deliveries, returned result revisions and supplied effort sources are append-only UUID directories under `deliveries/`, `results/` and `sources/`. Every indexed directory records its bounded file inventory and SHA-256 values. The ledger stays private and is not copied into a shareable packet.

`preview(project, taskId, taskRevision, recipient)` returns a hash bound to the current task key/revision, execution review, portable projection, recipient and available original file hashes. `create(..., {recipient, previewHash, paths})` requires that exact preview and explicit relative file selection. Selected reusable image bytes are required; optional evidence and original confirmation documents are withheld by default. A placeholder never supplies an unapproved original. Structured context itself is explicitly disclosed by creating the delivery.

The versioned generic packet reuses `writeAgentHandoff` and `verifyAgentHandoff` from #32 with an explicit `agent-handoff/v2` inventory. V1 CLI/export semantics remain unchanged. The packet contains `START.md`, `BRIEF.md`, `design-brief.json`, `ACCESSIBILITY.md`, `accessibility.json`, selected originals and `handoff.json`:

- A selected `design-brief/v2` retains exact request copy, selected direction, rules/proposals, pending checks, selected asset bytes, source attribution and the reviewed input key. Unselected direction alternatives are omitted.
- Goal-only `exploratory-context/v1` retains hypotheses, candidate copy, confirmed constraints, placeholders and questions. It always grants neither execution nor publication. It uses the generic destination only.
- Only a current explicit #55 execution review produces `selected-execution`. Complete but unreviewed selected input exports as `exploration-only`. Export does not approve it.
- Source/evidence citations retain identifiers, hashes and summaries. Withheld original files have null paths and `included: false`; verification does not pretend their bytes were exported. Explicitly selected originals retain exact bytes.
- Authorized website locations are omitted from request/code context. Relative code filenames and their actual hashes remain, with instructions to grant repository access separately. No repository code is copied. The private canonical task and its input key retain the original authorization.

The portable projection is deliberate: it is not a second full copy of the machine-local request. Its context hash is distinct from the reviewed task key. Readback verifies the package inventory, projected context, recorded task/revision/key and execution ID against the private delivery record. Integrity remains verifiable after moving the folder. It does not authenticate reviewer identity or establish current execution permission on another machine.

No settings, credential broker, diagnostics, provider responses, journals, result history or unrelated project files are traversed for shareable export. Recognizable keys, authorization strings and machine paths in structured context or selected textual originals fail closed instead of silently rewriting source material. This conservative guard is not universal DLP: operators must inspect explicitly selected material, including images, for private content. Sources with machine paths can remain withheld while retaining safe attribution. No automatic redaction changes a confirmed fact.

## Optional OpenDesign files

Selecting `opendesign` for a selected task invokes `adaptTaskHandoff` in the existing OpenDesign package adapter. It reuses the pinned 56-token renderer and confirmed token/font allowlist, adds `DESIGN.md`, `tokens.css`, token origins, a relative-path manifest and `task-adapter/v1` metadata to the same context inventory. Unmapped confirmed token names fail before readiness. Unconfirmed token slots are functional defaults; this adapter does not claim a registered palette.

This is a portable draft source package. It does not install or reserve a catalog entry, mark metadata published, link a repository, communicate with the daemon or start generation. Existing explicit v1 catalog delivery remains a separate compatible API/CLI. No live OpenDesign import/renderer verification is claimed for the new task package.

## Persistence, export and failures

Every mutation holds the existing JobStore project lease and checks its writer fence. Input, task authority, selected originals, authorized code and referenced artifacts are checked before commit. Submitted arguments are detached before asynchronous preparation. Limits remain 32 MiB per file, 256 MiB per tree, 100 explicitly supplied result files, 1,000 entries per ledger collection and 16 MiB for the ledger. Unsupported files, hidden names, traversal, case aliases, hardlinks, symlinks and linked ancestors are rejected.

A staged directory is byte verified, uniquely renamed and then indexed by an atomic JSON ledger write. A failed ledger commit preserves previous valid deliveries. A promoted but unindexed directory remains an explicit orphan in `history()` after reopening; it is never silently adopted as ready. There is no automatic purge, retry or cross-file/SQLite/power-loss atomicity claim. Current integrity checks detect missing/changed files rather than marking them ready.

`export(project, deliveryId, destinationParent)` copies only the already selected packet to a fresh unique directory in an explicitly supplied external parent, verifies its canonical context and every byte, then promotes it. Previous exported folders are never replaced. Partial staging is removed within its checked owned directory. Share destinations cannot overlap the private project or job store. Native selection/confirmation of that parent remains #57; paths are not exposed through renderer IPC.

`readback` distinguishes immutable packet integrity from current execution authority. Changed task inputs/confirmations/code can revoke execution while the archived original packet remains readable. Export refuses a historically reviewed packet whose exact execution ID/key is no longer current; already shared copies cannot receive retroactive revocation, so their entrypoint requires operator confirmation of the current key before execution. Publication acceptance stays with #55 and must bind the actual current rendered artifact and its explicit rights. `publicationAllowed` remains false for delivery/history operations.

Existing explicit project backups include this private ledger and original feedback under the original managed project identity. Unknown/rebound project identities fail closed; this increment does not silently migrate authority to a newly created project or supply a new full-workspace restore wizard. Existing trash/restore retains identity.

## Returned outputs and feedback

`result(project, deliveryId, {sourceRoot, files, feedback, previousId})` reads only explicitly supplied relative files and verifies their hashes; unrelated files in a Downloads directory are not scanned. File kinds are html/screenshot/feedback/supporting. Each `task-result/v1` revision binds the delivery's immutable context/inventory hash, predecessor and first output. Originals are copied without modification into `results/<id>/artifacts/`. Original feedback files and attributed review notes are distinct; notes require a preserved feedback file, reviewer and explicit or unknown request-specific cause.

An incorrect predecessor or source hash refuses the write. Existing revisions are never overwritten; changed return files require another revision. Result history keeps `needs-human-review`, never infers quality, legal rights, rendered accessibility or acceptance from a screenshot. It is destination-neutral and does not require model/vendor/version information for an unknown external generation.

## Explicit supplied effort

`importEffort(project, deliveryId, {sourceRoot, sourcePath, sha256, sourceId})` imports a bounded JSON file with `external-effort/v1`, the same stable `sourceId` and `records`. The original file bytes and digest are retained privately. Each observation has exactly:

```json
{
  "provider": "fictional-agent",
  "attemptId": "request-1",
  "kind": "generation",
  "wallMs": 1200,
  "humanMinutes": null,
  "usage": { "inputTokens": 10, "outputTokens": 2 },
  "billing": { "chargeId": "bill-1", "amount": 0.02, "currency": "USD", "basis": "returned-bill" }
}
```

Kinds are generation/prompt/manual-edit/review. Durations, usage and billing may be null; supplied zeros remain known zeros. Billing needs an explicit returned-bill/supplied-invoice basis and stable charge ID. The importer does not discover invoices or turn token usage into costs.

Attempts deduplicate by provider/attempt ID across the project, with original source and delivery attribution retained. Reimporting a stable source/hash is idempotent; changed source bytes or conflicting observations fail visibly. Identical observations in another supplied source add provenance without another charge/attempt. Charges additionally deduplicate by provider/charge ID across distinct attempts; contradictory amounts, currency or basis fail. Operators must normalize provider IDs, attempt/charge aliases and overlapping cumulative-versus-itemized invoices; there is no universal reconciliation or billing-authentication claim.

Summaries show supplied cost by currency. A single total stays null for mixed currencies or unknown bills. Supplied attempt wall time is the sum of distinct supplied durations, **not elapsed project time**. Human minutes and summed attempt duration stay null if any included observation is unknown. All fields describe supplied records only: absent recipient instrumentation and unreported attempts, bills, time or human work are explicitly unknown. Existing internal #54 request accounting stays separate; importing external records does not add those internal charges again automatically or backfill history.

## Verification

`test/task-delivery.test.js` covers portable readback, disclosure, stale preview, changed packets, exploration/unreviewed authority, actual selected source bytes, configuration/path exclusion, optional adapter mapping, immutable first/subsequent results, original feedback, supplied attempt/charge deduplication, conflicts, null/mixed observations, failure/orphans, export fencing, hardlink/traversal, writer contention and argument detachment. Existing generic/legacy delivery tests retain v1 compatibility.

Actual packaged verification exercises the OpenDesign file adapter, portable export, original feedback, idempotent supplied effort and SQLite reopening with no Node on PATH or network. Clean installation, native picker/Narrator interaction, actual design quality and legal/rendered publication checks remain separate gates.
