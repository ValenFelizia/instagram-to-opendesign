import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { briefFixture, fixtureDirections } from './helpers/brief.js';
import { compileBrief, importDirections, prepareBrief } from '../src/brief.js';
import { compileExisting } from '../src/pipeline.js';
import { deliver, verifyCatalog } from '../src/delivery.js';
import { localDaemonUrl, openDesignInstallation, workspaceHeaders } from '../src/opendesign.js';

const scope = { workspaceId: 'test-workspace', workspaceMemberId: 'test-member' };

async function desktopFixture() {
  const fixture = await briefFixture('instagram-story');
  fixture.request.selectedDirectionId = 'D-1';
  await writeFile(path.join(fixture.root, 'design-request.json'), JSON.stringify(fixture.request));
  const { context } = await prepareBrief(fixture.root);
  await importDirections(fixture.root, { directions: fixtureDirections(context) });
  const brief = await compileBrief(fixture.root);
  const pkg = await compileExisting(fixture.root, { outputRoot: path.join(fixture.root, 'package'), channel: 'social' });
  const odRoot = path.join(fixture.root, 'desktop');
  for (const dir of ['resources/app/prebundled/daemon', 'resources/open-design']) await mkdir(path.join(odRoot, dir), { recursive: true });
  await writeFile(path.join(odRoot, 'resources/app/package.json'), JSON.stringify({ name: 'open-design-packaged-app', version: '0.24.1', dependencies: { '@open-design/contracts': '0.23.1' } }));
  await writeFile(path.join(odRoot, 'resources/open-design-config.json'), JSON.stringify({ appVersion: '0.24.1',
    daemonSidecarEntryRelative: 'app/prebundled/daemon/daemon-sidecar.mjs', daemonCliEntryRelative: 'app/prebundled/daemon/daemon-cli.mjs' }));
  for (const file of ['daemon-sidecar.mjs', 'daemon-cli.mjs']) await writeFile(path.join(odRoot, 'resources/app/prebundled/daemon', file), '// Synthetic layout marker, never executed.');
  const data = `${fixture.root}-catalog`, otherData = `${fixture.root}-other-catalog`;
  const options = { packageDir: pkg.outputDir, briefDir: brief.outputDir, odRoot, odDataDir: data,
    daemonUrl: 'http://127.0.0.1:7456', ...scope };
  return { ...fixture, brief, pkg, data, otherData, options, async cleanup() {
    for (const root of [fixture.root, data, otherData]) await rm(root, { recursive: true, force: true });
  } };
}

// Models the inspected filesystem/API boundary, including a separate wrong data root.
function daemon(fixture) {
  const state = { calls: [], created: false, creates: 0, deletes: 0, wrongData: false,
    failActiveBody: false, version: '0.24.1', context: scope };
  const root = () => path.join(state.wrongData ? fixture.otherData : fixture.data, 'design-systems', 'example-studio');
  const response = (body, status = 200) => new Response(JSON.stringify(body), { status });
  state.fetchImpl = async (input, init) => {
    assert.equal(init.redirect, 'error');
    assert.equal(init.headers['x-od-workspace-id'], scope.workspaceId);
    assert.equal(init.headers['x-od-workspace-member-id'], scope.workspaceMemberId);
    const url = new URL(input);
    state.calls.push(`${init.method} ${url.pathname}`);
    if (url.pathname === '/api/health') return response({ version: state.version });
    if (url.pathname === '/api/workspace/context') return response({ context: state.context });
    if (url.pathname === '/api/design-systems' && init.method === 'POST') {
      const body = JSON.parse(init.body);
      assert.equal(body.artifactMode, 'agent-managed');
      assert.equal(body.surface, 'image');
      assert.equal(body.status, 'draft');
      await mkdir(root(), { recursive: true });
      await writeFile(path.join(root(), 'DESIGN.md'), body.body);
      await writeFile(path.join(root(), 'metadata.json'), JSON.stringify({ ...scope, status: 'draft', artifactMode: body.artifactMode }));
      state.created = true; state.creates++;
      return response({ designSystem: { id: 'user:example-studio' } }, 201);
    }
    const metadata = state.created ? JSON.parse(await readFile(path.join(root(), 'metadata.json'), 'utf8')) : null;
    if (url.pathname === '/api/design-systems') return response({ designSystems: metadata ? [{ id: 'user:example-studio', status: metadata.status }] : [] });
    if (init.method === 'DELETE') {
      await rm(root(), { recursive: true, force: true }); state.created = false; state.deletes++;
      return response({ deleted: true });
    }
    if (url.pathname.endsWith('/file')) return response({ file: { content: await readFile(path.join(root(), url.searchParams.get('path')), 'utf8') } });
    const changedReceipt = !state.excludeReceipt || await readFile(path.join(root(), 'delivery.json'), 'utf8') !== state.excludeReceipt;
    if (state.changeReservation && metadata.status === 'draft') return response({ designSystem: { body: 'Changed by another actor after creation.' } });
    return response({ designSystem: { body: state.failActiveBody && metadata.status === 'published' && changedReceipt ? 'Inter and reconstructed palette' : await readFile(path.join(root(), 'DESIGN.md'), 'utf8') } });
  };
  return state;
}

test('desktop registration preserves the full reviewed package and carries the selected brief through USAGE.md', async () => {
  const fixture = await desktopFixture();
  try {
    const server = daemon(fixture);
    const options = { ...fixture.options, fetchImpl: server.fetchImpl };
    const installed = await deliver(fixture.root, options);
    assert.equal(server.creates, 1);
    assert.equal(installed.verification.activeContext, 'design-tokens-usage-and-brief-match');
    assert.equal(installed.verification.agentContext, 'not-yet-observed');
    assert.deepEqual(installed.workspace, scope);
    for (const file of ['DESIGN.md', 'tokens.css', 'source/brand-decisions.json', 'source/token-origins.json']) {
      assert.deepEqual(await readFile(path.join(installed.destination, file)), await readFile(path.join(fixture.pkg.outputDir, file)));
    }
    assert.deepEqual(await readFile(path.join(installed.destination, 'handoff/design-brief.json')), await readFile(path.join(fixture.brief.outputDir, 'design-brief.json')));
    assert.match(await readFile(path.join(installed.destination, 'USAGE.md'), 'utf8'), /Execute only D-1/);
    assert.match(await readFile(path.join(installed.destination, 'USAGE.md'), 'utf8'), /provisional/);
    assert.equal(JSON.parse(await readFile(path.join(installed.destination, 'metadata.json'), 'utf8')).surface, 'image');
    assert.ok(server.calls.every((call) => !/import|generation|brand/.test(call)));
    await assert.rejects(() => verifyCatalog(installed.destination, options.daemonUrl, { ...options, workspaceMemberId: 'different' }), /explicit workspace/);
    const file = path.join(installed.destination, fixture.brief.brief.assets[0].path.replace(/^assets\//, 'handoff/assets/'));
    const bytes = await readFile(file);
    await rm(file);
    const calls = server.calls.length;
    await assert.rejects(() => verifyCatalog(installed.destination, options.daemonUrl, options), /missing, changed/);
    assert.equal(server.calls.length, calls);
    await writeFile(file, bytes);
    await writeFile(path.join(installed.destination, 'unexpected.txt'), 'Unreviewed context');
    await assert.rejects(() => verifyCatalog(installed.destination, options.daemonUrl, options), /unexpected/);
  } finally { await fixture.cleanup(); }
});

test('an active-context mismatch rolls replacement back without losing the previous catalog', async () => {
  const fixture = await desktopFixture();
  try {
    const server = daemon(fixture), options = { ...fixture.options, fetchImpl: server.fetchImpl };
    const installed = await deliver(fixture.root, options);
    const before = await readFile(path.join(installed.destination, 'delivery.json'));
    server.failActiveBody = true; server.excludeReceipt = before.toString();
    await assert.rejects(() => deliver(fixture.root, { ...options, replace: true }), /active DESIGN.md differs/);
    assert.deepEqual(await readFile(path.join(installed.destination, 'delivery.json')), before);
    assert.equal(server.creates, 1); assert.equal(server.deletes, 0);
    server.failActiveBody = false;
    assert.equal((await verifyCatalog(installed.destination, options.daemonUrl, options)).integrity, 'all-receipted-files-match');
  } finally { await fixture.cleanup(); }
});

test('a failed new registration verifies and removes only its unchanged draft reservation', async () => {
  for (const failure of ['wrongData', 'failActiveBody']) {
    const fixture = await desktopFixture();
    try {
      const server = daemon(fixture); server[failure] = true;
      await assert.rejects(() => deliver(fixture.root, { ...fixture.options, fetchImpl: server.fetchImpl }), /explicit destination|active DESIGN.md differs/);
      assert.equal(server.deletes, 1); assert.equal(server.created, false);
      await assert.rejects(() => stat(path.join(fixture.data, 'design-systems/example-studio')), /ENOENT/);
    } finally { await fixture.cleanup(); }
  }
});

test('desktop version and workspace gates fail before catalog mutation', async () => {
  const fixture = await desktopFixture();
  try {
    const server = daemon(fixture);
    await assert.rejects(() => deliver(fixture.root, { ...fixture.options, workspaceMemberId: undefined, fetchImpl: server.fetchImpl }), /both explicit|requires an explicit/);
    server.version = '0.24.2';
    await assert.rejects(() => deliver(fixture.root, { ...fixture.options, fetchImpl: server.fetchImpl }), /Daemon version differs/);
    server.version = '0.24.1'; server.context = { ...scope, workspaceId: 'different' };
    await assert.rejects(() => deliver(fixture.root, { ...fixture.options, fetchImpl: server.fetchImpl }), /workspace authority differs/);
    assert.equal(server.creates, 0);
    await writeFile(path.join(fixture.options.odRoot, 'resources/app/package.json'), '{"name":"open-design-packaged-app","version":"0.24.2"}');
    await assert.rejects(() => openDesignInstallation(fixture.options.odRoot), /Unsupported/);
    for (const url of ['https://127.0.0.1:7456', 'http://example.com', 'http://user:password@localhost', 'http://localhost/api', 'http://localhost/?workspace=other']) assert.throws(() => localDaemonUrl(url), /explicit loopback/);
    assert.throws(() => workspaceHeaders({ workspaceId: 'other' }), /both explicit/);
  } finally { await fixture.cleanup(); }
});

test('reservation cleanup refuses a changed resource rather than deleting another actor\'s work', async () => {
  const fixture = await desktopFixture();
  try {
    const server = daemon(fixture);
    server.wrongData = true; server.changeReservation = true;
    await assert.rejects(() => deliver(fixture.root, { ...fixture.options, fetchImpl: server.fetchImpl }), /cleanup could not be verified/);
    assert.equal(server.deletes, 0);
    assert.ok((await stat(path.join(fixture.otherData, 'design-systems/example-studio'))).isDirectory());
  } finally { await fixture.cleanup(); }
});
