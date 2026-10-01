import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { briefFixture, fixtureDirections } from './helpers/brief.js';
import { compileBrief, importDirections, prepareBrief } from '../src/brief.js';
import { compileExisting } from '../src/pipeline.js';
import { deliver } from '../src/delivery.js';

test('delivery binds current approvals, channel, bytes and selected brief; unsafe or failed replacements preserve the catalog', async () => {
  const fixture = await briefFixture();
  try {
    fixture.request.selectedDirectionId = 'D-1';
    await writeFile(path.join(fixture.root, 'design-request.json'), JSON.stringify(fixture.request));
    const { context } = await prepareBrief(fixture.root);
    await importDirections(fixture.root, { directions: fixtureDirections(context) });
    const brief = await compileBrief(fixture.root);
    const pkg = await compileExisting(fixture.root, { outputRoot: path.join(fixture.root, 'package') });
    const odRoot = path.join(fixture.root, 'od-install');
    await mkdir(path.join(odRoot, 'apps/daemon'), { recursive: true });
    await writeFile(path.join(odRoot, 'apps/daemon/package.json'), '{"version":"0.23.1"}');
    const options = { packageDir: pkg.outputDir, briefDir: brief.outputDir, odRoot, odDataDir: path.join(fixture.root, 'catalog') };
    // The catalog is separate from the profile source directory in normal operation.
    const data = `${fixture.root}-catalog`; options.odDataDir = data;
    try {
      const installed = await deliver(fixture.root, options);
      assert.equal(installed.id, 'user:example-studio'); assert.equal(installed.agentContext, 'not-yet-observed');
      assert.equal(await readFile(path.join(installed.destination, 'DESIGN.md'), 'utf8'), await readFile(path.join(pkg.outputDir, 'DESIGN.md'), 'utf8'));
      assert.match(await readFile(path.join(installed.destination, 'START.md'), 'utf8'), /Execute only D-1/);
      const before = await readFile(path.join(installed.destination, 'delivery.json'), 'utf8');
      await assert.rejects(() => deliver(fixture.root, options), /Destination exists/);
      await writeFile(path.join(pkg.outputDir, 'tokens.css'), 'changed');
      await assert.rejects(() => deliver(fixture.root, { ...options, replace: true }), /56 OpenDesign tokens|Package files changed/);
      assert.equal(await readFile(path.join(installed.destination, 'delivery.json'), 'utf8'), before);
      await compileExisting(fixture.root, { outputRoot: path.join(fixture.root, 'package') });
      await writeFile(path.join(brief.outputDir, brief.brief.assets[0].path), 'changed');
      await assert.rejects(() => deliver(fixture.root, { ...options, replace: true }), /Brief asset changed/);
      assert.equal(await readFile(path.join(installed.destination, 'delivery.json'), 'utf8'), before);
    } finally { await rm(data, { recursive: true, force: true }); }
  } finally { await rm(fixture.root, { recursive: true, force: true }); }
});

test('promotional and website requests use explicit dimensions and authorized local code fingerprints', async () => {
  for (const kind of ['promotional-image', 'website-change']) {
    const fixture = await briefFixture();
    try {
      fixture.request.kind = kind; fixture.request.target = { width: 1200, height: 900 };
      if (kind === 'promotional-image') fixture.request.action = { type: 'none', label: null, url: null, reservedSpace: null };
      else fixture.request.existingSite = { root: fixture.root, files: ['manual/request.md'], sourceId: 'S-REQUEST' };
      await writeFile(path.join(fixture.root, 'design-request.json'), JSON.stringify(fixture.request));
      const state = await prepareBrief(fixture.root);
      assert.equal(state.channel, kind === 'website-change' ? 'website' : 'social');
      assert.deepEqual(state.catalog.target, fixture.request.target);
      if (kind === 'website-change') {
        assert.equal(state.codeContext.files.length, 1); assert.ok(!JSON.stringify(state.context).includes(fixture.root));
        await writeFile(path.join(fixture.root, 'manual/request.md'), 'changed');
        await assert.rejects(() => prepareBrief(fixture.root), /current registered authorization|permission source changed/);
      }
    } finally { await rm(fixture.root, { recursive: true, force: true }); }
  }
});
