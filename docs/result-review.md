# Review a preserved rendered result

`brand:result` compares a selected brief with local HTML, screenshots, rendered DOM observations and original human feedback. It records checks and correction candidates; it does not edit a brief, brand decisions or the website and makes no provider calls.

## Capture the result

1. Preserve the **first** agent output before any correction. Save HTML, supporting local assets/styles and screenshots for each required viewport. Archive the package and complete brief used for the tool arm.
2. For measurable HTML review, use `data-copy-id="headline"` etc., `img[data-asset-id]` with the brief asset IDs, and `data-action` on the requested semantic web link. These inert markers do not replace accessibility semantics. Without markers, visible copy may be checked but geometry/assets/controls remain pending.
3. Run the read-only collector returned by `pnpm brand:result --collector` in the rendered browser document at every required viewport, and save its JSON. The collector does not fetch, persist or modify page data. Record the SHA-256 of the exact preserved HTML alongside each observation. The importing reviewer is responsible for capture provenance; hand-written or stale observations are not independently verified browser facts.
4. Store the owner's **original** feedback in a local file and reference it from the review input. Keep translations identified as translations. Record each prompt, manual edit, asset preparation, ingestion, analysis and review step. Supply minutes/cost or `null`; absence is never zero effort.

```powershell
pnpm brand:result data/example_studio/brief/web-hero review-input.json --out C:/work/result-archives
```

The output is `<archive>/<experiment>/<manual|tool>/r000/`: Spanish `REVIEW.md`, structured `review.json`, original `input.json`, artifacts and complete package/brief snapshots. `--lang en` additionally writes `REVIEW.en.md`. Subsequent corrections use the next revision and only new effort events; records accumulate without overwriting the first output or feedback. Changed shared inputs/model/version/prior knowledge/budget require a new experiment. A different currency cannot be summed into previous costs.

## Input shape

```json
{
  "schemaVersion":"result-review-input/v1",
  "experimentId":"unfamiliar-brand-web",
  "variant":"tool",
  "revision":0,
  "artifactRoot":"C:/work/render",
  "packageDir":"C:/work/package/example-studio",
  "commonInputs":{"root":"C:/work/shared-inputs","files":["request.md","product.jpg"]},
  "run":{"model":"record-the-actual-model","openDesignVersion":"0.23.1","priorKnowledge":"none","iterationBudget":2},
  "currency":"USD",
  "artifacts":[
    {"id":"first","kind":"html","path":"index.html"},
    {"id":"mobile-shot","kind":"screenshot","path":"mobile.png"},
    {"id":"mobile-dom","kind":"observations","path":"mobile.json","htmlId":"first","htmlSha256":"replace-with-the-actual-64-character-hash"},
    {"id":"owner-feedback","kind":"feedback","path":"feedback.md"}
  ],
  "feedback":[{"sourceArtifactId":"owner-feedback","reviewer":"actual reviewer","note":"original request-specific feedback","cause":"unknown","referenceIds":["headline"]}],
  "events":[{"id":"prompt-1","type":"prompt","description":"Initial agent instruction","minutes":null,"cost":null}]
}
```

Use `supporting` artifacts for explicit styles/assets needed to reopen HTML. `packageDir` is required for the tool arm, optional for a manual baseline. Shared file names/bytes and request form the matched-input hash. Causes are `source-selection`, `inference`, `preparation`, `brief`, `opendesign-composition` or `unknown`; deterministic checks default to unknown rather than guessing attribution. Human judgments cite preserved original feedback and known copy/asset/evidence/rule references. They remain specific to this request and require review before any change to canonical brand decisions. Model suggestions are a separate empty lane unless explicitly supplied by a future reviewed workflow.

## What can be observed

- Exact visible copy (whitespace normalized, case/punctuation preserved), approved local asset bytes, approved alt text, declared canvas and actual image export dimensions.
- Unrounded contrast for measured solid foreground/background pairs; transparent/composited/photo backgrounds remain pending.
- Horizontal overflow, measured copy/image/action intersections, explicit cover-fit conflicts and reserved native sticker intersections.
- A marked semantic action's label/destination/visibility and center hit-test obstruction. Hit testing does not establish full visual legibility or keyboard access.

Screenshots alone do **not** establish computed contrast, action semantics, keyboard/focus, source bytes or contextual alternatives. Crop/subject quality, distortion, clipping masks, reading order, accessibility and composition require human review. The tool cannot certify a rendered piece or assign an objective aesthetic score. A pass concerns only its named check; publication always requires human acceptance. Invalid paths, changed HTML capture hashes and duplicate markers fail before writing an archive.

## Matched evaluation protocol

Run a web case (hero or existing-site change) and a static case (Story or promotional image), prioritizing an unfamiliar brand with the same known source facts for both arms. A manual evaluator may use the same acceptance brief as the reference; do not feed the tool package or selected execution bundle to the manual agent.

For each format, predeclare objective, exact copy, supplied originals/rights, channel rules, dimensions, existing-site access if relevant, model, OpenDesign version, prior knowledge and iteration budget. Hold the source files and review standard equal. Keep first outputs/captures and every subsequent prompt/edit. Record ingestion, analysis, asset preparation and human review before rendering as well as composition and correction effort. If a phase requires no work, explicitly record a zero event with a reason; unknown costs/time remain null. Deviations from the budget are recorded and prevent a complete matched-effort claim.

```powershell
pnpm brand:result --compare C:/work/results/case/manual/r001/review.json C:/work/results/case/tool/r001/review.json
```

The comparison verifies matched inputs/settings and complete effort records, and reports supplied deltas only when comparable. Its conclusion remains `insufficient-evidence`: a person must compare accepted outputs and choose **helps**, **marginal improvement**, **worsens**, or **insufficient evidence**, explain the basis and attribute each correction honestly. Separate context not read from missing context, misinterpretation and composition errors. Never attribute manual corrections to the importer.

## Current evidence and #22 gate — 2026-10-03

Synthetic tests verify hidden/obstructed actions, copy and asset mismatches, insufficient contrast, immutability, Story export dimensions, reserved-space overlap and screenshot-only uncertainty. OpenDesign catalog selection and concrete agent context readback are verified under #20. Matched unfamiliar-brand utility is **not measured** yet.

Felisa's manual result used substantial prior brand knowledge and cannot support a general utility claim. After rejecting two later Story outputs, the user reported a substantially better new output with a permissive prompt, a fresh chat and GPT 6 Astra. All three variables changed together; this is request-specific feedback, not causal attribution or matched utility evidence. The user explicitly resumed hero exploration with actual repository context while preserving website identity and supplied photos. Matched design runs and full effort records remain pending in VAL-100/#21. User-designated private case progress, content and metadata stay in local Git-ignored records.

**#22 is closed under its no-expansion gate.** The recipient readback revealed no inaccessible-context gap warranting a rich profile. Reconsider only after a preserved evaluation identifies specific missing context that the minimum package plus selected handoff cannot provide. No rich implementation or superiority result is claimed. Do not treat unread context or a composition mistake as evidence for expansion.

The end-to-end pipeline returns color usage without retaining analyzer usage. #37 tracks durable provider/phase accounting. Preserve unavailable historical usage/time/cost as null; provider wall-clock duration is not human active effort.
