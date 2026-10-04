# Decisions

## DEC-010 — Prioritize a guided local product for creative-agent context

- Status: accepted direction; roadmap/backlog reconciliation, not an app implementation
- Date: 2026-10-03
- Context: the user clarified that useful context for creative agents is the product purpose, independently of OpenDesign. Continuing vendor generation or treating formal comparisons as the only evidence would displace the requested onboarding and product improvements.
- Audience clarification: prioritize technical operators comfortable with APIs and creative-agent workflows. Assisted use by a nontechnical owner is possible, but independent nontechnical onboarding is not the initial target. Source: user's explicit clarification, 2026-10-03.
- Journey acceptance: the user accepted the #43 prototype's concept/flow and authorized merging PR #47. Future UI should be minimal, contain useful information only and use direct status/section titles instead of editorial SaaS copy. Visual/copy polishing is explicitly deferred while product behavior progresses. Source: user's review, 2026-10-03.
- Decision: prioritize the first-use journey, selective review, planning a contained local workspace, reusable task-specific generic handoff and explicit spend/reuse information. Keep OpenDesign as an optional implemented adapter and current names for compatibility. Platform/framework selection follows journey review; hosted SaaS, MCP and broad vendor support remain outside this increment.
- Rationale: practical acceptance and concrete friction can guide iteration without asserting measured savings or comparative superiority. Creativity needs room for proposals while facts, permissions and explicit approval remain authoritative.
- Consequence: matched experiments remain optional research for specific comparative claims and budgets. Close #21's implemented review-feature scope without claiming matched utility; retain #15/#17/#19 manual checks. Reframe #32 as generic export, retain #37 accounting and lower #33 naming priority. VAL-104–VAL-107 define the next product scopes. Current CLI selected-brief gates are unchanged; app review states are planned work.
- Evidence: user's explicit approval to reorder the backlog and update Linear; [product direction](https://linear.app/valenf/document/product-direction-and-guided-local-workflow-2026-10-03-7dede0439fcc). Private project evidence and outcomes remain local.

## DEC-009 — Separate canonical preparation from the OpenDesign adapter

- Status: accepted; implemented in merged PR #36 (main @ b394e9e)
- Date: 2026-10-03
- Context: #31 / VAL-101 defines a consumer-neutral boundary. Core decision validation currently derives permitted names from OpenDesign's 56-slot template, and existing-site instructions name its access mechanism. The authorized Story trial confirms readable transferred context but rejects creative outputs, without isolating a cause.
- Decision: keep decisions, request, selected brief, source/asset hashes and acceptance tasks canonical before choosing a consumer. Put OpenDesign manifest, catalog status and token allowlist/materialization behind its package adapter; retain compatible CLI/module entry points. Reject unmapped names explicitly rather than silently discard or reinterpret a confirmed rule. Generic code access becomes a recipient-specific instruction only at delivery.
- Rationale: a renderer's fixed slots must not decide which brand facts the core can retain. This allows a complete synthetic selected brief without an OpenDesign package or runtime while retaining the current adapter.
- Consequence: the generic fixture is not a utility result. DEC-010 updates #32 to generic task-specific export and makes additional recipient comparisons optional. Do not rename repository/schema IDs automatically (#33) or add a rich profile without an observed gap (#22). Creative exploration remains separate from matched utility evaluation.
- Evidence: core boundary and rollback tests, existing package/delivery regression suite, synthetic portable fixture, and sanitized manual checkpoint in `docs/verification-checkpoint.md`.

## DEC-008 — Standalone HTML for reviewing the draft

- Status: accepted for the first report
- Date: 2026-09-29
- Updated: 2026-09-30
- Context: JSON and the OpenDesign package expose sources but do not give the brand owner an accessible overview. The user wants English project documentation and an optional English report while retaining Spanish for Fer's review.
- Decision: generate local HTML from validated analysis with embedded reviewed own thumbnails, internal evidence links, review status and provisional colors. Default to Spanish; `--lang en` translates existing prose with one structured text-only request and a fingerprinted local cache. Keep original source text inspectable and preserve IDs, confidence, status, nulls and hex values. The browser loads no external resources. Issue #18 adds an embedded hash-authorized script solely for explicit review download/import comparison; file writes remain an explicit CLI action.
- Rationale: reports can be opened, reviewed and printed without a server; both languages are reproducible from the local snapshot. Translation avoids rerunning visual analysis just to change language.
- Consequence: HTML embeds reduced copies of profile images and text, stays under Git-ignored `data/` and requires permission for redistribution. Spanish regeneration has no provider cost; uncached English translation requires `OPENAI_API_KEY` and may incur a charge. Invalid translations preserve previous output. Real Felisa output stays outside the public repository.
- Evidence: synthetic tests for references, escaping, collaborator exclusion, translation caching and output preservation; local desktop and mobile renders with Felisa.

## DEC-007 — Keep the importer local after the Felisa trial

- Status: accepted for VAL-93
- Date: 2026-09-28
- Context: the first package-assisted hero preserved verified identity but repeated the collage and failed at 390 px. A second product-led hero worked on mobile, but the owner rejected it as conventional. Two Stories using identical prompts and assets produced similar solutions; the owner preferred the version without the package.
- Decision: conclude that these trials showed no clear visual improvement or demonstrated effort reduction. Keep the importer local and reviewable; do not expand to MCP yet. Deliver the preferred manual Story locally after replacing the bag screenshot with the original photo of the same product.
- Rationale: the storefront already supplies verified typography, color and copy, so the Instagram package adds context but little incremental value to a tightly defined brief. Owner preference and visual defects carry more weight than technical execution alone.
- Consequence: the next hypothesis is to propose several composition directions and check assets before generation. The final Story still needs inspection in Instagram's editor with its native link sticker before publication. No real asset enters the OSS repository.
- Evidence: protocol and results in `docs/mvp-validation.md`; real HTML, screenshots and notes under Git-ignored `data/felisa_fr/validation/`; owner feedback from the trial.

## DEC-006 — Enable package selection in OpenDesign's local catalog

- Status: accepted for VAL-93
- Date: 2026-09-28
- Context: `od design-systems show` could read the Felisa package, but a new project rejected `user:felisa-fr` with `DESIGN_SYSTEM_NOT_PUBLISHED`; a user folder without `metadata.json` is treated as `draft`.
- Decision: the compiler writes `metadata.json` with `status: published` beside the manifest. This enables local project selection; identity inferences remain provisional and reviewable in `DESIGN.md` and the sources.
- Rationale: a discoverable package that cannot be selected does not satisfy the workflow VAL-92 set out to validate. Catalog status does not alter the analysis or send the package to a public service.
- Consequence: existing installations must be recompiled and the new file copied into the catalog. Felisa is tested in an isolated instance; real assets stay outside the repository.
- Evidence: OpenDesign `0.23.1` in an isolated daemon; project creation failed without `metadata.json` and succeeded with `status: published`; a new project created with the public `user:example-studio` fixture; 15 importer tests.

## DEC-005 — Compile a minimal package without normalization by reimport

- Status: accepted for VAL-92
- Date: 2026-09-28
- Context: analysis describes identity without exact hex colors or font names, while OpenDesign requires `tokens.css`. In the live trial, `od design-systems import-local` rebuilt `DESIGN.md` as a raw project and lost uncertainty notices.
- Decision: propose colors with an extra request limited to reviewed own graphics, fill all 56 tokens with provisional functional values and retain provenance in `brand-analysis.json` and `source/`. Keep the minimum profile without `sourceFiles`. Install the precompiled folder into the user catalog rather than using `import-local` to test preservation.
- Rationale: authored `DESIGN.md` keeps analysis and limits visible without inventing verified rules or assuming rich-profile requirements.
- Consequence: CSS values require brand review; local installation differs from raw-project import, and real data stays outside the public repository. VAL-93 measures utility against a baseline.
- Evidence: isolated `od design-systems import-local` and `od design-systems show user:felisa-fr` runs; [OpenDesign guide](https://github.com/nexu-io/open-design/blob/main/docs/design-systems.md).

## DEC-004 — Initial vision-based Brand Analyzer with subsequent review

- Status: accepted for VAL-91
- Date: 2026-09-28
- Context: VAL-90's reviewed evidence supports trying brand inferences but does not confirm the brand owner's decisions.
- Decision: use `gpt-6-luna` with `high` reasoning through Responses API for a ten-topic draft; send only reviewed own images and captions. Validate schema and references locally, preserve uncertainty and never automatically produce `verified` status.
- Rationale: one request and at most 24 images bound the cost of a reproducible analyzer while keeping inference checks in the repository.
- Consequence: live runs require `OPENAI_API_KEY` and may incur a charge. A person reviews proposals before compiling the OpenDesign package. Real data and generated JSON stay Git-ignored.
- Evidence: [model](https://developers.openai.com/api/docs/models/gpt-6-luna), [image inputs](https://developers.openai.com/api/docs/guides/images-vision) and [structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs).

## DEC-003 — Reviewable visual classification for the first validation

- Status: accepted for the first profile
- Date: 2026-09-26
- Context: VAL-90 must distinguish graphics from product photos before inferring identity. Initial validation uses 15–25 posts and does not require bulk processing yet.
- Decision: generate a contact sheet and index with manual `brand-graphic`, `product-photo` and `mixed` labels, plus reviewable visual features and composition groups in `review.json`. Unreviewed images do not contribute confirmed signals.
- Rationale: human review of a small profile audits identity versus incidental color without introducing a vision API at this stage.
- Consequence: classification requires human review and does not automatically scale to many profiles. A vision API could later suggest labels behind the same interface.

## DEC-002 — Apify ingestion behind an interface

- Status: accepted
- Date: 2026-09-26
- Context: VAL-89 calls for public data retrieval without a custom scraper and evaluates Apify first.
- Decision: use the maintained `apify/instagram-scraper` Actor with two runs (`details` and `posts`), encapsulated in `src/providers/apify.js`. The pipeline consumes a normalized contract instead of the Actor payload.
- Rationale: the Actor documents both result types, and Apify supports execution, waiting and dataset reads. Avoiding an npm client keeps the first CLI executable with Node 20+.
- Consequence: live ingestion requires an Apify account/token and may incur charges. The Actor format can change. Synthetic tests cover the local contract; a live run is required before completing VAL-89.
- Evidence: [Instagram Actor](https://apify.com/apify/instagram-scraper) and [API v2](https://docs.apify.com/api/v2).

## DEC-001 — Keep inference separate from the OpenDesign manifest

- Status: accepted
- Date: 2026-09-26
- Context: VAL-88 requires evidence and confidence per inference, while OpenDesign's manifest v1 rejects unknown keys and describes package import metadata.
- Decision: keep `brand-analysis.json` importer-owned and leave the manifest unextended. The minimum fixture includes `source/evidence.md` without declaring `sourceFiles`, which activates the rich-profile guard and requires extra files.
- Rationale: preserve compatibility and provenance. OpenDesign can index evidence when a complete rich profile is implemented.
- Consequence: OpenDesign does not read the analysis or expose the undeclared evidence file in the first fixture. A later compiler transfers only defensible decisions into `DESIGN.md` and `tokens.css`.
- Evidence: [`manifest.schema.ts`](https://github.com/nexu-io/open-design/blob/1b47e60bd46641469fcd8b69c496c4e3a548bc28/design-systems/_schema/manifest.schema.ts) and [`check-design-system-package-quality.ts`](https://github.com/nexu-io/open-design/blob/1b47e60bd46641469fcd8b69c496c4e3a548bc28/scripts/check-design-system-package-quality.ts).
