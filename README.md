# Instagram → OpenDesign Brand Importer

An early open source experiment to turn evidence from a public Instagram profile into a traceable brand package that OpenDesign can use.

**Status:** Static OpenDesign contract fixture complete. The ingestion and evidence stages are under development in GitHub [#2](https://github.com/ValenFelizia/instagram-to-opendesign/issues/2) and [#3](https://github.com/ValenFelizia/instagram-to-opendesign/issues/3). See the [OpenDesign output contract](docs/output-contract.md), [synthetic package](examples/example-studio/), [ingestion guide](docs/ingestion.md), and [evidence guide](docs/evidence-processor.md). The fixture has been checked against upstream schemas, but has not been exercised in a running OpenDesign instance.

## Goal

Test whether an Instagram profile can provide useful evidence for an initial brand identity, especially when a small brand uses Instagram as its main visual reference. The package should keep source material and confidence for important inferences. A later experiment will compare a design made with the package against a manual image and prompt baseline.

## Initial scope

- **Consumer:** OpenDesign only.
- **Approach:** a standalone CLI or script, with a maintained Instagram extraction provider rather than a custom scraper.
- **Proposed stages:** extraction, evidence processing, multimodal brand analysis, and OpenDesign package generation. These stages are planned, not implemented.
- **Excluded initially:** a SaaS UI, continuous synchronization, a productized MCP server, other social networks, and adapters for other design systems.

Product context originated in the [Linear project](https://linear.app/valenf/project/instagram-opendesign-brand-importer-c97b589cc0b2). Public work is tracked in [GitHub Issues](https://github.com/ValenFelizia/instagram-to-opendesign/issues) and developed through pull requests. Technical decisions live in `.csdd/` and public documentation here.

## Development

Node 20+ runs the ingestion and evidence stages without dependencies; see [docs/ingestion.md](docs/ingestion.md) and [docs/evidence-processor.md](docs/evidence-processor.md). Contributions and questions are welcome; read [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE).
