# Guided creative-agent context: product roadmap

Accepted direction, 2026-10-03. Product priorities are canonical in [Linear](https://linear.app/valenf/document/product-direction-and-guided-local-workflow-2026-10-03-7dede0439fcc); this document maps them to repository work. Current runtime contracts are unchanged. This is planning, not an implemented app.

## Product purpose

Prepare useful, reviewable context for a concrete creative task without repeatedly reconstructing a business from scattered brand material. Instagram is the first implemented source. OpenDesign is an optional implemented adapter. Evidence, confidence, human decisions, selected originals and the request are useful before a recipient is selected.

## Primary user

The initial audience is a technical operator working with creative agents across brand projects: someone comfortable configuring APIs, inspecting evidence and moving files/context between tools. The user explicitly confirmed this audience on 2026-10-03.

Prioritize a clear visual journey, reusable provider settings and access to advanced model options, local outputs and detailed evidence. A nontechnical owner may use an already-configured installation with assistance, but independent nontechnical onboarding is not the initial target. Keep labels, keyboard/focus behavior and recovery understandable for both.

The intended journey is profile and objective → reused/local versus explicit paid intake → readable summary → important review → task-specific context → generic agent handoff or optional adapter → output and human feedback.

## Next work, in order

| Priority | Product scope | Product tracking | Technical boundary |
| --- | --- | --- | --- |
| Foundation | Retain targeted provenance, human brief and rendered accessibility checks | VAL-100 | #15 is closed after supplied-font source/compilation verification; #17/#19 retain targeted acceptance. #37 accounting is merged through PR #41 |
| First | Design the first-use journey and recoverable states | [VAL-104](https://linear.app/valenf/issue/VAL-104/design-guided-onboarding-from-a-profile-to-a-first-useful-brief) | [GitHub issue 43](https://github.com/ValenFelizia/instagram-to-opendesign/issues/43): navigable synthetic onboarding/dossier prototype, screen states and core gap mapping |
| Alongside journey design | Selective review and room for creative proposals | [VAL-105](https://linear.app/valenf/issue/VAL-105/make-brand-review-selective-while-preserving-creative-freedom) | [GitHub issue 44](https://github.com/ValenFelizia/instagram-to-opendesign/issues/44): review-state/authority proposal; preserve current gates |
| Next | Plan a contained local workspace | [VAL-106](https://linear.app/valenf/issue/VAL-106/define-a-contained-local-app-workspace-for-evidence-and-deliverables) | [GitHub issue 45](https://github.com/ValenFelizia/instagram-to-opendesign/issues/45): platform comparison, durable jobs and workspace proposal before framework selection |
| Across the journey | Understandable spend, cache reuse and progress | [VAL-107](https://linear.app/valenf/issue/VAL-107/make-paid-actions-cache-reuse-and-run-progress-understandable) | [GitHub issue 46](https://github.com/ValenFelizia/instagram-to-opendesign/issues/46): paid-action/cache/progress surfaces based on accounting; unknowns retained |
| Delivery | Generic task-specific export | [VAL-102](https://linear.app/valenf/issue/VAL-102/prepare-reusable-task-specific-context-for-generic-creative-agents) | #32 implementation is merged through PR #42/#41; canonical entrypoint and verified inventory, without reanalysis or OpenDesign packaging |
| Later | Evaluate naming | [VAL-103](https://linear.app/valenf/issue/VAL-103/reframe-product-positioning-and-evaluate-projectrepository-name) | #33 keeps current repo/package/CLI/schema names until a concrete decision |

[VAL-100](https://linear.app/valenf/issue/VAL-100/deliver-a-guided-workflow-from-brand-evidence-to-useful-creative-agent-context) coordinates the increment. GitHub #39 reconciles this documentation and backlog; future implementation tasks should follow observed orchestration gaps rather than assume a framework or hosted service now.

## Review and creativity

Facts, permission and explicitly approved constraints remain authoritative. Inferences, defaults and creative choices retain their status. An exploratory draft can propose copy, typography, colors and composition without presenting them as confirmed brand rules. Confirmed execution and publication require their applicable human review. Progressive review should ask only for information that changes the next step and show the evidence and consequence.

The current CLI still requires a confirmed request and human-selected direction for a ready selected brief. Changing that contract requires separate schema/core work; this roadmap does not bypass it. Brand reports remain Spanish by default and retain the explicit English option.

## Learning without mandatory generation

Practical feedback and concrete friction can guide product work. A controlled comparison remains available when a specific question and budget justify it; see [result review](result-review.md). Quantified savings, comparative superiority and general reliability require corresponding evidence. Neither a valid package nor an accepted exploratory design proves all of those claims. Additional OpenDesign generation is not a prerequisite for this increment.

GitHub #21 closes the implemented review-feature scope. Its optional comparison protocol remains available. Targeted provenance and final rendered accessibility checks remain open; they are not replaced by positive visual feedback.

## Local app boundary

Keep evidence, report, decisions, originals and deliverables discoverable in one local project. Reuse the existing core and valid results. Design save/resume, stale input, partial result and error recovery states. Include keyboard navigation, visible focus, clear names, responsive readability and status that does not rely on color or motion alone.

After joint platform review, DEC-011 selects a Windows-first Electron app, background work after window close, explicit Exit and app-managed local projects. Read the [workspace/job blueprint](local-workspace.md); UI library and implementation details remain open, and no app is implemented. Hosted SaaS/accounts, cloud synchronization, telemetry by default, MCP, new social-network sources and universal vendor support are outside this increment.

## Cost and privacy

Make paid actions explicit before execution, identify cached/local work and avoid automatic paid retries. Preserve actual billed cost, tokens, provider wall time and human effort separately. Label estimates with their basis; unknown values remain unknown, not zero.

User-designated private work remains local and Git-ignored, including identifiers, source material, paths, assets, reports, feedback and outcomes. Public docs, fixtures and product tracking contain generic requirements only. No private case material is needed for this roadmap.

## Onboarding prototype review

The [local synthetic prototype](../prototypes/onboarding/README.md) makes the first-use journey navigable, including the dossier, selective decisions and failure/recovery scenarios. The user accepted its concept/flow and authorized PR #47's merge into main @ `55eb220`; VAL-104 is Done. Read the [screen/core mapping and integration gaps](onboarding-prototype.md). This is interaction design, not the integrated app or a platform decision.

Future UI should be minimal, keep only useful information and use direct section/status titles instead of editorial SaaS copy. The user explicitly deferred visual/copy polishing so work can continue on product behavior.

The [selective-review proposal](selective-review.md) defines authority, task-specific questions, correction consequences and separate exploration/execution/publication states, with an isolated synthetic interaction prototype. The operator merged PR #48; #44 is closed and VAL-105 Done for proposal/prototype scope. Production schemas and readiness remain unchanged. The [local workspace blueprint](local-workspace.md) develops VAL-106; detailed spend/progress follows in VAL-107. Backlog slices are proposed, not an authorization to implement an entire app.

The [paid-action/reuse/progress specification](spend-progress.md) supplies VAL-107's operator-reviewed surface and ten fictional cases. It projects recorded phase/attempt observations, keeps missing/mixed billing distinct, deduplicates shared preparation and rejects stale consent. Proposed job ownership/checkpoint/recovery are separate from current journals. PR #59 integrated the approved PR #50 into main at `4993c15`; #46 is closed and VAL-107 Done for its specification/prototype. No paid instrumentation change is implied.

The [implementation sequence](app-implementation.md) maps the reviewed plans and accounting gaps to GitHub #51–#58. The user authorized app implementation on 2026-10-04. The [Windows shell/native packaging](windows-app-shell.md) (#51) is ready for source review and current-host executable checks; clean-install/native accessibility acceptance remains open. Projects/credentials (#52), jobs, stage/review integration, history, guided UI and release acceptance follow. VAL-100 coordinates product priorities; VAL-106 and VAL-107 are Done for their scoped proposals. No provider execution, durable projects/jobs or integrated onboarding is enabled in this first shell.
