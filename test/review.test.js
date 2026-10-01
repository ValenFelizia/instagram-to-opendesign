import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { importReview, reviewSnapshot } from '../src/review.js';
import { emptyDecisions, loadDecisions } from '../src/decisions.js';
import { digest } from '../src/local.js';
import { profileFixture } from './helpers/profile.js';

test('scoped review import preserves rules and unrelated decisions, detects stale/conflicting snapshots and keeps prior JSON', async () => {
  const f = await profileFixture();
  try {
    const doc = await emptyDecisions(f.prepared, f.analysis);
    const source = 'Synthetic website rule, local approval fixture';
    await writeFile(path.join(f.root, 'manual/site.md'), source);
    doc.sources.push({ id: 'S-SITE', path: 'manual/site.md', sha256: digest(source), summary: 'Website scope', reviewer: 'Synthetic owner', reviewedAt: '2026-01-01T00:00:00Z' });
    doc.rules.push({ id: 'R-SITE', kind: 'token', target: 'accent', value: '#345678', sourceId: 'S-SITE', scope: 'website' });
    await writeFile(path.join(f.root, 'brand-decisions.json'), JSON.stringify(doc));
    assert.equal((await loadDecisions(f.prepared, f.analysis)).tokenOverrides.accent, '#345678');
    assert.equal((await loadDecisions(f.prepared, f.analysis, { channel: 'social' })).tokenOverrides.accent, undefined);
    const snapshot = await reviewSnapshot(f.prepared, f.analysis), item = snapshot.items[0];
    const incoming = { schemaVersion: 'brand-review/v1', username: 'example_studio', decisions: [{ inferenceId: item.id,
      fingerprint: item.fingerprint, baseRevision: item.baseRevision, action: 'accept-proposal', reviewer: 'Synthetic owner', reviewedAt: '2026-01-02T00:00:00Z', note: 'Useful candidate, not verified.' }] };
    await importReview(f.prepared, f.analysis, incoming);
    const current = JSON.parse(await readFile(path.join(f.root, 'brand-decisions.json'), 'utf8'));
    assert.deepEqual(current.rules, doc.rules); assert.deepEqual(current.inferenceDecisions.slice(1), doc.inferenceDecisions.slice(1));
    assert.equal((await loadDecisions(f.prepared, f.analysis)).effectiveAnalysis.inferences[0].status, 'inferred');
    const prior = await readFile(path.join(f.root, 'brand-decisions.json'), 'utf8');
    await assert.rejects(() => importReview(f.prepared, f.analysis, incoming), /changed since/);
    await assert.rejects(() => importReview(f.prepared, f.analysis, { ...incoming, username: 'other' }), /another profile/);
    const latest = (await reviewSnapshot(f.prepared, f.analysis)).items[0];
    incoming.decisions[0].baseRevision = latest.baseRevision;
    f.analysis.inferences[0].value = 'Changed candidate';
    assert.equal((await reviewSnapshot(f.prepared, f.analysis)).items[0].stale, true);
    await assert.rejects(() => importReview(f.prepared, f.analysis, incoming), /evidence changed/);
    assert.equal(await readFile(path.join(f.root, 'brand-decisions.json'), 'utf8'), prior);
  } finally { await rm(f.root, { recursive: true, force: true }); }
});
