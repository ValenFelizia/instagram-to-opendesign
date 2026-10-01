import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import sharp from 'sharp';
import { prepareAnalysis } from '../../src/analyze.js';
import { colorInputFingerprint } from '../../src/colors.js';
import { ANALYSIS_TOPICS } from '../../src/providers/openai.js';

export async function profileFixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'brand-p0-test-'));
  for (const dir of ['assets', 'evidence', 'manual']) await mkdir(path.join(root, dir));
  const source = { schemaVersion: 'instagram-source/v1', source: {
    provider: 'synthetic', profileUrl: 'https://www.instagram.com/example_studio/', extractedAt: '2026-01-01T00:00:00Z' },
    profile: { username: 'example_studio', fullName: 'Example Studio', biography: 'A synthetic studio' },
    posts: [{ id: 'OWN', ownerUsername: 'example_studio', caption: 'Made carefully.',
      url: 'https://www.instagram.com/p/OWN/', media: [] }] };
  const images = [{ id: 'profile/avatar', postId: null, assetPath: 'assets/avatar.png' },
    { id: 'OWN/media-1', postId: 'OWN', assetPath: 'assets/product.jpg' }];
  for (const image of images) await sharp({ create: { width: 80, height: 60, channels: 3,
    background: '#df1584' } }).toFile(path.join(root, image.assetPath));
  await writeFile(path.join(root, 'instagram-source.json'), JSON.stringify(source));
  await writeFile(path.join(root, 'evidence/evidence.json'), JSON.stringify({ schemaVersion: 'evidence/v1',
    sourceProfile: source.source.profileUrl, selectedImageIds: images.map((image) => image.id), images }));
  await writeFile(path.join(root, 'evidence/review.json'), JSON.stringify({
    'profile/avatar': { classification: 'brand-graphic', notes: 'Synthetic logo' },
    'OWN/media-1': { classification: 'product-photo', notes: 'Synthetic product' } }));
  await writeFile(path.join(root, 'evidence/captions.md'), 'Synthetic caption');
  const prepared = await prepareAnalysis(root);
  const analysis = { schemaVersion: 'instagram-to-opendesign-brand-analysis/v1',
    subject: { displayName: 'Example Studio', sourcePlatform: 'synthetic', profileUrl: source.source.profileUrl },
    generatedAt: '2026-01-01T00:00:00Z', evidence: prepared.evidence,
    inferences: ANALYSIS_TOPICS.map((topic) => ({ id: `I-${topic.replaceAll('.', '-').toUpperCase()}`,
      topic, value: null, confidence: null, evidenceIds: [], rationale: 'No evidence.', status: 'needs-review' })) };
  Object.assign(analysis.inferences[0], { value: 'Pink graphic', confidence: 'medium',
    evidenceIds: [prepared.images[0].evidenceId], status: 'inferred' });
  const candidates = { primary: { hex: '#df1584', evidenceIds: [prepared.images[0].evidenceId], rationale: 'Synthetic mark' },
    secondary: { hex: null, evidenceIds: [], rationale: 'Unknown' } };
  const colors = { schemaVersion: 'color-proposals/v1', inputHash: await colorInputFingerprint(analysis, [prepared.images[0]]), candidates };
  await writeFile(path.join(root, 'brand-analysis.json'), JSON.stringify(analysis));
  await writeFile(path.join(root, 'color-proposals.json'), JSON.stringify(colors));
  return { root, prepared, analysis, colors };
}
