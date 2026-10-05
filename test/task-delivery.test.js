import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { briefFixture, fixtureDirections } from './helpers/brief.js';
import { prepareBrief } from '../src/brief.js';
import { verifyAgentHandoff } from '../src/agent-handoff.js';
import { digest } from '../src/local.js';
import { publicationChecks } from '../src/task-authority.js';
const require = createRequire(import.meta.url);
const { Workspace } = require('../desktop/workspace.cjs');
const { JobStore } = require('../desktop/jobs.cjs');
const { TaskAuthority } = require('../desktop/task-authority.cjs');
const { Deliveries } = require('../desktop/deliveries.cjs');
const write = (file, value) => fs.writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value));
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
async function fixture(t, approve = true) {
  const source = await briefFixture('instagram-story'); t.after(source.cleanup);
  const root = fs.mkdtempSync(path.join(fs.realpathSync.native(tmpdir()), 'delivery-test-'));
  const workspace = new Workspace(path.join(root, 'workspace'));
  const project = workspace.create('Synthetic delivery studio', 'https://www.instagram.com/example_studio/').active;
  const directory = workspace.project(project).directory, input = path.join(directory, 'data/example_studio');
  fs.cpSync(source.root, input, { recursive: true });
  const stores = [], open = () => { const store = new JobStore(path.join(root, 'jobs'), { resolveProject: id => workspace.project(id) }); stores.push(store); return store; };
  const store = open(), authority = new TaskAuthority(store), broker = new Deliveries(store);
  t.after(() => {
    for (const item of stores) { try { item.close(); } catch {} }
    assert.equal(path.dirname(root), fs.realpathSync.native(tmpdir())); assert.ok(path.basename(root).startsWith('delivery-test-'));
    fs.rmSync(root, { recursive: true });
  });
  const created = await authority.create(project, { schemaVersion: 'exploration-request/v1', username: 'example_studio', kind: 'instagram-story', objective: 'Explore a fictional studio.', candidateCopy: [], assetIds: [], inferenceIds: [] });
  const request = { ...source.request, schemaVersion: 'design-request/v2', inferenceIds: [], pageScope: null };
  const state = await prepareBrief(input, { requestDocument: request }); request.selectedDirectionId = 'D-1';
  const chosen = await authority.select(project, created.taskId, created.revision, request, { schemaVersion: 'creative-directions/v1', inputHash: state.inputHash, directions: fixtureDirections(state.context) });
  const review = approve ? await authority.reviewExecution(project, created.taskId, chosen.revision, chosen.key, { reviewer: 'Synthetic operator', reviewedAt: '2026-01-03T00:00:00Z' }) : null;
  const task = { id: created.taskId, revision: review?.revision ?? chosen.revision };
  async function deliver(recipient = 'generic', select = files => files.filter(row => row.required).map(row => row.path), controller = broker) {
    const preview = await controller.preview(project, task.id, task.revision, recipient);
    const result = await controller.create(project, task.id, task.revision, { recipient, previewHash: preview.previewHash, paths: select(preview.files) });
    return { ...result, preview, folder: path.join(directory, 'deliveries', result.id) };
  }
  return { root, workspace, project, directory, input, store, authority, broker, task, source, deliver, open };
}
test('selected task delivery preserves canonical copy/assets with explicit disclosure and portable readback', async t => {
  const f = await fixture(t), delivered = await f.deliver();
  assert.equal(delivered.mode, 'selected-execution');
  const packet = await verifyAgentHandoff(delivered.folder), brief = read(path.join(delivered.folder, 'design-brief.json'));
  assert.equal(packet.schemaVersion, 'agent-handoff/v2'); assert.equal(packet.publicationAllowed, false);
  assert.deepEqual(brief.request.copy, f.source.request.copy); assert.equal(brief.schemaVersion, 'design-brief/v2');
  assert.ok(brief.sources.every(row => row.path === null && row.included === false));
  assert.ok(brief.evidence.every(row => row.sourcePath === null));
  assert.ok(!packet.files['brand-decisions.json'] && !packet.files['tokens.css'] && !packet.files['instagram-source.json']);
  assert.equal((await f.broker.readback(f.project, delivered.id)).executionCurrent, true);
  const parent = path.join(f.root, 'shared'); fs.mkdirSync(parent);
  const copied = await f.broker.export(f.project, delivered.id, parent);
  assert.equal((await verifyAgentHandoff(path.join(parent, copied.folder))).contextHash, packet.contextHash);
  fs.appendFileSync(path.join(f.input, 'manual/request.md'), '\nChanged current confirmation.');
  const current = await f.broker.readback(f.project, delivered.id);
  assert.equal(current.executionCurrent, false); assert.equal(current.integrity, 'verified');
  await assert.rejects(() => f.broker.export(f.project, delivered.id, parent), /authority-stale/);
  assert.deepEqual(await verifyAgentHandoff(delivered.folder), packet);
});
test('pending review never promotes complete inputs and goal-only tasks cannot execute through export', async t => {
  const f = await fixture(t, false), delivered = await f.deliver();
  assert.equal(delivered.mode, 'exploration-only'); assert.equal((await f.broker.readback(f.project, delivered.id)).executionCurrent, false);
  const draft = await f.authority.create(f.project, { schemaVersion: 'exploration-request/v1', username: 'example_studio', kind: 'conceptual-landing', objective: 'Explore a draft site.', candidateCopy: [], assetIds: [], inferenceIds: [] });
  const preview = await f.broker.preview(f.project, draft.taskId, draft.revision);
  const packet = await f.broker.create(f.project, draft.taskId, draft.revision, { recipient: 'generic', previewHash: preview.previewHash, paths: [] });
  assert.equal(packet.mode, 'exploration-only');
  assert.equal(read(path.join(f.directory, 'deliveries', packet.id, 'design-brief.json')).executionAllowed, false);
});
test('stale preview, omitted assets and changed delivery bytes fail without replacing previous delivery', async t => {
  const f = await fixture(t), delivered = await f.deliver();
  const old = fs.readFileSync(path.join(f.directory, 'delivery-history.json'));
  await assert.rejects(() => f.broker.create(f.project, f.task.id, f.task.revision, { recipient: 'generic', previewHash: delivered.preview.previewHash, paths: [] }), /include every/);
  assert.deepEqual(fs.readFileSync(path.join(f.directory, 'delivery-history.json')), old);
  await assert.rejects(() => f.broker.create(f.project, f.task.id, f.task.revision, { recipient: 'generic', previewHash: '0'.repeat(64), paths: delivered.preview.files.filter(row => row.required).map(row => row.path) }), /preview-stale/);
  write(path.join(delivered.folder, 'BRIEF.md'), 'Changed packet');
  await assert.rejects(() => f.broker.readback(f.project, delivered.id), /bytes-changed/);
  assert.deepEqual(fs.readFileSync(path.join(f.directory, 'delivery-history.json')), old);
});
test('explicit originals are byte-identical; private configuration and recognizable secrets fail closed', async t => {
  const f = await fixture(t), delivered = await f.deliver('generic', files => files.map(row => row.path));
  const packet = await verifyAgentHandoff(delivered.folder);
  assert.ok(Object.keys(packet.files).some(file => file.startsWith('sources/')));
  assert.equal(digest(fs.readFileSync(path.join(delivered.folder, 'sources/S-REQUEST.md'))), digest(fs.readFileSync(path.join(f.input, 'manual/request.md'))));
  write(path.join(f.input, 'private-diagnostics.txt'), 'sk-fictional-only-secret-123456789');
  const selected = await f.deliver();
  assert.ok(!JSON.stringify(await verifyAgentHandoff(selected.folder)).includes('private-diagnostics'));
  const decision = read(path.join(f.input, 'brand-decisions.json'));
  write(path.join(f.input, 'manual/request.md'), 'api_key=synthetic-do-not-share');
  decision.sources[0].sha256 = digest(fs.readFileSync(path.join(f.input, 'manual/request.md'))); write(path.join(f.input, 'brand-decisions.json'), decision);
  const current = await f.authority.preview(f.project, f.task.id); f.task.revision = current.revision;
  const request = read(path.join(f.directory, 'task-authority.json')).tasks.find(task => task.id === f.task.id).request;
  const state = await prepareBrief(f.input, { requestDocument: request });
  const chosen = await f.authority.select(f.project, f.task.id, f.task.revision, request, { schemaVersion: 'creative-directions/v1', inputHash: state.inputHash, directions: fixtureDirections(state.context) });
  f.task.revision = chosen.revision;
  const preview = await f.broker.preview(f.project, f.task.id, f.task.revision);
  await assert.rejects(() => f.broker.create(f.project, f.task.id, f.task.revision, { recipient: 'generic', previewHash: preview.previewHash, paths: preview.files.map(row => row.path) }), /private configuration/);
});
test('optional OpenDesign adapter uses the same task and existing token mapping without installing/generating', async t => {
  const f = await fixture(t), delivered = await f.deliver('opendesign');
  const packet = await verifyAgentHandoff(delivered.folder), adapter = read(path.join(delivered.folder, 'adapter.json'));
  assert.ok(packet.files['tokens.css'] && packet.files['DESIGN.md'] && packet.files['manifest.json']);
  assert.equal(adapter.installationPerformed, false); assert.equal(adapter.generationStarted, false);
  assert.equal(read(path.join(delivered.folder, 'manifest.json')).source.path, '.');
  assert.equal(new Set([...fs.readFileSync(path.join(delivered.folder, 'tokens.css'), 'utf8').matchAll(/--([a-z0-9-]+):/g)].map(row => row[1])).size, 56);
  assert.ok(!packet.files['metadata.json']);
});
test('result revisions retain first outputs, delivery snapshot and original feedback without granting acceptance', async t => {
  const f = await fixture(t), delivered = await f.deliver(), sourceRoot = path.join(f.root, 'returned'); fs.mkdirSync(sourceRoot);
  write(path.join(sourceRoot, 'index.html'), '<h1>Fictional draft</h1>'); write(path.join(sourceRoot, 'feedback.txt'), 'Original human preference: more character.');
  const files = ['index.html', 'feedback.txt'].map(file => ({ path: file, sha256: digest(fs.readFileSync(path.join(sourceRoot, file))), kind: file.endsWith('.txt') ? 'feedback' : 'html' }));
  const input = { sourceRoot, files, feedback: [{ sourcePath: 'feedback.txt', reviewer: 'Synthetic operator', note: 'More character.', cause: 'unknown' }], previousId: null };
  const first = await f.broker.result(f.project, delivered.id, input), before = fs.readFileSync(path.join(f.directory, 'results', first.id, 'artifacts/index.html'));
  write(path.join(sourceRoot, 'index.html'), '<h1>Fictional second draft</h1>'); files[0].sha256 = digest(fs.readFileSync(path.join(sourceRoot, 'index.html')));
  const second = await f.broker.result(f.project, delivered.id, { ...input, previousId: first.id });
  assert.equal(second.revision, 1); assert.equal(second.firstOutput, first.id); assert.equal(second.publicationAllowed, false);
  assert.deepEqual(fs.readFileSync(path.join(f.directory, 'results', first.id, 'artifacts/index.html')), before);
  assert.equal(fs.readFileSync(path.join(f.directory, 'results', first.id, 'artifacts/feedback.txt'), 'utf8'), 'Original human preference: more character.');
  await assert.rejects(() => f.broker.result(f.project, delivered.id, input), /revision-stale/);
  const history = await f.broker.history(f.project); assert.equal(history.results.length, 2); assert.equal(history.results[0].contextHash, delivered.contextHash);
});
test('supplied external attempts deduplicate globally, preserve source bytes and leave missing effort unknown', async t => {
  const f = await fixture(t), delivered = await f.deliver(), sourceRoot = path.join(f.root, 'external'); fs.mkdirSync(sourceRoot);
  const record = { provider: 'fictional-agent', attemptId: 'request-1', kind: 'generation', wallMs: 1200, humanMinutes: null, usage: { inputTokens: 10, outputTokens: 2 }, billing: { amount: .02, currency: 'USD', basis: 'returned-bill', chargeId: 'charge-1' } };
  async function supply(sourceId, records) {
    const sourcePath = `${sourceId}.json`; write(path.join(sourceRoot, sourcePath), { schemaVersion: 'external-effort/v1', sourceId, records });
    return f.broker.importEffort(f.project, delivered.id, { sourceRoot, sourcePath, sha256: digest(fs.readFileSync(path.join(sourceRoot, sourcePath))), sourceId });
  }
  const first = await supply('source-1', [record, record]);
  assert.equal(first.summary.attempts, 1); assert.equal(first.summary.totalCost, .02); assert.equal(first.summary.humanMinutes, null);
  assert.equal((await supply('source-1', [record, record])).duplicate, true);
  assert.equal((await supply('source-2', [record])).summary.attempts, 1);
  await assert.rejects(() => supply('source-3', [{ ...record, wallMs: 1300 }]), /observation-conflict/);
  await assert.rejects(() => supply('source-1', [{ ...record, humanMinutes: 3 }]), /source-conflict/);
  const mixed = await supply('source-4', [{ ...record, attemptId: 'request-2', billing: { amount: .1, currency: 'EUR', basis: 'supplied-invoice', chargeId: 'charge-2' }, wallMs: null }]);
  assert.equal(mixed.summary.totalCost, null); assert.equal(mixed.summary.suppliedAttemptWallMs, null); assert.equal(mixed.summary.automaticRecipientCapture, false);
  assert.deepEqual(mixed.summary.suppliedCostByCurrency, { USD: .02, EUR: .1 });
  assert.equal((await f.broker.history(f.project)).sources.length, 3);
});
test('failed promotion preserves prior valid history and exposes unindexed folders after reopen', async t => {
  const f = await fixture(t), delivered = await f.deliver();
  const previous = fs.readFileSync(path.join(f.directory, 'delivery-history.json'));
  const controller = new Deliveries(f.store, { fault: point => { if (point === 'history-after-promotion') throw new Error('synthetic-promotion-fault'); } });
  await assert.rejects(() => f.deliver('generic', undefined, controller), /synthetic-promotion-fault/);
  assert.deepEqual(fs.readFileSync(path.join(f.directory, 'delivery-history.json')), previous);
  f.store.close(); const reopened = new Deliveries(f.open()), history = await reopened.history(f.project);
  assert.equal(history.deliveries.length, 1); assert.equal(history.deliveries[0].id, delivered.id); assert.equal(history.orphans.length, 1);
  assert.equal((await reopened.readback(f.project, delivered.id)).integrity, 'verified');
});

test('export fences, source changes and stale writer callbacks cannot mark a partial copy ready', async t => {
  const f = await fixture(t), delivered = await f.deliver(), parent = path.join(f.root, 'shared'); fs.mkdirSync(parent);
  const fault = new Deliveries(f.store, { fault: point => { if (point === 'export-before-promotion') write(path.join(delivered.folder, 'BRIEF.md'), 'Changed during export'); } });
  await assert.rejects(() => fault.export(f.project, delivered.id, parent), /bytes-changed/);
  assert.deepEqual(fs.readdirSync(parent), []);
  await assert.rejects(() => f.broker.export(f.project, delivered.id, f.directory), /bytes-changed/);
});
test('supplied result selection ignores unselected files, rejects traversal and hardlink aliases', async t => {
  const f = await fixture(t), delivered = await f.deliver(), sourceRoot = path.join(f.root, 'returned'); fs.mkdirSync(sourceRoot);
  write(path.join(sourceRoot, 'index.html'), '<h1>Selected</h1>'); write(path.join(sourceRoot, 'credentials.json'), '{"password":"synthetic-local"}');
  const sha256 = digest(fs.readFileSync(path.join(sourceRoot, 'index.html'))), input = { sourceRoot, files: [{ path: 'index.html', kind: 'html', sha256 }], feedback: [], previousId: null };
  const result = await f.broker.result(f.project, delivered.id, input);
  assert.deepEqual(fs.readdirSync(path.join(f.directory, 'results', result.id, 'artifacts')), ['index.html']);
  await assert.rejects(() => f.broker.result(f.project, delivered.id, { ...input, previousId: result.id, files: [{ path: '../outside.html', kind: 'html', sha256 }] }), /invalid-supplied/);
  fs.linkSync(path.join(sourceRoot, 'index.html'), path.join(sourceRoot, 'alias.html'));
  await assert.rejects(() => f.broker.result(f.project, delivered.id, { ...input, previousId: result.id }), /unsafe-path/);
});
test('overlapping supplied charge identities count once and conflicts do not commit', async t => {
  const f = await fixture(t), delivered = await f.deliver(), sourceRoot = path.join(f.root, 'external'); fs.mkdirSync(sourceRoot);
  const record = { provider: 'fictional', attemptId: 'request-1', kind: 'generation', wallMs: null, humanMinutes: null, usage: null,
    billing: { chargeId: 'run-bill-1', amount: 2, currency: 'USD', basis: 'returned-bill' } };
  async function supply(sourceId, records) {
    const sourcePath = `${sourceId}.json`; write(path.join(sourceRoot, sourcePath), { schemaVersion: 'external-effort/v1', sourceId, records });
    return f.broker.importEffort(f.project, delivered.id, { sourceRoot, sourcePath, sourceId, sha256: digest(fs.readFileSync(path.join(sourceRoot, sourcePath))) });
  }
  const imported = await supply('bill-source', [record, { ...record, attemptId: 'request-2' }]);
  assert.equal(imported.summary.attempts, 2); assert.equal(imported.summary.totalCost, 2);
  const before = fs.readFileSync(path.join(f.directory, 'delivery-history.json'));
  await assert.rejects(() => supply('conflicting-bill', [{ ...record, attemptId: 'request-3', billing: { ...record.billing, amount: 3 } }]), /Conflicting supplied charge/);
  assert.deepEqual(fs.readFileSync(path.join(f.directory, 'delivery-history.json')), before);
});
test('private website locations stay local while relative authorized hashes survive the portable projection', async t => {
  const f = await fixture(t), task = read(path.join(f.directory, 'task-authority.json')).tasks[0], site = path.join(f.root, 'site'); fs.mkdirSync(site);
  write(path.join(site, 'index.html'), '<h1>Fictional existing site</h1>');
  const request = { ...task.request, kind: 'website-change', target: { width: 1440, height: 900 }, action: { type: 'none', label: null, url: null, reservedSpace: null },
    existingSite: { root: site, files: ['index.html'], sourceId: 'S-REQUEST' } };
  const state = await prepareBrief(f.input, { requestDocument: request });
  const selected = await f.authority.select(f.project, f.task.id, f.task.revision, request, { schemaVersion: 'creative-directions/v1', inputHash: state.inputHash, directions: fixtureDirections(state.context) });
  const execution = await f.authority.reviewExecution(f.project, f.task.id, selected.revision, selected.key, { reviewer: 'Synthetic operator', reviewedAt: '2026-01-03T00:00:00Z' }); f.task.revision = execution.revision;
  const delivered = await f.deliver(), brief = read(path.join(delivered.folder, 'design-brief.json'));
  assert.equal(brief.codeContext.root, null); assert.ok(!Object.hasOwn(brief.request.existingSite, 'root'));
  assert.equal(brief.codeContext.files[0].sha256, digest(fs.readFileSync(path.join(site, 'index.html'))));
  assert.ok(!fs.readFileSync(path.join(delivered.folder, 'BRIEF.md'), 'utf8').includes(site));
  assert.ok(!(await verifyAgentHandoff(delivered.folder)).files['index.html']);
});
test('history contention and input detachment retain the explicitly selected disclosure', async t => {
  const f = await fixture(t), preview = await f.broker.preview(f.project, f.task.id, f.task.revision);
  const selection = { recipient: 'generic', previewHash: preview.previewHash, paths: preview.files.filter(row => row.required).map(row => row.path) }, expected = [...selection.paths];
  const pending = f.broker.create(f.project, f.task.id, f.task.revision, selection); selection.paths.push('private-diagnostics.txt');
  await assert.rejects(() => f.broker.history(f.project), /writer-busy/);
  const created = await pending, history = await f.broker.history(f.project);
  assert.deepEqual(history.deliveries[0].selection.paths, expected); assert.equal(created.mode, 'selected-execution');
  const broken = new Deliveries(f.store, { fault: point => { if (point === 'history-before-commit') f.store.close(); } });
  await assert.rejects(() => f.deliver('generic', undefined, broken), /job-store-unavailable/);
  const reopened = new Deliveries(f.open()); assert.equal((await reopened.history(f.project)).deliveries.length, 1);
});

test('returned names with spaces and Unicode bind exact publication review; case aliases are refused', async t => {
  const f = await fixture(t), delivered = await f.deliver(), sourceRoot = path.join(f.root, 'returned'); fs.mkdirSync(sourceRoot);
  const name = 'historia versión final.html'; write(path.join(sourceRoot, name), '<h1>Fictional reviewed output</h1>');
  const sha256 = digest(fs.readFileSync(path.join(sourceRoot, name))), result = await f.broker.result(f.project, delivered.id,
    { sourceRoot, files: [{ path: name, sha256, kind: 'html' }], feedback: [], previousId: null });
  const prepared = await f.authority.preview(f.project, f.task.id), files = [{ path: `results/${result.id}/artifacts/${name}`, sha256 }];
  const reviewer = { reviewer: 'Synthetic operator', reviewedAt: '2026-01-03T00:00:00Z' };
  const input = { executionId: prepared.execution.id, target: { platform: 'instagram-story', use: 'public-publication' }, files,
    grant: { ...reviewer, sourceId: 'S-REQUEST', assetIds: prepared.brief.assets.map(row => row.id), platform: 'instagram-story', use: 'public-publication' },
    review: { ...reviewer, sourceId: 'S-REQUEST', executionId: prepared.execution.id, artifactHash: digest(JSON.stringify(files)), checks: publicationChecks('instagram-story') } };
  await assert.rejects(() => f.authority.acceptPublication(f.project, f.task.id, prepared.revision,
    { ...input, files: [files[0], { ...files[0], path: files[0].path.toUpperCase() }] }), /invalid-artifact/);
  const accepted = await f.authority.acceptPublication(f.project, f.task.id, prepared.revision, input);
  assert.equal(accepted.publicationOperationAuthorized, false); assert.equal((await f.broker.history(f.project)).results.length, 1);
});
