# Contributing

Thanks for reading this before opening a pull request.

This project turns public Instagram evidence, human review and selected assets into reviewable context for a creative agent. It is early software, maintained by one person, and it protects two things above convenience: evidence that stays traceable, and paid work that never repeats by surprise.

Write documentation, issues, pull requests, review notes and CSDD state in English, even when we discuss the work in Spanish.

## Before you start

- Search [issues](https://github.com/ValenFelizia/instagram-to-opendesign/issues) and pull requests first.
- Open an issue before a large change, a schema change or a new dependency. Small fixes can go straight to a pull request.
- Report vulnerabilities through [SECURITY.md](SECURITY.md), never in a public issue.
- In scope: the local pipeline, the stage commands, the Windows app shell, the contracts and the documentation.
- Out of scope for now: hosted services, accounts, cloud sync, telemetry, a custom Instagram scraper, new social networks, productized MCP and broad vendor support.

## Setup

You need Node 20 or newer and pnpm 11. CI pins Node 24 and pnpm 11.19.0.

```powershell
pnpm install
Copy-Item .env.example .env.local   # cp on macOS and Linux
```

Put `APIFY_TOKEN` and `OPENAI_API_KEY` in `.env.local`. The file is ignored by Git. `pnpm brand:instagram` loads it. Standalone paid commands do not, so run those as `node --env-file=.env.local bin/<command>.js`, or export the variable in your shell. Tests do not need either key and never call a provider.

The Windows app work needs Windows. The pipeline, tests and CLI run on macOS and Linux too.

In PowerShell, quote the profile argument so `@` is not read as shell syntax: `pnpm brand:instagram '@publicusername'`.

## Run the tests

```powershell
pnpm test        # 187 tests, one platform-specific skip, about two minutes
pnpm app:cite    # acceptance documents against the registry
```

These run in CI on every pull request, together with the Windows app workflow for changes under `desktop/`, `src/`, `bin/`, `test/`, `schemas/` and the app documentation.

Windows-only commands: `pnpm app:build`, `pnpm app:verify --packaged`, `pnpm app:guided`, `pnpm app:install`. Read [manual acceptance debt](docs/manual-acceptance-debt.md) before changing them.

## Code conventions

There is no formatter and no linter yet. A mass reformat would collide with open branches, so the tooling is deferred in [#72](https://github.com/ValenFelizia/instagram-to-opendesign/issues/72). Until then, match the file you edit and keep diffs local.

| Path | Dialect |
| --- | --- |
| `src/`, `bin/`, `test/` | ES modules, `.js` |
| `desktop/` | CommonJS, `.cjs` |
| `desktop/verify.mjs`, `desktop/acceptance/`, `prototypes/*/verify-browser.mjs` | ES modules, `.mjs` |

- Two-space indentation, single quotes, semicolons, LF endings, final newline. `.editorconfig` covers the mechanical part.
- Import Node builtins with the `node:` prefix. Prefer named exports in ESM modules.
- Keep runtime dependencies rare. Today there are three: `ajv`, `ajv-formats` and `sharp`. Dev dependencies are pinned exactly. Ask before adding one.
- Put core behavior in `src/`, CLI wiring in `bin/`, Electron-only code in `desktop/`, and fixtures in `test/` or `examples/`.
- A caller that branches on a failure needs a stable code in the message, such as `job-version-unsupported` or `APP_SHELL_START_FAILED`. Never put a secret, a provider payload or an absolute private path in an error or a log line.
- Comment the reason, not the line. A comment that restates the code is removed in review.

## Tests

- Test the behavior a caller can observe, not the internal structure.
- Use synthetic fixtures. No network, no real keys, no real profile data, no third-party images without redistribution rights.
- Name the test for the guarantee it protects, for example "uncertain attempts never auto-resend".
- Windows-only behavior gets an explicit skip elsewhere with a reason.
- A behavior change needs a test that fails before the change and passes after it.

## Evals

A test answers "does this module honour its contract?". An eval answers "does the product deliver something useful?". They live in different places and cost different things.

- `evals/<slug>/` holds a complete case: a `README.md` with the property and its limits, a `case.json` with run, cost and assertions, its input, and a dated `outcome.md`.
- The mechanical assertions belong in `pnpm test`, named by `case.json.enforcedBy`. The judgment layer is a person reading the output, and it is never automated.
- A case without `outcome.md` has never been run. Say so rather than implying it passed.
- `evals/private/` is ignored and holds real cases. Do not move that material into `docs/` or into a public eval.
- The first case, [`evals/consumer-neutral-core`](evals/consumer-neutral-core/README.md), reproduces `examples/consumer-neutral-brief/` byte for byte. If you change core output, expect that comparison to fail and decide deliberately whether the example or the code is wrong.

Read [evals/README.md](evals/README.md) for the full contract.

## Issues and labels

There is one issue form. It asks for the kind, the problem, a proposed solution, the scope, an acceptance checklist and context. A maintainer applies labels during triage.

| Label | Use |
| --- | --- |
| `bug` | Something does not work as documented |
| `enhancement` | New or changed behavior |
| `documentation` | Docs, guides or the contributor surface |
| `question` | A question that does not need code |
| `accessibility` | A barrier affecting people with disabilities |
| `P0` to `P3` | Priority, from a release gate down to backlog |
| `area:core` | Pipeline, schemas and contracts |
| `area:cli` | Entry points and stage commands |
| `area:app` | Desktop app, packaging and acceptance |
| `area:docs` | Documentation and repository surface |
| `area:ci` | Workflows, tests and tooling |
| `needs-triage` | Applied automatically, removed after triage |
| `blocked` | Waiting on a decision or another issue |

State the problem before the solution. Link the issue a pull request closes.

## Pull requests

- One concern per pull request. Keep unrelated reformatting out.
- Fill the template. Verification means the commands you ran and their actual result, not a promise that it should work.
- Explain the boundary. Saying what a change does not do prevents the next person from over-reading it.
- Update `.csdd/specs.md` when intended behavior changes, and `.csdd/decisions.md` when a consequential direction is accepted or superseded.
- The maintainer merges with a merge commit after review. A pull request can be closed if it is out of scope or does not follow the language policy.

## Agent-assisted contributions

Agent-assisted work is welcome. These rules keep the result accountable.

- State which agent or model helped in the pull request, or write "None".
- The person opening the pull request is responsible for it. They understand the diff, they ran the verification, and they answer review questions.
- Paste real command output. Agent output is not verification.
- An agent may not push to this repository or open a pull request without a human owner.

## Language policy

- English for repository documentation, CSDD state, issue and pull request text, review notes and project comments.
- Brand reports default to Spanish for the brand owner and support English with `--lang en`.
- Preserve original evidence, quotations and confirmed brand copy in their original language. Mark translations as translations. Do not translate identifiers, paths or references.
- Conversation with the maintainer can happen in any language. Issue bodies, pull request text and review notes stay in English.

## Private data and evidence

- `data/`, `brand-output/`, `tmp/` and `evals/private/` are ignored. Keep them that way.
- Never commit tokens, private profile data, private project paths or third-party images without redistribution rights.
- Public fixtures use synthetic brands. A real evaluation case lives in `evals/private/` and its identity, assets and outcomes never appear in a public file.
- A public document may describe a stage, a failure or a generic outcome. Apply the substitution test in [DEC-017](.csdd/decisions.md): replace the identity with "a private test brand" and keep every sentence that still teaches something true.
- Generated packages contain public profile content and machine-local paths. Review both before sharing one.

## Security and conduct

Read [SECURITY.md](SECURITY.md) before reporting a vulnerability. Participation follows the [code of conduct](CODE_OF_CONDUCT.md).

## Review and merge

Review is best effort and has no service-level promise. A quiet pull request is not a rejection. Ask in the linked issue if a change stalls.
