import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { profileFixture } from './helpers/profile.js';
import { requestCheckpoints } from '../src/request-checkpoints.js';
import { analyzeBrand } from '../src/analyze.js';
import { getColorProposals } from '../src/colors.js';
import { buildBrandReport } from '../src/report.js';
import { suggestDirections } from '../src/brief.js';
import { briefFixture } from './helpers/brief.js';
const require = createRequire(import.meta.url);
const { JobStore, digest } = require('../desktop/jobs.cjs');
const { Pipeline } = require('../desktop/pipeline.cjs');
const { Workspace } = require('../desktop/workspace.cjs');
const rootPath = () => fs.mkdtempSync(path.join(fs.realpathSync.native(tmpdir()), 'pipeline-test-'));
function cleanup(t, root) { t.after(() => {
  assert.equal(path.dirname(root), fs.realpathSync.native(tmpdir()));
  assert.ok(path.basename(root).startsWith('pipeline-test-') || path.basename(root).startsWith('brand-p0-test-'));
  fs.rmSync(root, { recursive: true, force: true });
}); }
function openai(value) { return Response.json({ id: 'resp_synthetic', model: 'gpt-6-luna', status: 'completed',
  usage: { input_tokens: 55, output_tokens: 8 }, output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(value) }] }] }); }
async function fixture(t, faults = {}) {
  const f = await profileFixture(); cleanup(t, f.root);
  const sourceFile = path.join(f.root, 'instagram-source.json'), source = JSON.parse(fs.readFileSync(sourceFile));
  source.profile.avatar = { kind: 'image', assetPath: 'assets/avatar.png', remoteUrl: 'https://scontent.cdninstagram.com/avatar.png' };
  source.profile.externalUrls = [];
  source.posts[0].media = [{ id: 'media-1', kind: 'image', assetPath: 'assets/product.jpg', remoteUrl: 'https://scontent.cdninstagram.com/product.jpg' }];
  fs.writeFileSync(sourceFile, JSON.stringify(source));
  const root = rootPath();
  const workspace = new Workspace(path.join(root, 'workspace'));
  const id = workspace.create('Example Studio', 'https://www.instagram.com/example_studio/').active;
  const input = path.join(workspace.project(id).directory, 'data', 'example_studio');
  fs.cpSync(f.root, input, { recursive: true });
  let calls = 0, revision = 'synthetic';
  const fetchImpl = async (_url, options) => {
    calls++; const schema = JSON.parse(options.body).text.format.name;
    if (schema === 'brand_inferences') return openai({ inferences: f.analysis.inferences.map(({ id, ...item }) => item) });
    if (schema === 'brand_color_candidates') return openai(f.colors.candidates);
    if (schema === 'report_translation') {
      const body = JSON.parse(options.body); return openai({ translations: JSON.parse(body.input[1].content).map(({ key }) => ({ key, text: 'Translated synthetic text.' })) });
    }
    throw new Error('Unexpected request');
  };
  const store = new JobStore(path.join(root, 'jobs'), { resolveProject: id => workspace.project(id), ...faults.store });
  t.after(() => store.close()); cleanup(t, root);
  const pipeline = new Pipeline(store, { credentials: { revision: () => revision, withKey: async (_provider, operation) => operation('synthetic-private-token') }, fetchImpl, ...faults.pipeline });
  const plan = options => pipeline.plan(id, { taskId: randomUUID(), includePackage: true, ...options });
  return { ...f, root, workspace, id, input, store, pipeline, plan, calls: () => calls, changeConfiguration: () => { revision = 'changed'; } };
}

test('actual standalone analysis retains raw response and usage after schema failure', async t => {
  const f = await profileFixture(); cleanup(t, f.root);
  const before = fs.readFileSync(path.join(f.root, 'brand-analysis.json'));
  await assert.rejects(analyzeBrand(f.prepared, { token: 'private-key', fetchImpl: async () => openai({ inferences: [] }) }), /topics/);
  const root = path.join(f.root, 'runs', 'requests'), file = fs.readdirSync(root).find(name => !name.includes('.response.'));
  const record = JSON.parse(fs.readFileSync(path.join(root, file)));
  assert.equal(record.usage.input_tokens, 55); assert.equal(record.state, 'saved');
  assert.equal(record.billing, null); assert.ok(!JSON.stringify(record).includes('private-key'));
  assert.deepEqual(fs.readFileSync(path.join(f.root, 'brand-analysis.json')), before);
});

test('response write failure retains billing and a known remote identity without another request', async t => {
  const root = rootPath(); cleanup(t, root); let calls = 0;
  const transport = requestCheckpoints(root, 'ingestion', async () => { calls++; return Response.json({ data: { id: 'runKnown', usageTotalUsd: 0.02 } }); },
    { fault: point => { if (point === 'request-before-response-save') throw new Error('disk-full'); } });
  await assert.rejects(transport('https://api.apify.com/v2/actors/example/runs', { method: 'POST' }), /disk-full/);
  const record = JSON.parse(fs.readFileSync(path.join(root, fs.readdirSync(root).find(name => name.endsWith('.json')))));
  assert.equal(record.responseId, 'runKnown'); assert.equal(record.billing.amount, 0.02); assert.equal(record.state, 'observed');
  const fresh = requestCheckpoints(root, 'ingestion', async () => { calls++; throw new Error('unexpected'); }, { replay: [record.id], replayOnly: true });
  await assert.rejects(fresh('https://api.apify.com/v2/actors/example/runs', { method: 'POST' }), /reconciliation/); assert.equal(calls, 1);
});

test('valid saved response is replayed under the same identity and fingerprint with no dispatch', async t => {
  const root = rootPath(); cleanup(t, root); let calls = 0;
  const url = 'https://api.openai.com/v1/responses', options = { method: 'POST', body: '{"model":"synthetic"}', headers: { authorization: 'private' } };
  const fetchImpl = async () => { calls++; return openai({ inferences: [] }); };
  await requestCheckpoints(root, 'analysis', fetchImpl)(url, options);
  const id = fs.readdirSync(root).find(name => !name.includes('.response.')).replace('.json', '');
  const restore = requestCheckpoints(root, 'analysis', fetchImpl, { replay: [id], replayOnly: true });
  assert.equal((await (await restore(url, options)).json()).usage.input_tokens, 55);
  assert.equal(calls, 1); await assert.rejects(restore(url, { ...options, body: 'changed' }), /cannot dispatch/);
});

test('a provider which echoes a credential cannot copy it into response files or metadata', async t => {
  const root = rootPath(); cleanup(t, root);
  const token = 'synthetic-sensitive-credential';
  const transport = requestCheckpoints(root, 'analysis', async () => Response.json({ model: token, usage: { input_tokens: 7 }, output: token }));
  await assert.rejects(transport('https://api.openai.com/v1/responses', { method: 'POST', headers: { authorization: `Bearer ${token}` } }), /credential/);
  for (const file of fs.readdirSync(root)) assert.ok(!fs.readFileSync(path.join(root, file), 'utf8').includes(token));
  const record = JSON.parse(fs.readFileSync(path.join(root, fs.readdirSync(root)[0])));
  assert.equal(record.state, 'observed'); assert.equal(record.usage.input_tokens, 7); assert.equal(record.model, null);
});

test('core stages produce an immutable completed report and leave managed input unchanged', async t => {
  const f = await fixture(t), job = f.plan(), before = fs.readFileSync(path.join(f.input, 'brand-analysis.json'));
  const result = await f.pipeline.run(job.id, f.pipeline.authorize(job.id, job.planHash));
  assert.equal(result.state, 'completed'); assert.equal(f.calls(), 2);
  assert.ok(f.pipeline.stages(job.id).some(stage => stage.name === 'report' && stage.state === 'completed'));
  assert.deepEqual(fs.readFileSync(path.join(f.input, 'brand-analysis.json')), before);
  const snapshot = f.store.db.prepare('SELECT * FROM snapshots WHERE id=?').get(result.output);
  assert.ok(fs.existsSync(path.join(f.store.snapshotPath(snapshot), 'payload/data/example_studio/brand-report.html')));
});

test('stage write failure recovers saved responses under the original job without paid retry', async t => {
  let fail = true;
  const f = await fixture(t, { pipeline: { fault: point => { if (point === 'stage-analysis-before-checkpoint' && fail) throw new Error('disk-full'); } } });
  const job = f.plan(); await assert.rejects(f.pipeline.run(job.id, f.pipeline.authorize(job.id, job.planHash)), /disk-full/);
  assert.equal(f.calls(), 1); assert.equal(f.store.view(job.id).state, 'failed');
  assert.equal(f.pipeline.requests(job.id)[0].usage.input_tokens, 55);
  await assert.rejects(f.pipeline.run(job.id, 'unused'), /new-plan/);
  // Recovery cannot buy the not-yet-called colors stage. Preserve the analysis
  // checkpoint and ask for a new plan before any additional paid work.
  fail = false;
  await assert.rejects(f.pipeline.run(job.id, f.pipeline.authorize(job.id, job.planHash), { recovery: true }), /cannot dispatch/);
  assert.equal(f.calls(), 1); assert.equal(f.pipeline.stages(job.id).find(s => s.name === 'analysis').state, 'completed');
});

test('report failure never completes the parent; local recovery reuses all paid responses', async t => {
  let fail = true;
  const f = await fixture(t, { pipeline: { fault: point => { if (point === 'stage-report-before-checkpoint' && fail) throw new Error('report-write'); } } });
  const job = f.plan(); await assert.rejects(f.pipeline.run(job.id, f.pipeline.authorize(job.id, job.planHash)), /report-write/);
  assert.equal(f.calls(), 2); assert.equal(f.store.view(job.id).state, 'failed');
  assert.equal(f.pipeline.stages(job.id).find(s => s.name === 'compilation').state, 'completed');
  fail = false; const result = await f.pipeline.run(job.id, f.pipeline.authorize(job.id, job.planHash), { recovery: true });
  assert.equal(result.state, 'completed'); assert.equal(f.calls(), 2);
});

test('limits and changed credentials reject further dispatch; explicit retry needs fresh authorization', async t => {
  const f = await fixture(t), job = f.plan({ maxPaidCalls: 1 });
  await assert.rejects(f.pipeline.run(job.id, f.pipeline.authorize(job.id, job.planHash)), /request-limit/); assert.equal(f.calls(), 1);
  const next = f.store.retryJob(job.id, job.planHash);
  await assert.rejects(f.pipeline.run(next.id, 'old-authorization'), /stale-authorization/); assert.equal(f.calls(), 1);
  f.changeConfiguration(); assert.throws(() => f.pipeline.authorize(next.id, next.planHash), /stale-authorization/);
});

test('stopping dispatch during a remote request retains its response but blocks the next call', async t => {
  const f = await fixture(t), job = f.plan(); const original = f.pipeline.fetchImpl;
  const otherProject = f.workspace.create('Other synthetic', 'https://www.instagram.com/other_studio/').active;
  const other = f.store.createJob(otherProject, { taskId: randomUUID(), operation: 'analyze', provider: 'fake', model: 'synthetic', configRevision: digest('synthetic'), taskRevision: 1 });
  const permission = f.store.authorize(other.id, other.planHash); let foreignCalls = 0;
  f.pipeline.fetchImpl = async (...args) => {
    await assert.rejects(f.store.dispatch(other.id, permission, async () => { foreignCalls++; return { remoteId: 'synthetic' }; }), /writer-busy/);
    const response = await original(...args); f.pipeline.stop(job.id); return response;
  };
  await assert.rejects(f.pipeline.run(job.id, f.pipeline.authorize(job.id, job.planHash)), /dispatch-stopped/);
  assert.equal(f.calls(), 1); assert.equal(foreignCalls, 0); assert.equal(f.pipeline.requests(job.id)[0].state, 'saved');
});

test('standalone colors, directions and English translation retain consumption before semantic validation', async t => {
  const f = await briefFixture(); cleanup(t, f.root);
  const originalColors = fs.readFileSync(path.join(f.root, 'color-proposals.json'));
  const bad = async () => openai({ primary: {}, secondary: {}, directions: [], translations: [] });
  await assert.rejects(getColorProposals(f.prepared, f.analysis, { force: true, token: 'private', fetchImpl: bad }), /candidates/);
  await assert.rejects(suggestDirections(f.root, { token: 'private', fetchImpl: bad }), /direction|Direction/);
  await assert.rejects(buildBrandReport(f.root, { language: 'en', token: 'private', fetchImpl: bad }), /every text/);
  const directory = path.join(f.root, 'runs', 'requests');
  const records = fs.readdirSync(directory).filter(file => !file.includes('.response.')).map(file => JSON.parse(fs.readFileSync(path.join(directory, file))));
  assert.deepEqual(records.map(r => r.stage).sort(), ['colors', 'directions', 'translation']);
  assert.ok(records.every(r => r.usage.input_tokens === 55 && r.state === 'saved'));
  assert.deepEqual(fs.readFileSync(path.join(f.root, 'color-proposals.json')), originalColors);
});

test('English report and cross-task reuse preserve actual request IDs; review-only changes do not buy more analysis', async t => {
  const f = await fixture(t), job = f.plan({ language: 'en' });
  await f.pipeline.run(job.id, f.pipeline.authorize(job.id, job.planHash)); assert.equal(f.calls(), 3);
  const observations = f.pipeline.requests(job.id);
  assert.deepEqual(observations.map(r => r.stage), ['analysis', 'colors', 'report']);
  assert.ok(observations.every(r => /^run-/.test(r.observationRef)));
  // A new local task can reuse validated derived files while source/review stay equal.
  const next = f.plan({ language: 'en', maxPaidCalls: 0 });
  await f.pipeline.run(next.id, f.pipeline.authorize(next.id, next.planHash)); assert.equal(f.calls(), 3);
  assert.equal(f.pipeline.requests(next.id).length, 0);
});

test('export failure retains the compiled package and the prior valid completed output', async t => {
  const f = await fixture(t), job = f.plan();
  const complete = await f.pipeline.run(job.id, f.pipeline.authorize(job.id, job.planHash));
  const next = f.plan({ taskId: job.task, taskRevision: 2, includeExport: true, maxPaidCalls: 0 });
  await assert.rejects(f.pipeline.run(next.id, f.pipeline.authorize(next.id, next.planHash)), /ENOENT/);
  assert.equal(f.store.view(next.id).state, 'failed'); assert.equal(f.store.view(job.id).state, 'completed');
  assert.ok(f.store.validSnapshot(f.store.db.prepare('SELECT * FROM snapshots WHERE id=?').get(complete.output)));
  assert.equal(f.pipeline.stages(next.id).find(s => s.name === 'compilation').state, 'completed'); assert.equal(f.calls(), 2);
});

test('explicit Apify lookup retrieves only the same run and keeps uncertain unsupported calls manual', async t => {
  let fail = true;
  const f = await fixture(t, { pipeline: { fault: point => { if (point === 'request-before-response-save' && fail) throw new Error('disk-full'); } } });
  const job = f.plan({ refresh: true });
  const calls = [];
  f.pipeline.fetchImpl = async (url, options) => { calls.push({ url: String(url), method: options.method || 'GET' });
    if (options.method === 'POST') return Response.json({ data: { id: 'runKnown', status: 'RUNNING', usageTotalUsd: 0.01 } });
    return Response.json({ data: { id: 'runKnown', status: 'SUCCEEDED', usageTotalUsd: 0.03 } }); };
  await assert.rejects(f.pipeline.run(job.id, f.pipeline.authorize(job.id, job.planHash)), /disk-full/);
  const original = f.pipeline.requests(job.id)[0]; assert.equal(original.state, 'observed');
  fail = false; const result = await f.pipeline.reconcileApify(job.id, original.id, job.planHash);
  assert.equal(result.requestId, original.id); assert.equal(calls.length, 2); assert.equal(calls[1].method, 'GET');
  const updated = f.pipeline.requests(job.id); assert.equal(updated[0].id, original.id); assert.equal(updated[0].state, 'saved');
  assert.equal(updated[1].lookupOf, original.id); assert.equal(updated[1].billing.amount, 0.03);
  assert.equal(updated[1].billingSemantics, 'cumulative-run-total');
  await assert.rejects(f.pipeline.reconcileApify(job.id, randomUUID(), job.planHash), /manual-reconciliation/);
});

test('a color configuration change reuses analysis and only repeats the affected vision stage', async t => {
  const f = await fixture(t), job = f.plan();
  await f.pipeline.run(job.id, f.pipeline.authorize(job.id, job.planHash)); assert.equal(f.calls(), 2);
  const revisions = f.pipeline.revisions.bind(f.pipeline);
  f.pipeline.revisions = () => ({ ...revisions(), colors: 'synthetic-new-color-configuration' });
  const next = f.plan({ maxPaidCalls: 1 });
  await f.pipeline.run(next.id, f.pipeline.authorize(next.id, next.planHash));
  assert.equal(f.calls(), 3); assert.deepEqual(f.pipeline.requests(next.id).map(r => r.stage), ['colors']);
});

test('the confirmed data limit rejects an oversized outbound request before network dispatch', async t => {
  const f = await fixture(t), job = f.plan({ maxInputBytes: 0 });
  const preview = await f.pipeline.preview(job.id); assert.equal(preview.stages[0].mode, 'cache');
  await assert.rejects(f.pipeline.run(job.id, f.pipeline.authorize(job.id, job.planHash)), /input-limit/);
  assert.equal(f.calls(), 0); assert.equal(f.pipeline.requests(job.id).length, 0);
});

test('the default app pipeline is consumer-neutral and changed source cannot reuse stale analysis', async t => {
  const f = await fixture(t);
  const job = f.pipeline.plan(f.id, { taskId: randomUUID() });
  const complete = await f.pipeline.run(job.id, f.pipeline.authorize(job.id, job.planHash));
  assert.equal(complete.state, 'completed'); assert.equal(f.calls(), 2);
  assert.ok(!f.pipeline.stages(job.id).some(stage => stage.name === 'compilation'));
  const source = path.join(f.input, 'instagram-source.json'), current = JSON.parse(fs.readFileSync(source));
  current.profile.biography = 'Changed synthetic evidence.'; fs.writeFileSync(source, JSON.stringify(current));
  const next = f.pipeline.plan(f.id, { taskId: randomUUID(), maxPaidCalls: 0 });
  await assert.rejects(f.pipeline.run(next.id, f.pipeline.authorize(next.id, next.planHash)), /request-limit/);
  assert.equal(f.calls(), 2); assert.equal(f.store.view(job.id).state, 'completed');
});
