# Generic creative-agent handoff

Export a reviewed task directly from canonical preparation, without an OpenDesign package or installation:

```powershell
pnpm brand:handoff data/example_studio
pnpm brand:handoff data/example_studio --out tmp/example-agent-context
pnpm brand:handoff --verify tmp/example-agent-context
```

The default is the canonical `brief/<kind>` directory. Export revalidates the current request, sources, asset permissions, input fingerprint, selected direction and accessibility preflight through `compileBrief`. It does not reanalyze evidence, generate directions or call a provider. Existing directions must be explicitly generated/imported first. A stale request or changed confirmation fails before replacing the previous export.

## Folder contract

| File | Use |
| --- | --- |
| `START.md` | Reading order, execution/exploration status, authority, original asset inventory and delivery expectations |
| `BRIEF.md` | Objective, audience, exact copy/action, selected direction, constraints, uncertainty and acceptance criteria |
| `design-brief.json` | Canonical structured task, observations, verified rules, proposals, local references and pending checks |
| `ACCESSIBILITY.md`, `accessibility.json` | Declared-use checks and tasks requiring rendered human review |
| `ARTWORK-DESCRIPTION.md` when applicable | Supplied copy and alternatives to compare against the eventual image |
| `assets/`, `evidence/`, `sources/` | Original selected asset bytes and resolvable evidence/confirmation files |
| `handoff.json` | `agent-handoff/v1` inventory, SHA-256 for every other file, input hash and status |

`ready-for-execution` exports have mode `selected-execution`. Pending canonical briefs have mode `exploration-only`, a prominent instruction against approved execution/publication and unchanged blockers. This supports sharing questions/proposals; it does not add unconfirmed-copy generation or relax current readiness gates. Publication always requires human acceptance.

The JSON and Markdown are views of the same canonical brief. There is no consumer-specific identity, second decision registry, fabricated font licence or 56-slot token mapping. Unspecified visual choices can be proposed creatively while confirmed request/rules remain authoritative. Defaults and inferences remain provisional.

## Sharing and verification

Give the chosen agent access to the entire folder and ask it to read `START.md`. Before generating, ask for a concise readback of objective, copy, selected originals, constraints and pending checks. Preserve the first output for human review. Verification checks hashes, required files, the canonical status and every asset/source/evidence reference; it detects missing, additional or changed files and rejects symbolic links. It checks integrity, not authenticity, creative quality, final accessibility or authorization to publish.

Asset/evidence/source paths stay relative when the folder moves. Existing-site requests separately identify an authorized local repository and selected hashes; code is not copied. On another computer, explicitly provide/review equivalent code access rather than treating the old absolute directory as portable authorization.

The [synthetic example](../examples/consumer-neutral-brief/START.md) is readable without reconstructing captions: it includes a confirmed product request, exact copy, selected asset/treatment, native sticker destination and acceptance criteria. Tests exercise the Node core API and CLI export/verification, relocation, byte preservation, status and stale-input failure. No new vendor runtime or universal tool compatibility is claimed. OpenDesign's tested adapter remains separate. Real profiles, exports and their feedback remain local and Git-ignored unless explicitly authorized for sharing.
