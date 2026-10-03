# Explicit local OpenDesign handoff

## Prepare one reviewed request

Supported kinds are `web-hero`, `instagram-story`, `promotional-image` and `website-change`. The latter two require an explicit `target` with integer `width` and `height`; these dimensions drive asset preflight. Promotional artwork uses social rules and cannot simulate a functioning web link. Website changes use website rules. Story defaults remain 1080 × 1920.

A website-change request may include:

```json
{"existingSite":{"root":"C:/work/approved-site","files":["app/globals.css","app/page.tsx"],"sourceId":"S-SITE-ACCESS"}}
```

Register a current human authorization source first. Only explicit non-secret files are hashed, not copied. File changes invalidate the brief context. The root is omitted from creative-provider input; file IDs/hashes and the access requirement remain. Before editing, connect the supplied directory through OpenDesign's existing `linkedDirs` feature and verify current file hashes. Installation does not connect a repository, grant new authority, upload its contents or edit it. Existing-site code should guide implementation and preserve confirmed site rules; an Instagram palette change is not website rebrand authority.

Compile a package with the matching channel and select one brief direction:

```powershell
pnpm brand:brief data/example_studio --init promotional-image --width 1200 --height 900
# Fill the request and register its human confirmation before selection/compilation.
pnpm brand:compile data/example_studio --channel social
pnpm brand:brief data/example_studio --compile
pnpm brand:deliver data/example_studio --package brand-output/example-studio --brief data/example_studio/brief/promotional-image --od-data-dir C:/work/od-data --od-root C:/work/open-design
```

Use an explicit absolute data directory used by the intended OpenDesign daemon. Supported contracts are the **0.23.1 source checkout** containing `apps/daemon/package.json` and the inspected **0.24.1 packaged desktop payload** containing `resources/app/package.json` and `resources/open-design-config.json`. The desktop's contracts dependency remains 0.23.1. Unknown versions, mismatched configuration or missing daemon entries fail before catalog mutation.

## Packaged desktop delivery

The desktop has a workspace/member binding in addition to its filesystem catalog. Supply the exact daemon origin, namespaced data directory, workspace ID and member ID for the intended personal workspace. Do not infer these from a globally installed version or a different running daemon. The local workspace-context endpoint verifies the supplied pair before registration.

```powershell
pnpm brand:deliver data/example_studio --package brand-output/example-studio --brief data/example_studio/brief/instagram-story --od-root C:/apps/OpenDesign/payload --od-data-dir C:/work/opendesign/namespaces/example/data --daemon-url http://127.0.0.1:58502 --workspace-id example-workspace --workspace-member-id example-member
pnpm brand:deliver --verify C:/work/opendesign/namespaces/example/data/design-systems/example-studio --daemon-url http://127.0.0.1:58502 --workspace-id example-workspace --workspace-member-id example-member
```

The port above is illustrative; use the actual daemon's origin. `--od-data-dir` is its exact data directory, not a namespace base that should be expanded again. IDs must come from the intended workspace's verified context. If API authentication is needed, pass `OD_API_TOKEN` in the environment; never put it in a command flag or a delivery receipt.

The adapter validates/stages all inputs first, then uses `POST /api/design-systems` to reserve the package slug with `artifactMode: agent-managed` and draft status. This route registers the personal workspace association without running the narrative extractor or generating a brand seed. It confirms that the returned reservation exists at the explicitly supplied destination before replacing it. An unexpected ID is refused. Published status is applied only when the complete reviewed bundle is installed.

The administrative desktop metadata retains the workspace binding and agent-managed mode; its title/category come from the supplied manifest and its surface is `image` for social requests or `web` for website requests. This does not replace the request's precise format or verify provisional identity. `DESIGN.md`, `tokens.css`, selected assets, evidence and confirmation sources retain their bytes. Accessibility reports are recomputed. The original input inventories and the actual installed hashes are both recorded.

`USAGE.md` is supplied by the inspected OpenDesign loader as selected-system usage context. It points to the exact selected brief, token origins and pending acceptance tasks. `START.md` remains the short starter instruction. The complete `handoff/` directory must be accessible to the recipient agent; context consumption still requires observing its response.

After installation, the adapter verifies the personal catalog and reads back the active `DESIGN.md`, `tokens.css`, `USAGE.md`, `BRIEF.md` and typed brief through the daemon. A failed verification restores the previous filesystem entry. A failed first installation removes only its unchanged, identified draft reservation through the API; uncertain cleanup is reported for manual recovery rather than removing an unrelated resource. Team sharing and database edits are outside this adapter.

## Validation and output

Delivery revalidates current evidence, source confirmations, permissions, selected direction, request channel, package file hashes, approved asset bytes and the actual token preflight. Input failures preserve an existing catalog entry. It rejects path overlap, redirected destinations, hidden files and symbolic links. Installation uses an atomic directory replacement. An existing directory is refused by default; `--replace` applies only to a marked importer delivery.

The catalog keeps minimal `manifest.json`, `metadata.json` with `status: published`, and the original `DESIGN.md`/`tokens.css`. It does not use OpenDesign `import-local` or desktop narrative extraction, which can rewrite the design description. A `handoff/` directory includes the selected brief, exact copy, assets, evidence, confirmation sources and accessibility tasks. `START.md` contains the exact starter instruction and paths; `delivery.json` records input and installed inventories, hashes, tested layout/version, desktop workspace association and pending context consumption. Verification detects missing, changed and unexpected files before consulting the catalog.

```powershell
pnpm brand:deliver --verify C:/work/od-data/design-systems/example-studio --daemon-url http://127.0.0.1:7456
```

This read-only verification requires a running local daemon and checks catalog visibility/status. Select `user:example-studio`, make the complete handoff directory accessible to the agent, and use `START.md`. If verification fails, check the daemon's `OD_DATA_DIR`, workspace visibility and permissions. No provider request is made by delivery or verification. Successful installation is not proof that an agent consumed the context or improved its output.

## Integration evidence — 2026-09-30

A fresh isolated OpenDesign **0.23.1** daemon on loopback port 7497 accepted a synthetic promotional-image handoff. `GET /api/design-systems` returned published `user:example-studio`; `POST /api/projects` selected that ID with HTTP 200 and no prompt/generation. Package `DESIGN.md` bytes were preserved. The local fixture is not a brand endorsement or performance experiment. At that checkpoint, agent context consumption, rendered quality and unfamiliar-brand evaluation remained pending and the Felisa hero was deferred. For subsequent concrete recipient readback, the closed delivery scope and user-authorized hero resumption, see the current [verification checkpoint](verification-checkpoint.md); matched unfamiliar-brand utility remains open.

Source contract inspected locally: OpenDesign 0.23.1 `apps/daemon/src/routes/static-resource.ts`, `routes/project/index.ts`, `design-systems/index.ts` and `app-config.ts`.

## Desktop regression evidence — 2026-10-02

The real 0.24.1 source-intake UI copied 78 of 95 files from a reviewed local bundle. All copied files were unchanged, including the selected brief and original product photo, but 17 reference/evidence files were omitted. The extracted active system changed typography, color roles and channel, and used a category line as brand tone. Keeping original instructions under `context/local-code/` did not preserve their priority in the active system. Do not use this extraction flow as proof of faithful reviewed delivery.

The corrected adapter passed an isolated synthetic trial using the actual packaged **0.24.1 daemon runtime**: workspace registration, published catalog visibility, active file readback and original DESIGN bytes. The approved local Felisa Story bundle then passed the same checks in the intended personal desktop workspace: 51 package input files plus 43 brief input files, 96 installed files including the two generated starter/usage documents, and no dropped references. Administrative metadata is adapted as described above. No generation was requested. Selector review by the user, observed recipient context consumption, final artwork/composer review and unfamiliar-brand utility remain pending; issue #20 stays open.

Inspected desktop modules: packaged `design-systems/workspace-owned-create`, `design-systems/server-services`, `design-systems/index`, `routes/design-system`, `routes/static-resource`, and `app-config`, in `resources/app/prebundled/daemon/chunks/server-WTGXM3LB.mjs`. The fixture layout tests check the contract gates; the runtime trial separately checks the actual consumer.
