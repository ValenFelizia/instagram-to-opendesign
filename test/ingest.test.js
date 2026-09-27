import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { normalizeSource } from '../src/normalize.js';
import { ingest } from '../src/ingest.js';
import { ApifyInstagramProvider } from '../src/providers/apify.js';

const imageUrl = 'https://scontent.cdninstagram.com/test.jpg?signature=synthetic';
const sample = {
  profile: { username: 'example.studio', fullName: 'Example Studio', biography: 'Design studio',
    externalUrl: 'https://example.com/', profilePicUrl: imageUrl, followersCount: 100, postsCount: 2 },
  posts: [{ shortCode: 'ABC123', ownerUsername: 'example.studio', type: 'Sidecar', caption: 'Our look',
    timestamp: '2026-01-01T00:00:00Z', images: [imageUrl] }], runs: ['details-run', 'posts-run'],
};

test('normalizes public profile, post and media without raw provider fields', () => {
  const source = normalizeSource('@Example.Studio', sample, '2026-01-02T00:00:00Z');
  assert.equal(source.schemaVersion, 'instagram-source/v1');
  assert.equal(source.profile.username, 'example.studio');
  assert.equal(source.posts[0].caption, 'Our look');
  assert.equal(source.posts[0].media.length, 1);
  assert.equal(source.posts[0].media[0].remoteUrl, imageUrl);
  assert.equal(source.posts[0].ownerUsername, undefined);
});

test('ingests media locally and preserves earlier output on download failure', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'instagram-ingest-'));
  const fetchImpl = async () => new Response(Buffer.from('synthetic image'), {
    status: 200, headers: { 'content-type': 'image/jpeg' },
  });
  try {
    const options = { outputRoot: root, provider: { collect: async () => sample }, fetchImpl };
    const { outputDir } = await ingest('example.studio', options);
    const saved = JSON.parse(await readFile(path.join(outputDir, 'instagram-source.json'), 'utf8'));
    assert.equal(saved.profile.avatar.assetPath, 'assets/avatar.jpg');
    assert.equal(saved.posts[0].media[0].assetPath, 'assets/post-ABC123-1.jpg');
    assert.equal((await stat(path.join(outputDir, saved.posts[0].media[0].assetPath))).size, 15);
    await assert.rejects(() => ingest('example.studio', {
      ...options, fetchImpl: async () => new Response('error', { status: 404 }),
    }), /HTTP 404/);
    assert.equal((await readFile(path.join(outputDir, 'instagram-source.json'), 'utf8')), JSON.stringify(saved, null, 2) + '\n');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('Apify adapter calls details and posts with Bearer auth', async () => {
  const calls = [];
  let run = 0;
  const fetchImpl = async (url, options) => {
    calls.push({ url: String(url), options });
    if (options.method === 'POST') return Response.json({ data: { id: `run-${++run}`, status: 'SUCCEEDED', defaultDatasetId: `dataset-${run}` } });
    if (String(url).includes('dataset-1')) return Response.json([sample.profile]);
    return Response.json(sample.posts);
  };
  const provider = new ApifyInstagramProvider({ token: 'test-secret', fetchImpl });
  const result = await provider.collect('example.studio', 20);
  assert.equal(result.posts.length, 1);
  assert.deepEqual(result.runs, ['run-1', 'run-2']);
  assert.equal(JSON.parse(calls[0].options.body).resultsType, 'details');
  assert.equal(JSON.parse(calls[2].options.body).resultsType, 'posts');
  assert.ok(calls.every((call) => call.options.headers.authorization === 'Bearer test-secret'));
  assert.ok(calls.every((call) => !call.url.includes('test-secret')));
});
