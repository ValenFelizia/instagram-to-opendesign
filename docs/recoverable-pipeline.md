# Recoverable core stages and actual request accounting

Tracking: [issue 54](https://github.com/ValenFelizia/instagram-to-opendesign/issues/54), VAL-100. This source increment depends on [PR 62](https://github.com/ValenFelizia/instagram-to-opendesign/pull/62). It supplies a privileged pipeline API, not paid renderer controls; those remain issue 57. Opening projects and restarting the app do not call providers. Only synthetic providers are used for verification.

## Plan and authority

`desktop/pipeline.cjs` combines the existing core modules with the transactional job store. `plan(project, {taskId, taskRevision, ...options})` freezes the current input and binds the full recipe to the job hash. `preview` reports planned stages, local/source-cache information and conservative possible-provider work; `stages` reads recorded progress. Neither calls a provider or modifies the frozen cache. The preview is not a price or duration estimate.

The recipe specifies ingestion, evidence, analysis, colors, optional OpenDesign compilation, optional directions, report and optional generic export. App plans default to a Spanish report without a mandatory OpenDesign package. `includePackage: true` explicitly selects that adapter; the existing CLI keeps compilation enabled. Generic export uses the existing canonical brief/handoff validators and preserves exploration/readiness boundaries.

Configuration fingerprints include fixed provider/model/output settings and protected credential revisions. The operator authorizes the exact plan hash through a current-session, single-use token. Source/task changes invalidate dispatch authority. Credential changes invalidate authorization before the next request. New paid attempts require a new plan (`retryJob` for the same failed scope) and fresh authorization; the old authorization is never inherited.

Limits are part of the recipe: 1–25 posts, at most six authorized POST calls, bounded total requests (including provider GETs and media downloads), outbound body bytes and downloaded media bytes. Defaults permit five POSTs, 128 requests, 96 MiB per outbound provider body and 64 MiB of media downloads. These are local request/data limits, not a total dollar cap. Each Apify actor start retains the existing explicit USD 2 remote cap. OpenAI still returns usage, not a bill. A later stage cannot exceed the reviewed limits merely because an earlier stage succeeded. Fixed settings are not a new provider/model-selection decision.

`run(id, authorization)` executes only a queued plan. Main holds the project lease throughout asynchronous core work, checks ownership/current inputs/configuration before dispatch and promotion, and writes only to a fresh staging directory. It keeps credentials in main-owned callbacks and transient request headers. No key is returned through IPC, copied into a worker environment, or saved in a checkpoint.

## Private request protocol

`src/request-checkpoints.js` wraps the actual provider HTTP transport. Standalone ingestion, analysis, colors, directions and English translation use it automatically when making requests. Default and explicitly supplied Apify adapters are covered. A custom provider which makes requests outside the supplied transport must supply its own accounting; no universal capture claim is made.

Each actual HTTP request gets a UUID, stage, request fingerprint and persisted intent before dispatch. The fingerprint hashes the method, URL and body; headers, credentials, request URLs and request bodies are not saved. A response has an observed metadata checkpoint followed by a separately hashed private payload checkpoint, both flushed before returning to the provider's JSON/semantic validators. Invalid output, schema errors and subsequent artifact write failures therefore preserve returned usage/billing and the remote ID. Unknown usage or bills stay null. Lost metadata/body or disk exhaustion never triggers an automatic request.

| State | Meaning and next step |
| --- | --- |
| `intent` / `uncertain` | A response is not durably available; reconcile the original attempt, never automatically resend |
| `observed` | Returned identity/usage/billing is saved but the response payload is unavailable; explicit supported retrieval or manual reconciliation |
| `saved` | The original response is available for local revalidation under the exact request fingerprint |

Standalone files live under `runs/requests/`. App response files live in the managed project's `requests/`, outside the canonical input and output snapshots; SQLite stores their metadata/identity. The metadata file can retain a more recent observation than SQLite if a later database write failed. Recovery reads only the corresponding recorded identity, synchronizes it under the project lease and validates the saved payload hash. Unknown or changed responses do not confer authority.

Payloads contain private source/provider content. They are not diagnostic exports or agent handoffs and must not enter the public repository. Explicit full-project backups include them; protected credential storage remains outside projects and backups. No automatic retention/purge policy is introduced.

`brand-run/v1` remains compatible and now supports optional directions/report/export phases. Pipeline translation and directions retain their provider summaries before validation. The HTTP request ledger is the detailed source of truth for calls; run summaries and request records are overlapping observations, not separate charges. App records link their originating phase through `observationRef`. Reusing an artifact creates no new request record and does not repeat historical charges.

Apify `usageTotalUsd` is a **cumulative run total**, not a separate bill for each poll. Records explicitly label this meaning; later projections must group observations by remote run and retain their provenance rather than summing repeated totals. Returned amounts may be preliminary. Human minutes, provider invoices, price estimates, currency conversion and externally supplied downstream effort remain separate work.

## Recovery and partial results

Completed stages retain inventoried immutable profile checkpoints. Cached analysis is validated against current source, reviewed evidence/image bytes and its configuration fingerprint; colors additionally bind the current analysis/graphic bytes; directions bind the canonical request context; English translation binds the exact prose and configuration. Only derived caches are copied from prior stage history. Current source, human reviews, permissions and decisions always come from the newly frozen input. Explicitly changed derived files are preserved for canonical validation. A color-only configuration change can reuse analysis; changed source cannot reuse stale analysis.

`run(id, freshLocalAuthorization, {recovery: true})` is an explicit local recovery action. It can replay only the original saved requests with matching fingerprints and identities. It cannot dispatch another POST, GET or media download. A not-yet-executed paid stage requires a newly authorized plan. Recovery can retain another completed partial stage while the parent still needs more authorized work.

`reconcileApify(id, requestId, expectedPlanHash)` explicitly retrieves the **same known run**, with GET-only transport, records lookup provenance and may retrieve its completed dataset within the original result limit. It never starts/resurrects/aborts an actor. Unknown run IDs and unsupported providers require manual reconciliation. OpenAI requests retain `store: false`; no unsupported response lookup or historical invoice reconstruction is claimed. See the official [Apify run retrieval contract](https://docs.apify.com/api/v2/actor-run-get). No retrieval happens at startup, and no claim is made that a lookup is free.

`stop(id)` blocks future dispatch. An already issued remote request can continue and charge; its returned response is still checkpointed while ownership is valid. Explicit Exit closes the store/fences late callbacks and retains uncertainty. Neither action claims remote cancellation. Restart never schedules a paid retry.

The parent job completes only after every requested stage is complete and the final job/plan/stage manifest and inventory commit together. Successful analysis/compilation followed by report/export failure leaves the parent failed, retains partial snapshots and preserves the previous valid latest output. Schema/readiness validation remains in the existing canonical modules; a byte inventory alone is not brand approval or publication acceptance.

## Verification and remaining gates

`test/pipeline-recovery.test.js` uses the real module/provider parsers with fake HTTP responses. It covers standalone failures, usage/billing retention, exact response replay, report/export failure, stage recovery, request/input limits, stopping future dispatch, explicit same-run lookup, English output, source/configuration cache invalidation and consumer-neutral default behavior. `test/jobs.test.js` retains the prior process/SQLite/ownership checks and tests schema-version refusal. SQLite schema version 2 adds recipe, request and stage records through a transaction without changing portable CLI imports.

`desktop/verify.mjs --packaged` runs the core analysis, colors, compiler and report inside the actual executable, simulates a report failure, closes/reopens SQLite and completes recovery with the same request IDs and no extra fake call. It also retains prior project/DPAPI/lifecycle/security checks. The package audit verifies current source bytes and excludes private data. Native image processing uses Node file buffers for long Windows staging paths.

These checks do not establish live billing accuracy, power-loss guarantees, native Narrator acceptance, creative output quality, clean installation or production release readiness. Guided confirmations/progress are issue 57, task authority is issue 55, delivery/history/external effort is issue 56, and installation/release acceptance is issue 58. Synchronous bounded inventory/copy work can still occupy main briefly; no large-project responsiveness claim is made.
