# Input

This case commits no binary fixture. Its input is generated deterministically at run time.

| Step | Source |
| --- | --- |
| Synthetic profile, two generated images, `brand-analysis.json`, color proposals with fixed timestamps | `test/helpers/profile.js` |
| Reviewed request, asset permissions and three directions | `test/helpers/brief.js` |
| Two core tokens and one accessibility pair | `run.mjs` |

Nothing calls a provider and no real brand material is involved.

The generated files are not committed on purpose: they are small binaries derived from the helper, and committing them would duplicate the generator and let the two drift apart. If the helper changes, the case changes with it, which is the behaviour we want.

The one committed artifact is the output: `examples/consumer-neutral-brief/`.
