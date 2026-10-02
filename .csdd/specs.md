# Specifications

## Project Summary

The project investigates whether a public Instagram profile provides enough evidence to generate a traceable initial brand identity useful to design agents, with OpenDesign as the first consumer. Source: the “Instagram → OpenDesign Brand Importer” project in Linear.

## Requirements

- OpenDesign is the first package consumer. Spike validation compares a piece generated with the package against an image-and-manual-prompt baseline. Source: the Linear project and user-defined scope.
- Important identity inferences retain evidence and confidence. Brand identity must be distinguished from incidental aesthetics in photos or products. Source: the Linear project.
- The package follows OpenDesign's current contract and retains inspectable assets and original sources. Source: the Linear project.
- Project-authored repository documentation, CSDD state, issue titles/bodies, PR titles/descriptions, review notes and project comments use English. Source: the user's language preference, 2026-09-30.

## Language Policy

- Use English for project documentation and collaboration artifacts, including new or edited GitHub issues and PRs. Follow this policy when generating these artifacts even when the request or conversation is in Spanish.
- Reports default to Spanish for the brand owner's review and support English as an explicit option (`--lang en`). This policy does not change the default report language.
- Preserve original source evidence, quotations and confirmed brand copy in their original language. Identify translations as translations; do not translate identifiers, paths or references.
- Conversation with the user may follow the user's language. The public project artifact must still follow the English policy.
- `AGENTS.md` exposes this policy to repository agents; `CONTRIBUTING.md` documents it for contributors. Source: the user's request to make the convention durable, 2026-09-30.

## Constraints

- Preserve the current Felisa website palette despite the deliberate yellow Instagram logo background. Keep its hero work on standby pending a new approach and additional supplied photos. Source: user's review, 2026-09-30.
- Optimize for a small number of effective reviews leading to useful agent context for promotional artwork and website changes, including explicit existing-site code context when available. Evaluate unfamiliar brands; Felisa's prior manual brand knowledge cannot demonstrate general utility. Source: user's direction, 2026-09-30.

- The repository is public open source software. Source: the user's initial request.
- Other design-system consumers are outside the initial scope. Source: the user's initial request.
- Do not start with a custom Instagram scraper, MCP server, SaaS or continuous synchronization. Source: the Linear project.

- Felisa validation compares the same piece and input files with and without a package when a reproducible baseline exists, records corrections and keeps real results outside Git. For Stories, Fer adds the native link sticker after reviewing the PNG; the artwork does not simulate a link button. Source: VAL-93 / GitHub #6 and the user's request.

## Invariants

- Report translation changes prose only. Evidence IDs, citations, review status, confidence, null values and candidate hex colors remain unchanged. Original source text remains inspectable.

## Interfaces and Contracts

Result review preserves immutable first/subsequent outputs, complete brief/package snapshots, viewport artifacts and original feedback. Deterministic checks consume explicitly supplied rendered observations; screenshots alone retain uncertainty. Corrections remain request-specific with explicit/unknown causes. Matched comparison includes shared source bytes, prior knowledge and all supplied preparation/review/edit effort; it does not generate an aesthetic score or infer utility. Rich packages remain gated by observed missing context. Source: GitHub #21/#22 and user direction, 2026-09-30.

Explicit delivery targets a supplied absolute OpenDesign data directory and verified installation version, validates current package/selected-brief context and hashes, and atomically installs a minimally described published user catalog entry plus a portable handoff and starter instruction. Promotional-image and website-change requests specify target dimensions; authorized existing-site file hashes remain local context and require OpenDesign linked directory access before editing. Delivery never starts generation. Source: GitHub #20 and local OpenDesign 0.23.1 integration.

Packaged OpenDesign 0.24.1 delivery additionally requires an explicit loopback daemon origin and verified workspace/member pair. Reserve a personal agent-managed resource through the daemon API, preserve the reviewed DESIGN/token/asset/evidence bytes, and supply selected-request authority through USAGE.md and the portable handoff. Administrative metadata may add the workspace binding; accessibility reports are recomputed. Record input and installed inventories, detect omitted/changed/unexpected files, and verify active context readback before accepting the installation. Failed verification restores the prior entry; uncertain reservation cleanup must be reported. Source: GitHub #20 desktop regression and corrected runtime trial, 2026-10-02. Operational details and tested limits are canonical in `docs/opendesign-handoff.md`.

Accessibility preflight evaluates declared solid-color usages with unrounded WCAG contrast thresholds, resolves token aliases and keeps unknown/photo backgrounds pending. Verifiable failures prevent brief execution; contextual alternatives, keyboard/focus/semantics, resize, reduced motion and artwork descriptions remain rendered acceptance tasks. It does not rewrite confirmed colors or certify accessibility. Source: GitHub #19.

The report reviews inference proposals through local labeled controls and exports a scoped `brand-review/v1` download. Explicit CLI import validates profile, evidence fingerprints and decision revisions, preserving confirmed rules and unrelated rows. No browser storage or network calls are used. Optional website/social rule scopes keep channel authority distinct. Source: GitHub #18 and user review, 2026-09-30.

A validated `design-request.json` selects hero or static Story, source-confirmed copy, action, constraints and approved assets. Explicit creative generation returns 2–3 structurally distinct proposals through a reusable provider/cache; local human imports are also supported. A selected direction produces portable `BRIEF.md` and `design-brief.json` outside the OpenDesign manifest. Missing approval, crop/alt/slot review or selection keeps the brief pending. Changes invalidate cached context; local compilation never calls providers. Source: GitHub #17 and the approved P0 plan.

An optional `asset-review.json` records originals, captures, derivatives, roles, permissions and composition candidates. `brand:assets` measures file dimensions and actual transparency, proposes non-mutating crops for hero or Story slots, and writes `asset-catalog.json`. Unknown permissions or unresolved overlays prevent reusable export; originals can be supplied under `manual/`. The compiler retains reference evidence separately from confirmed reusable assets. Source: GitHub #16 and the approved P0 plan.

An optional `brand-decisions.json` stores verified local rules and source/reviewer provenance separately from model analysis. Confirmed rules override inference; proposal acceptance does not verify a fact. Source/candidate fingerprints require renewed review after changes. Invalid decisions preserve prior outputs; manual documents and decisions survive refresh. The package and report expose origins and source comparisons. Source: GitHub #15 and the approved P0 plan.

Ingestion produces `instagram-source.json` and local assets in a Git-ignored directory. The JSON retains public profile metadata, links, recent posts, captions, source URLs, file paths, primary authors and provider provenance. Collaborative posts are retained even when their primary author differs from the requested profile. The provider interface is isolated from normalization so the service can be replaced. Source: VAL-89 / GitHub #2 and live validation with `@felisa_fr`.

The evidence processor consumes `instagram-source.json` and assets; it produces a contact sheet, caption corpus, `evidence.md` and a machine-readable index. It samples every post before adding carousel images. Classification (`brand-graphic`, `product-photo`, `mixed`) is a reviewable observation: unclassified images do not support brand-color claims. Collaborative-post ownership is retained and highlighted to avoid attributing third-party graphics to the target profile. Source: VAL-90 / GitHub #3 and live validation with `@felisa_fr`.

The Brand Analyzer consumes only selected, reviewed, profile-owned images (up to 24), own captions and profile metadata. It produces local schema-v1 `brand-analysis.json` with ten fixed topics, qualitative confidence, resolvable evidence IDs and `inferred` or `needs-review` status. A model response cannot establish `verified`; product photos alone cannot support color or typography rules. API or validation failures preserve the previous analysis. Source: VAL-91 / GitHub #4 and DEC-004.

The `brand:instagram` CLI reuses local ingestion and analysis, prepares evidence and pauses when a selected own image lacks classification. Repeating the command after review resumes the pipeline; `--refresh` and `--reanalyze` make potential new charges explicit. The compiler produces a local Git-ignored package under `brand-output/<slug>/`, remaps analysis sources to included files, excludes other authors' posts and preserves the previous package on failure. A second vision request may propose approximate colors from reviewed own graphics; other functional tokens and UI typography remain provisional. Source: VAL-92 / GitHub #5 and DEC-005.

The HTML report presents the observed profile, ten inferences with status and source links, current color candidates, reviewed own evidence and pending decisions. `brand:instagram` generates `data/<username>/brand-report.html`; `brand:report` rebuilds the Spanish report without providers. `--lang en` produces `brand-report.en.html` and uses one text-only translation request when a matching local cache is unavailable. Translated biography, inference prose, color rationales and evidence summaries retain their source meaning; original evidence text remains expandable. Both outputs are standalone, responsive, printable and Git-ignored. Validation or translation failures preserve the previous HTML. Source: the user's report request, language preference and DEC-008.

The OpenDesign package uses `design-systems/<slug>/manifest.json`, `DESIGN.md` and `tokens.css`. Manifest v1 requires `schemaVersion: od-design-system-project/v1`, an `id` matching the slug, name, category, `source` and fixed paths to the canonical files. CSS declares all 56 shared `TOKEN_SCHEMA` slots. Source: [`nexu-io/open-design` at `1b47e60`](https://github.com/nexu-io/open-design/tree/1b47e60bd46641469fcd8b69c496c4e3a548bc28), manifest schema, token schema and authoring guide. Operational details and limits are in `docs/output-contract.md`.

Installing a package into OpenDesign's user catalog requires `metadata.json` with `status: published` to enable project creation. This is local catalog status, not inference verification or external publication. Source: VAL-93 integration trial and DEC-006.

`brand-analysis.json` belongs to the importer, not OpenDesign's manifest. Its initial schema in `schemas/brand-analysis.schema.json` retains candidate values, confidence, evidence, brief rationale and review status per inference. Source: VAL-88 and DEC-001.
