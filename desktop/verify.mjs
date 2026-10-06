import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, mkdtemp, writeFile, readFile, readdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { profileFixture } from '../test/helpers/profile.js';
import { briefFixture, fixtureDirections } from '../test/helpers/brief.js';
import { prepareBrief } from '../src/brief.js';

const require = createRequire(import.meta.url);
const { _electron } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const packaged = process.argv.includes('--packaged');
const output = path.join(root, 'tmp', 'app-shell-qa');
await mkdir(output, { recursive: true });
const profile = await mkdtemp(path.join(output, 'chromium-'));
const testTemp = realpathSync.native(tmpdir());
const source = await mkdtemp(path.join(testTemp, 'synthetic-import-'));
const backup = await mkdtemp(path.join(testTemp, 'synthetic-backup-'));
await writeFile(path.join(source, 'instagram-source.json'), '{"username":"example.studio","biography":"Fictional test fixture."}');
const exe = packaged ? path.join(root, 'dist', 'app', 'win-unpacked', 'Instagram to OpenDesign.exe') : require('electron');
const args = [...(packaged ? [] : [root]), `--shell-test-data=${profile}`, '--shell-test-hidden'];
// No Node path or provider key is available to the packaged application.
const env = Object.fromEntries(['SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'COMSPEC', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA'].filter(key => process.env[key]).map(key => [key, process.env[key]]));
env.PATH = path.join(process.env.SystemRoot, 'System32');
const results = [];
let electronApp;
async function poll(operation, expected, timeout = 15000) {
  const end = Date.now() + timeout;
  let result;
  do { result = await operation(); if (expected(result)) return result; await new Promise(resolve => setTimeout(resolve, 100)); } while (Date.now() < end);
  throw new Error(`Condition timed out: ${JSON.stringify(result)}`);
}
async function workerPid() {
  return electronApp.evaluate(({ app }) => app.getAppMetrics().find(item => item.name === 'Local shell check')?.pid);
}
try {
  electronApp = await _electron.launch({ executablePath: exe, args, env, timeout: 30000 });
  let page = await electronApp.firstWindow();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.locator('#start').waitFor();
  await poll(() => page.evaluate(() => window.appShell.status()), value => value.state?.status === 'idle');
  assert.deepEqual(await page.evaluate(() => [typeof require, typeof process]), ['undefined', 'undefined']);
  const prefs = await electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences());
  assert.equal(prefs.sandbox, true); assert.equal(prefs.contextIsolation, true); assert.equal(prefs.nodeIntegration, false);
  // Dialog substitution lives in this test process, never in production IPC or preload.
  await electronApp.evaluate(({ dialog }, selected) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [selected] });
    dialog.showMessageBox = async () => ({ response: 1 });
  }, source);
  await page.locator('#new-project').click();
  await page.locator('#project-name').fill('Example studio');
  await page.locator('#project-url').fill('https://example.invalid/profile');
  await page.locator('#save-project').click();
  await page.locator('#project-error').waitFor({ state: 'visible' });
  assert.equal(await page.evaluate(() => document.activeElement.id), 'project-url');
  await page.locator('#project-url').fill('https://www.instagram.com/example.studio/');
  await page.locator('#save-project').click();
  await page.locator('#project-dialog').waitFor({ state: 'hidden' });
  await page.locator('#import-project').click();
  await page.locator('#project-dialog').waitFor({ state: 'visible' });
  await page.locator('#project-name').fill('Imported fixture');
  await page.locator('#save-project').click();
  await page.locator('#project-dialog').waitFor({ state: 'hidden' });
  const imported = (await page.evaluate(() => window.localWorkspace.list())).workspace.projects.find(item => item.name === 'Imported fixture');
  assert.ok(imported);
  const copiedSource = path.join(profile, 'workspace', 'projects', imported.id, 'data', 'imported', 'instagram-source.json');
  assert.deepEqual(await readFile(copiedSource), await readFile(path.join(source, 'instagram-source.json')));
  await electronApp.evaluate(({ dialog }, selected) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [selected] }); }, backup);
  assert.equal((await page.evaluate(id => window.localWorkspace.exportBackup(id), imported.id)).ok, true);
  assert.equal((await readdir(backup)).length, 1);
  assert.equal((await page.evaluate(id => window.localWorkspace.trash(id), imported.id)).ok, true);
  assert.equal((await page.evaluate(id => window.localWorkspace.restore(id), imported.id)).ok, true);
  assert.equal((await page.evaluate(id => window.localWorkspace.open(id), imported.id)).ok, true);
  const jobProof = await electronApp.evaluate(async ({ app }, projectId) => {
    const path = process.getBuiltinModule('path'), fs = process.getBuiltinModule('fs');
    const packagedRequire = process.getBuiltinModule('module').createRequire(path.join(app.getAppPath(), 'package.json'));
    const { Workspace } = packagedRequire('./desktop/workspace.cjs');
    const { JobStore, digest } = packagedRequire('./desktop/jobs.cjs');
    const crypto = process.getBuiltinModule('crypto');
    const workspace = new Workspace(path.join(app.getPath('userData'), 'workspace'));
    const root = path.join(app.getPath('userData'), 'sqlite-proof');
    const options = { resolveProject: id => workspace.project(id) };
    let store = new JobStore(root, options);
    try {
      const job = store.createJob(projectId, { taskId: crypto.randomUUID(), operation: 'report', provider: 'fake', model: 'synthetic', configRevision: digest('synthetic-config'), taskRevision: 1 });
      await store.dispatch(job.id, store.authorize(job.id, job.planHash), () => ({ remoteId: 'synthetic-no-network' }));
      const output = store.complete(job.id, null, payload => fs.writeFileSync(path.join(payload, 'result.txt'), 'Synthetic SQLite packaging proof'), () => true);
      const sqlite = store.db.prepare('SELECT sqlite_version() AS version').get().version;
      store.close(); store = new JobStore(root, options);
      return { version: sqlite, state: store.view(job.id).state, outputRetained: store.view(job.id).output === output.output };
    } finally { store.close(); }
  }, imported.id);
  assert.equal(jobProof.state, 'completed'); assert.equal(jobProof.outputRetained, true);
  results.push(`Bundled node:sqlite ${jobProof.version}: intent/acknowledgement, inventoried snapshot and fresh-store recovery without external Node or network`);
  const pipelineFixture = await profileFixture();
  const pipelineSource = JSON.parse(await readFile(path.join(pipelineFixture.root, 'instagram-source.json'), 'utf8'));
  pipelineSource.profile.externalUrls = [];
  pipelineSource.profile.avatar = { kind: 'image', assetPath: 'assets/avatar.png' };
  pipelineSource.posts[0].media = [{ id: 'media-1', kind: 'image', assetPath: 'assets/product.jpg' }];
  await writeFile(path.join(pipelineFixture.root, 'instagram-source.json'), JSON.stringify(pipelineSource));
  const pipelineProof = await electronApp.evaluate(async ({ app }, fixture) => {
    const path = process.getBuiltinModule('path'), fs = process.getBuiltinModule('fs'), crypto = process.getBuiltinModule('crypto');
    const packagedRequire = process.getBuiltinModule('module').createRequire(path.join(app.getAppPath(), 'package.json'));
    const { Workspace } = packagedRequire('./desktop/workspace.cjs');
    const { JobStore } = packagedRequire('./desktop/jobs.cjs');
    const { Pipeline } = packagedRequire('./desktop/pipeline.cjs');
    const workspace = new Workspace(path.join(app.getPath('userData'), 'pipeline-proof'));
    const project = workspace.create('Pipeline synthetic', 'https://www.instagram.com/example_studio/').active;
    const input = path.join(workspace.project(project).directory, 'data', 'example_studio');
    fs.cpSync(fixture.directory, input, { recursive: true });
    const root = path.join(app.getPath('userData'), 'pipeline-database');
    const options = { resolveProject: id => workspace.project(id) };
    let store = new JobStore(root, options), calls = 0, failReport = true;
    const integration = {
      credentials: { revision: () => 'synthetic', withKey: async (_provider, operation) => operation('synthetic-no-live-key') },
      fault: point => { if (point === 'stage-report-before-checkpoint' && failReport) throw new Error('synthetic-report-fault'); },
      fetchImpl: async (_url, request) => {
        calls++; const name = JSON.parse(request.body).text.format.name;
        const output = name === 'brand_inferences' ? { inferences: fixture.inferences } : fixture.colors;
        return Response.json({ id: `resp_synthetic_${calls}`, model: 'gpt-6-luna', status: 'completed', usage: { input_tokens: 7, output_tokens: 2 },
          output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(output) }] }] });
      }
    };
    try {
      let pipeline = new Pipeline(store, integration);
      const job = pipeline.plan(project, { taskId: crypto.randomUUID(), includePackage: true });
      try { await pipeline.run(job.id, pipeline.authorize(job.id, job.planHash)); throw new Error('Expected fault'); }
      catch (error) { if (error.message !== 'synthetic-report-fault') throw error; }
      const failed = store.view(job.id).state, ids = pipeline.requests(job.id).map(record => record.id);
      store.close(); store = new JobStore(root, options); failReport = false;
      pipeline = new Pipeline(store, integration);
      const recovered = await pipeline.run(job.id, pipeline.authorize(job.id, job.planHash), { recovery: true });
      return { failed, recovered: recovered.state, calls, stableRequests: JSON.stringify(ids) === JSON.stringify(pipeline.requests(job.id).map(record => record.id)),
        stages: pipeline.stages(job.id).map(stage => stage.name) };
    } finally { store.close(); }
  }, { directory: pipelineFixture.root, inferences: pipelineFixture.analysis.inferences.map(({ id, ...item }) => item), colors: pipelineFixture.colors.candidates });
  assert.equal(pipelineProof.failed, 'failed'); assert.equal(pipelineProof.recovered, 'completed');
  assert.equal(pipelineProof.calls, 2); assert.equal(pipelineProof.stableRequests, true); assert.ok(pipelineProof.stages.includes('report'));
  results.push('Packaged core analysis/colors/compiler/report: private responses and stable request IDs survive report failure and database reopen, without another provider attempt');
  const authorityFixture = await briefFixture('instagram-story');
  const authorityRequest = { ...authorityFixture.request, schemaVersion: 'design-request/v2', pageScope: null, inferenceIds: [] };
  const authorityState = await prepareBrief(authorityFixture.root, { requestDocument: authorityRequest });
  authorityRequest.selectedDirectionId = 'D-1';
  const authorityProof = await electronApp.evaluate(async ({ app }, fixture) => {
    const fs = process.getBuiltinModule('fs'), path = process.getBuiltinModule('path');
    const packagedRequire = process.getBuiltinModule('module').createRequire(path.join(app.getAppPath(), 'package.json'));
    const { Workspace } = packagedRequire('./desktop/workspace.cjs');
    const { JobStore } = packagedRequire('./desktop/jobs.cjs');
    const { TaskAuthority } = packagedRequire('./desktop/task-authority.cjs');
    const { Deliveries } = packagedRequire('./desktop/deliveries.cjs');
    const workspace = new Workspace(path.join(app.getPath('userData'), 'authority-proof'));
    const project = workspace.create('Synthetic task authority', 'https://www.instagram.com/example_studio/').active;
    const input = path.join(workspace.project(project).directory, 'data', 'example_studio');
    fs.cpSync(fixture.directory, input, { recursive: true });
    const database = path.join(app.getPath('userData'), 'authority-database'), options = { resolveProject: id => workspace.project(id) };
    let store = new JobStore(database, options);
    try {
      let authority = new TaskAuthority(store);
      const draft = await authority.create(project, fixture.exploration);
      const selected = await authority.select(project, draft.taskId, draft.revision, fixture.request, fixture.directions);
      const execution = await authority.reviewExecution(project, draft.taskId, selected.revision, selected.key, fixture.reviewer);
      let deliveries = new Deliveries(store);
      const preview = await deliveries.preview(project, draft.taskId, execution.revision, 'opendesign');
      const delivery = await deliveries.create(project, draft.taskId, execution.revision, { recipient: 'opendesign', previewHash: preview.previewHash, paths: preview.files.filter(file => file.required).map(file => file.path) });
      const shared = path.join(app.getPath('userData'), 'shared-proof'); fs.mkdirSync(shared);
      const exported = await deliveries.export(project, delivery.id, shared);
      const returned = path.join(app.getPath('userData'), 'returned-proof'); fs.mkdirSync(returned);
      fs.writeFileSync(path.join(returned, 'feedback.txt'), 'Synthetic original feedback.');
      const crypto = process.getBuiltinModule('crypto'), hashFile = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
      const result = await deliveries.result(project, delivery.id, { sourceRoot: returned, files: [{ path: 'feedback.txt', kind: 'feedback', sha256: hashFile(path.join(returned, 'feedback.txt')) }],
        feedback: [{ sourcePath: 'feedback.txt', reviewer: 'Synthetic operator', note: 'Retain the original.', cause: 'unknown' }], previousId: null });
      fs.writeFileSync(path.join(returned, 'effort.json'), JSON.stringify({ schemaVersion: 'external-effort/v1', sourceId: 'packaged-source', records: [{ provider: 'fictional', attemptId: 'request-1', kind: 'generation', wallMs: 100, humanMinutes: null, usage: null, billing: null }] }));
      const effort = { sourceRoot: returned, sourcePath: 'effort.json', sourceId: 'packaged-source', sha256: hashFile(path.join(returned, 'effort.json')) };
      await deliveries.importEffort(project, delivery.id, effort); await deliveries.importEffort(project, delivery.id, effort);
      store.close(); store = new JobStore(database, options); authority = new TaskAuthority(store);
      deliveries = new Deliveries(store);
      const retained = await deliveries.readback(project, delivery.id), history = await deliveries.history(project);
      const recovered = await authority.preview(project, draft.taskId);
      fs.appendFileSync(path.join(input, 'manual/request.md'), '\nSynthetic source change.');
      const changed = await authority.preview(project, draft.taskId);
      return { stableExecution: recovered.execution.id === execution.id, currentAfterReopen: recovered.executionCurrent,
        publicationCurrent: recovered.publicationCurrent, changedCurrent: changed.executionCurrent, version: recovered.brief.schemaVersion,
        delivery: retained.integrity, deliveryCurrent: retained.executionCurrent, resultRetained: history.results[0].id === result.id,
        attempts: history.summary.attempts, unknownCost: history.summary.totalCost, exported: fs.existsSync(path.join(shared, exported.folder, 'START.md')) };
    } finally { store.close(); }
  }, { directory: authorityFixture.root, request: authorityRequest,
    directions: { schemaVersion: 'creative-directions/v1', inputHash: authorityState.inputHash, directions: fixtureDirections(authorityState.context) },
    exploration: { schemaVersion: 'exploration-request/v1', username: 'example_studio', kind: 'instagram-story', objective: 'Explore a synthetic Story.', candidateCopy: [], assetIds: [], inferenceIds: [] },
    reviewer: { reviewer: 'Synthetic operator', reviewedAt: '2026-01-03T00:00:00Z' } });
  assert.equal(authorityProof.stableExecution, true); assert.equal(authorityProof.currentAfterReopen, true);
  assert.equal(authorityProof.publicationCurrent, false); assert.equal(authorityProof.changedCurrent, false); assert.equal(authorityProof.version, 'design-brief/v2');
  results.push('Packaged task authority: explicit v2 selection/review survives database reopen; changed confirmation revokes execution without granting publication');
  assert.equal(authorityProof.delivery, 'verified'); assert.equal(authorityProof.deliveryCurrent, true); assert.equal(authorityProof.resultRetained, true);
  assert.equal(authorityProof.attempts, 1); assert.equal(authorityProof.unknownCost, null); assert.equal(authorityProof.exported, true);
  results.push('Packaged generic/OpenDesign task handoff: explicit inventory, portable export, immutable result/feedback and idempotent supplied effort survive store reopen; unknown billing stays null');
  const guidedProof = await electronApp.evaluate(async ({ app }, fixture) => {
    const fs = process.getBuiltinModule('fs'), path = process.getBuiltinModule('path'), crypto = process.getBuiltinModule('crypto');
    const packagedRequire = process.getBuiltinModule('module').createRequire(path.join(app.getAppPath(), 'package.json'));
    const { Workspace } = packagedRequire('./desktop/workspace.cjs');
    const { JobStore } = packagedRequire('./desktop/jobs.cjs');
    const { Pipeline } = packagedRequire('./desktop/pipeline.cjs');
    const { TaskAuthority } = packagedRequire('./desktop/task-authority.cjs');
    const { Deliveries } = packagedRequire('./desktop/deliveries.cjs');
    const { GuidedBroker } = packagedRequire('./desktop/guided.cjs');
    const workspace = new Workspace(path.join(app.getPath('userData'), 'guided-proof'));
    const project = workspace.create('Guided synthetic', 'https://www.instagram.com/example_studio/').active;
    const input = path.join(workspace.project(project).directory, 'data', 'example_studio');
    fs.cpSync(fixture.directory, input, { recursive: true });
    const database = path.join(app.getPath('userData'), 'guided-database');
    const options = { resolveProject: id => workspace.project(id) };
    let store = new JobStore(database, options);
    try {
      const pipeline = new Pipeline(store, {
        credentials: { revision: () => 'synthetic', withKey: async (_provider, operation) => operation('synthetic-no-live-key') },
        fetchImpl: async (_url, request) => {
          const name = JSON.parse(request.body).text.format.name;
          const output = name === 'brand_inferences' ? { inferences: fixture.inferences } : fixture.colors;
          return Response.json({ id: 'resp_guided', model: 'gpt-6-luna', status: 'completed', usage: { input_tokens: 4, output_tokens: 1 },
            output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(output) }] }] });
        },
      });
      const guided = new GuidedBroker({
        store, pipeline, authority: new TaskAuthority(store), deliveries: new Deliveries(store),
        dialog: { showOpenDialog: async () => ({ canceled: true, filePaths: [] }) },
        window: () => ({}), authorized: () => true,
      });
      const planned = await guided.handle({ action: 'plan', projectId: project, taskId: crypto.randomUUID(), taskRevision: 1, options: { includePackage: true, includeReport: true } });
      const denied = await guided.handle({ action: 'authorize', projectId: project, jobId: planned.job.id, planHash: planned.job.planHash, consent: false });
      const authorized = await guided.handle({ action: 'authorize', projectId: project, jobId: planned.job.id, planHash: planned.job.planHash, consent: true });
      const ran = await guided.handle({ action: 'run', projectId: project, jobId: planned.job.id, planHash: planned.job.planHash, authorization: authorized.authorization, recovery: false });
      store.close(); store = new JobStore(database, options);
      const reopened = new GuidedBroker({
        store, pipeline: new Pipeline(store, { credentials: { revision: () => 'synthetic', withKey: async (_p, op) => op('x') }, fetchImpl: async () => { throw new Error('reopen-dispatch'); } }),
        authority: new TaskAuthority(store), deliveries: new Deliveries(store),
        dialog: { showOpenDialog: async () => ({ canceled: true, filePaths: [] }) }, window: () => ({}), authorized: () => true,
      });
      const status = await reopened.handle({ action: 'status', projectId: project });
      return {
        denied: denied.code, completed: ran.job.state, reopenDispatches: status.progress.reopenDispatches,
        percentage: status.progress.spend.percentage, cancellationSupported: status.progress.cancellationSupported,
        stages: status.progress.stages.filter(stage => stage.status === 'completed').length,
        available: status.progress.available.length, serialized: JSON.stringify(status.progress),
      };
    } finally { store.close(); }
  }, { directory: pipelineFixture.root, inferences: pipelineFixture.analysis.inferences.map(({ id, ...item }) => item), colors: pipelineFixture.colors.candidates });
  assert.equal(guidedProof.denied, 'consent-required');
  assert.equal(guidedProof.completed, 'completed');
  assert.equal(guidedProof.reopenDispatches, false);
  assert.equal(guidedProof.percentage, null);
  assert.equal(guidedProof.cancellationSupported, false);
  assert.ok(guidedProof.stages >= 1);
  assert.ok(guidedProof.available >= 1);
  assert.equal(guidedProof.serialized.includes('synthetic-no-live-key'), false);
  results.push('Packaged guided broker: scoped consent, real stages/partial inventory and spend projection survive reopen without dispatch, percentage or cancellation claims');
  const syntheticKey = `synthetic-${randomUUID()}`;
  await page.locator('#settings').click();
  await page.locator('#credential-key').fill(syntheticKey);
  await page.locator('#save-credential').click();
  await poll(() => page.locator('#credential-state').textContent(), value => value?.includes('Clave guardada'));
  assert.equal(await page.locator('#credential-key').inputValue(), '');
  assert.equal(JSON.stringify(await page.evaluate(() => window.localWorkspace.credentialStatus())).includes(syntheticKey), false);
  const protectedFile = path.join(profile, 'workspace', 'credentials', 'apify.json');
  assert.equal((await readFile(protectedFile, 'utf8')).includes(syntheticKey), false);
  assert.equal(await electronApp.evaluate(async ({ safeStorage }, value) => {
    const plain = await safeStorage.decryptStringAsync(Buffer.from(value.encrypted, 'base64'));
    return plain.result === value.expected;
  }, { encrypted: JSON.parse(await readFile(protectedFile, 'utf8')).encrypted, expected: syntheticKey }), true);
  assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
  await page.keyboard.press('Escape');
  await poll(() => page.evaluate(() => document.activeElement.id), value => value === 'settings');
  await electronApp.evaluate(({ safeStorage }) => {
    const original = safeStorage.isAsyncEncryptionAvailable.bind(safeStorage);
    safeStorage.isAsyncEncryptionAvailable = async () => { safeStorage.isAsyncEncryptionAvailable = original; return false; };
  });
  await page.locator('#settings').click();
  await poll(() => page.locator('#save-credential').isDisabled(), value => value === true);
  assert.equal(await page.locator('#credential-key').isDisabled(), true);
  assert.equal(await page.locator('#remove-credential').isEnabled(), true);
  await page.keyboard.press('Escape');
  results.push('Managed create/import/open/backup/trash/restore, source byte equality, real Windows DPAPI and cleared password input');
  await page.evaluate(() => document.querySelector('.skip').click());
  assert.equal((await page.evaluate(() => window.appShell.status())).ok, true);
  await page.locator('#start').focus();
  const focus = await page.locator('#start').evaluate(el => getComputedStyle(el).outlineStyle);
  assert.notEqual(focus, 'none');
  await page.keyboard.press('Enter');
  await poll(() => page.evaluate(() => window.appShell.status()), value => value.state?.ticks >= 1);
  const pid = await workerPid(); assert.ok(pid);
  const before = (await page.evaluate(() => window.appShell.status())).state.ticks;
  assert.equal((await page.evaluate(() => window.appShell.startCheck())).ok, false);
  await electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
  await page.locator('#close-dialog').waitFor({ state: 'visible' });
  assert.equal(await page.evaluate(() => document.activeElement.id), 'keep-open');
  await page.keyboard.press('Escape');
  await page.locator('#close-dialog').waitFor({ state: 'hidden' });
  await poll(() => page.evaluate(() => document.activeElement.id), value => value === 'exit');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'exit');
  await electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
  const closedView = page.waitForEvent('close');
  await page.locator('#confirm-close').click().catch(error => { if (!page.isClosed()) throw error; });
  await closedView;
  await poll(() => electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length), value => value === 0);
  await new Promise(resolve => setTimeout(resolve, 1100));
  assert.equal(await workerPid(), pid);
  const newWindow = electronApp.waitForEvent('window');
  const second = spawn(exe, args, { env, windowsHide: true, stdio: 'ignore' });
  await new Promise((resolve, reject) => { second.once('error', reject); second.once('exit', code => code === 0 ? resolve() : reject(new Error(`Second instance exited ${code}`))); });
  page = await newWindow;
  await page.waitForLoadState();
  const resumed = await page.evaluate(() => window.appShell.status());
  assert.ok(resumed.state.ticks > before); assert.equal(await workerPid(), pid);
  assert.equal(await electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length), 1);
  results.push('Packaged core/sharp, isolated renderer, keyboard close dialog and background worker/second instance');
  await page.evaluate(() => scrollTo(0, 0));
  const screenshot = await electronApp.evaluate(async ({ BrowserWindow }) => {
    const image = await BrowserWindow.getAllWindows()[0].webContents.capturePage(undefined, { stayHidden: true });
    return image.toPNG().toString('base64');
  });
  await writeFile(path.join(output, packaged ? 'packaged.png' : 'development.png'), Buffer.from(screenshot, 'base64'));
  // Renderer failure is independent of utility process ownership.
  await electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.forcefullyCrashRenderer());
  assert.equal(await workerPid(), pid);
  await poll(() => electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length), value => value === 0);
  const reopened = electronApp.waitForEvent('window');
  await electronApp.evaluate(({ Menu }) => Menu.getApplicationMenu().items[0].submenu.items[0].click());
  page = await reopened; await page.waitForLoadState();
  await poll(() => page.evaluate(() => window.appShell.status()), value => value.state?.status === 'completed');
  assert.equal(await workerPid(), pid);
  results.push('Renderer crash, menu reopen and observed completion retain the same worker');
  await page.setViewportSize({ width: 360, height: 650 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
  await page.locator('#start').focus();
  assert.notEqual(await page.locator('#start').evaluate(el => getComputedStyle(el).outlineStyle), 'none');
  const current = page.url();
  await page.evaluate(() => { location.href = 'https://example.invalid/'; });
  await new Promise(resolve => setTimeout(resolve, 200));
  assert.equal(page.url(), current);
  assert.equal(await page.evaluate(() => window.open('https://example.invalid/') === null), true);
  const networkDenied = await page.evaluate(async () => { try { await fetch('https://example.invalid/'); return false; } catch { return true; } });
  assert.equal(networkDenied, true);
  assert.deepEqual(errors, []);
  results.push('External navigation, popup, fetch blocked; narrow layout and high contrast focus');
  const closed = electronApp.waitForEvent('close');
  await page.evaluate(() => window.appShell.exit());
  await closed;
  // OS process lookup must show that explicit Exit terminated the utility worker.
  assert.throws(() => process.kill(pid, 0));
  results.push('Explicit Exit terminates the worker');
  electronApp = await _electron.launch({ executablePath: exe, args, env, timeout: 30000 });
  page = await electronApp.firstWindow();
  await poll(() => page.evaluate(() => window.localWorkspace?.list()), value => value?.workspace?.projects.length === 2);
  assert.equal((await page.evaluate(() => window.localWorkspace.credentialStatus())).credentials.providers.apify, true);
  assert.equal((await page.evaluate(id => window.localWorkspace.open(id), imported.id)).ok, true);
  assert.equal((await page.evaluate(() => window.localWorkspace.removeCredential('apify'))).credentials.providers.apify, false);
  const reopenedExit = electronApp.waitForEvent('close'); await page.evaluate(() => window.appShell.exit()); await reopenedExit;
  results.push('Fresh app launch retains projects and protected credential configuration; explicit key removal');
  await writeFile(path.join(output, packaged ? 'packaged-verification.json' : 'development-verification.json'), JSON.stringify({ packaged, results }, null, 2));
  console.log(JSON.stringify({ packaged, passed: results }, null, 2));
} finally {
  if (electronApp) await electronApp.close().catch(() => {});
}
