import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { Supervisor } = require('../desktop/supervisor.cjs');
const { validRequest, trustedSender, workerEnvironment } = require('../desktop/protocol.cjs');

function fixture(options = {}) {
  const child = new EventEmitter();
  child.messages = [];
  child.postMessage = value => child.messages.push(value);
  child.kill = () => { child.killed = true; child.emit('exit', 0); return true; };
  let forks = 0;
  const supervisor = new Supervisor(() => { forks++; return child; }, options);
  supervisor.boot();
  return { child, supervisor, forks: () => forks };
}

test('shell IPC accepts fixed actions only and refuses foreign frames', () => {
  for (const action of ['status', 'start-check', 'exit']) assert.equal(validRequest({ action }), true);
  for (const request of [null, [], 'status', {}, { action: 'read-file' }, { action: 'status', path: 'private' }]) assert.equal(validRequest(request), false);
  const frame = { url: 'file:///app/index.html#main' };
  const contents = { mainFrame: frame };
  const window = { isDestroyed: () => false, webContents: contents };
  assert.equal(trustedSender({ sender: contents, senderFrame: frame }, window, 'file:///app/index.html'), true);
  assert.equal(trustedSender({ sender: contents, senderFrame: { ...frame } }, window, 'file:///app/index.html'), false);
  frame.url = 'file:///app/index.html?other';
  assert.equal(trustedSender({ sender: contents, senderFrame: frame }, window, 'file:///app/index.html'), false);
  assert.deepEqual(workerEnvironment({ SystemRoot: 'Windows', PATH: 'private', API_KEY: 'secret', NODE_OPTIONS: '--import=untrusted' }), { SystemRoot: 'Windows' });
});

test('worker startup, view-independent progress and duplicate local dispatch', () => {
  const { child, supervisor, forks } = fixture();
  assert.equal(supervisor.start(), false);
  supervisor.boot(); assert.equal(forks(), 1);
  child.emit('message', { type: 'ready', core: true, sharp: true });
  assert.equal(supervisor.start(), true);
  assert.equal(supervisor.start(), false);
  const unsubscribe = () => supervisor.removeAllListeners('state');
  unsubscribe();
  child.emit('message', { type: 'tick', value: 2 }); assert.equal(supervisor.snapshot().ticks, 0);
  for (let value = 1; value <= 20; value++) child.emit('message', { type: 'tick', value });
  child.emit('message', { type: 'complete' });
  assert.equal(supervisor.snapshot().status, 'completed');
  assert.equal(child.messages.length, 1);
  const copy = supervisor.snapshot(); copy.checks.core = false;
  assert.equal(supervisor.snapshot().checks.core, true);
});

test('worker death preserves observed steps and never respawns or retries', () => {
  const { child, supervisor, forks } = fixture();
  child.emit('message', { type: 'ready', core: true, sharp: true });
  supervisor.start(); child.emit('message', { type: 'tick', value: 1 }); child.emit('exit', 1);
  assert.equal(supervisor.snapshot().status, 'interrupted');
  assert.equal(supervisor.snapshot().ticks, 1);
  assert.equal(supervisor.start(), false); assert.equal(forks(), 1);
});

test('explicit Exit rejects new work and kills a worker after a bounded grace period', async () => {
  const { child, supervisor } = fixture({ shutdownMs: 5 });
  child.emit('message', { type: 'ready', core: true, sharp: true });
  const first = supervisor.shutdown();
  assert.equal(supervisor.shutdown(), first);
  assert.equal(supervisor.start(), false);
  child.emit('message', { type: 'tick', value: 1 });
  await first;
  assert.equal(child.killed, true); assert.equal(supervisor.child, null);
});
