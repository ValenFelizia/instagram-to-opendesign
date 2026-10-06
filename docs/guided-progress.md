# Guided onboarding and accessible progress

Tracking: [issue #57](https://github.com/ValenFelizia/instagram-to-opendesign/issues/57), VAL-100. Builds on [transactional jobs](transactional-jobs.md), [recoverable pipeline](recoverable-pipeline.md), [task authority](task-authority.md) and [task deliveries](task-deliveries.md). Uses the reviewed [onboarding](onboarding-prototype.md), [selective review](selective-review.md) and [spend/progress](spend-progress.md) prototypes. Public verification uses synthetic material only.

## What this increment adds

A main-owned guided broker (`desktop/guided.cjs`) exposes validated renderer actions over the real job store, pipeline, task authority and delivery APIs. The sandboxed preload surface is `window.guidedWork`. Opening a managed project shows **Próxima acción**, **Etapas**, **Disponible** and **Gasto registrado** with direct Spanish labels. Paid confirmation binds consent to the current `planHash`; a stale modal is rejected without dispatch. Optional OS notifications use allowlisted title/body strings only.

`src/spend-projection.js` is the read-only accounting projection. It aggregates brand-run journals, pipeline request observations and supplied effort once by stable attempt identity. Null billing stays null; returned zeros and tiny positives retain meaning; mixed currencies stay separate; token detail fields are subsets, not extra totals; wall time and human minutes stay independent. The projection never invents a percentage, ETA, fabricated invoice or remote cancellation claim.

## Renderer contract

| Action | Effect |
| --- | --- |
| `status` | Job view, preview limits, stages, partial inventory, sanitized spend. `reopenDispatches: false`. |
| `plan` | Creates a pipeline plan for the project. Does not authorize or run. |
| `preview` | Stage modes and call limits for the current plan hash. |
| `authorize` | Requires explicit `consent: true` and the exact current `planHash`. |
| `run` | Starts or recovers only with a live authorization bound to that hash. |
| `stop` | Blocks further local dispatch. `cancellationSupported: false`. |
| `retry` | New plan hash after interrupt/fail; no inherited authorization. |
| `reconcile` | Same-attempt Apify lookup under the current hash. |
| `authority-*` | Create/preview/select/review through TaskAuthority. |
| `delivery-*` | Preview/create/history; export picks a directory in main, never via renderer paths. |

Errors return `{ ok:false, code, action }` only. Responses never include credentials, profile paths, raw provider payloads or private filesystem locations.

## Accessibility

Automated checks cover skip link presence, labeled consent controls, linked `role="alert"` errors, polite status announcements, focus on the consent checkbox and status heading, and reduced-motion/forced-colors CSS. Packaged Windows Narrator, zoom, high-contrast usability and real native picker/tray review remain a **manual gate** shared with open #51/#52 acceptance. Browser prototype walks do not replace that review.

## Verification

`test/guided-progress.test.js` covers reconnect/interrupt reopen without dispatch, null/zero/tiny/mixed/conflict spend cases, token-subset non-double-counting, separate wall/human effort, stale modal rejection, stop without cancellation claims, retry plan isolation and redacted diagnostics. Packaged Electron verification exercises guided status after a real local pipeline completion through the privileged API and renderer surface.

## Remaining boundaries

- Native #51/#52/#58 gates stay open (clean install, Narrator/tray, real picker UX, release).
- No live paid provider generation, private fixtures, publication/upload/deploy or signed release.
- Selective dossier/image-review polish remains deferred; this slice wires progress, spend, scoped consent and privileged authority/delivery controls to real jobs.
