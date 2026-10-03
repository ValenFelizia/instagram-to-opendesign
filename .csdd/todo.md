# TODO

## In Progress

## Ready to Land

- [ ] GitHub #37 — Preserve provider usage and phase effort.
  - Owner: Valentin Felizia
  - Agent: Codex
  - Scope: pipeline, provider observation hooks, local run records, result-review import, synthetic tests and accounting documentation.
  - Landing: PR pending creation, codex/provider-accounting into main; human review/merge required.
  - Verification: all 51 local synthetic tests passed; no live provider call.
  - Updated: 2026-10-03
  - Note: branch codex/provider-accounting from main @ 96120d8. No live provider calls or private case exports.


## Blocked

## Pending

- [ ] GitHub #15 — Complete real-brand font-source verification.
  - Owner: Valentin Felizia
  - Scope: no active source-code claim; remaining manual provenance verification.
  - Note: implementation from PR #23 is reachable from main. Real local rules confirm website colors and product copy; font behavior is tested synthetically but an actually supplied brand font has not been registered in the real decision contract.
- [ ] GitHub #17 — Complete human brief/execution review.
  - Owner: Valentin Felizia
  - Scope: no active source-code claim; reviewed hero exploration in a separate design project.
  - Note: the earlier Story outputs were rejected; a fresh chat with a permissive prompt and user-reported GPT 6 Astra received positive feedback. Prompt, model and chat changed together; cause/utility are unknown. The user explicitly resumed hero exploration with repository context and supplied assets. Preserve website palette, Quicksand, actual copy and storefront behavior; no production change or new-photo availability is implied.
- [ ] GitHub #19 — Complete rendered/platform accessibility acceptance.
  - Owner: Valentin Felizia
  - Agent: Codex (P0 worktree)
  - Scope: no active source-code claim; implementation is merged from PR #29/#34.
  - Note: declared-use thresholds, aliases, uncertainty, blockers and manual tasks are implemented. Native composer overlap/sticker and final rendered accessibility remain pending for an accepted future piece; rejected artwork is not a publishing target.
- [ ] GitHub #32 / VAL-102 — Export reusable task-specific context for generic agents.
  - Owner: Valentin Felizia
  - Depends on: #31 (completed)
  - Note: reuse canonical artifacts and preserve exploratory/approved status, relative references and original bytes. Matched generation is optional research, not a delivery gate. No untested vendor support is promised.
- [ ] GitHub #33 — Evaluate product positioning and naming.
  - Owner: Valentin Felizia
  - Depends on: #31 (completed)
  - Note: positioning is accepted under DEC-010. Naming is lower priority; keep repository/package/CLI/schema names until a concrete naming decision after journey/workspace design.
- [ ] VAL-104–VAL-107 — Design the guided local product increment.
  - Owner: Valentin Felizia
  - Scope: no active implementation claim; product planning is tracked in Linear.
  - Note: start with VAL-104 onboarding (Todo), alongside VAL-105 selective review. VAL-106 local workspace/platform decision and VAL-107 cost/progress remain Backlog. No framework or app implementation is selected. See docs/product-roadmap.md.

## Deferred

## Recently Completed

Retention: 5

- [x] GitHub #39 / VAL-100 — Reconcile the guided product workflow and backlog.
  - Owner: Valentin Felizia
  - Agent: Codex
  - Scope: released
  - Landed: main @ 96120d8 (PR #40), verified 2026-10-03.
  - Verification: merged documentation establishes the technical initial audience and guided local workflow; app implementation remains planned in VAL-104–VAL-107.

- [x] GitHub #21 — Close the implemented result-review scope.
  - Owner: Valentin Felizia
  - Agent: Codex (P0 worktree)
  - Scope: released
  - Landed: main via PR #34 and subsequent integration; reachable from 34d7d77.
  - Verification: previously recorded synthetic checks and merged immutable snapshots, explicit observations, feedback/corrections and effort records. Closed 2026-10-03 under DEC-010; optional matched research is not a completion gate. No measured utility or rendered accessibility claim.

- [x] GitHub #31 / VAL-101 — Separate canonical core from the OpenDesign adapter.
  - Owner: Valentin Felizia
  - Agent: Codex
  - Scope: released
  - Landed: main @ b394e9e (PR #36), verified 2026-10-03.
  - Verification: 47 recorded local tests, public selected-brief fixture without a runtime/package, preserved real Felisa canonical bytes/hash; GitHub #31 and Linear VAL-101 are Done. Actual second-recipient utility remains #32.
- [x] GitHub #22 — Conclude the rich-package gate without expanding the profile.
  - Owner: Valentin Felizia
  - Scope: released
  - Verification: issue closed 2026-10-03 under its explicit no-expansion condition. Recipient readback showed no inaccessible-context gap; creative rejection does not justify rich fixtures. No rich implementation/comparison or superiority claim.
- [x] GitHub #20 — Preserve reviewed context in packaged OpenDesign delivery.
  - Owner: Valentin Felizia
  - Agent: Codex
  - Scope: released
  - Landed: main @ 6e7e8f1 (PR #35, after PR #30)
  - Verification: 45 previously recorded local tests, actual packaged 0.24.1 runtime, complete local delivery, selector screenshot and concrete recipient readback. Issue closed 2026-10-03; final creative quality is separate.
