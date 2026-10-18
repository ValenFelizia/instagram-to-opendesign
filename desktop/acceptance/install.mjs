import { createRequire } from 'node:module';
import { realpathSync } from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const builder = require('../builder.json');
const PRODUCT = builder.productName;
const VERSION = /^\d+\.\d+\.\d+$/;
const SPEC_KEYS = ['kind', 'from', 'to', 'installDir', 'outputDir'];
const BUILD_KEYS = ['setupExe', 'version'];
const ROOT_NAMES = /** @type {const} */ (['install', 'local', 'roaming']);

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
 */

/**
 * @typedef {'absent' | 'created' | 'byte-identical' | 'kept' | 'recovered' | 'present' | 'replaced' | 'removed'} RootEffect
 */
/** @typedef {Readonly<Record<RootName, RootEffect>>} Effects */

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

/** DEC-015 statements. cite.mjs requires each value verbatim in DEC-015 and in docs/windows-app-shell.md. */
export const INSTALL_SUPPORT = Object.freeze({
  floor: 'Windows 10 and Windows 11, x64 only',
  tested: 'CI installs on GitHub windows-latest, which is Windows Server; Windows 10 and Windows 11 client editions are not exercised',
  installer: 'Assisted NSIS installer with a current-user default (oneClick false, perMachine false)',
  signing: 'Unsigned builds; SmartScreen and Mark-of-the-Web warnings are a known limitation',
  updates: 'Manual updates only; there is no auto-updater and no publish target',
  uninstall: 'Default uninstall keeps the Local workspace and the Roaming profile; --delete-app-data removes only the Roaming profile, and the Local workspace and chosen project folders stay',
  downgrade: 'A job store newer than user_version 2 is refused with job-version-unsupported; there is no downward migration',
});

/** @param {RootEffect} install @param {RootEffect} local @param {RootEffect} roaming @returns {Effects} */
function effects(install, local, roaming) {
  return Object.freeze({ install, local, roaming });
}

function pending() {
  return {
    act: async () => { throw new Error('not implemented'); },
    expect: () => [],
  };
}

const PHASES = Object.freeze([
  {
    name: 'preflight',
    effects: effects('absent', 'absent', 'absent'),
    evidence: null,
    note: null,
    timeoutMs: 15_000,
    ...pending(),
  },
  {
    name: 'install',
    effects: effects('created', 'absent', 'absent'),
    evidence: 'Silent per-user NSIS install registers a current-user uninstaller, starts nothing, writes no user data and ships no update metadata',
    note: null,
    timeoutMs: 180_000,
    ...pending(),
  },
  {
    name: 'plant-v1-store',
    effects: effects('byte-identical', 'created', 'absent'),
    evidence: null,
    note: 'The harness opens the job store with a fault that rolls back the version 2 migration, then adds a prior-evidence file. The installed app must finish the migration and keep that file.',
    timeoutMs: 30_000,
    ...pending(),
  },
  {
    name: 'seed',
    effects: effects('byte-identical', 'present', 'created'),
    evidence: 'Installed app finishes a rolled-back v1 to v2 job store migration keeping prior evidence, then writes a managed project, a DPAPI-protected credential and an unconfirmed queued job under the real per-user data roots',
    note: null,
    timeoutMs: 90_000,
    ...pending(),
  },
  {
    name: 'verify-installed',
    effects: effects('byte-identical', 'kept', 'present'),
    evidence: 'Installed app relaunch with a System32-only PATH lists the project, decrypts the credential and leaves the queued job undispatched',
    note: null,
    timeoutMs: 90_000,
    ...pending(),
  },
  {
    name: 'plant-crashed-attempt',
    effects: effects('byte-identical', 'present', 'byte-identical'),
    evidence: null,
    note: 'The harness dispatches a fake paid attempt and kills the process after the intent is recorded. The upgraded app must mark that attempt uncertain and its job interrupted, and must not retry it.',
    timeoutMs: 60_000,
    ...pending(),
  },
  {
    name: 'upgrade',
    effects: effects('replaced', 'byte-identical', 'byte-identical'),
    evidence: 'Silent N to N+1 upgrade over a crashed paid attempt replaces the install, starts nothing and leaves the workspace and Chromium profile byte-identical',
    note: null,
    timeoutMs: 180_000,
    ...pending(),
  },
  {
    name: 'verify-upgraded',
    effects: effects('byte-identical', 'recovered', 'present'),
    evidence: 'Upgraded app reports N+1, keeps projects, the DPAPI credential and the queued job, and marks the crashed paid attempt uncertain and interrupted without retrying it',
    note: null,
    timeoutMs: 90_000,
    ...pending(),
  },
  {
    name: 'refuse-newer-store',
    effects: effects('byte-identical', 'kept', 'present'),
    evidence: 'Installed app refuses a job store newer than it supports with job-version-unsupported and changes no workspace byte',
    note: 'The harness stamps the store one version ahead, starts the app, then restores the version. Downgrade across a store version is refused; reinstalling the newer build is the recovery.',
    timeoutMs: 60_000,
    ...pending(),
  },
  {
    name: 'uninstall-keep',
    effects: effects('removed', 'byte-identical', 'byte-identical'),
    evidence: 'Default silent uninstall removes the install and its registration and leaves the workspace and Chromium profile byte-identical',
    note: null,
    timeoutMs: 120_000,
    ...pending(),
  },
  {
    name: 'reinstall',
    effects: effects('created', 'byte-identical', 'byte-identical'),
    evidence: null,
    note: null,
    timeoutMs: 180_000,
    ...pending(),
  },
  {
    name: 'verify-reinstalled',
    effects: effects('byte-identical', 'kept', 'present'),
    evidence: 'Reinstall over retained data reopens the same project, credential, queued job and uncertain attempt without a reset or retry',
    note: null,
    timeoutMs: 90_000,
    ...pending(),
  },
  {
    name: 'uninstall-remove',
    effects: effects('removed', 'byte-identical', 'removed'),
    evidence: 'Uninstall with --delete-app-data removes only the Chromium profile and leaves the workspace byte-identical',
    note: 'Saved provider keys are encrypted with a key held in the Roaming profile. After this removal the encrypted files stay in the workspace but may no longer decrypt.',
    timeoutMs: 120_000,
    ...pending(),
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

/** Registry evidence names, keyed by phase. */
export const INSTALLER_EVIDENCE = Object.freeze(Object.fromEntries(
  PHASES.filter(phase => phase.evidence).map(phase => [phase.name, phase.evidence]),
));

/** What cite.mjs renders as the Issue 58 section of the debt doc. */
export const INSTALLER_ACCEPTANCE = Object.freeze({
  phases: Object.freeze(PHASES.map(({ name, effects: declared, evidence, note }) => Object.freeze({ name, effects: declared, evidence, note }))),
  effects: EFFECT_MEANING,
});

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
  return Object.freeze({ builds: Object.freeze({ from, to }), roots, outputDir });
}

/**
 * Runs every phase once against real installers and the current Windows user profile.
 * @param {unknown} raw  InstallerSpec. Validated before any side effect.
 * @param {{ env: Readonly<Record<string, string | undefined>> }} [host]
 * @returns {Promise<never>}
 */
export async function runInstallerAcceptance(raw, host = { env: process.env }) {
  parseInstallerSpec(raw, host.env);
  throw new Error('not implemented');
}
