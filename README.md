# Instagram → OpenDesign Brand Importer

An early open source tool that turns Instagram evidence, human decisions and selected assets into reviewable context for creative agents. OpenDesign is an optional implemented destination.

## Windows app shell

The Windows app shell has a packaged local worker, close/reopen and explicit Exit. Read [build instructions and verification boundaries](docs/windows-app-shell.md). The [managed project and Windows credential broker](docs/managed-projects.md) adds local create/import/open/backup/trash and write-only provider settings under source review. Analysis, durable jobs and the guided workflow remain subsequent implementation issues.

**Status:** Implemented stages include ingestion, evidence, analysis, reviewed decisions, asset preparation, HTML review, accessibility preflight, brief compilation, OpenDesign delivery and result review. Canonical preparation is separate from OpenDesign package/token requirements; landing state is tracked in `.csdd/todo.md`. Local checks and recipient context readback passed; two earlier Felisa Story versions were rejected for creative quality. Quantified effort savings and cross-brand reliability remain unmeasured. The generated identity remains provisional. See the [verification checkpoint](docs/verification-checkpoint.md), [core/adapter boundary](docs/core-and-adapters.md), [validation results](docs/mvp-validation.md), [package CLI guide](docs/package-cli.md), [brand report guide](docs/brand-report.md), [OpenDesign output contract](docs/output-contract.md), [synthetic package](examples/example-studio/), [ingestion guide](docs/ingestion.md), [evidence guide](docs/evidence-processor.md), and [analysis guide](docs/brand-analyzer.md).

## Goal

Help people prepare context for a concrete creative task without reconstructing the business before every agent session. Retain source material, uncertainty, reviewed decisions and useful originals. The next product increment focuses on guided onboarding and a contained local workspace. The actual brand workflow remains in the CLI/local reports; the first executable shell checks packaging/lifecycle with synthetic work only. See the [product roadmap](docs/product-roadmap.md).

## Initial scope

- **Consumer:** [Generic task-specific handoff](docs/generic-agent-handoff.md) exports canonical context with an entrypoint and byte-verified inventory. OpenDesign is an optional implemented adapter.
- **Approach:** a standalone CLI or script, with a maintained Instagram extraction provider rather than a custom scraper.
- **Stages:** extraction, evidence processing, analysis, and local OpenDesign package compilation are implemented. New profiles pause for image review before analysis.
- **Product prototype:** [Navigable guided onboarding and dossier](prototypes/onboarding/README.md) using fictional material; open its local HTML without APIs. This is interaction design, not an integrated app. Windows-first Electron packaging is selected in DEC-011; UI library, app integration and paid-action surfaces remain planned.
- **Review proposal:** [Selective authority and state transitions](docs/selective-review.md), with isolated synthetic interactions. Exploration, selected execution and publication acceptance remain distinct; proposed contract changes require separate review and implementation.
- **Local app blueprint:** [Platform comparison, workspace and durable jobs](docs/local-workspace.md), with an isolated synthetic process/checkpoint spike. No packaged app, production scheduler or provider spending.
- **Spend/progress proposal:** [Scoped paid actions, reuse and recorded observations](docs/spend-progress.md), with ten fictional interactive cases. Missing bills stay unknown, shared attempts count once, and recovery/reopening never retries automatically.
- **Excluded from this increment:** hosted SaaS/accounts, continuous synchronization, productized MCP, other social networks and broad vendor support.

Product context originated in the [Linear project](https://linear.app/valenf/project/instagram-opendesign-brand-importer-c97b589cc0b2). Public work is tracked in [GitHub Issues](https://github.com/ValenFelizia/instagram-to-opendesign/issues) and developed through pull requests. Technical decisions live in `.csdd/` and public documentation here.

## Development

The first delivery improvements add [human brand decisions](docs/brand-decisions.md), [asset preflight](docs/asset-preflight.md) and an [executable hero/Story brief](docs/design-brief.md). These keep confirmed rules, evidence, creative proposals and pending reviews distinct. Design briefs require a human-selected direction; local compilation makes no paid calls.

The implemented review stage supports [declared-use accessibility checks](docs/accessibility-preflight.md), [explicit OpenDesign delivery and promotional/site-change requests](docs/opendesign-handoff.md), and [immutable result review with an optional matched-evaluation protocol](docs/result-review.md). Extra vendor generation and formal comparisons are not gates for product development; comparative savings claims still require evidence. Website/social rules retain separate authority. Felisa's current website identity stays in effect during user-authorized hero exploration; richer packages require observed missing context first.

The end-to-end command preserves [local run accounting](docs/run-accounting.md): provider usage, returned billing when available, phase wall time, cache reuse and failed attempts. Finished records import into result review without counting the same event twice. Unknown costs and human effort remain unknown.

Node 20+ and `pnpm install` run the project. The package compiler uses Sharp to create a local WebP moodboard; the report generator uses it for portable thumbnails. See the guides above and [CONTRIBUTING.md](CONTRIBUTING.md).

Project documentation, issues and pull requests use English. Brand reports default to Spanish and support `--lang en`; see the [report guide](docs/brand-report.md) for translation credentials, caching and costs.

## License

[MIT](LICENSE).
