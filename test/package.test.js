import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import sharp from 'sharp';
import { ANALYSIS_TOPICS } from '../src/providers/openai.js';
import { requestColorCandidates } from '../src/providers/openai-colors.js';
import { compileExisting, runPipeline } from '../src/pipeline.js';

const unknown = () => ANALYSIS_TOPICS.map((topic) => ({
  topic, value: null, confidence: null, evidenceIds: [],
  rationale: 'No hay evidencia suficiente.', status: 'needs-review',
}));

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'brand-package-test-'));
  const dataRoot = path.join(root, 'data');
  const profileDir = path.join(dataRoot, 'example_studio');
  const outputRoot = path.join(root, 'brand-output');
  await mkdir(path.join(profileDir, 'assets'), { recursive: true });
  await mkdir(path.join(profileDir, 'evidence'));
  const asset = (id, file) => ({ id, kind: 'image', remoteUrl: `https://www.instagram.com/${id}/`, assetPath: `assets/${file}` });
  const source = {
    schemaVersion: 'instagram-source/v1',
    source: { provider: 'synthetic', profileUrl: 'https://www.instagram.com/example_studio/',
      extractedAt: '2026-01-01T00:00:00Z', runIds: [] },
    profile: { username: 'example_studio', fullName: 'Example Studio', biography: 'Taller', externalUrls: [],
      category: null, followersCount: null, postsCount: 2, avatar: asset('avatar', 'avatar.jpg') },
    posts: [
      { id: 'OWN', url: 'https://www.instagram.com/p/OWN/', ownerUsername: 'example_studio',
        type: 'image', timestamp: null, caption: 'Tejemos con calma.', likesCount: null,
        commentsCount: null, media: [asset('media-1', 'own.jpg')] },
      { id: 'PARTNER', url: 'https://www.instagram.com/p/PARTNER/', ownerUsername: 'partner',
        type: 'image', timestamp: null, caption: 'Partner caption', likesCount: null,
        commentsCount: null, media: [asset('media-1', 'partner.jpg')] },
    ],
  };
  await writeFile(path.join(profileDir, 'instagram-source.json'), JSON.stringify(source));
  const image = async (file, color) => sharp({ create: { width: 40, height: 40, channels: 3,
    background: color } }).jpeg().toFile(path.join(profileDir, 'assets', file));
  await image('avatar.jpg', '#df1584'); await image('own.jpg', '#ffdc30');
  await image('partner.jpg', '#2266ee');
  await writeFile(path.join(profileDir, 'evidence', 'review.json'), JSON.stringify({
    'profile/avatar': { classification: 'brand-graphic', notes: 'Own logo' },
    'OWN/media-1': { classification: null }, 'PARTNER/media-1': { classification: null },
  }));
  return { root, dataRoot, profileDir, outputRoot };
}

function providers(calls) {
  return {
    ingestImpl: async () => { throw new Error('Cached source should be reused.'); },
    analysisProvider: async () => { calls.analysis++; return { inferences: unknown(), usage: null }; },
    colorProvider: async (graphics) => { calls.colors++; return { candidates: {
      primary: { hex: '#df1584', evidenceIds: [graphics[0].evidenceId], rationale: 'Gráfico propio.' },
      secondary: { hex: '#fff07a', evidenceIds: [graphics[0].evidenceId], rationale: 'Fondo del gráfico.' },
    }, usage: null }; },
  };
}

test('pauses for review, resumes with one command, and reuses paid stages', async () => {
  const files = await fixture();
  try {
    const calls = { analysis: 0, colors: 0 };
    const options = { ...files, ...providers(calls) };
    const paused = await runPipeline('@example_studio', options);
    assert.equal(paused.status, 'review-required');
    assert.deepEqual(paused.pending, ['OWN/media-1']);
    assert.equal(calls.analysis, 0); assert.equal(calls.colors, 0);
    const reviewPath = path.join(files.profileDir, 'evidence/review.json');
    const review = JSON.parse(await readFile(reviewPath, 'utf8'));
    review['OWN/media-1'].classification = 'product-photo';
    await writeFile(reviewPath, JSON.stringify(review));

    const built = await runPipeline('@example_studio', options);
    assert.equal(built.status, 'complete');
    assert.equal(calls.analysis, 1); assert.equal(calls.colors, 1);
    const manifest = JSON.parse(await readFile(path.join(built.outputDir, 'manifest.json'), 'utf8'));
    assert.equal(manifest.id, 'example-studio');
    assert.equal(manifest.source.type, 'local');
    assert.equal(manifest.sourceFiles, undefined);
    const catalogMetadata = JSON.parse(await readFile(path.join(built.outputDir, 'metadata.json'), 'utf8'));
    assert.equal(catalogMetadata.status, 'published');
    const design = await readFile(path.join(built.outputDir, 'DESIGN.md'), 'utf8');
    assert.match(design, /provisional|revisable/);
    const source = await readFile(path.join(built.outputDir, 'source/instagram-source.json'), 'utf8');
    assert.ok(!source.includes('PARTNER') && !source.includes('Partner caption'));
    assert.ok(!source.includes('remoteUrl'));
    const analysis = JSON.parse(await readFile(path.join(built.outputDir, 'brand-analysis.json'), 'utf8'));
    assert.ok(analysis.evidence.every((item) => !item.sourcePath.startsWith('data/')));
    assert.ok(analysis.evidence.every((item) => !item.summary.includes('PARTNER')));
    assert.equal((await stat(path.join(built.outputDir, 'assets/moodboard.webp'))).isFile(), true);

    const rerun = await runPipeline('@example_studio', options);
    assert.equal(rerun.status, 'complete');
    assert.equal(rerun.analyzed, false); assert.equal(rerun.colorProposed, false);
    assert.equal(calls.analysis, 1); assert.equal(calls.colors, 1);
    await compileExisting(files.profileDir, { outputRoot: files.outputRoot });
    assert.equal(calls.analysis, 1); assert.equal(calls.colors, 1);
  } finally { await rm(files.root, { recursive: true, force: true }); }
});

test('invalid color citations retain the previous package', async () => {
  const files = await fixture();
  try {
    const reviewPath = path.join(files.profileDir, 'evidence/review.json');
    const review = JSON.parse(await readFile(reviewPath, 'utf8'));
    review['OWN/media-1'].classification = 'product-photo';
    await writeFile(reviewPath, JSON.stringify(review));
    const calls = { analysis: 0, colors: 0 };
    const options = { ...files, ...providers(calls) };
    const built = await runPipeline('@example_studio', options);
    const prior = await readFile(path.join(built.outputDir, 'manifest.json'), 'utf8');
    await assert.rejects(() => runPipeline('@example_studio', {
      ...options, reanalyze: true,
      colorProvider: async () => ({ candidates: {
        primary: { hex: '#df1584', evidenceIds: ['E-FAKE'], rationale: 'Inventado.' },
        secondary: { hex: null, evidenceIds: [], rationale: 'Desconocido.' },
      } }),
    }), /reviewed, profile-owned brand graphics/);
    assert.equal(await readFile(path.join(built.outputDir, 'manifest.json'), 'utf8'), prior);
  } finally { await rm(files.root, { recursive: true, force: true }); }
});

test('color request sends only reviewed graphics and validates structured response', async () => {
  const files = await fixture();
  try {
    const graphic = { evidenceId: 'E-IMG-SYNTHETIC', absolutePath: path.join(files.profileDir, 'assets/avatar.jpg'),
      mime: 'image/jpeg', review: { notes: 'Own graphic' } };
    let calls = 0;
    const result = await requestColorCandidates([graphic], { inferences: unknown() }, {
      token: 'synthetic-key', fetchImpl: async (url, options) => {
        calls++;
        assert.equal(url, 'https://api.openai.com/v1/responses');
        assert.equal(options.headers.authorization, 'Bearer synthetic-key');
        const body = JSON.parse(options.body);
        assert.equal(body.model, 'gpt-6-luna');
        assert.deepEqual(body.reasoning, { effort: 'high' });
        assert.equal(body.text.format.strict, true);
        assert.equal(body.input[1].content.filter((item) => item.type === 'input_image').length, 1);
        assert.ok(!options.body.includes('PARTNER'));
        return Response.json({ status: 'completed', output: [{ type: 'message', content: [
          { type: 'output_text', text: JSON.stringify({
            primary: { hex: '#df1584', evidenceIds: [graphic.evidenceId], rationale: 'Marca.' },
            secondary: { hex: null, evidenceIds: [], rationale: 'Sin segunda señal.' },
          }) },
        ] }] });
      },
    });
    assert.equal(calls, 1);
    assert.equal(result.candidates.primary.hex, '#df1584');
  } finally { await rm(files.root, { recursive: true, force: true }); }
});

test('uses neutral candidates without a brand graphic or another API call', async () => {
  const files = await fixture();
  try {
    const reviewPath = path.join(files.profileDir, 'evidence/review.json');
    const review = JSON.parse(await readFile(reviewPath, 'utf8'));
    review['profile/avatar'].classification = 'product-photo';
    review['OWN/media-1'].classification = 'product-photo';
    await writeFile(reviewPath, JSON.stringify(review));
    const calls = { analysis: 0, colors: 0 };
    const built = await runPipeline('@example_studio', { ...files, ...providers(calls) });
    assert.equal(built.status, 'complete');
    assert.equal(calls.analysis, 1); assert.equal(calls.colors, 0);
    const proposal = JSON.parse(await readFile(path.join(built.outputDir, 'source/color-proposals.json'), 'utf8'));
    assert.equal(proposal.candidates.primary.hex, null);
    assert.match(await readFile(path.join(built.outputDir, 'tokens.css'), 'utf8'), /--accent: #333333/);
  } finally { await rm(files.root, { recursive: true, force: true }); }
});


test('pipeline journals separate provider attempts, cache reuse and rejected analysis without losing prior output', async () => {
  const files = await fixture();
  try {
    const reviewPath = path.join(files.profileDir, 'evidence/review.json');
    const review = JSON.parse(await readFile(reviewPath, 'utf8'));
    review['OWN/media-1'].classification = 'product-photo';
    await writeFile(reviewPath, JSON.stringify(review));
    const calls = { analysis: 0, colors: 0 }, base = providers(calls);
    const options = { ...files, ...base,
      analysisProvider: async (...args) => ({ ...(await base.analysisProvider(...args)), usage: { input_tokens: 120, output_tokens: 25 } }),
      colorProvider: async (...args) => ({ ...(await base.colorProvider(...args)), usage: { input_tokens: 30, output_tokens: 5 } }),
    };
    const built = await runPipeline('example_studio', options);
    const record = JSON.parse(await readFile(built.runRecordPath, 'utf8'));
    assert.equal(record.status, 'complete');
    const analysis = record.phases.find(p => p.name === 'analysis');
    const colors = record.phases.find(p => p.name === 'colors');
    assert.equal(analysis.attempts[0].usage.input_tokens, 120);
    assert.equal(colors.attempts[0].usage.input_tokens, 30);
    assert.equal(analysis.attempts[0].billing, null);
    assert.equal(analysis.attempts[0].model, null); // An injected provider is not assumed to be OpenAI.
    assert.ok(analysis.wallMs >= 0);
    assert.equal(built.analysisUsage.output_tokens, 25);
    const prior = await readFile(path.join(files.profileDir, 'brand-analysis.json'));
    const reused = await runPipeline('example_studio', options);
    const cached = JSON.parse(await readFile(reused.runRecordPath, 'utf8'));
    for (const name of ['ingestion', 'analysis', 'colors']) {
      assert.equal(cached.phases.find(p => p.name === name).mode, 'cache');
      assert.deepEqual(cached.phases.find(p => p.name === name).attempts, []);
    }
    assert.equal(calls.analysis, 1); assert.equal(calls.colors, 1);
    let failure;
    try { await runPipeline('example_studio', { ...options, reanalyze: true,
      analysisProvider: async () => ({ inferences: [], usage: { input_tokens: 77, output_tokens: 2 } }),
    }); } catch (error) { failure = error; }
    assert.ok(failure.runRecordPath);
    const rejected = JSON.parse(await readFile(failure.runRecordPath, 'utf8'));
    assert.equal(rejected.status, 'failed');
    assert.equal(rejected.phases.at(-1).status, 'failed');
    assert.equal(rejected.phases.at(-1).attempts[0].usage.input_tokens, 77);
    assert.deepEqual(await readFile(path.join(files.profileDir, 'brand-analysis.json')), prior);
    assert.deepEqual(JSON.parse(await readFile(built.runRecordPath, 'utf8')), record);
  } finally { await rm(files.root, { recursive: true, force: true }); }
});
