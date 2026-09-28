import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { analyzeBrand, prepareAnalysis } from '../src/analyze.js';
import { ANALYSIS_TOPICS, requestBrandInferences } from '../src/providers/openai.js';

async function fixture() {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'brand-analysis-test-'));
  await mkdir(path.join(dir, 'assets'));
  await mkdir(path.join(dir, 'evidence'));
  const profileUrl = 'https://www.instagram.com/example.studio/';
  const posts = [
    { id: 'OWN1', ownerUsername: 'Example.Studio', caption: 'Tejé con calma.', media: [] },
    { id: 'PARTNER', ownerUsername: 'partner', caption: 'Partner event', media: [] },
    { id: 'OWN2', ownerUsername: 'example.studio', caption: 'Taller de crochet', media: [] },
    { id: 'OWN3', ownerUsername: 'example.studio', caption: '', media: [] },
  ];
  const source = { schemaVersion: 'instagram-source/v1', source: { profileUrl },
    profile: { username: 'example.studio', fullName: 'Example Studio', biography: 'Talleres y tejido' }, posts };
  const images = [
    { id: 'profile/avatar', postId: null, assetPath: 'assets/avatar.jpg' },
    { id: 'OWN1/media-1', postId: 'OWN1', assetPath: 'assets/own1.jpg' },
    { id: 'PARTNER/media-1', postId: 'PARTNER', assetPath: 'assets/partner.jpg' },
    { id: 'OWN2/media-1', postId: 'OWN2', assetPath: 'assets/own2.jpg' },
    { id: 'OWN3/media-1', postId: 'OWN3', assetPath: 'assets/own3.jpg' },
  ];
  const index = { schemaVersion: 'evidence/v1', sourceProfile: profileUrl,
    selectedImageIds: images.map((image) => image.id), images };
  const reviews = Object.fromEntries(images.map((image) => [image.id, {
    classification: image.id === 'profile/avatar' ? 'brand-graphic' :
      image.id === 'OWN1/media-1' ? 'product-photo' :
      image.id === 'OWN3/media-1' ? null : 'mixed',
    notes: 'Synthetic observation',
  }]));
  await writeFile(path.join(dir, 'instagram-source.json'), JSON.stringify(source));
  await writeFile(path.join(dir, 'evidence', 'evidence.json'), JSON.stringify(index));
  await writeFile(path.join(dir, 'evidence', 'review.json'), JSON.stringify(reviews));
  await writeFile(path.join(dir, 'evidence', 'captions.md'), 'Synthetic captions');
  for (const image of images) await writeFile(path.join(dir, image.assetPath), image.id);
  return dir;
}

const unknownInferences = () => ANALYSIS_TOPICS.map((topic) => ({
  topic, value: null, confidence: null, evidenceIds: [],
  rationale: 'No hay evidencia suficiente.', status: 'needs-review',
}));

test('prepares only reviewed, profile-owned images and captions', async () => {
  const dir = await fixture();
  try {
    const prepared = await prepareAnalysis(dir);
    assert.deepEqual(prepared.images.map((image) => image.imageId),
      ['profile/avatar', 'OWN1/media-1', 'OWN2/media-1']);
    assert.deepEqual(prepared.captions.map((caption) => caption.postId), ['OWN1', 'OWN2']);
    assert.equal(prepared.excludedCollaborator, 1);
    assert.equal(prepared.excludedUnreviewed, 1);
    assert.ok(prepared.evidence.every((item) => !item.summary.includes('PARTNER')));
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('requests one structured vision response and writes schema-valid analysis', async () => {
  const dir = await fixture();
  try {
    const prepared = await prepareAnalysis(dir);
    const rows = unknownInferences();
    rows[0] = { topic: 'color.palette', value: 'Amarillo en el avatar', confidence: 'low',
      evidenceIds: [prepared.images[0].evidenceId], rationale: 'Visible en el gráfico del perfil.', status: 'inferred' };
    let calls = 0;
    const fetchImpl = async (url, options) => {
      calls++;
      assert.equal(url, 'https://api.openai.com/v1/responses');
      assert.equal(options.headers.authorization, 'Bearer synthetic-key');
      const body = JSON.parse(options.body);
      assert.equal(body.model, 'gpt-6-luna');
      assert.deepEqual(body.reasoning, { effort: 'high' });
      assert.equal(body.store, false);
      assert.equal(body.text.format.strict, true);
      assert.equal(body.input[1].content.filter((item) => item.type === 'input_image').length, 3);
      assert.ok(!options.body.includes('PARTNER'));
      return Response.json({ status: 'completed',
        output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ inferences: rows }) }] }],
        usage: { input_tokens: 100, output_tokens: 50 } });
    };
    const result = await analyzeBrand(prepared, { token: 'synthetic-key', fetchImpl,
      generatedAt: '2026-01-01T00:00:00Z' });
    assert.equal(calls, 1);
    assert.equal(result.analysis.inferences.length, 10);
    assert.equal(result.analysis.inferences[0].status, 'inferred');
    assert.deepEqual(result.usage, { input_tokens: 100, output_tokens: 50 });
    assert.equal(JSON.parse(await readFile(result.outputPath, 'utf8')).schemaVersion,
      'instagram-to-opendesign-brand-analysis/v1');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('rejects invented references and product-only color claims without replacing prior output', async () => {
  const dir = await fixture();
  try {
    const prepared = await prepareAnalysis(dir);
    const outputPath = path.join(dir, 'brand-analysis.json');
    await writeFile(outputPath, 'prior valid analysis');
    const invalid = unknownInferences();
    invalid[0] = { topic: 'color.palette', value: 'Rojo', confidence: 'medium',
      evidenceIds: ['E-NOT-REAL'], rationale: 'Invented citation.', status: 'inferred' };
    await assert.rejects(() => analyzeBrand(prepared, { provider: async () => ({ inferences: invalid }) }),
      /Unknown evidence ID/);
    invalid[0].evidenceIds = [prepared.images.find((image) => image.imageId === 'OWN1/media-1').evidenceId];
    await assert.rejects(() => analyzeBrand(prepared, { provider: async () => ({ inferences: invalid }) }),
      /cannot be inferred from product photos/);
    assert.equal(await readFile(outputPath, 'utf8'), 'prior valid analysis');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('rejects incomplete responses and missing topics without writing output', async () => {
  const dir = await fixture();
  try {
    const prepared = await prepareAnalysis(dir);
    await assert.rejects(() => requestBrandInferences(prepared, { token: 'synthetic-key',
      fetchImpl: async () => Response.json({ status: 'incomplete', output: [] }) }), /incomplete/);
    await assert.rejects(() => analyzeBrand(prepared, {
      provider: async () => ({ inferences: unknownInferences().slice(1) }),
    }), /Expected 10 analysis topics/);
    await assert.rejects(() => readFile(path.join(dir, 'brand-analysis.json')), /ENOENT/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('rejects selected asset paths outside the profile directory before any API request', async () => {
  const dir = await fixture();
  try {
    const indexPath = path.join(dir, 'evidence', 'evidence.json');
    const index = JSON.parse(await readFile(indexPath, 'utf8'));
    index.images.find((image) => image.id === 'profile/avatar').assetPath = 'assets/../../outside.jpg';
    await writeFile(indexPath, JSON.stringify(index));
    await assert.rejects(() => prepareAnalysis(dir), /escapes the profile directory/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
