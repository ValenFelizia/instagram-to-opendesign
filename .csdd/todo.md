# TODO

## In Progress

## Ready to Land

- [ ] GitHub #54 — Integrate core stages, recoverable responses and request accounting.
  - Owner: Valentin Felizia
  - Agent: Codex
  - Scope: bounded core stage planning, private actual-request checkpoints, same-attempt recovery, standalone provider accounting and immutable partial/output snapshots. No live paid requests or guided UI.
  - Updated: 2026-10-04
  - Depends on: #53 source under review in PR #62; branch codex/recoverable-core-pipeline starts at 726f4e6. Land the prerequisite first.
  - Verification: final 128/128 synthetic tests, including 16 actual-module recovery/accounting cases; rebuilt Windows NSIS installer, 650-entry source-byte/package audit and actual packaged core/SQLite reopen recovery passed without extra fake requests. No live providers or private case material. CI is separate evidence after execution.
  - Landing: source review on codex/recoverable-core-pipeline targeting main, after PR #62. Paid renderer controls remain #57; selective authority #55 and delivery/history #56 follow. Native installation/accessibility gates remain open.

- [ ] GitHub #53 — Implement transactional jobs, scoped attempt authorization and immutable snapshots.
  - Owner: Valentin Felizia
  - Agent: Codex
  - Scope: packaged SQLite job store, ownership/fencing, revision-bound authorization, intent/uncertainty, snapshot commit/recovery, portable CLI writer interlock and synthetic process/failure verification. No live providers or guided paid UI.
  - Updated: 2026-10-04
  - Depends on: #51/#52 source merged through PR #60/#61; main dd4a1db verified.
  - Verification: full 111/111 synthetic suite; 28/28 final storage/broker and 17/17 final job checks, including altered metadata; actual packaged bundled SQLite 3.53.4 intent/acknowledgement/snapshot/reopen, inherited shell/projects/DPAPI and 648-entry package/source-byte audit passed. Local unsigned NSIS installer rebuilt from final source. Windows CI is separate evidence after execution.
  - Landing: source review on codex/transactional-jobs targeting main. No live provider/data, integrated core stages or guided paid controls; #54 follows. #51/#52 remain open for their native manual gates.

## Blocked

## Pending

- [ ] GitHub #52 — Implement managed projects and an OS-protected credential broker.
  - Owner: Valentin Felizia
  - Agent: Codex
  - Scope: source claim released; native picker/confirmation and keyboard/Narrator acceptance only.
  - Updated: 2026-10-04
  - Depends on: #51 source merged through PR #60.
  - Verification: 95/95 suite; actual Electron/packaged project operations, source byte equality, real Windows DPAPI, cleared password input, unavailable-protection UI and fresh-launch persistence; inherited shell checks and package allowlist passed. Synthetic material only; no providers or private projects.
  - Landed: main dd4a1db through operator-merged PR #61, verified 2026-10-04. Issue stays open for the documented native manual gates; CI 37186005029 passed at 08fb256.
  - Note: registry persistence alone is not transactional job recovery; #53 follows.

- [ ] GitHub #51 — Build a Windows Electron shell and verify native core packaging.
  - Owner: Valentin Felizia
  - Agent: Codex
  - Scope: source claim released; clean install and native tray/keyboard/Narrator acceptance only.
  - Updated: 2026-10-04
  - Verification: 83/83 suite; actual packaged executable core/sharp, close/reopen/second instance, renderer crash/recovery, explicit Exit/worker termination, sandbox/IPC/navigation, 360px/focus/high contrast; package allowlist audit passed. Local unsigned NSIS installer built. No live providers or private data; CLI/source core unchanged.
  - Landed: main c28ef9c through operator-merged PR #60, verified 2026-10-04. Issue stays open for documented manual gates; CI 37183836134 passed at 01d9881.
  - Note: user authorized app implementation. No UI framework chosen; plain HTML shell only. Subsequent managed projects/credentials, durable jobs and paid integration remain #52–#57.

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
