import test from 'node:test';
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { append, fixtureHash, load, recover } from '../prototypes/job-lifecycle/store.mjs';

const qaRoot = path.resolve('tmp/job-lifecycle-qa');
async function fixture(t) {
  await mkdir(qaRoot, { recursive: true });
  const root = await mkdtemp(path.join(qaRoot, 'test-'));
  t.after(async () => {
    assert.equal(path.dirname(path.resolve(root)), qaRoot);
    assert.match(path.basename(root), /^test-/);
    await rm(root, { recursive: true, force: true });
  });
  return root;
}

async function worker(t, root) {
  const child = fork(fileURLToPath(new URL('../prototypes/job-lifecycle/worker.mjs', import.meta.url)),
    [root], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'], env: {} });
  const ready = await once(child, 'message');
  assert.equal(ready[0].ready, true);
  let seq = 0;
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      const ended = once(child, 'exit'); child.kill(); await ended;
    }
  });
  async function send(kind) {
    const requestId = ++seq;
    const reply = once(child, 'message');
    child.send({ requestId, kind });
    const [response] = await reply;
    assert.equal(response.requestId, requestId);
    return response;
  }
  await send('queued'); await send('running');
  return { child, send, async kill() {
    const ended = once(child, 'exit'); child.kill(); await ended;
  } };
}

test('losing a synthetic UI observer does not stop worker checkpoints', { timeout: 15000 }, async t => {
  const root = await fixture(t), { child, send, kill } = await worker(t, root);
  let visibleUpdates = 0;
  const view = () => visibleUpdates++;
  child.on('message', view);
  await send('local-checkpoint');
  child.off('message', view); // Window subscription closes; app owner stays alive.
  const before = visibleUpdates;
  await send('completed');
  assert.equal(visibleUpdates, before);
  assert.equal((await load(root)).status, 'completed');
  assert.equal(recover(await load(root)).next, 'open-output');
  await kill();
});

test('worker kill after dispatch intent retains partial work and never schedules a paid replay', { timeout: 15000 }, async t => {
  const root = await fixture(t), active = await worker(t, root);
  await active.send('local-checkpoint'); await active.send('attempt-started');
  await active.kill();
  const before = await load(root), recovered = recover(before);
  assert.equal(recovered.status, 'interrupted');
  assert.equal(recovered.remoteOutcome, 'unknown');
  assert.equal(recovered.requiresReview, true);
  assert.equal(recovered.localCheckpointReusable, true);
  assert.equal(recovered.dispatch, false);
  assert.equal(recovered.attemptId, 'synthetic-attempt-1');
  assert.deepEqual(await load(root), before); // Recovery itself writes/dispatches nothing.
});

test('checkpointed response survives kill and can be revalidated locally without a new attempt', { timeout: 15000 }, async t => {
  const root = await fixture(t), active = await worker(t, root);
  await active.send('local-checkpoint'); await active.send('attempt-started');
  await active.send('attempt-response'); await active.kill();
  const restored = recover(await load(root));
  assert.equal(restored.responseReusable, true);
  assert.equal(restored.requiresReview, false);
  assert.equal(restored.dispatch, false);
  assert.equal((await load(root)).history.filter(event => event.kind === 'attempt-started').length, 1);
  assert.equal(recover(await load(root), 'synthetic-changed').responseReusable, false);
  assert.equal(recover(await load(root), 'synthetic-changed').next, 'review-inputs');
});

test('explicit synthetic Exit persists interruption before worker disconnect', { timeout: 15000 }, async t => {
  const root = await fixture(t), active = await worker(t, root);
  await active.send('local-checkpoint');
  const ended = once(active.child, 'exit');
  await active.send('exit'); await ended;
  const state = await load(root);
  assert.equal(state.status, 'interrupted');
  assert.equal(state.localCheckpoint, true);
  assert.equal(recover(state).dispatch, false);
});

test('partial event is unpublished; corrupt committed data/gaps fail closed and original survives', async t => {
  const root = await fixture(t);
  await append(root, 'queued');
  await writeFile(path.join(root, '000002.json.partial'), '{');
  assert.equal((await load(root)).status, 'queued');
  await writeFile(path.join(root, '000003.json'), '{}');
  await assert.rejects(load(root), /EVENT_GAP/);
  await rm(path.join(root, '000003.json'));
  await writeFile(path.join(root, '000001.json'), '{');
  await assert.rejects(load(root), SyntaxError);
});

test('duplicate intent and completion without acknowledged response are rejected', async t => {
  const root = await fixture(t);
  for (const kind of ['queued', 'running', 'local-checkpoint', 'attempt-started']) await append(root, kind);
  const before = await load(root);
  await assert.rejects(append(root, 'attempt-started'), /DUPLICATE_ATTEMPT/);
  await assert.rejects(append(root, 'completed'), /INCOMPLETE_RESULT/);
  assert.deepEqual(await load(root), before);
  assert.equal(recover(before, fixtureHash).dispatch, false);
});

test('review-required, failed and queued survive reload as distinct states', async t => {
  for (const terminal of ['review-required', 'failed']) {
    const root = await fixture(t);
    for (const kind of ['queued', 'running', terminal]) await append(root, kind);
    assert.equal(recover(await load(root)).status, terminal);
  }
  const root = await fixture(t);
  await append(root, 'queued');
  assert.equal(recover(await load(root)).status, 'queued');
  assert.equal(recover(await load(root)).dispatch, false);
});
