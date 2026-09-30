# Prepare assets before design

`brand:assets` is a local, provider-free check. It does not remove UI, retouch products, infer rights from Instagram authorship or crop originals.

```powershell
pnpm brand:assets data/example_studio --init
pnpm brand:assets data/example_studio --add manual/product-original.png
pnpm brand:assets data/example_studio --check --kind instagram-story
pnpm brand:compile data/example_studio
```

Keep actual files and reports in Git-ignored `data/`. Initialization and registration never overwrite a review. Review each entry in `asset-review.json`:

- Set `origin` to `original`, `screenshot` or `derivative` after looking at it. Set `uiOverlay` to `false` only after checking for embedded controls, dots or text. Images with UI remain reference evidence until a reviewed clean original is supplied.
- Record `permission.use`: `unknown`, `analysis-only`, `local-design` or `redistributable`. For design use, cite `permission.sourceId` from the source registry in [brand decisions](brand-decisions.md). Register a real permission document with reviewer/date; the tool does not establish copyright or consent.
- Choose a role, optional primary per role, and `include`. Confirmed selections in `brand-decisions.json` take precedence for existing evidence. Exclusion preserves evidence but prevents design use. Supplied originals use `A-LOCAL-...` IDs and their entry's selection.
- Alt text is a candidate. Decide `informative` or `decorative` in the actual composition; decorative usage has empty text. Nothing infers a person's identity.
- Optional `subjectBox` is a normalized rectangle from 0 to 1. A centered cover proposal requests review when the subject would be cut, or its location is unknown. Use contain when appropriate. No original is modified.

`asset-catalog.json` records dimensions (respecting EXIF orientation), aspect ratio, format, byte size, alpha channel and **actual transparent pixels**. A PNG with an opaque alpha channel is not a transparent cutout. The default hero image slot is 1440 × 720; the Story canvas is 1080 × 1920. Slot compatibility is not viewport validation, and small images are flagged without assuming they must fill the whole canvas. Callers can supply a different positive integer slot size.

Changed file bytes invalidate the asset review. Changed permission documents invalidate their approval. Missing current images, unsafe paths, unknown sources and multiple primaries per role reject compilation before replacing a prior output. Update the digest only after renewing human review.

In the compiled package, `source/asset-catalog.json` has remapped local paths. Only `readyForDesign` files go into `assets/reusable/`. Other files and `assets/moodboard.webp` remain analysis references and must not be reused as approved artwork. The catalog keeps exclusions, origin URLs, measured properties and candidate alt/crop information. Permission and manual source snapshots remain inspectable. This adds no keys to OpenDesign's manifest.

## Local verification, 2026-09-30

The existing Felisa validation PNG visibly contains carousel dots at its lower edge; the supplied JPEG has no dots. Sharp measured 705 × 888 for the PNG, with an alpha channel but **no transparent pixels**, and 1200 × 1600 for the JPEG with no alpha channel. A provider-free Story catalog check inspected 18 reviewed own images and marked zero reusable: no local permission review exists yet. This verifies detection and pending state, not brand-owner approval. Actual images remain Git-ignored.
