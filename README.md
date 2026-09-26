# Instagram → OpenDesign Brand Importer

An early open source experiment to turn evidence from a public Instagram profile into a traceable brand package that OpenDesign can use.

**Status:** Contract definition. There is no importer or runnable CLI yet. The first milestone is a static package that matches OpenDesign's current `design-systems/<slug>/` contract. See [VAL-88](https://linear.app/valenf/issue/VAL-88/definir-contrato-de-salida-y-compatibilidad-actual-con-opendesign).

## Goal

Test whether an Instagram profile can provide useful evidence for an initial brand identity, especially when a small brand uses Instagram as its main visual reference. The package should keep source material and confidence for important inferences. A later experiment will compare a design made with the package against a manual image and prompt baseline.

## Initial scope

- **Consumer:** OpenDesign only.
- **Approach:** a standalone CLI or script, with a maintained Instagram extraction provider rather than a custom scraper.
- **Proposed stages:** extraction, evidence processing, multimodal brand analysis, and OpenDesign package generation. These stages are planned, not implemented.
- **Excluded initially:** a SaaS UI, continuous synchronization, a productized MCP server, other social networks, and adapters for other design systems.

The current product scope is tracked in the [Linear project](https://linear.app/valenf/project/instagram-opendesign-brand-importer-c97b589cc0b2). Technical decisions that are stable enough for the repository live in `.csdd/` and, as the implementation grows, in public documentation here.

## Development

There is no install or build step yet. Issue VAL-88 defines the output contract before pipeline implementation begins. Contributions and questions are welcome; read [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE).
