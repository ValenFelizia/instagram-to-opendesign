# Outcome

Dated records of real runs. A new run appends a section; it never rewrites an older one.

## 2026-10-25 — first recorded run

- Base: `main` @ `574841c`
- Command: `node evals/consumer-neutral-core/run.mjs`
- Environment: Node 24.15.0, Windows 11, no network, no credentials
- Result: all six assertions passed

### Mechanical

| Id | Result | Observed |
| --- | --- | --- |
| EVAL-1 | pass | `briefStatus: ready-for-execution` |
| EVAL-2 | pass | `inventoryStatus: ready-for-execution`, `mode: selected-execution`, 12 files, entrypoint `START.md` |
| EVAL-3 | pass | `matchesCommittedExample: true`, `mismatched: []`, `authored: [README.md]` |
| EVAL-4 | pass | `reproducible: true` |
| EVAL-5 | pass | `leaks: []`, no `manifest.json`, `metadata.json` or `tokens.css` |
| EVAL-6 | pass | `schemaVersion: agent-handoff/v1` |

### Judgment

Reviewed `START.md` and `BRIEF.md` as a creative agent receiving the folder. The criterion was whether an agent could begin without asking a question.

- It could. Objective, audience, exact copy, one selected direction, one asset with its permission source and a reserved native-sticker area are all stated.
- Authority is separated correctly. Confirmed rules and request copy are not proposals; observations, inferences and direction rationales stay provisional. This is the part most handoffs get wrong, and it is the reason the folder is worth handing over.
- The image alternative describes the subject instead of repeating the filename.

Limits observed during the review:

- The fixture image is 80×60, so any render will look wrong for reasons unrelated to the handoff. This case judges the folder, not the artwork.
- No brand owner reviewed this case and none exists: it is synthetic. No owner acceptance is claimed.

### Open

- A real case is still required before claiming that the handoff helps anyone. That record is `evals/private/`, which stays local.
- The adapter path is out of scope here and remains covered by `docs/opendesign-handoff.md`.
