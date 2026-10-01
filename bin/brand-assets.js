#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { prepareAnalysis, validateAnalysis } from '../src/analyze.js';
import { initializeAssets, pendingAsset, buildAssetCatalog, validateAssetReview } from '../src/asset-catalog.js';
import { writeJsonAtomically } from '../src/atomic.js';
import { digest, readOptionalJson } from '../src/local.js';
const usage = 'Usage: pnpm brand:assets data/<username> [--init | --add manual/file.png | --check [--kind web-hero|instagram-story]]';
const [profileDir, mode = '--check', ...args] = process.argv.slice(2);
if (!profileDir || ['--help', '-h'].includes(profileDir)) { console.log(usage); process.exit(profileDir ? 0 : 1); }
try {
  const prepared = await prepareAnalysis(profileDir);
  const analysis = JSON.parse(await readFile(path.join(prepared.root, 'brand-analysis.json'), 'utf8'));
  await validateAnalysis(analysis, prepared);
  const file = path.join(prepared.root, 'asset-review.json');
  if (mode === '--init' && !args.length) {
    if (await readOptionalJson(file)) throw new Error('Asset review already exists; initialization never overwrites it.');
    await writeJsonAtomically(file, await initializeAssets(prepared)); console.log(file);
  } else if (mode === '--add' && args.length === 1 && /^manual\/[A-Za-z0-9._/-]+\.(png|jpg|jpeg|webp)$/.test(args[0])) {
    const document = await readOptionalJson(file) ?? await initializeAssets(prepared);
    validateAssetReview(document, prepared.source.profile.username);
    const id = `A-LOCAL-${digest(args[0]).slice(0, 16)}`;
    if (document.entries.some((entry) => entry.id === id)) throw new Error('Local asset already registered.');
    document.entries.push(await pendingAsset(prepared, { id, path: args[0] }));
    validateAssetReview(document, prepared.source.profile.username);
    await writeJsonAtomically(file, document); console.log(`Registered ${id}; rights and visual review remain pending.`);
  } else if (mode === '--check' && (!args.length || args.length === 2 && args[0] === '--kind')) {
    const { catalog } = await buildAssetCatalog(prepared, analysis, { kind: args[1] ?? 'web-hero' });
    console.log(JSON.stringify(catalog, null, 2));
  } else throw new Error(usage);
} catch (error) { console.error(error.message); process.exitCode = 1; }
