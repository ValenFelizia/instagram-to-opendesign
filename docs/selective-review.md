# Selective review and authority proposal

**Status: proposal/prototype reviewed and merged through PR #48, main `4b50917`; #44 closed and VAL-105 Done.** Tracking: [GitHub issue 44](https://github.com/ValenFelizia/instagram-to-opendesign/issues/44) / [VAL-105](https://linear.app/valenf/issue/VAL-105/make-brand-review-selective-while-preserving-creative-freedom). Interactive examples: [`prototypes/selective-review/index.html`](../prototypes/selective-review/index.html). Production schema/contract implementation remains separate. Its isolated synthetic model is not a security boundary, real approval system or canonical export.

The user accepted the onboarding concept/flow and authorized PR #47's merge. Future product UI should use direct titles, less copy and only useful information; visual/copy polishing is deferred. This proposal addresses review behavior, not a redesign of that prototype.

## Proposed principle

Ask for decisions that change the chosen action. A dossier is readable before approval. Exploration can begin with an objective, clearly bounded evidence and unresolved creative choices; it must not turn unknown facts, uncertain provenance or missing reuse permission into usable instructions. The agent can propose copy, style and layout as drafts. Confirmed copy, applicable rules, permission boundaries and existing-site authority still constrain that exploration.

Do not ask the operator to accept all ten inferences. Rank review by consequence: permission/authenticity; product/copy/action conflicts; selected-image fit/alternative/resolution; actual code access; selected direction. Optional voice/style hypotheses can be accepted for exploration, rejected or deferred without establishing universal brand identity. Display evidence on demand and technical IDs in a deeper disclosure.

## Authority matrix

| Material class | What it means | Permitted agent use | Review action | Authority it never gains automatically |
| --- | --- | --- | --- | --- |
| Source observation | Something appears in a current owned/cited source | Quote or describe it with attribution; preserve original text and source | Correct attribution, source or interpretation with provenance | A profile caption is not proof of inventory, permission or a universal business claim |
| Inferred candidate | A fallible interpretation, with confidence/evidence | Use as a hypothesis when relevant, label uncertainty | Accept **for exploration**, reject, defer, revisit | Acceptance does not create a verified rule |
| Functional default | A fallback required to render/read a view | Use as a technical fallback; disclose its origin | Override for a task where useful | A default font is not an identified/licensed brand font |
| Creative proposal | A request-specific copy/layout/style alternative | Present for human choice; preserve original and later edits | Edit, reject, defer, select exactly one applicable direction | An attractive composition does not become a brand fact |
| Human-confirmed rule | A value with current source, reviewer and channel/task authority | Respect within its scope | Show consequence and require a sourced correction before replacement | A social rule does not silently override website rules; an agent cannot confirm one |
| Reuse permission | An authorization tied to asset/source, allowed use and current bytes | Bundle/use originals only within permission scope | Confirm provenance and permitted use; otherwise reference/exclude/replace | Public visibility or a product classification is not permission; local design permission is not publication permission |

Untrusted source text remains evidence, never tool instructions. Mixed/collaborative-post ownership remains inspectable. A collaborator photo can be used with that owner's permission, while its visual identity must not be attributed to the target profile. Rights/authenticity and brand identity are independent questions.

## State and transition matrix

These are proposed product states. They are not new values accepted by existing schemas.

| State/action | Minimum condition | What may be prepared | What remains blocked | Next transition |
| --- | --- | --- | --- | --- |
| Readable dossier | Available evidence, ownership/currentness and uncertainty | Inspectable observations, inferences and defaults, including incomplete material | No confirmation, reuse or execution follows merely from opening it | Choose task; review relevant uncertainties |
| Exploratory context | A meaningful task/goal, applicable confirmed constraints and explicit evidence/rights boundaries | Draft proposals/questions; placeholders where original reuse is not authorized; supplied confirmed copy preserved | Unsupported factual claims, unlicensed originals, unauthorized code edits, confirmed execution and publication | Human corrects/confirms relevant inputs and selects direction |
| Selected execution, pending review | Concrete target/use, current confirmation sources, selected assets and one direction | Inspect exact copy/action, rules, fit/alt limits and explicit blockers | Execute/publish until applicable blockers are resolved and the selection is reviewed | Explicit human review of the current snapshot |
| Selected execution, reviewed | Current request/source/asset/code fingerprints; applicable permission, copy/action facts, one selected direction, preflight and required fit/alt/resolution review | Hand off the selected task for execution under its constraints | Publication; unrelated variants; exceeding private/local design authorization | Produce and review an actual output separately |
| Publication acceptance | Reviewed current execution plus actual output hashes, target/platform, human acceptance, publish rights and rendered/accessibility checks | Record acceptance of this exact output for this use | Sending/deploying/publishing is a separate authorized operation | Explicit publication operation if requested |
| Relevant inputs changed | A dependency of a reviewed snapshot changed | Read the old snapshot as history, inspect the diff, reuse unrelated decisions | Old approval is not current; no automatic provider rerun, execution or publication | Review changed dependencies, choose direction again where affected |

Paid provider execution is separate from these states and always follows an explicit scope/reuse plan. “Ready” is not a bill estimate, an API call or permission to publish. A source rule confirmed for both channels can carry `all` scope; differences between correctly scoped website/social values are not inherently conflicts. A conflict occurs when a request tries to apply a contrary value within a confirmed rule's scope.

### Agent instructions by state

- **Exploration:** explain what is supported; respect current confirmed copy/rules; propose alternatives only where unconfirmed or as explicit proposed corrections; flag missing facts; use a placeholder for an unapproved original; propose website changes without editing if access is missing. Keep rejected proposals out of recommendations, with their history still available.
- **Selected execution:** execute exactly the chosen direction and source-confirmed copy/action; preserve original assets and use limits; surface pending acceptance checks. Other directions are historical proposals, not simultaneous instructions.
- **Publication acceptance:** record the output/platform/reviewer scope and remaining actions. Acceptance is not an automatic upload/deploy or a blanket approval of later revisions.

## Task-specific priority

| Task | Review before using actual originals / selected execution | Exploration can leave open | Publication/output checks |
| --- | --- | --- | --- |
| Story / promotional image | Product identity, exact selected copy/action, image provenance and use permission, full-frame/crop/alt/resolution, target dimensions and one direction; Story native sticker space/destination | Alternative headline drafts, composition, provisional palette/type, unknown facts explicitly excluded from claims | Actual PNG text/description, contrast/legibility, native platform overlays/sticker and publish permission |
| Conceptual landing | Bound audience/page scope/target, available authorized originals, permitted product/business claims; a separate proposed request kind is required | Sections, draft copy, design system proposals, placeholder images and omitted unknown prices/contact methods | Render, responsive/keyboard/accessibility review; no invented live site or deployment |
| Existing-site change | Explicit authorized current repository context/access, applicable website rules, exact change scope and current selected files/hashes; preserve existing behavior | Change ideas or a diff plan without code mutation; style exceptions can be proposals, never silent overrides | Actual diff/build/render, responsive behavior and acceptance for the specified revision; merge/deploy remains separate |

## Edit, reject, defer and revisit

| Operation | Consequence shown before committing | What is retained | Invalidation |
| --- | --- | --- | --- |
| Accept inferred voice/style | “Use for exploration; not verified identity” | Original candidate, evidence and acceptance scope | No selected-execution change unless that candidate is explicitly bound into its task context |
| Reject / defer / revisit | Rejection removes the candidate from recommended proposals; pending allows later review | Stable ID, original candidate and prior decisions; unrelated rules/rows | A selected dependency cannot disappear silently: show affected task before committing |
| Edit a creative proposal | It remains a proposal, and a previously selected dependent direction needs review | Original text, edited variant, history and unrelated decisions | Dependent direction/execution/publication; no brand-rule rewrite |
| Correct confirmed copy/rule | Diff, source/scope, affected selection and approval consequences | New provenance-backed revision plus old confirmation snapshot; unrelated rules and decisions | Affected copy/rule, dependent direction and execution/publication acceptance |
| Change source or selected asset bytes | Explain which evidence/permission/decision is no longer current | Previous valid artifacts and observations as history | Only dependent reviews/exports; stable source IDs do not make changed bytes trusted |
| Change task/channel | List new relevant permission, action/fit/alt/target/code requirements | Brand evidence and unrelated reviewed decisions; channel-specific rules | Task binding, direction, slot-specific resolution acceptance and dependent output acceptance |

Updates should be atomic, scoped and optimistic: validate candidate/source fingerprint and base decision revision; apply changed rows only. A rejected candidate is not deleted. A draft edit is not a new confirmed source. A confirmed correction requires reviewer/provenance and an explicit consequence acknowledgment. Unaffected approvals can be preserved only when dependency identity/content/scope proves that they remain applicable; do not revive a previously revoked approval merely because a value is changed back.

## Synthetic examples exercised

| Case | Required question | Demonstrated result |
| --- | --- | --- |
| Reviewed sample | Select a direction; optional voice interpretation can be rejected | Original confirmed copy/rules unchanged; execution and output review remain separate |
| Incomplete evidence | Missing product facts, unconfirmed text, uncertain original and reuse permission | Exploration retains uncertainty and uses a placeholder; accepting voice clears none of those blockers |
| Collaborator image | Permission of the actual owner; identity attribution | Reference is not exported as a reusable original. Replacement gets a different stable ID; collaborator content does not establish target-profile identity |
| Low resolution | Explicit acceptance for the particular slot/use or another original | Acceptance does not upscale bytes or certify sharpness; changing task resets slot-specific acceptance. Dimensions are declared scenario metadata, not a measured file |
| Missing site access | Authorized code access/current context | Propose changes without editing; selected website-change review remains blocked |
| Website/social conflict | Preserve the applicable confirmed website rule | Social value remains in its own scope; moving to a social task does not keep a website-only blocker |
| Correction/source change | Show consequence, reason and stale revision | New mock copy source/revision; old selected snapshot retained; dependent selection/acceptance revoked, unrelated voice/rules preserved |
| Local design versus publication permission | Separate allowed use | Unit-tested local-only authorization permits reviewed local execution but blocks publication acceptance |

The browser controls intentionally simulate provenance verification; their buttons are not acceptable proof in a real implementation. State lives in memory only. The context preview is an illustrative view, not `brand-review/v1`, `design-brief/v1` or a complete downloadable package. The toy model uses simple revision flags/keys, not canonical cryptographic fingerprints, a complete dependency graph or concurrent transaction storage. No actual render, source measurement, permission verification or publication occurs.

## Current contract and proposed implementation changes

| Boundary | Implemented behavior | Proposed change, subject to review |
| --- | --- | --- |
| Inference decisions | `brand-decisions/v1` supports `accept-proposal`, `reject`, `pending`; `importReview()` checks fingerprint/base revision and preserves unrelated rows | Reuse those meanings; add app view state/revisit history around canonical data. Do not add `verified` as a model result |
| Confirmed rules | Current source/reviewer/hash records and `all`/`website`/`social` scope; `loadDecisions()` excludes stale rules | Add a previewed, sourced correction transaction with explicit dependent invalidation and retained revision history |
| Exploratory input | `prepareBrief()` currently validates concrete requests and design-authorized assets even before a pending brief can be exported | Propose a **separate, versioned exploratory envelope/compiler** accepting a bounded goal with candidate copy and placeholder/reference policy. Do not overload `design-brief/v1` or call its pending mode a goal-only export |
| Selected execution | Current request/source/headline/audience/asset selection, one direction, fit/alt/resolution and accessibility gates | Preserve current CLI behavior; eventually convert an exploration into a new validated canonical request through explicit human decisions, not a flag promotion |
| Conceptual landing | Current request kinds are `web-hero`, Story, promo and website-change | Propose a bounded page-level request kind with required page/target scope and unknown-business-data policy. It is not a hero alias |
| Existing-site changes | Existing code context, if supplied, is authorization/hash validated; its presence is not currently required for every `website-change` request | Proposed app/contract distinction: change ideas may remain exploratory; approved code editing must require actual authorized existing-site context. Assess tightening/migration explicitly in a separate implementation PR |
| Publication acceptance | Current result archives and rendered observations retain immutable outputs and manual checks; no auto-publication | Propose a distinct acceptance record bound to output hash, reviewed execution/input hashes, platform/use, rights source and reviewer. Do not infer this from a selected brief or scorecard |
| Recipient instructions | Current generic handoff has canonical reading order, bytes and selected/pending status | Keep selected export unchanged. New exploratory export needs explicit authority/proposal/placeholder instructions and compatible inventory verification, with its own mode/version |

Implementation should follow operator review in a separate PR with schemas/validation, migration/rejection rules, regression tests and frozen prior export preservation. Do not add proposed enum values to existing files or weaken readiness under the existing version. Repository/package/CLI names, Spanish report default and explicit English report option remain unchanged. OpenDesign stays optional; no new vendor, platform/framework or paid generation is selected here.

## Verification and review

62 local synthetic tests passed, including six new prototype tests for authority, permission scope, exact-copy correction, invalidation/history and case-dependent blockers. The local Edge walkthrough passed linked errors, native radio arrows, visible focus and modal Escape/return; separate execution/render/publication; reference replacement, task/source changes, preserved disclosures/decisions and escaped edits. Desktop 1440px and mobile screenshots inspected; all six 390px cases and representative 320px overflow checks passed. No browser HTTP(S) requests, errors or browser storage writes were observed. Reduced-motion styling was checked. This is not Narrator/assistive-technology certification or a production approval test.

Review these product choices before core implementation:

1. Allow goal-only exploration with placeholders and clearly incomplete facts, preserving confirmed copy/rules?
2. Keep creative preference acceptance separate from verified identity, and require a sourced correction to replace confirmed authority?
3. Require actual authorized site context for selected code changes, while allowing earlier change ideas without it?
4. Keep output/publication acceptance distinct from selected execution, bound to an actual artifact and permitted use?
