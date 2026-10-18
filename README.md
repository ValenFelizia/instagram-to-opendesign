# Instagram → OpenDesign Brand Importer

An early open source tool that turns Instagram evidence, human decisions and selected assets into reviewable context for creative agents. OpenDesign is an optional implemented destination.

## Windows app shell

The Windows app shell has a packaged local worker, close/reopen and explicit Exit. Read [build instructions and verification boundaries](docs/windows-app-shell.md). The merged [managed project and Windows credential broker](docs/managed-projects.md) adds local create/import/open/backup/trash and write-only provider settings. The [transactional job kernel](docs/transactional-jobs.md) adds revision-bound authorization, inventoried snapshots, interruption recovery and a CLI/app writer interlock. The [recoverable pipeline](docs/recoverable-pipeline.md) integrates core stages, private response checkpoints and actual request accounting through a privileged API. [Guided progress](docs/guided-progress.md) wires scoped paid confirmation and a read-only spend projection; opening a project never calls a provider. Native Windows gates remain open in issues [#51](https://github.com/ValenFelizia/instagram-to-opendesign/issues/51)/[#52](https://github.com/ValenFelizia/instagram-to-opendesign/issues/52)/[#58](https://github.com/ValenFelizia/instagram-to-opendesign/issues/58).

**Status:** Implemented stages include ingestion, evidence, analysis, reviewed decisions, asset preparation, HTML review, accessibility preflight, brief compilation, OpenDesign delivery and result review. Canonical preparation is separate from OpenDesign package/token requirements. Implementation backlog and landing are tracked in [GitHub Issues](https://github.com/ValenFelizia/instagram-to-opendesign/issues) and pull requests; product priority is canonical in [Linear VAL-100](https://linear.app/valenf/issue/VAL-100/deliver-a-guided-workflow-from-brand-evidence-to-useful-creative-agent-context). `.csdd/todo.md` is an external-tracker stub (`Mode: external`), not a local six-state board. Local checks and recipient context readback passed; two earlier Felisa Story versions were rejected for creative quality. Quantified effort savings and cross-brand reliability remain unmeasured. The generated identity remains provisional. See the [verification checkpoint](docs/verification-checkpoint.md), [core/adapter boundary](docs/core-and-adapters.md), [validation results](docs/mvp-validation.md), [package CLI guide](docs/package-cli.md), [brand report guide](docs/brand-report.md), [OpenDesign output contract](docs/output-contract.md), [synthetic package](examples/example-studio/), [ingestion guide](docs/ingestion.md), [evidence guide](docs/evidence-processor.md), and [analysis guide](docs/brand-analyzer.md).

## Goal

Help people prepare context for a concrete creative task without reconstructing the business before every agent session. Retain source material, uncertainty, reviewed decisions and useful originals. The next product increment focuses on guided onboarding and a contained local workspace. The actual brand workflow remains in the CLI/local reports; the first executable shell checks packaging/lifecycle with synthetic work only. See the [product roadmap](docs/product-roadmap.md).

## Initial scope

- **Consumer:** [Generic task-specific handoff](docs/generic-agent-handoff.md) exports canonical context with an entrypoint and byte-verified inventory. OpenDesign is an optional implemented adapter.
- **Approach:** a standalone CLI or script, with a maintained Instagram extraction provider rather than a custom scraper.
- **Stages:** extraction, evidence processing, analysis, and local OpenDesign package compilation are implemented. New profiles pause for image review before analysis.
- **Product prototype:** [Navigable guided onboarding and dossier](prototypes/onboarding/README.md) using fictional material; open its local HTML without APIs. This is interaction design, not an integrated app. Windows-first Electron packaging is selected in DEC-011; UI library, app integration and paid-action surfaces remain planned.
- **Review proposal:** [Selective authority and state transitions](docs/selective-review.md), with isolated synthetic interactions. Exploration, selected execution and publication acceptance remain distinct; proposed contract changes require separate review and implementation.
- **Local app blueprint:** [Platform comparison, workspace and durable jobs](docs/local-workspace.md), with an isolated synthetic process/checkpoint spike. The shell, managed storage and persistence kernel are now implemented separately; the blueprint is not evidence of an integrated scheduler or provider spending.
- **Spend/progress proposal:** [Scoped paid actions, reuse and recorded observations](docs/spend-progress.md), with ten fictional interactive cases. Missing bills stay unknown, shared attempts count once, and recovery/reopening never retries automatically.
- **Excluded from this increment:** hosted SaaS/accounts, continuous synchronization, productized MCP, other social networks and broad vendor support.

Product context originated in the [Linear project](https://linear.app/valenf/project/instagram-opendesign-brand-importer-c97b589cc0b2). Public work is tracked in [GitHub Issues](https://github.com/ValenFelizia/instagram-to-opendesign/issues) (assignees, labels, linked PRs) and developed through pull requests; agents should not invent an in-repo task board. Durable specs and decisions live in `.csdd/specs.md` and `.csdd/decisions.md`; `.csdd/todo.md` only points at the external trackers.

## Development

The first delivery improvements add [human brand decisions](docs/brand-decisions.md), [asset preflight](docs/asset-preflight.md) and an [executable hero/Story brief](docs/design-brief.md). These keep confirmed rules, evidence, creative proposals and pending reviews distinct. Design briefs require a human-selected direction; local compilation makes no paid calls.

The implemented review stage supports [declared-use accessibility checks](docs/accessibility-preflight.md), [explicit OpenDesign delivery and promotional/site-change requests](docs/opendesign-handoff.md), and [immutable result review with an optional matched-evaluation protocol](docs/result-review.md). Extra vendor generation and formal comparisons are not gates for product development; comparative savings claims still require evidence. Website/social rules retain separate authority. Felisa's current website identity stays in effect during user-authorized hero exploration; richer packages require observed missing context first.

The end-to-end command preserves [local run accounting](docs/run-accounting.md): provider usage, returned billing when available, phase wall time, cache reuse and failed attempts. Finished records import into result review without counting the same event twice. Unknown costs and human effort remain unknown.

The app's [versioned task authority](docs/task-authority.md) separates goal-only exploration, explicit selected execution review and exact output acceptance. Sourced corrections retain original rules/evidence and history; task-specific dependencies preserve unrelated approvals. The [delivery/history broker](docs/task-deliveries.md) adds explicit portable disclosure, immutable result/feedback revisions and supplied external effort with provenance and unknown coverage. [Guided progress](docs/guided-progress.md) wires those APIs into the local app with scoped paid confirmation and a read-only spend projection. Existing v1 CLI gates stay unchanged.

Node 20+ and `pnpm install` run the project. The package compiler uses Sharp to create a local WebP moodboard; the report generator uses it for portable thumbnails. See the guides above and [CONTRIBUTING.md](CONTRIBUTING.md).

Project documentation, issues and pull requests use English. Brand reports default to Spanish and support `--lang en`; see the [report guide](docs/brand-report.md) for translation credentials, caching and costs.

## License

[MIT](LICENSE).
