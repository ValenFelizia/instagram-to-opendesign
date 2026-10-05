# TODO

## In Progress


## Ready to Land

- [ ] GitHub #56 — Integrate generic handoff, result history and external effort records.
  - Owner: Valentin Felizia
  - Agent: Codex
  - Scope: source review of the privileged delivery broker, explicit portable disclosure, immutable result/feedback revisions and supplied effort source/attempt/charge records. No UI, providers or private cases.
  - Updated: 2026-10-04
  - Depends on: #55 at 9b4945e (PR #64 open); #53/#54 merged on main c7739d7.
  - Verification: 155/155 full synthetic suite, followed by 30/30 final authority/delivery/legacy checks including safe original names and exact artifact acceptance; unsigned NSIS rebuild, 657-entry package/source audit and actual packaged export/history/feedback/effort/reopen passed. Final Windows CI is separate evidence after execution.
  - Landing: codex/task-deliveries-history targets codex/selective-task-authority for isolated #56 review; merge #64 first and retarget to main. Operator controls merge. Guided UI follows #57; native #51/#52/#58 gates remain open.

- [ ] GitHub #55 — Implement selective review and task authority contracts.
  - Owner: Valentin Felizia
  - Agent: Codex
  - Scope: source review of versioned exploration/selection, sourced correction/history, scoped invalidation and exact output acceptance. Legacy CLI gates retained; no UI/live/private cases.
  - Updated: 2026-10-04
  - Depends on: #53/#54 merged through PR #62/#63, verified main c7739d7.
  - Verification: 141/141 full synthetic suite followed by 14/14 final authority checks, including detached input during asynchronous validation; final Windows NSIS rebuild, 655-entry package/source audit and actual packaged review/SQLite reopen/source revocation passed. CI is separate evidence after execution.
  - Landing: codex/selective-task-authority targets main; operator controls merge. New delivery/history #56 and guided controls #57 follow; native #51/#52/#58 gates stay open.


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

- [x] GitHub #54 — Integrate core stages, recoverable responses and request accounting.
  - Owner: Valentin Felizia
  - Agent: Codex
  - Scope: released
  - Landed: main c7739d7 through operator-merged PR #63, verified 2026-10-04; GitHub issue closed.
  - Verification: 128/128 synthetic tests, 650-entry package audit and packaged SQLite/core recovery; Windows CI 37227598539 passed at 1427b07. No live paid requests, private cases or release; guided controls remain #57.

- [x] GitHub #53 — Implement transactional jobs, scoped authorization and immutable snapshots.
  - Owner: Valentin Felizia
  - Agent: Codex
  - Scope: released
  - Landed: main a6c3d5f through operator-merged PR #62, verified 2026-10-04; GitHub issue closed.
  - Verification: Windows CI 37220147076 passed at 726f4e6 with 112/112 tests, 648-entry package audit and actual bundled SQLite checks. Native gates #51/#52 stay open; no power-loss or exactly-once billing claim.

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
