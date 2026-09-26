# Brand analysis v1

The importer keeps an analysis record separate from OpenDesign's package manifest. The machine-readable contract is [`schemas/brand-analysis.schema.json`](../schemas/brand-analysis.schema.json); [`examples/example-studio/brand-analysis.json`](../examples/example-studio/brand-analysis.json) is a synthetic fixture.

Each `inferences[]` entry has a `topic`, a candidate `value` (or `null`), `confidence`, `evidenceIds`, a short `rationale`, and a `status`:

- `verified`: a human checked the value against the brand evidence. The record should say what was checked.
- `inferred`: evidence supports a usable candidate, but it has not been verified by a human.
- `needs-review`: evidence is weak, conflicting, or absent. A tentative value may be present, but it is not a settled brand rule.

`confidence` describes support from the cited evidence (`high`, `medium`, `low`, or `null` when it cannot be assessed). It is independent of review status. The schema requires a nonempty value, confidence, and at least one evidence reference for `verified` or `inferred` entries. A `needs-review` entry may use `null` for unknowns. Evidence IDs must resolve to `evidence[]` records; each record points to a path inside the package. The schema checks field shape, while the pipeline must also check reference integrity and file existence.

For a real Instagram run, evidence records may reference a source dump, an approved local asset, or a specific entry indexed in `source/evidence.md`. Store extraction provider and timestamps in the source dump or evidence notes. Do not encode credentials, private data, or expiring signed media URLs in a package intended for publication.

OpenDesign does not parse this JSON. The later compiler must translate only defensible decisions into `DESIGN.md` and `tokens.css`, preserve uncertainty in prose, and keep the analysis record available for review. The OpenDesign manifest accepts no custom analysis key.
