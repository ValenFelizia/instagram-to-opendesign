# Guided creative-agent context: product roadmap

Accepted direction, 2026-10-03. Product priorities are canonical in [Linear](https://linear.app/valenf/document/product-direction-and-guided-local-workflow-2026-10-03-7dede0439fcc); this document maps them to repository work. Current runtime contracts are unchanged. This is planning, not an implemented app.

## Product purpose

Prepare useful, reviewable context for a concrete creative task without repeatedly reconstructing a business from scattered brand material. Instagram is the first implemented source. OpenDesign is an optional implemented adapter. Evidence, confidence, human decisions, selected originals and the request are useful before a recipient is selected.

The intended journey is profile and objective → reused/local versus explicit paid intake → readable summary → important review → task-specific context → generic agent handoff or optional adapter → output and human feedback.

## Next work, in order

| Priority | Product scope | Product tracking | Technical boundary |
| --- | --- | --- | --- |
| Foundation | Retain targeted provenance, human brief and rendered accessibility checks | VAL-100 | #15, #17, #19 stay open; #37 retains durable provider accounting |
| First | Design the first-use journey and recoverable states | [VAL-104](https://linear.app/valenf/issue/VAL-104/design-guided-onboarding-from-a-profile-to-a-first-useful-brief) | Map screens/actions to existing core and CLI; identify gaps before app implementation |
| Alongside journey design | Selective review and room for creative proposals | [VAL-105](https://linear.app/valenf/issue/VAL-105/make-brand-review-selective-while-preserving-creative-freedom) | Specify exploratory versus approved states; do not silently relax current schema/readiness gates |
| Next | Plan a contained local workspace | [VAL-106](https://linear.app/valenf/issue/VAL-106/define-a-contained-local-app-workspace-for-evidence-and-deliverables) | Compare local web and desktop packaging; record a platform decision before choosing a framework |
| Across the journey | Understandable spend, cache reuse and progress | [VAL-107](https://linear.app/valenf/issue/VAL-107/make-paid-actions-cache-reuse-and-run-progress-understandable) | #37 records actual provider usage/billing; product surfaces must retain unknowns and recoverable failures |
| Delivery | Generic task-specific export | [VAL-102](https://linear.app/valenf/issue/VAL-102/prepare-reusable-task-specific-context-for-generic-creative-agents) | #32 reuses canonical context, references and bytes without OpenDesign packaging or reanalysis |
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

No local web/desktop framework is selected. Hosted SaaS/accounts, cloud synchronization, telemetry by default, MCP, new social-network sources and universal vendor support are outside this increment.

## Cost and privacy

Make paid actions explicit before execution, identify cached/local work and avoid automatic paid retries. Preserve actual billed cost, tokens, provider wall time and human effort separately. Label estimates with their basis; unknown values remain unknown, not zero.

User-designated private work remains local and Git-ignored, including identifiers, source material, paths, assets, reports, feedback and outcomes. Public docs, fixtures and product tracking contain generic requirements only. No private case material is needed for this roadmap.
