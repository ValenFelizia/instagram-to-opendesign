# Decisions

## DEC-008 — Standalone HTML for reviewing the draft

- Status: accepted for the first report
- Date: 2026-09-29
- Updated: 2026-09-30
- Context: JSON and the OpenDesign package expose sources but do not give the brand owner an accessible overview. The user wants English project documentation and an optional English report while retaining Spanish for Fer's review.
- Decision: generate local HTML from validated analysis with embedded reviewed own thumbnails, internal evidence links, review status and provisional colors. Default to Spanish; `--lang en` translates existing prose with one structured text-only request and a fingerprinted local cache. Keep original source text inspectable and preserve IDs, confidence, status, nulls and hex values. The browser loads no external resources or scripts.
- Rationale: reports can be opened, reviewed and printed without a server; both languages are reproducible from the local snapshot. Translation avoids rerunning visual analysis just to change language.
- Consequence: HTML embeds reduced copies of profile images and text, stays under Git-ignored `data/` and requires permission for redistribution. Spanish regeneration has no provider cost; uncached English translation requires `OPENAI_API_KEY` and may incur a charge. Invalid translations preserve previous output. Real Felisa output stays outside the public repository.
- Evidence: synthetic tests for references, escaping, collaborator exclusion, translation caching and output preservation; local desktop and mobile renders with Felisa.

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
