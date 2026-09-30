import { readFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import Ajv2020 from 'ajv/dist/2020.js';
import { loadDecisions } from './decisions.js';
import { digest, profileFile, readOptionalJson } from './local.js';
import { writeJsonAtomically } from './atomic.js';

const schema = JSON.parse(await readFile(new URL('../schemas/asset-review.schema.json', import.meta.url), 'utf8'));
const validate = new Ajv2020({ allErrors: true }).compile(schema);
export const ASSET_TARGETS = { 'web-hero': { width: 1440, height: 720 }, 'instagram-story': { width: 1080, height: 1920 } };

export function validateAssetReview(document, username) {
  if (!validate(document)) throw new Error(`Invalid asset review: ${JSON.stringify(validate.errors)}`);
  if (document.username !== username) throw new Error('Asset review belongs to another profile.');
  if (new Set(document.entries.map((entry) => entry.id)).size !== document.entries.length) throw new Error('Duplicate asset ID.');
  for (const entry of document.entries) {
    const box = entry.subjectBox;
    if (box && (box.x + box.width > 1 || box.y + box.height > 1)) throw new Error(`Subject box escapes image: ${entry.id}`);
    if (entry.alt.usage === 'decorative' && entry.alt.text) throw new Error('Decorative images must have empty alt text.');
  }
}

export async function pendingAsset(prepared, { id, path: relative, role = 'reference', note = '' }) {
  return { id, path: relative, sha256: digest(await readFile(await profileFile(prepared.root, relative))),
    origin: 'unknown', role, include: true, primary: false, permission: { use: 'unknown' },
    uiOverlay: null, subjectBox: null, alt: { text: note, usage: 'unknown' } };
}

export async function initializeAssets(prepared) {
  return { schemaVersion: 'asset-review/v1', username: prepared.source.profile.username,
    entries: await Promise.all(prepared.images.map((image) => pendingAsset(prepared, {
      id: image.evidenceId, path: image.assetPath,
      role: image.imageId === 'profile/avatar' ? 'logo' : image.review.classification === 'product-photo' ? 'product' : 'reference',
      note: image.review.notes ?? '' }))) };
}

export function proposedCrop(width, height, target, subjectBox) {
  const ratio = target.width / target.height;
  let cropWidth = 1, cropHeight = 1;
  if (width / height > ratio) cropWidth = height * ratio / width;
  else cropHeight = width / ratio / height;
  const crop = { x: (1 - cropWidth) / 2, y: (1 - cropHeight) / 2, width: cropWidth, height: cropHeight };
  const crops = cropWidth < .999 || cropHeight < .999;
  const cutsSubject = Boolean(subjectBox && (subjectBox.x < crop.x || subjectBox.y < crop.y ||
    subjectBox.x + subjectBox.width > crop.x + crop.width || subjectBox.y + subjectBox.height > crop.y + crop.height));
  return { ...crop, reviewRequired: crops && (!subjectBox || cutsSubject), cutsSubject,
    note: 'Centered cover proposal only; original file is unchanged. Use contain if cropping is inappropriate.' };
}

export async function buildAssetCatalog(prepared, analysis, { kind = 'web-hero', target = ASSET_TARGETS[kind], write = true } = {}) {
  if (!target || !Number.isInteger(target.width) || !Number.isInteger(target.height) || target.width < 1 || target.height < 1) throw new Error('Invalid asset target.');
  const saved = await readOptionalJson(path.join(prepared.root, 'asset-review.json'));
  const document = saved ?? await initializeAssets(prepared);
  validateAssetReview(document, prepared.source.profile.username);
  const decisions = await loadDecisions(prepared, analysis);
  const sources = new Map(decisions.sources.map((source) => [source.id, source]));
  const own = new Map(prepared.images.map((image) => [image.evidenceId, image]));
  const entries = [];
  for (const entry of document.entries) {
    const known = own.get(entry.id);
    if (known && entry.path !== known.assetPath || !known && (!entry.id.startsWith('A-LOCAL-') || !entry.path.startsWith('manual/'))) {
      throw new Error(`Asset is not reviewed profile evidence or a supplied original: ${entry.id}`);
    }
    const absolutePath = await profileFile(prepared.root, entry.path);
    const bytes = await readFile(absolutePath);
    const image = sharp(bytes, { limitInputPixels: 100_000_000 });
    const metadata = await image.metadata();
    const stats = await image.stats();
    const rotated = metadata.orientation >= 5 && metadata.orientation <= 8;
    const width = rotated ? metadata.height : metadata.width, height = rotated ? metadata.width : metadata.height;
    const alpha = metadata.hasAlpha ? stats.channels[stats.channels.length - 1] : null;
    const source = entry.permission.sourceId ? sources.get(entry.permission.sourceId) : null;
    if (entry.permission.sourceId && !source) throw new Error(`Unknown permission source: ${entry.permission.sourceId}`);
    const stale = digest(bytes) !== entry.sha256;
    const selection = decisions.assetSelections.find((item) => item.evidenceId === entry.id && !item.stale);
    const include = selection ? selection.action !== 'exclude' : entry.include;
    const primary = selection ? selection.action === 'primary' : entry.primary;
    const role = selection?.role ?? entry.role;
    if (!['logo', 'product', 'portrait', 'texture', 'reference'].includes(role)) throw new Error(`Unsupported asset role: ${role}`);
    const blockers = [];
    if (!include) blockers.push('excluded');
    if (stale) blockers.push('file changed since review');
    if (!['local-design', 'redistributable'].includes(entry.permission.use)) blockers.push('design permission is unconfirmed');
    if (source?.stale) blockers.push('permission source changed');
    if (entry.origin === 'unknown') blockers.push('original/capture/derivative classification needs review');
    if (entry.uiOverlay !== false) blockers.push(entry.uiOverlay ? 'embedded UI/overlay needs a reviewed original' : 'embedded UI/overlay check is pending');
    const originUrl = known ? prepared.source.posts.find((post) => post.id === known.imageId.split('/')[0])?.url ?? prepared.source.source.profileUrl : null;
    entries.push({ ...entry, include, primary, role, absolutePath, stale, readyForDesign: blockers.length === 0, blockers,
      source: { type: known ? 'instagram' : 'supplied-local', url: originUrl, evidenceId: known?.evidenceId ?? null },
      technical: { width, height, aspectRatio: width / height, format: metadata.format, hasAlphaChannel: Boolean(metadata.hasAlpha),
        hasTransparentPixels: Boolean(alpha && alpha.min < 255), bytes: bytes.length },
      crop: proposedCrop(width, height, target, entry.subjectBox),
      lowResolution: width < target.width || height < target.height,
      altSuggestion: { text: entry.alt.text || known?.review.notes || '', needsReview: true,
        note: 'Decide informative/decorative usage for the actual composition; this text is a candidate.' } });
  }
  // A new source selection must appear in the catalog as pending, never become silently reusable.
  for (const image of prepared.images) if (!document.entries.some((entry) => entry.id === image.evidenceId)) {
    throw new Error(`Asset review is missing current evidence ${image.evidenceId}; update the review before compiling.`);
  }
  const primaryRoles = entries.filter((entry) => entry.include && entry.primary).map((entry) => entry.role);
  if (new Set(primaryRoles).size !== primaryRoles.length) throw new Error('Choose only one primary asset per role.');
  const catalog = { schemaVersion: 'asset-catalog/v1', username: document.username, kind, target,
    entries: entries.map(({ absolutePath, ...entry }) => entry),
    note: 'Only readyForDesign assets are reusable; other images are reference evidence. Crop and alt candidates need composition review.' };
  if (write) await writeJsonAtomically(path.join(prepared.root, 'asset-catalog.json'), catalog);
  return { catalog, entries };
}
