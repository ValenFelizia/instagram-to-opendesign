#!/usr/bin/env node
import { processEvidence } from '../src/evidence.js';
import writer from '../src/writer-guard.cjs';

const args = process.argv.slice(2);
const profileDir = args.shift();
if (!profileDir || profileDir === '--help' || profileDir === '-h') {
  console.log('Usage: node bin/process-evidence.js data/<username> [--max-images 24]');
  process.exit(profileDir ? 0 : 1);
}
let maxImages = 24;
if (args.length) {
  if (args.length !== 2 || args[0] !== '--max-images') {
    console.error('Usage: node bin/process-evidence.js data/<username> [--max-images 24]');
    process.exit(1);
  }
  maxImages = Number(args[1]);
}
let release = () => {};
try {
  release = writer.acquireCliWriters([profileDir]);
  const result = await processEvidence(profileDir, { maxImages });
  console.log(`Saved ${result.selectedCount}/${result.imageCount} images to ${result.evidenceDir}; ${result.reviewedCount} classified.`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally { release(); }
