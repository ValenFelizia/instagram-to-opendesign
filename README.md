# Instagram → OpenDesign Brand Importer

An early open source experiment to turn evidence from a public Instagram profile into a traceable brand package that OpenDesign can use.

**Status:** Ingestion, reviewable evidence, and multimodal analysis are implemented. The OpenDesign package compiler is tracked in GitHub [#5](https://github.com/ValenFelizia/instagram-to-opendesign/issues/5). See the [package CLI guide](docs/package-cli.md), [OpenDesign output contract](docs/output-contract.md), [synthetic package](examples/example-studio/), [ingestion guide](docs/ingestion.md), [evidence guide](docs/evidence-processor.md), and [analysis guide](docs/brand-analyzer.md).

## Goal

Test whether an Instagram profile can provide useful evidence for an initial brand identity, especially when a small brand uses Instagram as its main visual reference. The package should keep source material and confidence for important inferences. A later experiment will compare a design made with the package against a manual image and prompt baseline.

## Initial scope

- **Consumer:** OpenDesign only.
- **Approach:** a standalone CLI or script, with a maintained Instagram extraction provider rather than a custom scraper.
- **Stages:** extraction, evidence processing, analysis, and local OpenDesign package compilation are implemented. New profiles pause for image review before analysis.
- **Excluded initially:** a SaaS UI, continuous synchronization, a productized MCP server, other social networks, and adapters for other design systems.

Product context originated in the [Linear project](https://linear.app/valenf/project/instagram-opendesign-brand-importer-c97b589cc0b2). Public work is tracked in [GitHub Issues](https://github.com/ValenFelizia/instagram-to-opendesign/issues) and developed through pull requests. Technical decisions live in `.csdd/` and public documentation here.

## Development

Node 20+ and `pnpm install` run the project. The package compiler uses Sharp to create a local WebP moodboard. See the guides above and [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE).
