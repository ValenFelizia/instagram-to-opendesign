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

Use an explicit absolute data directory used by the intended OpenDesign daemon. The verified installation layout is an OpenDesign 0.23.1 checkout/package root containing `apps/daemon/package.json`. Other versions or layouts fail with an actionable compatibility check rather than guessing their catalogs.

## Validation and output

Delivery revalidates current evidence, source confirmations, permissions, selected direction, request channel, package file hashes, approved asset bytes and the actual token preflight. Input failures preserve an existing catalog entry. It rejects path overlap, redirected destinations, hidden files and symbolic links. Installation uses an atomic directory replacement. An existing directory is refused by default; `--replace` applies only to a marked importer delivery.

The catalog keeps minimal `manifest.json`, `metadata.json` with `status: published`, and the original `DESIGN.md`/`tokens.css`. It does not use OpenDesign `import-local`, which can rewrite the design description. A `handoff/` directory includes the selected brief, exact copy, assets, evidence, confirmation sources and accessibility tasks. `START.md` contains the exact starter instruction and paths; `delivery.json` records inputs, hashes, tested version and pending context consumption.

```powershell
pnpm brand:deliver --verify C:/work/od-data/design-systems/example-studio --daemon-url http://127.0.0.1:7456
```

This read-only verification requires a running local daemon and checks catalog visibility/status. Select `user:example-studio`, make the complete handoff directory accessible to the agent, and use `START.md`. If verification fails, check the daemon's `OD_DATA_DIR`, workspace visibility and permissions. No provider request is made by delivery or verification. Successful installation is not proof that an agent consumed the context or improved its output.

## Integration evidence — 2026-09-30

A fresh isolated OpenDesign **0.23.1** daemon on loopback port 7497 accepted a synthetic promotional-image handoff. `GET /api/design-systems` returned published `user:example-studio`; `POST /api/projects` selected that ID with HTTP 200 and no prompt/generation. Package `DESIGN.md` bytes were preserved. The local fixture is not a brand endorsement or performance experiment. Agent context consumption, rendered quality and real unfamiliar-brand evaluation remain pending under #21. Real Felisa hero generation stays deferred until the user supplies the new approach/photos; no new request or asset permissions were invented.

Source contract inspected locally: OpenDesign 0.23.1 `apps/daemon/src/routes/static-resource.ts`, `routes/project/index.ts`, `design-systems/index.ts` and `app-config.ts`.
