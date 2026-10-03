import { copyFile, lstat, mkdir, readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { buildDirectoryAtomically } from './atomic.js';
import { selectedBrief } from './brief.js';
import { buildAssetCatalog } from './asset-catalog.js';
import { colorInputFingerprint } from './colors.js';
import { packageContextHash, packageSlug, validateBuiltPackage } from './package.js';
import { accessibilityPreflight, accessibilityMarkdown, tokenMap } from './accessibility.js';
import { digest, fileDigests, json, profileFile, readOptionalJson } from './local.js';
import { daemonClient, desktopAuthority, openDesignInstallation, workspaceHeaders } from './opendesign.js';

const same = (a, b) => json(a) === json(b);
const inside = (parent, child) => { const relative = path.relative(parent, child); return !relative || !relative.startsWith('..') && !path.isAbsolute(relative); };
async function canonicalDestination(target) {
  let ancestor = target;
  for (;;) {
    try {
      const actual = await realpath(ancestor);
      if (actual.toLowerCase() !== ancestor.toLowerCase()) throw new Error('Destination cannot redirect through a symbolic link.');
      return;
    } catch (error) { if (error.code !== 'ENOENT') throw error; ancestor = path.dirname(ancestor); }
  }
}
async function filesIn(root, relative = '') {
  const files = [];
  for (const entry of await readdir(path.join(root, relative), { withFileTypes: true })) {
    if (entry.isSymbolicLink() || entry.name.startsWith('.') || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(entry.name)) throw new Error('Delivery rejects hidden files, symbolic links and unsafe names.');
    const item = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...await filesIn(root, item));
    else if (entry.isFile()) files.push(item);
    else throw new Error('Delivery accepts ordinary files only.');
  }
  return files;
}
async function copyTree(root, target, prefix = '') {
  for (const relative of await filesIn(root)) {
    const destination = path.join(target, prefix, relative);
    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(await profileFile(root, relative), destination);
  }
}
async function inventory(root) {
  const result = {};
  for (const file of await filesIn(root)) result[file] = digest(await readFile(await profileFile(root, file)));
  return result;
}
async function assertInventory(root, expected, label) {
  const actual = await inventory(root);
  if (Object.keys(actual).length !== Object.keys(expected).length || Object.entries(expected).some(([file, hash]) => actual[file] !== hash)) {
    throw new Error(`${label} files are missing, changed or unexpected; rebuild the reviewed delivery.`);
  }
}

export async function deliver(profileDir, { packageDir, briefDir, odDataDir, odRoot, replace = false,
  daemonUrl, workspaceId, workspaceMemberId, apiToken, fetchImpl } = {}) {
  if (!packageDir || !briefDir || !odDataDir || !odRoot) throw new Error('Supply package, selected brief, explicit OD_DATA_DIR and OpenDesign installation root.');
  if (!path.isAbsolute(odDataDir)) throw new Error('OD_DATA_DIR must be an explicit absolute path.');
  const installation = await openDesignInstallation(odRoot), { version } = installation;
  const scope = { workspaceId, workspaceMemberId };
  workspaceHeaders(scope);
  if (installation.layout === 'desktop' && (!daemonUrl || !workspaceId || !workspaceMemberId)) {
    throw new Error('Desktop delivery requires an explicit --daemon-url, --workspace-id and --workspace-member-id to register and verify the personal catalog.');
  }
  if (installation.layout === 'source' && (workspaceId || workspaceMemberId)) throw new Error('Workspace registration is supported only by the inspected desktop contract.');
  const client = daemonUrl ? daemonClient(daemonUrl, { ...scope, apiToken, fetchImpl }) : null;
  const { state, brief } = await selectedBrief(profileDir);
  if (brief.status !== 'ready-for-execution') throw new Error(`Selected brief needs review: ${brief.pending.join(' ')}`);
  const sourcePackage = await realpath(packageDir), sourceBrief = await realpath(briefDir);
  const incoming = JSON.parse(await readFile(path.join(sourceBrief, 'design-brief.json'), 'utf8'));
  if (!same(incoming, brief)) throw new Error('Selected brief differs from current reviewed inputs; recompile before delivery.');
  const slug = packageSlug(state.prepared.source.profile.username);
  await validateBuiltPackage(sourcePackage, slug);
  const metadata = JSON.parse(await readFile(path.join(sourcePackage, 'metadata.json'), 'utf8'));
  if (metadata.status !== 'published') throw new Error('Package needs published local catalog metadata.');
  const colors = JSON.parse(await readFile(path.join(state.prepared.root, 'color-proposals.json'), 'utf8'));
  const graphics = state.prepared.images.filter((item) => item.review.classification === 'brand-graphic').slice(0, 4);
  if (colors.inputHash !== await colorInputFingerprint(state.analysis, graphics)) throw new Error('Color proposals changed; recompile package.');
  const { catalog } = await buildAssetCatalog(state.prepared, state.analysis, { write: false });
  const context = await readOptionalJson(path.join(sourcePackage, 'source/package-context.json'));
  if (context?.channel !== state.channel || context.inputHash !== packageContextHash(state.analysis, colors, state.decisions, catalog, state.channel)) throw new Error('Package context is stale or uses another channel; recompile with the request channel.');
  if (!same(context.files, await fileDigests(sourcePackage))) throw new Error('Package files changed; recompile before delivery.');
  const { briefMarkdown } = await import('./brief.js');
  if (await readFile(path.join(sourceBrief, 'BRIEF.md'), 'utf8') !== briefMarkdown(brief)) throw new Error('Brief instructions changed; recompile before delivery.');
  // Recompute the current token check; an edited preflight report cannot waive a failure.
  const accessibility = accessibilityPreflight({ tokens: tokenMap(await readFile(path.join(sourcePackage, 'tokens.css'), 'utf8')),
    plan: brief.request.accessibility, request: brief.request, assets: brief.assets });
  if (accessibility.status === 'fail') throw new Error('Package token usage fails accessibility preflight; review the declared pairs.');
  for (const asset of brief.assets) {
    if (digest(await readFile(await profileFile(sourceBrief, asset.path))) !== asset.sha256) throw new Error(`Brief asset changed: ${asset.id}`);
    const entry = catalog.entries.find((item) => item.id === asset.id);
    if (!entry?.readyForDesign || entry.sha256 !== asset.sha256) throw new Error(`Asset permission/preflight changed: ${asset.id}`);
  }
  for (const source of brief.sources) if (digest(await readFile(await profileFile(sourceBrief, source.path))) !== source.sha256) throw new Error(`Brief confirmation source changed: ${source.id}`);
  for (const evidence of brief.evidence) {
    const original = state.prepared.evidence.find((item) => item.id === evidence.id);
    if (digest(await readFile(await profileFile(sourceBrief, evidence.sourcePath))) !== digest(await readFile(await profileFile(state.prepared.root, original.sourcePath)))) throw new Error(`Brief evidence changed: ${evidence.id}`);
  }
  const packageFiles = await inventory(sourcePackage), briefFiles = await inventory(sourceBrief);
  if (Object.keys(packageFiles).some((file) => ['START.md', 'USAGE.md', 'delivery.json'].includes(file) || file.startsWith('handoff/'))) throw new Error('Package collides with generated handoff files.');
  const target = path.resolve(odDataDir, 'design-systems', slug);
  if (![state.prepared.root, sourcePackage, sourceBrief, path.resolve(odRoot)].every((root) => !inside(target, root) && !inside(root, target))) throw new Error('Delivery destination must be separate from all source inputs.');
  await canonicalDestination(target);
  const previous = await readOptionalJson(path.join(target, 'delivery.json'));
  try {
    await lstat(target);
    if (!replace || previous?.schemaVersion !== 'opendesign-delivery/v1' || previous.id !== `user:${slug}`) throw new Error('Destination exists; only an importer delivery may be explicitly replaced with --replace.');
    if (installation.layout === 'desktop' && !same(previous.workspace, scope)) throw new Error('Cannot replace a delivery from another workspace/member.');
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (installation.layout === 'desktop') {
    await desktopAuthority(client, installation, scope);
    const catalog = await client('/api/design-systems');
    const exists = catalog.designSystems?.some((item) => item.id === `user:${slug}`);
    if (exists !== Boolean(previous)) throw new Error('Daemon catalog and explicit destination disagree; check OD_DATA_DIR and existing workspace bindings.');
    if (previous) await verifyCatalog(target, daemonUrl, { ...scope, apiToken, fetchImpl });
  }
  const record = { schemaVersion: 'opendesign-delivery/v1', id: `user:${slug}`, inputHash: brief.inputHash,
    packageInputHash: context.inputHash, openDesignVersion: version, selectedDirectionId: brief.selectedDirection.id,
    installedAt: new Date().toISOString(), selection: 'pending-local-catalog-verification', agentContext: 'not-yet-observed',
    installationLayout: installation.layout, ...(installation.layout === 'desktop' ? { workspace: scope } : {}),
    sourceFiles: { package: packageFiles, brief: briefFiles },
    files: {}, manualAcceptance: accessibility.checks.filter((check) => check.status === 'manual-review') };
  let reservation;
  let verification;
  try { await buildDirectoryAtomically(target, async (staged) => {
    await copyTree(sourcePackage, staged);
    await assertInventory(staged, packageFiles, 'Copied package');
    await copyTree(sourceBrief, staged, 'handoff');
    await assertInventory(path.join(staged, 'handoff'), briefFiles, 'Copied brief');
    await writeFile(path.join(staged, 'handoff/accessibility.json'), json(accessibility));
    await writeFile(path.join(staged, 'handoff/ACCESSIBILITY.md'), accessibilityMarkdown(accessibility));
    const prompt = `Use design system ${record.id}. Read ${path.join(target, 'handoff/BRIEF.md')} and ${path.join(target, 'handoff/design-brief.json')} before acting. Execute only ${brief.selectedDirection.id}. Preserve exact copy, approved asset bytes and confirmed channel rules. Review ${path.join(target, 'handoff/ACCESSIBILITY.md')} and carry every pending acceptance task. Report unresolved inputs before execution.${brief.codeContext ? ` For the existing website, connect authorized directory ${brief.codeContext.root} using OpenDesign linkedDirs, verify the listed file hashes, inspect existing code and preserve current confirmed website tokens. Do not edit before access is available.` : ''}`;
    await writeFile(path.join(staged, 'START.md'), `# Start this reviewed request\n\nSelect **${record.id}** in the local catalog. Attach or make the entire handoff directory accessible to the agent. Paste the instruction below.\n\n${prompt}\n\nFor measurable HTML review, mark approved copy with data-copy-id, selected images with data-asset-id and the requested web link with data-action. Use the existing brief IDs; these attributes do not replace accessible names or native semantics. Preserve the first HTML and screenshots at every required viewport before editing.\n\nInstallation does not demonstrate that an agent read these files. Record its first output before revisions.\n`);
    // The inspected loader supplies USAGE.md to the selected design-system context.
    // Keep DESIGN.md and tokens.css byte-identical; never reconstruct them by extraction.
    await writeFile(path.join(staged, 'USAGE.md'), `# Reviewed request and source authority\n\n${prompt}\n\nRequest channel: ${state.channel}. Kind: ${brief.request.kind}. Read START.md and the selected brief before composing. The exact CSS roles are in tokens.css; their origins are in source/token-origins.json. Functional defaults and approximate visual inferences remain provisional. Human-confirmed rules override proposals only in their confirmed channel. Do not extract a new identity from this package, use reference-only images as artwork, or treat published catalog status as verified brand identity. Report inaccessible evidence files before execution.\n`);
    await validateBuiltPackage(staged, slug);
    if (installation.layout === 'desktop') {
      let desktopMetadata;
      if (!previous) {
        const body = `${await readFile(path.join(staged, 'DESIGN.md'), 'utf8')}\n<!-- importer-reservation:${randomUUID()} -->\n`;
        const created = await client('/api/design-systems', { method: 'POST', body: { title: slug, body,
          category: 'Experimental', surface: state.channel === 'social' ? 'image' : 'web', status: 'draft', artifactMode: 'agent-managed' } });
        const id = created.designSystem?.id ?? created.id;
        if (typeof id !== 'string' || !/^user:[a-z0-9-]+$/.test(id)) throw new Error('Daemon did not return a valid reservation ID; inspect the catalog before retrying.');
        reservation = { id, body };
        if (id !== record.id) throw new Error('Daemon reserved another ID; refusing to replace an existing resource.');
        // Confirms that this daemon uses the explicitly supplied data directory.
        desktopMetadata = await readOptionalJson(path.join(target, 'metadata.json'));
        if (!desktopMetadata || await readFile(path.join(target, 'DESIGN.md'), 'utf8') !== body) throw new Error('Daemon reservation is absent from the explicit destination; check OD_DATA_DIR.');
      } else desktopMetadata = await readOptionalJson(path.join(target, 'metadata.json'));
      if (desktopMetadata?.workspaceId !== workspaceId || desktopMetadata.artifactMode !== 'agent-managed') throw new Error('Destination metadata does not match the reserved personal workspace.');
      const manifest = JSON.parse(await readFile(path.join(staged, 'manifest.json'), 'utf8'));
      await writeFile(path.join(staged, 'metadata.json'), json({ ...desktopMetadata, title: manifest.name,
        category: manifest.category, status: 'published', surface: state.channel === 'social' ? 'image' : 'web' }));
    }
    await canonicalDestination(target);
    for (const file of await filesIn(staged)) record.files[file] = digest(await readFile(await profileFile(staged, file)));
    await writeFile(path.join(staged, 'delivery.json'), json(record));
    await validateBuiltPackage(staged, slug);
  }, { verify: installation.layout === 'desktop' ? async () => {
    verification = await verifyCatalog(target, daemonUrl, { ...scope, apiToken, fetchImpl });
  } : undefined }); }
  catch (error) {
    if (reservation) {
      try {
        const detail = await client(`/api/design-systems/${encodeURIComponent(reservation.id)}`);
        if ((detail.designSystem ?? detail).body !== reservation.body) throw new Error('Reservation changed; manual recovery is required.');
        await client(`/api/design-systems/${encodeURIComponent(reservation.id)}`, { method: 'DELETE' });
      } catch { throw new Error(`${error.message} Reservation cleanup could not be verified; inspect ${reservation.id} in the supplied daemon before retrying.`); }
    }
    throw error;
  }
  return { destination: target, ...record, ...(verification ? { verification } : {}) };
}

export async function verifyCatalog(deliveryDir, daemonUrl, options = {}) {
  const record = JSON.parse(await readFile(path.join(deliveryDir, 'delivery.json'), 'utf8'));
  if (record.schemaVersion !== 'opendesign-delivery/v1' || !record.files || Array.isArray(record.files) ||
      !/^user:[a-z0-9-]+$/.test(record.id) || ['DESIGN.md', 'tokens.css', 'handoff/BRIEF.md', 'handoff/design-brief.json'].some((file) => !record.files[file]) ||
      Object.values(record.files).some((hash) => typeof hash !== 'string' || !/^[a-f0-9]{64}$/.test(hash))) throw new Error('Invalid delivery receipt.');
  const { 'delivery.json': omitted, ...actual } = await inventory(deliveryDir);
  if (Object.keys(actual).length !== Object.keys(record.files).length || Object.entries(record.files).some(([file, hash]) => actual[file] !== hash)) throw new Error('Installed delivery files are missing, changed or unexpected; do not execute this handoff.');
  if (record.workspace && (options.workspaceId !== record.workspace.workspaceId || options.workspaceMemberId !== record.workspace.workspaceMemberId)) throw new Error('Verify with the delivery\'s explicit workspace/member IDs.');
  const client = daemonClient(daemonUrl, options);
  if (record.installationLayout === 'desktop') await desktopAuthority(client, { version: record.openDesignVersion }, record.workspace);
  const catalog = await client('/api/design-systems');
  const entry = catalog.designSystems?.find((item) => item.id === record.id);
  if (!entry || entry.status !== 'published') throw new Error(`${record.id} is not selectable; confirm daemon OD_DATA_DIR and workspace visibility.`);
  if (record.installationLayout === 'desktop') {
    const route = `/api/design-systems/${encodeURIComponent(record.id)}`;
    const detail = await client(route);
    if (digest((detail.designSystem ?? detail).body ?? '') !== record.files['DESIGN.md']) throw new Error('Daemon active DESIGN.md differs from the reviewed delivery.');
    for (const file of ['tokens.css', 'USAGE.md', 'handoff/BRIEF.md', 'handoff/design-brief.json']) {
      const result = await client(`${route}/file?path=${encodeURIComponent(file)}`);
      if (typeof result.file?.content !== 'string' || digest(result.file.content) !== record.files[file]) throw new Error(`Daemon active file differs or is unavailable: ${file}`);
    }
  }
  // Verification is returned separately; never imply a generated result or context consumption.
  return { id: entry.id, selection: 'visible-published-local-catalog', integrity: 'all-receipted-files-match',
    ...(record.installationLayout === 'desktop' ? { activeContext: 'design-tokens-usage-and-brief-match', workspace: record.workspace } : {}),
    agentContext: 'not-yet-observed', openDesignVersion: record.openDesignVersion };
}
