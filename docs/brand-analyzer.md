# Brand Analyzer

GitHub [#4](https://github.com/ValenFelizia/instagram-to-opendesign/issues/4) turns reviewed evidence into a draft `brand-analysis.json`. It does not create an OpenDesign package or verify brand-owner decisions.

Run `pnpm install`, then put `OPENAI_API_KEY=<your API key>` in the ignored `.env.local`. The OpenAI API key is separate from `APIFY_TOKEN` and may require billing. Do not commit keys, profile data, or a real analysis. In PowerShell:

```powershell
node bin/analyze-brand.js data/felisa_fr --dry-run
node --env-file=.env.local bin/analyze-brand.js data/felisa_fr
```

The dry run reads local files without an API call or key. It reports selected image and caption counts, exclusions, and image bytes. The live command uses `gpt-6-luna` with `reasoning.effort: high` through the [Responses API](https://developers.openai.com/api/docs/models/gpt-6-luna). It sends up to 24 reviewed, profile-owned selected images as local image data URLs, plus profile metadata and captions authored by that profile. Collaborator posts and unreviewed images are excluded from inference input. Images are sent with `detail: high`; [OpenAI documents image input and its variable token cost](https://developers.openai.com/api/docs/guides/images-vision). A run makes one API request, with no automatic retry; there is no fixed dollar estimate or service-side spend cap.

The output is `data/<username>/brand-analysis.json`, ignored by Git. It conforms to [`brand-analysis.schema.json`](../schemas/brand-analysis.schema.json) and contains exactly one inference for each of ten topics: palette, color roles, typographic style, photographic direction, texture/materiality, composition, tone, CTAs, personality, and UI guidance. Descriptions are in Spanish. Every cited ID resolves to a local evidence record; sources are relative to the profile directory. `inferred` means supported candidate, not brand-owner confirmation. The model cannot mark a value `verified`; unknown or weak claims remain `needs-review`. Product photos alone cannot support an inferred color or typography rule.

The CLI validates schema shape, citation IDs, file paths, topic coverage, and conservative source rules before replacing any prior analysis. An incomplete or invalid API response leaves the previous file in place. Review the local output before promoting any candidate into OpenDesign's `DESIGN.md` or tokens. The later package generator will remap these local evidence paths to its `assets/` and `source/` directories.
