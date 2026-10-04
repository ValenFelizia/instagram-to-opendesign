# TODO

## In Progress

## Ready to Land

- [ ] GitHub #51 — Build a Windows Electron shell and verify native core packaging.
  - Owner: Valentin Felizia
  - Agent: Codex
  - Scope: desktop shell/worker/IPC/UI, manifest/lock/build policy, synthetic tests, Windows build verification and tracking; no real project storage, credentials, paid calls or core changes.
  - Updated: 2026-10-04
  - Verification: 83/83 suite; actual packaged executable core/sharp, close/reopen/second instance, renderer crash/recovery, explicit Exit/worker termination, sandbox/IPC/navigation, 360px/focus/high contrast; package allowlist audit passed. Local unsigned NSIS installer built. No live providers or private data; CLI/source core unchanged.
  - Landing: codex/windows-app-shell into main; source review pending. Issue remains open after merge for clean Windows install and native tray/keyboard/Narrator acceptance documented in docs/windows-app-shell.md. CI result remains separate.
  - Note: user authorized app implementation. No UI framework chosen; plain HTML shell only. Subsequent managed projects/credentials, durable jobs and paid integration remain #52–#57.

## Blocked

## Pending

- [ ] GitHub #52 — Implement managed projects and an OS-protected credential broker.
  - Owner: Valentin Felizia
  - Depends on: #51
  - Scope: no active source-code claim; see docs/app-implementation.md.
- [ ] GitHub #53 — Implement transactional jobs, scoped authorization and snapshots.
  - Owner: Valentin Felizia
  - Depends on: #51, #52
  - Scope: no active source-code claim; see docs/app-implementation.md.
- [ ] GitHub #54 — Integrate core stages, recoverable responses and request accounting.
  - Owner: Valentin Felizia
  - Depends on: #53
  - Scope: no active source-code claim; see docs/app-implementation.md.
- [ ] GitHub #55 — Implement selective review and task authority contracts.
  - Owner: Valentin Felizia
  - Depends on: #53
  - Scope: no active source-code claim; contract decisions remain explicit before implementation.
- [ ] GitHub #56 — Integrate generic handoff, result history and external effort records.
  - Owner: Valentin Felizia
  - Depends on: #52, #53, #54, #55
  - Scope: no active source-code claim; see docs/app-implementation.md.
- [ ] GitHub #57 — Wire guided onboarding and accessible progress to actual jobs.
  - Owner: Valentin Felizia
  - Depends on: #51–#56
  - Scope: no active source-code claim; packaged Windows accessibility remains acceptance work.
- [ ] GitHub #58 — Verify Windows install, upgrade and retained local data.
  - Owner: Valentin Felizia
  - Depends on: #51, #57
  - Scope: no active source-code claim; release/distribution remains separately authorized.

- [ ] GitHub #17 — Complete human brief/execution review.
  - Owner: Valentin Felizia
  - Scope: no active source-code claim; reviewed hero exploration in a separate design project.
  - Note: the earlier Story outputs were rejected; a fresh chat with a permissive prompt and user-reported GPT 6 Astra received positive feedback. Prompt, model and chat changed together; cause/utility are unknown. The user explicitly resumed hero exploration with repository context and supplied assets. Preserve website palette, Quicksand, actual copy and storefront behavior; no production change or new-photo availability is implied.
- [ ] GitHub #19 — Complete rendered/platform accessibility acceptance.
  - Owner: Valentin Felizia
  - Agent: Codex (P0 worktree)
  - Scope: no active source-code claim; implementation is merged from PR #29/#34.
  - Note: declared-use thresholds, aliases, uncertainty, blockers and manual tasks are implemented. Native composer overlap/sticker and final rendered accessibility remain pending for an accepted future piece; rejected artwork is not a publishing target.

## Deferred

- [ ] GitHub #33 — Evaluate product positioning and naming.
  - Owner: Valentin Felizia
  - Reason: accepted product sequencing prioritizes onboarding/workspace design before naming.
  - Resume when: the journey and local platform/workspace proposal have been reviewed with the user.
  - Note: positioning is accepted under DEC-010. Naming is lower priority; keep repository/package/CLI/schema names until a concrete naming decision after journey/workspace design.

## Recently Completed

Retention: 5

- [x] GitHub #46 / VAL-107 — Design paid-action, cache and progress surfaces.
  - Owner: Valentin Felizia
  - Agent: Codex
  - Scope: released
  - Landed: main @ 4993c15 (PR #59), verified 2026-10-04; issue closed and VAL-107 Done after integration of operator-reviewed PR #50.
  - Verification: approved source tree retained with tracking edits; prior 10 model/full 79 tests and Edge walkthrough remain recorded evidence. No real app/billing/Narrator claim; implementation gaps mapped to #51–#58.

- [x] GitHub #45 / VAL-106 — Evaluate local app packaging and durable jobs.
  - Owner: Valentin Felizia
  - Agent: Codex
  - Scope: released
  - Landed: main @ 86bcf94 (PR #49), verified 2026-10-04; GitHub issue closed, VAL-106 Done after operator merge.
  - Verification: previously passed 7 synthetic lifecycle tests and 69/69 full suite. DEC-011 selects Electron/Windows/background close/explicit Exit/managed projects; no installed app, secure store or production scheduler claim.

- [x] GitHub #44 / VAL-105 — Specify selective review and exploration/approval states.
  - Owner: Valentin Felizia
  - Agent: Codex
  - Scope: released
  - Landed: main @ 4b50917 (PR #48), verified 2026-10-03; GitHub issue closed, VAL-105 Done after operator merge.
  - Verification: 62 synthetic tests and Edge walkthrough previously passed. Proposal/prototype deliverables complete; production contracts and actual authority remain unchanged.

- [x] GitHub #43 / VAL-104 — Prototype guided onboarding and an actionable dossier.
  - Owner: Valentin Felizia
  - Agent: Codex
  - Scope: released
  - Landed: main @ 55eb220 (PR #47), verified 2026-10-03; GitHub issue closed, VAL-104 Done.
  - Verification: 56 synthetic tests and local Edge walkthrough; user accepted idea/flow and authorized merge. Future UI should be minimal with useful information and direct titles; visual/copy polishing explicitly deferred. No integrated app or assistive-technology certification.

- [x] GitHub #37 — Preserve provider usage and phase effort.
  - Owner: Valentin Felizia
  - Agent: Codex
  - Scope: released
  - Landed: main @ 92723b5 through PR #41, verified 2026-10-03; GitHub issue is closed.
  - Verification: previously recorded 53 combined synthetic tests; returned usage/billing, phase effort and idempotent import remain separate. No live provider run or historical backfill.
