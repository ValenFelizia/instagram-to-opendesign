#!/usr/bin/env node
import { runPipeline } from '../src/pipeline.js';
import { buildBrandReport } from '../src/report.js';

const usage = "Usage: pnpm brand:instagram '@username' [--refresh] [--reanalyze]";
const args = process.argv.slice(2);
const username = args.shift();
if (!username || username === '--help' || username === '-h') {
  console.log(usage); process.exit(username ? 0 : 1);
}
if (args.some((arg) => !['--refresh', '--reanalyze'].includes(arg)) || new Set(args).size !== args.length) {
  console.error(usage); process.exit(1);
}
try {
  const result = await runPipeline(username, {
    refresh: args.includes('--refresh'), reanalyze: args.includes('--reanalyze'),
  });
  if (result.status === 'review-required') {
    console.log(`${result.pending.length} selected profile-owned images need review before analysis.`);
    console.log(`Contact sheet: ${result.contactSheet}`);
    console.log(`Edit classifications in: ${result.reviewFile}`);
    console.log(`Then repeat: pnpm brand:instagram '${username}'`);
    process.exitCode = 2;
  } else {
    console.log(`OpenDesign package: ${result.outputDir}`);
    const report = await buildBrandReport(`data/${result.username}`);
    console.log(`Brand report: ${report.outputPath}`);
    console.log(`Reused existing source: ${!result.ingested}; reused analysis: ${!result.analyzed}; reused color proposal: ${!result.colorProposed}.`);
    if (result.colorUsage) console.log(`Color API usage: ${result.colorUsage.input_tokens ?? '?'} input, ${result.colorUsage.output_tokens ?? '?'} output tokens.`);
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
