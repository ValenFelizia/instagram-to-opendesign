import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { JobStore, digest } = require('../desktop/jobs.cjs');
const { Workspace } = require('../desktop/workspace.cjs');
const guard = require('../src/writer-guard.cjs');
const { DatabaseSync } = require('node:sqlite');
const helper = path.resolve('test/helpers/job-process.cjs');
function fixture(t) {
  const root = fs.mkdtempSync(path.join(fs.realpathSync.native(tmpdir()), 'job-test-'));
  const workspace = new Workspace(path.join(root, 'workspace'));
  const project = workspace.create('Example studio', 'https://www.instagram.com/example.studio/').active;
  const input = path.join(workspace.project(project).directory, 'data', 'example.studio');
  fs.writeFileSync(path.join(input, 'source.txt'), 'synthetic input');
  const scope = { taskId: randomUUID(), operation: 'report', provider: 'local', model: 'local', configRevision: digest('config'), taskRevision: 1 };
  fs.writeFileSync(path.join(root, 'fixture.json'), JSON.stringify({ project, scope }));
  const stores = [];
  const open = options => {
    const store = new JobStore(path.join(root, 'jobs'), { resolveProject: id => workspace.project(id, workspace.registry().projects.find(item => item.id === id)?.status), ...options });
    stores.push(store); return store;
  };
  t.after(() => {
    for (const store of stores) { try { store.close(); } catch {} }
    assert.ok(path.basename(root).startsWith('job-test-') && path.dirname(root) === fs.realpathSync.native(tmpdir()));
    fs.rmSync(root, { recursive: true });
  });
  return { root, workspace, project, input, scope, open };
}
const build = value => payload => fs.writeFileSync(path.join(payload, 'result.txt'), value);
function completed(store, f, revision = 1) {
  const job = store.createJob(f.project, { ...f.scope, taskRevision: revision });
  return store.complete(job.id, store.authorize(job.id, job.planHash), build(`result-${revision}`), () => true);
}
async function interrupt(f, mode, point) {
  const child = spawn(process.execPath, [helper, f.root, mode, point || ''], { windowsHide: true, stdio: 'ignore' });
  const exited = once(child, 'exit');
  try {
    const deadline = Date.now() + 15000;
    while (!fs.existsSync(path.join(f.root, 'checkpoint.txt'))) {
      if (child.exitCode != null || Date.now() > deadline) throw new Error('Checkpoint process failed');
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    return child;
  } catch (error) { child.kill(); await exited; throw error; }
}
async function kill(child) { const exited = once(child, 'exit'); child.kill('SIGKILL'); await exited; }
test('revision-bound confirmation rejects changed input, config, scope and reused authorization', async t => {
  const f = fixture(t); let config = f.scope.configRevision;
  const store = f.open({ configuration: () => config });
  const job = store.createJob(f.project, { ...f.scope, provider: 'fake' });
  assert.equal(store.createJob(f.project, { ...f.scope, provider: 'fake' }).id, job.id);
  assert.throws(() => store.authorize(job.id, digest('wrong')), /stale-authorization/);
  const auth = store.authorize(job.id, job.planHash); let calls = 0;
  config = digest('changed');
  await assert.rejects(store.dispatch(job.id, auth, () => { calls++; }), /stale-authorization/);
  config = f.scope.configRevision;
  fs.writeFileSync(path.join(f.input, 'source.txt'), 'changed');
  await assert.rejects(store.dispatch(job.id, auth, () => { calls++; }), /stale-authorization/);
  fs.writeFileSync(path.join(f.input, 'source.txt'), 'synthetic input');
  store.createJob(f.project, { ...f.scope, provider: 'fake', taskRevision: 2 });
  await assert.rejects(store.dispatch(job.id, auth, () => { calls++; }), /stale-authorization/);
  assert.equal(calls, 0);
  const fresh = store.createJob(f.project, { ...f.scope, provider: 'fake', taskRevision: 3 });
  const freshAuth = store.authorize(fresh.id, fresh.planHash);
  let finish; const pending = store.dispatch(fresh.id, freshAuth, () => { calls++; return new Promise(resolve => { finish = resolve; }); });
  await assert.rejects(store.dispatch(fresh.id, freshAuth, () => { calls++; }), /writer-busy/);
  const secondProject = f.workspace.create('Second fixture', 'https://www.instagram.com/second.fixture/').active;
  const secondJob = store.createJob(secondProject, { ...f.scope, provider: 'fake', taskId: randomUUID() });
  await assert.rejects(store.dispatch(secondJob.id, store.authorize(secondJob.id, secondJob.planHash), () => { calls++; }), /writer-busy/);
  const cli = spawnSync(process.execPath, ['bin/brand-report.js', f.input], { windowsHide: true, encoding: 'utf8' });
  assert.equal(cli.status, 1); assert.match(cli.stderr, /Project writer unavailable/);
  assert.throws(() => f.workspace.trash(f.project, 'project'), /Project writer unavailable/);
  const observation = `run-${randomUUID()}-analyze-1`;
  finish({ remoteId: 'request-1', observationRef: observation }); await pending;
  await assert.rejects(store.dispatch(fresh.id, freshAuth, () => { calls++; }), /stale-authorization/);
  assert.equal(calls, 1);
  const result = store.complete(fresh.id, null, build('response'), () => true);
  assert.equal(result.state, 'completed'); assert.equal(result.attempt.state, 'acknowledged');
  assert.equal(result.attempt.observation_ref, observation);
  assert.throws(() => store.complete(fresh.id, null, build('overwrite'), () => true), /stale-authorization/);
});
test('CLI ownership, unknown markers and separate processes cannot be reclaimed as app leases', async t => {
  const f = fixture(t), store = f.open(), release = guard.acquireCliWriters([f.input]);
  assert.throws(() => store.createJob(f.project, f.scope), /writer-busy/); release();
  store.close(); const child = await interrupt(f, 'hold');
  assert.throws(() => f.open(), /locked|busy/i); await kill(child);
  const recovered = f.open(); completed(recovered, f); recovered.close();
  const directory = f.workspace.project(f.project).directory;
  guard.claim(directory, { version: 1, type: 'cli', token: randomUUID() });
  const reopened = f.open(); assert.throws(() => reopened.createJob(f.project, f.scope), /writer-busy/);
});
for (const point of ['attempt-after-intent', 'attempt-before-ack']) test(`process termination at ${point} retains uncertainty without retry`, async t => {
  const f = fixture(t), store = f.open(); const baseline = completed(store, f); store.close();
  const child = await interrupt(f, 'dispatch', point); await kill(child);
  const recovered = f.open(), id = fs.readFileSync(path.join(f.root, 'new-job.txt'), 'utf8'), job = recovered.view(id);
  assert.equal(job.state, 'interrupted'); assert.equal(job.attempt.state, 'uncertain'); assert.equal(job.nextAction, 'reconcile-attempt');
  assert.throws(() => recovered.authorize(id, job.planHash), /stale-authorization/);
  assert.equal(fs.existsSync(path.join(f.root, 'remote-call.txt')), point === 'attempt-before-ack');
  assert.equal(recovered.db.prepare('SELECT snapshot FROM latest').get().snapshot, baseline.output);
  recovered.close(); const again = f.open(); assert.equal(again.view(id).attempt.state, 'uncertain');
  const retry = again.retryJob(id, again.view(id).planHash);
  assert.equal(retry.state, 'queued'); assert.equal(retry.attempt, null);
  assert.notEqual(retry.planHash, job.planHash);
  assert.throws(() => again.retryJob(id, job.planHash), /stale-authorization/);
  assert.equal(again.view(id).attempt.state, 'uncertain');
  assert.equal(again.db.prepare('SELECT count(*) AS count FROM attempts').get().count, 1);
});
for (const point of ['snapshot-after-write', 'snapshot-after-manifest', 'snapshot-after-rename', 'snapshot-before-promotion', 'snapshot-db-before-commit', 'snapshot-after-promotion']) test(`process termination at ${point} preserves a validated latest output`, async t => {
  const f = fixture(t), store = f.open(); const baseline = completed(store, f); store.close();
  const child = await interrupt(f, 'snapshot', point); await kill(child);
  const recovered = f.open(), id = fs.readFileSync(path.join(f.root, 'new-job.txt'), 'utf8'), job = recovered.view(id);
  const promotes = ['snapshot-before-promotion', 'snapshot-db-before-commit', 'snapshot-after-promotion'].includes(point);
  assert.equal(job.state, promotes ? 'completed' : 'interrupted');
  const latest = recovered.db.prepare('SELECT snapshot FROM latest').get().snapshot;
  assert.equal(latest, promotes ? job.output : baseline.output);
  assert.ok(recovered.validSnapshot(recovered.db.prepare('SELECT * FROM snapshots WHERE id=?').get(latest)));
});
test('failed validators, async builders, corrupt outputs and missing files cannot replace valid history', t => {
  const f = fixture(t), store = f.open(), baseline = completed(store, f);
  const invalid = store.createJob(f.project, { ...f.scope, taskRevision: 2 });
  assert.throws(() => store.complete(invalid.id, store.authorize(invalid.id, invalid.planHash), build('bad'), () => false), /snapshot-invalid/);
  assert.equal(store.view(invalid.id).state, 'failed');
  assert.equal(store.db.prepare('SELECT snapshot FROM latest').get().snapshot, baseline.output);
  const asyncJob = store.createJob(f.project, { ...f.scope, taskRevision: 3 });
  assert.throws(() => store.complete(asyncJob.id, store.authorize(asyncJob.id, asyncJob.planHash), async () => {}, () => true), /snapshot-invalid/);
  const newer = completed(store, f, 4), snapshot = store.db.prepare('SELECT * FROM snapshots WHERE id=?').get(newer.output);
  fs.unlinkSync(path.join(store.snapshotPath(snapshot), 'payload', 'result.txt'));
  assert.equal(store.view(newer.id).state, 'failed'); store.close();
  const recovered = f.open(); assert.equal(recovered.db.prepare('SELECT snapshot FROM latest').get().snapshot, baseline.output);
  assert.equal(recovered.view(newer.id).error, 'snapshot-unavailable');
});
test('real SQLite contention and capacity exhaustion retain the prior committed output', t => {
  const f = fixture(t), store = f.open(), baseline = completed(store, f);
  store.db.exec('CREATE TABLE filler(bytes BLOB)');
  const job = store.createJob(f.project, { ...f.scope, taskRevision: 2 }), auth = store.authorize(job.id, job.planHash);
  const pages = store.db.prepare('PRAGMA page_count').get().page_count;
  store.db.exec(`PRAGMA max_page_count=${pages}`);
  assert.throws(() => store.db.prepare('INSERT INTO filler VALUES (?)').run(Buffer.alloc(1024 * 1024)), /full/i);
  assert.equal(store.view(baseline.id).state, 'completed');
  store.fault = name => { if (name === 'snapshot-db-before-commit') store.db.prepare('INSERT INTO filler VALUES (?)').run(Buffer.alloc(1024 * 1024)); };
  assert.throws(() => store.complete(job.id, auth, build('cannot-commit'), () => true), /full/i);
  assert.equal(store.view(job.id).state, 'failed');
  assert.equal(store.db.prepare('SELECT snapshot FROM latest').get().snapshot, baseline.output);
  const other = new DatabaseSync(path.join(f.root, 'jobs', 'jobs.sqlite'));
  try {
    other.exec('BEGIN IMMEDIATE');
    assert.throws(() => store.createJob(f.project, { ...f.scope, taskRevision: 2 }), /locked|busy/i);
    assert.equal(store.view(baseline.id).state, 'completed');
  } finally { other.exec('ROLLBACK'); other.close(); }
});
test('an actual Windows file sharing lock refuses promotion and retains the previous snapshot', { skip: process.platform !== 'win32' }, async t => {
  const f = fixture(t), store = f.open(), baseline = completed(store, f);
  const job = store.createJob(f.project, { ...f.scope, taskRevision: 2 }), auth = store.authorize(job.id, job.planHash);
  let locker;
  store.fault = name => {
    if (name !== 'snapshot-after-manifest') return;
    const row = store.db.prepare("SELECT * FROM snapshots WHERE kind='output' AND state='preparing' ORDER BY rowid DESC").get();
    const checkpoint = path.join(f.root, 'file-locked.txt');
    locker = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', path.resolve('test/helpers/hold-file.ps1'), '-FilePath', path.join(store.snapshotPath(row, true), 'inventory.json'), '-Checkpoint', checkpoint], { windowsHide: true, stdio: 'ignore' });
    const deadline = Date.now() + 15000;
    while (!fs.existsSync(checkpoint)) {
      if (Date.now() > deadline) throw new Error('Windows sharing lock unavailable');
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25);
    }
  };
  try {
    assert.throws(() => store.complete(job.id, auth, build('locked'), () => true), /EPERM|EACCES|EBUSY/);
    assert.equal(store.view(job.id).state, 'failed');
    assert.equal(store.db.prepare('SELECT snapshot FROM latest').get().snapshot, baseline.output);
  } finally { if (locker) await kill(locker); }
});
test('explicit shutdown fences a late fake response and restart never repeats the call', async t => {
  const f = fixture(t), store = f.open(), job = store.createJob(f.project, { ...f.scope, provider: 'fake' });
  let finish; const pending = store.dispatch(job.id, store.authorize(job.id, job.planHash), () => new Promise(resolve => { finish = resolve; }));
  store.close(); finish({ remoteId: 'late-response' });
  await assert.rejects(pending, /job-store-unavailable/);
  assert.equal(f.open().view(job.id).attempt.state, 'uncertain');
});
test('migration rollback and unsupported version fail closed without deleting valid snapshots', t => {
  const f = fixture(t);
  assert.throws(() => f.open({ fault: name => { if (name === 'migration-before-commit') throw new Error('synthetic migration failure'); } }), /migration failure/);
  const store = f.open(), baseline = completed(store, f), snapshot = store.snapshotPath(store.db.prepare('SELECT * FROM snapshots WHERE id=?').get(baseline.output));
  store.db.exec('PRAGMA user_version=2'); store.close();
  assert.throws(() => f.open(), /job-version-unsupported/);
  assert.equal(fs.readFileSync(path.join(snapshot, 'payload', 'result.txt'), 'utf8'), 'result-1');
});
test('changed profile metadata cannot grant a job access outside its registered input folder', t => {
  const f = fixture(t), store = f.open(), directory = f.workspace.project(f.project).directory;
  const file = path.join(directory, 'project.json'), metadata = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const profile of ['../../outside', '.', '..', ['example.studio']]) {
    fs.writeFileSync(file, JSON.stringify({ ...metadata, profile }));
    assert.throws(() => store.createJob(f.project, f.scope), /unsafe-path/);
    assert.equal(store.db.prepare('SELECT count(*) AS count FROM jobs').get().count, 0);
    assert.equal(fs.existsSync(path.join(directory, '.writer-guard')), false);
  }
  fs.writeFileSync(file, JSON.stringify(metadata));
  assert.equal(store.createJob(f.project, f.scope).state, 'queued');
});
test('authorization expires on restart and project moves revoke approval while backups omit control locks', t => {
  const f = fixture(t), store = f.open(), job = store.createJob(f.project, f.scope), auth = store.authorize(job.id, job.planHash);
  store.close(); const reopened = f.open();
  assert.throws(() => reopened.complete(job.id, auth, build('stale'), () => true), /stale-authorization/);
  assert.equal(reopened.view(job.id).state, 'queued');
  f.workspace.onMove = (id, token) => reopened.beforeProjectMutation(id, token);
  const backup = path.join(f.root, 'backup'); fs.mkdirSync(backup);
  f.workspace.export(f.project, 'project-backup', backup);
  const exported = path.join(backup, fs.readdirSync(backup)[0]); assert.equal(fs.existsSync(path.join(exported, '.writer-guard')), false);
  f.workspace.trash(f.project, 'project'); assert.equal(reopened.view(job.id).state, 'interrupted');
  f.workspace.restore(f.project); assert.equal(reopened.view(job.id).error, 'project-moved');
  assert.equal(completed(reopened, f, 2).state, 'completed');
});
