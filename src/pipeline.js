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
import { createRunRecord, trackProvider } from './run-record.js';
import { ANALYSIS_MODEL, requestBrandInferences } from './providers/openai.js';
import { COLOR_MODEL, requestColorCandidates } from './providers/openai-colors.js';
import { buildBrandReport } from './report.js';
import { exportAgentHandoff, suggestDirections } from './brief.js';
import { DIRECTIONS_MODEL, requestCreativeDirections } from './providers/openai-directions.js';
import { requestReportTranslation } from './providers/openai-report-translation.js';

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

export async function analysisFingerprint(prepared) {
  const hash = createHash('sha256')
    .update(await readFile(path.join(prepared.root, 'instagram-source.json')))
    .update(await readFile(path.join(prepared.root, 'evidence/review.json')));
  for (const image of prepared.images) hash.update(image.evidenceId).update(await readFile(image.absolutePath));
  return hash.digest('hex');
}

export async function reusableAnalysis(prepared, fingerprint, { force = false, configurationRevision, readOnly = false } = {}) {
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
    if (state && (state.inputHash !== fingerprint || configurationRevision != null && state.configurationRevision !== configurationRevision)) return null;
    if (!state && configurationRevision != null) return null;
    // A pre-VAL-92 analysis is accepted only if every evidence record still matches.
    if (!state && !readOnly) await writeJsonAtomically(statePath, { schemaVersion: 'analysis-state/v1', inputHash: fingerprint });
    return analysis;
  } catch (error) { if (error.code === 'ENOENT' || error instanceof SyntaxError) return null; throw error; }
}

export async function runPipeline(usernameInput, {
  refresh = false, reanalyze = false, postLimit = 20, dataRoot = 'data', outputRoot = 'brand-output',
  token = process.env.OPENAI_API_KEY, fetchImpl = fetch,
  ingestImpl = ingest, processEvidenceImpl = processEvidence,
  analysisProvider, colorProvider, includeReport = false, language = 'es', includeExport = false, includePackage = true,
  includeDirections = false, translationProvider, directionsProvider,
  configurationRevision, onStage = async () => {},
} = {}) {
  const username = cleanUsername(usernameInput);
  const profileDir = path.resolve(dataRoot, username);
  const sourcePath = path.join(profileDir, 'instagram-source.json');
  const journal = await createRunRecord(profileDir, { refresh, reanalyze, postLimit });
  const stage = (name, operation) => journal.phase(name, async context => {
    await onStage({ name, state: 'running', observationRef: context.phase.id });
    const result = await operation(context);
    await onStage({ name, state: 'completed', result }); return result;
  });
  try {
    let ingested = false;
    await stage('ingestion', async ({ observe, phase }) => {
      if (refresh || !(await exists(sourcePath))) {
        phase.mode = 'unknown';
        await ingestImpl(username, { outputRoot: dataRoot, postLimit, fetchImpl, onProviderEvent: observe });
        ingested = true;
      } else phase.mode = 'cache';
    });
    await stage('evidence', () => processEvidenceImpl(profileDir));
    const checkpoint = await reviewCheckpoint(profileDir);
    if (checkpoint.pending.length) {
      await journal.finish('review-required');
      return { status: 'review-required', username, ingested, runRecordPath: journal.outputPath, ...checkpoint };
    }
    const prepared = await prepareAnalysis(profileDir);
    const previousAnalysis = await readOptionalJson(path.join(prepared.root, 'brand-analysis.json'));
    if (previousAnalysis) await loadDecisions(prepared, previousAnalysis);
    const inputHash = await analysisFingerprint(prepared);
    let analyzed = false, analysisUsage = null;
    const analysis = await stage('analysis', async ({ observe, phase }) => {
      const cached = await reusableAnalysis(prepared, inputHash, { force: reanalyze, configurationRevision: configurationRevision?.analysis });
      if (cached) { phase.mode = 'cache'; return cached; }
      const provider = trackProvider(analysisProvider ?? requestBrandInferences, {
        observe, providerName: analysisProvider ? 'custom' : 'openai',
        model: analysisProvider ? null : ANALYSIS_MODEL, maxOutputTokens: analysisProvider ? null : 16000,
      });
      const result = await analyzeBrand(prepared, { token, fetchImpl, provider });
      analyzed = true; analysisUsage = result.usage ?? null;
      await writeJsonAtomically(path.join(profileDir, 'analysis-state.json'),
        { schemaVersion: 'analysis-state/v1', inputHash, ...(configurationRevision?.analysis ? { configurationRevision: configurationRevision.analysis } : {}) });
      return result.analysis;
    });
    const color = await stage('colors', async ({ observe, phase }) => {
      const provider = trackProvider(colorProvider ?? requestColorCandidates, {
        observe, providerName: colorProvider ? 'custom' : 'openai',
        model: colorProvider ? null : COLOR_MODEL, maxOutputTokens: colorProvider ? null : 4000,
      });
      const result = await getColorProposals(prepared, analysis, {
        force: reanalyze || analyzed, token, fetchImpl, provider, configurationRevision: configurationRevision?.colors,
      });
      if (result.reused) phase.mode = 'cache';
      return result;
    });
    const compiled = includePackage ? await stage('compilation', () => compilePackage(prepared, analysis, color, { outputRoot })) : {};
    if (includeDirections) await stage('directions', async ({ observe, phase }) => {
      const provider = trackProvider(directionsProvider ?? requestCreativeDirections, { observe, providerName: directionsProvider ? 'custom' : 'openai', model: DIRECTIONS_MODEL, maxOutputTokens: 6000 });
      const result = await suggestDirections(profileDir, { token, fetchImpl, provider, configurationRevision: configurationRevision?.directions });
      if (result.reused) phase.mode = 'cache'; return result;
    });
    const report = includeReport ? await stage('report', async ({ observe, phase }) => {
      const provider = trackProvider(translationProvider ?? requestReportTranslation, { observe, providerName: translationProvider ? 'custom' : 'openai', model: ANALYSIS_MODEL, maxOutputTokens: 16000 });
      const result = await buildBrandReport(profileDir, { language, token, fetchImpl, translationProvider: provider,
        configurationRevision: configurationRevision?.translation });
      if (result.translationReused) phase.mode = 'cache'; return result;
    }) : null;
    const exported = includeExport ? await stage('export', () => exportAgentHandoff(profileDir, { outputDir: path.join(outputRoot, 'handoff') })) : null;
    await journal.finish('complete');
    return { status: 'complete', username, ingested, analyzed, colorProposed: !color.reused,
      analysisUsage, colorUsage: color.usage, runRecordPath: journal.outputPath, report, exported, ...compiled };
  } catch (error) {
    await journal.finish('failed');
    error.runRecordPath = journal.outputPath;
    throw error;
  }
}

export async function compileExisting(profileDir, { outputRoot = 'brand-output', channel = 'website' } = {}) {
  const prepared = await prepareAnalysis(profileDir);
  const analysis = JSON.parse(await readFile(path.join(prepared.root, 'brand-analysis.json'), 'utf8'));
  const colors = JSON.parse(await readFile(path.join(prepared.root, 'color-proposals.json'), 'utf8'));
  const graphics = prepared.images.filter((item) => item.review.classification === 'brand-graphic').slice(0, 4);
  if (colors.inputHash !== await colorInputFingerprint(analysis, graphics)) {
    throw new Error('Color proposals are stale; run brand:instagram before compiling.');
  }
  return compilePackage(prepared, analysis, colors, { outputRoot, channel });
}
