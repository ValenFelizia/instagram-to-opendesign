#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { reviewResult, resultMarkdown, compareReviews } from '../src/result-review.js';
import { collectRenderObservations } from '../src/render-observations.js';
const args = process.argv.slice(2);
const usage = 'Usage: pnpm brand:result <brief-dir> <review-input.json> --out <archive-root> [--lang es|en]\n       pnpm brand:result --compare <manual-review.json> <tool-review.json>';
try {
  if (args[0] === '--collector' && args.length === 1) console.log(`JSON.stringify((${collectRenderObservations.toString()})(), null, 2)`);
  else if (args[0] === '--compare' && args.length === 3) {
    console.log(JSON.stringify(compareReviews(JSON.parse(await readFile(args[1], 'utf8')), JSON.parse(await readFile(args[2], 'utf8'))), null, 2));
  } else {
    if (![4, 6].includes(args.length) || args[2] !== '--out' || args.length === 6 && (args[4] !== '--lang' || !['es', 'en'].includes(args[5]))) throw new Error(usage);
    const built = await reviewResult(args[0], JSON.parse(await readFile(args[1], 'utf8')), { outputRoot: args[3] });
    if (args[5] === 'en') await writeFile(path.join(built.outputDir, 'REVIEW.en.md'), resultMarkdown(built.report, { lang: 'en' }));
    console.log(JSON.stringify({ outputDir: built.outputDir, status: built.report.status, conclusion: built.report.conclusion }, null, 2));
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
