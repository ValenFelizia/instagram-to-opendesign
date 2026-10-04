import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { Workspace, profile } = require('../desktop/workspace.cjs');
const { Credentials } = require('../desktop/credentials.cjs');
const { Broker, diagnostic, validWorkspaceRequest } = require('../desktop/broker.cjs');
const { BrokerError, safeName, inventory, fingerprint, atomicJson, checked, removeOwned } = require('../desktop/paths.cjs');
const base = path.resolve('tmp/workspace-tests'); fs.mkdirSync(base, { recursive: true });
function fixture(t, options) {
  const root = fs.mkdtempSync(path.join(base, 'case-'));
  t.after(() => { assert.equal(path.dirname(path.resolve(root)), base); fs.rmSync(root, { recursive: true, force: true }); });
  const workspace = new Workspace(path.join(root, 'app'), options);
  const source = path.join(root, 'legacy'); fs.mkdirSync(source);
  fs.mkdirSync(path.join(source, 'assets'));
  fs.writeFileSync(path.join(source, 'instagram-source.json'), JSON.stringify({ username: 'example.studio', biography: 'Fictional fixture.' }));
  fs.writeFileSync(path.join(source, 'assets', 'sample.png'), Buffer.from([1, 2, 3, 4]));
  return { root, workspace, source };
}
const blocked = code => error => error.code === code;

test('create/open/relaunch: registry survives and renderer views contain no paths', t => {
  const { workspace, root } = fixture(t);
  const created = workspace.create('Example studio', 'https://www.instagram.com/example.studio/');
  assert.equal(created.projects.length, 1); assert.equal(created.active, created.projects[0].id);
  assert.equal(JSON.stringify(created).includes(root), false);
  const restarted = new Workspace(workspace.root);
  assert.equal(restarted.view().active, null);
  assert.equal(restarted.open(created.active).active, created.active);
  assert.equal(fs.existsSync(path.join(workspace.project(created.active).directory, 'data', 'example.studio')), true);
  for (const value of ['http://instagram.com/example', 'https://instagram.com/p/', 'https://instagram.com/example?key=x', 'https://evil.invalid/example', 'file:///secret']) assert.throws(() => profile(value), blocked('invalid-profile'));
});

test('native import copies exact bytes and source inventory without rewriting originals', t => {
  const { workspace, source } = fixture(t), before = inventory(source);
  const preview = workspace.previewImport(source);
  assert.deepEqual(Object.keys(preview).sort(), ['bytes', 'files', 'token']);
  const state = workspace.create('Imported fixture', '', undefined, preview.token);
  const copied = path.join(workspace.project(state.active).directory, 'data', 'imported');
  assert.equal(fingerprint(inventory(source)), fingerprint(before));
  assert.equal(fingerprint(inventory(copied)), fingerprint(before));
  assert.throws(() => workspace.create('Again', '', undefined, preview.token), blocked('import-expired'));
});

test('normalized legacy profile identity is retained and conflicting URLs are refused', t => {
  const { workspace, source } = fixture(t);
  fs.writeFileSync(path.join(source, 'instagram-source.json'), JSON.stringify({ schemaVersion: 'instagram-source/v1', profile: { username: 'example.studio' } }));
  let preview = workspace.previewImport(source);
  assert.throws(() => workspace.create('Wrong profile', 'https://instagram.com/other.studio/', undefined, preview.token), blocked('profile-mismatch'));
  assert.equal(workspace.view().projects.length, 0);
  preview = workspace.previewImport(source);
  const state = workspace.create('Correct profile', '', undefined, preview.token);
  assert.equal(workspace.project(state.active).metadata.profile, 'example.studio');
  assert.equal(fs.existsSync(path.join(workspace.project(state.active).directory, 'data', 'example.studio', 'instagram-source.json')), true);
});

test('changed import and registry write failure preserve existing projects and source', t => {
  let reject = false;
  const { workspace, source } = fixture(t, { write: (file, record) => { if (reject) throw new Error('private path/key must never be exposed'); atomicJson(file, record); } });
  const first = workspace.create('First', '').active, preview = workspace.previewImport(source);
  fs.writeFileSync(path.join(source, 'brand-report.html'), '<p>changed</p>');
  assert.throws(() => workspace.create('Changed', '', undefined, preview.token), blocked('source-changed'));
  const updated = workspace.previewImport(source), before = fingerprint(inventory(source));
  reject = true;
  assert.throws(() => workspace.create('Failed copy', '', undefined, updated.token));
  assert.equal(workspace.project(first).metadata.name, 'First');
  assert.equal(workspace.view().projects.length, 1);
  assert.equal(fs.readdirSync(path.join(workspace.root, 'projects')).length, 1);
  assert.equal(fingerprint(inventory(source)), before);
});

test('registry corruption never resets or overwrites the registry or existing files', t => {
  const { workspace } = fixture(t), state = workspace.create('Retained', '');
  const directory = workspace.project(state.active).directory;
  const file = path.join(workspace.root, 'registry.json'); fs.writeFileSync(file, '{broken');
  assert.throws(() => workspace.create('No reset', ''), blocked('registry-unreadable'));
  assert.equal(fs.readFileSync(file, 'utf8'), '{broken'); assert.equal(fs.existsSync(directory), true);
});

test('malicious names, archives, hidden keys and hardlink aliases are refused', t => {
  for (const name of ['../x', '..', 'file:stream.txt', 'CON.json', 'nul', 'file. ', 'a/b', 'a\\b', 'x\0y']) assert.equal(safeName(name), false);
  const { workspace, source } = fixture(t);
  for (const name of ['.env.local', 'credentials.json', 'source.zip', 'startup.exe']) {
    const file = path.join(source, name); fs.writeFileSync(file, 'synthetic');
    assert.throws(() => workspace.previewImport(source), blocked('unsafe-file')); fs.unlinkSync(file);
  }
  const alias = path.join(source, 'alias.json'); fs.linkSync(path.join(source, 'instagram-source.json'), alias);
  assert.throws(() => workspace.previewImport(source), blocked('unsafe-path')); fs.unlinkSync(alias);
});

test('Windows junctions and linked ancestors cannot import/export/delete outside scope', t => {
  const { workspace, root, source } = fixture(t);
  const state = workspace.create('Bounded', ''), directory = workspace.project(state.active).directory;
  const link = path.join(directory, 'escape'); fs.symlinkSync(source, link, process.platform === 'win32' ? 'junction' : 'dir');
  t.after(() => { if (fs.existsSync(link)) fs.unlinkSync(link); });
  assert.throws(() => workspace.trash(state.active, 'project'), blocked('unsafe-path'));
  const destination = path.join(root, 'export'); fs.mkdirSync(destination);
  assert.throws(() => workspace.export(state.active, 'project-backup', destination), blocked('unsafe-path'));
  assert.throws(() => checked(path.join(link, 'assets')), blocked('unsafe-path'));
  assert.throws(() => workspace.previewImport(link), blocked('unsafe-path'));
  assert.throws(() => removeOwned(directory, directory), blocked('unsafe-path'));
  assert.equal(fs.existsSync(path.join(source, 'instagram-source.json')), true);
});

test('backups are scoped, portable and credential-free; trash is reversible and source is retained', t => {
  const { workspace, source, root } = fixture(t);
  const preview = workspace.previewImport(source), state = workspace.create('Example', '', undefined, preview.token);
  const project = workspace.project(state.active), backup = path.join(root, 'backups'); fs.mkdirSync(backup);
  fs.mkdirSync(path.join(workspace.root, 'credentials')); fs.writeFileSync(path.join(workspace.root, 'credentials', 'apify.json'), 'synthetic encrypted blob');
  assert.throws(() => workspace.export(state.active, 'all', backup), blocked('invalid-request'));
  assert.throws(() => workspace.export(state.active, 'project-backup', project.directory), blocked('unsafe-path'));
  workspace.export(state.active, 'project-backup', backup);
  const copied = path.join(backup, fs.readdirSync(backup)[0]);
  assert.equal(fingerprint(inventory(project.directory)), fingerprint(inventory(copied)));
  assert.equal(fs.existsSync(path.join(copied, 'credentials')), false);
  assert.equal(fs.readFileSync(path.join(copied, 'project.json'), 'utf8').includes(root), false);
  assert.throws(() => workspace.trash(state.active, 'workspace'), blocked('invalid-request'));
  workspace.trash(state.active, 'project');
  assert.equal(workspace.view().projects[0].status, 'trash');
  assert.equal(fs.existsSync(source), true); assert.equal(fs.existsSync(copied), true);
  workspace.restore(state.active); assert.equal(workspace.project(state.active).directory, project.directory);
});

test('trash registry failure rolls back the move and duplicate identities fail closed', t => {
  let reject = false;
  const { workspace } = fixture(t, { write: (file, record) => { if (reject) throw new Error('disk failure'); atomicJson(file, record); } });
  const state = workspace.create('Retained', ''), directory = workspace.project(state.active).directory;
  reject = true; assert.throws(() => workspace.trash(state.active, 'project'));
  assert.equal(workspace.project(state.active).directory, directory);
  const registry = workspace.registry(); registry.projects.push({ ...registry.projects[0] });
  atomicJson(path.join(workspace.root, 'registry.json'), registry);
  assert.throws(() => workspace.view(), blocked('registry-unreadable'));
});

test('credential broker fails closed and never returns saved values or raw exceptions', async t => {
  const { workspace } = fixture(t);
  const key = `synthetic-${crypto.randomUUID()}`;
  const fake = { isAsyncEncryptionAvailable: async () => false, encryptStringAsync: async () => { throw new Error(key); } };
  const credentials = new Credentials(path.join(workspace.root, 'credentials'), fake, 'win32');
  const unconfigured = credentials.revision('apify');
  await assert.rejects(credentials.save('apify', key), blocked('protection-unavailable'));
  assert.equal(fs.existsSync(credentials.root), false);
  fake.isAsyncEncryptionAvailable = async () => true;
  fake.encryptStringAsync = async () => Buffer.from('opaque-protected-test-data');
  const result = await credentials.save('apify', key);
  assert.notEqual(credentials.revision('apify'), unconfigured);
  assert.deepEqual(result, { available: true, providers: { apify: true, openai: false } });
  assert.equal(fs.readFileSync(credentials.file('apify'), 'utf8').includes(key), false);
  const retained = fs.readFileSync(credentials.file('apify'));
  const retainedRevision = credentials.revision('apify');
  fake.encryptStringAsync = async () => { throw new Error(key); };
  await assert.rejects(credentials.save('apify', `replacement-${crypto.randomUUID()}`));
  assert.deepEqual(fs.readFileSync(credentials.file('apify')), retained);
  assert.equal(credentials.revision('apify'), retainedRevision);
  fake.decryptStringAsync = async () => { throw new Error(key); };
  await assert.rejects(credentials.withKey('apify', () => {}), blocked('credential-unreadable'));
  assert.equal(JSON.stringify(diagnostic(new Error(key), 'credential-save')).includes(key), false);
  credentials.remove('apify'); assert.equal((await credentials.status()).providers.apify, false);
  assert.equal(credentials.revision('apify'), unconfigured);
});

test('IPC rejects arbitrary paths, scope injection, IDs, extra fields and foreign actions', () => {
  const id = crypto.randomUUID();
  assert.equal(validWorkspaceRequest({ action: ['list'] }), false);
  assert.equal(validWorkspaceRequest({ action: 'open', id: [id] }), false);
  for (const value of [null, [], { action: 'read', path: 'private' }, { action: 'list', key: 'private' }, { action: 'open', id: '../private' }, { action: 'trash', id, scope: '../' }, { action: 'export', id, scope: 'credentials' }, { action: 'credential-save', provider: '__proto__', key: 'synthetic' }, { action: 'create', name: 'X', url: '', location: '../' }]) assert.equal(validWorkspaceRequest(value), false);
  assert.equal(validWorkspaceRequest({ action: 'open', id }), true);
});

test('native capability expires with its view; cancel does not create/export/trash and operations serialize', async t => {
  const { workspace, root, source } = fixture(t);
  let authorized = true, selections = 0;
  const dialog = { showOpenDialog: async () => { selections++; authorized = false; return { canceled: false, filePaths: [source] }; }, showMessageBox: async () => ({ response: 0 }) };
  const broker = new Broker(workspace, {}, dialog, { window: () => null, authorized: () => authorized, forbidden: [] });
  assert.equal((await broker.handle({ action: 'pick-import' })).code, 'invalid-request');
  assert.equal(workspace.pending, null); assert.equal(selections, 1);
  authorized = true; const state = workspace.create('Safe', '');
  assert.equal((await broker.handle({ action: 'trash', id: state.active, scope: 'project' })).canceled, true);
  assert.equal(workspace.project(state.active).metadata.name, 'Safe');
  const responses = await Promise.all([broker.handle({ action: 'list' }), broker.handle({ action: 'open', id: state.active })]);
  assert.equal(responses.every(result => result.ok), true); assert.equal(JSON.stringify(responses).includes(root), false);
});
