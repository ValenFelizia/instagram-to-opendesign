import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { analyzeBrand, prepareAnalysis, validateAnalysis } from './analyze.js';
import { writeJsonAtomically } from './atomic.js';
import { colorInputFingerprint, getColorProposals } from './colors.js';
import { processEvidence } from './evidence.js';
import { ingest } from './ingest.js';
import { cleanUsername } from './normalize.js';
import { compilePackage } from './package.js';
import { loadDecisions } from './decisions.js';
import { readOptionalJson } from './local.js';

const isOwn = (owner, username) => typeof owner === 'string' &&
  owner.replace(/^@/, '').toLowerCase() === username.toLowerCase();

async function exists(file) {
  try { return (await stat(file)).isFile(); }
  catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}

export async function reviewCheckpoint(profileDir) {
  const [source, index, reviews] = await Promise.all([
    readFile(path.join(profileDir, 'instagram-source.json'), 'utf8').then(JSON.parse),
    readFile(path.join(profileDir, 'evidence/evidence.json'), 'utf8').then(JSON.parse),
    readFile(path.join(profileDir, 'evidence/review.json'), 'utf8').then(JSON.parse),
  ]);
  const images = new Map(index.images.map((item) => [item.id, item]));
  const posts = new Map(source.posts.map((post) => [post.id, post]));
  const pending = [];
  for (const id of index.selectedImageIds) {
    const image = images.get(id);
    if (!image) throw new Error(`Selected image is missing from the index: ${id}`);
    const own = id === 'profile/avatar' && image.postId == null ||
      isOwn(posts.get(image.postId)?.ownerUsername, source.profile.username);
    if (own && !['brand-graphic', 'product-photo', 'mixed'].includes(reviews[id]?.classification)) pending.push(id);
  }
  return { pending, selected: index.selectedImageIds.length,
    contactSheet: path.resolve(profileDir, 'evidence/contact-sheet.svg'),
    reviewFile: path.resolve(profileDir, 'evidence/review.json') };
}

async function analysisFingerprint(prepared) {
  const hash = createHash('sha256')
    .update(await readFile(path.join(prepared.root, 'instagram-source.json')))
    .update(await readFile(path.join(prepared.root, 'evidence/review.json')));
  for (const image of prepared.images) hash.update(image.evidenceId).update(await readFile(image.absolutePath));
  return hash.digest('hex');
}

async function reusableAnalysis(prepared, fingerprint, { force }) {
  if (force) return null;
  const statePath = path.join(prepared.root, 'analysis-state.json');
  const analysisPath = path.join(prepared.root, 'brand-analysis.json');
  try {
    const analysis = JSON.parse(await readFile(analysisPath, 'utf8'));
    await validateAnalysis(analysis, prepared);
    if (JSON.stringify(analysis.evidence) !== JSON.stringify(prepared.evidence)) return null;
    let state;
    try { state = JSON.parse(await readFile(statePath, 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (state && state.inputHash !== fingerprint) return null;
    // A pre-VAL-92 analysis is accepted only if every evidence record still matches.
    if (!state) await writeJsonAtomically(statePath, { schemaVersion: 'analysis-state/v1', inputHash: fingerprint });
    return analysis;
  } catch (error) { if (error.code === 'ENOENT' || error instanceof SyntaxError) return null; throw error; }
}

export async function runPipeline(usernameInput, {
  refresh = false, reanalyze = false, postLimit = 20, dataRoot = 'data', outputRoot = 'brand-output',
  token = process.env.OPENAI_API_KEY, fetchImpl = fetch,
  ingestImpl = ingest, processEvidenceImpl = processEvidence,
  analysisProvider, colorProvider,
} = {}) {
  const username = cleanUsername(usernameInput);
  const profileDir = path.resolve(dataRoot, username);
  const sourcePath = path.join(profileDir, 'instagram-source.json');
  let ingested = false;
  if (refresh || !(await exists(sourcePath))) {
    await ingestImpl(username, { outputRoot: dataRoot, postLimit, fetchImpl });
    ingested = true;
  }
  await processEvidenceImpl(profileDir);
  const checkpoint = await reviewCheckpoint(profileDir);
  if (checkpoint.pending.length) return { status: 'review-required', username, ingested, ...checkpoint };
  const prepared = await prepareAnalysis(profileDir);
  const previousAnalysis = await readOptionalJson(path.join(prepared.root, 'brand-analysis.json'));
  if (previousAnalysis) await loadDecisions(prepared, previousAnalysis);
  const inputHash = await analysisFingerprint(prepared);
  let analysis = await reusableAnalysis(prepared, inputHash, { force: reanalyze });
  let analyzed = false;
  if (!analysis) {
    const result = await analyzeBrand(prepared, { token, fetchImpl, provider: analysisProvider });
    analysis = result.analysis;
    analyzed = true;
    await writeJsonAtomically(path.join(profileDir, 'analysis-state.json'),
      { schemaVersion: 'analysis-state/v1', inputHash });
  }
  const color = await getColorProposals(prepared, analysis, {
    force: reanalyze || analyzed, token, fetchImpl, provider: colorProvider,
  });
  const compiled = await compilePackage(prepared, analysis, color, { outputRoot });
  return { status: 'complete', username, ingested, analyzed, colorProposed: !color.reused,
    colorUsage: color.usage, ...compiled };
}

export async function compileExisting(profileDir, { outputRoot = 'brand-output' } = {}) {
  const prepared = await prepareAnalysis(profileDir);
  const analysis = JSON.parse(await readFile(path.join(prepared.root, 'brand-analysis.json'), 'utf8'));
  const colors = JSON.parse(await readFile(path.join(prepared.root, 'color-proposals.json'), 'utf8'));
  const graphics = prepared.images.filter((item) => item.review.classification === 'brand-graphic').slice(0, 4);
  if (colors.inputHash !== await colorInputFingerprint(analysis, graphics)) {
    throw new Error('Color proposals are stale; run brand:instagram before compiling.');
  }
  return compilePackage(prepared, analysis, colors, { outputRoot });
}
