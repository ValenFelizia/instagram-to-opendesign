# Brand report (local HTML)

The report makes the importer output readable before anyone uses the OpenDesign package. It is a **draft for human review**, not a verified brand guide. The public repository includes the generator and synthetic tests; real profile data stays under Git-ignored `data/`.

After a profile has passed the image review checkpoint, run the normal pipeline:

```powershell
pnpm brand:instagram '@publicusername'
```

The command produces `data/<username>/brand-report.html` alongside `brand-analysis.json` and prints its path. To rebuild only the HTML from an existing local analysis, without Apify or OpenAI calls:

```powershell
pnpm brand:report data/<username>
```

Open the HTML in a browser. It contains the observed bio, counts of reviewed images and own captions, ten fixed analysis topics, confidence and evidence links, provisional color samples when current proposals exist, a source appendix, and a short review checklist. `needs-review` topics are shown as unresolved. The report never upgrades an inference to `verified` and does not present product colors as brand rules.

The file is standalone: selected, profile-owned reviewed images are reduced and embedded as JPEG thumbnails. No script, font CDN, analytics, external image request, or API call is used when viewing it. The only external link points to the original Instagram profile. The HTML can be printed to PDF from the browser, but print layout and color reproduction depend on browser settings.

**Sharing:** The HTML embeds copies of public profile images and excerpts of captions. It is ignored by Git, but emailing or uploading the file redistributes those copies. Check permission with the profile owner before sharing it. Delete `data/<username>/brand-report.html` when it is no longer needed; rerun `brand:report` to recreate it. The command reads the current local source, reviews, analysis and optional color proposals; it incurs no provider charges. If the source and analysis disagree, it fails before replacing a prior report.
