import { createHash, randomUUID } from 'node:crypto';
import { readFile, realpath, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { ANALYSIS_MODEL, ANALYSIS_TOPICS, requestBrandInferences } from './providers/openai.js';

const MAX_IMAGES = 24;
const MAX_IMAGE_BYTES = 64 * 1024 * 1024;
const IMAGE_MIME = new Map([['.jpg', 'image/jpeg'], ['.jpeg', 'image/jpeg'],
  ['.png', 'image/png'], ['.webp', 'image/webp']]);

const evidenceId = (prefix, key) => `${prefix}-${createHash('sha256').update(key).digest('hex').slice(0, 16).toUpperCase()}`;
const compact = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const isProfileOwned = (owner, username) => typeof owner === 'string' &&
  owner.replace(/^@/, '').toLowerCase() === username.toLowerCase();

async function localFile(root, relativePath) {
  if (typeof relativePath !== 'string' || !/^[A-Za-z0-9._/-]+$/.test(relativePath)) {
    throw new Error(`Unsafe evidence path: ${relativePath}`);
  }
  const absolute = path.resolve(root, relativePath);
  const relative = path.relative(root, absolute);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Evidence path escapes the profile directory: ${relativePath}`);
  }
  const real = await realpath(absolute);
  const realRelative = path.relative(root, real);
  if (!realRelative || realRelative.startsWith('..') || path.isAbsolute(realRelative)) {
    throw new Error(`Evidence path points outside the profile directory: ${relativePath}`);
  }
  return absolute;
}

export async function prepareAnalysis(profileDir) {
  const root = await realpath(profileDir);
  const source = JSON.parse(await readFile(path.join(root, 'instagram-source.json'), 'utf8'));
  const index = JSON.parse(await readFile(path.join(root, 'evidence', 'evidence.json'), 'utf8'));
  const reviews = JSON.parse(await readFile(path.join(root, 'evidence', 'review.json'), 'utf8'));
  if (source.schemaVersion !== 'instagram-source/v1' || index.schemaVersion !== 'evidence/v1') {
    throw new Error('Unsupported source or evidence schema.');
  }
  if (index.sourceProfile !== source.source.profileUrl) throw new Error('Evidence belongs to another profile.');
  if (!Array.isArray(index.selectedImageIds) || !Array.isArray(index.images)) {
    throw new Error('Evidence index is missing its image selection.');
  }
  const posts = new Map(source.posts.map((post) => [post.id, post]));
  const indexedImages = new Map(index.images.map((image) => [image.id, image]));
  const selected = index.selectedImageIds.slice(0, MAX_IMAGES);
  if (new Set(selected).size !== selected.length) throw new Error('Evidence selection contains duplicate IDs.');
  const images = [];
  const excludedUnreviewed = index.images.filter((image) =>
    !['brand-graphic', 'product-photo', 'mixed'].includes(reviews[image.id]?.classification)).length;
  let excludedCollaborator = 0, bytes = 0;
  for (const imageId of selected) {
    const image = indexedImages.get(imageId);
    if (!image) throw new Error(`Selected image is missing from the index: ${imageId}`);
    const review = reviews[imageId];
    if (!['brand-graphic', 'product-photo', 'mixed'].includes(review?.classification)) {
      continue;
    }
    const ownAvatar = imageId === 'profile/avatar' && image.postId == null;
    const post = image.postId ? posts.get(image.postId) : null;
    if (!ownAvatar && (!post || !isProfileOwned(post.ownerUsername, source.profile.username))) {
      excludedCollaborator++;
      continue;
    }
    if (!image.assetPath?.startsWith('assets/')) throw new Error(`Invalid asset path for ${imageId}.`);
    const mime = IMAGE_MIME.get(path.extname(image.assetPath).toLowerCase());
    if (!mime) throw new Error(`Unsupported image type for ${imageId}; use JPEG, PNG, or WEBP.`);
    const absolutePath = await localFile(root, image.assetPath);
    bytes += (await stat(absolutePath)).size;
    if (bytes > MAX_IMAGE_BYTES) throw new Error('Selected images exceed the 64 MB input limit.');
    images.push({ imageId, evidenceId: evidenceId('E-IMG', imageId),
      assetPath: image.assetPath, absolutePath, mime, review });
  }
  if (!images.length) throw new Error('No reviewed, profile-owned images are available for analysis.');
  const captionPath = 'evidence/captions.md';
  await localFile(root, captionPath);
  const captions = source.posts.filter((post) => isProfileOwned(post.ownerUsername, source.profile.username) && compact(post.caption))
    .map((post) => ({ postId: post.id, evidenceId: evidenceId('E-CAP', post.id), caption: post.caption }));
  const evidence = [{ id: 'E-PROFILE', kind: 'metadata', sourcePath: 'instagram-source.json',
    summary: `Perfil @${source.profile.username}: ${compact(source.profile.fullName)}. Bio: ${compact(source.profile.biography) || '(vacía)'}` }];
  for (const image of images) evidence.push({
    id: image.evidenceId, kind: 'image', sourcePath: image.assetPath,
    summary: `${image.imageId}; ${image.review.classification}; ${compact(image.review.notes) || 'sin notas'}`,
  });
  for (const caption of captions) evidence.push({
    id: caption.evidenceId, kind: 'text', sourcePath: captionPath,
    summary: `Caption ${caption.postId}: ${compact(caption.caption).slice(0, 160)}`,
  });
  if (new Set(evidence.map((item) => item.id)).size !== evidence.length) throw new Error('Evidence IDs collided.');
  return { root, source, images, captions, evidence, selectedCount: selected.length,
    excludedUnreviewed, excludedCollaborator, imageBytes: bytes };
}

async function validateAnalysis(analysis, prepared) {
  const schema = JSON.parse(await readFile(new URL('../schemas/brand-analysis.schema.json', import.meta.url), 'utf8'));
  const ajv = new Ajv2020({ allErrors: true, strictTypes: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  if (!validate(analysis)) throw new Error(`Analysis does not match brand-analysis/v1: ${ajv.errorsText(validate.errors)}`);
  const expected = new Set(ANALYSIS_TOPICS);
  const found = new Set();
  const catalog = new Map(prepared.evidence.map((item) => [item.id, item]));
  for (const item of analysis.inferences) {
    if (!expected.has(item.topic) || found.has(item.topic)) throw new Error(`Unexpected or duplicate topic: ${item.topic}`);
    found.add(item.topic);
    if (item.status === 'verified') throw new Error('Model output cannot mark an inference verified.');
    for (const id of item.evidenceIds) if (!catalog.has(id)) throw new Error(`Unknown evidence ID in ${item.topic}: ${id}`);
    if (item.status === 'inferred' && (item.topic.startsWith('color.') || item.topic === 'typography.style')) {
      const hasGraphic = item.evidenceIds.some((id) => prepared.images.some((image) =>
        image.evidenceId === id && image.review.classification !== 'product-photo'));
      if (!hasGraphic) throw new Error(`${item.topic} cannot be inferred from product photos or text alone.`);
    }
  }
  if (found.size !== expected.size) throw new Error(`Expected ${expected.size} analysis topics, received ${found.size}.`);
  for (const item of analysis.evidence) await localFile(prepared.root, item.sourcePath);
}

async function replaceFile(outputPath, content) {
  const suffix = `${process.pid}-${randomUUID()}`;
  const temporary = `${outputPath}.partial-${suffix}`;
  const backup = `${outputPath}.backup-${suffix}`;
  await writeFile(temporary, content, { flag: 'wx' });
  let hadPrevious = false;
  try {
    try { await rename(outputPath, backup); hadPrevious = true; }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    try { await rename(temporary, outputPath); }
    catch (error) { if (hadPrevious) await rename(backup, outputPath); throw error; }
    if (hadPrevious) await rm(backup);
  } finally { await rm(temporary, { force: true }); }
}

export async function analyzeBrand(prepared, { token = process.env.OPENAI_API_KEY,
  fetchImpl = fetch, provider = requestBrandInferences, generatedAt = new Date().toISOString() } = {}) {
  const { inferences, usage } = await provider(prepared, { token, fetchImpl });
  if (!Array.isArray(inferences)) throw new Error('Model output is missing inferences.');
  const analysis = {
    schemaVersion: 'instagram-to-opendesign-brand-analysis/v1',
    subject: { displayName: prepared.source.profile.fullName || `@${prepared.source.profile.username}`,
      sourcePlatform: 'instagram', profileUrl: prepared.source.source.profileUrl },
    generatedAt, evidence: prepared.evidence,
    inferences: inferences.map((item) => ({ id: `I-${item.topic.replaceAll('.', '-').toUpperCase()}`, ...item })),
  };
  await validateAnalysis(analysis, prepared);
  const outputPath = path.join(prepared.root, 'brand-analysis.json');
  await replaceFile(outputPath, `${JSON.stringify(analysis, null, 2)}\n`);
  return { outputPath, analysis, usage, model: ANALYSIS_MODEL };
}
