#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { prepareAnalysis, validateAnalysis } from '../src/analyze.js';
import { writeJsonAtomically } from '../src/atomic.js';
import { emptyDecisions, loadDecisions, validateDecisionDocument } from '../src/decisions.js';
import { digest, profileFile, readOptionalJson } from '../src/local.js';

const usage = 'Usage: pnpm brand:decisions data/<username> [--init | --check | --source manual/file.md --reviewer "Name" --summary "Purpose"]';
const [profileDir, mode = '--check', ...args] = process.argv.slice(2);
if (!profileDir || ['--help', '-h'].includes(profileDir)) { console.log(usage); process.exit(profileDir ? 0 : 1); }
try {
  const prepared = await prepareAnalysis(profileDir);
  const analysis = JSON.parse(await readFile(path.join(prepared.root, 'brand-analysis.json'), 'utf8'));
  await validateAnalysis(analysis, prepared);
  const target = path.join(prepared.root, 'brand-decisions.json');
  if (mode === '--init' && !args.length) {
    if (await readOptionalJson(target)) throw new Error('Decisions already exist; initialization never overwrites them.');
    await writeJsonAtomically(target, await emptyDecisions(prepared, analysis));
    console.log(target);
  } else if (mode === '--check' && !args.length) {
    const review = await loadDecisions(prepared, analysis);
    console.log(JSON.stringify({ confirmed: review.activeRules.length, staleRules: review.staleRules.map((rule) => rule.id),
      decisions: review.decisions.map(({ inferenceId, action, stale }) => ({ inferenceId, action, stale })),
      sources: review.sources.map(({ id, stale }) => ({ id, stale })) }, null, 2));
  } else if (mode === '--source' && args.length === 5 && args[1] === '--reviewer' && args[3] === '--summary') {
    const review = await loadDecisions(prepared, analysis);
    if (!review.document) throw new Error('Initialize decisions first.');
    const [relative, , reviewer, , summary] = args;
    if (!relative.startsWith('manual/') || !/\.(md|txt|json|css)$/.test(relative)) throw new Error('Use a local manual/ source document.');
    const id = `S-${digest(relative).slice(0, 16)}`;
    if (review.document.sources.some((source) => source.id === id)) throw new Error('Source already registered; re-verification must be intentional.');
    review.document.sources.push({ id, path: relative, sha256: digest(await readFile(await profileFile(prepared.root, relative))),
      reviewer, summary, reviewedAt: new Date().toISOString() });
    // Validate before replacing the canonical document.
    validateDecisionDocument(review.document);
    await writeJsonAtomically(target, review.document);
    console.log(`Registered ${id}. Add rules referencing this source; no inference was verified.`);
  } else throw new Error(usage);
} catch (error) { console.error(error.message); process.exitCode = 1; }
