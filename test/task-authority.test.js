import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { briefFixture, fixtureDirections } from './helpers/brief.js';
import { prepareBrief, validateRequest, selectedBrief } from '../src/brief.js';
import { prepareExploration, correctedRuleDocument, authorityHash, taskEvidence, publicationChecks } from '../src/task-authority.js';
import { loadDecisions, validateDecisionDocument } from '../src/decisions.js';
import { importReview, decisionRevision } from '../src/review.js';
import { digest } from '../src/local.js';
const require = createRequire(import.meta.url);
const { Workspace } = require('../desktop/workspace.cjs');
const { JobStore } = require('../desktop/jobs.cjs');
const { TaskAuthority } = require('../desktop/task-authority.cjs');
const guard = require('../src/writer-guard.cjs');
const reviewer = { reviewer: 'Synthetic operator', reviewedAt: '2026-01-03T00:00:00Z' };
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const write = (file, value) => fs.writeFileSync(file, JSON.stringify(value));
const explore = (kind = 'instagram-story', assets = []) => ({ schemaVersion: 'exploration-request/v1', username: 'example_studio', kind,
  objective: 'Explore a synthetic product story.', candidateCopy: [], assetIds: assets, inferenceIds: [] });
function requestV2(request, kind = request.kind) {
  return { ...structuredClone(request), schemaVersion: 'design-request/v2', kind, inferenceIds: [], pageScope: kind === 'conceptual-landing' ? { sections: ['hero', 'products', 'about'], unknownDataPolicy: 'omit-or-question' } : null,
    ...(kind === 'conceptual-landing' || kind === 'website-change' ? { target: { width: 1440, height: 900 }, action: { type: 'none', label: null, url: null, reservedSpace: null } } : {}) };
}
async function fixture(t) {
  const source = await briefFixture('instagram-story'); t.after(source.cleanup);
  const root = fs.mkdtempSync(path.join(fs.realpathSync.native(tmpdir()), 'authority-test-'));
  const workspace = new Workspace(path.join(root, 'workspace'));
  const project = workspace.create('Synthetic authority studio', 'https://www.instagram.com/example_studio/').active;
  const directory = workspace.project(project).directory, input = path.join(directory, 'data/example_studio');
  fs.cpSync(source.root, input, { recursive: true });
  const stores = [], open = () => { const store = new JobStore(path.join(root, 'jobs'), { resolveProject: id => workspace.project(id) }); stores.push(store); return store; };
  let store = open(); const broker = new TaskAuthority(store);
  t.after(() => {
    for (const item of stores) { try { item.close(); } catch {} }
    assert.ok(path.dirname(root) === fs.realpathSync.native(tmpdir()) && path.basename(root).startsWith('authority-test-'));
    fs.rmSync(root, { recursive: true });
  });
  async function selected(kind = 'instagram-story') {
    const created = await broker.create(project, explore(kind));
    const request = requestV2(source.request, kind), state = await prepareBrief(input, { requestDocument: request });
    request.selectedDirectionId = 'D-1';
    const directions = { schemaVersion: 'creative-directions/v1', inputHash: state.inputHash, directions: fixtureDirections(state.context) };
    const chosen = await broker.select(project, created.taskId, created.revision, request, directions);
    return { taskId: created.taskId, request, directions, chosen };
  }
  async function approve(selection) {
    const preview = await broker.preview(project, selection.taskId);
    assert.equal(preview.ready, true, preview.questions?.join(' '));
    return broker.reviewExecution(project, selection.taskId, preview.revision, preview.key, reviewer);
  }
  return { root, input, directory, project, store, broker, source, open, selected, approve };
}

test('goal-only exploration keeps confirmed copy, hypotheses and unapproved originals distinct', async t => {
  const source = await briefFixture('instagram-story'); t.after(source.cleanup);
  source.review.entries[1].permission = { use: 'unknown' };
  write(path.join(source.root, 'asset-review.json'), source.review);
  const request = explore('instagram-story', [source.review.entries[1].id]);
  request.inferenceIds = [source.analysis.inferences[0].id]; request.candidateCopy = [{ id: 'headline', text: 'An invented replacement.' }];
  const { context } = await prepareExploration(source.root, request);
  assert.equal(context.executionAllowed, false); assert.equal(context.publicationAllowed, false);
  assert.equal(context.assets[0].policy, 'placeholder'); assert.equal(context.assets[0].path, undefined);
  assert.equal(context.confirmedCopy.find(copy => copy.id === 'headline').text, 'Made carefully.');
  assert.equal(context.candidateCopy.length, 0); assert.ok(context.questions.some(question => question.includes('conflicts')));
  assert.equal(context.proposals[0].authority, 'hypothesis'); assert.notEqual(context.proposals[0].status, 'verified');
  assert.equal(context.evidence.some(item => Object.hasOwn(item, 'sourcePath')), false);
  await assert.rejects(prepareExploration(source.root, { ...request, mode: 'execute' }), /Invalid exploration/);
});

test('new selected contracts explicitly bound conceptual landings and code editing, preserving strict v1 rejection', async t => {
  const f = await fixture(t), landing = requestV2(f.source.request, 'conceptual-landing');
  assert.throws(() => validateRequest(landing, 'example_studio'), /Invalid design request/);
  validateRequest(landing, 'example_studio', { versionedTask: true });
  assert.throws(() => validateRequest({ ...landing, pageScope: { sections: ['products'], unknownDataPolicy: 'omit-or-question' } }, 'example_studio', { versionedTask: true }), /bounded page/);
  const editing = requestV2(f.source.request, 'website-change');
  const state = await prepareBrief(f.input, { requestDocument: editing });
  assert.ok(state.blockers.some(item => item.includes('authorized code')));
  const legacy = { ...editing, schemaVersion: 'design-request/v1' }; delete legacy.pageScope; delete legacy.inferenceIds;
  write(path.join(f.input, 'design-request.json'), legacy);
  assert.equal((await prepareBrief(f.input)).blockers.some(item => item.includes('authorized code')), false);
  write(path.join(f.input, 'design-request.json'), landing);
  await assert.rejects(prepareBrief(f.input), /Invalid design request/);
});

test('execution is explicit, revision-bound and durable; changed tasks archive authority rather than promote drafts', async t => {
  const f = await fixture(t), selection = await f.selected();
  await assert.rejects(f.broker.reviewExecution(f.project, selection.taskId, selection.chosen.revision, digest('wrong'), reviewer), /execution-review-required/);
  const execution = await f.approve(selection);
  assert.equal((await f.broker.preview(f.project, selection.taskId)).publicationCurrent, false);
  f.store.close(); const reopened = new TaskAuthority(f.open());
  assert.equal((await reopened.preview(f.project, selection.taskId)).execution.id, execution.id);
  const pendingRequest = structuredClone(selection.request); pendingRequest.selectedDirectionId = null;
  const preview = await reopened.preview(f.project, selection.taskId);
  await reopened.select(f.project, selection.taskId, preview.revision, pendingRequest, selection.directions);
  const pending = await reopened.preview(f.project, selection.taskId);
  assert.equal(pending.executionCurrent, false); assert.equal(pending.ready, false);
  const history = read(path.join(f.directory, 'task-authority.json')).history;
  assert.ok(history.some(event => event.before?.execution?.id === execution.id));
});

test('source changes revoke approval and restored bytes never revive an observed revocation', async t => {
  const f = await fixture(t), selection = await f.selected(); await f.approve(selection);
  const file = path.join(f.input, 'manual/request.md'), original = fs.readFileSync(file);
  fs.appendFileSync(file, '\nChanged confirmation.');
  assert.equal((await f.broker.preview(f.project, selection.taskId)).executionCurrent, false);
  fs.writeFileSync(file, original);
  const restored = await f.broker.preview(f.project, selection.taskId);
  assert.equal(restored.ready, true); assert.equal(restored.executionCurrent, false);
  await assert.rejects(f.broker.reviewExecution(f.project, selection.taskId, selection.chosen.revision, restored.key, reviewer), /authority-stale/);
});

async function correction(f, scope = 'social', target = 'headline') {
  const file = path.join(f.input, 'brand-decisions.json'), doc = read(file);
  doc.rules.push({ id: 'R-COPY', kind: 'copy', target, value: 'Made carefully.', sourceId: 'S-REQUEST', scope }); write(file, doc);
  fs.writeFileSync(path.join(f.input, 'manual/correction.md'), 'Synthetic owner confirms the corrected rule and its consequences.');
  return { ruleId: 'R-COPY', value: 'New confirmed copy.', reason: 'Explicit synthetic correction.', baseHash: authorityHash(doc),
    source: { id: 'S-CORRECTION', path: 'manual/correction.md', sha256: digest(fs.readFileSync(path.join(f.input, 'manual/correction.md'))), summary: 'Synthetic sourced correction', ...reviewer } };
}

test('sourced correction atomically retains original rules/evidence and invalidates only channel-dependent approvals', async t => {
  const f = await fixture(t), command = await correction(f);
  const story = await f.selected(), web = await f.selected('conceptual-landing');
  await f.approve(story); const webExecution = await f.approve(web);
  const originalEvidence = fs.readFileSync(path.join(f.input, 'manual/request.md'));
  const preview = await f.broker.correctionPreview(f.project, command);
  assert.deepEqual(preview.affectedTasks, [story.taskId]);
  await assert.rejects(f.broker.correct(f.project, command, { previewHash: preview.previewHash, affectedTasks: [] }), /acknowledgment/);
  await f.broker.correct(f.project, command, { previewHash: preview.previewHash, affectedTasks: preview.affectedTasks });
  const document = read(path.join(f.input, 'brand-decisions.json')); validateDecisionDocument(document);
  assert.equal(document.schemaVersion, 'brand-decisions/v2'); assert.equal(document.history[0].before.value, 'Made carefully.');
  assert.equal(document.history[0].after.value, 'New confirmed copy.');
  assert.deepEqual(fs.readFileSync(path.join(f.input, 'manual/request.md')), originalEvidence);
  assert.equal((await f.broker.preview(f.project, story.taskId)).executionCurrent, false);
  assert.equal((await f.broker.preview(f.project, web.taskId)).execution.id, webExecution.id);
  await assert.rejects(f.broker.correct(f.project, command, { previewHash: preview.previewHash, affectedTasks: preview.affectedTasks }), /Stale correction/);
});

test('correction rejects reused provenance and malformed history, while report inference review preserves v2 history', async t => {
  const f = await fixture(t), command = await correction(f);
  await assert.rejects(correctedRuleDocument(f.input, { ...command, source: { ...command.source, path: 'manual/request.md' } }), /new source identity/);
  const { document } = await correctedRuleDocument(f.input, command); write(path.join(f.input, 'brand-decisions.json'), document);
  const { prepared, analysis } = await taskEvidence(f.input, 'instagram-story'), current = await loadDecisions(prepared, analysis);
  const previous = document.inferenceDecisions[0], incoming = { ...previous, action: 'accept-proposal', ...reviewer, note: 'Use only as an exploratory hypothesis.' };
  await importReview(prepared, analysis, { schemaVersion: 'brand-review/v1', username: 'example_studio', decisions: [{ ...incoming, baseRevision: decisionRevision(previous) }] });
  const reviewed = read(path.join(f.input, 'brand-decisions.json')); validateDecisionDocument(reviewed);
  assert.equal(reviewed.history.length, 2); assert.equal(reviewed.history[0].before.sourceId, 'S-REQUEST');
  assert.equal((await loadDecisions(prepared, analysis)).effectiveAnalysis.inferences[0].status, current.effectiveAnalysis.inferences[0].status);
  reviewed.history[0].after.value = 'Tampered history'; assert.throws(() => validateDecisionDocument(reviewed), /differs/);
});

test('failed task write after correction still keeps canonical history and rejects stale execution on reopen', async t => {
  const f = await fixture(t), command = await correction(f), selection = await f.selected(); await f.approve(selection);
  const preview = await f.broker.correctionPreview(f.project, command);
  const faulty = new TaskAuthority(f.store, { fault: point => { if (point === 'authority-after-correction') throw new Error('synthetic task write fault'); } });
  await assert.rejects(faulty.correct(f.project, command, { previewHash: preview.previewHash, affectedTasks: preview.affectedTasks }), /synthetic task write fault/);
  assert.equal(read(path.join(f.input, 'brand-decisions.json')).history.length, 1);
  f.store.close(); const reopened = new TaskAuthority(f.open());
  assert.equal((await reopened.preview(f.project, selection.taskId)).executionCurrent, false);
});

async function publication(f, selection, execution) {
  const folder = path.join(f.directory, 'results', randomUUID()); fs.mkdirSync(folder, { recursive: true });
  const file = path.join(folder, 'story.txt'); fs.writeFileSync(file, 'Synthetic final artifact.');
  const files = [{ path: path.relative(f.directory, file).replaceAll('\\', '/'), sha256: digest(fs.readFileSync(file)) }];
  const artifactHash = digest(JSON.stringify(files));
  const doc = read(path.join(f.input, 'brand-decisions.json'));
  for (const id of ['S-PUBLISH', 'S-RENDER']) {
    const relative = `manual/${id}.md`; fs.writeFileSync(path.join(f.input, relative), `Synthetic explicit ${id} confirmation.`);
    doc.sources.push({ id, path: relative, sha256: digest(fs.readFileSync(path.join(f.input, relative))), summary: 'Synthetic confirmation', ...reviewer });
  }
  write(path.join(f.input, 'brand-decisions.json'), doc);
  const prepared = await f.broker.preview(f.project, selection.taskId);
  const grant = { sourceId: 'S-PUBLISH', assetIds: prepared.brief.assets.map(asset => asset.id), platform: 'instagram-story', use: 'public-publication', ...reviewer };
  return { input: { executionId: execution.id, files, target: { platform: 'instagram-story', use: 'public-publication' }, grant,
    review: { sourceId: 'S-RENDER', artifactHash, executionId: execution.id, checks: publicationChecks('instagram-story'), ...reviewer } }, file, preview: prepared };
}

test('publication requires separate explicit rights and rendered review of exact bytes; changed/restored artifacts stay revoked', async t => {
  const f = await fixture(t), selection = await f.selected(), execution = await f.approve(selection), pub = await publication(f, selection, execution);
  await assert.rejects(f.broker.acceptPublication(f.project, selection.taskId, pub.preview.revision, { ...pub.input, grant: null }), /publication-permission/);
  await assert.rejects(f.broker.acceptPublication(f.project, selection.taskId, pub.preview.revision, { ...pub.input, review: { ...pub.input.review, artifactHash: digest('other') } }), /render-review-stale/);
  const accepted = await f.broker.acceptPublication(f.project, selection.taskId, pub.preview.revision, pub.input);
  assert.equal(accepted.publicationOperationAuthorized, false);
  assert.equal((await f.broker.preview(f.project, selection.taskId)).publicationCurrent, true);
  const original = fs.readFileSync(pub.file); fs.writeFileSync(pub.file, 'A different artifact.');
  assert.equal((await f.broker.preview(f.project, selection.taskId)).publicationCurrent, false);
  fs.writeFileSync(pub.file, original);
  assert.equal((await f.broker.preview(f.project, selection.taskId)).publicationCurrent, false);
  assert.equal((await f.broker.preview(f.project, selection.taskId)).executionCurrent, true);
});

test('missing native-platform review and changing permission sources cannot be accepted for publication', async t => {
  const f = await fixture(t), selection = await f.selected(), execution = await f.approve(selection), pub = await publication(f, selection, execution);
  await assert.rejects(f.broker.acceptPublication(f.project, selection.taskId, pub.preview.revision, { ...pub.input, review: { ...pub.input.review, checks: ['contrast'] } }), /rendered\/platform review/);
  await f.broker.acceptPublication(f.project, selection.taskId, pub.preview.revision, pub.input);
  fs.appendFileSync(path.join(f.input, 'manual/S-PUBLISH.md'), '\nDifferent permission.');
  assert.equal((await f.broker.preview(f.project, selection.taskId)).publicationCurrent, false);
});

test('writer ownership, stale revisions and commit faults cannot replace authority history', async t => {
  const f = await fixture(t), selection = await f.selected(), before = fs.readFileSync(path.join(f.directory, 'task-authority.json'));
  const faulty = new TaskAuthority(f.store, { fault: () => { throw new Error('synthetic commit failure'); } });
  await assert.rejects(faulty.preview(f.project, selection.taskId), /synthetic commit failure/);
  assert.deepEqual(fs.readFileSync(path.join(f.directory, 'task-authority.json')), before);
  guard.claim(f.directory, { version: 1, type: 'cli', token: randomUUID() });
  await assert.rejects(f.broker.preview(f.project, selection.taskId), /writer-busy/);
  guard.release(f.directory, guard.readOwner(f.directory).token);
  await assert.rejects(f.broker.select(f.project, selection.taskId, 999, selection.request, selection.directions), /authority-stale/);
});

test('selected directions must use current source context; canonical v1 briefs keep their existing gates', async t => {
  const f = await fixture(t), selection = await f.selected('conceptual-landing');
  const preview = await f.broker.preview(f.project, selection.taskId);
  assert.equal(preview.brief.schemaVersion, 'design-brief/v2');
  assert.equal(preview.brief.status, 'inputs-ready'); assert.equal(preview.executionCurrent, false);
  assert.equal(preview.brief.kind, 'conceptual-landing');
  await assert.rejects(selectedBrief(f.input), /missing or stale/);
  const changed = { ...selection.request, objective: 'Another task scope.' };
  const result = await f.broker.select(f.project, selection.taskId, preview.revision, changed, selection.directions);
  assert.equal(result.ready, false); assert.ok(result.questions.some(item => item.includes('current directions')));
});

test('authorized code context binds actual file bytes; later code changes revoke editing authority', async t => {
  const f = await fixture(t), created = await f.broker.create(f.project, explore('website-change'));
  const site = path.join(f.root, 'site'); fs.mkdirSync(site); fs.writeFileSync(path.join(site, 'index.html'), '<h1>Synthetic site</h1>');
  const request = requestV2(f.source.request, 'website-change'); request.existingSite = { root: site, files: ['index.html'], sourceId: 'S-REQUEST' };
  const state = await prepareBrief(f.input, { requestDocument: request }); request.selectedDirectionId = 'D-1';
  const directions = { schemaVersion: 'creative-directions/v1', inputHash: state.inputHash, directions: fixtureDirections(state.context) };
  const selected = await f.broker.select(f.project, created.taskId, created.revision, request, directions);
  assert.equal(selected.ready, true); await f.broker.reviewExecution(f.project, created.taskId, selected.revision, selected.key, reviewer);
  fs.appendFileSync(path.join(site, 'index.html'), '<p>Another revision</p>');
  assert.equal((await f.broker.preview(f.project, created.taskId)).executionCurrent, false);
  assert.equal(read(path.join(f.input, 'design-request.json')).schemaVersion, 'design-request/v1');
});

test('late callbacks fenced by store exit and unsafe artifact paths cannot commit acceptance', async t => {
  const f = await fixture(t), selection = await f.selected(), execution = await f.approve(selection), pub = await publication(f, selection, execution);
  await assert.rejects(f.broker.acceptPublication(f.project, selection.taskId, pub.preview.revision, { ...pub.input, files: [{ path: '../outside.txt', sha256: digest('x') }] }), /invalid-artifact/);
  const before = fs.readFileSync(path.join(f.directory, 'task-authority.json'));
  const late = new TaskAuthority(f.store, { fault: point => { if (point === 'authority-before-commit') f.store.close(); } });
  await assert.rejects(late.reviewExecution(f.project, selection.taskId, pub.preview.revision, pub.preview.key, reviewer), /job-store-unavailable/);
  assert.deepEqual(fs.readFileSync(path.join(f.directory, 'task-authority.json')), before);
  const reopened = new TaskAuthority(f.open()); assert.equal((await reopened.preview(f.project, selection.taskId)).executionCurrent, true);
});

test('task input is detached before asynchronous validation so later caller edits cannot change the reviewed scope', async t => {
  const f = await fixture(t), goal = explore(), expected = goal.objective;
  const creating = f.broker.create(f.project, goal); goal.objective = 'A different caller edit while preparation runs.';
  const created = await creating; assert.equal(created.context.objective, expected);
  const request = requestV2(f.source.request), prepared = await prepareBrief(f.input, { requestDocument: request });
  request.selectedDirectionId = 'D-1';
  const directions = { schemaVersion: 'creative-directions/v1', inputHash: prepared.inputHash, directions: fixtureDirections(prepared.context) };
  const selecting = f.broker.select(f.project, created.taskId, created.revision, request, directions);
  request.copy[1].text = 'Unreviewed later edit.'; directions.directions[0].id = 'D-OTHER';
  const chosen = await selecting; assert.equal(chosen.ready, true);
  const preview = await f.broker.preview(f.project, created.taskId);
  assert.equal(preview.brief.request.copy[1].text, 'Made carefully.'); assert.equal(preview.brief.selectedDirection.id, 'D-1');
});
