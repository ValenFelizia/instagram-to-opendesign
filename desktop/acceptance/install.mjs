import path from 'node:path';

const win = path.win32;
const INSTALLER_KEYS = ['kind', 'setupExe', 'installDir', 'outputDir'];

function absolute(value, label) {
  if (typeof value !== 'string' || (!win.isAbsolute(value) && !path.isAbsolute(value))) throw new Error(`${label} must be an absolute path`);
  return value;
}

function rejectUnknown(raw, allowed, message) {
  const extra = Object.keys(raw).filter(key => !allowed.includes(key));
  if (extra.length) throw new Error(message);
}

/**
 * Issue 58 seam. The Windows workflow must not call this until that issue is in scope.
 * A valid installer spec throws `not implemented` before any install directory is written.
 * @param {unknown} raw
 * @returns {Promise<never>}
 */
export async function runInstallerAcceptance(raw) {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('installer spec must be an object');
  if (/** @type {{ kind?: string }} */ (raw).kind !== 'installer') throw new Error('unknown installer kind');
  rejectUnknown(raw, INSTALLER_KEYS, 'installer spec has unknown fields');
  const spec = /** @type {{ setupExe: string, installDir: string, outputDir: string }} */ (raw);
  absolute(spec.setupExe, 'setupExe');
  absolute(spec.installDir, 'installDir');
  absolute(spec.outputDir, 'outputDir');
  throw new Error('not implemented');
}
