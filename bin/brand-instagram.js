#!/usr/bin/env node
import { runPipeline } from '../src/pipeline.js';
import { buildBrandReport } from '../src/report.js';

const usage = "Usage: pnpm brand:instagram '@username' [--refresh] [--reanalyze] [--lang es|en]";
const args = process.argv.slice(2);
const username = args.shift();
if (!username || username === '--help' || username === '-h') {
  console.log(usage); process.exit(username ? 0 : 1);
}
const options = { refresh: false, reanalyze: false, language: 'es' };
const seen = new Set();
for (let index = 0; index < args.length; index++) {
  const option = args[index];
  if (seen.has(option) || !['--refresh', '--reanalyze', '--lang'].includes(option)) {
    console.error(usage); process.exit(1);
  }
  seen.add(option);
  if (option === '--lang') {
    options.language = args[++index];
    if (!['es', 'en'].includes(options.language)) { console.error(usage); process.exit(1); }
  } else options[option.slice(2)] = true;
}
try {
  const result = await runPipeline(username, {
    refresh: options.refresh, reanalyze: options.reanalyze,
  });
  console.log(`Local run record: ${result.runRecordPath}`);
  if (result.analysisUsage) console.log(`Analysis API usage: ${result.analysisUsage.input_tokens ?? '?'} input, ${result.analysisUsage.output_tokens ?? '?'} output tokens.`);
  if (result.status === 'review-required') {
    console.log(`${result.pending.length} selected profile-owned images need review before analysis.`);
    console.log(`Contact sheet: ${result.contactSheet}`);
    console.log(`Edit classifications in: ${result.reviewFile}`);
    console.log(`Then repeat: pnpm brand:instagram '${username}'${options.language === 'en' ? ' --lang en' : ''}`);
    process.exitCode = 2;
  } else {
    console.log(`OpenDesign package: ${result.outputDir}`);
    const report = await buildBrandReport(`data/${result.username}`, { language: options.language });
    console.log(`Brand report: ${report.outputPath}`);
    if (report.translationUsage) console.log(`Translation API usage: ${report.translationUsage.input_tokens ?? '?'} input, ${report.translationUsage.output_tokens ?? '?'} output tokens.`);
    console.log(`Reused existing source: ${!result.ingested}; reused analysis: ${!result.analyzed}; reused color proposal: ${!result.colorProposed}.`);
    if (result.colorUsage) console.log(`Color API usage: ${result.colorUsage.input_tokens ?? '?'} input, ${result.colorUsage.output_tokens ?? '?'} output tokens.`);
  }
} catch (error) {
  console.error(error.message);
  if (error.runRecordPath) console.error(`Local run record: ${error.runRecordPath}`);
  process.exitCode = 1;
}
