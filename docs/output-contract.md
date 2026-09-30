# Output contract for OpenDesign (VAL-88)

This document describes the **current OpenDesign target**, pinned to [`nexu-io/open-design` at `1b47e60`](https://github.com/nexu-io/open-design/tree/1b47e60bd46641469fcd8b69c496c4e3a548bc28). The manifest, token schema, and package-quality guard had the same Git blob hashes on current main when VAL-92 was implemented. Recheck upstream before future changes; this is a compatibility snapshot, not a new OpenDesign format.

## Package layout

```text
design-systems/<slug>/
├── manifest.json              required by the new package profile
├── metadata.json              user-catalog selection state
├── DESIGN.md                  canonical agent prose
├── tokens.css                 canonical compiled CSS tokens
├── brand-analysis.json        importer-specific analysis; OpenDesign does not read it
├── assets/                    optional original/approved assets
│   └── logo/
└── source/                    optional provenance and raw evidence
    ├── evidence.md
    └── instagram-source.json  only when Instagram data exists
```

The three required files and legacy `DESIGN.md` fallback are documented in [OpenDesign's authoring guide](https://github.com/nexu-io/open-design/blob/1b47e60bd46641469fcd8b69c496c4e3a548bc28/docs/design-systems.md). The static [synthetic example](../examples/example-studio/) exercises the new profile without requiring Instagram or claiming a real brand identity.

When the package is copied into OpenDesign's **user** design-system catalog, `metadata.json` must set `{"status":"published"}` for the system to be selectable during project creation. This catalog state is local to OpenDesign and does not publish the package online or verify the inferred identity. Keep provisional claims labeled in `DESIGN.md` and the evidence files.

## `manifest.json`

Required v1 keys are `schemaVersion`, `id`, `name`, `category`, `source`, and `files`. `schemaVersion` is exactly `od-design-system-project/v1`; `id` is a lowercase ASCII slug and matches the package directory. `files.design` and `files.tokens` are the fixed names `DESIGN.md` and `tokens.css`. `description` is optional in the parser but useful for the catalog. `source.type` must be one of `bundled`, `local`, `github`, or `shadcn`, with the fields required for that type. The [manifest schema](https://github.com/nexu-io/open-design/blob/1b47e60bd46641469fcd8b69c496c4e3a548bc28/design-systems/_schema/manifest.schema.ts) rejects unknown keys.

For packages generated from Instagram, **do not add `instagram` or analysis fields to the OpenDesign manifest**. The manifest's `source` describes package import provenance in OpenDesign; the Instagram profile and extraction details belong in `source/` and `brand-analysis.json`. A generated package can use `source.type: "local"` when imported from a local directory or `"github"` when imported from a repository, according to the actual import route. Never write a user's private local path into a public fixture.

`assetsDir: "assets"` may declare a real assets directory. `sourceFiles.evidence` may point to `source/evidence.md`; only the known `sourceFiles` keys (`scanned`, `evidence`, `tokens`, `report`, `snippets`) are accepted. Declared paths must be safe, relative, and present. **Declaring any `sourceFiles` key activates the rich-package quality guard**, which requires usage guidance, component fixture and manifest, and previews. The minimum fixture therefore retains `source/evidence.md` on disk without declaring it; OpenDesign will not index it as a source resource. An extra `brand-analysis.json` is retained for our pipeline, but it is **not an OpenDesign manifest field or runtime input** at this revision. Its schema is [here](../schemas/brand-analysis.schema.json). See the [quality guard](https://github.com/nexu-io/open-design/blob/1b47e60bd46641469fcd8b69c496c4e3a548bc28/scripts/check-design-system-package-quality.ts).

## `tokens.css`

The final stylesheet contains a `:root` declaration for **all 56** shared entries in OpenDesign's [`TOKEN_SCHEMA`](https://github.com/nexu-io/open-design/blob/1b47e60bd46641469fcd8b69c496c4e3a548bc28/packages/contracts/src/design-systems/token-schema.ts): A1 identity, A1 structure, A2, and B slots. A1 values require a brand decision or an explicit `needs-review` placeholder at the analysis stage; A2 fallbacks from the schema may be compiled into the final CSS; B slots may alias their documented sibling with `var(...)`. The current guard requires A2 and B declarations even though some descriptions call them conceptually optional. Do not add arbitrary CSS custom properties: OpenDesign allowlists brand-specific extensions per brand.

For a real brand, the compiler must not pass an unverified A1 value as a verified brand rule. Until review or sufficient evidence, it can produce a draft analysis, but a final package should make uncertainty plain in `DESIGN.md` and `source/evidence.md`. OpenDesign's token guard validates structural presence; it does not validate the truth of a brand inference.

## `DESIGN.md`

Use one H1 and substantive H2 sections for visual theme, color roles, typography, spacing and layout, components, motion, accessibility, voice or imagery when evidenced, and anti-patterns. The [authoring guide](https://github.com/nexu-io/open-design/blob/1b47e60bd46641469fcd8b69c496c4e3a548bc28/docs/design-systems.md) says the quality guard for migrated packages expects at least seven H2 headings, without fixed section names. Keep named values aligned with `tokens.css`. Point uncertain claims to `source/evidence.md` rather than presenting them as settled rules.

## `assets/` and `source/`

`assets/` holds files the design agent may use directly, such as an approved logo, selected post imagery, or a contact sheet. Preserve filenames and attribution. Only include material that may legally be redistributed; the synthetic example uses an original SVG. `source/` holds evidence and extraction provenance. `source/evidence.md` is the human-readable index. It can be declared through `sourceFiles.evidence` only when the whole rich profile is supplied. Raw Instagram data, when present, stays separate as `source/instagram-source.json`; do not publish credentials, private data, expiring signed URLs, or copyrighted media without rights.

## Rich profile boundary

OpenDesign also supports `USAGE.md`, component fixtures, previews, derived tokens, and Tailwind output. Declaring them triggers additional guard and runtime expectations. They are outside the first static fixture. The minimum profile is enough to establish discovery and prompt context. VAL-92 tested a real package in an isolated OpenDesign daemon; the later [VAL-93 experiment](https://linear.app/valenf/issue/VAL-93/validar-el-mvp-con-felisa-contra-una-baseline-manual) will test whether it improves a resulting design.

The `import-local` CLI route normalizes a raw source directory and rewrites `DESIGN.md`, losing the authored uncertainty. Installing the compiled folder into OpenDesign's user design-system catalog preserved its manifest and prose; `od design-systems show user:felisa-fr` returned the expected package. See the [package CLI guide](package-cli.md) for this compatibility boundary.
