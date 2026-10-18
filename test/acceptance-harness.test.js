import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { launchPackagedApp, packagedExe } from '../desktop/acceptance/launch.mjs';
import { INSTALLER_ACCEPTANCE, INSTALL_SUPPORT, runInstallerAcceptance } from '../desktop/acceptance/install.mjs';
import { runGuidedAcceptance } from '../desktop/acceptance/guided-ui.mjs';
import { checkDebt } from '../desktop/acceptance/cite.mjs';
import { CRITERIA, disposition } from '../desktop/acceptance/registry.mjs';

const repoRoot = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const outputDir = 'C:\\qa';
const exe = 'C:\\repo\\dist\\app\\win-unpacked\\Instagram to OpenDesign.exe';

test('packagedExe points at the unpacked Windows executable', () => {
  assert.equal(packagedExe('C:\\repo'), exe);
  assert.throws(() => packagedExe('repo'), /repoRoot must be an absolute path/);
});

test('launch specs that cannot spawn are rejected before a process starts', async () => {
  await assert.rejects(
    () => launchPackagedApp({ kind: 'installed', exe: 'C:\\Installed\\Instagram to OpenDesign.exe', outputDir }),
    /not implemented/,
  );
  await assert.rejects(
    () => launchPackagedApp({ kind: 'packaged-test', exe, profileDir: 'C:\\profile', outputDir, env: { PATH: 'C:\\Node' } }),
    /unknown fields/,
  );
  await assert.rejects(
    () => launchPackagedApp({
      kind: 'packaged-default', exe, repoRoot: 'C:\\repo', dataRoot: 'C:\\repo\\tmp\\data', outputDir,
    }),
    /dataRoot must be outside repoRoot/,
  );
  await assert.rejects(() => launchPackagedApp({ kind: 'sideways', outputDir }), /unknown launch kind/);
  await assert.rejects(
    () => launchPackagedApp({ kind: 'packaged-test', exe, profileDir: 'profile', outputDir }),
    /profileDir must be an absolute path/,
  );
});

test('guided acceptance refuses a session that is not packaged-test', async () => {
  await assert.rejects(() => runGuidedAcceptance({ spec: { kind: 'packaged-default' } }), /packaged-test/);
});

test('installer spec is refused before anything is written', async t => {
  const root = mkdtempSync(path.join(realpathSync.native(tmpdir()), 'installer-spec-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const name of ['Local', 'Roaming']) mkdirSync(path.join(root, name));
  const env = { LOCALAPPDATA: path.join(root, 'Local'), APPDATA: path.join(root, 'Roaming') };
  const out = path.join(root, 'out');
  const valid = {
    kind: 'installer',
    from: { setupExe: path.join(root, 'old-setup.exe'), version: '0.0.1' },
    to: { setupExe: path.join(root, 'new-setup.exe'), version: '0.1.0' },
    installDir: path.join(root, 'Programs', 'Instagram to OpenDesign'),
    outputDir: out,
  };
  const refused = [
    [{ ...valid, profileDir: root }, /unknown or missing fields/],
    [{ ...valid, from: { ...valid.from, setupExe: 'setup.exe' } }, /from.setupExe must be an absolute path/],
    [{ ...valid, to: { ...valid.to, version: '0.1' } }, /to.version must be a major.minor.patch version/],
    [{ ...valid, to: { ...valid.to, version: '0.0.1' } }, /to.version must be greater than from.version/],
    [{ ...valid, installDir: path.join(env.LOCALAPPDATA, 'Instagram to OpenDesign') }, /installDir must not overlap a data root/],
    [{ ...valid, installDir: env.APPDATA }, /installDir must not overlap a data root/],
    [{ ...valid, outputDir: path.join(env.LOCALAPPDATA, 'Instagram to OpenDesign', 'qa') }, /outputDir must be outside/],
    [{ ...valid, outputDir: path.join(valid.installDir, 'qa') }, /outputDir must be outside/],
  ];
  for (const [spec, pattern] of refused) {
    await assert.rejects(() => runInstallerAcceptance(spec, { env }), pattern);
  }
  await assert.rejects(() => runInstallerAcceptance(valid, { env: { ...env, APPDATA: 'Roaming' } }), /APPDATA must be an absolute path/);
  await assert.rejects(() => runInstallerAcceptance(valid, { env: { ...env, APPDATA: path.join(root, 'missing') } }), /APPDATA must exist/);
  assert.equal(existsSync(out), false);
});

test('installer phases declare an effect on every root and only claim product evidence', () => {
  const names = INSTALLER_ACCEPTANCE.phases.map(phase => phase.name);
  assert.deepEqual(names, [
    'preflight', 'install', 'plant-v1-store', 'seed', 'verify-installed', 'plant-crashed-attempt', 'upgrade',
    'verify-upgraded', 'refuse-newer-store', 'uninstall-keep', 'reinstall', 'verify-reinstalled', 'uninstall-remove',
  ]);
  const byName = Object.fromEntries(INSTALLER_ACCEPTANCE.phases.map(phase => [phase.name, phase]));
  assert.deepEqual(byName['uninstall-keep'].effects, { install: 'removed', local: 'byte-identical', roaming: 'byte-identical' });
  assert.deepEqual(byName['uninstall-remove'].effects, { install: 'removed', local: 'byte-identical', roaming: 'removed' });
  assert.equal(byName['verify-upgraded'].effects.local, 'recovered');
  for (const harnessStep of ['preflight', 'plant-v1-store', 'plant-crashed-attempt', 'reinstall']) {
    assert.equal(byName[harnessStep].evidence, null);
  }
  assert.ok(Object.isFrozen(INSTALL_SUPPORT));
  assert.match(INSTALL_SUPPORT.uninstall, /--delete-app-data removes only the Roaming profile/);
});

test('acceptance criteria derive disposition from proof and manual limits', () => {
  assert.equal(CRITERIA.length, 23);
  assert.equal(CRITERIA.filter(item => item.issue === 51).length, 6);
  assert.equal(CRITERIA.filter(item => item.issue === 52).length, 5);
  assert.equal(CRITERIA.filter(item => item.issue === 57).length, 6);
  assert.equal(CRITERIA.filter(item => item.issue === 58).length, 6);
  assert.equal(disposition(CRITERIA.find(item => item.id === '58.support-matrix')), 'manual');
  assert.equal(disposition(CRITERIA.find(item => item.id === '58.uninstall')), 'partial');
  assert.equal(disposition(CRITERIA.find(item => item.id === '51.clean-install')), 'partial');
  assert.equal(disposition(CRITERIA.find(item => item.id === '52.import-bytes')), 'automated');
  assert.ok(CRITERIA.some(item => item.evidence.includes('guided-keyboard-and-axe')));
  assert.ok(CRITERIA.some(item => item.evidence.includes('Managed workspace resolves outside the repository without the shell-test-data redirect')));
});

test('registry, debt doc, and evidence names agree', async () => {
  assert.deepEqual(await checkDebt(repoRoot), []);
});
