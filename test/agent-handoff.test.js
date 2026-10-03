import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { briefFixture, fixtureDirections } from './helpers/brief.js';
import { exportAgentHandoff, verifyAgentHandoff, importDirections, prepareBrief } from '../src/core.js';

test('generic handoff preserves exact canonical inputs and resolves references after moving without an adapter', async () => {
  const fixture = await briefFixture('instagram-story'), moved = `${fixture.root}-moved`;
  try {
    fixture.request.selectedDirectionId = 'D-1';
    await writeFile(path.join(fixture.root, 'design-request.json'), JSON.stringify(fixture.request));
    const { context } = await prepareBrief(fixture.root);
    await importDirections(fixture.root, { directions: fixtureDirections(context) });
    const names = ['design-request.json', 'brand-analysis.json', 'brand-decisions.json', 'creative-directions.json', 'asset-review.json'];
    const before = await Promise.all(names.map(name => readFile(path.join(fixture.root, name))));
    const built = await exportAgentHandoff(fixture.root);
    assert.equal(built.brief.status, 'ready-for-execution');
    const start = await readFile(path.join(built.outputDir, 'START.md'), 'utf8');
    const briefText = await readFile(path.join(built.outputDir, 'BRIEF.md'), 'utf8');
    assert.match(start, /selected execution brief/);
    assert.ok(!start.includes('undefined'));
    assert.ok(briefText.includes(fixture.request.objective) && briefText.includes(fixture.request.copy[1].text));
    const asset = built.brief.assets[0];
    const original = fixture.review.entries.find(entry => entry.id === asset.id);
    assert.deepEqual(await readFile(path.join(built.outputDir, asset.path)), await readFile(path.join(fixture.root, original.path)));
    assert.deepEqual(await Promise.all(names.map(name => readFile(path.join(fixture.root, name)))), before);
    await cp(built.outputDir, moved, { recursive: true });
    await rm(built.outputDir, { recursive: true });
    const inventory = await verifyAgentHandoff(moved);
    for (const file of [...built.brief.sources.map(s => s.path), ...built.brief.evidence.map(e => e.sourcePath)]) assert.ok(inventory.files[file]);
    assert.ok(!inventory.files['manifest.json'] && !inventory.files['metadata.json'] && !inventory.files['tokens.css']);
    const cli = spawnSync(process.execPath, ['bin/brand-handoff.js', '--verify', moved], { encoding: 'utf8' });
    assert.equal(cli.status, 0, cli.stderr);
    await writeFile(path.join(moved, asset.path), 'changed bytes');
    await assert.rejects(() => verifyAgentHandoff(moved), /bytes changed/);
  } finally { await rm(moved, { recursive: true, force: true }); await rm(fixture.root, { recursive: true, force: true }); }
});

test('pending exports remain exploration only; stale inputs preserve the previous export', async () => {
  const fixture = await briefFixture();
  try {
    const { context } = await prepareBrief(fixture.root);
    await importDirections(fixture.root, { directions: fixtureDirections(context) });
    const built = await exportAgentHandoff(fixture.root);
    const inventory = await verifyAgentHandoff(built.outputDir);
    assert.equal(inventory.mode, 'exploration-only');
    assert.equal(built.brief.selectedDirection, null);
    assert.match(await readFile(path.join(built.outputDir, 'START.md'), 'utf8'), /Do not execute or publish/);
    const prior = await readFile(path.join(built.outputDir, 'handoff.json'));
    fixture.request.constraints.push('Changed constraint');
    await writeFile(path.join(fixture.root, 'design-request.json'), JSON.stringify(fixture.request));
    await assert.rejects(() => exportAgentHandoff(fixture.root), /stale/);
    assert.deepEqual(await readFile(path.join(built.outputDir, 'handoff.json')), prior);
    await mkdir(path.join(built.outputDir, 'source'));
    await writeFile(path.join(built.outputDir, 'source/package-context.json'), '{}');
    await assert.rejects(() => verifyAgentHandoff(built.outputDir), /inventory changed/);
  } finally { await rm(fixture.root, { recursive: true, force: true }); }
});
