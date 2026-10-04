#!/usr/bin/env node
import { analyzeBrand, prepareAnalysis } from '../src/analyze.js';
import { ANALYSIS_MODEL } from '../src/providers/openai.js';
import writer from '../src/writer-guard.cjs';

const usage = 'Usage: node --env-file=.env.local bin/analyze-brand.js data/<username> [--dry-run]';
const args = process.argv.slice(2);
const profileDir = args.shift();
if (!profileDir || profileDir === '--help' || profileDir === '-h') {
  console.log(usage);
  process.exit(profileDir ? 0 : 1);
}
if (args.length > 1 || (args.length === 1 && args[0] !== '--dry-run')) {
  console.error(usage);
  process.exit(1);
}
let release = () => {};
try {
  release = writer.acquireCliWriters([profileDir]);
  const prepared = await prepareAnalysis(profileDir);
  const summary = `${prepared.images.length} reviewed own images, ${prepared.captions.length} own captions; ` +
    `${prepared.excludedCollaborator} collaborator and ${prepared.excludedUnreviewed} unreviewed images excluded; ` +
    `${(prepared.imageBytes / 1024 / 1024).toFixed(1)} MB of images.`;
  if (args[0] === '--dry-run') {
    console.log(`Dry run for @${prepared.source.profile.username}: ${summary}`);
    console.log(`Model: ${ANALYSIS_MODEL}, reasoning: high; no API request made.`);
  } else {
    const result = await analyzeBrand(prepared);
    console.log(`Saved ${result.analysis.inferences.length} inferences to ${result.outputPath}. ${summary}`);
    if (result.usage) console.log(`API usage: ${result.usage.input_tokens ?? '?'} input, ${result.usage.output_tokens ?? '?'} output tokens.`);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally { release(); }
