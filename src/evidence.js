import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const CLASSIFICATIONS = new Set(['brand-graphic', 'product-photo', 'mixed']);
const escapeXml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
})[char]);
const escapeMd = (value) => String(value).replace(/[\\[\]]/g, '\\$&').replace(/\r?\n/g, ' ');

function safeAsset(profileDir, assetPath) {
  if (typeof assetPath !== 'string') throw new Error('Media is missing a local assetPath.');
  const root = path.resolve(profileDir, 'assets');
  const absolute = path.resolve(profileDir, assetPath);
  if (!absolute.startsWith(root + path.sep)) throw new Error(`Asset path escapes the assets directory: ${assetPath}`);
  return absolute;
}

function imageEntries(source, profileDir) {
  const entries = [];
  if (source.profile.avatar?.assetPath) entries.push({
    id: 'profile/avatar', postId: null, postUrl: source.source.profileUrl,
    assetPath: source.profile.avatar.assetPath,
    absolutePath: safeAsset(profileDir, source.profile.avatar.assetPath),
  });
  for (const post of source.posts) {
    for (const media of post.media) {
      if (media.kind !== 'image') continue;
      entries.push({ id: `${post.id}/${media.id}`, postId: post.id, postUrl: post.url,
        assetPath: media.assetPath, absolutePath: safeAsset(profileDir, media.assetPath) });
    }
  }
  return entries;
}

function selectRepresentative(entries, limit = 24) {
  const chosen = [];
  const ids = new Set();
  const add = (entry) => { if (entry && !ids.has(entry.id) && chosen.length < limit) { chosen.push(entry); ids.add(entry.id); } };
  add(entries.find((entry) => !entry.postId));
  for (const entry of entries) if (entry.postId && !chosen.some((item) => item.postId === entry.postId)) add(entry);
  for (const entry of entries) add(entry);
  return chosen;
}

function normalizeReview(entries, previous = {}) {
  const reviews = {};
  for (const entry of entries) {
    const old = previous[entry.id] ?? {};
    if (old.classification != null && !CLASSIFICATIONS.has(old.classification)) {
      throw new Error(`Invalid classification for ${entry.id}: ${old.classification}`);
    }
    const classification = CLASSIFICATIONS.has(old.classification) ? old.classification : null;
    reviews[entry.id] = {
      classification,
      features: {
        logo: old.features?.logo === true,
        overlay: old.features?.overlay === true,
        cover: old.features?.cover === true,
      },
      compositionGroup: typeof old.compositionGroup === 'string' && old.compositionGroup.trim()
        ? old.compositionGroup.trim() : null,
      notes: typeof old.notes === 'string' ? old.notes : '',
    };
  }
  return reviews;
}

function contactSheet(entries, reviews, evidenceDir) {
  const cellWidth = 320, cellHeight = 370, columns = 4;
  const rows = Math.ceil(entries.length / columns);
  const cells = entries.map((entry, index) => {
    const x = (index % columns) * cellWidth;
    const y = Math.floor(index / columns) * cellHeight;
    const relative = path.relative(evidenceDir, entry.absolutePath).replaceAll('\\', '/');
    const label = reviews[entry.id].classification ?? 'unreviewed';
    return `<g transform="translate(${x} ${y})"><rect width="320" height="370" fill="#fff" stroke="#d6d6d6"/><image href="${escapeXml(relative)}" x="10" y="10" width="300" height="300" preserveAspectRatio="xMidYMid meet"/><text x="10" y="330" font-size="14" font-family="sans-serif">${escapeXml(entry.id)}</text><text x="10" y="352" font-size="12" font-family="sans-serif" fill="#555">${escapeXml(label)}</text></g>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${columns * cellWidth}" height="${Math.max(1, rows) * cellHeight}" viewBox="0 0 ${columns * cellWidth} ${Math.max(1, rows) * cellHeight}"><rect width="100%" height="100%" fill="#f3f3f3"/>${cells}</svg>\n`;
}

function evidenceMarkdown(source, entries, selected, reviews) {
  const category = (name) => entries.filter((entry) => reviews[entry.id].classification === name);
  const lines = [
    `# Evidence: @${source.profile.username}`, '',
    `Source: [public Instagram profile](${source.source.profileUrl}) · captured ${source.source.extractedAt} via ${source.source.provider}.`,
    '', `Posts: ${source.posts.length} · image assets: ${entries.length} · shown in contact sheet: ${selected.length}.`,
    '', '[Contact sheet](contact-sheet.svg) · [Caption corpus](captions.md) · [Review file](review.json)',
    '', '## Profile signals', '',
    `- Name: ${escapeMd(source.profile.fullName ?? '(not available)')}`,
    `- Bio: ${escapeMd(source.profile.biography ?? '(not available)')}`,
    `- Links: ${source.profile.externalUrls.map((url) => `<${url}>`).join(', ') || '(none)'}`,
  ];
  if (source.profile.avatar?.assetPath) lines.push(`- Avatar: [candidate mark or profile image](../${source.profile.avatar.assetPath}) (requires review)`);
  lines.push('', '## Visual categories', '', 'These are observations, not brand rules. Product and photo colors must not be promoted to brand colors without separate evidence.', '');
  for (const [label, heading] of [['brand-graphic', 'Brand graphics'], ['product-photo', 'Product photos'], ['mixed', 'Mixed'], [null, 'Unreviewed']]) {
    const group = label ? category(label) : entries.filter((entry) => !reviews[entry.id].classification);
    lines.push(`### ${heading} (${group.length})`, '');
    for (const entry of group) {
      const review = reviews[entry.id];
      const signals = Object.entries(review.features).filter(([, value]) => value).map(([key]) => key);
      if (review.compositionGroup) signals.push(`composition: ${review.compositionGroup}`);
      lines.push(`- [${escapeMd(entry.id)}](../${entry.assetPath}) · [source](${entry.postUrl})${signals.length ? ` · ${signals.join(', ')}` : ''}${review.notes ? ` · ${escapeMd(review.notes)}` : ''}`);
    }
    if (!group.length) lines.push('- None.');
    lines.push('');
  }
  lines.push('## Repeated compositions', '');
  const groups = new Map();
  for (const entry of entries) {
    const group = reviews[entry.id].compositionGroup;
    if (group) groups.set(group, [...(groups.get(group) ?? []), entry.id]);
  }
  const repeated = [...groups].filter(([, ids]) => ids.length > 1);
  for (const [group, ids] of repeated) lines.push(`- ${escapeMd(group)}: ${ids.map(escapeMd).join(', ')}`);
  if (!repeated.length) lines.push('- None identified yet.');
  lines.push('', '## Copy evidence', '', `${source.posts.filter((post) => post.caption.trim()).length} captions are linked in [captions.md](captions.md).`, '',
    '## Interpretation boundary', '', 'This bundle collects observations. Palette, typography, voice, and other brand rules belong to a later analysis with explicit evidence and confidence.', '');
  return lines.join('\n');
}

export async function processEvidence(profileDir, { maxImages = 24 } = {}) {
  if (!Number.isInteger(maxImages) || maxImages < 1 || maxImages > 100) throw new Error('maxImages must be 1–100.');
  const source = JSON.parse(await readFile(path.join(profileDir, 'instagram-source.json'), 'utf8'));
  if (source.schemaVersion !== 'instagram-source/v1') throw new Error('Unsupported instagram-source schema.');
  const entries = imageEntries(source, profileDir);
  for (const entry of entries) await stat(entry.absolutePath);
  const evidenceDir = path.join(profileDir, 'evidence');
  await mkdir(evidenceDir, { recursive: true });
  let previous = {};
  try { previous = JSON.parse(await readFile(path.join(evidenceDir, 'review.json'), 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const reviews = normalizeReview(entries, previous);
  const selected = selectRepresentative(entries, maxImages);
  const captions = [
    `# Caption corpus: @${source.profile.username}`, '',
    ...source.posts.flatMap((post) => [`## [${post.id}](${post.url}) · ${post.timestamp ?? 'date unavailable'}`, '', post.caption || '(empty caption)', '']),
  ].join('\n');
  const index = { schemaVersion: 'evidence/v1', sourceProfile: source.source.profileUrl,
    capturedAt: source.source.extractedAt, selectedImageIds: selected.map((entry) => entry.id),
    images: entries.map(({ absolutePath, ...entry }) => ({ ...entry, ...reviews[entry.id] })),
    captionCount: source.posts.filter((post) => post.caption.trim()).length };
  await writeFile(path.join(evidenceDir, 'review.json'), `${JSON.stringify(reviews, null, 2)}\n`);
  await writeFile(path.join(evidenceDir, 'contact-sheet.svg'), contactSheet(selected, reviews, evidenceDir));
  await writeFile(path.join(evidenceDir, 'captions.md'), captions);
  await writeFile(path.join(evidenceDir, 'evidence.md'), evidenceMarkdown(source, entries, selected, reviews));
  await writeFile(path.join(evidenceDir, 'evidence.json'), `${JSON.stringify(index, null, 2)}\n`);
  return { evidenceDir, imageCount: entries.length, selectedCount: selected.length,
    reviewedCount: entries.filter((entry) => reviews[entry.id].classification).length };
}
