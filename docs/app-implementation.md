# Local app implementation sequence

The operator reviewed and merged the #45/#46 proposals. [Integration PR #59](https://github.com/ValenFelizia/instagram-to-opendesign/pull/59) is verified on main at `4993c15` on 2026-10-04; #46 is closed and VAL-107 Done for its specification/prototype scope. The user authorized app implementation. The [Windows executable shell](windows-app-shell.md) and [managed projects/credentials](managed-projects.md) are merged through PR 60/61 at `dd4a1db`; clean-install/native accessibility acceptance remains pending. Issue 53 supplies the [transactional persistence kernel](transactional-jobs.md) for source review, using synthetic material only. Product priorities remain in [VAL-100](https://linear.app/valenf/issue/VAL-100/deliver-a-guided-workflow-from-brand-evidence-to-useful-creative-agent-context); later issues remain backlog, not completed capabilities or authorization to publish a release.

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

Issues #51/#52 source is integrated; their native manual gates remain open. The operator also merged PR #62/#63, verified main c7739d7: issues #53/#54 are closed for transactional jobs and the [privileged recoverable pipeline](recoverable-pipeline.md). Issue #55 now supplies [versioned task authority](task-authority.md) for source review, with explicit exploration/selection/acceptance, retained sourced correction history and task-specific invalidation. History/export integration is #56 and guided confirmations/progress #57. Paid execution remains unavailable from the renderer until #57 exposes the enforced scope. UI polishing remains deferred; initial labels should be direct and minimal. Hosted services, continuous sync, telemetry by default, new adapters, naming changes and other OS releases remain outside this sequence.
