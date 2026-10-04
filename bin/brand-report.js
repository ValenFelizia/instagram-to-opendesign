#!/usr/bin/env node
import { buildBrandReport } from '../src/report.js';
import writer from '../src/writer-guard.cjs';

const usage = 'Usage: pnpm brand:report data/<username> [--lang es|en]';
const [profileDir, ...extra] = process.argv.slice(2);
if (!profileDir || profileDir === '--help' || profileDir === '-h') {
  console.log(usage);
  process.exit(profileDir && !extra.length ? 0 : 1);
}
if (extra.length && (extra.length !== 2 || extra[0] !== '--lang' || !['es', 'en'].includes(extra[1]))) {
  console.error(usage); process.exit(1);
}
const language = extra[1] || 'es';
let release = () => {};
try {
  release = writer.acquireCliWriters([profileDir]);
  const result = await buildBrandReport(profileDir, { language });
  console.log(`Brand report: ${result.outputPath}`);
  console.log(`${result.images} reviewed images, ${result.captions} own captions, ${result.inferred} supported inferences.`);
  if (result.translationUsage) console.log(`Translation API usage: ${result.translationUsage.input_tokens ?? '?'} input, ${result.translationUsage.output_tokens ?? '?'} output tokens.`);
  if (language === 'en') console.log(`Reused English translation: ${result.translationReused}.`);
} catch (error) { console.error(error.message); process.exitCode = 1; } finally { release(); }
