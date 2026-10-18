import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, existsSync, realpathSync } from 'node:fs';
import { lstat, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchPackagedApp, probeStartup } from './launch.mjs';

const require = createRequire(import.meta.url);
const builder = require('../builder.json');
const { JobStore } = require('../jobs.cjs');
const PRODUCT = builder.productName;
const EXE = `${PRODUCT}.exe`;
const VERSION = /^\d+\.\d+\.\d+$/;
const SPEC_KEYS = ['kind', 'from', 'to', 'installDir', 'outputDir'];
const BUILD_KEYS = ['setupExe', 'version'];
const ROOT_NAMES = /** @type {const} */ (['install', 'local', 'roaming']);
const REPORT_FILE = 'installer-report.json';
const CRASH_CHILD = fileURLToPath(new URL('./crash-attempt.cjs', import.meta.url));
const SETTLE_MS = 10_000;
const SQLITE_FILE = /\.sqlite(-journal|-wal|-shm)?$/;
const WRITER_GUARD = '.writer-guard';
const SUPPORTED_STORE = 2;

const LAYOUT = Object.freeze({
  workspace: 'workspace',
  store: path.join('workspace', 'jobs', 'jobs.sqlite'),
  jobs: path.join('workspace', 'jobs'),
  credentials: path.join('workspace', 'credentials'),
});
const MARKER = Object.freeze({
  file: path.join(LAYOUT.jobs, 'prior-evidence.txt'),
  content: 'Prior evidence planted by the installer acceptance. An upgrade or migration must keep these bytes.\n',
});
const MARKER_HASH = createHash('sha256').update(MARKER.content).digest('hex');
const PLANTED_FAULT = 'installer acceptance rolled back the version 2 migration';
const SEED_PROVIDER = 'apify';
const SEED_PROJECT = Object.freeze({ name: 'Retention fixture', url: 'https://www.instagram.com/example.studio/' });

/**
 * @typedef {object} BuildSpec
 * @property {string} setupExe  NSIS setup produced by `pnpm app:build`.
 * @property {string} version   Version that setup registers and the installed app reports.
 */

/**
 * @typedef {object} InstallerSpec
 * @property {'installer'} kind
 * @property {BuildSpec} from    Build N, installed first.
 * @property {BuildSpec} to      Build N+1. Its version must be greater than from.version.
 * @property {string} installDir NSIS /D= target. The uninstaller removes it recursively, so it must not overlap a data root.
 * @property {string} outputDir  Report directory. Must sit outside every root so the report cannot change a snapshot.
 */

/**
 * Derived from the environment, never taken from the spec.
 * @typedef {object} Roots
 * @property {string} install
 * @property {string} local    %LOCALAPPDATA%\<product>: registry, projects, credentials, job store.
 * @property {string} roaming  %APPDATA%\<product>: Chromium profile and DPAPI key.
 */
/** @typedef {keyof Roots} RootName */

/**
 * @typedef {object} RunPlan
 * @property {{ from: BuildSpec, to: BuildSpec }} builds
 * @property {Roots} roots
 * @property {string} outputDir
 * @property {string} childPath  The only PATH entry the installed app may see.
 */

/**
 * Lower-cased relative path to `dir`, `link`, `other` or the sha256 of the file. Links are never followed.
 * @typedef {ReadonlyMap<string, string>} Inventory
 */

/**
 * @typedef {object} StoreFacts
 * @property {number} userVersion
 * @property {ReadonlyArray<{ id: string, state: string }>} jobs          Sorted by id.
 * @property {ReadonlyArray<{ job: string, state: string }>} attempts     Sorted by job.
 */

/**
 * Captured only while no app process runs.
 * @typedef {object} DataSnapshot
 * @property {Readonly<Record<RootName, Inventory | null>>} roots  null means the root is absent.
 * @property {StoreFacts | null} store
 */

/**
 * @typedef {'absent' | 'created' | 'byte-identical' | 'kept' | 'recovered' | 'present' | 'replaced' | 'removed'} RootEffect
 */
/** @typedef {Readonly<Record<RootName, RootEffect>>} Effects */

/**
 * Current-user uninstall registration.
 * @typedef {object} UninstallEntry
 * @property {string} displayVersion
 * @property {string} installLocation
 * @property {string[]} quietUninstall  argv parsed from QuietUninstallString.
 */

/**
 * One running installed app, driven only through its real preload API.
 * @typedef {object} InstalledApp
 * @property {string} version    app.getVersion()
 * @property {string} childPath  PATH seen by the app process.
 * @property {(name: string, url: string) => Promise<string>} createProject  Returns the project id.
 * @property {(provider: string, key: string) => Promise<void>} saveCredential
 * @property {(recordFile: string, expected: string) => Promise<boolean>} credentialMatches  Only a boolean leaves the app.
 * @property {(projectId: string) => Promise<string>} planUnconfirmed  Guided plan with no consent. Returns the job id.
 * @property {(projectId: string) => Promise<{ listed: boolean, jobs: Array<{ id: string, state: string, nextAction: string }>, reopenDispatches: boolean }>} status
 * @property {() => Promise<void>} exit  Explicit Exit. Resolves when the app process closed.
 */

/**
 * The OS surface the machine touches. windowsHost() is production; tests pass a fake over temp directories.
 * @typedef {object} Host
 * @property {Readonly<Record<string, string | undefined>>} env
 * @property {(setupExe: string, installDir: string) => Promise<number>} install  Silent current-user install.
 * @property {(entry: UninstallEntry, removeData: boolean) => Promise<number>} uninstall  Resolves when the registration is gone.
 * @property {() => Promise<UninstallEntry | null>} uninstallEntry  HKCU only.
 * @property {() => Promise<boolean>} machineWideEntry  Any HKLM registration for the product.
 * @property {() => Promise<number>} appProcesses  Processes whose image is the product exe.
 * @property {(exe: string, outputDir: string) => Promise<InstalledApp>} open
 * @property {(exe: string, outputDir: string) => Promise<import('./launch.mjs').StartupProbe>} probe
 */

/**
 * @typedef {object} RunState
 * @property {RunPlan} plan
 * @property {string} secret  Synthetic provider key. No phase record may contain it.
 * @property {UninstallEntry | null} install
 * @property {{ projectId: string, jobId: string } | null} seed
 * @property {string | null} crashed  Job whose paid attempt was killed after its intent was recorded.
 * @property {DataSnapshot} data  Snapshot after the previous phase.
 */

/**
 * @typedef {object} PhaseRecord
 * @property {string} phase
 * @property {'passed' | 'failed' | 'not-reached'} status
 * @property {string | null} evidence  Set only when passed.
 * @property {Effects} declared
 * @property {Readonly<Record<RootName, { exists: boolean, files: number, digest: string | null }>> | null} observed
 * @property {object | null} facts
 * @property {string[]} violations
 * @property {string | null} error
 * @property {number} ms
 */

/**
 * @typedef {object} InstallerReport
 * @property {'installer-acceptance'} name
 * @property {string} from
 * @property {string} to
 * @property {boolean} passed
 * @property {PhaseRecord[]} phases
 */

const EFFECT_MEANING = Object.freeze({
  absent: 'Does not exist after the step.',
  created: 'Did not exist before the step and exists after it.',
  'byte-identical': 'Every file has the same bytes before and after the step.',
  kept: 'Every file other than the SQLite databases has the same bytes, and the job store version, job states and attempt states are unchanged.',
  recovered: 'As kept, except that running jobs become interrupted and intent attempts become uncertain. No job or attempt is added or acknowledged. The only files that may change are writer locks left by the stopped process, and they must be released.',
  present: 'Exists before and after the step. Contents may change.',
  replaced: 'Exists before and after the step with different bytes.',
  removed: 'Existed before the step and does not exist after it.',
});
const LOCAL_ONLY = new Set(['kept', 'recovered']);

export const INSTALL_SUPPORT = Object.freeze({
  floor: 'Windows 10 and Windows 11, x64 only',
  tested: 'CI installs on GitHub windows-latest, which is Windows Server; Windows 10 and Windows 11 client editions are not exercised',
  installer: 'Assisted NSIS installer with a current-user default (oneClick false, perMachine false)',
  signing: 'Unsigned builds; SmartScreen and Mark-of-the-Web warnings are a known limitation',
  updates: 'Manual updates only; there is no auto-updater and no publish target',
  uninstall: 'Default uninstall keeps the Local workspace and the Roaming profile; --delete-app-data removes only the Roaming profile, and the Local workspace and chosen project folders stay',
  downgrade: `A job store newer than user_version ${SUPPORTED_STORE} is refused with job-version-unsupported; there is no downward migration`,
});

/** @param {RootEffect} install @param {RootEffect} local @param {RootEffect} roaming @returns {Effects} */
function effects(install, local, roaming) {
  return Object.freeze({ install, local, roaming });
}

const PHASES = Object.freeze([
  {
    name: 'preflight',
    effects: effects('absent', 'absent', 'absent'),
    evidence: null,
    note: null,
    timeoutMs: 15_000,
    ...preflightPhase(),
  },
  {
    name: 'install',
    effects: effects('created', 'absent', 'absent'),
    evidence: 'Silent per-user NSIS install registers a current-user uninstaller, starts nothing, writes no user data and ships no update metadata',
    note: null,
    timeoutMs: 180_000,
    ...installerPhase('from'),
  },
  {
    name: 'plant-v1-store',
    effects: effects('byte-identical', 'created', 'absent'),
    evidence: null,
    note: 'The harness opens the job store with a fault that rolls back the version 2 migration, then adds a prior-evidence file. The installed app must finish the migration and keep that file.',
    timeoutMs: 30_000,
    ...plantStorePhase(),
  },
  {
    name: 'seed',
    effects: effects('byte-identical', 'present', 'created'),
    evidence: 'Installed app finishes a rolled-back v1 to v2 job store migration keeping prior evidence, then writes a managed project, a DPAPI-protected credential and an unconfirmed queued job under the real per-user data roots',
    note: null,
    timeoutMs: 90_000,
    ...seedPhase(),
  },
  {
    name: 'verify-installed',
    effects: effects('byte-identical', 'kept', 'present'),
    evidence: 'Installed app relaunch with a System32-only PATH lists the project, decrypts the credential and leaves the queued job undispatched',
    note: null,
    timeoutMs: 90_000,
    ...appCheckPhase('from'),
  },
  {
    name: 'plant-crashed-attempt',
    effects: effects('byte-identical', 'present', 'byte-identical'),
    evidence: null,
    note: 'The harness dispatches a fake paid attempt and kills the process after the intent is recorded. The upgraded app must mark that attempt uncertain and its job interrupted, and must not retry it.',
    timeoutMs: 60_000,
    ...crashedAttemptPhase(),
  },
  {
    name: 'upgrade',
    effects: effects('replaced', 'byte-identical', 'byte-identical'),
    evidence: 'Silent N to N+1 upgrade over a crashed paid attempt replaces the install, starts nothing and leaves the workspace and Chromium profile byte-identical',
    note: null,
    timeoutMs: 180_000,
    ...installerPhase('to'),
  },
  {
    name: 'verify-upgraded',
    effects: effects('byte-identical', 'recovered', 'present'),
    evidence: 'Upgraded app reports N+1, keeps projects, the DPAPI credential and the queued job, and marks the crashed paid attempt uncertain and interrupted without retrying it',
    note: null,
    timeoutMs: 90_000,
    ...appCheckPhase('to'),
  },
  {
    name: 'refuse-newer-store',
    effects: effects('byte-identical', 'kept', 'present'),
    evidence: 'Installed app refuses a job store newer than it supports with job-version-unsupported and changes no workspace byte',
    note: 'The harness stamps the store one version ahead, starts the app, then restores the version. Downgrade across a store version is refused; reinstalling the newer build is the recovery.',
    timeoutMs: 60_000,
    ...refusalPhase(),
  },
  {
    name: 'uninstall-keep',
    effects: effects('removed', 'byte-identical', 'byte-identical'),
    evidence: 'Default silent uninstall removes the install and its registration and leaves the workspace and Chromium profile byte-identical',
    note: null,
    timeoutMs: 120_000,
    ...uninstallPhase(false),
  },
  {
    name: 'reinstall',
    effects: effects('created', 'byte-identical', 'byte-identical'),
    evidence: null,
    note: null,
    timeoutMs: 180_000,
    ...installerPhase('to'),
  },
  {
    name: 'verify-reinstalled',
    effects: effects('byte-identical', 'kept', 'present'),
    evidence: 'Reinstall over retained data reopens the same project, credential, queued job and uncertain attempt without a reset or retry',
    note: null,
    timeoutMs: 90_000,
    ...appCheckPhase('to'),
  },
  {
    name: 'uninstall-remove',
    effects: effects('removed', 'byte-identical', 'removed'),
    evidence: 'Uninstall with --delete-app-data removes only the Chromium profile and leaves the workspace byte-identical',
    note: 'Saved provider keys are encrypted with a key held in the Roaming profile. After this removal the encrypted files stay in the workspace but may no longer decrypt.',
    timeoutMs: 120_000,
    ...uninstallPhase(true),
  },
]);

function assertPhases(phases) {
  const names = new Set();
  const evidence = new Set();
  for (const phase of phases) {
    if (names.has(phase.name)) throw new Error(`duplicate phase ${phase.name}`);
    names.add(phase.name);
    if (phase.evidence !== null) {
      if (evidence.has(phase.evidence)) throw new Error(`${phase.name} repeats evidence`);
      evidence.add(phase.evidence);
    }
    for (const text of [phase.evidence, phase.note]) {
      if (text !== null && (typeof text !== 'string' || !text || text.includes('|'))) throw new Error(`${phase.name} has an empty or piped description`);
    }
    if (Object.keys(phase.effects).join() !== ROOT_NAMES.join()) throw new Error(`${phase.name} must declare install, local and roaming`);
    for (const root of ROOT_NAMES) {
      const effect = phase.effects[root];
      if (!Object.hasOwn(EFFECT_MEANING, effect)) throw new Error(`${phase.name} has unknown effect ${effect}`);
      if (LOCAL_ONLY.has(effect) && root !== 'local') throw new Error(`${phase.name} declares ${effect} outside the local root`);
    }
  }
  if (!['removed', 'absent'].includes(phases.at(-1).effects.install)) throw new Error('the last phase must leave no install');
}

assertPhases(PHASES);

export const INSTALLER_EVIDENCE = Object.freeze(Object.fromEntries(
  PHASES.filter(phase => phase.evidence).map(phase => [phase.name, phase.evidence]),
));

export const INSTALLER_ACCEPTANCE = Object.freeze({
  phases: Object.freeze(PHASES.map(({ name, effects: declared, evidence, note }) => Object.freeze({ name, effects: declared, evidence, note }))),
  effects: EFFECT_MEANING,
});

/**
 * Runs every phase once against real installers and the current Windows user profile. Refuses a profile
 * that already has product data, an app process or a registration. It never deletes data it did not
 * create and never cleans up after a failure.
 *
 * The report is rewritten after every phase. A failure rejects naming the phase after the report holds it.
 * @param {unknown} raw  InstallerSpec. Validated before any side effect.
 * @param {Host} [host]
 * @returns {Promise<InstallerReport>}
 */
export async function runInstallerAcceptance(raw, host = windowsHost()) {
  const plan = parseInstallerSpec(raw, host.env);
  const ledger = PHASES.map(notReached);
  await writeReport(plan, ledger, false);
  /** @type {RunState} */
  let state = { plan, secret: `synthetic-${randomUUID()}`, install: null, seed: null, crashed: null, data: await snapshot(plan.roots) };
  for (const [index, phase] of PHASES.entries()) {
    const started = Date.now();
    let facts = null;
    let changes = {};
    let after = null;
    let error = null;
    const violations = [];
    try {
      ({ facts, changes = {} } = await withTimeout(phase.act(state, host), phase.timeoutMs, phase.name));
      violations.push(...await noAppProcess(host));
      after = await snapshot(plan.roots);
      violations.push(...phase.expect(facts, state, after));
      violations.push(...checkEffects(state.data, after, phase.effects));
    } catch (thrown) {
      error = thrown instanceof Error ? thrown.message : String(thrown);
    }
    ledger[index] = redact(record(phase, { facts, violations, error, after, ms: Date.now() - started }), state.secret);
    await writeReport(plan, ledger, false);
    if (ledger[index].status === 'failed') {
      throw new Error(`installer acceptance failed at ${phase.name}: ${ledger[index].error ?? ledger[index].violations[0]}`);
    }
    state = { ...state, ...changes, data: /** @type {DataSnapshot} */ (after) };
  }
  return writeReport(plan, ledger, true);
}

function isRecord(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(raw, allowed, message) {
  const keys = Object.keys(raw);
  if (keys.length !== allowed.length || !allowed.every(key => keys.includes(key))) throw new Error(message);
}

function absolute(value, label) {
  if (typeof value !== 'string' || !path.isAbsolute(value)) throw new Error(`${label} must be an absolute path`);
  return path.resolve(value);
}

function parseVersion(value, label) {
  if (typeof value !== 'string' || !VERSION.test(value)) throw new Error(`${label} must be a major.minor.patch version`);
  return value.split('.').map(Number);
}

function compareVersions(left, right) {
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
}

function parseBuild(raw, label) {
  if (!isRecord(raw)) throw new Error(`${label} must be an object`);
  exactKeys(raw, BUILD_KEYS, `${label} has unknown or missing fields`);
  parseVersion(raw.version, `${label}.version`);
  return Object.freeze({ setupExe: absolute(raw.setupExe, `${label}.setupExe`), version: raw.version });
}

/** Case-insensitive, because NTFS is. */
function within(parent, child) {
  const relative = path.relative(parent.toLowerCase(), child.toLowerCase());
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function overlaps(left, right) {
  return within(left, right) || within(right, left);
}

/**
 * An 8.3 alias or a linked folder fails the app's own path guards, so the harness refuses it instead of resolving it.
 * @param {string | undefined} value
 * @param {string} name
 */
function longRoot(value, name) {
  if (typeof value !== 'string' || !path.isAbsolute(value)) throw new Error(`${name} must be an absolute path`);
  let real;
  try { real = realpathSync.native(value); } catch { throw new Error(`${name} must exist`); }
  if (real.toLowerCase() !== path.resolve(value).toLowerCase()) throw new Error(`${name} must be a long path without links`);
  return path.resolve(value);
}

/**
 * @param {string} installDir
 * @param {Readonly<Record<string, string | undefined>>} env
 * @returns {Roots}
 */
function resolveRoots(installDir, env) {
  return Object.freeze({
    install: installDir,
    local: path.join(longRoot(env.LOCALAPPDATA, 'LOCALAPPDATA'), PRODUCT),
    roaming: path.join(longRoot(env.APPDATA, 'APPDATA'), PRODUCT),
  });
}

/**
 * @param {unknown} raw
 * @param {Readonly<Record<string, string | undefined>>} env
 * @returns {RunPlan}
 */
function parseInstallerSpec(raw, env) {
  if (!isRecord(raw)) throw new Error('installer spec must be an object');
  if (raw.kind !== 'installer') throw new Error('unknown installer kind');
  exactKeys(raw, SPEC_KEYS, 'installer spec has unknown or missing fields');
  const from = parseBuild(raw.from, 'from');
  const to = parseBuild(raw.to, 'to');
  if (compareVersions(parseVersion(to.version, 'to.version'), parseVersion(from.version, 'from.version')) <= 0) {
    throw new Error('to.version must be greater than from.version');
  }
  const installDir = absolute(raw.installDir, 'installDir');
  const outputDir = absolute(raw.outputDir, 'outputDir');
  const roots = resolveRoots(installDir, env);
  if (overlaps(installDir, roots.local) || overlaps(installDir, roots.roaming)) throw new Error('installDir must not overlap a data root');
  if (ROOT_NAMES.some(name => within(roots[name], outputDir))) throw new Error('outputDir must be outside the install and data roots');
  if (!env.SystemRoot) throw new Error('SystemRoot is required');
  return Object.freeze({ builds: Object.freeze({ from, to }), roots, outputDir, childPath: path.win32.join(env.SystemRoot, 'System32') });
}

function hashFile(file) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    createReadStream(file)
      .on('error', reject)
      .on('data', chunk => hash.update(chunk))
      .on('end', () => resolve(hash.digest('hex')));
  });
}

/**
 * @param {string} root
 * @returns {Promise<Inventory | null>}
 */
async function inventory(root) {
  try {
    if (!(await lstat(root)).isDirectory()) return new Map([['', 'other']]);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
  const entries = new Map();
  const walk = async (directory, relative) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      const key = path.join(relative, entry.name);
      if (entry.isSymbolicLink()) entries.set(key.toLowerCase(), 'link');
      else if (entry.isDirectory()) {
        entries.set(key.toLowerCase(), 'dir');
        await walk(full, key);
      } else if (entry.isFile()) entries.set(key.toLowerCase(), await hashFile(full));
      else entries.set(key.toLowerCase(), 'other');
    }
  };
  await walk(root, '');
  return entries;
}

/**
 * @param {Roots} roots
 * @returns {StoreFacts | null}
 */
function readStore(roots) {
  const file = path.join(roots.local, LAYOUT.store);
  if (!existsSync(file)) return null;
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    const userVersion = Number(db.prepare('PRAGMA user_version').get().user_version);
    const tables = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row => row.name));
    const jobs = tables.has('jobs') ? db.prepare('SELECT id, state FROM jobs ORDER BY id').all().map(({ id, state }) => ({ id, state })) : [];
    const attempts = tables.has('attempts') ? db.prepare('SELECT job, state FROM attempts ORDER BY job').all().map(({ job, state }) => ({ job, state })) : [];
    return { userVersion, jobs, attempts };
  } finally {
    db.close();
  }
}

/**
 * @param {Roots} roots
 * @param {number} userVersion
 */
function stampStore(roots, userVersion) {
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(path.join(roots.local, LAYOUT.store));
  try { db.exec(`PRAGMA user_version=${userVersion}`); } finally { db.close(); }
}

/**
 * @param {Roots} roots
 * @returns {Promise<DataSnapshot>}
 */
async function snapshot(roots) {
  const [install, local, roaming] = await Promise.all(ROOT_NAMES.map(name => inventory(roots[name])));
  return { roots: { install, local, roaming }, store: local ? readStore(roots) : null };
}

/**
 * @param {Inventory} before
 * @param {Inventory} after
 * @param {(key: string) => boolean} [ignored]
 */
function differences(before, after, ignored = () => false) {
  const found = [];
  for (const [key, value] of before) {
    if (ignored(key)) continue;
    if (!after.has(key)) found.push(`removed ${key}`);
    else if (after.get(key) !== value) found.push(`changed ${key}`);
  }
  for (const key of after.keys()) {
    if (!ignored(key) && !before.has(key)) found.push(`added ${key}`);
  }
  return found;
}

function isSqlite(key) {
  return SQLITE_FILE.test(path.basename(key));
}

function isWriterGuard(key) {
  return key.split(path.sep).includes(WRITER_GUARD);
}

/** @param {StoreFacts | null} store */
function recoveredStore(store) {
  if (!store) return null;
  return {
    userVersion: store.userVersion,
    jobs: store.jobs.map(job => (job.state === 'running' ? { ...job, state: 'interrupted' } : job)),
    attempts: store.attempts.map(attempt => (attempt.state === 'intent' ? { ...attempt, state: 'uncertain' } : attempt)),
  };
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function listed(root, effect, found) {
  const shown = found.slice(0, 5).join(', ');
  return `${root} expected ${effect}: ${shown}${found.length > 5 ? `, and ${found.length - 5} more` : ''}`;
}

/**
 * @param {DataSnapshot} before
 * @param {DataSnapshot} after
 * @param {Effects} declared
 * @returns {string[]}
 */
function checkEffects(before, after, declared) {
  const violations = [];
  for (const root of ROOT_NAMES) {
    const effect = declared[root];
    const was = before.roots[root];
    const now = after.roots[root];
    const missing = [was ? null : 'absent before the step', now ? null : 'absent after the step'].filter(Boolean);
    if (effect === 'absent') {
      if (now) violations.push(`${root} expected absent: exists after the step`);
    } else if (effect === 'created') {
      if (was || !now) violations.push(`${root} expected created: ${was ? 'existed before the step' : 'absent after the step'}`);
    } else if (effect === 'removed') {
      if (!was || now) violations.push(`${root} expected removed: ${was ? 'exists after the step' : 'absent before the step'}`);
    } else if (!was || !now) {
      violations.push(`${root} expected ${effect}: ${missing.join(' and ')}`);
    } else if (effect === 'byte-identical') {
      const found = differences(was, now);
      if (found.length) violations.push(listed(root, effect, found));
    } else if (effect === 'replaced') {
      if (!differences(was, now).length) violations.push(`${root} expected replaced: every file is unchanged`);
    } else if (effect === 'kept') {
      const found = differences(was, now, isSqlite);
      if (!sameJson(before.store, after.store)) found.unshift('job store version, job states or attempt states changed');
      if (found.length) violations.push(listed(root, effect, found));
    } else if (effect === 'recovered') {
      const found = differences(was, now, key => isSqlite(key) || (isWriterGuard(key) && !now.has(key)));
      for (const key of now.keys()) if (isWriterGuard(key)) found.push(`writer lock not released ${key}`);
      if (!sameJson(recoveredStore(before.store), after.store)) found.unshift('job store does not match the recovery of the previous store');
      if (found.length) violations.push(listed(root, effect, found));
    }
  }
  return violations;
}

/** Exit can resolve before Chromium helpers end, so the count gets a bounded time to reach zero. */
async function noAppProcess(host) {
  const deadline = Date.now() + SETTLE_MS;
  let count = await host.appProcesses();
  while (count > 0 && Date.now() < deadline) {
    await new Promise(resolve => { setTimeout(resolve, 250); });
    count = await host.appProcesses();
  }
  return count > 0 ? [`${count} app process${count === 1 ? '' : 'es'} still running after the step`] : [];
}

function withTimeout(promise, ms, name) {
  let timer;
  const expired = new Promise((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(`${name} did not finish within ${ms} ms`)), ms);
  });
  return Promise.race([promise, expired]).finally(() => clearTimeout(timer));
}

/** @param {Inventory | null} entries */
function summarize(entries) {
  if (!entries) return { exists: false, files: 0, digest: null };
  const lines = [...entries].sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0)).map(([key, value]) => `${key}\0${value}\n`);
  const files = [...entries.values()].filter(value => value !== 'dir').length;
  return { exists: true, files, digest: createHash('sha256').update(lines.join('')).digest('hex') };
}

function notReached(phase) {
  return { phase: phase.name, status: 'not-reached', evidence: null, declared: phase.effects, observed: null, facts: null, violations: [], error: null, ms: 0 };
}

/** @returns {PhaseRecord} */
function record(phase, { facts, violations, error, after, ms }) {
  const failed = error !== null || violations.length > 0;
  return {
    phase: phase.name,
    status: failed ? 'failed' : 'passed',
    evidence: failed ? null : phase.evidence,
    declared: phase.effects,
    observed: after && Object.fromEntries(ROOT_NAMES.map(root => [root, summarize(after.roots[root])])),
    facts,
    violations,
    error,
    ms,
  };
}

/**
 * @param {PhaseRecord} entry
 * @param {string} secret
 * @returns {PhaseRecord}
 */
function redact(entry, secret) {
  if (!JSON.stringify(entry).includes(secret)) return entry;
  return {
    ...entry,
    status: 'failed',
    evidence: null,
    facts: null,
    violations: ['the synthetic provider key appeared in this phase record'],
    error: null,
  };
}

/**
 * @param {RunPlan} plan
 * @param {PhaseRecord[]} ledger
 * @param {boolean} passed
 * @returns {Promise<InstallerReport>}
 */
async function writeReport(plan, ledger, passed) {
  /** @type {InstallerReport} */
  const report = { name: 'installer-acceptance', from: plan.builds.from.version, to: plan.builds.to.version, passed, phases: ledger };
  await mkdir(plan.outputDir, { recursive: true });
  const file = path.join(plan.outputDir, REPORT_FILE);
  const temporary = `${file}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(report, null, 2)}\n`);
  await rename(temporary, file);
  return report;
}

function exePath(plan) {
  return path.join(plan.roots.install, EXE);
}

function sameLocation(left, right) {
  return typeof left === 'string' && path.resolve(left).toLowerCase() === path.resolve(right).toLowerCase();
}

function preflightPhase() {
  return {
    async act(state, host) {
      const { plan, data } = state;
      return {
        facts: {
          existingRoots: ROOT_NAMES.filter(name => data.roots[name] !== null),
          registered: (await host.uninstallEntry()) !== null,
          machineWide: await host.machineWideEntry(),
          appProcesses: await host.appProcesses(),
          setupsPresent: [plan.builds.from.setupExe, plan.builds.to.setupExe].every(file => existsSync(file)),
        },
      };
    },
    expect(facts) {
      const problems = [];
      if (facts.existingRoots.length) {
        problems.push(`Installer acceptance needs a Windows user profile with no product data. Found: ${facts.existingRoots.join(', ')}. Use a fresh runner or a disposable user; the harness never deletes data it did not create.`);
      }
      if (facts.registered || facts.machineWide) problems.push('the product is already registered for uninstall');
      if (facts.appProcesses > 0) problems.push('an app process is already running');
      if (!facts.setupsPresent) problems.push('a setup file is missing');
      return problems;
    },
  };
}

/** @param {'from' | 'to'} build */
function installerPhase(build) {
  return {
    async act(state, host) {
      const { plan } = state;
      const exitCode = await host.install(plan.builds[build].setupExe, plan.roots.install);
      const entry = await host.uninstallEntry();
      return {
        facts: {
          exitCode,
          registeredVersion: entry?.displayVersion ?? null,
          installLocation: entry?.installLocation ?? null,
          machineWide: await host.machineWideEntry(),
          exePresent: existsSync(exePath(plan)),
          updateMetadata: existsSync(path.join(plan.roots.install, 'resources', 'app-update.yml')),
        },
        changes: { install: entry },
      };
    },
    expect(facts, state) {
      const { plan } = state;
      const problems = [];
      if (facts.exitCode !== 0) problems.push(`setup exited ${facts.exitCode}`);
      if (facts.registeredVersion !== plan.builds[build].version) problems.push(`registered version is ${facts.registeredVersion}, expected ${plan.builds[build].version}`);
      if (!sameLocation(facts.installLocation, plan.roots.install)) problems.push('the uninstaller is not registered in the install directory');
      if (facts.machineWide) problems.push('setup registered a machine-wide uninstaller');
      if (!facts.exePresent) problems.push('the app executable is missing from the install directory');
      if (facts.updateMetadata) problems.push('the install ships auto-update metadata');
      return problems;
    },
  };
}

function plantStorePhase() {
  return {
    async act(state) {
      const { roots } = state.plan;
      const jobsRoot = path.join(roots.local, LAYOUT.jobs);
      let planted = false;
      try {
        new JobStore(jobsRoot, { fault: name => { if (name === 'pipeline-migration-before-commit') throw new Error(PLANTED_FAULT); } }).close();
      } catch (error) {
        if (error.message !== PLANTED_FAULT) throw error;
        planted = true;
      }
      if (!planted) throw new Error('the planted migration fault did not fire');
      await writeFile(path.join(roots.local, MARKER.file), MARKER.content, { flag: 'wx' });
      return { facts: { userVersion: readStore(roots)?.userVersion ?? null } };
    },
    expect(facts, state, after) {
      const problems = [];
      if (after.store?.userVersion !== 1) problems.push(`planted job store is at user_version ${after.store?.userVersion}, expected 1`);
      if (after.roots.local?.get(MARKER.file.toLowerCase()) !== MARKER_HASH) problems.push('prior evidence file was not planted');
      return problems;
    },
  };
}

function credentialFile(plan) {
  return path.join(plan.roots.local, LAYOUT.credentials, `${SEED_PROVIDER}.json`);
}

/**
 * @param {InstalledApp} app
 * @param {RunState} state
 * @param {string} projectId
 */
async function appFacts(app, state, projectId) {
  const status = await app.status(projectId);
  return {
    appVersion: app.version,
    childPath: app.childPath,
    projectListed: status.listed,
    credentialMatches: await app.credentialMatches(credentialFile(state.plan), state.secret),
    jobs: status.jobs.map(({ id, state: jobState, nextAction }) => ({ id, state: jobState, nextAction })),
    reopenDispatches: status.reopenDispatches,
  };
}

function appProblems(facts, state, version, seedJobId) {
  const problems = [];
  if (facts.appVersion !== version) problems.push(`app reports ${facts.appVersion}, expected ${version}`);
  if (String(facts.childPath).toLowerCase() !== state.plan.childPath.toLowerCase()) problems.push('app PATH is not System32 only');
  if (!facts.projectListed) problems.push('the seeded project is not listed');
  if (!facts.credentialMatches) problems.push('the saved credential does not decrypt to the seeded key');
  if (facts.reopenDispatches !== false) problems.push('status reports that reopening dispatches work');
  const queued = facts.jobs.find(job => job.id === seedJobId);
  if (queued?.state !== 'queued') problems.push(`the seeded job is ${queued?.state ?? 'missing'}, expected queued`);
  if (state.crashed) {
    const crashed = facts.jobs.find(job => job.id === state.crashed);
    if (crashed?.state !== 'interrupted' || crashed.nextAction !== 'reconcile-attempt') {
      problems.push(`the crashed job is ${crashed?.state ?? 'missing'} with ${crashed?.nextAction ?? 'no action'}, expected interrupted with reconcile-attempt`);
    }
  }
  for (const job of facts.jobs) if (job.state === 'running') problems.push(`job ${job.id} is running after reopen`);
  return problems;
}

function seedPhase() {
  return {
    async act(state, host) {
      const app = await host.open(exePath(state.plan), state.plan.outputDir);
      try {
        const projectId = await app.createProject(SEED_PROJECT.name, SEED_PROJECT.url);
        await app.saveCredential(SEED_PROVIDER, state.secret);
        const jobId = await app.planUnconfirmed(projectId);
        return { facts: { projectId, jobId, ...await appFacts(app, state, projectId) }, changes: { seed: { projectId, jobId } } };
      } finally {
        await app.exit();
      }
    },
    expect(facts, state, after) {
      const problems = appProblems(facts, state, state.plan.builds.from.version, facts.jobId);
      if (after.store?.userVersion !== SUPPORTED_STORE) problems.push(`job store is at user_version ${after.store?.userVersion}, expected ${SUPPORTED_STORE}`);
      if (after.roots.local?.get(MARKER.file.toLowerCase()) !== MARKER_HASH) problems.push('the migration changed or removed the prior evidence file');
      return problems;
    },
  };
}

/** @param {'from' | 'to'} build */
function appCheckPhase(build) {
  return {
    async act(state, host) {
      if (!state.install || !state.seed) throw new Error('no install or seed to verify');
      const app = await host.open(exePath(state.plan), state.plan.outputDir);
      try {
        return { facts: await appFacts(app, state, state.seed.projectId) };
      } finally {
        await app.exit();
      }
    },
    expect(facts, state) {
      return appProblems(facts, state, state.plan.builds[build].version, state.seed?.jobId);
    },
  };
}

async function waitForCheckpoint(file, exited) {
  for (;;) {
    if (existsSync(file)) return JSON.parse(await readFile(file, 'utf8'));
    const code = await Promise.race([exited, new Promise(resolve => { setTimeout(() => resolve(undefined), 50); })]);
    if (code !== undefined) throw new Error(`crash child exited ${code} before recording an intent`);
  }
}

function crashedAttemptPhase() {
  return {
    async act(state) {
      if (!state.seed) throw new Error('no seeded project for the crashed attempt');
      const checkpoint = path.join(state.plan.outputDir, 'crash-attempt.json');
      await rm(checkpoint, { force: true });
      const workspace = path.join(state.plan.roots.local, LAYOUT.workspace);
      const child = spawn(process.execPath, [CRASH_CHILD, workspace, state.seed.projectId, checkpoint], { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
      let stderr = '';
      child.stderr.setEncoding('utf8');
      child.stderr.on('data', chunk => { if (stderr.length < 4096) stderr += chunk; });
      const exited = new Promise(resolve => { child.once('exit', code => resolve(code)); child.once('error', () => resolve(-1)); });
      try {
        const { jobId } = await waitForCheckpoint(checkpoint, exited);
        return { facts: { jobId }, changes: { crashed: jobId } };
      } catch (error) {
        throw new Error(`${error.message}${stderr ? `: ${stderr.trim().split('\n').at(-1)}` : ''}`);
      } finally {
        child.kill('SIGKILL');
        await exited;
      }
    },
    expect(facts, state, after) {
      const job = after.store?.jobs.find(item => item.id === facts.jobId);
      const attempt = after.store?.attempts.find(item => item.job === facts.jobId);
      if (job?.state === 'running' && attempt?.state === 'intent') return [];
      return [`the crashed attempt left job ${job?.state ?? 'missing'} and attempt ${attempt?.state ?? 'missing'}, expected running and intent`];
    },
  };
}

function refusalPhase() {
  return {
    async act(state, host) {
      const { plan, data } = state;
      if (!data.store) throw new Error('no job store to stamp');
      const original = data.store.userVersion;
      stampStore(plan.roots, original + 1);
      try {
        const stamped = await snapshot(plan.roots);
        const probe = await host.probe(exePath(plan), plan.outputDir);
        const changedDuringRefusal = [
          ...await noAppProcess(host),
          ...checkEffects(stamped, await snapshot(plan.roots), effects('byte-identical', 'byte-identical', 'present')),
        ];
        return { facts: { stampedVersion: original + 1, probe, changedDuringRefusal } };
      } finally {
        stampStore(plan.roots, original);
      }
    },
    expect(facts) {
      const problems = [];
      const { probe } = facts;
      if (probe.outcome !== 'refused') problems.push(`app start was ${probe.outcome} with a newer job store, expected refused`);
      else if (probe.step !== 'jobs' || probe.code !== 'job-version-unsupported' || probe.exitCode === 0) {
        problems.push(`app refused at ${probe.step} with ${probe.code} and exit ${probe.exitCode}, expected jobs with job-version-unsupported`);
      }
      problems.push(...facts.changedDuringRefusal.map(problem => `during the refused start: ${problem}`));
      return problems;
    },
  };
}

/** @param {boolean} removeData */
function uninstallPhase(removeData) {
  return {
    async act(state, host) {
      if (!state.install) throw new Error('nothing is installed');
      const exitCode = await host.uninstall(state.install, removeData);
      return {
        facts: { exitCode, removeData, registered: (await host.uninstallEntry()) !== null, exePresent: existsSync(exePath(state.plan)) },
        changes: { install: null },
      };
    },
    expect(facts) {
      const problems = [];
      if (facts.exitCode !== 0) problems.push(`uninstaller exited ${facts.exitCode}`);
      if (facts.registered) problems.push('the uninstall registration remains');
      if (facts.exePresent) problems.push('the app executable remains');
      return problems;
    },
  };
}

const UNINSTALL_KEYS = Object.freeze({
  user: ['HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall'],
  machine: ['HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall', 'HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall'],
});
const GUIDED_OPTIONS = Object.freeze({ includeReport: true, includePackage: false, includeExport: false, language: 'es', refresh: false, reanalyze: false, postLimit: 20 });
const QUIET_MS = 3000;

function delay(ms) {
  return new Promise(resolve => { setTimeout(resolve, ms); });
}

function capture(file, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], ...options });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', chunk => { stdout += chunk; });
    child.stderr.setEncoding('utf8').on('data', chunk => { stderr += chunk; });
    child.once('error', reject);
    child.once('close', code => resolve({ code: code ?? -1, stdout, stderr }));
  });
}

function exited(file, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, { windowsHide: true, stdio: 'ignore', ...options });
    child.once('error', reject);
    child.once('exit', code => resolve(code ?? -1));
  });
}

/** @param {NodeJS.ProcessEnv} env @param {string[]} keys */
async function registrations(env, keys) {
  const script = [
    "$ErrorActionPreference = 'Stop'",
    `$name = '${PRODUCT.replaceAll("'", "''")}'`,
    `$found = @(foreach ($key in @(${keys.map(key => `'${key}'`).join(', ')})) { if (Test-Path $key) {`,
    '  Get-ChildItem -Path $key | Get-ItemProperty -ErrorAction SilentlyContinue |',
    '    Where-Object { $_.DisplayName -eq $name -or $_.DisplayName -like "$name *" } |',
    '    Select-Object DisplayName, DisplayVersion, QuietUninstallString',
    '} })',
    'ConvertTo-Json -InputObject $found -Compress',
  ].join('\n');
  const powershell = path.win32.join(env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  const encoded = Buffer.from(script, 'utf16le').toString('base64');
  const { code, stdout, stderr } = await capture(powershell, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded]);
  if (code !== 0) throw new Error(`uninstall registry query exited ${code}: ${stderr.trim().split('\n').at(-1)}`);
  const parsed = JSON.parse(stdout.trim() || '[]');
  return Array.isArray(parsed) ? parsed : [parsed];
}

/** @param {unknown} command */
function parseCommand(command) {
  if (typeof command !== 'string' || !command.trim()) throw new Error('the uninstall registration has no QuietUninstallString');
  const quoted = command.match(/^\s*"([^"]+)"(.*)$/);
  const [file, rest] = quoted ? [quoted[1], quoted[2]] : [command.trim().split(/\s+/)[0], command.trim().split(/\s+/).slice(1).join(' ')];
  return [file, ...rest.split(/\s+/).filter(Boolean)];
}

/**
 * @param {import('./launch.mjs').LaunchSession} session
 * @param {string} version
 * @returns {InstalledApp}
 */
function installedApp(session, version) {
  const call = async (action, operation, argument) => {
    const result = await session.page.evaluate(operation, argument);
    if (!result?.ok) throw new Error(`${action} failed: ${result?.code ?? 'no response'}`);
    return result;
  };
  return {
    version,
    childPath: session.childPath,
    async createProject(name, url) {
      const result = await call('create', ([projectName, projectUrl]) => window.localWorkspace.create(projectName, projectUrl, 'default'), [name, url]);
      return result.workspace.active;
    },
    async saveCredential(provider, key) {
      await call('credential-save', ([name, value]) => window.localWorkspace.saveCredential(name, value), [provider, key]);
    },
    async credentialMatches(recordFile, expected) {
      const saved = JSON.parse(await readFile(recordFile, 'utf8'));
      if (saved?.version !== 1 || typeof saved.encrypted !== 'string') return false;
      return session.app.evaluate(async ({ safeStorage }, value) => {
        try {
          return (await safeStorage.decryptStringAsync(Buffer.from(value.encrypted, 'base64'))).result === value.expected;
        } catch {
          return false;
        }
      }, { encrypted: saved.encrypted, expected });
    },
    async planUnconfirmed(projectId) {
      const result = await call('plan', ([id, taskId, options]) => window.guidedWork.plan(id, taskId, 1, options), [projectId, randomUUID(), GUIDED_OPTIONS]);
      return result.job.id;
    },
    async status(projectId) {
      const list = await call('list', () => window.localWorkspace.list());
      const { progress } = await call('status', id => window.guidedWork.status(id), projectId);
      return {
        listed: list.workspace.projects.some(project => project.id === projectId && project.status === 'active'),
        jobs: progress.jobs.map(({ id, state, nextAction }) => ({ id, state, nextAction })),
        reopenDispatches: progress.reopenDispatches,
      };
    },
    async exit() {
      const closed = session.app.waitForEvent('close');
      await session.page.evaluate(() => window.appShell.exit()).catch(() => {});
      await closed;
      await session.close();
    },
  };
}

/** @returns {Host} */
function windowsHost() {
  const env = process.env;
  const host = {
    env,
    async install(setupExe, installDir) {
      // NSIS reads /D= raw to the end of the command line, so it must be last and unquoted.
      return exited(setupExe, ['/S', '/currentuser', `/D=${installDir}`], { windowsVerbatimArguments: true, argv0: `"${setupExe}"` });
    },
    async uninstall(entry, removeData) {
      const [file, ...args] = entry.quietUninstall;
      const code = await exited(file, removeData ? [...args, '--delete-app-data'] : args);
      // The NSIS uninstaller re-executes from a temporary copy, so its first process exits before the work ends.
      const deadline = Date.now() + 100_000;
      while (Date.now() < deadline && ((await host.uninstallEntry()) !== null || existsSync(entry.installLocation))) await delay(500);
      return code;
    },
    async uninstallEntry() {
      const found = await registrations(env, UNINSTALL_KEYS.user);
      if (found.length > 1) throw new Error('more than one current-user uninstall registration');
      if (!found.length) return null;
      const quietUninstall = parseCommand(found[0].QuietUninstallString);
      return { displayVersion: String(found[0].DisplayVersion), installLocation: path.win32.dirname(quietUninstall[0]), quietUninstall };
    },
    async machineWideEntry() {
      return (await registrations(env, UNINSTALL_KEYS.machine)).length > 0;
    },
    async appProcesses() {
      const tasklist = path.win32.join(env.SystemRoot, 'System32', 'tasklist.exe');
      const { code, stdout } = await capture(tasklist, ['/FI', `IMAGENAME eq ${EXE}`, '/FO', 'CSV', '/NH']);
      if (code !== 0) throw new Error(`tasklist exited ${code}`);
      return stdout.split(/\r?\n/).filter(line => line.startsWith('"')).length;
    },
    async open(exe, outputDir) {
      const session = await launchPackagedApp({ kind: 'installed', exe, outputDir });
      try {
        const version = await session.app.evaluate(({ app }) => app.getVersion());
        await delay(QUIET_MS);
        return installedApp(session, version);
      } catch (error) {
        await session.close();
        throw error;
      }
    },
    probe(exe, outputDir) {
      return probeStartup({ kind: 'installed', exe, outputDir });
    },
  };
  return host;
}

const SETUP_NAME = new RegExp(`^${builder.nsis.artifactName
  .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  .replace('\\$\\{version\\}', '(\\d+\\.\\d+\\.\\d+)')
  .replace('\\$\\{ext\\}', 'exe')}$`);

/** @param {string} directory @returns {Promise<BuildSpec>} */
async function onlySetup(directory) {
  const names = existsSync(directory) ? (await readdir(directory)).filter(name => SETUP_NAME.test(name)) : [];
  if (names.length !== 1) throw new Error(`${directory} must hold exactly one setup named like ${builder.nsis.artifactName}, found ${names.length}`);
  return { setupExe: path.join(directory, names[0]), version: names[0].match(SETUP_NAME)[1] };
}

function printPhases(report) {
  for (const entry of report.phases) {
    const detail = entry.status === 'passed' ? entry.evidence : entry.error ?? entry.violations[0];
    console.log(`${entry.status.padEnd(11)} ${entry.phase}${detail ? `: ${detail}` : ''}`);
  }
}

const here = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(here)) {
  const repoRoot = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
  const outputDir = path.join(repoRoot, 'tmp', 'app-install-qa');
  await rm(path.join(outputDir, REPORT_FILE), { force: true });
  try {
    // The installed app reads LOCALAPPDATA as given, and its path guards refuse an 8.3 alias.
    for (const name of ['LOCALAPPDATA', 'APPDATA']) {
      if (process.env[name] && path.isAbsolute(process.env[name])) process.env[name] = realpathSync.native(process.env[name]);
    }
    const report = await runInstallerAcceptance({
      kind: 'installer',
      from: await onlySetup(path.join(repoRoot, 'dist', 'app-prior')),
      to: await onlySetup(path.join(repoRoot, 'dist', 'app')),
      installDir: path.join(process.env.LOCALAPPDATA ?? '', 'Programs', PRODUCT),
      outputDir,
    });
    printPhases(report);
    console.log(`installer acceptance passed (${report.from} to ${report.to})`);
  } catch (error) {
    const file = path.join(outputDir, REPORT_FILE);
    if (existsSync(file)) printPhases(JSON.parse(await readFile(file, 'utf8')));
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
