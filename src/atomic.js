import { randomUUID } from 'node:crypto';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

async function replaceStaged(target, staged, { recursive }) {
  const backup = `${target}.backup-${randomUUID()}`;
  let hadPrevious = false;
  try {
    try { await rename(target, backup); hadPrevious = true; }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    try { await rename(staged, target); }
    catch (error) { if (hadPrevious) await rename(backup, target); throw error; }
    if (hadPrevious) await rm(backup, { recursive, force: true });
  } finally { await rm(staged, { recursive, force: true }); }
}

export async function writeJsonAtomically(target, value) {
  const staged = `${target}.partial-${randomUUID()}`;
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(staged, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
  await replaceStaged(target, staged, { recursive: false });
}

export async function buildDirectoryAtomically(target, build) {
  const staged = `${target}.partial-${randomUUID()}`;
  await mkdir(path.dirname(target), { recursive: true });
  await mkdir(staged);
  try {
    await build(staged);
    await replaceStaged(target, staged, { recursive: true });
  } finally { await rm(staged, { recursive: true, force: true }); }
}

// Immutable result revisions never use the replacement/backup path.
export async function createDirectoryAtomically(target, build) {
  const staged = `${target}.partial-${randomUUID()}`;
  await mkdir(path.dirname(target), { recursive: true });
  await mkdir(staged);
  try { await build(staged); await rename(staged, target); }
  finally { await rm(staged, { recursive: true, force: true }); }
}
