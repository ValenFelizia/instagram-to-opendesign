# Guided onboarding and brand dossier prototype

Tracking: [GitHub issue 43](https://github.com/ValenFelizia/instagram-to-opendesign/issues/43) / [VAL-104](https://linear.app/valenf/issue/VAL-104/design-guided-onboarding-from-a-profile-to-a-first-useful-brief). Entry point: [`prototypes/onboarding/index.html`](../prototypes/onboarding/index.html); instructions: [prototype README](../prototypes/onboarding/README.md).

## Working design brief

The primary operator understands providers and files but should not have to reconstruct a business, memorize schema names or start with a destination-specific setup. The main action is to prepare reusable brand context. Intent is optional at intake and can change after reading the dossier without repeating analysis. Current repository/package/CLI/schema names remain unchanged; **Contexto de marca** is a functional prototype label, not a product naming decision.

Domain concepts: evidence, dossier, source, observation, inference, proposal, reuse, task and reading order. The visual direction is a workbench for inspecting material: warm paper, graphite text, leaf-green actions, clay in the fictional imagery and amber for pending decisions. The signature is the relationship between a visual sample, a source-backed signal and a limited next decision, followed by a folder-like handoff.

Use Georgia for reading headings and an available system interface font for controls, with no external font download. Border-based separation, a 4/8px spacing family, restrained radii, visible focus and 44px controls support long reading and technical inspection. These are interface decisions for this prototype, not extracted identity rules. Avoid unrelated dashboard metrics, repetitive full-screen approval gates and destination-first setup. No pre-existing app component system or framework is present; the prototype deliberately uses standalone HTML/CSS/classic JavaScript.

The operator sees a useful summary before every detail is approved. The model cannot confirm facts, permission or source authority. A palette accepted **for exploration** remains provisional; image reuse and confirmed execution are separate decisions. Draft preparation in this interface is a product concept under review, not a relaxation of `design-request/v1` or selected-brief readiness.

## Screen and state map

| Screen/state | Main question or action | Saved synthetic state | Important behavior |
| --- | --- | --- | --- |
| First use / home | Which profile should supply context? Optional task | Goal enum; no entered URL | Profile validation, access to settings, cached example without APIs |
| Configuration | Are extraction and analysis configured? | Demo configured flag only | Fixed demo credentials; missing/invalid errors; advanced configuration disclosure |
| Scope confirmation | What would call providers or reuse work? | Nothing starts until confirmation | Unknown cost is stated; reused extraction is shown on repeat analysis |
| Processing | Where is the project, and can I leave? | Phase/status | Project remains reachable; no fake percentage or real background-worker claim |
| Image review pause | Which images depict identity or products? | Three classifications, including partial choices | Full framing/expandable original; incomplete/all-excluded sample error; classification is not reuse permission |
| Cached/readable dossier | What was found, inferred and proposed? | Ready status and previous decisions | Summary, visuals, distinct signal labels and evidence; IDs inside technical disclosure |
| Selective review | Which decision changes the next use? | Palette proposal/pending/rejected; mock permission | No requirement to accept every inference; no confirmation implied |
| Action selection | What should an agent explore next? | Task and fictional code-access flag | Same reading reused for all tasks; site-change requires explicit mock access |
| Handoff example | What does the recipient need, and what is missing? | Selected task/review state | Single Markdown example with clear limits; no canonical execution/publication claim |
| Stale sources | What is still reusable from the previous reading? | Stale flag and old dossier | Old dossier remains viewable; new handoff blocked; revised reading needs confirmation |
| Recoverable failure | What survived, and what would retry? | Failure at analysis and reviewed images | Fictional returned tokens retained, billing unknown; explicit repeat analysis reuses extraction |
| Interruption | Did the work continue after the window closed? | Last phase | It did not: reopen requires explicit local resume; no automatic provider retry |

Main route: profile → optional configuration → scope confirmation → processing → image review → dossier → optional selective review → action → illustrative handoff. A cached project enters at the dossier. The sidebar supports leaving the active view; scenario shortcuts allow reviewing each state without waiting for failures. Only one synthetic project is implemented.

## Mapping to current core operations

This table is an integration plan based on the current source, not a list of operations invoked by the browser. No prototype action imports Node core modules, writes canonical artifacts or calls a provider.

| Prototype surface | Existing operation/artifact | Integration gap and boundary |
| --- | --- | --- |
| Profile intake/configuration | `src/normalize.js` username handling; `src/providers/apify.js`; provider credentials supplied to the Node process | URL normalization parity, secure local settings, configuration checks and preflight planning need app orchestration. Never expose actual keys through browser storage |
| Start/reuse/progress | `runPipeline()` in `src/pipeline.js`; `brand:instagram`; private `brand-run/v1` records | Add a read-only plan of cache/provider work before execution, job ownership and UI events. Current pipeline has ingestion/evidence/analysis/colors/compilation; demo groups these into four readable stages |
| Review images | `processEvidence()` / `reviewCheckpoint()`; `evidence/review.json` | Real writer must retain revisions/classifications and revalidate ownership. Existing core supports `mixed`; demo deliberately omits it. “Leave out” needs a specified inclusion mapping; do not pass the demo's `excluded` value as an existing classification |
| Resume after review | Explicit repeat of `brand:instagram` with valid reviewed evidence | Model phase resume is illustrative. The real pipeline validates cache/fingerprints and retains provider observations; safe persisted job restart is not implemented by a browser timer |
| Dossier/evidence | `brand-analysis.json`, `instagram-source.json`, evidence index, color proposals; `buildBrandReport()` | The redesigned view needs a canonical view model and renderer, original text/translation handling, source access and stale state. The current Spanish/default and `--lang en` behavior stays intact |
| Selective review | `brand-review/v1` export and explicit decisions import; `brand-decisions.json`; `loadDecisions()` | Proposal acceptance, verified source rules and channel-specific authority must map through current fingerprint/revision checks. Permission belongs to asset review, not an inference toggle. The transition/authority proposal is issue 44 |
| Asset use | `buildAssetCatalog()` / `asset-review.json`; `brand:assets` | Real authorization provenance, crop/alt review and bytes must be recorded. Fixture rights are not sufficient |
| Choose task | `emptyRequest()`, `validateRequest()`, `prepareBrief()`; `design-request.json` | Story/promo/site-change kinds exist, with their own dimensions and constraints. Full conceptual landing is a product choice without a matching current request kind. It needs an explicit contract proposal; do not relabel it `web-hero` |
| Existing-site context | `existingSite` source/access/file hashes in request/core; authorized recipient code access | UI must link an actual authorized folder/repository, inspect selected context safely, preserve hashes and verify recipient access; this prototype only toggles a fictional folder |
| Prepare context | `compileBrief()` / `exportAgentHandoff()` via `src/core.js`; `brand:handoff`; `verifyAgentHandoff()` | Current export requires canonical request and selected direction; pending briefs retain blockers. A loose goal alone is not exportable through this contract. The demo Markdown is intentionally a different illustrative download |
| Stale/retry/cost | Canonical fingerprints, cache validation and `brand-run/v1` attempts | Need a UI projection distinguishing phase/provider progress, retained previous valid artifacts, actual observed billing and unknown values. Issue 46 owns the detailed surfaces; issue 45 owns process lifecycle/storage |

## Gaps to resolve before app implementation

1. **Authority and exploration contract — issue 44 / VAL-105.** Decide the minimum task context for useful exploratory work, exactly what remains pending, and which actions require confirmed copy, image rights, selection or real-site access. Preserve current gates until an explicit schema/core change is accepted. A conceptual landing also needs a bounded request/target definition.
2. **Local app/platform and durable job ownership — issue 45 / VAL-106.** Choose packaging only after reviewing filesystem access, credential custody, per-profile concurrency, persistence, process interruption and recovery. The browser prototype cannot establish secure settings, background jobs, cancellation or atomic project transactions.
3. **Execution plan and event projection — issue 46 / VAL-107.** Expose work that is local, cached, provider-bound or unknown before starting. Project journal data into useful statuses without claiming percentages, zero bills, complete charges or human minutes. Include the separate color-analysis request and any translation/direction calls outside the main journal.
4. **Canonical dossier view model.** Aggregate evidence/inference/decision/permission/currentness into one rendering boundary; keep original sources, user changes, evidence ownership and status inspectable. The authored fixture has three signals rather than pretending to render the ten-topic analysis schema. Rejected/excluded material must not keep supporting a regenerated claim.
5. **Safe integration boundary.** Node core is not browser code. Define validated local commands/messages, file access, concurrency and error shapes for the chosen shell; no unrestricted path/command execution or automatic paid action should follow UI input.

These are observed orchestration needs, not decisions to use a specific framework, hosted service or additional vendor. Existing technical issues retain their scope; avoid duplicating them before the review clarifies concrete integration work.

## Verification recorded

- 56 local synthetic tests passed, including three new storage/profile/reopen tests. No live provider run.
- The reproducible `verify-browser.mjs` walkthrough passed in local headless Microsoft Edge over `file://`: invalid URL/settings, linked errors and focus restoration, explicit scope confirmation, leaving/reopening a view, image-review pause, partial choices, dossier evidence, selective proposal review, task reuse, website-access blocker, Markdown download, stale-input blocker, explicit retry and interruption/resume.
- Browser requests in that walkthrough contained no HTTP(S) traffic; no console/page errors were observed. This is page-traffic evidence, not an OS-wide network audit.
- Desktop 1440px and mobile 390px journey screenshots were inspected. 320px home, review images and dossier overflow checks passed. Reduced-motion styling and visible keyboard focus were checked. Native dialog/fieldset/label/status/error semantics are used.
- Automated checks and screenshot inspection do not certify WCAG conformance. Actual Narrator/other assistive-technology behavior, high zoom and human usability/visual preference still need their own review. No private case content, paid run, canonical app integration or publication was exercised.

## Concrete product review questions

1. Does the first screen invite entering a profile quickly, with enough technical configuration nearby?
2. Does the dossier give enough understanding to act before opening evidence, while making uncertainty credible?
3. Is the image pause worth its interruption, and should the future system suggest labels before asking for review?
4. Does a goal-only exploratory handoff feel useful, or should choosing a task also ask for a short outcome/copy/action prompt here?

Operator update: the user accepted the concept/flow and authorized PR #47's merge, verified in main at `55eb220`. They requested a minimal future UI with useful information and direct titles, and explicitly deferred visual/copy polishing. The [issue 44 proposal](selective-review.md) is also reviewed/merged through PR #48. The [issue 45 blueprint](local-workspace.md) records the subsequent Windows-first Electron direction (DEC-011); this prototype remains unchanged. Prototype acceptance is distinct from delivery of a working integrated app or full accessibility conformance.
