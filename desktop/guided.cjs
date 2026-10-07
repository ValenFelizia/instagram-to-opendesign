const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { UUID, BrokerError, checked, fail } = require('./paths.cjs');

const CHANNEL = 'guided:request';
const HASH = /^[a-f0-9]{64}$/;
const projection = () => import(pathToFileURL(path.join(__dirname, '../src/spend-projection.js')).href);

const shapes = {
  status: ['projectId'],
  plan: ['projectId', 'taskId', 'taskRevision', 'options'],
  preview: ['projectId', 'jobId'],
  authorize: ['projectId', 'jobId', 'planHash', 'consent'],
  run: ['projectId', 'jobId', 'planHash', 'authorization', 'recovery'],
  stop: ['projectId', 'jobId'],
  retry: ['projectId', 'jobId', 'planHash'],
  reconcile: ['projectId', 'jobId', 'requestId', 'planHash'],
  'authority-create': ['projectId', 'request'],
  'authority-preview': ['projectId', 'taskId'],
  'authority-select': ['projectId', 'taskId', 'revision', 'request', 'directions'],
  'authority-review': ['projectId', 'taskId', 'revision', 'expectedKey', 'reviewer'],
  'delivery-preview': ['projectId', 'taskId', 'revision', 'recipient'],
  'delivery-create': ['projectId', 'taskId', 'revision', 'selection'],
  'delivery-history': ['projectId'],
  'delivery-export': ['projectId', 'deliveryId'],
};

const codes = new Set([
  'invalid-request', 'stale-authorization', 'job-unavailable', 'job-store-unavailable', 'writer-busy', 'writer-fenced',
  'profile-required', 'invalid-pipeline-plan', 'paid-retry-requires-new-plan', 'invalid-recovery', 'dispatch-stopped',
  'manual-reconciliation-required', 'lookup-unavailable', 'request-limit', 'snapshot-invalid', 'pipeline-incomplete',
  'task-missing', 'authority-stale', 'authority-unreadable', 'authority-too-large', 'history-unreadable', 'history-stale',
  'history-too-large', 'invalid-delivery', 'delivery-unavailable', 'storage-unavailable', 'consent-required',
  'project-unavailable', 'unsafe-path', 'execution-review-required', 'delivery-authority-stale',
]);

function validGuidedRequest(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || typeof value.action !== 'string' || !Object.hasOwn(shapes, value.action)) return false;
  const keys = shapes[value.action];
  if (Object.keys(value).length !== keys.length + 1 || !keys.every(key => Object.hasOwn(value, key))) return false;
  if (keys.includes('projectId') && (typeof value.projectId !== 'string' || !UUID.test(value.projectId))) return false;
  if (keys.includes('jobId') && (typeof value.jobId !== 'string' || !UUID.test(value.jobId))) return false;
  if (keys.includes('taskId') && (typeof value.taskId !== 'string' || !UUID.test(value.taskId))) return false;
  if (keys.includes('deliveryId') && (typeof value.deliveryId !== 'string' || !UUID.test(value.deliveryId))) return false;
  if (keys.includes('requestId') && (typeof value.requestId !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(value.requestId))) return false;
  if (keys.includes('planHash') && (typeof value.planHash !== 'string' || !HASH.test(value.planHash))) return false;
  if (keys.includes('authorization') && (typeof value.authorization !== 'string' || !UUID.test(value.authorization))) return false;
  if (keys.includes('expectedKey') && (typeof value.expectedKey !== 'string' || !HASH.test(value.expectedKey))) return false;
  if (keys.includes('taskRevision') && (!Number.isSafeInteger(value.taskRevision) || value.taskRevision < 1)) return false;
  if (keys.includes('revision') && (!Number.isSafeInteger(value.revision) || value.revision < 1)) return false;
  if (keys.includes('recovery') && typeof value.recovery !== 'boolean') return false;
  if (keys.includes('consent') && typeof value.consent !== 'boolean') return false;
  if (keys.includes('recipient') && !['generic', 'opendesign'].includes(value.recipient)) return false;
  if (keys.includes('options') && (!value.options || typeof value.options !== 'object' || Array.isArray(value.options))) return false;
  if (keys.includes('request') && (!value.request || typeof value.request !== 'object' || Array.isArray(value.request))) return false;
  if (keys.includes('directions') && value.directions != null && (typeof value.directions !== 'object' || Array.isArray(value.directions))) return false;
  if (keys.includes('selection') && (!value.selection || typeof value.selection !== 'object' || Array.isArray(value.selection))) return false;
  if (keys.includes('reviewer') && (typeof value.reviewer !== 'string' || !value.reviewer.trim() || value.reviewer.length > 200)) return false;
  return true;
}

function diagnostic(error, action) {
  // Never spread paths, keys, profile identifiers, payloads or exception text into renderer responses.
  const code = error instanceof BrokerError && codes.has(error.code) || codes.has(error?.code) ? error.code : 'storage-unavailable';
  return { ok: false, code, action: Object.hasOwn(shapes, action) ? action : 'unknown' };
}

function sanitizeRequest(record) {
  return {
    id: record.id,
    provider: record.provider ?? null,
    stage: record.stage ?? null,
    state: record.state ?? null,
    usage: record.usage ?? null,
    billing: record.billing ?? null,
    wallMs: record.wallMs ?? null,
    responseKnown: Boolean(record.responseId),
    lookupOf: record.lookupOf ?? null,
  };
}

function availableInventory(store, job) {
  const available = [];
  for (const stage of store.db.prepare('SELECT name,state,snapshot FROM pipeline_stages WHERE job=?').all(job.id)) {
    if (!stage.snapshot) continue;
    const snapshot = store.db.prepare('SELECT * FROM snapshots WHERE id=?').get(stage.snapshot);
    if (!store.validSnapshot(snapshot)) continue;
    let files = 0;
    try { files = JSON.parse(snapshot.inventory).files.length; } catch { files = 0; }
    available.push({ stage: stage.name, state: stage.state, files, hashPresent: Boolean(snapshot.hash) });
  }
  if (job.output) {
    const output = store.db.prepare('SELECT * FROM snapshots WHERE id=?').get(job.output);
    if (store.validSnapshot(output)) {
      let files = 0;
      try { files = JSON.parse(output.inventory).files.length; } catch { files = 0; }
      available.push({ stage: 'output', state: 'committed', files, hashPresent: Boolean(output.hash) });
    }
  }
  return available;
}

function loadBrandRuns(directory) {
  const records = [];
  for (const candidate of [
    path.join(directory, 'data'),
    directory,
  ]) {
    if (!fs.existsSync(candidate)) continue;
    try { checked(candidate); } catch { continue; }
    const walk = root => {
      let entries;
      try { entries = fs.readdirSync(root, { withFileTypes: true }); } catch { return; }
      for (const entry of entries) {
        const full = path.join(root, entry.name);
        try {
          if (entry.isDirectory() && entry.name === 'runs') {
            for (const file of fs.readdirSync(full)) {
              if (!file.endsWith('.json') || file.includes('.response.')) continue;
              const absolute = path.join(full, file);
              checked(absolute);
              if (fs.statSync(absolute).size > 2 * 1024 * 1024) continue;
              const record = JSON.parse(fs.readFileSync(absolute, 'utf8'));
              if (record?.schemaVersion === 'brand-run/v1') records.push(record);
            }
          } else if (entry.isDirectory() && !['staging', 'snapshots', 'requests', 'deliveries', 'results', 'sources', 'node_modules'].includes(entry.name)) {
            walk(full);
          }
        } catch { /* Skip unreadable private trees without exposing paths. */ }
      }
    };
    walk(candidate);
  }
  return records;
}

function notificationCopy(kind) {
  return ({
    planned: 'Alcance listo para revisar.',
    authorized: 'Pedido autorizado.',
    running: 'Trabajo en curso.',
    stopped: 'No se enviarán más solicitudes desde esta app.',
    completed: 'Etapas solicitadas completadas.',
    interrupted: 'Trabajo interrumpido. Reabrir no reintenta nada.',
    failed: 'El trabajo falló. Se conservan resultados previos válidos.',
    stale: 'El contexto cambió. Revisá el alcance nuevo.',
  })[kind] || null;
}

class GuidedBroker {
  constructor({ store, pipeline, authority, deliveries, dialog, window, authorized, notify = null }) {
    Object.assign(this, { store, pipeline, authority, deliveries, dialog, window, authorized, notify });
  }

  jobsFor(projectId) {
    return this.store.db.prepare('SELECT id FROM jobs WHERE project=? ORDER BY rowid DESC').all(projectId).map(row => this.store.view(row.id));
  }

  async status(projectId) {
    const { directory } = this.store.project(projectId);
    const jobs = this.jobsFor(projectId);
    const current = jobs[0] || null;
    let preview = null;
    let stages = [];
    let requests = [];
    let recipeStages = [];
    if (current) {
      try {
        const recipe = this.pipeline.recipe(current.id);
        recipeStages = recipe.stages;
        stages = this.pipeline.stages(current.id);
        requests = this.pipeline.requests(current.id).map(sanitizeRequest);
        preview = await this.pipeline.preview(current.id);
      } catch { /* Interrupted/stale plans still report job state without inventing stages. */ }
    }
    const api = await projection();
    let efforts = [];
    try {
      const history = await this.deliveries.history(projectId);
      efforts = history.efforts || [];
    } catch { efforts = []; }
    const records = loadBrandRuns(directory);
    const pipelineRows = current ? this.pipeline.requests(current.id) : [];
    const spend = api.projectSpend({ records, requests: pipelineRows, efforts });
    const timeline = api.projectStages(
      recipeStages.length ? recipeStages : ['ingestion', 'evidence', 'analysis', 'colors', 'compilation'],
      stages.map(row => ({ ...row, mode: preview?.stages?.find(item => item.name === row.name)?.mode || null })),
      current?.state,
    );
    const available = current ? availableInventory(this.store, this.store.job(current.id)) : [];
    return {
      projectId,
      job: current,
      jobs: jobs.map(job => ({
        id: job.id, task: job.task, state: job.state, stale: job.stale,
        nextAction: job.nextAction, planHash: job.planHash, error: job.error ? 'recorded' : null,
      })),
      preview: preview ? {
        planHash: preview.planHash,
        stages: preview.stages,
        limits: {
          maxPaidCalls: preview.limits.maxPaidCalls,
          maxRequests: preview.limits.maxRequests,
          language: preview.limits.language,
          includeReport: preview.limits.includeReport,
          includeExport: preview.limits.includeExport,
          refresh: preview.limits.refresh,
          reanalyze: preview.limits.reanalyze,
        },
        requestCount: preview.requests,
      } : null,
      stages: timeline,
      available,
      requests,
      spend: {
        byCurrency: spend.byCurrency,
        attemptCount: spend.attemptCount,
        unknownBilling: spend.unknownBilling,
        partial: spend.partial,
        totalCost: spend.totalCost,
        suppliedAttemptWallMs: spend.suppliedAttemptWallMs,
        humanMinutes: spend.humanMinutes,
        usageByModel: spend.usageByModel,
        observations: spend.observations.map(row => ({
          id: row.id, phase: row.phase, status: row.status, provider: row.provider, model: row.model,
          usage: row.usage, billing: row.billing, wallMs: row.wallMs, humanMinutes: row.humanMinutes, source: row.source,
        })),
        percentage: null,
        estimatedRemaining: null,
        coverage: spend.coverage,
      },
      cancellationSupported: false,
      reopenDispatches: false,
    };
  }

  announce(kind) {
    const body = notificationCopy(kind);
    if (!body || typeof this.notify !== 'function') return;
    try { this.notify({ title: 'Instagram to OpenDesign', body }); } catch { /* Notifications are optional. */ }
  }

  async handle(request) {
    if (!validGuidedRequest(request)) return diagnostic(new BrokerError('invalid-request'), 'unknown');
    try {
      if (!this.authorized()) fail('invalid-request');
      switch (request.action) {
        case 'status':
          return { ok: true, progress: await this.status(request.projectId) };
        case 'plan': {
          const job = this.pipeline.plan(request.projectId, {
            taskId: request.taskId,
            taskRevision: request.taskRevision,
            ...request.options,
          });
          this.announce('planned');
          return { ok: true, job, progress: await this.status(request.projectId) };
        }
        case 'preview': {
          const job = this.store.view(request.jobId);
          if (job.project !== request.projectId) fail('invalid-request');
          const preview = await this.pipeline.preview(request.jobId);
          return { ok: true, preview: {
            planHash: preview.planHash,
            stages: preview.stages,
            limits: {
              maxPaidCalls: preview.limits.maxPaidCalls,
              maxRequests: preview.limits.maxRequests,
              language: preview.limits.language,
              includeReport: preview.limits.includeReport,
              includeExport: preview.limits.includeExport,
              refresh: preview.limits.refresh,
              reanalyze: preview.limits.reanalyze,
            },
            requestCount: preview.requests,
          } };
        }
        case 'authorize': {
          if (!request.consent) fail('consent-required');
          const job = this.store.view(request.jobId);
          if (job.project !== request.projectId || job.planHash !== request.planHash || job.stale) fail('stale-authorization');
          const authorization = this.pipeline.authorize(request.jobId, request.planHash);
          this.announce('authorized');
          return { ok: true, authorization, job: this.store.view(request.jobId) };
        }
        case 'run': {
          const job = this.store.view(request.jobId);
          if (job.project !== request.projectId || job.planHash !== request.planHash || job.stale) fail('stale-authorization');
          this.announce('running');
          const result = await this.pipeline.run(request.jobId, request.authorization, { recovery: request.recovery });
          this.announce(result.state === 'completed' ? 'completed' : result.state);
          return { ok: true, job: result, progress: await this.status(request.projectId) };
        }
        case 'stop': {
          const job = this.store.view(request.jobId);
          if (job.project !== request.projectId) fail('invalid-request');
          this.pipeline.stop(request.jobId);
          this.announce('stopped');
          return { ok: true, job: this.store.view(request.jobId), cancellationSupported: false, progress: await this.status(request.projectId) };
        }
        case 'retry': {
          const job = this.store.view(request.jobId);
          if (job.project !== request.projectId || job.planHash !== request.planHash) fail('stale-authorization');
          const next = this.store.retryJob(request.jobId, request.planHash);
          return { ok: true, job: next, progress: await this.status(request.projectId) };
        }
        case 'reconcile': {
          const job = this.store.view(request.jobId);
          if (job.project !== request.projectId || job.planHash !== request.planHash || job.stale) fail('stale-authorization');
          const result = await this.pipeline.reconcileApify(request.jobId, request.requestId, request.planHash);
          return { ok: true, reconcile: { requestId: result.requestId, remoteStatus: result.remoteStatus, lookupCount: result.lookupIds.length }, progress: await this.status(request.projectId) };
        }
        case 'authority-create': {
          const task = await this.authority.create(request.projectId, request.request);
          return { ok: true, task: sanitizeTask(task) };
        }
        case 'authority-preview': {
          const preview = await this.authority.preview(request.projectId, request.taskId);
          return { ok: true, preview: sanitizeAuthorityPreview(preview) };
        }
        case 'authority-select': {
          const task = await this.authority.select(request.projectId, request.taskId, request.revision, request.request, request.directions);
          return { ok: true, task: sanitizeTask(task) };
        }
        case 'authority-review': {
          const task = await this.authority.reviewExecution(request.projectId, request.taskId, request.revision, request.expectedKey, request.reviewer);
          return { ok: true, task: sanitizeTask(task) };
        }
        case 'delivery-preview': {
          const preview = await this.deliveries.preview(request.projectId, request.taskId, request.revision, request.recipient);
          return { ok: true, preview: sanitizeDeliveryPreview(preview) };
        }
        case 'delivery-create': {
          const delivery = await this.deliveries.create(request.projectId, request.taskId, request.revision, request.selection);
          return { ok: true, delivery: { id: delivery.id, recipient: delivery.recipient, contextHash: delivery.contextHash, publicationAllowed: false } };
        }
        case 'delivery-history': {
          const history = await this.deliveries.history(request.projectId);
          return { ok: true, history: {
            revision: history.revision,
            deliveries: history.deliveries.map(row => ({ id: row.id, taskId: row.taskId, recipient: row.recipient, executionId: row.executionId, at: row.at })),
            results: history.results.map(row => ({ id: row.id, deliveryId: row.deliveryId, revision: row.revision, status: row.status })),
            summary: history.summary,
            orphans: history.orphans.length,
            publicationAllowed: false,
          } };
        }
        case 'delivery-export': {
          // Native picker stays in main; absolute paths never enter renderer IPC.
          const result = await this.dialog.showOpenDialog(this.window(), {
            title: 'Carpeta destino para exportar el paquete',
            properties: ['openDirectory', 'dontAddToRecent'],
          });
          if (!this.authorized()) fail('invalid-request');
          if (result.canceled || result.filePaths.length !== 1) return { ok: true, canceled: true };
          const parent = checked(result.filePaths[0]);
          const exported = await this.deliveries.export(request.projectId, request.deliveryId, parent);
          return { ok: true, exported: { files: exported.files, verified: true } };
        }
      }
    } catch (error) {
      return diagnostic(error, request.action);
    }
  }
}

function sanitizeTask(task) {
  return {
    id: task.taskId || task.id,
    revision: task.revision,
    mode: task.mode || null,
    ready: task.ready ?? null,
    key: task.key || null,
    executionCurrent: Boolean(task.executionCurrent ?? task.execution),
    publicationCount: Array.isArray(task.publications) ? task.publications.length : 0,
    questions: Array.isArray(task.questions) ? task.questions.slice(0, 20).map(item => String(item).slice(0, 400)) : [],
  };
}

function sanitizeAuthorityPreview(preview) {
  return {
    taskId: preview.taskId,
    revision: preview.revision,
    mode: preview.mode,
    ready: Boolean(preview.ready),
    executionCurrent: Boolean(preview.executionCurrent),
    publicationCurrent: Boolean(preview.publicationCurrent),
    questions: Array.isArray(preview.questions) ? preview.questions.slice(0, 20).map(item => String(item).slice(0, 400)) : [],
  };
}

function sanitizeDeliveryPreview(preview) {
  return {
    previewHash: preview.previewHash,
    recipient: preview.recipient,
    files: Array.isArray(preview.files) ? preview.files.map(file => ({ path: file.path, required: Boolean(file.required) })) : [],
    executionReviewed: Boolean(preview.executionReviewed),
  };
}

module.exports = { CHANNEL, GuidedBroker, validGuidedRequest, diagnostic, notificationCopy, availableInventory, loadBrandRuns };
