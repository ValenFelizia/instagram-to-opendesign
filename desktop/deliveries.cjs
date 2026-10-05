const fs = require('node:fs');
const path = require('node:path');
const { randomUUID, createHash } = require('node:crypto');
const { pathToFileURL } = require('node:url');
const { TaskAuthority } = require('./task-authority.cjs');
const { fail, UUID, checked, inside, safeName, ensureDirectory, inventory, fingerprint, copyInventory, removeOwned, atomicJson } = require('./paths.cjs');
const core = () => import(pathToFileURL(path.join(__dirname, '../src/task-delivery.js')).href);
const verify = () => import(pathToFileURL(path.join(__dirname, '../src/agent-handoff.js')).href);
const HASH = /^[a-f0-9]{64}$/;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const clone = value => structuredClone(value);

// Main-owned project broker. Native file/directory choices are added by #57, not arbitrary renderer paths.
class Deliveries {
  constructor(store, { fault = () => {} } = {}) { this.store = store; this.authority = new TaskAuthority(store); this.fault = fault; }
  read(env) {
    const file = path.join(env.directory, 'delivery-history.json');
    if (!fs.existsSync(file)) return { schemaVersion: 'delivery-history/v1', project: env.project, revision: 0, deliveries: [], results: [], sources: [], efforts: [] };
    checked(file); if (fs.statSync(file).size > 16 * 1024 * 1024) fail('history-too-large');
    const value = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!exact(value, ['schemaVersion', 'project', 'revision', 'deliveries', 'results', 'sources', 'efforts']) || value.schemaVersion !== 'delivery-history/v1' || value.project !== env.project ||
        !Number.isSafeInteger(value.revision) || value.revision < 1 || ['deliveries', 'results', 'sources', 'efforts'].some(key => !Array.isArray(value[key]) || value[key].length > 1000)) fail('history-unreadable');
    for (const group of ['deliveries', 'results', 'sources']) if (new Set(value[group].map(row => row.id)).size !== value[group].length || value[group].some(row => !UUID.test(row.id) || !HASH.test(row.hash))) fail('history-unreadable');
    for (const row of value.deliveries) if (!UUID.test(row.taskId) || !Number.isSafeInteger(row.taskRevision) || row.taskRevision < 1 || !HASH.test(row.contextHash) || !HASH.test(row.inputKey) ||
        !['generic', 'opendesign'].includes(row.recipient) || row.executionId !== null && !UUID.test(row.executionId)) fail('history-unreadable');
    for (const row of value.results) if (!value.deliveries.some(delivery => delivery.id === row.deliveryId && delivery.hash === row.deliveryHash && delivery.contextHash === row.contextHash) ||
        !Number.isSafeInteger(row.revision) || row.revision < 0 || !UUID.test(row.firstOutput) || row.previousId !== null && !UUID.test(row.previousId) || row.publicationAllowed !== false) fail('history-unreadable');
    for (const row of value.sources) if (!HASH.test(row.sourceHash) || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(row.sourceId)) fail('history-unreadable');
    if (new Set(value.efforts.map(row => row.identity)).size !== value.efforts.length) fail('history-unreadable');
    for (const row of value.efforts) if (row.identity !== `${row.observation?.provider}/${row.observation?.attemptId}` || !Array.isArray(row.sourceIds) || !row.sourceIds.length ||
        !Array.isArray(row.deliveryIds) || !row.deliveryIds.length || row.sourceIds.some(id => !value.sources.some(source => source.sourceId === id)) ||
        row.deliveryIds.some(id => !value.deliveries.some(delivery => delivery.id === id))) fail('history-unreadable');
    return value;
  }
  async operate(project, action) {
    return this.authority.operate(project, async env => {
      const state = this.read(env), original = fingerprint(state);
      for (const row of state.efforts) (await core()).externalEffort(row.observation);
      env.history = state; env.staged = []; env.promoted = [];
      try {
        const result = await action(env);
        this.store.fence(project, this.store.leases.get(project)?.token);
        if (fingerprint(this.read(env)) !== original) fail('history-stale');
        if (fingerprint(state) !== original) {
          state.revision++;
          if (['deliveries', 'results', 'sources', 'efforts'].some(key => state[key].length > 1000) || Buffer.byteLength(JSON.stringify(state)) > 16 * 1024 * 1024) fail('history-too-large');
          this.fault('history-before-commit'); this.store.fence(project, this.store.leases.get(project)?.token);
          // No asynchronous boundary between final source/authority/bytes fences and promotion.
          if (fingerprint(inventory(env.input)) !== env.inputBaseline || fingerprint(this.authority.read(project, env.directory)) !== env.authorityBaseline) fail('history-stale');
          for (const file of env.dependencies) { checked(file.absolute); if (fingerprint(fs.readFileSync(file.absolute).toString('base64')) !== file.hash) fail('history-stale'); }
          for (const entry of env.staged) {
            checked(entry.staged); checked(path.dirname(entry.target));
            if (fingerprint(inventory(entry.staged)) !== entry.hash) fail('history-bytes-changed');
            if (fs.existsSync(entry.target)) fail('history-collision');
            fs.renameSync(entry.staged, entry.target); env.promoted.push(entry);
          }
          this.fault('history-after-promotion'); this.store.fence(project, this.store.leases.get(project)?.token);
          for (const entry of env.promoted) if (fingerprint(inventory(entry.target)) !== entry.hash) fail('history-bytes-changed');
          atomicJson(path.join(env.directory, 'delivery-history.json'), state);
        }
        return result;
      } finally {
        // Unindexed promoted folders are retained as orphans, never adopted as ready.
        for (const entry of env.staged) if (fs.existsSync(entry.staged)) removeOwned(path.dirname(entry.staged), entry.staged);
      }
    });
  }
  baseline(env) {
    env.inputBaseline = fingerprint(inventory(env.input)); env.authorityBaseline = fingerprint(this.authority.read(env.project, env.directory));
  }
  stage(env, group) {
    const parent = ensureDirectory(path.join(env.directory, group)), id = randomUUID();
    const staged = ensureDirectory(path.join(parent, `staging-${id}`)), target = path.join(parent, id);
    const entry = { staged, target, id }; env.staged.push(entry); return entry;
  }
  bindTree(env, root) {
    const tree = inventory(root);
    for (const row of tree.files) { const absolute = path.join(root, row.relative); env.dependencies.push({ absolute, hash: fingerprint(fs.readFileSync(absolute).toString('base64')) }); }
    return tree;
  }
  async plan(env, id, revision, recipient) {
    const task = this.authority.task(env, id, revision), prepared = await this.authority.current(env, task);
    if (revision !== task.revision) fail('authority-stale');
    const plan = await (await core()).taskDeliveryPlan(env.input, prepared, task, recipient);
    for (const file of plan.files) { checked(file.absolute); env.dependencies.push({ absolute: file.absolute, hash: fingerprint(fs.readFileSync(file.absolute).toString('base64')) }); }
    return plan;
  }
  async preview(project, taskId, revision, recipient = 'generic') {
    return this.operate(project, async env => {
      this.baseline(env); const plan = await this.plan(env, taskId, revision, recipient);
      return { previewHash: plan.previewHash, files: plan.publicFiles, executionCurrent: Boolean(plan.authority.execution), recipient };
    });
  }
  async create(project, taskId, revision, selection) {
    selection = clone(selection);
    return this.operate(project, async env => {
      this.baseline(env);
      if (!exact(selection, ['recipient', 'previewHash', 'paths'])) fail('invalid-delivery');
      const plan = await this.plan(env, taskId, revision, selection.recipient);
      if (selection.previewHash !== plan.previewHash) fail('delivery-preview-stale');
      const entry = this.stage(env, 'deliveries'), built = await (await core()).writeTaskDelivery(entry.staged, plan, selection.paths);
      const tree = inventory(entry.staged); entry.hash = fingerprint(tree);
      const record = { id: entry.id, taskId, taskRevision: revision, recipient: selection.recipient,
        at: new Date().toISOString(), path: `deliveries/${entry.id}`, hash: fingerprint(tree), contextHash: built.inventory.contextHash,
        inputKey: plan.authority.inputKey, executionId: plan.authority.execution?.id ?? null, selection: clone(selection), files: tree };
      env.history.deliveries.push(record);
      return { id: entry.id, contextHash: record.contextHash, mode: built.inventory.mode, publicationAllowed: false };
    });
  }
  entry(env, id, group = 'deliveries') {
    if (!UUID.test(id)) fail('invalid-request');
    const row = env.history[group].find(item => item.id === id); if (!row || row.path !== `${group}/${id}`) fail('history-missing');
    const root = path.join(env.directory, group, id), tree = this.bindTree(env, root);
    if (fingerprint(tree) !== row.hash || fingerprint(tree) !== fingerprint(row.files)) fail('history-bytes-changed');
    return { row, root, tree };
  }
  async readback(project, id) {
    return this.operate(project, async env => {
      const { row, root } = this.entry(env, id), packet = await (await verify()).verifyAgentHandoff(root);
      if (packet.contextHash !== row.contextHash || packet.authority.taskId !== row.taskId || packet.authority.taskRevision !== row.taskRevision || packet.authority.inputKey !== row.inputKey ||
          (packet.authority.execution?.id ?? null) !== row.executionId) fail('delivery-readback-mismatch');
      const task = env.state.tasks.find(item => item.id === row.taskId), current = task ? await this.authority.current(env, task) : null;
      return { ...clone(row), integrity: 'verified', executionCurrent: Boolean(current?.executionCurrent && current.execution.id === row.executionId && current.key === row.inputKey), publicationAllowed: false };
    });
  }
  async export(project, id, destinationParent) {
    return this.operate(project, async env => {
      this.baseline(env);
      const { row, root, tree } = this.entry(env, id);
      await (await verify()).verifyAgentHandoff(root);
      if (row.executionId) {
        const task = env.state.tasks.find(item => item.id === row.taskId), current = task ? await this.authority.current(env, task) : null;
        if (!current?.executionCurrent || current.execution.id !== row.executionId || current.key !== row.inputKey) fail('delivery-authority-stale');
      }
      checked(destinationParent);
      // Sharing and private workspace/backup must never overlap.
      if (destinationParent === env.directory || inside(env.directory, destinationParent) || inside(destinationParent, env.directory) ||
          destinationParent === this.store.root || inside(this.store.root, destinationParent) || inside(destinationParent, this.store.root)) fail('unsafe-path');
      const staged = ensureDirectory(path.join(destinationParent, `staging-${randomUUID()}`));
      try {
        copyInventory(root, staged, tree);
        const packet = await (await verify()).verifyAgentHandoff(staged);
        if (packet.contextHash !== row.contextHash) fail('delivery-readback-mismatch');
        this.store.fence(project, this.store.leases.get(project)?.token);
        if (fingerprint(inventory(root)) !== row.hash) fail('history-bytes-changed');
        this.fault('export-before-promotion'); this.store.fence(project, this.store.leases.get(project)?.token);
        if (fingerprint(inventory(root)) !== row.hash || fingerprint(inventory(staged)) !== row.hash) fail('history-bytes-changed');
        if (fingerprint(inventory(env.input)) !== env.inputBaseline || fingerprint(this.authority.read(project, env.directory)) !== env.authorityBaseline) fail('history-stale');
        for (const file of env.dependencies) { checked(file.absolute); if (fingerprint(fs.readFileSync(file.absolute).toString('base64')) !== file.hash) fail('history-stale'); }
        checked(destinationParent); const target = path.join(destinationParent, `handoff-${id}-${randomUUID()}`);
        fs.renameSync(staged, target); return { files: tree.files.length, folder: path.basename(target), contextHash: row.contextHash };
      } finally { if (fs.existsSync(staged)) removeOwned(destinationParent, staged); }
    });
  }
  supplied(env, sourceRoot, files, target) {
    checked(sourceRoot);
    if (sourceRoot === env.directory || inside(sourceRoot, env.directory) || inside(env.directory, sourceRoot) ||
        sourceRoot === this.store.root || inside(this.store.root, sourceRoot)) fail('unsafe-path');
    if (!Array.isArray(files) || !files.length || files.length > 100 || files.some(row => typeof row?.path !== 'string') || new Set(files.map(row => row.path.toLowerCase())).size !== files.length) fail('invalid-supplied-files');
    const selected = []; let total = 0;
    for (const row of files) {
      if (!exact(row, ['path', 'sha256', 'kind']) || typeof row.path !== 'string' || row.path.split('/').some(part => !safeName(part) || part.startsWith('.')) || row.path.includes('\\') || !HASH.test(row.sha256) ||
          !['html', 'screenshot', 'feedback', 'supporting', 'effort'].includes(row.kind)) fail('invalid-supplied-files');
      if (!/\.(?:json|html|css|md|txt|jpg|jpeg|png|webp|gif|svg|avif|tif|tiff|woff|woff2|ttf|otf|pdf|mp4|mov|webm)$/i.test(row.path)) fail('invalid-supplied-files');
      if (row.path.split('/').some(part => /^(credentials?|settings)(\.|$)/i.test(part))) fail('invalid-supplied-files');
      const absolute = path.join(sourceRoot, row.path); if (!inside(sourceRoot, absolute)) fail('unsafe-path'); checked(absolute);
      const stat = fs.statSync(absolute); total += stat.size;
      if (!stat.isFile() || stat.size > 32 * 1024 * 1024 || total > 256 * 1024 * 1024 || hash(fs.readFileSync(absolute)) !== row.sha256) fail('source-changed');
      env.dependencies.push({ absolute, hash: fingerprint(fs.readFileSync(absolute).toString('base64')) });
      const to = path.join(target, row.path); ensureDirectory(path.dirname(to)); fs.copyFileSync(absolute, to, fs.constants.COPYFILE_EXCL);
      selected.push({ ...row, size: stat.size });
    }
    return selected;
  }
  async result(project, deliveryId, input) {
    input = clone(input);
    return this.operate(project, async env => {
      this.baseline(env); const { row } = this.entry(env, deliveryId);
      if (!exact(input, ['sourceRoot', 'files', 'feedback', 'previousId']) || !Array.isArray(input.feedback) || input.feedback.length > 100) fail('invalid-result');
      const previous = env.history.results.filter(item => item.deliveryId === deliveryId).at(-1);
      if ((previous?.id ?? null) !== input.previousId) fail('result-revision-stale');
      if (previous) this.entry(env, previous.id, 'results');
      const entry = this.stage(env, 'results'), files = this.supplied(env, input.sourceRoot, input.files, ensureDirectory(path.join(entry.staged, 'artifacts')));
      for (const note of input.feedback) if (!exact(note, ['sourcePath', 'reviewer', 'note', 'cause']) || !files.some(file => file.path === note.sourcePath && file.kind === 'feedback') ||
          typeof note.reviewer !== 'string' || !note.reviewer.trim() || note.reviewer.length > 200 || typeof note.note !== 'string' || !note.note.trim() || note.note.length > 8000 ||
          !['source-selection', 'inference', 'preparation', 'brief', 'composition', 'unknown'].includes(note.cause)) fail('feedback-source-required');
      const result = { schemaVersion: 'task-result/v1', id: entry.id, deliveryId, deliveryHash: row.hash, contextHash: row.contextHash,
        revision: previous ? previous.revision + 1 : 0, previousId: input.previousId, firstOutput: previous?.firstOutput ?? entry.id,
        files, feedback: clone(input.feedback), at: new Date().toISOString(), status: 'needs-human-review', publicationAllowed: false };
      atomicJson(path.join(entry.staged, 'result.json'), result);
      const tree = inventory(entry.staged);
      entry.hash = fingerprint(tree);
      env.history.results.push({ ...result, path: `results/${entry.id}`, hash: fingerprint(tree), files: tree });
      return { id: entry.id, revision: result.revision, firstOutput: result.firstOutput, publicationAllowed: false };
    });
  }
  async importEffort(project, deliveryId, input) {
    input = clone(input);
    return this.operate(project, async env => {
      this.baseline(env); this.entry(env, deliveryId);
      if (!exact(input, ['sourceRoot', 'sourcePath', 'sha256', 'sourceId']) || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(input.sourceId)) fail('invalid-effort-source');
      const prior = env.history.sources.find(row => row.sourceId === input.sourceId);
      if (prior) {
        this.entry(env, prior.id, 'sources');
        checked(input.sourceRoot); const absolute = path.resolve(input.sourceRoot, input.sourcePath); checked(absolute);
        if (!inside(input.sourceRoot, absolute) || hash(fs.readFileSync(absolute)) !== input.sha256 || prior.sourceHash !== input.sha256) fail('effort-source-conflict');
        for (const row of env.history.efforts.filter(item => item.sourceIds.includes(input.sourceId))) if (!row.deliveryIds.includes(deliveryId)) row.deliveryIds.push(deliveryId);
        return { duplicate: true, summary: (await core()).effortSummary(env.history.efforts) };
      }
      const entry = this.stage(env, 'sources');
      this.supplied(env, input.sourceRoot, [{ path: input.sourcePath, sha256: input.sha256, kind: 'effort' }], entry.staged);
      const source = JSON.parse(fs.readFileSync(path.join(entry.staged, input.sourcePath), 'utf8'));
      if (!exact(source, ['schemaVersion', 'sourceId', 'records']) || source.schemaVersion !== 'external-effort/v1' || source.sourceId !== input.sourceId || !Array.isArray(source.records) || !source.records.length || source.records.length > 1000) fail('invalid-effort-source');
      const api = await core(), observations = source.records.map(api.externalEffort), seen = new Map();
      for (const observation of observations) {
        const identity = `${observation.provider}/${observation.attemptId}`, priorObservation = seen.get(identity) ?? env.history.efforts.find(row => row.identity === identity)?.observation;
        if (priorObservation && fingerprint(priorObservation) !== fingerprint(observation)) fail('effort-observation-conflict');
        seen.set(identity, observation);
        const existing = env.history.efforts.find(row => row.identity === identity);
        if (existing) { if (!existing.sourceIds.includes(input.sourceId)) existing.sourceIds.push(input.sourceId); if (!existing.deliveryIds.includes(deliveryId)) existing.deliveryIds.push(deliveryId); }
        else env.history.efforts.push({ identity, observation, sourceIds: [input.sourceId], deliveryIds: [deliveryId] });
      }
      const tree = inventory(entry.staged);
      entry.hash = fingerprint(tree);
      env.history.sources.push({ id: entry.id, sourceId: input.sourceId, sourceHash: input.sha256, path: `sources/${entry.id}`, hash: fingerprint(tree), files: tree, deliveryId, at: new Date().toISOString() });
      return { duplicate: false, summary: api.effortSummary(env.history.efforts) };
    });
  }
  async history(project) {
    return this.operate(project, async env => {
      for (const group of ['deliveries', 'results', 'sources']) for (const row of env.history[group]) this.entry(env, row.id, group);
      const orphanIds = [];
      for (const group of ['deliveries', 'results', 'sources']) {
        const folder = path.join(env.directory, group);
        if (!fs.existsSync(folder)) continue; checked(folder);
        for (const id of fs.readdirSync(folder)) if (!env.history[group].some(row => row.id === id)) orphanIds.push({ group, id });
      }
      return { ...clone(env.history), summary: (await core()).effortSummary(env.history.efforts), orphans: orphanIds, publicationAllowed: false };
    });
  }
}
module.exports = { Deliveries };
