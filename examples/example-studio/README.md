# Synthetic package fixture

`example-studio/` is a static design-system package shaped for OpenDesign's `od-design-system-project/v1` manifest. It contains no Instagram data or third-party brand assets.

Copy this directory to `design-systems/example-studio/` in a compatible OpenDesign checkout to exercise package discovery. The copy step and live import have not been automated in this repository. The manifest's `source.url` identifies this fixture's public repository; it does not claim the fictional brand was extracted from GitHub.

`brand-analysis.json` belongs to this importer. OpenDesign consumes the declared manifest, design prose, and tokens; it does not parse our analysis JSON or index the undeclared evidence file. See [the contract notes](../../docs/output-contract.md) for the upstream revision and boundaries.
