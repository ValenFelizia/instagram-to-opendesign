# TODO

## In Progress

## Ready to Land

- [ ] GitHub #32 / VAL-102 — Export reusable task-specific context for generic agents.
  - Owner: Valentin Felizia
  - Agent: Codex
  - Scope: canonical brief export entrypoint, inventory/verification, CLI, synthetic tests and generic delivery documentation.
  - Updated: 2026-10-03
  - Landing: PR #42, codex/generic-agent-handoff onto codex/provider-accounting; merge PR #41 first, then retarget to main.
  - Verification: 49 local synthetic tests passed independently and 53 with PR #41 integrated, including relocation, byte preservation, pending states and stale-input refusal. No provider calls, private case exports or readiness-gate changes.

- [ ] GitHub #37 — Preserve provider usage and phase effort.
  - Owner: Valentin Felizia
  - Agent: Codex
  - Scope: pipeline, provider hooks, private journals and idempotent review import.
  - Landing: PR #41, codex/provider-accounting into main; human review/merge required.
  - Verification: 51 local synthetic tests passed; no live provider call.
  - Updated: 2026-10-03


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
- [ ] GitHub #43 / VAL-104 � Prototype guided onboarding and an actionable dossier.
  - Owner: Valentin Felizia
  - Scope: no active implementation claim; synthetic navigable prototype and state/core mapping before framework selection.
- [ ] GitHub #44 / VAL-105 � Specify selective review and exploration/approval states.
  - Owner: Valentin Felizia
  - Scope: no active implementation claim; authority/transition matrix, interaction examples and compatibility proposal.
- [ ] GitHub #45 / VAL-106 � Evaluate local app packaging and durable jobs.
  - Owner: Valentin Felizia
  - Scope: no active implementation claim; reviewed platform recommendation, local persistence and lifecycle blueprint.
- [ ] GitHub #46 / VAL-107 � Design paid-action, cache and progress surfaces.
  - Owner: Valentin Felizia
  - Depends on: #37 (PR #41 ready for review)
  - Scope: no active implementation claim; synthetic state/copy prototype and journal-to-UI mapping.

## Deferred

- [ ] GitHub #33 — Evaluate product positioning and naming.
  - Owner: Valentin Felizia
  - Reason: accepted product sequencing prioritizes onboarding/workspace design before naming.
  - Resume when: the journey and local platform/workspace proposal have been reviewed with the user.
  - Note: positioning is accepted under DEC-010. Naming is lower priority; keep repository/package/CLI/schema names until a concrete naming decision after journey/workspace design.

## Recently Completed

Retention: 5

- [x] GitHub #15 � Record verified brand decisions and conflicts.
  - Owner: Valentin Felizia
  - Scope: released
  - Landed: implementation through PR #23; source/compilation verification completed and issue closed 2026-10-03.
  - Verification: supplied storefront font copied unchanged and registered with source-backed website-only rules; two stable compilations preserve palette and model analysis. No font licensing, embedding, rendered-font or production claim.

- [x] GitHub #39 / VAL-100 — Reconcile the guided product workflow and backlog.
  - Owner: Valentin Felizia
  - Agent: Codex
  - Scope: released
  - Landed: main @ 96120d8 (PR #40), verified 2026-10-03.
  - Verification: technical initial audience and guided local workflow documented; app implementation remains planned in VAL-104–VAL-107.

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
