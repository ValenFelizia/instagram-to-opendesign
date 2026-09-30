# TODO

## In Progress

## Ready to Land

- [ ] GitHub #19 — Declared-use accessibility preflight.
  - Owner: Valentin Felizia
  - Agent: Codex (P0 worktree)
  - Branch: `codex/accessibility-preflight`
  - Updated: 2026-09-30
  - Scope: local checks, Spanish/English report, brief blockers and portable manual acceptance tasks.
  - Landing: stacked on #28.
  - Verification: 36 tests; alias cycles, missing/photo backgrounds, near-threshold failures and brief gates. Rendered accessibility remains a human acceptance step.

- [ ] GitHub #18 — Accessible report review export/import.
  - Owner: Valentin Felizia
  - Agent: Codex (P0 worktree)
  - Branch: `codex/report-review`
  - Updated: 2026-09-30
  - Scope: report controls, scoped decision import, channel-specific approved rules and tests/docs.
  - Landing: stacked on P0 integration PR #27.
  - Verification: 34 tests; browser confirms labeled controls, focus on invalid notes, live error text and no overflow at its default viewport. Full 390/1440 px, download and screen-reader review remain required; browser download event timed out.

- [ ] Integrate approved P0 #15–17 into main.
  - Owner: Valentin Felizia
  - Agent: Codex (P0 worktree)
  - Branch: `codex/p0-integration`
  - Updated: 2026-09-30
  - Scope: integration and CSDD reconciliation; retain PR #12 metadata and the language policy.
  - Landing: PR to main. PRs #23/#25/#26 merged into stacked bases, not main.
  - Verification: combined P0/main suite. Human accepted the report; real request/asset permissions and generalizability remain distinct review steps.

## Blocked

## Pending

- [ ] GitHub #20 — Explicit OpenDesign delivery and existing-site context.
  - Owner: Valentin Felizia
- [ ] GitHub #21 — Preserve results, requirements, corrections and uncertainty.
  - Owner: Valentin Felizia

## Deferred

- [ ] Felisa hero redesign and generation.
  - Owner: Valentin Felizia
  - Resume when: user confirms the new approach and supplies additional photos requested from Fer.
  - Preserve the existing landing palette; the deliberate Instagram logo-background change does not authorize a website rebrand.
- [ ] GitHub #22 — Rich-package experiment.
  - Owner: Valentin Felizia
  - Resume when: #20/#21 evaluation identifies missing agent context that the minimum package and selected brief cannot deliver.

## Recently Completed

Retention: 5

- [x] GitHub #6 / VAL-93 — Felisa MVP baseline validation.
  - Owner: Valentin Felizia
  - Agent: Codex
  - Scope: released
  - Landed: main @ `82c85c1` (PR #12)
  - Verification: local selection; context preserved without clear visual gain. Prior brand familiarity confounds utility; do not generalize from this case.
- [x] GitHub #13 — Bilingual report and English collaboration prose.
  - Owner: Valentin Felizia
  - Agent: Codex
  - Scope: released
  - Landed: main @ `c46e960` (PR #14)
  - Verification: 22 tests, Spanish/English local 1440/390 px renders.
- [x] GitHub #5 / VAL-92 — Package compiler and end-to-end CLI.
  - Owner: Valentin Felizia
  - Scope: released
  - Landed: main @ `655cc87` (PR #11)
  - Verification: 15 tests, isolated catalog and provider-cache reuse.
- [x] GitHub #4 / VAL-91 — Multimodal analyzer with evidence.
  - Owner: Valentin Felizia
  - Scope: released
  - Landed: main @ `90f453f` (PR #10)
  - Verification: 11 tests, ten traceable inferences.
- [x] GitHub #3 / VAL-90 — Evidence and contact sheet.
  - Owner: Valentin Felizia
  - Scope: released
  - Landed: main @ `3f538ba` (PR #8)
  - Verification: five tests, reviewed selection and collaborator attribution.
