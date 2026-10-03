# From profile evidence to an executable brief

The P0 flow is: [confirmed brand decisions](brand-decisions.md) → [approved assets](asset-preflight.md) → design request → 2–3 directions → one human selection → portable brief. The brief is an importer artifact. It does not add fields to OpenDesign's manifest or prove a rendered design is accessible.

## Prepare a request

```powershell
pnpm brand:brief data/example_studio --init web-hero
# Or: --init instagram-story
pnpm brand:decisions data/example_studio --source manual/request.md --reviewer 'Actual reviewer' --summary 'Approved objective, audience, exact copy, action and constraints'
```

Place the reviewed request document under `manual/` first. Edit `design-request.json`, using `schemas/design-request.schema.json`. `sourceId` references the registered confirmation. This is a human record, never a provider assertion. Keep exact copy in blocks with stable IDs; `headline` is required and `brand` supports a brand-first proposal. Record objective, audience and constraints. Existing confirmed copy rules with matching IDs take precedence: conflicting request text cannot become ready.

Choose assets by their catalog IDs, including supplied originals. The catalog must mark them `readyForDesign`. Choose `fit`, contextual `alt.usage`/`alt.text`, and explicitly review low resolution for the actual slot. With `cover`, acknowledge a crop only after inspecting its impact on the subject. `contain` preserves the whole image. Source authorship is insufficient permission.

For a hero, an action can be `none` or a semantic `link` with exact label and HTTP(S) destination. For a static Story, use `none` or `native-sticker`; provide normalized `reservedSpace` (x, y, width, height from 0 to 1), label and destination. The space is a reservation to review in Instagram composer. A fake drawn button is not an interactive sticker, and coordinates are not a permanent platform guarantee.

## Propose and choose

```powershell
# Explicit paid stage if a matching valid local cache is unavailable:
node --env-file=.env.local bin/brand-brief.js data/example_studio --suggest
# Explicitly replace suggestions, potentially charging again:
node --env-file=.env.local bin/brand-brief.js data/example_studio --suggest --force

# Provider-free alternative: import human-written proposals matching the direction schema:
pnpm brand:brief data/example_studio --import path/to/directions.json
```

The provider interface is `requestCreativeDirections(context, options)`. It uses the repository's pinned analysis model and [Responses structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs). It receives text: request/copy, effective observations, confirmed rules, evidence summaries and selected asset properties. No image bytes, manual-document contents or absolute disk paths are sent by this stage. Credentials are needed only for an uncached explicit `--suggest`; no live call is needed to import or compile.

Validation checks 2–3 unique directions, different layouts, reading hierarchies and asset treatments, known citations and selected asset IDs. Directions cannot supply copy, fonts or executable code. Free-text rationales remain **creative proposals requiring review**; a JSON schema cannot establish the truth of prose. A single-image treatment uses one asset; paired uses two. Changing colors alone is not an alternative. See `schemas/creative-directions.schema.json` and the synthetic helper in `test/helpers/brief.js`.

`creative-directions.json` stores the suggestions, model, usage and context digest. Changing only `selectedDirectionId` reuses suggestions. Request text, constraints, fit/alt review, source approval, evidence or asset-byte changes invalidate context. Invalid replies, refusals and failures preserve the previous cache and brief. Compilation rejects stale suggestions rather than silently charging again. Refresh preserves the human inputs, previous brief and cache; a changed context still requires renewed review.

Set `selectedDirectionId` to exactly one proposal ID after reading all alternatives, limits and missing information. Unselected directions stay in the record and do not become execution instructions.

## Compile and hand off

```powershell
pnpm brand:brief data/example_studio --compile
# Optional separate output folder:
pnpm brand:brief data/example_studio --compile --out brand-output/example-studio-brief
```

Both files are built together in `data/<username>/brief/<kind>/` by default, with selected originals, evidence and confirmation snapshots:

- `BRIEF.md`: the design agent's readable instruction, exact copy, selected layout/hierarchy/treatment, assets, action, constraints, confirmed rules, uncertain observations, evidence, acceptance criteria and pending review.
- `design-brief.json`: the same typed record, selected and unselected alternatives, permission provenance, hashes, crop candidates and measured asset properties.

Local compile makes no provider calls. Missing confirmation, objective/headline/audience, selection, required information, crop/alt/resolution review or confirmed-copy conflicts produce `needs-review`, never a ready brief. Invalid references, unapproved assets or stale cache fail before replacing a previous bundle. Existing output directories must contain an importer brief marker; a profile, input folder or unrelated directory cannot be overwritten.

The selected bundle can be reviewed and consumed without an OpenDesign package or installation; see [core and adapter ownership](core-and-adapters.md) and the [synthetic portable brief](../examples/consumer-neutral-brief/). For OpenDesign, use the explicit [delivery command](opendesign-handoff.md) with a matching package and read `BRIEF.md` before composing. Hero acceptance requires a render at 1440 and 390 px wide. Story acceptance requires 1080 × 1920, a text transcript/description, and composer review of the native space. Inspect contrast, keyboard/focus and image alternatives in the actual hero. All publication still requires human review.

## Verification and limits

Synthetic hero/Story fixtures exercise three distinct proposals, selection, exact-copy preservation, portable citations, pending states, confirmed-copy conflicts, rights gates, stale cache, refusal/incomplete response and preservation of the previous result. Paid-provider requests are mocked. The authorized local Felisa Story now has reviewed permissions, an exact request and a selected direction; concrete recipient readback confirms the context was understood. Both generated versions were rejected for creative quality. Its hero remains on standby. These checks do not demonstrate workflow improvement or general utility; see the [verification checkpoint](verification-checkpoint.md).
