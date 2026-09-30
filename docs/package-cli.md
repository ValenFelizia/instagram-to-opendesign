# OpenDesign package CLI

GitHub [#5](https://github.com/ValenFelizia/instagram-to-opendesign/issues/5) compiles a reviewed profile into a local OpenDesign package. The only target in this release is OpenDesign. Run `pnpm install`, create an ignored `.env.local` with `APIFY_TOKEN` and `OPENAI_API_KEY`, then use PowerShell:

```powershell
pnpm brand:instagram '@publicusername'
```

On first use, the command ingests public posts and creates `data/<username>/evidence/contact-sheet.svg` and `review.json`. It stops with exit code 2 until every selected, profile-owned image has a `brand-graphic`, `product-photo`, or `mixed` classification. Collaborator images are excluded from that gate and from model input. Review the contact sheet, edit classifications in `review.json`, then repeat the **same command**. An existing valid source and analysis are reused; no automatic retries duplicate API charges.

`--refresh` requests new Instagram data through Apify. `--reanalyze` repeats the OpenAI analysis and color proposal. Both may incur new charges. A changed source or review invalidates the relevant cached analysis automatically. To rebuild only the package from current local data without any provider calls, run `pnpm brand:compile data/<username>`.

The output is `brand-output/<slug>/` (for `@felisa_fr`, `brand-output/felisa-fr/`). Both `brand-output/` and `data/` are ignored by Git. The package contains `manifest.json`, `metadata.json`, `DESIGN.md`, all 56 OpenDesign slots in `tokens.css`, a rebased `brand-analysis.json`, selected own images, `assets/moodboard.webp`, and `source/` with captions and evidence. The source export includes only own posts and selected local media paths; it omits expiring CDN URLs, raw provider payloads, collaborators, and credentials. The original normalized ingestion remains in ignored `data/`.

The same command also writes a standalone Spanish [brand report](brand-report.md) to `data/<username>/brand-report.html` for human review. To regenerate Spanish HTML without provider calls, run `pnpm brand:report data/<username>`. Both commands support `--lang en`, which writes `brand-report.en.html` and uses one text-only translation request when the local English cache is not current. This report option does not change the analysis or the OpenDesign package language.

The color proposal makes one additional `gpt-6-luna` Responses API call with at most four reviewed, profile-owned **brand graphics**. It cites their evidence IDs and returns approximate hex candidates. If no brand graphic exists, the compiler uses neutral functional defaults without that call. It checks candidate references and foreground contrast. Fonts, spacing, components, and most semantic tokens are functional defaults, not recovered brand facts. `DESIGN.md` and `source/evidence.md` state this uncertainty; no model output becomes `verified`.

## Loading into OpenDesign

The package follows the [minimum OpenDesign package contract](https://github.com/nexu-io/open-design/blob/main/docs/design-systems.md). It keeps `source/evidence.md` on disk but does not declare `sourceFiles`, which would activate the richer package guard and require additional fixtures and previews.

OpenDesign's `od design-systems import-local` currently treats its argument as a **raw project** and regenerates `DESIGN.md`, even with `--import-mode hybrid` or `verbatim`. It does not preserve the careful uncertainty in a precompiled package. Install this package as a user design-system folder in an OpenDesign instance instead. The location is governed by OpenDesign's [daemon data directory contract](https://github.com/nexu-io/open-design/blob/main/AGENTS.md#daemon-data-directory-contract); with `OD_DATA_DIR` set explicitly for a development instance, copy `brand-output/<slug>/` into its `design-systems/` catalog and run `od design-systems show user:<slug>` to verify the original title, prose, and manifest. The catalog rescans on read. `metadata.json` marks the installed catalog item `published`, which OpenDesign requires for project creation; this is a local usability state, **not** a claim that the inferred brand rules have been verified or publicly released. This route was tested with Felisa in an isolated daemon; `import-local` was also tested and shown to rewrite the authored prose.

Generated real packages contain public profile content and a machine-local `manifest.source.path`. Keep them local. Review redistribution rights and remove local path details before sharing a package externally. The public PR contains only code, documentation, and synthetic fixtures.
