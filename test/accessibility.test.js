import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { accessibilityPreflight, contrastRatio, tokenMap } from '../src/accessibility.js';
import { briefFixture, fixtureDirections } from './helpers/brief.js';
import { compileBrief, importDirections, prepareBrief } from '../src/brief.js';

test('declared contrast uses raw ratios and aliases; unresolved colors and photo backgrounds remain manual', () => {
  const tokens = tokenMap(':root { --ink: #777777; --alias: var(--ink); --bg: #ffffff; --cycle: var(--cycle); }');
  const pairs = [
    { id: 'body', usage: 'normal-text', foreground: 'var(--alias)', background: 'var(--bg)' },
    { id: 'large', usage: 'large-text', foreground: 'var(--alias)', background: '#ffffff' },
    { id: 'control', usage: 'control', foreground: '#ffffff', background: '#ffffff' },
    { id: 'photo', usage: 'normal-text', foreground: '#ffffff', background: 'photo:A-1' },
    { id: 'alias', usage: 'normal-text', foreground: 'var(--cycle)', background: 'var(--missing)' },
  ];
  const result = accessibilityPreflight({ tokens, plan: { pairs, motion: true } });
  assert.equal(result.status, 'fail');
  assert.deepEqual(result.checks.slice(0, 5).map((check) => check.status), ['fail', 'pass', 'fail', 'manual-review', 'manual-review']);
  assert.equal(result.checks[0].ratio, contrastRatio('#777777', '#ffffff'));
  assert.ok(result.checks[0].alternatives.includes('#171717')); assert.equal(tokens.ink, '#777777');
  assert.ok(result.checks.some((check) => check.id === 'motion'));
  assert.equal(accessibilityPreflight().checks[0].status, 'manual-review');
});
test('brief carries accessibility failures and manual review without silently changing confirmed colors', async () => {
  const fixture = await briefFixture();
  try {
    fixture.request.accessibility = { pairs: [{ id: 'body', usage: 'normal-text', foreground: '#ffffff', background: '#ffffff' }], motion: false };
    fixture.request.selectedDirectionId = 'D-1';
    await writeFile(path.join(fixture.root, 'design-request.json'), JSON.stringify(fixture.request));
    const state = await prepareBrief(fixture.root);
    await importDirections(fixture.root, { directions: fixtureDirections(state.context) });
    const built = await compileBrief(fixture.root);
    assert.equal(built.brief.status, 'needs-review'); assert.equal(built.brief.accessibility.status, 'fail');
    assert.ok(built.brief.pending.some((item) => item.includes('Accessibility failure body')));
    assert.ok(built.brief.accessibility.checks.some((item) => item.id === 'semantics' && item.status === 'manual-review'));
    assert.match(await readFile(path.join(built.outputDir, 'ACCESSIBILITY.md'), 'utf8'), /accesibilidad/);
  } finally { await rm(fixture.root, { recursive: true, force: true }); }
});
