# Human brand decisions

The optional `data/<username>/brand-decisions.json` is the local source of confirmed rules. It is not a model output and does not extend Open Design's manifest. All commands below are local and make no provider calls.

The input fixture in `examples/brand-decisions/` uses an invented reviewer and values. Copy its files only into a synthetic profile. Open Design continues to consume `DESIGN.md` and `tokens.css` through `user:<slug>`; the new decision JSON is importer-owned provenance, not a new consumer interface.

```powershell
pnpm brand:decisions data/example_studio --init
pnpm brand:decisions data/example_studio --source manual/brand.md --reviewer 'Actual reviewer' --summary 'Confirmed site tokens and licensed font'
pnpm brand:decisions data/example_studio --check
pnpm brand:compile data/example_studio
pnpm brand:report data/example_studio
```

Before registering a source, place a reviewed source document in the profile's `manual/` directory. Registration records its SHA-256, reviewer and date. It does not approve an inference. Add rules referencing the returned source ID, following `schemas/brand-decisions.schema.json`. Never claim brand-owner approval unless it actually happened. A source document should record how exact values and font licensing were checked.

```json
{"id":"R-ACCENT","kind":"token","target":"accent","value":"#315a46","sourceId":"S-OWNER"}
```

Token targets omit the `--` prefix and use the 56 existing slots. `font` rules target a font stack token; `copy` and `constraint` rules provide explicit instructions; `logo` rules reference a reviewed image evidence ID. `assetSelections` reference reviewed image IDs, a role, an include/exclude/primary action and a source. Permissions and reusable asset preparation are handled separately in #16.

Initialization never overwrites decisions. The CLI initializes pending inference records with fingerprints. To accept a candidate as a proposal, or reject it, update its action, reviewer, reviewedAt and note. An accepted proposal retains its original inference status. A rejected candidate is suppressed from effective design guidance; the original analysis remains available. Changed candidates or cited bytes make the decision stale. Changed manual sources make their rules and asset selections stale; inspect and re-verify before updating hashes, rather than merely making a check green.

The compiler applies current human token/font rules, derives a readable accent foreground when it is not confirmed, and rejects an explicitly confirmed pair with inadequate contrast. Other contrast combinations still require the checker in #19. An alias that cannot resolve for the accent also fails. The 56-token template and manifest remain compatible with the minimum Open Design contract pinned in `docs/output-contract.md`.

`DESIGN.md` distinguishes effective guidance from historical inference, cites both sources when they differ, and lists every token's origin. `source/token-origins.json` records confirmed rules, approximate visual candidates and functional defaults. Referenced source files and a rebased decision snapshot are included in `source/`; the original `brand-analysis.json` is not rewritten. The HTML adds a read-only decision/provenance section; interactive review is #18.

Missing decisions preserve the existing workflow. Invalid schema, unsafe values, unknown references or missing files fail before replacing a valid package/report. Refresh preserves `brand-decisions.json` and `manual/`; edited decisions do not trigger another model analysis. Real data remains Git-ignored, and source documents containing confidential information or material without permission must not be redistributed.
