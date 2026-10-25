# Evals

An eval is a complete, reproducible case that records what this product is supposed to deliver for a concrete task. It is not a fixture, a screenshot or a note about something that once worked.

`test/` and `evals/` answer different questions:

| | `test/` | `evals/` |
| --- | --- | --- |
| Question | Does this module honour its contract? | Does the product deliver something useful? |
| Cost | Free, offline | May use paid providers and human time |
| Determinism | Fully deterministic | Mechanical layer deterministic, judgment layer is not |
| Enforced by | `pnpm test` | `pnpm test` for the mechanical layer, a person for the rest |
| Lives in | `test/` | `evals/<slug>/` |

A case that costs nothing and needs no judgment is a test. A case that needs a person to look at the result is an eval. Both can exist for the same behaviour, and the eval is the one that tells you whether the product is worth anything.

## Case contract

Every case, public or private, is a directory with these four entries.

### `README.md`

State the property under test, why it exists, and what the case does **not** prove. The last part is not optional: an eval without declared limits becomes a marketing claim.

### `case.json`

Machine-readable metadata:

| Field | Meaning |
| --- | --- |
| `slug` | Directory name, stable |
| `property` | One sentence naming what is being verified |
| `layer` | `mechanical`, `judgment` or `both` |
| `input` | Where the fixture comes from and whether it is generated |
| `run` | The exact command or module entrypoint |
| `requires` | Credentials, authorization, network or hardware |
| `cost` | Expected spend, or `none` |
| `assertions` | What the mechanical layer checks, with stable ids |
| `enforcedBy` | Test file that runs the assertions, or `null` when manual |

### `input/`

The fixture. It must be self-contained and reproducible: either committed files or a generator with a fixed seed and fixed timestamps. Never commit real client material.

### `outcome.md`

The dated record of an actual run: commit, version, what passed, what a person judged, and what remains open. An eval without `outcome.md` has never been run, and that is worth knowing.

## Two layers

1. **Mechanical.** Runs unattended, costs nothing, and fails loudly. `pnpm test` executes it, so a regression breaks CI. The assertions live in one place: the test named by `enforcedBy`. `case.json` describes them for a reader; it does not duplicate the implementation.
2. **Judgment.** A person reads the output against the criteria in `README.md` and records a verdict in `outcome.md` with a date. This is never automated. A green mechanical layer means the pipeline ran, not that the result is good.

## Private cases

A real case with a real owner is an eval too. It lives in `evals/private/<slug>/`, which is Git-ignored, and follows the same contract. That is the point: a private case is not an exception to the process, it is the private instance of it.

Everything that may not be published belongs there: identity, assets, captions, attributed preferences, local paths and the full record of what the owner rejected. Public documentation keeps the generic protocol and the software behaviour.

See [DEC-017](../.csdd/decisions.md) for the publication rule.

## Adding a case

1. Name the property in one sentence. If you cannot, it is not an eval yet.
2. Build the smallest fixture that exercises it.
3. Write the mechanical assertions and wire them into `pnpm test`.
4. Run it. Record the result in `outcome.md` with the date and commit.
5. State the limits in `README.md`, including what a pass does not prove.
