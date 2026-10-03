import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createRunRecord, trackProvider, runEffortEvents } from '../src/run-record.js';
import { requestBrandInferences } from '../src/providers/openai.js';
import { ApifyInstagramProvider } from '../src/providers/apify.js';

test('invalid provider JSON still preserves actual usage without response payloads or credentials', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'brand-run-'));
  try {
    const journal = await createRunRecord(root, { refresh: false, reanalyze: true, postLimit: 20 });
    await assert.rejects(() => journal.phase('analysis', async ({ observe }) => {
      const tracked = trackProvider(requestBrandInferences, { observe, providerName: 'openai', model: 'gpt-6-luna', maxOutputTokens: 16000 });
      return tracked({ evidence: [], images: [], captions: [], source: { profile: {} } }, {
        token: 'secret-synthetic', fetchImpl: async () => Response.json({ id: 'resp-example', model: 'observed-model',
          status: 'completed', usage: { input_tokens: 99, output_tokens: 7, input_tokens_details: { cached_tokens: 50 }, secret: 'secret-synthetic' },
          output: [{ type: 'message', content: [{ type: 'output_text', text: 'private-invalid-output' }] }] }),
      });
    }), /invalid JSON/);
    await journal.finish('failed');
    const content = await readFile(journal.outputPath, 'utf8'), record = JSON.parse(content);
    assert.ok(!content.includes('secret-synthetic') && !content.includes('private-invalid-output'));
    const attempt = record.phases[0].attempts[0];
    assert.equal(attempt.usage.input_tokens, 99);
    assert.equal(attempt.model, 'observed-model');
    assert.equal(attempt.configuration.reasoningEffort, 'high');
    assert.equal(attempt.billing, null);
    assert.equal(attempt.status, 'failed');
    assert.equal(runEffortEvents(record)[0].minutes, null);
    assert.equal(runEffortEvents(record)[0].cost, null);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('failed second Apify run retains both returned bills and run IDs, without retrying', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'brand-run-'));
  try {
    const journal = await createRunRecord(root, { refresh: true, reanalyze: false, postLimit: 20 });
    let calls = 0;
    const provider = new ApifyInstagramProvider({ token: 'secret-synthetic', fetchImpl: async (_, options) => {
      if (options.method === 'POST') {
        calls++;
        return Response.json({ data: { id: `actor-${calls}`, status: calls === 1 ? 'SUCCEEDED' : 'FAILED',
          defaultDatasetId: 'dataset', usageTotalUsd: calls === 1 ? 0.01 : 0.03 } });
      }
      return Response.json([{ username: 'example_studio', private: false }]);
    } });
    await assert.rejects(() => journal.phase('ingestion', ({ observe }) => provider.collect('example_studio', 20, { onProviderEvent: observe })), /FAILED/);
    await journal.finish('failed');
    assert.equal(calls, 2);
    const attempts = journal.record.phases[0].attempts;
    assert.deepEqual(attempts.map(a => a.billing.amount), [0.01, 0.03]);
    assert.deepEqual(attempts.map(a => a.responseId), ['actor-1', 'actor-2']);
    assert.deepEqual(attempts.map(a => a.status), ['completed', 'failed']);
    assert.equal(runEffortEvents(journal.record, 'USD').reduce((sum, e) => sum + e.cost, 0), 0.04);
  } finally { await rm(root, { recursive: true, force: true }); }
});
