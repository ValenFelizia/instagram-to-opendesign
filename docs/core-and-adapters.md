# Canonical core and reference adapter

The core prepares source-backed design context before choosing a recipient. OpenDesign is the first implemented reference adapter. A selected brief can be compiled, reviewed and consumed without an OpenDesign package or installation. This boundary does not demonstrate improved creative quality or compatibility with an untested consumer.

```text
Instagram ingestion (current source adapter)
  -> reviewed evidence + inference
  -> source-confirmed decisions + asset inventory
  -> design request + distinct proposals + human selection
  -> selected brief, original assets, sources, acceptance tasks
       -> OpenDesign compiler -> package -> explicit catalog delivery
       -> filesystem/agent consumption experiment (#32)
```

## Ownership

| Artifact or behavior | Owner | Authority |
| --- | --- | --- |
| `instagram-source.json`, current extraction/normalization | Instagram source adapter | Source observations; no brand approval |
| `brand-analysis.json`, evidence IDs and confidence | Core inference record | Proposals; never model-verified facts |
| `brand-decisions.json`, source hashes, channels and reviewer | Core | Current human rules outrank inference |
| `asset-review.json`, `asset-catalog.json` | Core | Original bytes, permission and composition review |
| `design-request.json`, `creative-directions.json` | Core | Confirmed request plus reviewable proposals |
| `BRIEF.md`, `design-brief.json`, bundled assets/evidence/sources | Core | Exactly one selected direction; portable paths and pending acceptance |
| `accessibility.json`, `ACCESSIBILITY.md` | Core | Declared-use checks; rendered review remains pending |
| OpenDesign slug, `manifest.json`, local `metadata.json`, `DESIGN.md`, 56-slot `tokens.css` | OpenDesign package adapter | Consumer compatibility; no identity verification |
| Version/layout probes, workspace binding, catalog API, START/USAGE and delivery receipt | OpenDesign delivery adapter | Explicit installation/selection and context preservation |

The legacy analysis schema identifier contains `instagram-to-opendesign` for compatibility. It does not require an OpenDesign manifest, resource ID, catalog status or token schema. Changing schema IDs, package names and the repository is separate work (#33). Instagram remains the only implemented source adapter; this is consumer independence, not an assertion of arbitrary source support.

## Core entry point

`src/core.js` exposes decisions, asset preparation, request validation, direction import, selected-brief compilation and accessibility preflight. For an existing reviewed local profile:

```js
import { compileBrief } from './src/core.js';
const { outputDir, brief } = await compileBrief('data/example_studio');
// Inspect status and pending tasks before giving outputDir to a recipient.
```

The core validates safe token names/values but does not impose OpenDesign's 56-slot allowlist. A confirmed `craft-ink` rule is valid core data. Unresolved aliases remain pending in accessibility checks. Rules retain provenance and channel authority; preparation never invents a mapping, font licence or approval.

Authorized existing-site context records an explicit directory, source and selected file hashes. The recipient must obtain access before editing. The core does not prescribe a vendor-specific access mechanism or copy the repository into a bundle. The OpenDesign delivery adapter supplies its `linkedDirs` instruction.

## OpenDesign compilation contract

The implementation is `src/adapters/opendesign/package.js`, with token compatibility checks in `src/adapters/opendesign/tokens.js`. Existing imports from `src/package.js` remain supported through a compatibility re-export. CLI names and output shapes are unchanged.

```js
import { compilePackage } from './src/adapters/opendesign/package.js';
await compilePackage(preparedEvidence, validatedAnalysis, colorProposals, {
  outputRoot: 'brand-output', channel: 'social'
});
```

The adapter validates current canonical evidence, loads current decisions and asset permissions, applies confirmed values, and materializes the pinned manifest, catalog status, token slots and provenance. It neither owns the original decisions nor requires a selected brief to compile a reusable brand package. Delivery separately requires a current selected brief and matching source/package hashes.

An unmapped core token or alias is an actionable adapter error before any output replacement. The core rule remains intact. No unsupported token is silently discarded and no automatic mapping changes brand meaning. An explicit, reviewed mapping policy is future work if a real recipient needs one. Existing supported tokens retain the prior output contract.

`src/delivery.js` and `src/opendesign.js` are the existing OpenDesign delivery adapter entry points. They are deliberately outside `src/core.js`; catalog/workspace operations are never part of canonical preparation.

## Synthetic fixture and limits

[`examples/consumer-neutral-brief`](../examples/consumer-neutral-brief/) is a complete selected Story brief with synthetic original images, source confirmation, three proposals, exact copy, permission references and accessibility tasks. It includes custom core color names, but no OpenDesign manifest, catalog metadata or 56-token stylesheet. It is a preparation fixture, not a successful creative trial or a real brand approval.

Boundary tests verify safe custom rules, ready brief serialization without a package, source/asset hashes, unmapped adapter rejection and preservation of the previously valid package. Existing package/delivery regressions retain the OpenDesign contract. #32 must test actual recipient use and effort with equivalent inputs; this issue adds no second production adapter.
