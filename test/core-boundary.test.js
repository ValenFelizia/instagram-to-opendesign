import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { briefFixture, fixtureDirections } from './helpers/brief.js';
import { compileBrief, importDirections, prepareBrief, validateRequest, loadDecisions } from '../src/core.js';
import { compilePackage } from '../src/package.js';
import { digest } from '../src/local.js';

test('core custom tokens compile a ready portable brief; OpenDesign rejects unmapped rules before replacement', async () => {
  const fixture = await briefFixture('instagram-story');
  try {
    const packageOptions = { outputRoot: path.join(fixture.root, 'package') };
    const previous = await compilePackage(fixture.prepared, fixture.analysis, fixture.colors, packageOptions);
    const previousTokens = await readFile(path.join(previous.outputDir, 'tokens.css'), 'utf8');
    fixture.decisions.rules.push(
      { id: 'R-CRAFT-INK', kind: 'token', target: 'craft-ink', value: '#242424', sourceId: 'S-REQUEST' },
      { id: 'R-CRAFT-PAPER', kind: 'token', target: 'craft-paper', value: '#ffffff', sourceId: 'S-REQUEST' });
    await writeFile(path.join(fixture.root, 'brand-decisions.json'), JSON.stringify(fixture.decisions));
    fixture.request.selectedDirectionId = 'D-1';
    fixture.request.accessibility = { motion: false, pairs: [{ id: 'headline-ink', usage: 'normal-text', foreground: 'var(--craft-ink)', background: 'var(--craft-paper)' }] };
    await writeFile(path.join(fixture.root, 'design-request.json'), JSON.stringify(fixture.request));
    const review = await loadDecisions(fixture.prepared, fixture.analysis);
    assert.equal(review.tokenOverrides['craft-ink'], '#242424');
    const { context } = await prepareBrief(fixture.root);
    await importDirections(fixture.root, { directions: fixtureDirections(context) });
    const built = await compileBrief(fixture.root);
    assert.equal(built.brief.status, 'ready-for-execution');
    assert.equal(built.brief.accessibility.checks.find(check => check.id === 'headline-ink').status, 'pass');
    assert.ok(built.brief.verifiedRules.some(rule => rule.target === 'craft-paper'));
    const files = await readdir(built.outputDir);
    assert.ok(!files.includes('manifest.json') && !files.includes('metadata.json') && !files.includes('tokens.css'));
    await assert.rejects(() => compilePackage(fixture.prepared, fixture.analysis, fixture.colors, packageOptions), /OpenDesign has no token mapping for: craft-ink/);
    assert.equal(await readFile(path.join(previous.outputDir, 'tokens.css'), 'utf8'), previousTokens);
    // Known adapter slots must not silently alias an unmapped core token either.
    fixture.decisions.rules = [{ id: 'R-ACCENT', kind: 'token', target: 'accent', value: 'var(--craft-ink)', sourceId: 'S-REQUEST' }];
    await writeFile(path.join(fixture.root, 'brand-decisions.json'), JSON.stringify(fixture.decisions));
    await assert.rejects(() => compilePackage(fixture.prepared, fixture.analysis, fixture.colors, packageOptions), /Unknown OpenDesign token alias: craft-ink/);
    assert.equal(await readFile(path.join(previous.outputDir, 'tokens.css'), 'utf8'), previousTokens);
  } finally { await rm(fixture.root, { recursive: true, force: true }); }
});

test('public synthetic core brief has a complete request and safe byte-verified local assets/sources without an OpenDesign package', async () => {
  const root = path.resolve('examples/consumer-neutral-brief');
  const brief = JSON.parse(await readFile(path.join(root, 'design-brief.json'), 'utf8'));
  validateRequest(brief.request, 'example_studio');
  assert.equal(brief.status, 'ready-for-execution');
  assert.equal(brief.selectedDirection.id, brief.request.selectedDirectionId);
  assert.equal(brief.directions.length, 3);
  assert.ok(brief.verifiedRules.some(rule => rule.target === 'craft-ink'));
  for (const [relative, hash] of [
    ...brief.assets.map(asset => [asset.path, asset.sha256]),
    ...brief.sources.map(source => [source.path, source.sha256]),
  ]) {
    assert.ok(!relative.split('/').includes('..'));
    assert.equal(digest(await readFile(path.join(root, relative))), hash);
  }
  for (const evidence of brief.evidence) await readFile(path.join(root, evidence.sourcePath));
  const files = await readdir(root);
  assert.ok(!files.includes('manifest.json') && !files.includes('metadata.json') && !files.includes('tokens.css'));
  assert.ok(!('id' in brief) && !('catalogStatus' in brief) && !('tokenSlots' in brief));
});
