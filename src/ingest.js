import { cp, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ApifyInstagramProvider } from './providers/apify.js';
import { cleanUsername, normalizeSource } from './normalize.js';
import { downloadAssets } from './assets.js';

export async function ingest(usernameInput, { outputRoot = 'data', postLimit = 20,
  fixturePath, token = process.env.APIFY_TOKEN, provider, fetchImpl = fetch } = {}) {
  const username = cleanUsername(usernameInput);
  if (!Number.isInteger(postLimit) || postLimit < 1 || postLimit > 25) throw new Error('Post limit must be 1–25.');
  const collector = fixturePath
    ? { collect: async () => JSON.parse(await readFile(fixturePath, 'utf8')) }
    : provider ?? new ApifyInstagramProvider({ token, fetchImpl });
  const collected = await collector.collect(username, postLimit);
  const source = normalizeSource(username, collected);
  const finalDir = path.resolve(outputRoot, username);
  const temporaryDir = `${finalDir}.partial-${process.pid}`;
  const backupDir = `${finalDir}.backup-${process.pid}`;
  await mkdir(path.dirname(finalDir), { recursive: true });
  await rm(temporaryDir, { recursive: true, force: true });
  try {
    await downloadAssets(source, temporaryDir, { fetchImpl });
    await writeFile(path.join(temporaryDir, 'instagram-source.json'), `${JSON.stringify(source, null, 2)}\n`);
    for (const [previous, next] of [
      ['evidence/review.json', 'evidence/review.json'],
      ['brand-analysis.json', 'brand-analysis.json'],
      ['color-proposals.json', 'color-proposals.json'],
      ['analysis-state.json', 'analysis-state.json'],
      ['brand-decisions.json', 'brand-decisions.json'],
    ]) {
      try {
        const content = await readFile(path.join(finalDir, previous));
        await mkdir(path.dirname(path.join(temporaryDir, next)), { recursive: true });
        await writeFile(path.join(temporaryDir, next), content);
      } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    try { await cp(path.join(finalDir, 'manual'), path.join(temporaryDir, 'manual'), { recursive: true }); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    let hadPrevious = false;
    try {
      await rename(finalDir, backupDir);
      hadPrevious = true;
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    try {
      await rename(temporaryDir, finalDir);
    } catch (error) {
      if (hadPrevious) await rename(backupDir, finalDir);
      throw error;
    }
    if (hadPrevious) await rm(backupDir, { recursive: true, force: true });
  } catch (error) {
    await rm(temporaryDir, { recursive: true, force: true });
    throw error;
  }
  return { outputDir: finalDir, source };
}
