# Brand report (local HTML)

The report makes the importer output readable before anyone uses the OpenDesign package. It is a **draft for human review**, not a verified brand guide. The public repository includes the generator and synthetic tests; real profile data stays under Git-ignored `data/`.

After a profile has passed the image review checkpoint, run the normal pipeline:

```powershell
pnpm brand:instagram '@publicusername'
```

The command produces the **Spanish** `data/<username>/brand-report.html` alongside `brand-analysis.json` and prints its path. Spanish is the default for brand-owner review. To rebuild that HTML from existing local analysis without Apify or OpenAI calls:

```powershell
pnpm brand:report data/<username>
```

## English reports

Select a report language explicitly with `--lang es` or `--lang en`. The full pipeline accepts the same option:

```powershell
pnpm brand:instagram '@publicusername' --lang en
```

To generate an English report from an existing analysis, with the API key in `.env.local`:

```powershell
node --env-file=.env.local bin/brand-report.js data/<username> --lang en
```

`pnpm brand:report data/<username> --lang en` also works when `OPENAI_API_KEY` is already set in the environment or a current translation cache exists. English writes **`brand-report.en.html`**, preserving the Spanish file. Unsupported or missing language values fail before provider calls.

An uncached English report makes one text-only `gpt-6-luna` request using [structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs). It translates the biography, inference values/rationales, color rationales and evidence summaries. It sends no images or new scrape, does not reanalyze the brand and makes no automatic retries. This requires `OPENAI_API_KEY` and may incur a variable API charge. The output preserves evidence IDs/citations, confidence, status, nulls and hex values; names and handles remain unchanged. Evidence entries retain expandable original text, and the report labels the translated draft for human review.

The validated translation is stored in Git-ignored `data/<username>/report-translation.en.json`. Unchanged text reuses it without a key or new charge; changed text invalidates the cache. Delete that file to request a fresh translation on the next English run. An incomplete, refused or invalid response leaves existing HTML and translation cache intact. Review translated wording before sharing it, especially uncertainty and brand claims.

Open the HTML in a browser. It contains the observed bio, counts of reviewed images and own captions, ten fixed analysis topics, confidence and evidence links, provisional color samples when current proposals exist, a source appendix, and a short review checklist. `needs-review` topics are shown as unresolved. The report never upgrades an inference to `verified` and does not present product colors as brand rules.

The file is standalone: selected, profile-owned reviewed images are reduced and embedded as JPEG thumbnails. No script, font CDN, analytics, external image request, or API call is used when viewing it. The only external link points to the original Instagram profile. The HTML can be printed to PDF from the browser, but print layout and color reproduction depend on browser settings.

**Sharing:** Both HTML versions embed copies of public profile images and caption excerpts. They are ignored by Git, but emailing or uploading them redistributes those copies. Check permission with the profile owner before sharing. Delete the HTML files and translation cache when no longer needed; the commands above recreate them. The generator reads the current local source, reviews, analysis and optional color proposals. If source and analysis disagree, it fails before replacing a prior report.
