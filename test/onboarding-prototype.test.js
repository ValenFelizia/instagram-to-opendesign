import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const sandbox = vm.createContext({ URL });
vm.runInContext(await readFile(new URL('../prototypes/onboarding/model.js', import.meta.url), 'utf8'), sandbox);
const model = sandbox.OnboardingPrototype;
const plain = value => JSON.parse(JSON.stringify(value));

test('onboarding storage keeps only synthetic choices, never credentials, URLs or arbitrary text', () => {
  const input = { ...model.initial(), configured: true, view: 'actions', task: 'website-change',
    images: ['brand-graphic', 'product-photo', 'excluded'], palette: 'proposal',
    rights: 'demo-permitted', site: true, apifyKey: 'secret-example',
    url: 'https://www.instagram.com/private_example/', note: 'untrusted text' };
  const stored = plain(model.snapshot(input));
  assert.equal(stored.task, 'website-change');
  assert.equal(stored.site, true);
  assert.deepEqual(stored.images, ['brand-graphic', 'product-photo', 'excluded']);
  assert.equal(stored.palette, 'proposal');
  assert.equal(stored.rights, 'demo-permitted');
  assert.ok(!/secret-example|private_example|untrusted text|apifyKey/.test(JSON.stringify(stored)));
  assert.deepEqual(plain(model.restore(JSON.stringify(stored))), stored);
});

test('reopening a running simulation records interruption instead of pretending work continued', () => {
  const state = { ...model.initial(), configured: true, status: 'running', phase: 3, view: 'home' };
  const reopened = model.restore(JSON.stringify(state));
  assert.equal(reopened.status, 'interrupted');
  assert.equal(reopened.view, 'progress');
  assert.equal(reopened.phase, 3);
  for (const raw of ['invalid json', 'null', '{"version":2}', '{"version":1,"view":"<script>","phase":900,"images":["approved"]}']) {
    const safe = model.restore(raw);
    assert.equal(safe.view, 'home');
    assert.equal(safe.phase, 0);
    assert.deepEqual(plain(safe.images), [null, null, null]);
    assert.equal(safe.palette, 'pending');
  }
});

test('profile intake rejects non-profile destinations and URL authority tricks', () => {
  assert.equal(model.profile(' https://www.instagram.com/Example.Studio/ '), 'example.studio');
  for (const input of ['https://instagram.com/p/abc', 'https://instagram.com/reels/',
    'https://instagram.com/accounts/login/', 'https://instagram.com/',
    'https://instagram.com.example.org/example/', 'https://secret@instagram.com/example/',
    'javascript:alert(1)', 'https://example.org/', 'https://instagram.com/a/b',
    'https://instagram.com/' + 'a'.repeat(31)]) assert.equal(model.profile(input), null, input);
});
