# Verification and issue checkpoint — 2026-10-03

This is a sanitized summary of merged implementation and human verification. Original real-brand files, browser downloads, screenshots, workspace bindings and verbatim feedback remain local and Git-ignored. No private asset or machine path is published here.

## Merge baseline

PR #38 is merged into main at `34d7d77f490789db8844cc125bc3879979fdc068`, including PR #36 and the previous implementation stack. Old stacked-landing instructions are consumed. Test/runtime claims below describe their recorded verification scope; neither an API readback nor a structural guard proves creative acceptance. DEC-010 records the accepted product direction; the integrated app is planned, not implemented. PR #41/#42 are subsequently merged and reachable from main @ `92723b5`; their old landing instructions are consumed.

## Closed scopes

| Issue | Closure evidence | Limits |
| --- | --- | --- |
| #16 — Asset preparation | Measured properties and rights/crop fixtures; human original-versus-capture comparison, supplied-photo permission, full-frame selection and contextual description; exact original retained in first PNG at the reviewed no-upscale size | Final creative acceptance and publishing checks are separate |
| #18 — HTML review decisions | Saved browser JSON imported successfully with unrelated rules/rows preserved; keyboard/focus/error recovery, Narrator labels/error, readable no-JavaScript report, 390/1440px layout review and local-only Firefox page traffic | Narrator coverage is the review form/error, not a full conformance audit; traffic evidence is browser-page traffic |
| #20 — OpenDesign delivery | 45 previously recorded local tests, actual packaged 0.24.1 synthetic runtime, complete real local delivery and active context readback, human selector screenshot and concrete recipient brief/asset/token readback | Compatibility remains pinned; no generation in delivery and no creative-quality or utility claim |
| #22 — Rich-profile gate | Recipient could read selected brief, evidence, original asset, provisional token origins and pending checks; no observed inaccessible-context gap warrants a rich manifest | Closed by its explicit no-expansion condition; no rich implementation or minimal/rich comparison was performed |
| #31 — Core/adapter boundary | Merged PR #36, 47 recorded local tests, complete consumer-neutral synthetic brief and separate real-brand compilation preserving canonical bytes/hash; VAL-101 reconciled to Done | Generic export remains #32; no general utility claim |
| #21 — Result review | Merged immutable output/brief snapshots, explicit rendered observations, original feedback, corrections and cumulative effort records with previously recorded synthetic verification | Closed for implemented scope under DEC-010; optional matched research, final rendered accessibility and publication acceptance are separate |
| #32 — Generic agent handoff | Merged PR #42 via PR #41; main ancestry verified, 49 independent/53 combined recorded synthetic checks and portable START/BRIEF reading order with byte inventory | Current readiness remains authoritative; no universal recipient or usefulness claim |
| #37 — Run accounting | Merged PR #41; returned usage/billing and phase time preserve failed attempts, cache state and idempotent imports | No live provider run, historical backfill or complete effort estimate |

## Open scopes

| Issue | Remaining evidence or work |
| --- | --- |
| #17 | Story request, assets and instructions were understood. A new exploratory version received positive user feedback; a user-authorized hero exploration with real repository context is resumed. Final applicable brief/execution review remains pending; matched utility is optional research. |
| #19 | Declared-use preflight, uncertainty and blockers are implemented. Actual platform overlays/native sticker and final rendered accessibility remain unverified; the rejected Story is not a publication target. |
| #33 | Positioning is accepted. Naming remains a lower-priority follow-up after journey/workspace design. Keep repository, package, CLI and schema names. |

## Story outcome and experiment stop

The first PNG preserved exact copy, original bytes/full framing, target dimensions and native sticker space. Its declared solid-color headline pair measured 4.90:1. The user accepted readability and absence of horizontal scrolling at the requested 390px preview. Visual quality was rejected. A second recipient-generated PNG improved hierarchy slightly but was again rejected as unsuitable for Instagram. The user stopped creative iteration.

No composer trial or publication was performed for these rejected outputs. The recipient's second-version technical claims and automatic 4/4 scorecard are not independent measurements or a visual-quality score. The actual model/runtime configuration was not independently captured. Prompt, reference preparation, defaults, model, orchestration and configuration remain possible causes; this run isolates none of them. Felisa familiarity and missing matched effort data prevent a general usefulness conclusion.

## Subsequent user-authorized exploration

A new Felisa Story in a fresh chat used a permissive creative prompt and user-reported GPT 6 Astra. The user judged it substantially better. Model, prompt and chat changed together, so this is request-specific feedback with unknown cause, not a controlled model/prompt comparison or proof of importer utility. The user explicitly resumed hero exploration with real repository context. Its current website palette, Quicksand, supplied photos and storefront behavior remain authoritative; additional new photos and production changes are not implied.

Private project work stays local and Git-ignored, including identifiers, source content, assets, metadata, reports and outcomes. Public state records only generic requirements. If a comparative experiment is explicitly chosen, it requires common approved inputs/settings and complete effort records; a greenfield landing cannot stand in for an existing-site change. No general utility verdict is claimed. Guided onboarding, selective review, local workspace planning and cost/progress are tracked in VAL-104–VAL-107; see the [product roadmap](product-roadmap.md).

## Onboarding prototype — accepted concept and flow

GitHub #43 / VAL-104 is merged through PR #47 into main @ `55eb220`; issue closed and Linear Done after the user accepted its idea/flow and explicitly authorized merge. The user requested a minimal future UI with direct titles and less copy, and deferred visual polishing. Recorded verification: 56 synthetic tests and the Edge workflow with desktop/mobile inspection. This is prototype acceptance, not an integrated app or full accessibility certification.

## Selective review — reviewed and merged proposal

GitHub #44 / VAL-105 has [authority/transition matrices and compatibility implications](selective-review.md), plus six memory-only fictional interaction cases. The operator merged PR #48, verified on main @ `4b50917`; issue closed and Linear Done for proposal/prototype scope. Recorded 62 synthetic tests and Edge walkthrough passed, including inspected desktop/mobile screenshots and keyboard/focus/error, reduced-motion and overflow checks. Production schemas/core gates and the earlier onboarding UI remain unchanged. No real source or permission verification, artifact review, authority, canonical export or publication is implied. Contract implementation and actual assistive-technology acceptance remain separate.

## Local workspace — platform selected, blueprint merged

GitHub #45 / VAL-106 is merged through operator-reviewed PR #49 on main at 86bcf94, verified 2026-10-04. It compares browser-host/Electron/Tauri and proposes a [workspace/job blueprint](local-workspace.md). DEC-011 records four explicit operator choices: installable app with background work after window close and explicit Exit; Windows first; app-managed local projects; Electron to reuse Node. UI library, binding/production persistence, packaging/signing/update and release accessibility remain open.

Seven synthetic lifecycle tests and the full 69/69 repository suite passed on Windows with Node 24.19.0. A sandboxed regression attempt was blocked by dependency reads; the approved rerun passed without modifying dependencies. The isolated file-backed Node spike checks lost observers, worker termination, ambiguous attempt recovery, checkpoint reuse/staleness, explicit Exit, partial/corrupt history and invalid/duplicate transitions. No actual provider, app window, installer, SQLite, OS secret-store, computer restart, power-loss durability or packaged accessibility was verified. No private case material is included. This is planning and a bounded uncertainty spike, not a working integrated app.

## Paid actions and progress — operator reviewed, main integration pending

GitHub #46 / VAL-107 provides the [state/copy and journal/job mapping](spend-progress.md), ten synthetic scenarios and instrumentation follow-up slices. Ten model tests plus full 79/79 suite passed, including a real synthetic core journal's failed-phase/completed-attempt projection matched against current finished import. Edge walkthrough passed scoped consent/error/cancel/Escape/focus, stale input, local cache/repair, mixed/null bills, shared attempt history, explicit same-attempt lookup and separate remaining-stage authorization. Desktop/mobile screenshots inspected; all ten 390px cases and representative 320px views have no horizontal overflow. Reduced motion/forced colors and no page errors/HTTP(S)/browser storage were checked.

Production core/journals/importer and prior UI prototypes are unchanged. Proposed job checkpoints, credentials and provider recovery are not implemented. No live pricing, spending, real invoice, private case, general savings, actual installed app/Narrator or publication claim. PR #50 was operator-reviewed and merged into the old parent branch at 391a157, after PR #49 landed on main. The follow-up integration branch cherry-picks its approved commits without conflicts; its tree matched that parent branch before tracking edits. Prototype/test/core bytes are unchanged, so the recorded 79 tests and browser checks remain prior verification, not new runs. #46 stays open until main integration. Instrumentation and app gaps now map to unimplemented issues #51–#58; see app-implementation.md.
