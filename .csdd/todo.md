# TODO

## In Progress

## Ready to Land

- [ ] GitHub #46 / VAL-107 — Design paid-action, cache and progress surfaces.
  - Owner: Valentin Felizia
  - Agent: Codex
  - Scope: docs/spend-progress.md, prototypes/spend-progress, synthetic projection/browser tests and CSDD/roadmap tracking; no live provider, core/accounting changes or app integration.
  - Updated: 2026-10-03
  - Depends on: #37 (merged PR #41); #45 blueprint under review in PR #49.
  - Verification: 10 model checks, actual synthetic journal projection and full 79/79 suite passed; Edge walkthrough and desktop/mobile screenshots inspected, keyboard/focus/errors, 390/320px overflow, reduced motion, forced colors and no page network/storage checked. No provider, pricing, Narrator or installed app claim.
  - Landing: PR #50, codex/paid-action-progress into codex/local-workspace-plan while PR #49 is open; VAL-107 In Review. Parent first, then retarget/reconcile to main before landing.
  - Note: starts at PR #49 head 5e90bb8 while operator reviews that proposal. Retarget/reconcile after #49 merge before landing #46; keep no paid retry and canonical gates intact.

- [ ] GitHub #45 / VAL-106 — Evaluate local app packaging and durable jobs.
  - Owner: Valentin Felizia
  - Agent: Codex
  - Scope: docs/local-workspace.md, isolated synthetic lifecycle spike/tests, platform sources and CSDD/roadmap tracking; no app shell, core/schema changes, real projects or providers.
  - Updated: 2026-10-03
  - Verification: 7 synthetic process/checkpoint tests and full 69/69 regression suite passed on Windows; no app packaging, providers or production storage. Official platform sources inspected.
  - Landing: PR #49, codex/local-workspace-plan into main; blueprint review pending, VAL-106 In Review.
  - Note: DEC-011 records operator-selected Windows-first Electron, window close keeps work running, explicit Exit and app-managed projects. UI library, storage binding and release/integration choices remain separate.

## Blocked

## Pending

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

- [x] GitHub #32 / VAL-102 — Export reusable task-specific context for generic agents.
  - Owner: Valentin Felizia
  - Agent: Codex
  - Scope: released
  - Landed: PR #42 @ fa67960, reachable from main @ 92723b5 through PR #41, verified 2026-10-03; GitHub issue is closed and VAL-102 is Done.
  - Verification: previously recorded 49 independent/53 combined synthetic tests, portable canonical reading order and byte-verified inventory; current core suite also passes. Readiness unchanged; no vendor run or general usefulness claim.

- [x] GitHub #15 — Record verified brand decisions and conflicts.
  - Owner: Valentin Felizia
  - Scope: released
  - Landed: implementation through PR #23; source/compilation verification completed and issue closed 2026-10-03.
  - Verification: supplied storefront font copied unchanged and registered with source-backed website-only rules; two stable compilations preserve palette and model analysis. No font licensing, embedding, rendered-font or production claim.
