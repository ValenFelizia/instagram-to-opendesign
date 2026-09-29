import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import sharp from 'sharp';
import { prepareAnalysis } from '../src/analyze.js';
import { colorInputFingerprint } from '../src/colors.js';
import { ANALYSIS_TOPICS } from '../src/providers/openai.js';
import { buildBrandReport } from '../src/report.js';

async function fixture() {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'brand-report-test-'));
  await mkdir(path.join(dir, 'assets'));
  await mkdir(path.join(dir, 'evidence'));
  const profileUrl = 'https://www.instagram.com/example_studio/';
  const source = { schemaVersion: 'instagram-source/v1', source: { profileUrl },
    profile: { username: 'example_studio', fullName: 'Example <Studio>', biography: 'Tejido <script>alert(1)</script>' },
    posts: [
      { id: 'OWN', ownerUsername: 'example_studio', caption: 'Hecho a mano & con calma', media: [] },
      { id: 'OTHER', ownerUsername: 'collaborator', caption: 'PRIVATE_PARTNER_TEXT', media: [] },
    ] };
  const images = [
    { id: 'profile/avatar', postId: null, assetPath: 'assets/avatar.jpg' },
    { id: 'OWN/media-1', postId: 'OWN', assetPath: 'assets/own.jpg' },
    { id: 'OTHER/media-1', postId: 'OTHER', assetPath: 'assets/other.jpg' },
  ];
  const index = { schemaVersion: 'evidence/v1', sourceProfile: profileUrl,
    selectedImageIds: images.map((image) => image.id), images };
  const reviews = {
    'profile/avatar': { classification: 'brand-graphic', notes: 'Logo propio' },
    'OWN/media-1': { classification: 'product-photo', notes: 'Bolso propio' },
    'OTHER/media-1': { classification: 'mixed', notes: 'PRIVATE_PARTNER_NOTE' },
  };
  await writeFile(path.join(dir, 'instagram-source.json'), JSON.stringify(source));
  await writeFile(path.join(dir, 'evidence/evidence.json'), JSON.stringify(index));
  await writeFile(path.join(dir, 'evidence/review.json'), JSON.stringify(reviews));
  await writeFile(path.join(dir, 'evidence/captions.md'), 'Synthetic captions');
  for (const image of images) await sharp({ create: { width: 30, height: 30,
    channels: 3, background: '#df1584' } }).jpeg().toFile(path.join(dir, image.assetPath));
  const prepared = await prepareAnalysis(dir);
  const inferences = ANALYSIS_TOPICS.map((topic) => ({ id: `I-${topic.replaceAll('.', '-').toUpperCase()}`,
    topic, value: null, confidence: null, evidenceIds: [], rationale: 'Sin evidencia suficiente.',
    status: 'needs-review' }));
  inferences[0] = { ...inferences[0], value: 'Fucsia <b>visible</b>', confidence: 'medium',
    evidenceIds: [prepared.images[0].evidenceId], rationale: 'Se ve en el logo.', status: 'inferred' };
  const analysis = { schemaVersion: 'instagram-to-opendesign-brand-analysis/v1',
    subject: { displayName: source.profile.fullName, sourcePlatform: 'instagram', profileUrl },
    generatedAt: '2026-01-01T00:00:00Z', evidence: prepared.evidence, inferences };
  await writeFile(path.join(dir, 'brand-analysis.json'), JSON.stringify(analysis));
  return { dir, prepared, analysis };
}

test('report is portable, escapes profile text and excludes collaborator content', async () => {
  const { dir, prepared } = await fixture();
  try {
    const result = await buildBrandReport(dir);
    const html = await readFile(result.outputPath, 'utf8');
    assert.match(html, /<!doctype html>/);
    assert.match(html, /<html lang="es">/);
    assert.match(html, /data:image\/jpeg;base64,/);
    assert.match(html, /Example &lt;Studio&gt;/);
    assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
    assert.match(html, /Fucsia &lt;b&gt;visible&lt;\/b&gt;/);
    assert.doesNotMatch(html, /PRIVATE_PARTNER_TEXT|PRIVATE_PARTNER_NOTE/);
    assert.match(html, new RegExp(`href="#evidence-${prepared.images[0].evidenceId}"`));
    assert.equal(result.images, 2);
    assert.equal(result.captions, 1);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('report uses only current, cited color proposals', async () => {
  const { dir, prepared, analysis } = await fixture();
  try {
    const colorsPath = path.join(dir, 'color-proposals.json');
    const candidates = { primary: { hex: '#df1584', evidenceIds: [prepared.images[0].evidenceId],
      rationale: 'Color del logo.' }, secondary: { hex: null, evidenceIds: [], rationale: 'Sin base.' } };
    await writeFile(colorsPath, JSON.stringify({ schemaVersion: 'color-proposals/v1',
      inputHash: await colorInputFingerprint(analysis, [prepared.images[0]]), candidates }));
    await buildBrandReport(dir);
    let html = await readFile(path.join(dir, 'brand-report.html'), 'utf8');
    assert.match(html, /#df1584/);
    await writeFile(colorsPath, JSON.stringify({ schemaVersion: 'color-proposals/v1',
      inputHash: 'old-input', candidates }));
    await buildBrandReport(dir);
    html = await readFile(path.join(dir, 'brand-report.html'), 'utf8');
    assert.doesNotMatch(html, /#df1584/);
    assert.match(html, /Sin propuesta/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('invalid analysis leaves the previous HTML untouched', async () => {
  const { dir, analysis } = await fixture();
  try {
    const outputPath = path.join(dir, 'brand-report.html');
    await writeFile(outputPath, 'prior report');
    analysis.inferences[0].evidenceIds = ['E-FAKE'];
    await writeFile(path.join(dir, 'brand-analysis.json'), JSON.stringify(analysis));
    await assert.rejects(() => buildBrandReport(dir), /Unknown evidence ID/);
    assert.equal(await readFile(outputPath, 'utf8'), 'prior report');
  } finally { await rm(dir, { recursive: true, force: true }); }
});
