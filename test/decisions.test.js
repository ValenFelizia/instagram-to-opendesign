import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { emptyDecisions, loadDecisions } from '../src/decisions.js';
import { digest } from '../src/local.js';
import { compilePackage } from '../src/package.js';
import { buildBrandReport } from '../src/report.js';
import { profileFixture } from './helpers/profile.js';

async function approved(fixture) {
  const document = await emptyDecisions(fixture.prepared, fixture.analysis);
  const text = 'Synthetic owner confirms green UI accent and Arial. Font licence: system font.';
  await writeFile(path.join(fixture.root, 'manual/brand.md'), text);
  document.sources.push({ id: 'S-OWNER', path: 'manual/brand.md', sha256: digest(text),
    reviewer: 'Synthetic owner', reviewedAt: '2026-01-02T00:00:00Z', summary: 'Verified brand rules' });
  document.rules.push({ id: 'R-ACCENT', kind: 'token', target: 'accent', value: '#315a46', sourceId: 'S-OWNER' },
    { id: 'R-FONT', kind: 'font', target: 'font-body', value: 'Arial, sans-serif', sourceId: 'S-OWNER' });
  await writeFile(path.join(fixture.root, 'brand-decisions.json'), JSON.stringify(document));
  return document;
}

test('confirmed rules survive compilation, preserve model output and cite packaged sources', async () => {
  const fixture = await profileFixture();
  try {
    await approved(fixture);
    const prior = await readFile(path.join(fixture.root, 'brand-analysis.json'), 'utf8');
    const result = await compilePackage(fixture.prepared, fixture.analysis, fixture.colors, { outputRoot: path.join(fixture.root, 'output') });
    assert.match(await readFile(path.join(result.outputDir, 'tokens.css'), 'utf8'), /--accent: #315a46/);
    const design = await readFile(path.join(result.outputDir, 'DESIGN.md'), 'utf8');
    assert.match(design, /Pink graphic/); assert.match(design, /confirmed.*315a46/);
    assert.match(design, /source\/manual\/S-OWNER.md/);
    assert.equal(await readFile(path.join(fixture.root, 'brand-analysis.json'), 'utf8'), prior);
    const origins = JSON.parse(await readFile(path.join(result.outputDir, 'source/token-origins.json'), 'utf8'));
    assert.equal(origins.length, 56);
    assert.equal(origins.find((item) => item.name === 'accent').origin, 'confirmed human rule');
    await buildBrandReport(fixture.root);
    assert.match(await readFile(path.join(fixture.root, 'brand-report.html'), 'utf8'), /Confirmada.*accent/);
  } finally { await rm(fixture.root, { recursive: true, force: true }); }
});

test('acceptance is not verification; rejection and changed evidence require review', async () => {
  const fixture = await profileFixture();
  try {
    const document = await approved(fixture);
    Object.assign(document.inferenceDecisions[0], { action: 'accept-proposal', reviewer: 'Owner',
      reviewedAt: '2026-01-02T00:00:00Z', note: 'Useful candidate.' });
    await writeFile(path.join(fixture.root, 'brand-decisions.json'), JSON.stringify(document));
    let review = await loadDecisions(fixture.prepared, fixture.analysis);
    assert.equal(review.effectiveAnalysis.inferences[0].status, 'inferred');
    document.inferenceDecisions[0].action = 'reject';
    await writeFile(path.join(fixture.root, 'brand-decisions.json'), JSON.stringify(document));
    review = await loadDecisions(fixture.prepared, fixture.analysis);
    assert.equal(review.effectiveAnalysis.inferences[0].value, null);
    fixture.analysis.inferences[0].value = 'Changed candidate';
    review = await loadDecisions(fixture.prepared, fixture.analysis);
    assert.equal(review.decisions[0].stale, true);
    await writeFile(path.join(fixture.root, 'manual/brand.md'), 'Owner changed these rules');
    review = await loadDecisions(fixture.prepared, fixture.analysis);
    assert.equal(review.activeRules.length, 0); assert.equal(review.staleRules.length, 2);
  } finally { await rm(fixture.root, { recursive: true, force: true }); }
});

test('invalid decisions do not replace the previous package or report', async () => {
  const fixture = await profileFixture();
  try {
    const document = await approved(fixture);
    const options = { outputRoot: path.join(fixture.root, 'output') };
    const result = await compilePackage(fixture.prepared, fixture.analysis, fixture.colors, options);
    const previous = await readFile(path.join(result.outputDir, 'tokens.css'), 'utf8');
    await buildBrandReport(fixture.root);
    const previousHtml = await readFile(path.join(fixture.root, 'brand-report.html'), 'utf8');
    document.rules[0].sourceId = 'S-MISSING';
    await writeFile(path.join(fixture.root, 'brand-decisions.json'), JSON.stringify(document));
    await assert.rejects(() => compilePackage(fixture.prepared, fixture.analysis, fixture.colors, options), /Unknown decision source/);
    await assert.rejects(() => buildBrandReport(fixture.root), /Unknown decision source/);
    assert.equal(await readFile(path.join(result.outputDir, 'tokens.css'), 'utf8'), previous);
    assert.equal(await readFile(path.join(fixture.root, 'brand-report.html'), 'utf8'), previousHtml);
    document.rules[0].sourceId = 'S-OWNER'; document.rules[0].value = '#fff; } body { display:none';
    await writeFile(path.join(fixture.root, 'brand-decisions.json'), JSON.stringify(document));
    await assert.rejects(() => loadDecisions(fixture.prepared, fixture.analysis), /Unsafe token/);
  } finally { await rm(fixture.root, { recursive: true, force: true }); }
});
