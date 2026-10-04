import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const sandbox = vm.createContext({});
vm.runInContext(await readFile(new URL('../prototypes/selective-review/model.js', import.meta.url), 'utf8'), sandbox);
const M = sandbox.SelectiveReview;
const plain = value => JSON.parse(JSON.stringify(value));
const ids = state => Array.from(M.issues(state), item => item.id);
const selected = state => M.change(state, 'direction', 'text-first');

test('proposal acceptance/rejection/defer never confirms identity or rewrites source rules', () => {
  const original = M.create(), rules = plain(original.rules), copy = plain(original.copy);
  let state = M.change(original, 'tone', 'accept-proposal');
  state = M.change(state, 'composition', 'reject');
  state = M.change(state, 'composition', 'pending');
  assert.deepEqual(plain(state.rules), rules);
  assert.deepEqual(plain(state.copy), copy);
  assert.equal(state.tone.action, 'accept-proposal');
  assert.equal(state.composition.original, original.composition.original);
  assert.equal(state.composition.id, original.composition.id);
  assert.ok(state.history.some(item => item.after === 'reject'));
  assert.equal(original.history.length, 0);
  const edited = M.change(selected(state), 'edit-proposal', 'Otra composición para explorar.');
  assert.equal(edited.direction, null);
  assert.equal(edited.composition.action, 'pending');
  assert.equal(edited.tone.action, 'accept-proposal');
  assert.deepEqual(plain(edited.copy), copy);
});

test('exploration uses placeholders for unapproved collaborator assets without granting reuse', () => {
  const state = selected(M.create('collaborator'));
  assert.equal(M.context(state).assetUse, 'placeholder-only');
  assert.match(M.context(state).attribution, /Otro autor/);
  assert.ok(ids(state).includes('permission'));
  assert.throws(() => M.approveExecution(state), /required review/);
  const excluded = M.change(state, 'reference');
  assert.equal(M.context(excluded).assetUse, 'placeholder-only');
  assert.ok(ids(excluded).includes('asset'));
  const replaced = M.change(excluded, 'asset');
  assert.notEqual(replaced.asset.id, state.asset.id);
  assert.equal(replaced.asset.owner, 'own');
  assert.equal(replaced.history.find(item => item.action === 'asset').before.asset.id, state.asset.id);
});

test('execution, render and publication are distinct, including local-only permission', () => {
  let state = selected(M.create());
  assert.equal(M.phase(state), 'exploration');
  state = M.approveExecution(state);
  assert.equal(M.phase(state), 'selected-execution-demo');
  assert.throws(() => M.approvePublication(state), /publication permission/);
  state = M.change(state, 'render', true);
  state = M.approvePublication(state);
  assert.equal(M.phase(state), 'publication-accepted-demo');
  const local = selected(M.create()); local.asset.permission = 'local-demo';
  const rendered = M.change(M.approveExecution(local), 'render', true);
  assert.equal(M.executionCurrent(rendered), true);
  assert.ok(M.publicationIssues(rendered).some(text => /publicación/.test(text)));
  assert.throws(() => M.approvePublication(rendered), /publication permission/);
});

test('copy correction requires reason/revision and archives dependent approvals without losing other decisions', () => {
  let state = M.change(M.create(), 'tone', 'reject');
  state = M.approveExecution(selected(state));
  const before = plain(state), rules = plain(state.rules);
  assert.throws(() => M.replaceCopy(state, { text:'Nuevo texto.', note:'', baseRevision:1 }), /reason/);
  assert.throws(() => M.replaceCopy(state, { text:'Nuevo texto.', note:'Correction', baseRevision:0 }), /changed/);
  const corrected = M.replaceCopy(state, { text:'Una pieza para tu pausa.', note:'Human demo correction', baseRevision:1 });
  assert.equal(corrected.execution, null);
  assert.equal(corrected.direction, null);
  assert.equal(corrected.copy.revision, 2);
  assert.notEqual(corrected.copy.sourceId, state.copy.sourceId);
  assert.equal(corrected.tone.action, 'reject');
  assert.deepEqual(plain(corrected.rules), rules);
  assert.equal(corrected.archive[0].execution.copy.text, before.copy.text);
  assert.deepEqual(plain(state), before);
});

test('changed source/task revokes dependent readiness but retains unrelated scope and preferences', () => {
  let state = M.change(M.create(), 'tone', 'accept-proposal');
  state = M.approveExecution(selected(state));
  const changed = M.change(state, 'source-changed');
  assert.equal(M.context(changed).confirmedCopy, null);
  assert.ok(ids(changed).includes('source'));
  assert.equal(changed.copy.text, state.copy.text);
  assert.equal(changed.tone.action, 'accept-proposal');
  assert.equal(changed.archive.length, 1);
  assert.equal(M.executionCurrent(state), true);
  const task = M.change(state, 'task', 'website-change');
  for (const id of ['action','fit','alt','site','direction']) assert.ok(ids(task).includes(id), id);
  assert.equal(M.context(task).rule.scope, 'website');
  assert.equal(task.rules.find(rule => rule.scope === 'social').value, state.rules.find(rule => rule.scope === 'social').value);
  assert.equal(task.tone.action, 'accept-proposal');
});

test('mandatory questions depend on the case and cannot be solved by accepting optional inferences', () => {
  const expected = { incomplete:['facts','copy','origin','permission'], 'low-resolution':['resolution'], 'missing-site':['site'], 'channel-conflict':['channel'] };
  for (const [scenario, blockers] of Object.entries(expected)) {
    let state = M.change(selected(M.create(scenario)), 'tone', 'accept-proposal');
    for (const id of blockers) assert.ok(ids(state).includes(id), `${scenario}:${id}`);
    assert.throws(() => M.approveExecution(state), /required review/);
    for (const id of blockers) state = M.change(state,id);
    assert.equal(M.executionCurrent(M.approveExecution(state)), true);
  }
  assert.throws(() => M.change(M.create(),'task','unsupported'), /Unknown task/);
  const social = M.change(M.create('channel-conflict'), 'task', 'instagram-story');
  assert.ok(!ids(social).includes('channel'), 'A website-only conflict does not gate a social task.');
});
