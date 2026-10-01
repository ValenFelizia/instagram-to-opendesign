import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { buildAssetCatalog, initializeAssets, pendingAsset, proposedCrop } from '../src/asset-catalog.js';
import { emptyDecisions } from '../src/decisions.js';
import { digest } from '../src/local.js';
import { compilePackage } from '../src/package.js';
import { profileFixture } from './helpers/profile.js';

export async function approvedAssets(fixture) {
  const document = await emptyDecisions(fixture.prepared, fixture.analysis);
  const permission = 'Synthetic fixture: owner confirms local design use of these synthetic images.';
  await writeFile(path.join(fixture.root, 'manual/permission.md'), permission);
  document.sources.push({ id: 'S-PERMISSION', path: 'manual/permission.md', sha256: digest(permission),
    reviewer: 'Synthetic owner', reviewedAt: '2026-01-02T00:00:00Z', summary: 'Synthetic image permission' });
  await writeFile(path.join(fixture.root, 'brand-decisions.json'), JSON.stringify(document));
  const review = await initializeAssets(fixture.prepared);
  for (const entry of review.entries) Object.assign(entry, { origin: 'original', uiOverlay: false,
    permission: { use: 'local-design', sourceId: 'S-PERMISSION' } });
  await writeFile(path.join(fixture.root, 'asset-review.json'), JSON.stringify(review));
  return review;
}

test('measures opaque alpha and transparent pixels; crops request subject review without mutating bytes', async () => {
  const fixture = await profileFixture();
  try {
    await sharp({ create: { width: 80, height: 60, channels: 4, background: { r: 12, g: 30, b: 40, alpha: 1 } } })
      .png().toFile(path.join(fixture.root, 'assets/avatar.png'));
    const review = await approvedAssets(fixture);
    const original = await readFile(path.join(fixture.root, 'assets/avatar.png'));
    let { catalog } = await buildAssetCatalog(fixture.prepared, fixture.analysis, { kind: 'instagram-story' });
    assert.equal(catalog.entries[0].technical.hasAlphaChannel, true);
    assert.equal(catalog.entries[0].technical.hasTransparentPixels, false);
    assert.equal(catalog.entries[0].technical.aspectRatio, 80 / 60);
    assert.equal(catalog.entries[0].lowResolution, true);
    assert.equal(catalog.entries[0].crop.reviewRequired, true);
    assert.deepEqual(await readFile(path.join(fixture.root, 'assets/avatar.png')), original);
    assert.equal(proposedCrop(80, 60, { width: 1080, height: 1920 }, { x: 0, y: .1, width: .9, height: .8 }).cutsSubject, true);
    assert.equal(proposedCrop(80, 60, { width: 1080, height: 1920 }, { x: .45, y: .2, width: .1, height: .2 }).reviewRequired, false);
    await sharp({ create: { width: 80, height: 60, channels: 4, background: { r: 12, g: 30, b: 40, alpha: 0 } } })
      .png().toFile(path.join(fixture.root, 'assets/avatar.png'));
    ({ catalog } = await buildAssetCatalog(fixture.prepared, fixture.analysis));
    assert.equal(catalog.entries[0].technical.hasTransparentPixels, true);
    assert.equal(catalog.entries[0].readyForDesign, false);
    assert.ok(catalog.entries[0].blockers.includes('file changed since review'));
  } finally { await rm(fixture.root, { recursive: true, force: true }); }
});

test('unknown rights and screenshots with UI remain evidence; a supplied original is reusable with confirmed provenance', async () => {
  const fixture = await profileFixture();
  try {
    let assets = await buildAssetCatalog(fixture.prepared, fixture.analysis);
    assert.ok(assets.entries.every((entry) => !entry.readyForDesign));
    const review = await approvedAssets(fixture);
    review.entries[0].origin = 'screenshot'; review.entries[0].uiOverlay = true;
    review.entries[1].permission = { use: 'unknown' };
    await sharp({ create: { width: 100, height: 150, channels: 3, background: '#345678' } })
      .png().toFile(path.join(fixture.root, 'manual/original.png'));
    const local = await pendingAsset(fixture.prepared, { id: 'A-LOCAL-original', path: 'manual/original.png', role: 'product' });
    Object.assign(local, { origin: 'original', uiOverlay: false, primary: true,
      permission: { use: 'local-design', sourceId: 'S-PERMISSION' } });
    review.entries.push(local);
    await writeFile(path.join(fixture.root, 'asset-review.json'), JSON.stringify(review));
    assets = await buildAssetCatalog(fixture.prepared, fixture.analysis);
    assert.equal(assets.entries[0].readyForDesign, false); assert.equal(assets.entries[1].readyForDesign, false);
    assert.equal(assets.entries[2].readyForDesign, true);
    assert.equal(assets.entries[2].source.type, 'supplied-local');
    const result = await compilePackage(fixture.prepared, fixture.analysis, fixture.colors, { outputRoot: path.join(fixture.root, 'output') });
    const catalog = JSON.parse(await readFile(path.join(result.outputDir, 'source/asset-catalog.json'), 'utf8'));
    assert.ok(catalog.entries.slice(0, 2).every((entry) => entry.path.startsWith('source/images/')));
    assert.ok(catalog.entries[2].path.startsWith('assets/reusable/'));
    assert.deepEqual(await readFile(path.join(result.outputDir, catalog.entries[2].path)), await readFile(path.join(fixture.root, local.path)));
    assert.equal(JSON.parse(await readFile(path.join(result.outputDir, 'manifest.json'), 'utf8')).assetCatalog, undefined);
  } finally { await rm(fixture.root, { recursive: true, force: true }); }
});

test('invalid permission references and duplicate primaries preserve prior catalog and package; changed permission blocks reuse', async () => {
  const fixture = await profileFixture();
  try {
    const review = await approvedAssets(fixture);
    await buildAssetCatalog(fixture.prepared, fixture.analysis);
    const options = { outputRoot: path.join(fixture.root, 'output') };
    const result = await compilePackage(fixture.prepared, fixture.analysis, fixture.colors, options);
    const previousCatalog = await readFile(path.join(fixture.root, 'asset-catalog.json'), 'utf8');
    const previousPackage = await readFile(path.join(result.outputDir, 'source/asset-catalog.json'), 'utf8');
    review.entries[0].permission.sourceId = 'S-FAKE';
    await writeFile(path.join(fixture.root, 'asset-review.json'), JSON.stringify(review));
    await assert.rejects(() => buildAssetCatalog(fixture.prepared, fixture.analysis), /Unknown permission source/);
    await assert.rejects(() => compilePackage(fixture.prepared, fixture.analysis, fixture.colors, options), /Unknown permission source/);
    assert.equal(await readFile(path.join(fixture.root, 'asset-catalog.json'), 'utf8'), previousCatalog);
    assert.equal(await readFile(path.join(result.outputDir, 'source/asset-catalog.json'), 'utf8'), previousPackage);
    review.entries[0].permission.sourceId = 'S-PERMISSION';
    for (const entry of review.entries) Object.assign(entry, { role: 'product', primary: true });
    await writeFile(path.join(fixture.root, 'asset-review.json'), JSON.stringify(review));
    await assert.rejects(() => buildAssetCatalog(fixture.prepared, fixture.analysis), /one primary/);
    review.entries[1].primary = false;
    await writeFile(path.join(fixture.root, 'asset-review.json'), JSON.stringify(review));
    await writeFile(path.join(fixture.root, 'manual/permission.md'), 'Changed scope of permission');
    assert.ok((await buildAssetCatalog(fixture.prepared, fixture.analysis)).entries.every((entry) => !entry.readyForDesign));
  } finally { await rm(fixture.root, { recursive: true, force: true }); }
});
