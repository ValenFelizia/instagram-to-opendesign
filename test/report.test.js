import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { prepareAnalysis } from '../src/analyze.js';
import { colorInputFingerprint } from '../src/colors.js';
import { ANALYSIS_TOPICS } from '../src/providers/openai.js';
import { buildBrandReport } from '../src/report.js';
import { requestReportTranslation } from '../src/providers/openai-report-translation.js';
import { validateReportTranslation } from '../src/report-translation.js';

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
    const result = await buildBrandReport(dir, { translationProvider: async () => {
      throw new Error('Spanish generation must not request translation.');
    } });
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

const englishTranslation = async (entries) => ({ translations: entries.map(({ key }) => ({ key,
  text: key === 'profile.biography' ? 'Handmade weaving.' : key.endsWith('.value')
    ? 'Fuchsia is visible in the mark.' : key.endsWith('.rationale')
      ? 'Provisional interpretation; human review is still needed.' : 'Translated source summary.',
})), usage: { input_tokens: 20, output_tokens: 30 } });

test('English translates prose, retains original sources and reuses a cache without altering Spanish analysis', async () => {
  const { dir, analysis, prepared } = await fixture();
  try {
    const candidates = {
      primary: { hex: '#df1584', evidenceIds: [prepared.images[0].evidenceId], rationale: 'Color provisional del logo.' },
      secondary: { hex: null, evidenceIds: [], rationale: 'Sin evidencia suficiente.' },
    };
    await writeFile(path.join(dir, 'color-proposals.json'), JSON.stringify({ schemaVersion: 'color-proposals/v1',
      inputHash: await colorInputFingerprint(analysis, [prepared.images[0]]), candidates }));
    const originalAnalysis = await readFile(path.join(dir, 'brand-analysis.json'), 'utf8');
    const spanish = await buildBrandReport(dir);
    const originalHtml = await readFile(spanish.outputPath, 'utf8');
    let calls = 0;
    const translationProvider = async (entries) => {
      calls++;
      assert.ok(entries.every((entry) => Object.keys(entry).sort().join(',') === 'key,text'));
      return englishTranslation(entries);
    };
    const first = await buildBrandReport(dir, { language: 'en', translationProvider });
    const html = await readFile(first.outputPath, 'utf8');
    assert.equal(path.basename(first.outputPath), 'brand-report.en.html');
    assert.match(html, /<html lang="en">/);
    assert.match(html, /What we observed/);
    assert.match(html, /Handmade weaving\./);
    assert.match(html, /Fuchsia is visible in the mark\./);
    assert.match(html, /Review needed/);
    assert.match(html, /Confidence medium/);
    assert.match(html, /#df1584/);
    assert.match(html, /No proposal/);
    assert.match(html, new RegExp(`href="#evidence-${prepared.images[0].evidenceId}"`));
    assert.match(html, /Original source text/);
    assert.match(html, /Hecho a mano &amp; con calma/);
    assert.doesNotMatch(html, /PRIVATE_PARTNER_TEXT|PRIVATE_PARTNER_NOTE/);
    assert.equal(await readFile(spanish.outputPath, 'utf8'), originalHtml);
    assert.equal(await readFile(path.join(dir, 'brand-analysis.json'), 'utf8'), originalAnalysis);
    assert.equal(first.translationReused, false);
    const second = await buildBrandReport(dir, { language: 'en', translationProvider, token: undefined });
    assert.equal(second.translationReused, true);
    assert.equal(calls, 1);
    analysis.inferences[1].rationale = 'Updated uncertain source interpretation.';
    await writeFile(path.join(dir, 'brand-analysis.json'), JSON.stringify(analysis));
    await buildBrandReport(dir, { language: 'en', translationProvider });
    assert.equal(calls, 2);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('missing or invented translation keys cannot replace previous English HTML or cache', async () => {
  const { dir } = await fixture();
  try {
    const htmlPath = path.join(dir, 'brand-report.en.html');
    const cachePath = path.join(dir, 'report-translation.en.json');
    await writeFile(htmlPath, 'previous English report');
    await writeFile(cachePath, '{"inputHash":"old"}');
    for (const mutate of [
      (rows) => rows.slice(1),
      (rows) => [{ ...rows[0], key: 'invented-source' }, ...rows.slice(1)],
      (rows) => [{ ...rows[0], status: 'verified' }, ...rows.slice(1)],
    ]) {
      await assert.rejects(() => buildBrandReport(dir, { language: 'en', translationProvider: async (entries) => {
        const result = await englishTranslation(entries);
        return { translations: mutate(result.translations) };
      } }), /Report translation/);
      assert.equal(await readFile(htmlPath, 'utf8'), 'previous English report');
      assert.equal(await readFile(cachePath, 'utf8'), '{"inputHash":"old"}');
    }
    await assert.rejects(() => buildBrandReport(dir, { language: 'fr' }), /language must be es or en/);
    await assert.rejects(() => buildBrandReport(dir, { language: 'en', translationProvider: async () => {
      throw new Error('OpenAI refused the report translation request.');
    } }), /refused/);
    assert.equal(await readFile(htmlPath, 'utf8'), 'previous English report');
    assert.equal(await readFile(cachePath, 'utf8'), '{"inputHash":"old"}');
    assert.throws(() => validateReportTranslation([{ key: 'A', text: 'A' }, { key: 'A', text: 'B' }],
      [{ key: 'A', text: 'A' }, { key: 'B', text: 'B' }]), /duplicate/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('translation provider uses one text-only structured request and rejects incomplete or refused responses', async () => {
  const entries = [{ key: 'I-EXAMPLE.value', text: 'Una interpretación tentativa.' }];
  let calls = 0;
  const result = await requestReportTranslation(entries, { token: 'synthetic-key', fetchImpl: async (url, options) => {
    calls++;
    assert.equal(url, 'https://api.openai.com/v1/responses');
    const body = JSON.parse(options.body);
    assert.equal(body.store, false);
    assert.equal(body.text.format.strict, true);
    assert.equal(body.model, 'gpt-6-luna');
    assert.deepEqual(JSON.parse(body.input[1].content), entries);
    assert.doesNotMatch(options.body, /input_image|image_url/);
    return Response.json({ status: 'completed', output: [{ type: 'message', content: [{
      type: 'output_text', text: JSON.stringify({ translations: [{ key: entries[0].key, text: 'A tentative interpretation.' }] }),
    }] }] });
  } });
  assert.equal(calls, 1);
  assert.equal(result.translations[0].text, 'A tentative interpretation.');
  for (const response of [
    { status: 'incomplete', output: [] },
    { status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal' }] }] },
  ]) await assert.rejects(() => requestReportTranslation(entries, { token: 'synthetic-key',
    fetchImpl: async () => Response.json(response) }), /incomplete|refused/);
});

test('both CLIs reject unsupported or missing language arguments before reading data or calling providers', async () => {
  const run = promisify(execFile);
  for (const binary of ['brand-report.js', 'brand-instagram.js']) {
    for (const flags of [['--lang', 'fr'], ['--lang']]) {
      await assert.rejects(() => run(process.execPath, [fileURLToPath(new URL(`../bin/${binary}`, import.meta.url)),
        'nonexistent-profile', ...flags]), (error) => error.code === 1 && /Usage:/.test(error.stderr));
    }
  }
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
