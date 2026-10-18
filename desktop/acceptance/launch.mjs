import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

const win = path.win32;
const require = createRequire(import.meta.url);

/** @typedef {'packaged-test' | 'development' | 'packaged-default' | 'installed'} LaunchKind */

/**
 * @typedef {object} PackagedTestSpec
 * @property {'packaged-test'} kind
 * @property {string} exe
 * @property {string} profileDir
 * @property {string} outputDir
 */

/**
 * @typedef {object} DevelopmentSpec
 * @property {'development'} kind
 * @property {string} appRoot
 * @property {string} profileDir
 * @property {string} outputDir
 */

/**
 * @typedef {object} PackagedDefaultSpec
 * @property {'packaged-default'} kind
 * @property {string} exe
 * @property {string} repoRoot
 * @property {string} dataRoot
 * @property {string} outputDir
 */

/**
 * @typedef {object} InstalledSpec
 * @property {'installed'} kind
 * @property {string} exe
 * @property {string} outputDir
 */

/** @typedef {PackagedTestSpec | DevelopmentSpec | PackagedDefaultSpec | InstalledSpec} LaunchSpec */

/**
 * @typedef {object} LaunchSession
 * @property {LaunchSpec} spec
 * @property {string} childPath
 * @property {object} page
 * @property {object} app
 * @property {() => Promise<number>} workerPid
 * @property {(operation: () => Promise<unknown>, expected: (value: unknown) => boolean, timeout?: number) => Promise<unknown>} poll
 * @property {(name: string) => Promise<string>} screenshot
 * @property {(selectedDir: string) => Promise<void>} stubOpenDialog
 * @property {(response?: number) => Promise<void>} stubMessageBox
 * @property {() => Promise<object>} secondInstance
 * @property {() => Promise<void>} close
 */

const LAUNCH_KEYS = {
  'packaged-test': ['kind', 'exe', 'profileDir', 'outputDir'],
  development: ['kind', 'appRoot', 'profileDir', 'outputDir'],
  'packaged-default': ['kind', 'exe', 'repoRoot', 'dataRoot', 'outputDir'],
  installed: ['kind', 'exe', 'outputDir'],
};

const CHILD_ENV_KEYS = ['SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'COMSPEC', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA'];
const SECRET_ENV = /KEY|TOKEN|SECRET|API/i;

function absolute(value, label) {
  if (typeof value !== 'string' || (!win.isAbsolute(value) && !path.isAbsolute(value))) throw new Error(`${label} must be an absolute path`);
  return value;
}

function outsideRepo(repoRoot, dataRoot) {
  const repo = win.resolve(repoRoot);
  const dest = win.resolve(dataRoot);
  const rel = win.relative(repo, dest);
  const structurallyOutside = rel !== '' && (rel.startsWith('..') || win.isAbsolute(rel));
  if (!structurallyOutside) return false;
  const repoKey = repo.toLowerCase();
  const destKey = dest.toLowerCase();
  return destKey !== repoKey && !destKey.startsWith(`${repoKey}\\`);
}

function rejectUnknown(raw, allowed, message) {
  const extra = Object.keys(raw).filter(key => !allowed.includes(key));
  if (extra.length) throw new Error(message);
}

/**
 * @param {unknown} raw
 * @returns {LaunchSpec}
 */
function parseLaunch(raw) {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('launch spec must be an object');
  const kind = /** @type {{ kind?: string }} */ (raw).kind;
  const allowed = LAUNCH_KEYS[/** @type {LaunchKind} */ (kind)];
  if (!allowed) throw new Error('unknown launch kind');
  rejectUnknown(raw, allowed, 'launch spec has unknown fields');
  const spec = /** @type {Record<string, string>} */ (raw);
  const outputDir = absolute(spec.outputDir, 'outputDir');
  if (kind === 'packaged-test') {
    return { kind, exe: absolute(spec.exe, 'exe'), profileDir: absolute(spec.profileDir, 'profileDir'), outputDir };
  }
  if (kind === 'development') {
    return { kind, appRoot: absolute(spec.appRoot, 'appRoot'), profileDir: absolute(spec.profileDir, 'profileDir'), outputDir };
  }
  if (kind === 'packaged-default') {
    const repoRoot = absolute(spec.repoRoot, 'repoRoot');
    const dataRoot = absolute(spec.dataRoot, 'dataRoot');
    if (!outsideRepo(repoRoot, dataRoot)) throw new Error('dataRoot must be outside repoRoot');
    return { kind, exe: absolute(spec.exe, 'exe'), repoRoot, dataRoot, outputDir };
  }
  return { kind: 'installed', exe: absolute(spec.exe, 'exe'), outputDir };
}

/**
 * @param {NodeJS.ProcessEnv} parent
 * @param {LaunchSpec} spec
 */
function childEnv(parent, spec) {
  /** @type {NodeJS.ProcessEnv} */
  const env = {};
  for (const key of CHILD_ENV_KEYS) {
    if (parent[key]) env[key] = parent[key];
  }
  if (!env.SystemRoot) throw new Error('SystemRoot is required');
  env.PATH = win.join(env.SystemRoot, 'System32');
  if (spec.kind === 'packaged-default') env.LOCALAPPDATA = spec.dataRoot;
  return env;
}

/**
 * @param {LaunchSpec} spec
 * @returns {string[]}
 */
function argsFor(spec) {
  if (spec.kind === 'packaged-test' || spec.kind === 'development') {
    return [`--shell-test-data=${spec.profileDir}`, '--shell-test-hidden'];
  }
  if (spec.kind === 'packaged-default') return ['--shell-test-hidden'];
  throw new Error('not implemented');
}

function playwrightElectron() {
  return require(process.env.PLAYWRIGHT_MODULE || 'playwright')._electron;
}

function electronBinary() {
  return require('electron');
}

/**
 * @param {LaunchSpec} spec
 */
function launchTarget(spec) {
  if (spec.kind === 'development') return { executablePath: electronBinary(), args: [spec.appRoot, ...argsFor(spec)] };
  if (spec.kind === 'packaged-test' || spec.kind === 'packaged-default') return { executablePath: spec.exe, args: argsFor(spec) };
  throw new Error('not implemented');
}

/**
 * @param {object} app
 */
async function readChildEnv(app) {
  return app.evaluate(() => Object.fromEntries(Object.keys(process.env).map(key => [key, process.env[key]])));
}

function assertChildEnv(child, expectedPath) {
  if (!child || typeof child !== 'object') throw new Error('child environment was not readable');
  if (String(child.PATH).toLowerCase() !== String(expectedPath).toLowerCase()) {
    throw new Error(`child PATH is ${JSON.stringify(child.PATH)}, expected ${JSON.stringify(expectedPath)}`);
  }
  if (Object.prototype.hasOwnProperty.call(child, 'NODE_OPTIONS')) throw new Error('child environment contains NODE_OPTIONS');
  const secret = Object.keys(child).filter(key => SECRET_ENV.test(key));
  if (secret.length) throw new Error(`child environment contains secret-like names: ${secret.join(', ')}`);
}

/**
 * @param {string} repoRoot
 * @returns {string}
 */
export function packagedExe(repoRoot) {
  absolute(repoRoot, 'repoRoot');
  return win.join(repoRoot, 'dist', 'app', 'win-unpacked', 'Instagram to OpenDesign.exe');
}

/**
 * @param {LaunchSpec} spec
 * @param {object} app
 * @param {object} page
 * @param {NodeJS.ProcessEnv} env
 * @param {string} executablePath
 * @param {string[]} args
 * @param {string} childPath
 * @returns {LaunchSession}
 */
function createSession(spec, app, page, env, executablePath, args, childPath) {
  const state = { page, closed: false };
  return {
    spec,
    childPath,
    get page() { return state.page; },
    app,
    async workerPid() {
      return app.evaluate(({ app: electronApp }) => electronApp.getAppMetrics().find(item => item.name === 'Local shell check')?.pid);
    },
    async poll(operation, expected, timeout = 15000) {
      const end = Date.now() + timeout;
      let result;
      do {
        result = await operation();
        if (expected(result)) return result;
        await new Promise(resolve => setTimeout(resolve, 100));
      } while (Date.now() < end);
      throw new Error(`Condition timed out: ${JSON.stringify(result)}`);
    },
    async screenshot(name) {
      const png = await app.evaluate(async ({ BrowserWindow }) => {
        const image = await BrowserWindow.getAllWindows()[0].webContents.capturePage(undefined, { stayHidden: true });
        return image.toPNG().toString('base64');
      });
      const file = win.join(spec.outputDir, name);
      await writeFile(file, Buffer.from(png, 'base64'));
      return file;
    },
    async stubOpenDialog(selectedDir) {
      await app.evaluate(({ dialog }, selected) => {
        dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [selected] });
      }, selectedDir);
    },
    async stubMessageBox(response = 1) {
      await app.evaluate(({ dialog }, chosen) => {
        dialog.showMessageBox = async () => ({ response: chosen });
      }, response);
    },
    async secondInstance() {
      const next = app.waitForEvent('window');
      const child = spawn(executablePath, args, { env, windowsHide: true, stdio: 'ignore' });
      await new Promise((resolve, reject) => {
        child.once('error', reject);
        child.once('exit', code => (code === 0 ? resolve() : reject(new Error(`Second instance exited ${code}`))));
      });
      state.page = await next;
      await state.page.waitForLoadState();
      return state.page;
    },
    async close() {
      if (state.closed) return;
      state.closed = true;
      await app.close().catch(() => {});
    },
  };
}

/**
 * @param {unknown} raw
 * @returns {Promise<LaunchSession>}
 */
export async function launchPackagedApp(raw) {
  const spec = parseLaunch(raw);
  if (spec.kind === 'installed') throw new Error('not implemented');
  const env = childEnv(process.env, spec);
  const target = launchTarget(spec);
  const electron = playwrightElectron();
  let app;
  try {
    app = await electron.launch({ executablePath: target.executablePath, args: target.args, env, timeout: 30000 });
    const page = await app.firstWindow({ timeout: 30000 });
    const child = await readChildEnv(app);
    assertChildEnv(child, env.PATH);
    return createSession(spec, app, page, env, target.executablePath, target.args, child.PATH);
  } catch (error) {
    if (app) await app.close().catch(() => {});
    throw error;
  }
}
