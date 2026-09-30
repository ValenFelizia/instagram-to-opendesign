# TODO

## In Progress

## Ready to Land

- [ ] GitHub #17 — Executable hero/Story brief and creative directions.
  - Owner: Valentin Felizia
  - Agent: Codex (P0 worktree)
  - Branch: `codex/design-brief`
  - Updated: 2026-09-30
  - Scope: validated local request, reusable explicit provider, human selection, portable brief and focused synthetic verification.
  - Landing: stacked on `codex/asset-preflight` / PR #25.
  - Verification: 33 tests; mocked structured API, exact copy, both target templates, cache reuse/staleness, selection, conflicts, rights and rollback. Synthetic bundles inspected locally; human render acceptance and real brand request remain pending.

- [ ] GitHub #16 — Asset inventory and design preflight.
  - Owner: Valentin Felizia
  - Agent: Codex (P0 worktree)
  - Branch: `codex/asset-preflight`
  - PR: https://github.com/ValenFelizia/instagram-to-opendesign/pull/25
  - Updated: 2026-09-30
  - Scope: local asset review, measured properties, permission provenance, compiler export and focused fixtures.
  - Landing: stacked on `codex/brand-decisions` / PR #23.
  - Verification: 28 tests, including actual alpha pixels, supplied originals, crops, permissions and preservation on failure; real Felisa original/capture comparison. Human permissions remain pending.

- [ ] GitHub #15 — Verified decisions and brand conflicts.
  - Owner: Valentin Felizia
  - Agent: Codex (P0 worktree)
  - Branch: `codex/brand-decisions`
  - PR: https://github.com/ValenFelizia/instagram-to-opendesign/pull/23
  - Updated: 2026-09-30
  - Scope: decision contract, compiler and read-only report provenance, focused English documentation.
  - Landing: draft PR to `codex/brand-report`, then `main` after PR #14. Translation from `78a813f` reconciled.
  - Verification: synthetic confirmed-rule tests and provider-free local Felisa rebuild. Real owner confirmation remains a review step.

- [ ] GitHub #13 — Brand report and English project prose.
  - Owner: Valentin Felizia
  - Agent: Codex
  - Branch: `codex/brand-report`
  - PR: https://github.com/ValenFelizia/instagram-to-opendesign/pull/14
  - Updated: 2026-09-30
  - Scope: standalone Spanish/English reports, repository documentation and English GitHub issue/PR descriptions.
  - Landing: PR #14 into `main`, pending human review.
  - Verification: 22 tests; real English Felisa translation and key-free cache reuse; both languages rendered at 1440 px and 390 px with all images loaded, no horizontal overflow, no external requests and no missing evidence anchors.

- [ ] GitHub #6 / VAL-93 — Validate the Felisa MVP against a manual baseline.
  - Owner: Valentin Felizia
  - Agent: Codex
  - Branch: `codex/val-93-validation`
  - PR: https://github.com/ValenFelizia/instagram-to-opendesign/pull/12
  - Scope: hero/Story comparison in OpenDesign, package installation fix and documented conclusion.
  - Landing: PR #12 into `main`, pending human review.
  - Verification: 15 tests; synthetic fixture selectable in OpenDesign `0.23.1`; preferred manual Story saved locally under Git-ignored `data/`. The package showed no clear visual advantage; do not expand to MCP.

## Blocked

## Pending

## Deferred

## Recently Completed

Retention: 5

- [x] GitHub #5 / VAL-92 — Compile OpenDesign packages and an end-to-end CLI.
  - Owner: Valentin Felizia
  - Agent: Codex
  - Scope: released
  - Landed: `main` @ `655cc87` (PR #11)
  - Verification: 15 tests; a real `@felisa_fr` package loaded in an isolated OpenDesign `0.23.1` catalog with uncertainty retained. A second run reused paid stages. Real data and credentials remain Git-ignored.

- [x] GitHub #4 / VAL-91 — Multimodal Brand Analyzer with confidence and evidence.
  - Owner: Valentin Felizia
  - Agent: Codex
  - Scope: released
  - Landed: `main` @ `90f453f` (PR #10)
  - Verification: 11 tests and a live `@felisa_fr` run with 10 traceable inferences; color and typography supported by the avatar, UI `needs-review`. Real data stays local and Git-ignored.

- [x] GitHub #3 / VAL-90 — Evidence Processor and visual contact sheet.
  - Owner: Valentin Felizia
  - Agent: Codex
  - Scope: released
  - Landed: `main` @ `3f538ba` (PR #8)
  - Verification: real `@felisa_fr` bundle with 93 indexed images, 24 reviewed representatives across 15 posts and 15 captions; 69 remain unreviewed. Local evidence is under `data/<username>/evidence/`; #5 places it in `source/`. Five tests pass.

- [x] GitHub #2 / VAL-89 — Public profile ingestion through Apify and a reproducible normalized source.
  - Owner: Valentin Felizia
  - Agent: Codex
  - Scope: released
  - Landed: `main` @ `55447f5` (PR #7)
  - Verification: Apify returned 15 public `@felisa_fr` posts (3 with another primary author), 93 images and 10 videos; valid `instagram-source/v1`. Real data remains under Git-ignored `data/`.

- [x] VAL-88 — Output contract and synthetic static package for OpenDesign.
  - Owner: Valentin Felizia
  - Agent: Codex
  - Scope: released
  - Landed: `main` @ `6129683`
  - Verification: OpenDesign manifest parser at `1b47e60`, all 56 shared tokens, analysis schema, evidence references and remote files checked. A running-instance test was left for subsequent integration validation.
