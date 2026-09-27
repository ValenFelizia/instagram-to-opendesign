import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const MAX_ASSET_BYTES = 60 * 1024 * 1024;
const MAX_TOTAL_BYTES = 300 * 1024 * 1024;
const MIME_EXT = new Map([
  ['image/jpeg', '.jpg'], ['image/png', '.png'], ['image/webp', '.webp'],
  ['image/avif', '.avif'], ['video/mp4', '.mp4'], ['video/webm', '.webm'],
]);

function allowedMediaUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || !/(^|\.)(cdninstagram\.com|fbcdn\.net)$/.test(url.hostname)) {
    throw new Error(`Media URL host is not an Instagram CDN: ${url.hostname}`);
  }
  return url;
}

export async function downloadAssets(source, outputDir, { fetchImpl = fetch } = {}) {
  const entries = [];
  if (source.profile.avatar) entries.push({ media: source.profile.avatar, stem: 'avatar' });
  for (const post of source.posts) {
    for (const [index, media] of post.media.entries()) entries.push({ media, stem: `post-${post.id}-${index + 1}` });
  }
  await mkdir(path.join(outputDir, 'assets'), { recursive: true });
  let total = 0;
  for (const { media, stem } of entries) {
    const url = allowedMediaUrl(media.remoteUrl);
    const response = await fetchImpl(url, { redirect: 'error', signal: AbortSignal.timeout(60000) });
    if (!response.ok) throw new Error(`Media download failed with HTTP ${response.status} for ${stem}.`);
    const mime = response.headers.get('content-type')?.split(';')[0]?.toLowerCase();
    const extension = MIME_EXT.get(mime);
    if (!extension || (media.kind === 'image' && !mime.startsWith('image/')) ||
        (media.kind === 'video' && !mime.startsWith('video/'))) {
      throw new Error(`Unsupported media type ${mime ?? '(missing)'} for ${stem}.`);
    }
    const length = Number(response.headers.get('content-length'));
    if (Number.isFinite(length) && length > MAX_ASSET_BYTES) throw new Error(`Asset ${stem} exceeds 60 MB.`);
    const chunks = [];
    let bytes = 0;
    for await (const chunk of response.body) {
      bytes += chunk.length;
      if (bytes > MAX_ASSET_BYTES || total + bytes > MAX_TOTAL_BYTES) {
        await response.body.cancel().catch(() => {});
        throw new Error('Asset download exceeded the per-file or 300 MB total limit.');
      }
      chunks.push(chunk);
    }
    total += bytes;
    const assetPath = `assets/${stem}${extension}`;
    await writeFile(path.join(outputDir, assetPath), Buffer.concat(chunks));
    media.assetPath = assetPath;
  }
  return source;
}
