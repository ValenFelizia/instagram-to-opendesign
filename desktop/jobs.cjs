const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { fail, UUID, checked, inside, ensureDirectory, inventory, fingerprint, copyInventory, atomicJson } = require('./paths.cjs');
const guard = require('../src/writer-guard.cjs');
const HASH = /^[a-f0-9]{64}$/;
const operations = new Set(['ingest', 'analyze', 'compile', 'report', 'export']);
function digest(value) { return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function scopeRecord(value) {
  const keys = ['taskId', 'operation', 'provider', 'model', 'configRevision', 'taskRevision'];
  if (!value || Object.keys(value).length !== keys.length || !keys.every(key => Object.hasOwn(value, key))
    || typeof value.taskId !== 'string' || !UUID.test(value.taskId) || !operations.has(value.operation)
    || !['local', 'fake', 'apify', 'openai'].includes(value.provider) || typeof value.model !== 'string'
    || !/^[a-zA-Z0-9._/-]{1,80}$/.test(value.model) || typeof value.configRevision !== 'string' || !HASH.test(value.configRevision)
    || !Number.isSafeInteger(value.taskRevision) || value.taskRevision < 1) fail('invalid-job-scope');
  return Object.fromEntries(keys.map(key => [key, value[key]]));
}
class JobStore {
  constructor(root, { resolveProject, configuration = scope => scope.configRevision, fault = () => {} } = {}) {
    this.root = ensureDirectory(path.resolve(root)); Object.assign(this, { resolveProject, configuration, fault });
    this.session = crypto.randomUUID(); this.leases = new Map(); this.closed = false;
    const { DatabaseSync } = require('node:sqlite');
    const open = name => {
      const file = path.join(this.root, name);
      for (const suffix of ['', '-journal', '-wal', '-shm']) if (fs.existsSync(file + suffix)) checked(file + suffix);
      return new DatabaseSync(file, { timeout: 0, allowExtension: false });
    };
    try {
      // Separate DB: a held SQLite transaction proves that the previous main writer ended.
      this.ownership = open('writer.sqlite');
      this.ownership.exec('PRAGMA journal_mode=DELETE; BEGIN IMMEDIATE');
      this.db = open('jobs.sqlite');
      this.db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL');
      const version = this.db.prepare('PRAGMA user_version').get().user_version;
      if (version > 2) fail('job-version-unsupported');
      if (version === 0) this.transaction(() => {
        this.db.exec(`
          CREATE TABLE meta(key TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT;
          CREATE TABLE leases(project TEXT PRIMARY KEY, token TEXT NOT NULL, session TEXT NOT NULL) STRICT;
          CREATE TABLE snapshots(id TEXT PRIMARY KEY, project TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('input','output')), state TEXT NOT NULL CHECK(state IN ('preparing','ready','committed')), hash TEXT, inventory TEXT, session TEXT NOT NULL) STRICT;
          CREATE TABLE plans(project TEXT NOT NULL, task TEXT NOT NULL, hash TEXT NOT NULL, PRIMARY KEY(project,task)) STRICT;
          CREATE TABLE jobs(id TEXT PRIMARY KEY, project TEXT NOT NULL, task TEXT NOT NULL, scope TEXT NOT NULL, hash TEXT NOT NULL, input TEXT NOT NULL REFERENCES snapshots(id), state TEXT NOT NULL CHECK(state IN ('queued','running','review-required','failed','interrupted','completed')), error TEXT, output TEXT REFERENCES snapshots(id), epoch TEXT) STRICT;
          CREATE TABLE authorizations(token TEXT PRIMARY KEY, job TEXT NOT NULL REFERENCES jobs(id), hash TEXT NOT NULL, session TEXT NOT NULL, consumed INTEGER NOT NULL DEFAULT 0 CHECK(consumed IN (0,1))) STRICT;
          CREATE TABLE attempts(id TEXT PRIMARY KEY, job TEXT NOT NULL UNIQUE REFERENCES jobs(id), authorization TEXT NOT NULL UNIQUE REFERENCES authorizations(token), state TEXT NOT NULL CHECK(state IN ('intent','acknowledged','uncertain')), remote_id TEXT, observation_ref TEXT) STRICT;
          CREATE TABLE latest(project TEXT NOT NULL, task TEXT NOT NULL, snapshot TEXT NOT NULL REFERENCES snapshots(id), PRIMARY KEY(project,task)) STRICT;
          INSERT INTO meta VALUES ('workspace', '${crypto.randomUUID()}');
          PRAGMA user_version=1;
        `);
        this.fault('migration-before-commit');
      });
      if (version < 2) this.transaction(() => {
        this.db.exec(`CREATE TABLE pipeline_plans(job TEXT PRIMARY KEY REFERENCES jobs(id), recipe TEXT NOT NULL, hash TEXT NOT NULL) STRICT;
          CREATE TABLE pipeline_requests(id TEXT PRIMARY KEY, job TEXT NOT NULL REFERENCES jobs(id), record TEXT NOT NULL) STRICT;
          CREATE TABLE pipeline_stages(job TEXT NOT NULL REFERENCES jobs(id), name TEXT NOT NULL, snapshot TEXT REFERENCES snapshots(id), state TEXT NOT NULL, PRIMARY KEY(job,name)) STRICT;
          PRAGMA user_version=2;`);
        this.fault('pipeline-migration-before-commit');
      });
      this.workspaceId = this.db.prepare("SELECT value FROM meta WHERE key='workspace'").get()?.value;
      if (!UUID.test(this.workspaceId)) fail('job-store-unreadable');
      this.recover();
    } catch (error) { this.db?.close(); if (this.ownership) { try { this.ownership.exec('ROLLBACK'); } catch {} this.ownership.close(); } throw error; }
  }
  assertOpen() { if (this.closed) fail('job-store-unavailable'); }
  transaction(operation) {
    this.assertOpen(); this.db.exec('BEGIN IMMEDIATE');
    try { const result = operation(); this.db.exec('COMMIT'); return result; }
    catch (error) { try { this.db.exec('ROLLBACK'); } catch { /* SQLite FULL can already roll back the transaction. */ } throw error; }
  }
  project(id) {
    if (typeof id !== 'string' || !UUID.test(id)) fail('invalid-request');
    const resolved = this.resolveProject(id), directory = checked(resolved.directory);
    if (path.basename(directory) !== id) fail('unsafe-path');
    const handle = resolved.metadata.profile;
    if (handle !== null && (typeof handle !== 'string' || !/^[a-zA-Z0-9._]{1,30}$/.test(handle) || ['.', '..'].includes(handle))) fail('unsafe-path');
    const input = path.join(directory, 'data', resolved.metadata.profile || 'imported'); checked(input);
    if (!inside(directory, input) || path.dirname(input) !== path.join(directory, 'data')) fail('unsafe-path');
    return { directory, input };
  }
  own(projectId) {
    this.assertOpen();
    if (this.leases.has(projectId)) fail('writer-busy');
    const { directory } = this.project(projectId), existing = guard.readOwner(directory);
    if (existing) fail('writer-busy');
    const token = crypto.randomUUID();
    this.transaction(() => this.db.prepare('INSERT INTO leases VALUES (?,?,?)').run(projectId, token, this.session));
    try { guard.claim(directory, { version: 1, type: 'app', workspace: this.workspaceId, session: this.session, token }); }
    catch (error) { this.transaction(() => this.db.prepare('DELETE FROM leases WHERE project=? AND token=?').run(projectId, token)); throw error; }
    this.leases.set(projectId, { token, directory }); return token;
  }
  unown(projectId, token) {
    const owned = this.leases.get(projectId);
    if (!owned || owned.token !== token) fail('writer-fenced');
    guard.release(owned.directory, token); this.leases.delete(projectId);
    this.transaction(() => this.db.prepare('DELETE FROM leases WHERE project=? AND token=?').run(projectId, token));
  }
  fence(projectId, token) {
    this.assertOpen(); const owned = this.leases.get(projectId), row = this.db.prepare('SELECT * FROM leases WHERE project=?').get(projectId);
    if (!owned || owned.token !== token || row?.token !== token || row.session !== this.session || guard.readOwner(owned.directory)?.token !== token) fail('writer-fenced');
    this.project(projectId);
  }
  recover() {
    // No timer/PID expiry. Global ownership is exclusive; only matching recorded app markers are reclaimable.
    for (const row of this.db.prepare('SELECT * FROM leases').all()) {
      try {
        const { directory } = this.project(row.project), owner = guard.readOwner(directory);
        if (owner && (owner.type !== 'app' || owner.workspace !== this.workspaceId || owner.token !== row.token || owner.session !== row.session)) fail('writer-recovery-required');
        if (owner) guard.release(directory, row.token);
        this.db.prepare('DELETE FROM leases WHERE project=?').run(row.project);
      } catch { /* Keep unknown ownership and source files; explicit repair is required. */ }
    }
    this.transaction(() => {
      this.db.exec("UPDATE attempts SET state='uncertain' WHERE state='intent'; UPDATE jobs SET state='interrupted',error='interrupted',epoch=NULL WHERE state='running'; UPDATE authorizations SET consumed=1;");
      this.db.exec("UPDATE jobs SET error='outcome-unknown' WHERE state='interrupted' AND id IN (SELECT job FROM attempts WHERE state='uncertain');");
      this.db.exec("UPDATE pipeline_requests SET record=json_set(record,'$.state','uncertain') WHERE json_extract(record,'$.state')='intent';");
    });
    // Only an inventoried ready snapshot can finish its recorded DB promotion after a crash.
    for (const row of this.db.prepare("SELECT * FROM snapshots WHERE kind='output' AND state='ready'").all()) {
      try {
        const job = this.db.prepare('SELECT * FROM jobs WHERE output=?').get(row.id);
        if (!job || !this.validSnapshot(row)) continue;
        const token = this.own(job.project);
        try {
          const paid = JSON.parse(job.scope).provider !== 'local';
          if (this.current(job) && (!paid || this.db.prepare("SELECT id FROM attempts WHERE job=? AND state='acknowledged'").get(job.id))) this.promote(job, row, token);
        } finally { this.unown(job.project, token); }
      } catch { /* Prior valid snapshots stay authoritative. No provider replay. */ }
    }
    for (const row of this.db.prepare('SELECT * FROM latest').all()) {
      const snapshot = this.db.prepare('SELECT * FROM snapshots WHERE id=?').get(row.snapshot);
      if (!this.validSnapshot(snapshot)) {
        this.transaction(() => {
          this.db.prepare('DELETE FROM latest WHERE project=? AND task=?').run(row.project, row.task);
          this.db.prepare("UPDATE jobs SET state='failed',error='snapshot-unavailable' WHERE output=? AND state='completed'").run(row.snapshot);
        });
        const previous = this.db.prepare("SELECT s.* FROM jobs j JOIN snapshots s ON j.output=s.id WHERE j.project=? AND j.task=? AND s.state='committed' AND s.id<>? ORDER BY j.rowid DESC").all(row.project, row.task, row.snapshot).find(item => this.validSnapshot(item));
        if (previous) this.db.prepare('INSERT INTO latest VALUES (?,?,?)').run(row.project, row.task, previous.id);
      }
    }
  }
  snapshotPath(row, staging = false) {
    if (!row || !UUID.test(row.id) || !UUID.test(row.session)) fail('invalid-snapshot');
    const { directory } = this.project(row.project);
    return staging ? path.join(directory, 'staging', row.session, row.id) : path.join(directory, 'snapshots', row.id);
  }
  validSnapshot(row) {
    try {
      if (!row || !['ready', 'committed'].includes(row.state)) return false;
      const root = this.snapshotPath(row); checked(root);
      const manifestFile = path.join(root, 'inventory.json'); checked(manifestFile);
      const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
      const tree = inventory(path.join(root, 'payload'));
      return manifest.version === 1 && manifest.id === row.id && manifest.project === row.project && manifest.kind === row.kind
        && manifest.hash === row.hash && fingerprint(tree) === row.hash && JSON.stringify(tree) === row.inventory && JSON.stringify(tree) === JSON.stringify(manifest.tree);
    } catch { return false; }
  }
  prepareSnapshot(projectId, kind, token, build, validate) {
    this.fence(projectId, token);
    const row = { id: crypto.randomUUID(), project: projectId, kind, session: this.session, state: 'preparing' };
    this.transaction(() => this.db.prepare('INSERT INTO snapshots(id,project,kind,state,session) VALUES (?,?,?,?,?)').run(row.id, row.project, kind, row.state, this.session));
    const staging = this.snapshotPath(row, true), payload = path.join(staging, 'payload'); ensureDirectory(payload);
    if (typeof build !== 'function' || build(payload)?.then) fail('snapshot-invalid');
    this.fault('snapshot-after-write'); this.fence(projectId, token);
    if (typeof validate !== 'function' || validate(payload) !== true) fail('snapshot-invalid');
    const tree = inventory(payload); row.hash = fingerprint(tree); row.inventory = JSON.stringify(tree);
    for (const file of tree.files) {
      const full = path.join(payload, file.relative); checked(full); const fd = fs.openSync(full, 'r+');
      try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    }
    atomicJson(path.join(staging, 'inventory.json'), { version: 1, id: row.id, project: projectId, kind, hash: row.hash, tree });
    this.fault('snapshot-after-manifest');
    if (fingerprint(inventory(payload)) !== row.hash) fail('snapshot-invalid');
    const destination = this.snapshotPath(row); ensureDirectory(path.dirname(destination)); checked(staging); checked(path.dirname(destination));
    this.fence(projectId, token);
    fs.renameSync(staging, destination); this.fault('snapshot-after-rename');
    this.fence(projectId, token);
    row.state = 'ready';
    this.transaction(() => this.db.prepare("UPDATE snapshots SET state='ready',hash=?,inventory=? WHERE id=?").run(row.hash, row.inventory, row.id));
    return row;
  }
  createJob(projectId, scope, recipe = null) {
    scope = scopeRecord(scope); const token = this.own(projectId);
    try {
      if (this.configuration(scope) !== scope.configRevision) fail('stale-authorization');
      const { input } = this.project(projectId), tree = inventory(input);
      const snapshot = this.prepareSnapshot(projectId, 'input', token, payload => copyInventory(input, payload, tree), () => fingerprint(inventory(input)) === fingerprint(tree));
      const hash = digest({ projectId, scope, inputHash: snapshot.hash, ...(recipe ? { recipeHash: digest(recipe) } : {}) });
      return this.transaction(() => {
        this.db.prepare("UPDATE snapshots SET state='committed' WHERE id=?").run(snapshot.id);
        const existing = this.db.prepare('SELECT * FROM jobs WHERE project=? AND task=? AND hash=? ORDER BY rowid DESC').get(projectId, scope.taskId, hash);
        this.db.prepare('INSERT INTO plans VALUES (?,?,?) ON CONFLICT(project,task) DO UPDATE SET hash=excluded.hash').run(projectId, scope.taskId, hash);
        if (existing) return this.view(existing.id);
        const id = crypto.randomUUID();
        this.db.prepare("INSERT INTO jobs(id,project,task,scope,hash,input,state) VALUES (?,?,?,?,?,?,'queued')").run(id, projectId, scope.taskId, JSON.stringify(scope), hash, snapshot.id);
        if (recipe) this.db.prepare('INSERT INTO pipeline_plans VALUES (?,?,?)').run(id, JSON.stringify(recipe), digest(recipe));
        return this.view(id);
      });
    } finally { this.unown(projectId, token); }
  }
  job(id) { this.assertOpen(); if (typeof id !== 'string' || !UUID.test(id)) fail('invalid-request'); const row = this.db.prepare('SELECT * FROM jobs WHERE id=?').get(id); if (!row) fail('job-unavailable'); return row; }
  current(job) {
    const scope = scopeRecord(JSON.parse(job.scope)), snapshot = this.db.prepare('SELECT * FROM snapshots WHERE id=?').get(job.input);
    return this.configuration(scope) === scope.configRevision && this.db.prepare('SELECT hash FROM plans WHERE project=? AND task=?').get(job.project, job.task)?.hash === job.hash
      && this.validSnapshot(snapshot) && fingerprint(inventory(this.project(job.project).input)) === snapshot.hash;
  }
  authorize(id, expectedHash) {
    const job = this.job(id), token = this.own(job.project);
    try {
      if (expectedHash !== job.hash || !['queued', 'review-required', 'interrupted', 'failed'].includes(job.state) || !this.current(job) || this.db.prepare('SELECT id FROM attempts WHERE job=?').get(id)) fail('stale-authorization');
      const authorization = crypto.randomUUID();
      this.transaction(() => this.db.prepare('INSERT INTO authorizations(token,job,hash,session) VALUES (?,?,?,?)').run(authorization, id, job.hash, this.session));
      return authorization;
    } finally { this.unown(job.project, token); }
  }
  retryJob(id, expectedHash) {
    const job = this.job(id), token = this.own(job.project);
    try {
      if (expectedHash !== job.hash || !['interrupted', 'failed'].includes(job.state) || !this.current(job)) fail('stale-authorization');
      const next = crypto.randomUUID(), hash = digest({ prior: job.hash, retry: next });
      this.transaction(() => {
        this.db.prepare('UPDATE authorizations SET consumed=1 WHERE job IN (SELECT id FROM jobs WHERE project=? AND task=?)').run(job.project, job.task);
        this.db.prepare('UPDATE plans SET hash=? WHERE project=? AND task=?').run(hash, job.project, job.task);
        this.db.prepare("INSERT INTO jobs(id,project,task,scope,hash,input,state) VALUES (?,?,?,?,?,?,'queued')").run(next, job.project, job.task, job.scope, hash, job.input);
        this.db.prepare('INSERT INTO pipeline_plans SELECT ?,recipe,hash FROM pipeline_plans WHERE job=?').run(next, job.id);
      });
      return this.view(next); // Explicit new plan only; no authorization or dispatch is inherited.
    } finally { this.unown(job.project, token); }
  }
  consume(job, authorization, token, attempt = null) {
    this.fence(job.project, token);
    return this.transaction(() => {
      if (attempt && this.db.prepare("SELECT id FROM jobs WHERE state='running'").get()) fail('writer-busy');
      const row = this.db.prepare('SELECT * FROM authorizations WHERE token=?').get(authorization);
      if (!row || row.job !== job.id || row.hash !== job.hash || row.session !== this.session || row.consumed || !this.current(job) || job.state === 'completed' || job.state === 'running') fail('stale-authorization');
      this.db.prepare('UPDATE authorizations SET consumed=1 WHERE token=?').run(authorization);
      this.db.prepare("UPDATE jobs SET state='running',epoch=?,error=NULL WHERE id=?").run(token, job.id);
      if (attempt) this.db.prepare("INSERT INTO attempts(id,job,authorization,state) VALUES (?,?,?,'intent')").run(attempt, job.id, authorization);
    });
  }
  async dispatch(id, authorization, operation) {
    const job = this.job(id), scope = JSON.parse(job.scope), token = this.own(job.project);
    let attempted = false;
    try {
      if (scope.provider === 'local' || typeof operation !== 'function') fail('invalid-job-scope');
      const attempt = crypto.randomUUID();
      this.consume(job, authorization, token, attempt);
      attempted = true; this.fault('attempt-after-intent');
      this.fence(job.project, token); if (!this.current(job)) fail('stale-authorization');
      const inputDirectory = path.join(this.snapshotPath(this.db.prepare('SELECT * FROM snapshots WHERE id=?').get(job.input)), 'payload');
      const result = await operation({ attemptId: attempt, fence: token, inputDirectory, scope });
      this.fault('attempt-before-ack'); this.fence(job.project, token);
      if (!result || typeof result.remoteId !== 'string' || !/^[a-zA-Z0-9._/-]{1,160}$/.test(result.remoteId)
        || result.observationRef != null && (typeof result.observationRef !== 'string' || !/^run-[A-Za-z0-9_-]{1,140}$/.test(result.observationRef))) fail('invalid-attempt-result');
      this.transaction(() => {
        this.db.prepare("UPDATE attempts SET state='acknowledged',remote_id=?,observation_ref=? WHERE id=? AND state='intent'").run(result.remoteId, result.observationRef || null, attempt);
        this.db.prepare("UPDATE jobs SET state='review-required',error=NULL,epoch=NULL WHERE id=?").run(id);
      });
      return this.view(id);
    } catch (error) {
      if (attempted && !this.closed) this.transaction(() => {
        this.db.prepare("UPDATE attempts SET state='uncertain' WHERE job=? AND state='intent'").run(id);
        this.db.prepare("UPDATE jobs SET state='interrupted',error='outcome-unknown',epoch=NULL WHERE id=?").run(id);
      });
      throw error;
    } finally { if (!this.closed) this.unown(job.project, token); }
  }
  complete(id, authorization, build, validate) {
    const job = this.job(id), token = this.own(job.project);
    let started = false;
    try {
      if (JSON.parse(job.scope).provider === 'local') this.consume(job, authorization, token);
      else {
        if (!['review-required', 'interrupted', 'failed'].includes(job.state) || this.db.prepare("SELECT id FROM attempts WHERE job=? AND state='acknowledged'").get(id) == null || !this.current(job)) fail('stale-authorization');
        this.transaction(() => this.db.prepare("UPDATE jobs SET state='running',epoch=?,error=NULL WHERE id=?").run(token, id));
      }
      started = true;
      const snapshot = this.prepareSnapshot(job.project, 'output', token, build, validate);
      this.transaction(() => this.db.prepare('UPDATE jobs SET output=? WHERE id=?').run(snapshot.id, id));
      this.fault('snapshot-before-promotion'); this.fence(job.project, token);
      if (!this.current(job)) fail('stale-authorization');
      this.promote(this.job(id), snapshot, token); this.fault('snapshot-after-promotion');
      return this.view(id);
    } catch (error) {
      // Never demote a committed success after a post-commit fault.
      if (started && this.job(id).state !== 'completed') this.transaction(() => this.db.prepare("UPDATE jobs SET state='failed',error='snapshot-failed',epoch=NULL WHERE id=?").run(id));
      throw error;
    } finally { this.unown(job.project, token); }
  }
  async executeLocal(id, authorization, operation) {
    const job = this.job(id), token = this.own(job.project); let started = false;
    try {
      if (JSON.parse(job.scope).provider !== 'local' || typeof operation !== 'function') fail('invalid-job-scope');
      if (this.db.prepare("SELECT id FROM jobs WHERE state='running'").get()) fail('writer-busy');
      this.consume(job, authorization, token); started = true;
      const { directory } = this.project(job.project);
      const work = ensureDirectory(path.join(directory, 'staging', this.session, crypto.randomUUID()));
      const input = path.join(this.snapshotPath(this.db.prepare('SELECT * FROM snapshots WHERE id=?').get(job.input)), 'payload');
      const check = () => { this.fence(job.project, token); if (!this.current(job)) fail('stale-authorization'); };
      const result = await operation({ input, work, check, token }); check();
      if (!result || result.validated !== true || !inside(work, result.output)) fail('snapshot-invalid');
      const tree = inventory(result.output);
      if (fingerprint(tree) !== result.hash) fail('snapshot-invalid');
      const snapshot = this.prepareSnapshot(job.project, 'output', token,
        payload => copyInventory(result.output, payload, tree), payload => fingerprint(inventory(payload)) === result.hash);
      this.transaction(() => this.db.prepare('UPDATE jobs SET output=? WHERE id=?').run(snapshot.id, id));
      this.fault('snapshot-before-promotion'); check(); this.promote(this.job(id), snapshot, token);
      return this.view(id);
    } catch (error) {
      if (started && !this.closed && this.job(id).state !== 'completed') this.transaction(() => this.db.prepare("UPDATE jobs SET state='failed',error='pipeline-incomplete',epoch=NULL WHERE id=?").run(id));
      throw error;
    } finally { if (!this.closed) this.unown(job.project, token); }
  }
  promote(job, snapshot, token) {
    this.fence(job.project, token);
    if (!this.current(job) || !this.validSnapshot(snapshot)) fail('snapshot-invalid');
    const pipeline = this.db.prepare('SELECT recipe FROM pipeline_plans WHERE job=?').get(job.id);
    if (pipeline) {
      const expected = JSON.parse(pipeline.recipe).stages;
      const stages = this.db.prepare('SELECT name,state FROM pipeline_stages WHERE job=?').all(job.id);
      const file = path.join(this.snapshotPath(snapshot), 'payload', 'pipeline.json'); checked(file);
      const manifest = JSON.parse(fs.readFileSync(file));
      if (stages.length !== expected.length || expected.some(name => !stages.some(stage => stage.name === name && stage.state === 'completed'))
          || manifest.version !== 1 || manifest.job !== job.id || manifest.planHash !== job.hash || manifest.status !== 'complete'
          || JSON.stringify(manifest.stages) !== JSON.stringify(expected)) fail('pipeline-incomplete');
    }
    this.transaction(() => {
      this.db.prepare("UPDATE snapshots SET state='committed' WHERE id=?").run(snapshot.id);
      this.db.prepare('INSERT INTO latest VALUES (?,?,?) ON CONFLICT(project,task) DO UPDATE SET snapshot=excluded.snapshot').run(job.project, job.task, snapshot.id);
      this.db.prepare("UPDATE jobs SET state='completed',error=NULL,epoch=NULL WHERE id=?").run(job.id);
      this.fault('snapshot-db-before-commit');
    });
  }
  setState(id, state) {
    if (!['review-required', 'failed', 'interrupted'].includes(state)) fail('invalid-request');
    const job = this.job(id); if (job.state === 'running' || job.state === 'completed') fail('job-unavailable');
    const token = this.own(job.project);
    try {
      this.transaction(() => {
        this.db.prepare('UPDATE authorizations SET consumed=1 WHERE job=?').run(id);
        this.db.prepare('UPDATE jobs SET state=? WHERE id=?').run(state, id);
      });
      return this.view(id);
    } finally { this.unown(job.project, token); }
  }
  view(id) {
    const job = this.job(id), attempt = this.db.prepare('SELECT id,state,remote_id,observation_ref FROM attempts WHERE job=?').get(id);
    if (job.state === 'completed' && !this.validSnapshot(this.db.prepare('SELECT * FROM snapshots WHERE id=?').get(job.output))) { job.state = 'failed'; job.error = 'snapshot-unavailable'; }
    let stale = true; try { stale = !this.current(job); } catch { /* Missing inputs/configuration never confer authority. */ }
    const actions = { queued: 'authorize', running: 'wait', 'review-required': 'review', failed: 'repair', interrupted: attempt?.state === 'uncertain' ? 'reconcile-attempt' : 'authorize', completed: 'open-output' };
    const requestStates = this.db.prepare('SELECT json_extract(record,\'$.state\') AS state FROM pipeline_requests WHERE job=?').all(id);
    const uncertain = requestStates.some(record => ['uncertain', 'intent', 'observed'].includes(record.state));
    const nextAction = uncertain && !['completed', 'running'].includes(job.state) ? 'reconcile-attempt'
      : stale && !['completed', 'running'].includes(job.state) && attempt?.state !== 'uncertain' ? 'replan' : actions[job.state];
    return { id: job.id, project: job.project, task: job.task, state: job.state, stale, planHash: job.hash, input: job.input, output: job.output, error: job.error, attempt: attempt ? { ...attempt } : null, nextAction };
  }
  beforeProjectMutation(id, token) {
    const { directory } = this.project(id), owner = guard.readOwner(directory);
    if (owner?.type !== 'workspace' || owner.token !== token || this.leases.has(id)) fail('writer-busy');
    this.transaction(() => {
      this.db.prepare("UPDATE jobs SET state='interrupted',error='project-moved' WHERE project=? AND state<>'completed'").run(id);
      this.db.prepare('UPDATE authorizations SET consumed=1 WHERE job IN (SELECT id FROM jobs WHERE project=?)').run(id);
    });
  }
  close() {
    if (this.closed) return;
    try {
      this.transaction(() => { this.db.exec("UPDATE attempts SET state='uncertain' WHERE state='intent'; UPDATE authorizations SET consumed=1; UPDATE jobs SET state='interrupted',error='interrupted',epoch=NULL WHERE state='running'; UPDATE pipeline_requests SET record=json_set(record,'$.state','uncertain') WHERE json_extract(record,'$.state')='intent';"); });
      for (const [project, owned] of this.leases) this.unown(project, owned.token);
    } finally {
      this.closed = true;
      try { this.db.close(); } finally { this.ownership.exec('ROLLBACK'); this.ownership.close(); }
    }
  }
}
module.exports = { JobStore, scopeRecord, digest };
