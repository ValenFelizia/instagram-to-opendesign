import { createHash } from 'node:crypto';
import { readFile, readdir, realpath } from 'node:fs/promises';
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

export async function fileDigests(root, relative = '') {
  const result = {};
  for (const entry of await readdir(path.join(root, relative), { withFileTypes: true })) {
    const file = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isSymbolicLink()) throw new Error('Package inventory rejects symbolic links.');
    if (entry.isDirectory()) Object.assign(result, await fileDigests(root, file));
    else if (entry.isFile() && file !== 'source/package-context.json') result[file] = digest(await readFile(await profileFile(root, file)));
  }
  return result;
}
