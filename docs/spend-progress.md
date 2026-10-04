# Paid actions, reuse and progress

**Status: reviewable specification and isolated synthetic prototype.** Tracking: [GitHub issue 46](https://github.com/ValenFelizia/instagram-to-opendesign/issues/46) / [VAL-107](https://linear.app/valenf/issue/VAL-107/make-paid-actions-cache-reuse-and-run-progress-understandable). Open [`prototypes/spend-progress/index.html`](../prototypes/spend-progress/index.html). No provider spending, pricing lookup, production journal changes, durable scheduler or app integration is included.

The operator merged [PR #49](https://github.com/ValenFelizia/instagram-to-opendesign/pull/49) into main and [PR #50](https://github.com/ValenFelizia/instagram-to-opendesign/pull/50) into the old parent branch. [PR #59](https://github.com/ValenFelizia/instagram-to-opendesign/pull/59) is now verified on main at `4993c15`; #46 is closed and VAL-107 Done for specification/prototype deliverables. Paid integration remains separate from the first executable shell in #51.

The operator accepted the onboarding flow and direct, minimal UI; visual polishing remains deferred. DEC-011 selects Windows-first Electron with managed local projects, background work after closing the view and explicit Exit. This specification follows the [workspace blueprint](local-workspace.md), still under PR #49 review at the start of this work, and preserves existing selected-brief authority.

## Surfaces

Keep one useful project/task view: **Next action**, **Stages**, **Available** and **Recorded spend**. Technical detail and per-attempt usage remain expandable. The next action explains only what changes the decision; it does not repeat the whole dossier. Current job status and previous saved stage observations remain visibly distinct. Shared preparation is project-level history, not a new bill on every task.

| State | Primary message | Action and consequence |
| --- | --- | --- |
| No sources | "Traer el perfil"; no matching local sources | Review intake scope before dispatch; at most the specified Actor executions/publication count |
| Valid reusable context | "Preparar con lo guardado"; list reused sources/analysis/colors | Local compilation/Spanish report, no new provider authorization; old charges remain in history |
| Reanalysis needed/requested | Explain changed inputs or explicit force action | Review provider/model, data sent and call limits; source reuse does not make new analysis free |
| Running | Real current stage and last saved results | Leave/reopen the view without restarting; optionally stop remaining dispatch |
| Human review | Sources ready; image classification or authority decision pending | Review what changes the next stage; do not imply a provider is still working |
| Response incomplete | Usage/billing may exist despite failure | Retain response status, old output and observations; a new attempt needs new scoped consent |
| Local failure after valid response checkpoint | Valid response is recoverable; output wasn't committed | Local repair/revalidation when hashes match; no replacement request merely to retry a file write |
| Interrupted | Last state cannot establish remote outcome/charge | Explicitly inspect/reconcile the same remote attempt if supported; reopening never retries |
| Stale input | Previous scope no longer authorizes current inputs | Retain history/output; review a new scope and confirm before new paid work |
| Completed | Requested stages validated/committed | Inspect/export current context; creative/rendered/publication acceptance remains separate |

Spanish copy is authored for the operator surface. Project docs remain English; original evidence/brand copy is not changed.

## Before any provider operation

Show purpose, reason a cache cannot satisfy it, reused work, provider/model or Actor, selected data sent, bounded call/data/output configuration and spend knowledge. An API key or old task approval is not paid authorization. Settings changes alone never dispatch. Distinguish **a bound on calls/input/output** from **a monetary cap**; a token limit or estimate does not guarantee a final bill.

The confirmation is bound to project/task, current input/dependency hash, scope revision and provider configuration. If any dependency changes while the confirmation is open, reject it without dispatch and show the new scope. Reopening, failure or refresh cannot carry stale consent into a new request. Cancellation closes the confirmation without granting authority; a paid retry is a new attempt with old history retained.

Default recovery asks before querying the same remote result, explains that it is a lookup of the old attempt rather than a new execution, and retains unknown lookup availability/cost until provider-specific behavior is verified. Never promise free polling or cancellation. When no remote identifier exists, show outcome/charge unknown and offer manual reconciliation before a separately authorized new request. The prototype demonstrates the first path and deliberately does not invent an automatic retry for unknown remote results.

The prototype's explicit checkbox and modal are interaction examples, not a security or durable authorization implementation. The real broker/store must validate scope atomically immediately before dispatch, as proposed in issue 45.

## Meaning of money, usage and time

| Category | Display | Rule |
| --- | --- | --- |
| Estimate | Range, currency, assumptions/rate source and date | Separate from recorded amounts; no estimate without a supplied basis; stale/inapplicable basis stays unavailable |
| Returned billed amount | Amount, ISO currency, source and attempt | Includes failed attempts when observed; only explicit returned zero is zero |
| Missing bill | "Importe no disponible" / "Suma parcial" | Do not infer an invoice from tokens, elapsed time, success or a cache hit |
| Mixed currencies | Separate USD/EUR/etc. subtotals | No conversion or combined number; unknown attempts remain visibly unknown |
| Tokens | Returned input/output and optional detail fields | Cache/reasoning details are subsets, not extra tokens to add; grouped by observed provider/model |
| Software elapsed time | Saved phase/provider duration, separately named | Includes waiting; not human effort, execution percentage or ETA |
| Human effort | Explicit measured operator minutes, if supplied elsewhere | Current journals provide none; show not measured, never derive from software time |
| Local/cache work | No new provider request in this operation | No new request does not establish total historical spend or all earlier bills |

Prototype estimate values are deliberately fictional and labeled as such; their basis is authored for this example, not current provider pricing. All returned usage/billing examples are synthetic observations, not real invoices. No price feed, currency conversion, estimated saving or comparative claim is provided. Valid tiny positive amounts must not round into a displayed zero.

### Deduplication and scope

Aggregate **project observations** using stable attempt IDs, once. Tasks and output revisions link to preparation run/attempt IDs instead of copying their cost into each task. A provider attempt is counted even if its phase later fails validation. Reuse does not remove its original bill. Repeated identical observations are idempotent; conflicting values for the same ID fail visibly instead of silently choosing or adding them. Running observations may evolve in their authoritative store; compare immutable revisions against their exact source snapshot, not two conflicting versions as independent charges.

Compute known amounts by currency and display how many attempts lack billing. Label these sums as recorded/partial, never final total when any relevant amount is missing. Surface instrumentation coverage gaps separately: an observed-attempt subtotal cannot establish a complete project bill when translation/standalone/downstream activity is untracked. Do not count nested token details, phase time and provider time twice. The prototype's aggregate has no human-effort or dollar-from-token calculation.

## Journal/job-to-UI mapping

The production accounting source is `src/run-record.js` and [`brand-run/v1`](run-accounting.md), inspected without modification. The proposed app job store owns queue/restart/staleness/authorization; the accounting journal does not prove worker liveness or permission to spend.

| Input | Projection | Provenance and limit |
| --- | --- | --- |
| `record.id`, `phase.id`, `attempt.id` | Stable history/dedup keys in technical detail | Reuse IDs; no new ID on read/reopen; different retries retain different attempts |
| `record.status` (`complete`, `review-required`, `failed`, `running`) | Completed, Review required, Failed, last recorded running | A persisted `running` record alone does not prove an active worker; app ownership may map it to Interrupted |
| `phase.name/status/mode` | Named stage, status and local/cache/provider/unknown mode | Only reached phases are observed; unreached stages say not started; no progress percentage |
| `attempt.provider/model/configuration` | Actual observed provider/model in detail | Planned values are separate; custom providers/configuration may remain unknown |
| `attempt.billing.amount/currency/source` | Returned amount and currency/source per attempt | Missing is null, not zero; no cross-currency sum; private source details stay local |
| `attempt.usage` | Returned token counters/details | Preserve null/subsets; don't infer prices or bill status |
| `phase.wallMs`, `attempt.wallMs` | Saved stage/provider duration | Distinct measurements that overlap; never add them as human time |
| Proposed job status/ownership | queued/running/interrupted and current view | Not fields added to `brand-run/v1`; needs future supervised lifecycle integration |
| Proposed input hashes/scope revision | Stale scope warning and consent rejection | Current pipeline already fingerprints analysis/colors; app authorization needs its own transaction |
| Proposed response checkpoint/inventories | Available partial data and local recovery | Current journal saves usage, not complete response blobs or durable local-repair checkpoints |
| Current immutable result-review snapshots | Previous artifact/brief/original feedback | Their existence is not approval of current inputs or publication |

`runEffortEvents` currently imports only finished records; the read-only UI prototype can show an unfinished journal's observations without passing it into that importer. It does not rewrite `running` as a finished canonical journal. Reconciliation, retrieval and broker authorization need separate implementation; none is enabled here.

Report/translation aren't counted by `runPipeline`: the CLI builds the report afterward. A completed pipeline must not be labeled "everything completed" if the requested report/export has not finished. An attempted provider can complete while its phase fails; distinguish that from a valid committed output. The prototype's stages label the **last saved record**, and its proposed job status governs the next action.

## Synthetic cases and interactions

| Case | What to inspect |
| --- | --- |
| Profile new | Two bounded intake executions, bill unknown before dispatch; response ends at image review |
| Reusable work | Local start without paid dialog, cached stages, earlier spend retained |
| Reanalysis | Two potential requests; fictional estimate with basis; new unknown bills distinct from old costs |
| Usage without invoice | Returned tokens visible; missing bill never represented as zero |
| Local failure | Failed compilation, valid proposed response checkpoint; repair adds local result without another provider attempt |
| Incomplete response | Failed attempt retains token usage; explicit new scope/dialog before retry |
| Interrupted work | No automatic dispatch; scoped same-attempt lookup; remaining color request gets its own later confirmation |
| Awaiting review | Evidence available; no paid continuation until revised scope is confirmed |
| Different currencies | Separate known subtotals; no combined amount or conversion |
| Shared preparation | Two task references, stable run IDs, original preparation counted once |

The view can be left/reopened in memory; a synthetic restart demonstrates interruption. A real page reload resets the fictional state. A source change, including while the paid modal is open, invalidates the old scope. The UI never invokes the core or exporters, persists keys/data, opens remote links or starts providers. Available outputs are labeled fictional content, not fake download links.

## Accessible interaction

Use native labeled select/buttons/checkbox/dialog/disclosures, a skip link, visible focus and text status. Paid dialogs focus the confirmation, expose linked required-field errors, support Escape/cancel and restore focus. After accepted transitions focus the state heading or next meaningful control. Scenario selection keeps focus; leaving/reopening and updates don't add an automatic navigation/retry. Announce meaningful transitions politely and critical errors directly; no polling announcements, indeterminate spinner-only state or color-only progress. Narrow layouts, zoom, high contrast and reduced motion must keep status, currency and next action readable. Packaged Windows/Narrator verification remains separate.

## Bounded follow-up implementation mapping

After operator review, these gaps are allocated to bounded [implementation issues #51–#58](app-implementation.md), with dependencies and acceptance evidence. They remain **unimplemented backlog**; Linear retains product acceptance. Preserve no automatic paid retries and current CLI compatibility/readiness throughout.

| Gap | Proposed implementation | Acceptance evidence |
| --- | --- | --- |
| Authorization/ownership | Couple app scope revision, provider config and input hashes to job/attempt transaction from #45 | Stale-modal/config/restart/double-click/concurrent writer cases cannot dispatch twice |
| Stage coverage | Add compatible instrumentation for standalone ingestion/analyzer/color/direction operations and report translation | Each actual request receives a stable attempt ID with usage/failure retained; no new call merely to measure it |
| Report/export status | Plan local report/compile/export as explicit requested stages | Pipeline success followed by report/export failure doesn't claim overall completion; valid prior files remain |
| Response recovery | Checkpoint validated/unvalidated response and remote ID privately, stage-aware provider retrieval | Lost acknowledgement stays unknown; query/revalidate same attempt; no repeat paid call for local write failure |
| Aggregation | Read-only projection of evolving attempt store plus immutable snapshot references | Cross-task/revision dedup, conflicting ID observations, null/zero, tiny amounts, mixed currencies and partial coverage |
| Progress | Join accounting observations with actual worker/job ownership and partial inventory | Stage labels, review pause, stop remaining dispatch, reconnect/crash/restart and old outputs reflect actual state |
| Diagnostics/accessibility | Allowlisted broker errors and UI status/focus/notification integration | No secret/profile/path/raw payload leak; packaged keyboard/Narrator/high-contrast/reduced-motion review |
| External generation | Explicitly import supplied agent/provider effort records with source or retain an accounting gap | No implied universal capture or historical invoice backfill; recipient generation stays opt-in |

No universal billing/cancellation guarantee or provider-specific retry feature is assumed. Paid-scope data bounds are proposed surfaces over the current stages; production dispatch must enforce them, not trust UI copy.

## Verification boundary

The [prototype README](../prototypes/spend-progress/README.md) records reproducible model and browser checks. They cover synthetic records and real core journal shape/projection, not prices, invoices, installed app lifecycle, actual provider cancellation, assistive-technology conformance, comparative savings or usefulness across brands. Real/private evidence isn't needed or included. Earlier UI prototypes and production core behavior are unchanged.
