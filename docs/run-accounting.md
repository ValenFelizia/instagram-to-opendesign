# Local run accounting

`brand:instagram` writes `data/<profile>/runs/run-<uuid>.json` and prints its path on completion, image-review pause or failure. The Git-ignored history survives ingestion refresh. Each invocation has a distinct record. Run one pipeline process per profile at a time, as required by the existing ingestion replacement flow.

The `brand-run/v1` journal records ingestion, evidence, analysis, colors and compilation phases actually reached. Each has status, start/end times, wall-clock milliseconds and `local`, `cache`, `provider` or `unknown` execution mode. Provider attempts have stable IDs. A phase may fail after its provider completed: invalid analysis retains returned usage and preserves the previous valid analysis.

## Meaning and limits

| Field | Meaning | Limits |
| --- | --- | --- |
| `usage` | Returned input/output/total tokens, cached input tokens and reasoning output tokens | No token-to-dollar estimate or inferred discount |
| `model`, `configuration` | Observed model and explicitly used reasoning/output limit, or actor/result type | Custom providers have unknown configuration unless reported |
| `billing` | Returned amount, currency and named source | Apify actor-run `usageTotalUsd` is retained; OpenAI Responses supplies usage but no bill, so billing is null |
| `wallMs` | Elapsed software phase/provider time | Includes waiting; never human active minutes |
| `cache` | Existing source, analysis or colors reused without a provider call | Earlier charges are not repeated; historical unknowns are not backfilled |

No automatic paid retry, pricing lookup or currency conversion is performed. Attempted requests without a readable response retain unknown usage/billing. Journals exclude credentials, headers, prompts, captions, raw provider payloads and error messages. They are private local work; do not publish real-profile records or paths.

Writes are atomic at observation boundaries, before structured-output validation. An abrupt process stop may leave a `running` record; it does not prove final billing or completion. Result review accepts only finished records. Standalone ingestion/analyzer/direction commands, report translation, downstream agent generation and human effort are outside this journal. `compileExisting` remains a local operation without providers.

## Import into result review

Add local paths to the existing `result-review-input/v1` JSON (fragment below):

```json
{
  "currency": "USD",
  "runRecords": ["data/example_studio/runs/run-example.json"]
}
```

Use the existing `brand:result` command with its selected brief, artifacts and remaining required fields. Imported events retain stable attempt/phase IDs, usage, billing and wall time. Human `minutes` stay null. Unknown costs also stay null, including local/cache phases. Totals cover only supplied observations; they are incomplete until remaining effort is recorded.

Repeated import in the same or subsequent revision is idempotent. Changed data for an imported event fails instead of rewriting history. Billed currencies must match the review currency. The archive preserves original run JSON and SHA-256. Manually supplied events retain the existing duplicate-ID guard.

Synthetic tests cover analyzer/color separation, cache reuse, malformed output, prior-analysis preservation, refresh retention, failed Apify runs, source archival and duplicate import. No live provider spending or general cost/utility claim is part of this verification.
