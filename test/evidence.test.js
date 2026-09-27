import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { normalizeSource } from '../src/normalize.js';
import { processEvidence } from '../src/evidence.js';

test('builds reviewable evidence and keeps labels on regeneration', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'evidence-test-'));
  try {
    await mkdir(path.join(dir, 'assets'));
    const source = normalizeSource('example.studio', {
      profile: { username: 'example.studio', fullName: 'Example', biography: 'Studio', profilePicUrl: 'https://scontent.cdninstagram.com/a.jpg' },
      posts: [{ shortCode: 'ABC123', ownerUsername: 'example.studio', caption: 'A caption',
        displayUrl: 'https://scontent.cdninstagram.com/b.jpg' }], runs: [],
    }, '2026-01-01T00:00:00Z');
    source.profile.avatar.assetPath = 'assets/avatar.jpg';
    source.posts[0].media[0].assetPath = 'assets/post-ABC123-1.jpg';
    await writeFile(path.join(dir, 'assets/avatar.jpg'), 'synthetic');
    await writeFile(path.join(dir, 'assets/post-ABC123-1.jpg'), 'synthetic');
    await writeFile(path.join(dir, 'instagram-source.json'), JSON.stringify(source));
    const first = await processEvidence(dir);
    assert.equal(first.imageCount, 2);
    assert.equal(first.reviewedCount, 0);
    const reviewPath = path.join(first.evidenceDir, 'review.json');
    const review = JSON.parse(await readFile(reviewPath, 'utf8'));
    review['ABC123/media-1'].classification = 'product-photo';
    review['ABC123/media-1'].features.overlay = true;
    review['ABC123/media-1'].compositionGroup = 'red frame';
    await writeFile(reviewPath, JSON.stringify(review));
    const second = await processEvidence(dir);
    assert.equal(second.reviewedCount, 1);
    const evidence = await readFile(path.join(first.evidenceDir, 'evidence.md'), 'utf8');
    assert.match(evidence, /Product photos \(1\)/);
    assert.match(evidence, /Unreviewed \(1\)/);
    assert.match(evidence, /overlay/);
    assert.match(await readFile(path.join(first.evidenceDir, 'captions.md'), 'utf8'), /A caption/);
    assert.match(await readFile(path.join(first.evidenceDir, 'contact-sheet.svg'), 'utf8'), /\.\.\/assets\/post-ABC123-1\.jpg/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('rejects asset paths outside the profile assets directory', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'evidence-test-'));
  try {
    const source = normalizeSource('example.studio', { profile: { username: 'example.studio' }, posts: [] });
    source.profile.avatar = { kind: 'image', remoteUrl: 'https://scontent.cdninstagram.com/a.jpg', assetPath: '../secret.jpg' };
    await writeFile(path.join(dir, 'instagram-source.json'), JSON.stringify(source));
    await assert.rejects(() => processEvidence(dir), /escapes the assets directory/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
