# Instagram → OpenDesign Brand Importer

Turns public Instagram evidence, human review and selected assets into reviewable context for a creative agent.

Instagram is the first implemented source. OpenDesign is an optional implemented destination, and the same context exports to any agent that can read a folder.

**Status.** Early development, before a first release. There is no published installer and no package on npm. The local command line is the only complete path today. The Windows app is a local shell verified with synthetic material, with no live provider run verified there yet.

## What it does

- Ingests public posts through [Apify's maintained Instagram Scraper](https://apify.com/apify/instagram-scraper), behind a provider interface.
- Builds a contact sheet, caption corpus and evidence index for human review.
- Drafts ten brand inferences with evidence ids and qualitative confidence. A model response never becomes a verified rule.
- Records human decisions, asset permissions and proposed crops separately from model output.
- Produces a brief with two or three creative directions and one human selection.
- Checks declared token usage against WCAG 2.2 AA contrast, and keeps unknown cases pending.
- Exports a byte-verified handoff folder, or compiles an OpenDesign package.

## What it does not do

- No hosted service, accounts, cloud sync or telemetry.
- No custom scraper, and no private profiles.
- No publishing, deployment or automatic paid retry.
- No invented prices, stock, people, exact fonts or confirmed copy.
- No claim that generated output is verified, accessible or final.

## Requirements

- Node 20 or newer, and pnpm.
- An Apify token for ingestion.
- An OpenAI API key for analysis, color proposals, creative directions and English translation.

Both providers may charge. Ingestion makes two Actor runs, each capped at USD 2 by the request. Analysis is one request. Direction suggestions and translation are separate opt-in requests. Nothing retries a paid call automatically.

## Quickstart

```powershell
pnpm install
Copy-Item .env.example .env.local   # cp on macOS and Linux
# Put APIFY_TOKEN and OPENAI_API_KEY in .env.local
pnpm brand:instagram '@publicusername'
```

The first run ingests posts and exits with code 2 until every selected, profile-owned image has a classification in `data/<username>/evidence/review.json`. Open the contact sheet, edit the classifications, then run the same command again. A valid local source and analysis are reused.

Everything generated stays ignored by Git:

| Path | Contents |
| --- | --- |
| `data/<username>/` | Source JSON, downloaded media, evidence, analysis, decisions, briefs and the Spanish report |
| `brand-output/<slug>/` | OpenDesign package with `manifest.json`, `DESIGN.md`, 56 token slots, selected assets, a moodboard and a source export |

Rebuild from local data without a provider call:

```powershell
pnpm brand:compile data/<username>
pnpm brand:report data/<username>
```

Export context for any agent, then verify it:

```powershell
pnpm brand:handoff data/<username> --out tmp/agent-context
pnpm brand:handoff --verify tmp/agent-context
```

## Stages

| Stage | Command | Provider |
| --- | --- | --- |
| Ingestion, evidence, analysis, package and report | `pnpm brand:instagram '@user'` | Apify and OpenAI |
| Evidence only | `node bin/process-evidence.js data/<user>` | none |
| Analysis only | `node --env-file=.env.local bin/analyze-brand.js data/<user>` | OpenAI |
| Verified decisions | `pnpm brand:decisions data/<user>` | none |
| Asset preflight | `pnpm brand:assets data/<user>` | none |
| Request and brief | `pnpm brand:brief data/<user>` | none, unless `--suggest` |
| Accessibility preflight | `pnpm brand:accessibility <package-dir> <design-brief.json>` | none |
| Generic handoff | `pnpm brand:handoff data/<user>` | none |
| OpenDesign package | `pnpm brand:compile data/<user>` | none |
| Delivery to OpenDesign | `pnpm brand:deliver ...` | none |
| Result review | `pnpm brand:result ...` | none |

Every command prints its usage when arguments are missing or invalid.

## Boundaries

Facts, permissions and confirmed constraints stay separate from creative proposals. Confirmed brand rules override inference. Generated identity stays provisional until a person reviews it.

The Node core is consumer neutral. Read [core and adapters](docs/core-and-adapters.md) before adding a destination. OpenDesign package and token rules live in its adapter.

Real profiles, generated packages and their feedback stay local. Keep tokens, private material and third-party images without redistribution rights out of commits. See the [privacy rules in CONTRIBUTING](CONTRIBUTING.md#private-data-and-evidence).

## Windows app

The [Windows app shell](docs/windows-app-shell.md) is an Electron shell with a packaged local worker, close and reopen, and an explicit Exit. [Managed projects and the Windows credential broker](docs/managed-projects.md) add local create, import, open, backup and trash, with write-only provider settings. The [transactional job kernel](docs/transactional-jobs.md) adds revision-bound authorization, inventoried snapshots and interruption recovery. [Guided progress](docs/guided-progress.md) wires scoped paid confirmation and a read-only spend projection.

Acceptance for the app uses synthetic material, and there is no live provider acceptance yet. Native Windows acceptance is tracked in [#70](https://github.com/ValenFelizia/instagram-to-opendesign/issues/70).

## Documentation

Start here:

- [Ingestion](docs/ingestion.md), [evidence processor](docs/evidence-processor.md), [brand analyzer](docs/brand-analyzer.md)
- [Brand decisions](docs/brand-decisions.md), [asset preflight](docs/asset-preflight.md), [design brief](docs/design-brief.md)
- [Accessibility preflight](docs/accessibility-preflight.md), [brand report](docs/brand-report.md), [package CLI](docs/package-cli.md)

Deliver and review:

- [Generic agent handoff](docs/generic-agent-handoff.md), [OpenDesign output contract](docs/output-contract.md), [OpenDesign handoff](docs/opendesign-handoff.md)
- [Result review](docs/result-review.md), [run accounting](docs/run-accounting.md), [core and adapters](docs/core-and-adapters.md)

Local app:

- [Windows app shell](docs/windows-app-shell.md), [managed projects](docs/managed-projects.md), [transactional jobs](docs/transactional-jobs.md)
- [Recoverable pipeline](docs/recoverable-pipeline.md), [guided progress](docs/guided-progress.md), [task authority](docs/task-authority.md), [task deliveries](docs/task-deliveries.md)
- [Manual acceptance debt](docs/manual-acceptance-debt.md)

Direction and proposals:

- [Product roadmap](docs/product-roadmap.md), [app implementation sequence](docs/app-implementation.md), [local workspace](docs/local-workspace.md)
- [Selective review](docs/selective-review.md), [spend and progress](docs/spend-progress.md), [onboarding prototype](docs/onboarding-prototype.md)
- [Verification checkpoint](docs/verification-checkpoint.md), [MVP validation](docs/mvp-validation.md), [brand analysis contract](docs/brand-analysis.md)

Synthetic examples: [OpenDesign package](examples/example-studio/), [agent handoff folder](examples/consumer-neutral-brief/).

## Project status and roadmap

The next increment is a guided local workflow, from brand evidence to context a creative agent can use. Public planning is in the [product roadmap](docs/product-roadmap.md). Day-to-day work is tracked in [GitHub Issues](https://github.com/ValenFelizia/instagram-to-opendesign/issues). Product priorities are canonical in [Linear](https://linear.app/valenf/issue/VAL-100/deliver-a-guided-workflow-from-brand-evidence-to-useful-creative-agent-context), which needs access.

Generated identity remains provisional. Quantified effort savings, comparative superiority and general reliability remain unmeasured. Claims of that kind require a matched experiment, not a successful local run.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) for setup, tests, code conventions, labels and review expectations. Open an issue before a large change. Report vulnerabilities through [SECURITY.md](SECURITY.md), never in a public issue.

This project follows the [code of conduct](CODE_OF_CONDUCT.md).

## License

[MIT](LICENSE).
