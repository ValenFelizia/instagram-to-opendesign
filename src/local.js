import { createHash } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';

export const digest = (value) => createHash('sha256').update(value).digest('hex');
export const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
export const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g,
  (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

export async function profileFile(root, relative) {
  if (typeof relative !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(relative)) {
    throw new Error(`Unsafe profile path: ${relative}`);
  }
  const resolved = await realpath(path.resolve(root, relative));
  const within = path.relative(await realpath(root), resolved);
  if (!within || within.startsWith('..') || path.isAbsolute(within)) {
    throw new Error(`Profile path escapes its directory: ${relative}`);
  }
  return resolved;
}

export async function readOptionalJson(file) {
  try { return JSON.parse(await readFile(file, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}
