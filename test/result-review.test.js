import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { briefFixture, fixtureDirections } from './helpers/brief.js';
import { compileBrief, importDirections, prepareBrief } from '../src/brief.js';
import { compileExisting } from '../src/pipeline.js';
import { reviewResult, compareReviews } from '../src/result-review.js';
import { digest } from '../src/local.js';
import sharp from 'sharp';
import { createRunRecord } from '../src/run-record.js';

test('rendered checks detect hidden CTA, copy/asset mismatch and contrast; archives keep revisions and human preferences separate', async () => {
  const fixture = await briefFixture(), archive = `${fixture.root}-results`;
  try {
    fixture.request.selectedDirectionId = 'D-1';
    await writeFile(path.join(fixture.root, 'design-request.json'), JSON.stringify(fixture.request));
    const { context } = await prepareBrief(fixture.root);
    await importDirections(fixture.root, { directions: fixtureDirections(context) });
    const built = await compileBrief(fixture.root), pkg = await compileExisting(fixture.root, { outputRoot: path.join(fixture.root, 'package') });
    const artifacts = path.join(fixture.root, 'render'); await mkdir(artifacts);
    const html = '<!doctype html><title>Synthetic result fixture</title>'; await writeFile(path.join(artifacts, 'index.html'), html);
    await writeFile(path.join(artifacts, 'wrong.jpg'), 'different bytes');
    await writeFile(path.join(artifacts, 'feedback.md'), 'Synthetic reviewer prefers more space; not a universal brand rule.');
    const rect = { x: 10, y: 10, width: 100, height: 50 };
    const observed = { schemaVersion: 'render-observations/v1', viewport: { width: 390, height: 844 }, overflow: false,
      visibleText: 'Wrong headline A synthetic product for a test. Example Studio',
      copy: fixture.request.copy.map((item) => ({ id: item.id, text: item.id === 'headline' ? 'Wrong headline' : item.text, visible: true,
        rect, foreground: '#ffffff', background: '#ffffff', fontSize: 16, fontWeight: 400 })),
      assets: [{ id: built.brief.assets[0].id, src: 'wrong.jpg', visible: true, rect, fit: 'cover', alt: 'Wrong description' }],
      action: { tag: 'a', label: 'Explore', href: 'https://example.com/', visible: true, occluded: true, rect } };
    await writeFile(path.join(artifacts, 'observed.json'), JSON.stringify(observed));
    const input = { schemaVersion: 'result-review-input/v1', experimentId: 'unknown-brand-web', variant: 'tool', revision: 0,
      artifactRoot: artifacts, packageDir: pkg.outputDir, commonInputs: { root: fixture.root, files: ['manual/request.md', 'assets/product.jpg'] },
      run: { model: 'synthetic-model', openDesignVersion: '0.23.1', priorKnowledge: 'none', iterationBudget: 2 },
      artifacts: [{ id: 'first', kind: 'html', path: 'index.html' },
        { id: 'mobile', kind: 'observations', path: 'observed.json', htmlId: 'first', htmlSha256: digest(html) },
        { id: 'feedback', kind: 'feedback', path: 'feedback.md' }],
      feedback: [{ sourceArtifactId: 'feedback', reviewer: 'Synthetic reviewer', note: 'Prefer more space.', cause: 'unknown', referenceIds: ['headline'] }],
      events: [{ id: 'p1', type: 'prompt', description: 'Synthetic initial prompt', minutes: 1, cost: null }] };
    const first = await reviewResult(built.outputDir, input, { outputRoot: archive });
    for (const id of ['mobile-copy-headline', `mobile-asset-${built.brief.assets[0].id}`, 'mobile-contrast-headline', 'mobile-action']) assert.equal(first.report.checks.find((check) => check.id === id).status, 'fail');
    assert.equal(first.report.metrics.complete, false); assert.equal(first.report.conclusion, 'insufficient-evidence');
    assert.equal(first.report.corrections.at(-1).scope, 'request'); assert.equal(first.report.corrections.at(-1).origin, 'human-judgment');
    await assert.rejects(() => reviewResult(built.outputDir, input, { outputRoot: archive }), /already exists/);
    await writeFile(path.join(artifacts, 'index.html'), html + '<p>Revision</p>');
    const next = structuredClone(input); next.revision = 1; next.events = [{ id: 'p2', type: 'manual-edit', description: 'Synthetic correction', minutes: 4, cost: 0 }];
    next.artifacts[1].htmlSha256 = digest(html + '<p>Revision</p>');
    const second = await reviewResult(built.outputDir, next, { outputRoot: archive });
    assert.equal(second.report.events.length, 2); assert.equal(second.report.firstOutput, '../r000');
    assert.equal(await readFile(path.join(first.outputDir, 'artifacts/index.html'), 'utf8'), html);
    const mismatched = structuredClone(first.report); mismatched.variant = 'manual'; mismatched.run.priorKnowledge = 'deep';
    assert.equal(compareReviews(mismatched, second.report).matched, false);
    const screenshotOnly = structuredClone(input); screenshotOnly.experimentId = 'screenshot-only';
    await copyFile(path.join(fixture.root, 'assets/product.jpg'), path.join(artifacts, 'screenshot.jpg'));
    screenshotOnly.artifacts = [{ id: 'image', kind: 'screenshot', path: 'screenshot.jpg' }]; screenshotOnly.feedback = [];
    const pending = await reviewResult(built.outputDir, screenshotOnly, { outputRoot: archive });
    assert.equal(pending.report.checks.find((check) => check.id === 'observability').status, 'manual-review');
    assert.equal(pending.report.status, 'needs-human-review');
  } finally { await rm(archive, { recursive: true, force: true }); await rm(fixture.root, { recursive: true, force: true }); }
});

test('Story review checks actual export dimensions and reserved sticker overlap without certifying an inaccessible screenshot', async () => {
  const fixture = await briefFixture('instagram-story'), archive = `${fixture.root}-results`;
  try {
    fixture.request.selectedDirectionId = 'D-1';
    await writeFile(path.join(fixture.root, 'design-request.json'), JSON.stringify(fixture.request));
    const { context } = await prepareBrief(fixture.root);
    await importDirections(fixture.root, { directions: fixtureDirections(context) });
    const built = await compileBrief(fixture.root);
    const artifacts = path.join(fixture.root, 'render'); await mkdir(artifacts);
    const html = '<!doctype html><title>Synthetic Story</title>'; await writeFile(path.join(artifacts, 'index.html'), html);
    await sharp({ create: { width: 1080, height: 1920, channels: 3, background: '#ffffff' } }).png().toFile(path.join(artifacts, 'story.png'));
    const observed = { schemaVersion: 'render-observations/v1', viewport: { width: 1080, height: 1920 }, visibleText: fixture.request.copy.map((item) => item.text).join(' '), overflow: false,
      copy: fixture.request.copy.map((item) => ({ id: item.id, text: item.text, visible: true, rect: { x: 200, y: 1600, width: 300, height: 100 },
        foreground: '#171717', background: null, fontSize: 40, fontWeight: 400 })), assets: [], action: null };
    await writeFile(path.join(artifacts, 'observed.json'), JSON.stringify(observed));
    const input = { schemaVersion: 'result-review-input/v1', experimentId: 'unfamiliar-story', variant: 'manual', revision: 0, artifactRoot: artifacts,
      commonInputs: { root: fixture.root, files: ['assets/product.jpg'] }, run: { model: 'synthetic', openDesignVersion: '0.23.1', priorKnowledge: 'none', iterationBudget: 2 },
      artifacts: [{ id: 'first', kind: 'html', path: 'index.html' }, { id: 'export', kind: 'screenshot', path: 'story.png' },
        { id: 'portrait', kind: 'observations', path: 'observed.json', htmlId: 'first', htmlSha256: digest(html) }], events: [] };
    const builtReview = await reviewResult(built.outputDir, input, { outputRoot: archive });
    assert.equal(builtReview.report.checks.find((check) => check.id === 'export-export-dimensions').status, 'pass');
    assert.equal(builtReview.report.checks.find((check) => check.id === 'portrait-sticker-headline').status, 'fail');
    assert.equal(builtReview.report.checks.find((check) => check.id === 'portrait-contrast-headline').status, 'manual-review');
    assert.equal(builtReview.report.metrics.complete, false);
  } finally { await rm(archive, { recursive: true, force: true }); await rm(fixture.root, { recursive: true, force: true }); }
});


test('result review imports observed billing once across revisions and retains the run source', async () => {
  const fixture = await briefFixture(), archive = `${fixture.root}-results`;
  try {
    fixture.request.selectedDirectionId = 'D-1';
    await writeFile(path.join(fixture.root, 'design-request.json'), JSON.stringify(fixture.request));
    const { context } = await prepareBrief(fixture.root);
    await importDirections(fixture.root, { directions: fixtureDirections(context) });
    const built = await compileBrief(fixture.root);
    const artifacts = path.join(fixture.root, 'render'); await mkdir(artifacts);
    await writeFile(path.join(artifacts, 'index.html'), '<!doctype html><title>Example</title>');
    const journal = await createRunRecord(fixture.root, { refresh: false, reanalyze: false, postLimit: 20 });
    await journal.phase('ingestion', async ({ observe }) => {
      await observe({ event: 'start', key: 'details', provider: 'synthetic' });
      await observe({ event: 'end', key: 'details', status: 'completed', billing: { amount: 0.12, currency: 'USD', source: 'Synthetic returned bill' } });
    });
    await journal.finish('complete');
    const input = { schemaVersion: 'result-review-input/v1', experimentId: 'run-import', variant: 'manual', revision: 0,
      artifactRoot: artifacts, commonInputs: { root: fixture.root, files: ['assets/product.jpg'] },
      run: { model: 'synthetic', openDesignVersion: 'test', priorKnowledge: 'none', iterationBudget: 2 },
      artifacts: [{ id: 'first', kind: 'html', path: 'index.html' }], events: [], currency: 'USD',
      runRecords: [journal.outputPath, journal.outputPath] };
    const first = await reviewResult(built.outputDir, input, { outputRoot: archive });
    const second = await reviewResult(built.outputDir, { ...input, revision: 1 }, { outputRoot: archive });
    assert.equal(first.report.events.length, 1); assert.equal(second.report.events.length, 1);
    assert.equal(second.report.metrics.suppliedCost, 0.12);
    assert.equal(second.report.metrics.suppliedMinutes, 0);
    assert.equal(second.report.metrics.complete, false);
    assert.equal(second.report.events[0].minutes, null);
    assert.equal(await readFile(path.join(first.outputDir, 'runs', `${journal.record.id}.json`), 'utf8'), await readFile(journal.outputPath, 'utf8'));
    journal.record.phases[0].attempts[0].billing.amount = 1;
    await journal.finish('complete');
    await assert.rejects(() => reviewResult(built.outputDir, { ...input, revision: 2 }, { outputRoot: archive }), /Conflicting imported/);
    await assert.rejects(() => reviewResult(built.outputDir, { ...input, experimentId: 'currency', currency: 'EUR' }, { outputRoot: archive }), /currency must match/);
  } finally { await rm(archive, { recursive: true, force: true }); await rm(fixture.root, { recursive: true, force: true }); }
});
