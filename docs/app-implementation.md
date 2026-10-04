# Local app implementation sequence

The operator reviewed and merged the #45/#46 proposals. On 2026-10-04, PR #49 is reachable from main at `86bcf94`; PR #50 merged into its old parent branch at `391a157`, so [integration PR #59](https://github.com/ValenFelizia/instagram-to-opendesign/pull/59) is needed before #46 can close. No production app is implemented. Product priorities remain in [VAL-100](https://linear.app/valenf/issue/VAL-100/deliver-a-guided-workflow-from-brand-evidence-to-useful-creative-agent-context); the issues below are technical backlog, not completed capabilities or authorization to publish a release.

Use the accepted DEC-011 platform direction, [workspace blueprint](local-workspace.md), [selective-review proposal](selective-review.md) and [spend/progress specification](spend-progress.md). Each issue specifies acceptance and dependencies. Preserve CLI compatibility, private local storage, actual evidence/authority and explicit paid consent. Use synthetic fixtures; no private case publication or live paid run is required.

| Sequence | Technical issue | Dependencies | Main acceptance gate |
| --- | --- | --- | --- |
| 1 | [#51: Windows shell and native packaging](https://github.com/ValenFelizia/instagram-to-opendesign/issues/51) | None after proposal integration | Clean Windows install without Node; core/sharp imports; window close, renderer failure, Open/Exit and single instance |
| 2 | [#52: Projects and credential broker](https://github.com/ValenFelizia/instagram-to-opendesign/issues/52) | #51 | Managed files outside repo, unchanged legacy sources, OS-protected keys, validated IPC/paths/archives and redacted errors |
| 3 | [#53: Transactional jobs and snapshots](https://github.com/ValenFelizia/instagram-to-opendesign/issues/53) | #51, #52 | Writer fencing, revision-bound authorization, crash/commit recovery and retained valid outputs; uncertain attempts never auto-resend |
| 4 | [#54: Core stages and request accounting](https://github.com/ValenFelizia/instagram-to-opendesign/issues/54) | #53 | Response checkpoints/reconciliation, standalone and translation coverage, explicit report/export stages, cache invalidation |
| 4 | [#55: Review and task contracts](https://github.com/ValenFelizia/instagram-to-opendesign/issues/55) | #53 | Explicit authority/schema decisions, sourced corrections, bounded exploration and compatibility with current strict CLI |
| 5 | [#56: Handoff, history and external effort](https://github.com/ValenFelizia/instagram-to-opendesign/issues/56) | #52–#55 | Portable byte-verified export, immutable deliveries, original feedback, explicit supplied accounting with provenance |
| 6 | [#57: Guided UI and actual progress](https://github.com/ValenFelizia/instagram-to-opendesign/issues/57) | #51–#56 | Real job state/partial inventory, shared-attempt dedup, null/mixed spend, scoped confirmation and packaged keyboard/Narrator review |
| 7 | [#58: Windows release acceptance](https://github.com/ValenFelizia/instagram-to-opendesign/issues/58) | #51, #57 | Install/upgrade/rollback/uninstall preserve the declared local data; explicit updates and documented signing/support limits |

## Coverage of #46's implementation gaps

- Authorization, ownership, stale consent and concurrent dispatch: #53, with enforcement during #54 and UI binding in #57.
- Standalone/direction/translation instrumentation, report/export status and private response recovery: #54; stable observations stay distinct from proposed UI states.
- Cross-task/revision accounting projection, conflicting IDs, token subsets, tiny costs, unknown bills and mixed currencies: #57.
- Allowlisted diagnostics and credential/path privacy: #52; accessible errors/status/notifications in #57.
- Optional externally supplied generation effort and honest coverage gaps: #56. No universal capture or historical invoice backfill.

Start with #51 after the specification/prototype reaches main. The shell verifies the first packaging/lifecycle uncertainty; it does not authorize paid execution before #53/#54/#57 enforce and expose the corresponding scope. UI polishing remains deferred; initial labels should be direct and minimal. Hosted services, continuous sync, telemetry by default, new adapters, naming changes and other OS releases remain outside this sequence.
