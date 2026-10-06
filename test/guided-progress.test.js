import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { projectSpend, formatMoney, projectStages } from '../src/spend-projection.js';
import { createRunRecord } from '../src/run-record.js';
import { profileFixture } from './helpers/profile.js';

const require = createRequire(import.meta.url);
const { JobStore } = require('../desktop/jobs.cjs');
const { Pipeline } = require('../desktop/pipeline.cjs');
const { Workspace } = require('../desktop/workspace.cjs');
const { TaskAuthority } = require('../desktop/task-authority.cjs');
const { Deliveries } = require('../desktop/deliveries.cjs');
const { GuidedBroker, validGuidedRequest, notificationCopy, availableInventory } = require('../desktop/guided.cjs');

const rootPath = () => fs.mkdtempSync(path.join(fs.realpathSync.native(tmpdir()), 'guided-test-'));
function cleanup(t, root) {
  t.after(() => {
    assert.equal(path.dirname(root), fs.realpathSync.native(tmpdir()));
    assert.ok(path.basename(root).startsWith('guided-test-') || path.basename(root).startsWith('brand-p0-test-'));
    fs.rmSync(root, { recursive: true, force: true });
  });
}
function openai(value) {
  return Response.json({
    id: 'resp_synthetic', model: 'gpt-6-luna', status: 'completed',
    usage: { input_tokens: 55, output_tokens: 8, input_tokens_details: { cached_tokens: 10 }, output_tokens_details: { reasoning_tokens: 2 } },
    output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(value) }] }],
  });
}
function bill(amount, currency = 'USD', source = 'synthetic-provider-observation') {
  return { amount, currency, source };
}
function attempt(id, phase, number, provider, billing = null, status = 'completed', usage = null) {
  return {
    id: `${id}-${phase}-${number}`, status, provider,
    model: provider === 'openai' ? 'synthetic-vision-model' : null,
    usage: usage ?? (provider === 'openai' && status === 'completed'
      ? { input_tokens: 800, output_tokens: 240, total_tokens: 1040, input_tokens_details: { cached_tokens: 200 }, output_tokens_details: { reasoning_tokens: 60 } }
      : null),
    billing, wallMs: status === 'attempted' ? null : 4000, humanMinutes: null,
  };
}
function phase(id, name, status = 'completed', mode = 'local', attempts = []) {
  return { id: `${id}-${name}`, name, status, mode, attempts, wallMs: status === 'running' ? null : 5000 };
}
function record(id, phases, status = 'complete') {
  return { schemaVersion: 'brand-run/v1', id, status, phases, options: { refresh: false, reanalyze: false, postLimit: 20 } };
}

async function appFixture(t) {
  const f = await profileFixture(); cleanup(t, f.root);
  const sourceFile = path.join(f.root, 'instagram-source.json');
  const source = JSON.parse(fs.readFileSync(sourceFile));
  source.profile.avatar = { kind: 'image', assetPath: 'assets/avatar.png', remoteUrl: 'https://scontent.cdninstagram.com/avatar.png' };
  source.profile.externalUrls = [];
  source.posts[0].media = [{ id: 'media-1', kind: 'image', assetPath: 'assets/product.jpg', remoteUrl: 'https://scontent.cdninstagram.com/product.jpg' }];
  fs.writeFileSync(sourceFile, JSON.stringify(source));
  const root = rootPath(); cleanup(t, root);
  const workspace = new Workspace(path.join(root, 'workspace'));
  const id = workspace.create('Example Studio', 'https://www.instagram.com/example_studio/').active;
  const input = path.join(workspace.project(id).directory, 'data', 'example_studio');
  fs.cpSync(f.root, input, { recursive: true });
  let revision = 'synthetic';
  const fetchImpl = async (_url, options) => {
    const schema = JSON.parse(options.body).text.format.name;
    if (schema === 'brand_inferences') return openai({ inferences: f.analysis.inferences.map(({ id: _id, ...item }) => item) });
    if (schema === 'brand_color_candidates') return openai(f.colors.candidates);
    throw new Error('Unexpected request');
  };
  const store = new JobStore(path.join(root, 'jobs'), { resolveProject: projectId => workspace.project(projectId) });
  t.after(() => { try { store.close(); } catch { /* Closed earlier for reopen proofs. */ } });
  const pipeline = new Pipeline(store, {
    credentials: { revision: () => revision, withKey: async (_provider, operation) => operation('synthetic-private-token') },
    fetchImpl,
  });
  const authority = new TaskAuthority(store);
  const deliveries = new Deliveries(store);
  let notifications = [];
  const guided = new GuidedBroker({
    store, pipeline, authority, deliveries,
    dialog: { showOpenDialog: async () => ({ canceled: true, filePaths: [] }) },
    window: () => ({}),
    authorized: () => true,
    notify: payload => { notifications.push(payload); },
  });
  return {
    root, workspace, id, input, store, pipeline, authority, deliveries, guided, notifications,
    changeConfiguration: () => { revision = 'changed'; },
    plan: options => pipeline.plan(id, { taskId: randomUUID(), includePackage: true, includeReport: true, ...options }),
  };
}

test('formatMoney keeps tiny positives distinct from zero', () => {
  assert.equal(formatMoney(0), '0');
  assert.notEqual(formatMoney(0.000000004), '0');
  assert.equal(formatMoney(0.15), '0.15');
});

test('null billing stays null; returned zero and tiny amounts retain meaning; mixed currencies stay separate', () => {
  const id = 'run-synthetic-observed';
  const records = [record(id, [
    phase(id, 'ingestion', 'completed', 'provider', [attempt(id, 'ingestion', 1, 'apify', bill(0.18))]),
    phase(id, 'evidence'),
    phase(id, 'analysis', 'completed', 'provider', [attempt(id, 'analysis', 1, 'openai', bill(0.12, 'EUR'))]),
  ])];
  const summary = projectSpend({ records });
  assert.deepEqual(summary.byCurrency, { USD: 0.18, EUR: 0.12 });
  assert.equal(summary.totalCost, null);
  assert.equal(summary.percentage, null);
  assert.equal(summary.estimatedRemaining, null);
  records[0].phases[2].attempts[0].billing = null;
  const missing = projectSpend({ records });
  assert.equal(missing.unknownBilling, 1);
  assert.equal(missing.partial, true);
  assert.equal(missing.observations[1].billing, null);
  records[0].phases[0].attempts[0].billing.amount = 0;
  assert.equal(projectSpend({ records }).byCurrency.USD, 0);
  records[0].phases[0].attempts[0].billing.amount = 0.000000004;
  assert.notEqual(formatMoney(projectSpend({ records }).byCurrency.USD), '0');
});

test('shared preparation and identical records count each attempt once; token subsets are not added twice', () => {
  const id = 'run-synthetic-shared';
  const records = [record(id, [
    phase(id, 'ingestion', 'completed', 'provider', [attempt(id, 'ingestion', 1, 'apify', bill(0.15)), attempt(id, 'ingestion', 2, 'apify', bill(0.20))]),
    phase(id, 'evidence'),
    phase(id, 'analysis', 'completed', 'provider', [attempt(id, 'analysis', 1, 'openai')]),
    phase(id, 'colors', 'completed', 'provider', [attempt(id, 'colors', 1, 'openai')]),
    phase(id, 'compilation'),
  ])];
  const before = projectSpend({ records });
  assert.deepEqual(projectSpend({ records: [...records, ...records] }), before);
  assert.equal(before.byCurrency.USD, 0.35);
  assert.equal(before.usageByModel['openai/synthetic-vision-model'].input, 1600);
  assert.equal(before.usageByModel['openai/synthetic-vision-model'].output, 480);
  const obs = before.observations.find(row => row.phase === 'analysis');
  assert.equal(obs.usage.input_tokens_details.cached_tokens, 200);
  assert.equal(obs.usage.output_tokens_details.reasoning_tokens, 60);
});

test('conflicting IDs and malformed amounts or usage reject aggregation', () => {
  const id = 'run-synthetic-conflict';
  const base = [record(id, [
    phase(id, 'ingestion', 'completed', 'provider', [attempt(id, 'ingestion', 1, 'apify', bill(0.18))]),
  ])];
  const changed = structuredClone(base);
  changed[0].phases[0].attempts[0].billing.amount = 99;
  assert.throws(() => projectSpend({ records: [...base, ...changed] }), /CONFLICTING_OBSERVATION/);
  for (const amount of [-1, Infinity, NaN]) {
    const bad = structuredClone(base);
    bad[0].phases[0].attempts[0].billing.amount = amount;
    assert.throws(() => projectSpend({ records: bad }), /INVALID_BILLING/);
  }
  const usage = structuredClone(base);
  usage[0].phases[0].attempts[0].usage = { input_tokens: 1, input_tokens_details: { cached_tokens: '<img>' } };
  assert.throws(() => projectSpend({ records: usage }), /INVALID_USAGE/);
});

test('wall time and human effort stay separate; unfinished journals still project for UI', async t => {
  const root = rootPath(); cleanup(t, root);
  const journal = await createRunRecord(root, { refresh: false, reanalyze: false, postLimit: 20 });
  await assert.rejects(journal.phase('analysis', async ({ observe }) => {
    await observe({ event: 'start', key: 'request', provider: 'synthetic', model: 'synthetic-model' });
    await observe({ event: 'response', key: 'request', usage: { input_tokens: 12, output_tokens: 3 }, billing: bill(0.1) });
    await observe({ event: 'end', key: 'request', status: 'completed' });
    throw new Error('SYNTHETIC_VALIDATION_FAILURE');
  }), /SYNTHETIC_VALIDATION_FAILURE/);
  const active = projectSpend({ records: [journal.record] });
  assert.equal(active.byCurrency.USD, 0.1);
  assert.equal(active.humanMinutes, null);
  assert.ok(active.suppliedAttemptWallMs == null || Number.isFinite(active.suppliedAttemptWallMs));
  const withHuman = projectSpend({
    efforts: [{
      observation: {
        provider: 'fictional-agent', attemptId: 'request-1', kind: 'review',
        wallMs: 1200, humanMinutes: 5,
        usage: { inputTokens: 10, outputTokens: 2 },
        billing: { chargeId: 'bill-1', amount: 0.02, currency: 'USD', basis: 'returned-bill' },
      },
    }],
  });
  assert.equal(withHuman.humanMinutes, 5);
  assert.equal(withHuman.suppliedAttemptWallMs, 1200);
  assert.notEqual(withHuman.humanMinutes, withHuman.suppliedAttemptWallMs / 60000);
});

test('projectStages never invent percentages and mark unreached stages', () => {
  const stages = projectStages(['ingestion', 'evidence', 'analysis'], [{ name: 'ingestion', state: 'completed' }], 'review-required');
  assert.equal(stages[0].status, 'completed');
  assert.equal(stages[2].status, 'not-reached');
  assert.equal(stages.every(stage => !('percent' in stage)), true);
});

test('scoped authorization binds plan hash; stale consent and reopen never dispatch', async t => {
  const f = await appFixture(t);
  const job = f.plan({ includePackage: false });
  assert.equal(job.state, 'queued');
  assert.equal(job.nextAction, 'authorize');
  const denied = await f.guided.handle({ action: 'authorize', projectId: f.id, jobId: job.id, planHash: job.planHash, consent: false });
  assert.equal(denied.ok, false);
  assert.equal(denied.code, 'consent-required');
  const authorized = await f.guided.handle({ action: 'authorize', projectId: f.id, jobId: job.id, planHash: job.planHash, consent: true });
  assert.equal(authorized.ok, true);
  f.changeConfiguration();
  const stale = await f.guided.handle({ action: 'run', projectId: f.id, jobId: job.id, planHash: job.planHash, authorization: authorized.authorization, recovery: false });
  assert.equal(stale.ok, false);
  assert.equal(stale.code, 'stale-authorization');
  const status = await f.guided.handle({ action: 'status', projectId: f.id });
  assert.equal(status.ok, true);
  assert.equal(status.progress.reopenDispatches, false);
  assert.equal(status.progress.cancellationSupported, false);
  assert.equal(status.progress.spend.percentage, null);
  // Fresh status/read never consumes authorization or starts work.
  assert.equal(f.store.view(job.id).state, 'queued');
});

test('worker interrupt and store reopen show interrupted state with partial inventory semantics', async t => {
  const f = await appFixture(t);
  const job = f.plan({ includePackage: false });
  const auth = f.pipeline.authorize(job.id, job.planHash);
  // Simulate abrupt writer end: close marks running intent uncertain and jobs interrupted on next open.
  f.store.db.prepare("UPDATE jobs SET state='running',epoch=? WHERE id=?").run('synthetic-epoch', job.id);
  f.store.close();
  const store = new JobStore(path.join(f.root, 'jobs'), { resolveProject: id => f.workspace.project(id) });
  t.after(() => { try { store.close(); } catch {} });
  const recovered = store.view(job.id);
  assert.equal(recovered.state, 'interrupted');
  const pipeline = new Pipeline(store, {
    credentials: { revision: () => 'synthetic', withKey: async (_p, op) => op('synthetic-private-token') },
    fetchImpl: async () => { throw new Error('reopen-must-not-dispatch'); },
  });
  const guided = new GuidedBroker({
    store, pipeline, authority: new TaskAuthority(store), deliveries: new Deliveries(store),
    dialog: { showOpenDialog: async () => ({ canceled: true, filePaths: [] }) },
    window: () => ({}), authorized: () => true,
  });
  const status = await guided.handle({ action: 'status', projectId: f.id });
  assert.equal(status.ok, true);
  assert.equal(status.progress.job.state, 'interrupted');
  assert.equal(status.progress.reopenDispatches, false);
  assert.ok(Array.isArray(status.progress.stages));
  assert.ok(Array.isArray(status.progress.available));
  // Reopening never consumes the old authorization or starts dispatch.
  await assert.rejects(pipeline.run(job.id, auth), /stale|authorization|paid-retry|invalid-recovery/i);
});

test('local completed run projects stages and available inventory without fake progress', async t => {
  const f = await appFixture(t);
  const job = f.plan({ includePackage: true, includeReport: true });
  const auth = f.pipeline.authorize(job.id, job.planHash);
  const completed = await f.pipeline.run(job.id, auth);
  assert.equal(completed.state, 'completed');
  const status = await f.guided.handle({ action: 'status', projectId: f.id });
  assert.equal(status.ok, true);
  assert.equal(status.progress.job.state, 'completed');
  assert.ok(status.progress.stages.some(stage => stage.status === 'completed'));
  assert.ok(status.progress.available.length >= 1);
  assert.equal(status.progress.spend.percentage, null);
  assert.equal(status.progress.spend.estimatedRemaining, null);
  const serialized = JSON.stringify(status.progress);
  assert.ok(!serialized.includes('synthetic-private-token'));
  assert.ok(!serialized.includes(f.input));
  assert.ok(!serialized.includes('example_studio') || !/\/data\//.test(serialized));
});

test('stop does not claim remote cancellation; notifications stay allowlisted', async t => {
  const f = await appFixture(t);
  const job = f.plan({ includePackage: false });
  const stopped = await f.guided.handle({ action: 'stop', projectId: f.id, jobId: job.id });
  assert.equal(stopped.ok, true);
  assert.equal(stopped.cancellationSupported, false);
  assert.equal(notificationCopy('stopped'), 'No se enviarán más solicitudes desde esta app.');
  assert.ok(f.notifications.every(item => item.title === 'Instagram to OpenDesign' && !item.body.includes('/')));
});

test('retry creates a new plan hash and does not inherit authorization', async t => {
  const f = await appFixture(t);
  const job = f.plan({ includePackage: false });
  const auth = f.pipeline.authorize(job.id, job.planHash);
  f.store.setState(job.id, 'failed');
  const retried = await f.guided.handle({ action: 'retry', projectId: f.id, jobId: job.id, planHash: job.planHash });
  assert.equal(retried.ok, true);
  assert.notEqual(retried.job.planHash, job.planHash);
  assert.equal(retried.job.state, 'queued');
  assert.equal(retried.job.nextAction, 'authorize');
  await assert.rejects(f.pipeline.run(job.id, auth), /stale|authorization|paid-retry|job/i);
  await assert.rejects(f.pipeline.run(retried.job.id, auth), /stale|authorization|paid-retry|job/i);
});

test('guided request validation rejects malformed shapes and unknown actions', () => {
  assert.equal(validGuidedRequest({ action: 'status' }), false);
  assert.equal(validGuidedRequest({ action: 'status', projectId: 'nope' }), false);
  assert.equal(validGuidedRequest({ action: 'status', projectId: randomUUID(), extra: true }), false);
  assert.equal(validGuidedRequest({ action: 'authorize', projectId: randomUUID(), jobId: randomUUID(), planHash: 'a'.repeat(64), consent: true }), true);
  assert.equal(validGuidedRequest({ action: 'run-anything', projectId: randomUUID() }), false);
});

test('authority preview and create are exposed without publication claims', async t => {
  const f = await appFixture(t);
  const created = await f.guided.handle({
    action: 'authority-create',
    projectId: f.id,
    request: {
      schemaVersion: 'exploration-request/v1',
      username: 'example_studio',
      kind: 'instagram-story',
      objective: 'Explore a synthetic product story.',
      candidateCopy: [],
      assetIds: [],
      inferenceIds: [],
    },
  });
  assert.equal(created.ok, true);
  assert.ok(created.task.id);
  const preview = await f.guided.handle({ action: 'authority-preview', projectId: f.id, taskId: created.task.id });
  assert.equal(preview.ok, true);
  assert.equal(typeof preview.preview.publicationCurrent, 'boolean');
  const history = await f.guided.handle({ action: 'delivery-history', projectId: f.id });
  assert.equal(history.ok, true);
  assert.equal(history.history.publicationAllowed, false);
});

test('availableInventory only lists valid snapshots', async t => {
  const f = await appFixture(t);
  const job = f.plan({ includePackage: false });
  assert.deepEqual(availableInventory(f.store, f.store.job(job.id)), []);
});

test('notification copy and accessibility contracts stay allowlisted', () => {
  for (const kind of ['planned', 'authorized', 'running', 'stopped', 'completed', 'interrupted', 'failed', 'stale']) {
    const body = notificationCopy(kind);
    assert.ok(body);
    assert.equal(/[/\\]|token|key|Bearer|C:\\|Users\\/i.test(body), false);
  }
  const html = fs.readFileSync(new URL('../desktop/ui/index.html', import.meta.url), 'utf8');
  assert.match(html, /href="#main"/);
  assert.match(html, /id="consent-dialog"/);
  assert.match(html, /id="authorize"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /role="alert"/);
  assert.match(html, /Próxima acción/);
  assert.match(html, /Etapas/);
  assert.match(html, /Disponible/);
  assert.match(html, /Gasto registrado/);
  const css = fs.readFileSync(new URL('../desktop/ui/styles.css', import.meta.url), 'utf8');
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /forced-colors/);
});

test('diagnostic responses never include secrets, paths or raw payloads', async t => {
  const f = await appFixture(t);
  const result = await f.guided.handle({
    action: 'run',
    projectId: f.id,
    jobId: randomUUID(),
    planHash: 'b'.repeat(64),
    authorization: randomUUID(),
    recovery: false,
  });
  assert.equal(result.ok, false);
  assert.deepEqual(Object.keys(result).sort(), ['action', 'code', 'ok']);
  assert.ok(!JSON.stringify(result).includes('synthetic-private-token'));
});
