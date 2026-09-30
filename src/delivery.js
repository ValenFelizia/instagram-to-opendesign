import { copyFile, lstat, mkdir, readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildDirectoryAtomically } from './atomic.js';
import { selectedBrief } from './brief.js';
import { buildAssetCatalog } from './asset-catalog.js';
import { colorInputFingerprint } from './colors.js';
import { packageContextHash, packageSlug, validateBuiltPackage } from './package.js';
import { accessibilityPreflight, accessibilityMarkdown, tokenMap } from './accessibility.js';
import { digest, fileDigests, json, profileFile, readOptionalJson } from './local.js';

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
export async function deliver(profileDir, { packageDir, briefDir, odDataDir, odRoot, replace = false } = {}) {
  if (!packageDir || !briefDir || !odDataDir || !odRoot) throw new Error('Supply package, selected brief, explicit OD_DATA_DIR and OpenDesign installation root.');
  if (!path.isAbsolute(odDataDir)) throw new Error('OD_DATA_DIR must be an explicit absolute path.');
  let version;
  try { version = JSON.parse(await readFile(path.join(odRoot, 'apps/daemon/package.json'), 'utf8')).version; }
  catch { throw new Error('OpenDesign installation is unavailable. Supply its root containing apps/daemon/package.json; tested layout/version: 0.23.1.'); }
  if (version !== '0.23.1') throw new Error(`OpenDesign ${version} is not verified; validate its catalog contract before delivery. Tested: 0.23.1.`);
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
  const target = path.resolve(odDataDir, 'design-systems', slug);
  if (![state.prepared.root, sourcePackage, sourceBrief, path.resolve(odRoot)].every((root) => !inside(target, root) && !inside(root, target))) throw new Error('Delivery destination must be separate from all source inputs.');
  await canonicalDestination(target);
  const previous = await readOptionalJson(path.join(target, 'delivery.json'));
  try {
    await lstat(target);
    if (!replace || previous?.schemaVersion !== 'opendesign-delivery/v1' || previous.id !== `user:${slug}`) throw new Error('Destination exists; only an importer delivery may be explicitly replaced with --replace.');
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const record = { schemaVersion: 'opendesign-delivery/v1', id: `user:${slug}`, inputHash: brief.inputHash,
    packageInputHash: context.inputHash, openDesignVersion: version, selectedDirectionId: brief.selectedDirection.id,
    installedAt: new Date().toISOString(), selection: 'pending-local-catalog-verification', agentContext: 'not-yet-observed',
    files: {}, manualAcceptance: accessibility.checks.filter((check) => check.status === 'manual-review') };
  await buildDirectoryAtomically(target, async (staged) => {
    await copyTree(sourcePackage, staged);
    await copyTree(sourceBrief, staged, 'handoff');
    await writeFile(path.join(staged, 'handoff/accessibility.json'), json(accessibility));
    await writeFile(path.join(staged, 'handoff/ACCESSIBILITY.md'), accessibilityMarkdown(accessibility));
    const prompt = `Use design system ${record.id}. Read ${path.join(target, 'handoff/BRIEF.md')} and ${path.join(target, 'handoff/design-brief.json')} before acting. Execute only ${brief.selectedDirection.id}. Preserve exact copy, approved asset bytes and confirmed channel rules. Review ${path.join(target, 'handoff/ACCESSIBILITY.md')} and carry every pending acceptance task. Report unresolved inputs before execution.${brief.codeContext ? ` For the existing website, connect authorized directory ${brief.codeContext.root} using OpenDesign linkedDirs, verify the listed file hashes, inspect existing code and preserve current confirmed website tokens. Do not edit before access is available.` : ''}`;
    await writeFile(path.join(staged, 'START.md'), `# Start this reviewed request\n\nSelect **${record.id}** in the local catalog. Attach or make the entire handoff directory accessible to the agent. Paste the instruction below.\n\n${prompt}\n\nInstallation does not demonstrate that an agent read these files. Record its first output before revisions.\n`);
    for (const file of await filesIn(staged)) record.files[file] = digest(await readFile(await profileFile(staged, file)));
    await writeFile(path.join(staged, 'delivery.json'), json(record));
    await validateBuiltPackage(staged, slug);
  });
  return { destination: target, ...record };
}

export async function verifyCatalog(deliveryDir, daemonUrl, { fetchImpl = fetch } = {}) {
  const url = new URL(daemonUrl);
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.username || url.password) throw new Error('Verify against an explicit local HTTP daemon URL.');
  const record = JSON.parse(await readFile(path.join(deliveryDir, 'delivery.json'), 'utf8'));
  const response = await fetchImpl(new URL('/api/design-systems', url), { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`Local catalog returned ${response.status}; confirm daemon, OD_DATA_DIR and workspace access.`);
  const catalog = await response.json();
  const entry = catalog.designSystems?.find((item) => item.id === record.id);
  if (!entry || entry.status !== 'published') throw new Error(`${record.id} is not selectable; confirm daemon OD_DATA_DIR and workspace visibility.`);
  // Verification is returned separately; never imply a generated result or context consumption.
  return { id: entry.id, selection: 'visible-published-local-catalog', agentContext: 'not-yet-observed', openDesignVersion: record.openDesignVersion };
}
