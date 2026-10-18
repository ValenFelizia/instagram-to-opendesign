import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { productName: PRODUCT } = require('../../desktop/builder.json');
const { Workspace } = require('../../desktop/workspace.cjs');
const { JobStore, digest } = require('../../desktop/jobs.cjs');
const { Credentials } = require('../../desktop/credentials.cjs');

const reverse = text => [...text].reverse().join('');
const storage = {
  isAsyncEncryptionAvailable: async () => true,
  encryptStringAsync: async key => Buffer.from(reverse(key)),
  decryptStringAsync: async encrypted => ({ result: reverse(encrypted.toString()) }),
};

/**
 * @typedef {object} InstallerFaults
 * @property {boolean} [uninstallRemovesLocal]  Default uninstall deletes the Local workspace.
 * @property {boolean} [installerStartsApp]     Setup leaves the app running and writes the profile.
 * @property {boolean} [dispatchOnOpen]         Opening the app starts queued jobs.
 * @property {boolean} [retryUncertain]         Opening the app retries interrupted jobs.
 * @property {boolean} [newerStoreOpens]        A newer job store does not stop startup.
 * @property {boolean} [echoKeyInStatus]        Status returns the saved provider key.
 */

/**
 * Implements the installer Host over temp directories with the real workspace, job store and credential
 * modules. Setup and executable files hold their version as JSON.
 * @param {import('node:test').TestContext} t
 * @param {InstallerFaults} [faults]
 */
export function fakeHost(t, faults = {}) {
  const root = mkdtempSync(path.join(realpathSync.native(tmpdir()), 'installer-host-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const env = { LOCALAPPDATA: path.join(root, 'Local'), APPDATA: path.join(root, 'Roaming'), SystemRoot: path.join(root, 'Windows') };
  for (const directory of [...Object.values(env), path.join(root, 'dist')]) mkdirSync(directory, { recursive: true });
  const setups = { from: path.join(root, 'dist', 'old-setup.exe'), to: path.join(root, 'dist', 'new-setup.exe') };
  writeFileSync(setups.from, JSON.stringify({ version: '0.0.1' }));
  writeFileSync(setups.to, JSON.stringify({ version: '0.1.0' }));
  const installDir = path.join(env.LOCALAPPDATA, 'Programs', PRODUCT);
  const outputDir = path.join(root, 'out');
  const local = path.join(env.LOCALAPPDATA, PRODUCT);
  const roaming = path.join(env.APPDATA, PRODUCT);
  const workspaceRoot = path.join(local, 'workspace');
  let entry = null;
  let running = 0;
  let seenKey = null;

  const touchProfile = () => {
    mkdirSync(roaming, { recursive: true });
    const file = path.join(roaming, 'Local State');
    const launches = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')).launches + 1 : 1;
    writeFileSync(file, JSON.stringify({ launches }));
  };

  const openStore = workspace => new JobStore(path.join(workspaceRoot, 'jobs'), {
    resolveProject: id => workspace.project(id, workspace.registry().projects.find(item => item.id === id)?.status),
    configuration: scope => digest({ provider: scope.provider, model: scope.model, credential: null }),
  });

  const open = async exe => {
    const { version } = JSON.parse(readFileSync(exe, 'utf8'));
    running += 1;
    touchProfile();
    const workspace = new Workspace(workspaceRoot);
    const credentials = new Credentials(path.join(workspaceRoot, 'credentials'), storage, 'win32');
    let store;
    try {
      store = openStore(workspace);
    } catch (error) {
      running -= 1;
      throw error;
    }
    if (faults.dispatchOnOpen) store.db.exec("UPDATE jobs SET state='running' WHERE state='queued'");
    if (faults.retryUncertain) {
      for (const { id } of store.db.prepare("SELECT id FROM jobs WHERE state='interrupted'").all()) store.retryJob(id, store.job(id).hash);
    }
    return {
      version,
      childPath: path.win32.join(env.SystemRoot, 'System32'),
      async createProject(name, url) { return workspace.create(name, url).active; },
      async saveCredential(provider, key) {
        seenKey = key;
        await credentials.save(provider, key);
      },
      async credentialMatches(recordFile, expected) {
        const record = JSON.parse(readFileSync(recordFile, 'utf8'));
        return (await storage.decryptStringAsync(Buffer.from(record.encrypted, 'base64'))).result === expected;
      },
      async planUnconfirmed(projectId) {
        const scope = { taskId: randomUUID(), operation: 'report', provider: 'local', model: 'local', configRevision: digest({ provider: 'local', model: 'local', credential: null }), taskRevision: 1 };
        return store.createJob(projectId, scope).id;
      },
      async status(projectId) {
        const jobs = store.db.prepare('SELECT id FROM jobs WHERE project=? ORDER BY rowid DESC').all(projectId).map(row => store.view(row.id));
        return {
          listed: workspace.view().projects.some(project => project.id === projectId && project.status === 'active'),
          jobs: jobs.map(job => ({ id: job.id, state: job.state, nextAction: faults.echoKeyInStatus ? seenKey : job.nextAction })),
          reopenDispatches: false,
        };
      },
      async exit() {
        store.close();
        running -= 1;
      },
    };
  };

  const host = {
    env,
    async install(setupExe, directory) {
      const { version } = JSON.parse(readFileSync(setupExe, 'utf8'));
      if (entry) rmSync(entry.installLocation, { recursive: true, force: true });
      mkdirSync(path.join(directory, 'resources'), { recursive: true });
      writeFileSync(path.join(directory, `${PRODUCT}.exe`), JSON.stringify({ version }));
      writeFileSync(path.join(directory, 'resources', 'app.asar'), `app ${version}`);
      const uninstaller = path.join(directory, `Uninstall ${PRODUCT}.exe`);
      writeFileSync(uninstaller, 'uninstaller');
      entry = { displayVersion: version, installLocation: directory, quietUninstall: [uninstaller, '/currentuser', '/S'] };
      if (faults.installerStartsApp) {
        running += 1;
        touchProfile();
      }
      return 0;
    },
    async uninstall(current, removeData) {
      rmSync(current.installLocation, { recursive: true, force: true });
      if (removeData) rmSync(roaming, { recursive: true, force: true });
      if (faults.uninstallRemovesLocal) rmSync(local, { recursive: true, force: true });
      entry = null;
      return 0;
    },
    async uninstallEntry() { return entry && { ...entry, quietUninstall: [...entry.quietUninstall] }; },
    async machineWideEntry() { return false; },
    async appProcesses() { return running; },
    open,
    async probe() {
      running += 1;
      touchProfile();
      try {
        if (!faults.newerStoreOpens) openStore(new Workspace(workspaceRoot)).close();
        return { outcome: 'running' };
      } catch (error) {
        return { outcome: 'refused', exitCode: 1, step: 'jobs', code: error.code || error.name };
      } finally {
        running -= 1;
      }
    },
  };

  return {
    host,
    spec: () => ({
      kind: 'installer',
      from: { setupExe: setups.from, version: '0.0.1' },
      to: { setupExe: setups.to, version: '0.1.0' },
      installDir,
      outputDir,
    }),
    report: () => JSON.parse(readFileSync(path.join(outputDir, 'installer-report.json'), 'utf8')),
    reportText: () => readFileSync(path.join(outputDir, 'installer-report.json'), 'utf8'),
    seenKey: () => seenKey,
  };
}
