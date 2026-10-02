# Handoff

## Desktop delivery correction, 2026-10-02

The previous PR stack is reachable from main at `c7f7a7d`; the historical stacking instructions below are consumed and must not guide new branches or merge order. Current correction branch: `codex/desktop-handoff`, based on that main, proposed in PR #35.

Actual OpenDesign 0.24.1 desktop extraction changed active identity context and omitted reference files. The corrected adapter now passes 45 tests and a synthetic trial against the actual packaged daemon runtime. A real approved local Felisa Story delivery is installed as `user:felisa-fr` in the intended personal workspace, with all 94 input files retained and 96 installed files including START/USAGE. Active DESIGN, tokens, usage and selected brief were read back through the daemon. Real data, workspace IDs and runtime outputs remain Git-ignored.

Next human check: refresh the desktop selector and choose the manifest title ending `(draft)` for `user:felisa-fr`, rather than the earlier extracted system with a long `borrador para OpenDesign` title. Use the installed START.md. Catalog/API preservation does not prove the recipient agent read the brief or that a Story render is accepted. Issue #20 remains open until those manual checks; accessibility/composer and unfamiliar-brand utility remain pending. Preserve the website palette and deferred hero scope.

## Historical P0 batch, 2026-09-30 (superseded landing instructions)

PRs #23/#25/#26 are merged into stacked base branches, not main. The attached managed `brand-p0` worktree's `codex/p0-integration` branch reconciles that stack with main at `82c85c1`, retaining the catalog metadata fix and English language policy. Continue remaining PRs from this integration branch until it lands; do not report the P0 changes as present in main yet.

The latest result-review branch passes 40 tests without live provider calls. Local Felisa assets were compared read-only: the capture has embedded carousel dots and no transparent pixels; the original JPEG does not. The user's actual 2026-09-30 review was recorded locally: preserve the existing website palette, accept the other report proposals as proposals and defer the hero. No asset permissions or new real design request were invented.

Review/export (#28), accessibility preflight (#29), explicit OpenDesign delivery (#30) and result review are stacked after integration #27. An isolated OpenDesign 0.23.1 daemon exposed and selected a synthetic promotional package without generation; agent context consumption and matched unfamiliar-brand utility remain pending. Report controls passed label, keyboard/focus and 390/1440 px overflow checks; saved download and screen-reader checks remain pending. Rich-package #22 remains deferred until evaluation demonstrates missing context. Preserve first results and total effort; do not generalize from prior Felisa familiarity.

Result review is PR #34. To land the entire stack without retargeting, merge the leaf into its parent in order **#34 → #30 → #29 → #28 → #27**; only the final #27 targets main. If #27 lands first, retarget/reconcile each remaining PR against main before merging it. Merging a PR into a feature base alone does not release its changes on main.
