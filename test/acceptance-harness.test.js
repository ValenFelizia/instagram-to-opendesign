import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { launchPackagedApp, packagedExe } from '../desktop/acceptance/launch.mjs';
import { runInstallerAcceptance } from '../desktop/acceptance/install.mjs';
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

test('installer acceptance validates and stays unwired', async () => {
  await assert.rejects(() => runInstallerAcceptance({
    kind: 'installer', setupExe: 'C:\\dist\\setup.exe', installDir: 'C:\\inst', outputDir, profileDir: 'C:\\profile',
  }), /unknown fields/);
  await assert.rejects(() => runInstallerAcceptance({
    kind: 'installer', setupExe: 'C:\\dist\\setup.exe', installDir: 'C:\\inst', outputDir,
  }), /not implemented/);
  await assert.rejects(() => runInstallerAcceptance({
    kind: 'installer', setupExe: 'setup.exe', installDir: 'C:\\inst', outputDir,
  }), /setupExe must be an absolute path/);
});

test('acceptance criteria derive disposition from proof and manual limits', () => {
  assert.equal(CRITERIA.length, 17);
  assert.equal(CRITERIA.filter(item => item.issue === 51).length, 6);
  assert.equal(CRITERIA.filter(item => item.issue === 52).length, 5);
  assert.equal(CRITERIA.filter(item => item.issue === 57).length, 6);
  assert.equal(disposition(CRITERIA.find(item => item.id === '51.clean-install')), 'partial');
  assert.equal(disposition(CRITERIA.find(item => item.id === '52.import-bytes')), 'automated');
  assert.ok(CRITERIA.some(item => item.evidence.includes('guided-keyboard-and-axe')));
  assert.ok(CRITERIA.some(item => item.evidence.includes('Managed workspace resolves outside the repository without the shell-test-data redirect')));
});

test('registry, debt doc, and evidence names agree', async () => {
  assert.deepEqual(await checkDebt(repoRoot), []);
});
