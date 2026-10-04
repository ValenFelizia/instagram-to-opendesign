const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { fail, checked, ensureDirectory, inventory, fingerprint, copyInventory, atomicJson } = require('./paths.cjs');
const { digest } = require('./jobs.cjs');
const moduleFile = name => pathToFileURL(path.join(__dirname, '..', 'src', name)).href;
const models = { analysis: ['gpt-6-luna', 16000], colors: ['gpt-6-luna', 4000], report: ['gpt-6-luna', 16000], directions: ['gpt-6-luna', 6000] };
function optionsRecord(value = {}) {
  const defaults = { refresh: false, reanalyze: false, postLimit: 20, language: 'es', includeReport: true, includeExport: false, includeDirections: false, includePackage: false,
    maxPaidCalls: 5, maxRequests: 128, maxDownloadBytes: 64 * 1024 * 1024, maxInputBytes: 96 * 1024 * 1024 };
  if (Object.keys(value).some(key => !Object.hasOwn(defaults, key))) fail('invalid-pipeline-plan');
  const result = { ...defaults, ...value };
  for (const key of ['refresh', 'reanalyze', 'includeReport', 'includeExport', 'includeDirections', 'includePackage']) if (typeof result[key] !== 'boolean') fail('invalid-pipeline-plan');
  if (!['es', 'en'].includes(result.language) || !Number.isInteger(result.postLimit) || result.postLimit < 1 || result.postLimit > 25) fail('invalid-pipeline-plan');
  for (const [key, max] of [['maxPaidCalls', 6], ['maxRequests', 512], ['maxDownloadBytes', 256 * 1024 * 1024], ['maxInputBytes', 128 * 1024 * 1024]])
    if (!Number.isInteger(result[key]) || result[key] < 0 || result[key] > max) fail('invalid-pipeline-plan');
  return result;
}

// Privileged main-process API. No renderer IPC or automatic scheduler is added.
class Pipeline {
  constructor(store, { credentials, fetchImpl = fetch, fault = () => {} } = {}) {
    Object.assign(this, { store, credentials, fetchImpl, fault }); this.stopped = new Set();
  }
  revisions() {
    return { ingestion: digest({ actor: 'apify~instagram-scraper', credential: this.credentials.revision('apify') }),
      ...Object.fromEntries(Object.entries(models).map(([stage, [model, output]]) => [stage, digest({ model, output, effort: 'high', store: false, credential: this.credentials.revision('openai') })])) };
  }
  plan(projectId, { taskId, taskRevision = 1, ...options }) {
    const settings = optionsRecord(options), metadata = this.store.resolveProject(projectId).metadata;
    if (!metadata.profile) fail('profile-required');
    const recipe = { version: 1, username: metadata.profile, options: settings, revisions: this.revisions(),
      stages: ['ingestion', 'evidence', 'analysis', 'colors', ...(settings.includePackage ? ['compilation'] : []), ...(settings.includeDirections ? ['directions'] : []),
        ...(settings.includeReport ? ['report'] : []), ...(settings.includeExport ? ['export'] : [])] };
    const scope = { taskId, taskRevision, operation: settings.includeExport ? 'export' : settings.includeReport ? 'report' : 'analyze',
      provider: 'local', model: 'local', configRevision: digest({ provider: 'local', model: 'local', credential: null }) };
    return this.store.createJob(projectId, scope, recipe);
  }
  recipe(id) {
    const row = this.store.db.prepare('SELECT * FROM pipeline_plans WHERE job=?').get(id);
    if (!row || digest(JSON.parse(row.recipe)) !== row.hash) fail('invalid-pipeline-plan');
    const recipe = JSON.parse(row.recipe); optionsRecord(recipe.options); return recipe;
  }
  authorize(id, expectedHash) { this.checkConfiguration(this.recipe(id)); return this.store.authorize(id, expectedHash); }
  checkConfiguration(recipe) {
    const current = this.revisions();
    for (const stage of recipe.stages) if (recipe.revisions[stage] && current[stage] !== recipe.revisions[stage]) fail('stale-authorization');
  }
  stop(id) { this.store.job(id); this.stopped.add(id); }
  requests(id) {
    const job = this.store.job(id), root = path.join(this.store.project(job.project).directory, 'requests');
    return this.store.db.prepare('SELECT record FROM pipeline_requests WHERE job=? ORDER BY rowid').all(id).map(row => {
      const saved = JSON.parse(row.record), file = path.join(root, `${saved.id}.json`);
      try {
        checked(file); if (fs.statSync(file).size > 1024 * 1024) fail('invalid-checkpoint');
        const actual = JSON.parse(fs.readFileSync(file));
        if (['id', 'provider', 'key', 'stage', 'method'].every(key => actual[key] === saved[key]) &&
            JSON.stringify(actual.configuration) === JSON.stringify(saved.configuration) &&
            (saved.responseId == null || actual.responseId === saved.responseId) &&
            ['observed', 'saved'].includes(actual.state)) return { ...saved, ...actual };
      } catch { /* Persisted intent/usage remains available; unavailable payload is never a new call. */ }
      return saved;
    });
  }
  stages(id) { this.store.job(id); return this.store.db.prepare('SELECT name,state,snapshot FROM pipeline_stages WHERE job=?').all(id); }
  async preview(id) {
    const job = this.store.job(id), recipe = this.recipe(id);
    const input = this.store.db.prepare('SELECT * FROM snapshots WHERE id=?').get(job.input);
    if (!this.store.validSnapshot(input)) fail('snapshot-invalid');
    const profile = path.join(this.store.snapshotPath(input), 'payload');
    const stages = recipe.stages.map(name => ({ name, mode: ['ingestion', 'analysis', 'colors', 'directions'].includes(name) || name === 'report' && recipe.options.language === 'en' ? 'possible-provider' : 'local' }));
    if (!recipe.options.refresh && fs.existsSync(path.join(profile, 'instagram-source.json'))) stages[0].mode = 'cache';
    try {
      const { prepareAnalysis } = await import(moduleFile('analyze.js'));
      const { analysisFingerprint, reusableAnalysis } = await import(moduleFile('pipeline.js'));
      const prepared = await prepareAnalysis(profile);
      const cached = await reusableAnalysis(prepared, await analysisFingerprint(prepared), { force: recipe.options.reanalyze,
        configurationRevision: recipe.revisions.analysis, readOnly: true });
      if (cached) stages.find(stage => stage.name === 'analysis').mode = 'cache';
    } catch { /* Pending review is local work, never permission for a paid request. */ }
    return { id, planHash: job.hash, stages, limits: { ...recipe.options }, requests: this.requests(id).length };
  }
  async reconcileApify(id, requestId, expectedHash) {
    const job = this.store.job(id), recipe = this.recipe(id), original = this.requests(id).find(record => record.id === requestId);
    if (job.hash !== expectedHash || !this.store.current(job) || !['failed', 'interrupted'].includes(job.state)
        || original?.provider !== 'apify' || !/^[A-Za-z0-9_-]{1,80}$/.test(original.responseId || '')) fail('manual-reconciliation-required');
    this.checkConfiguration(recipe);
    const token = this.store.own(job.project);
    try {
      const check = () => { this.store.fence(job.project, token); if (!this.store.current(job)) fail('stale-authorization'); this.checkConfiguration(recipe); };
      const root = ensureDirectory(path.join(this.store.project(job.project).directory, 'requests'));
      const { requestCheckpoints, reconcileResponse } = await import(moduleFile('request-checkpoints.js'));
      const lookups = [];
      const transport = requestCheckpoints(root, 'ingestion', this.fetchImpl, { fence: check,
        beforeRequest: async request => { check(); if (request.method !== 'GET' || this.requests(id).length >= recipe.options.maxRequests) fail('request-limit'); },
        onRecord: async value => { check(); value.lookupOf = original.id;
          this.store.transaction(() => this.store.db.prepare('INSERT INTO pipeline_requests VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET record=excluded.record').run(value.id, id, JSON.stringify(value)));
          if (value.state === 'saved') lookups.push(value.id);
        } });
      const request = url => this.credentials.withKey('apify', key => transport(url, { headers: { authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(75000) }));
      const response = await request(`https://api.apify.com/v2/actor-runs/${original.responseId}`);
      if (!response.ok) fail('lookup-unavailable');
      const run = (await response.json()).data;
      if (run?.id !== original.responseId) fail('lookup-unavailable');
      const restored = reconcileResponse(root, original.id, lookups[0]);
      this.store.transaction(() => this.store.db.prepare('UPDATE pipeline_requests SET record=? WHERE id=? AND job=?').run(JSON.stringify(restored), original.id, id));
      if (run.status === 'SUCCEEDED' && /^[A-Za-z0-9_-]{1,80}$/.test(run.defaultDatasetId || '') &&
          Number.isInteger(original.configuration?.resultsLimit) && original.configuration.resultsLimit >= 1 && original.configuration.resultsLimit <= recipe.options.postLimit) {
        const dataset = await request(`https://api.apify.com/v2/datasets/${run.defaultDatasetId}/items?format=json&clean=1&limit=${original.configuration.resultsLimit}`);
        if (!dataset.ok || !Array.isArray(await dataset.json())) fail('lookup-unavailable');
      }
      return { requestId: original.id, lookupIds: lookups, remoteStatus: run.status };
    } finally { if (!this.store.closed) this.store.unown(job.project, token); }
  }
  async run(id, authorization, { recovery = false } = {}) {
    const job = this.store.job(id), recipe = this.recipe(id);
    if (!recovery && job.state !== 'queued') fail('paid-retry-requires-new-plan');
    if (recovery && !['failed', 'interrupted', 'review-required'].includes(job.state)) fail('invalid-recovery');
    this.checkConfiguration(recipe); this.stopped.delete(id);
    return this.store.executeLocal(id, authorization, async ({ input, work, check, token }) => {
      const output = ensureDirectory(path.join(work, 'result')), dataRoot = ensureDirectory(path.join(output, 'data'));
      const profile = ensureDirectory(path.join(dataRoot, recipe.username));
      const checkDispatch = () => { check(); this.checkConfiguration(recipe); if (this.stopped.has(id)) fail('dispatch-stopped'); };
      copyInventory(input, profile, inventory(input));
      // Only derived caches are reused. Current source/reviews/authority come from
      // the frozen input. Canonical validators reject stale historical caches.
      const candidates = this.store.db.prepare("SELECT s.*,j.input AS job_input FROM pipeline_stages p JOIN jobs j ON p.job=j.id JOIN snapshots s ON p.snapshot=s.id WHERE j.project=? AND p.state='completed' ORDER BY p.rowid DESC").all(job.project);
      const prior = candidates.find(row => this.store.validSnapshot(row));
      if (prior) {
        const savedProfile = path.join(this.store.snapshotPath(prior), 'payload');
        for (const name of ['brand-analysis.json', 'analysis-state.json', 'color-proposals.json', 'report-translation.en.json', 'creative-directions.json']) {
          const from = path.join(savedProfile, name), to = path.join(profile, name);
          const priorInput = this.store.db.prepare('SELECT * FROM snapshots WHERE id=?').get(prior.job_input);
          const originalFile = path.join(this.store.snapshotPath(priorInput), 'payload', name);
          const unchanged = fs.existsSync(to) && fs.existsSync(originalFile) && this.store.validSnapshot(priorInput) &&
            fs.readFileSync(to).equals(fs.readFileSync(originalFile));
          if (fs.existsSync(from) && (!fs.existsSync(to) || unchanged)) { checked(from); fs.copyFileSync(from, to); }
        }
      }
      const requestsRoot = ensureDirectory(path.join(this.store.project(job.project).directory, 'requests'));
      const old = this.requests(id); let activeStage = 'ingestion', observationRef = null, externalCount = 0, downloaded = 0;
      const record = value => { check(); value.observationRef = observationRef;
        this.store.transaction(() => this.store.db.prepare('INSERT INTO pipeline_requests VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET record=excluded.record').run(value.id, id, JSON.stringify(value))); };
      for (const value of old) record(value);
      const { requestCheckpoints, markAccountedTransport } = await import(moduleFile('request-checkpoints.js'));
      const rawFetch = async (url, request = {}) => {
        checkDispatch(); const target = new URL(url);
        const provider = ['https://api.openai.com', 'https://api.apify.com'].includes(target.origin);
        if (target.protocol !== 'https:' || target.username || target.password) fail('invalid-download');
        if (!provider) {
          if (recovery) fail('recovery-needs-local-assets');
          if (++externalCount + this.requests(id).length > recipe.options.maxRequests) fail('request-limit');
          const response = await this.fetchImpl(url, { ...request, redirect: 'error' });
          const reader = response.body?.getReader(); if (!reader) fail('invalid-download');
          const chunks = []; try { while (true) { const { done, value } = await reader.read(); if (done) break;
            downloaded += value.byteLength; if (downloaded > recipe.options.maxDownloadBytes) fail('download-limit'); chunks.push(Buffer.from(value)); } }
          finally { await reader.cancel(); }
          checkDispatch(); return new Response(Buffer.concat(chunks), { status: response.status, headers: response.headers });
        }
        return this.fetchImpl(url, request);
      };
      const transport = requestCheckpoints(requestsRoot, () => activeStage, rawFetch, {
        fence: check, replay: recovery ? old.map(item => item.id) : [], replayOnly: recovery,
        beforeRequest: async (request, original) => {
          checkDispatch(); const records = this.requests(id);
          if (Buffer.byteLength(original.options.body || '') > recipe.options.maxInputBytes) fail('input-limit');
          if (records.length + externalCount >= recipe.options.maxRequests || request.paid && records.filter(item => item.paid).length >= recipe.options.maxPaidCalls) fail('request-limit');
          const url = new URL(original.url);
          if (request.provider === 'openai') {
            if (!models[activeStage] || original.options.method !== 'POST') fail('unauthorized-stage');
            const body = JSON.parse(original.options.body), [model, limit] = models[activeStage];
            if (body.model !== model || body.max_output_tokens > limit || body.store !== false || body.reasoning?.effort !== 'high') fail('unauthorized-stage');
          } else if (activeStage !== 'ingestion' || request.paid && (!url.pathname.endsWith('/runs') || url.searchParams.get('maxTotalChargeUsd') !== '2')) fail('unauthorized-stage');
          if (request.provider === 'apify' && request.paid) {
            const body = JSON.parse(original.options.body);
            if (!['details', 'posts'].includes(body.resultsType) || body.resultsLimit > recipe.options.postLimit || body.directUrls?.length !== 1 || body.directUrls[0] !== `https://www.instagram.com/${recipe.username}/`) fail('unauthorized-stage');
          }
        }, onRecord: record, fault: point => this.fault(point),
      });
      const authenticated = async (url, options = {}) => {
        const origin = new URL(url).origin;
        if (!['https://api.apify.com', 'https://api.openai.com'].includes(origin)) return transport(url, options);
        const provider = origin === 'https://api.apify.com' ? 'apify' : 'openai';
        return this.credentials.withKey(provider, key => transport(url, { ...options, headers: { ...options.headers, authorization: `Bearer ${key}` } }));
      };
      markAccountedTransport(authenticated);
      const { runPipeline } = await import(moduleFile('pipeline.js'));
      const onStage = async event => {
        checkDispatch(); activeStage = event.name;
        if (event.observationRef) observationRef = event.observationRef;
        if (!recipe.stages.includes(event.name)) fail('unauthorized-stage');
        let snapshot = null;
        if (event.state === 'completed') {
          this.fault(`stage-${event.name}-before-checkpoint`);
          const tree = inventory(profile);
          snapshot = this.store.prepareSnapshot(job.project, 'output', token, payload => copyInventory(profile, payload, tree),
            payload => fingerprint(inventory(payload)) === fingerprint(tree)).id;
        }
        this.store.transaction(() => this.store.db.prepare('INSERT INTO pipeline_stages VALUES (?,?,?,?) ON CONFLICT(job,name) DO UPDATE SET snapshot=COALESCE(excluded.snapshot,pipeline_stages.snapshot),state=excluded.state').run(id, event.name, snapshot, event.state));
      };
      const { ingest } = await import(moduleFile('ingest.js'));
      const result = await runPipeline(recipe.username, { ...recipe.options, dataRoot, outputRoot: path.join(output, 'packages'),
        token: 'privileged-broker', fetchImpl: authenticated, onStage,
        ingestImpl: (username, options) => ingest(username, { ...options, token: 'privileged-broker' }),
        configurationRevision: { analysis: recipe.revisions.analysis, colors: recipe.revisions.colors, translation: recipe.revisions.report, directions: recipe.revisions.directions } });
      if (result.status !== 'complete') fail('evidence-review-required');
      checkDispatch();
      atomicJson(path.join(output, 'pipeline.json'), { version: 1, job: id, planHash: job.hash, stages: recipe.stages, status: 'complete' });
      return { output, validated: true, hash: fingerprint(inventory(output)) };
    });
  }
}
module.exports = { Pipeline, optionsRecord };
