# Instagram → OpenDesign Brand Importer

An early open source experiment to turn evidence from a public Instagram profile into a traceable brand package that OpenDesign can use.

**Status:** Implemented stages include ingestion, evidence, analysis, reviewed decisions, asset preparation, HTML review, accessibility preflight, brief compilation, OpenDesign delivery and result review. Canonical preparation is separate from OpenDesign package/token requirements; landing state is tracked in `.csdd/todo.md`. Local checks and recipient context readback passed; the two subsequent Felisa Story versions were rejected for creative quality. General utility and reduced friction remain unmeasured. The generated identity remains provisional. See the [verification checkpoint](docs/verification-checkpoint.md), [core/adapter boundary](docs/core-and-adapters.md), [validation results](docs/mvp-validation.md), [package CLI guide](docs/package-cli.md), [brand report guide](docs/brand-report.md), [OpenDesign output contract](docs/output-contract.md), [synthetic package](examples/example-studio/), [ingestion guide](docs/ingestion.md), [evidence guide](docs/evidence-processor.md), and [analysis guide](docs/brand-analyzer.md).

## Goal

Test whether an Instagram profile can provide useful evidence for an initial brand identity, especially when a small brand uses Instagram as its main visual reference. The package should keep source material and confidence for important inferences. A later experiment will compare a design made with the package against a manual image and prompt baseline.

## Initial scope

- **Consumer:** OpenDesign is the first implemented reference adapter. Canonical selected briefs are prepared before consumer-specific packaging; a second-consumer experiment is tracked in #32.
- **Approach:** a standalone CLI or script, with a maintained Instagram extraction provider rather than a custom scraper.
- **Stages:** extraction, evidence processing, analysis, and local OpenDesign package compilation are implemented. New profiles pause for image review before analysis.
- **Excluded initially:** a SaaS UI, continuous synchronization, a productized MCP server, other social networks, and adapters for other design systems.

Product context originated in the [Linear project](https://linear.app/valenf/project/instagram-opendesign-brand-importer-c97b589cc0b2). Public work is tracked in [GitHub Issues](https://github.com/ValenFelizia/instagram-to-opendesign/issues) and developed through pull requests. Technical decisions live in `.csdd/` and public documentation here.

## Development

The first delivery improvements add [human brand decisions](docs/brand-decisions.md), [asset preflight](docs/asset-preflight.md) and an [executable hero/Story brief](docs/design-brief.md). These keep confirmed rules, evidence, creative proposals and pending reviews distinct. Design briefs require a human-selected direction; local compilation makes no paid calls.

The next reviewable stage supports [declared-use accessibility checks](docs/accessibility-preflight.md), [explicit OpenDesign delivery and promotional/site-change requests](docs/opendesign-handoff.md), and [immutable result review plus matched evaluation](docs/result-review.md). Website/social rules retain separate authority. Felisa's current website identity stays in effect during user-authorized hero exploration; richer packages require observed missing context first.

Node 20+ and `pnpm install` run the project. The package compiler uses Sharp to create a local WebP moodboard; the report generator uses it for portable thumbnails. See the guides above and [CONTRIBUTING.md](CONTRIBUTING.md).

Project documentation, issues and pull requests use English. Brand reports default to Spanish and support `--lang en`; see the [report guide](docs/brand-report.md) for translation credentials, caching and costs.

## License

[MIT](LICENSE).
