const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { pathToFileURL } = require('node:url');
const { fail, UUID, checked, inside, safeName, inventory, fingerprint, atomicJson } = require('./paths.cjs');
const core = () => import(pathToFileURL(path.join(__dirname, '../src/task-authority.js')).href);
const clone = value => structuredClone(value);
const keys = (value, allowed) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === allowed.length && allowed.every(key => Object.hasOwn(value, key));
const HASH = /^[a-f0-9]{64}$/;

// Privileged main API. No renderer or source/model text may call these methods.
class TaskAuthority {
  constructor(store, { fault = () => {} } = {}) { this.store = store; this.fault = fault; }
  read(project, directory) {
    const file = path.join(directory, 'task-authority.json');
    if (!fs.existsSync(file)) return { schemaVersion: 'task-authority/v1', project, revision: 0, tasks: [], history: [] };
    checked(file); if (fs.statSync(file).size > 16 * 1024 * 1024) fail('authority-too-large');
    const value = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!keys(value, ['schemaVersion', 'project', 'revision', 'tasks', 'history']) || value.schemaVersion !== 'task-authority/v1' || value.project !== project ||
        !Number.isSafeInteger(value.revision) || value.revision < 1 || !Array.isArray(value.tasks) || value.tasks.length > 100 || !Array.isArray(value.history) || value.history.length > 1000) fail('authority-unreadable');
    if (new Set(value.tasks.map(task => task.id)).size !== value.tasks.length || new Set(value.history.map(item => item.id)).size !== value.history.length) fail('authority-unreadable');
    for (const task of value.tasks) if (!keys(task, ['id', 'revision', 'mode', 'request', 'directions', 'execution', 'publications', 'revocations']) || !UUID.test(task.id) ||
        !Number.isSafeInteger(task.revision) || task.revision < 1 || !['exploration', 'selected'].includes(task.mode) || !Array.isArray(task.publications) || !Array.isArray(task.revocations) ||
        task.execution && (!UUID.test(task.execution.id) || !HASH.test(task.execution.key))) fail('authority-unreadable');
    for (const item of value.history) if (!UUID.test(item.id) || !UUID.test(item.taskId) || typeof item.action !== 'string') fail('authority-unreadable');
    return value;
  }
  async operate(project, action) {
    const token = this.store.own(project), { directory, input } = this.store.project(project);
    try {
      const baseline = fingerprint(inventory(input)), state = this.read(project, directory), original = fingerprint(state);
      const env = { state, directory, input, project, dependencies: [], correction: null };
      const result = await action(env);
      this.store.fence(project, token);
      if (fingerprint(inventory(input)) !== baseline || fingerprint(this.read(project, directory)) !== original) fail('authority-stale');
      for (const file of env.dependencies) {
        checked(file.absolute); if (fingerprint(fs.readFileSync(file.absolute).toString('base64')) !== file.hash) fail('authority-stale');
      }
      if (state.tasks.length > 100 || state.history.length > 1000 || Buffer.byteLength(JSON.stringify(state)) > 16 * 1024 * 1024) fail('authority-too-large');
      if (env.correction && Buffer.byteLength(JSON.stringify(env.correction)) > 16 * 1024 * 1024) fail('authority-too-large');
      this.fault('authority-before-commit'); this.store.fence(project, token);
      // A correction's complete rule/source/history is one atomic canonical document.
      // If the following task write fails, dependency checks still reject every stale approval.
      if (env.correction) {
        atomicJson(path.join(input, 'brand-decisions.json'), env.correction);
        this.fault('authority-after-correction'); this.store.fence(project, token);
      }
      if (fingerprint(state) !== original) {
        state.revision++;
        atomicJson(path.join(directory, 'task-authority.json'), state);
      }
      return result;
    } finally { if (!this.store.closed && this.store.leases.get(project)?.token === token) this.store.unown(project, token); }
  }
  task(env, id, revision) {
    if (!UUID.test(id)) fail('invalid-request');
    const task = env.state.tasks.find(item => item.id === id); if (!task) fail('task-missing');
    if (revision != null && revision !== task.revision) fail('authority-stale'); return task;
  }
  record(env, task, action, before) {
    task.revision++;
    env.state.history.push({ id: randomUUID(), taskId: task.id, action, at: new Date().toISOString(), before: clone(before), after: clone(task) });
  }
  revoke(task, reason) {
    if (task.execution) {
      task.revocations.push({ id: task.execution.id, reason, record: clone(task.execution) }); task.execution = null;
    }
    for (const record of task.publications) if (!task.revocations.some(item => item.id === record.id)) task.revocations.push({ id: record.id, reason, record: clone(record) });
  }
  bind(env, brief) {
    for (const file of brief?.codeContext?.files ?? []) {
      const absolute = path.resolve(brief.codeContext.root, file.path); checked(absolute);
      const bytes = fs.readFileSync(absolute);
      if (require('node:crypto').createHash('sha256').update(bytes).digest('hex') !== file.sha256) fail('authority-stale');
      env.dependencies.push({ absolute, hash: fingerprint(bytes.toString('base64')) });
    }
  }
  async current(env, task) {
    const api = await core();
    let prepared;
    try { prepared = task.mode === 'exploration' ? await api.prepareExploration(env.input, task.request)
      : await api.prepareSelectedTask(env.input, task.request, task.directions); }
    catch { prepared = { key: null, ready: false, questions: ['Current task inputs are missing, changed or invalid; review them before execution.'], brief: null }; }
    this.bind(env, prepared.brief);
    const before = clone(task);
    if (task.execution && (!prepared.ready || task.execution.key !== prepared.key)) this.revoke(task, 'Task dependencies changed; renewed review is required.');
    for (const record of task.publications) if (!task.revocations.some(item => item.id === record.id)) {
      try {
        if (!task.execution || record.executionId !== task.execution.id || !await this.publicationCurrent(env, record, prepared.brief)) task.revocations.push({ id: record.id, reason: 'Artifact, rights or rendered-review dependencies changed.', record: clone(record) });
      } catch { task.revocations.push({ id: record.id, reason: 'Artifact, rights or rendered-review dependencies unavailable.', record: clone(record) }); }
    }
    if (fingerprint(before) !== fingerprint(task)) this.record(env, task, 'revoke-stale-authority', before);
    return { ...prepared, taskId: task.id, revision: task.revision, mode: task.mode,
      executionCurrent: Boolean(task.execution && prepared.ready && task.execution.key === prepared.key),
      publicationCurrent: task.publications.some(record => !task.revocations.some(item => item.id === record.id)), execution: clone(task.execution) };
  }
  async create(project, request) {
    request = clone(request);
    return this.operate(project, async env => {
      const prepared = await (await core()).prepareExploration(env.input, request);
      const task = { id: randomUUID(), revision: 0, mode: 'exploration', request: clone(request), directions: null, execution: null, publications: [], revocations: [] };
      env.state.tasks.push(task); this.record(env, task, 'create-exploration', null);
      return { taskId: task.id, revision: task.revision, ...prepared };
    });
  }
  async preview(project, id) { return this.operate(project, env => this.current(env, this.task(env, id))); }
  async select(project, id, revision, request, directions) {
    request = clone(request); directions = clone(directions ?? null);
    return this.operate(project, async env => {
      const task = this.task(env, id, revision), prepared = await (await core()).prepareSelectedTask(env.input, request, directions);
      this.bind(env, prepared.brief); const before = clone(task); this.revoke(task, 'Explicit task/request/direction replacement.');
      Object.assign(task, { mode: 'selected', request: clone(request), directions: clone(directions ?? null) });
      this.record(env, task, 'select-request', before); return { ...prepared, taskId: task.id, revision: task.revision, executionCurrent: false };
    });
  }
  async reviewExecution(project, id, revision, expectedKey, reviewer) {
    reviewer = clone(reviewer);
    return this.operate(project, async env => {
      const task = this.task(env, id, revision), prepared = await this.current(env, task), api = await core();
      if (task.revision !== revision || !prepared.ready || !HASH.test(expectedKey) || prepared.key !== expectedKey) fail('execution-review-required');
      const review = api.reviewerRecord(reviewer), before = clone(task);
      this.revoke(task, 'New execution review replaces previous acceptance.');
      task.execution = { id: randomUUID(), key: expectedKey, ...review };
      this.record(env, task, 'review-execution', before); return { ...clone(task.execution), taskId: task.id, revision: task.revision };
    });
  }
  artifact(env, files) {
    if (!Array.isArray(files) || !files.length || files.length > 100 || files.some(file => typeof file?.path !== 'string') || new Set(files.map(file => file.path.toLowerCase())).size !== files.length) fail('invalid-artifact');
    let total = 0;
    const recorded = files.map(file => {
      if (!keys(file, ['path', 'sha256']) || !file.path.startsWith('results/') || file.path.includes('\\') || !HASH.test(file.sha256) || file.path.split('/').some(part => !safeName(part) || part.startsWith('.'))) fail('invalid-artifact');
      const absolute = path.resolve(env.directory, file.path); if (!inside(env.directory, absolute)) fail('invalid-artifact'); checked(absolute);
      if (!fs.statSync(absolute).isFile() || fs.statSync(absolute).size > 32 * 1024 * 1024) fail('invalid-artifact');
      total += fs.statSync(absolute).size; if (total > 256 * 1024 * 1024) fail('invalid-artifact');
      const bytes = fs.readFileSync(absolute), sha256 = require('node:crypto').createHash('sha256').update(bytes).digest('hex');
      if (sha256 !== file.sha256) fail('artifact-changed'); env.dependencies.push({ absolute, hash: fingerprint(bytes.toString('base64')) });
      return { path: file.path, sha256 };
    }).sort((a, b) => a.path.localeCompare(b.path));
    return { files: recorded, hash: require('node:crypto').createHash('sha256').update(JSON.stringify(recorded)).digest('hex') };
  }
  async publicationSources(env, kind, grant, review) {
    const { decisions } = await (await core()).taskEvidence(env.input, kind);
    const sources = [grant.sourceId, review.sourceId].map(id => decisions.sources.find(source => source.id === id && !source.stale));
    if (sources.some(source => !source)) fail('publication-source-required');
    return sources.map(source => ({ id: source.id, sha256: source.sha256 }));
  }
  async publicationCurrent(env, record, brief) {
    if (!brief || this.artifact(env, record.artifact.files).hash !== record.artifact.hash) return false;
    return JSON.stringify(await this.publicationSources(env, brief.kind, record.grant, record.review)) === JSON.stringify(record.sources);
  }
  async acceptPublication(project, id, revision, input) {
    input = clone(input);
    return this.operate(project, async env => {
      if (!keys(input, ['executionId', 'target', 'files', 'grant', 'review'])) fail('invalid-publication');
      const task = this.task(env, id, revision), prepared = await this.current(env, task), api = await core();
      if (task.revision !== revision || !prepared.executionCurrent || task.execution.id !== input.executionId) fail('execution-review-required');
      if (!keys(input.target, ['platform', 'use']) || !['instagram-story', 'instagram-post', 'website'].includes(input.target.platform) || input.target.use !== 'public-publication') fail('invalid-publication');
      const expectedPlatform = prepared.brief.kind === 'instagram-story' ? 'instagram-story' : prepared.brief.kind === 'promotional-image' ? 'instagram-post' : 'website';
      if (input.target.platform !== expectedPlatform) fail('invalid-publication');
      const grant = input.grant;
      if (!keys(grant, ['sourceId', 'assetIds', 'platform', 'use', 'reviewer', 'reviewedAt']) || grant.platform !== input.target.platform || grant.use !== input.target.use ||
          !Array.isArray(grant.assetIds) || JSON.stringify([...grant.assetIds].sort()) !== JSON.stringify(prepared.brief.assets.map(asset => asset.id).sort())) fail('publication-permission-required');
      api.reviewerRecord({ reviewer: grant.reviewer, reviewedAt: grant.reviewedAt });
      const artifact = this.artifact(env, input.files), review = api.publicationReview(input.review, api.publicationChecks(prepared.brief.kind));
      if (review.artifactHash !== artifact.hash || review.executionId !== task.execution.id) fail('render-review-stale');
      const sources = await this.publicationSources(env, prepared.brief.kind, grant, review), before = clone(task);
      const record = { id: randomUUID(), executionId: task.execution.id, executionKey: task.execution.key, target: clone(input.target), artifact, grant: clone(grant), review, sources };
      task.publications.push(record); this.record(env, task, 'accept-exact-publication', before);
      return { id: record.id, artifactHash: artifact.hash, taskId: task.id, revision: task.revision, publicationOperationAuthorized: false };
    });
  }
  async correctionPreview(project, command) {
    command = clone(command);
    return this.operate(project, async env => {
      const correction = await (await core()).correctedRuleDocument(env.input, command);
      const scope = correction.previous.scope ?? 'all';
      const affectedTasks = env.state.tasks.filter(task => task.mode === 'selected' && (scope === 'all' || channel(task.request.kind) === scope)).map(task => task.id).sort();
      return { baseHash: command.baseHash, previewHash: fingerprint({ command, revision: env.state.revision, affectedTasks }), affectedTasks,
        before: correction.previous, after: correction.after };
    });
  }
  async correct(project, command, acknowledgment) {
    command = clone(command); acknowledgment = clone(acknowledgment);
    return this.operate(project, async env => {
      if (!keys(acknowledgment, ['previewHash', 'affectedTasks']) || !Array.isArray(acknowledgment.affectedTasks)) fail('correction-acknowledgment-required');
      const correction = await (await core()).correctedRuleDocument(env.input, command), scope = correction.previous.scope ?? 'all';
      const affectedTasks = env.state.tasks.filter(task => task.mode === 'selected' && (scope === 'all' || channel(task.request.kind) === scope)).map(task => task.id).sort();
      if (acknowledgment.previewHash !== fingerprint({ command, revision: env.state.revision, affectedTasks }) || JSON.stringify(affectedTasks) !== JSON.stringify(acknowledgment.affectedTasks)) fail('correction-acknowledgment-required');
      for (const id of affectedTasks) { const task = this.task(env, id), before = clone(task); this.revoke(task, 'Sourced rule correction.'); this.record(env, task, 'correct-dependent-rule', before); }
      env.correction = correction.document;
      return { baseHash: (await core()).authorityHash(correction.document), affectedTasks };
    });
  }
}
const channel = kind => ['instagram-story', 'promotional-image'].includes(kind) ? 'social' : 'website';
module.exports = { TaskAuthority };
