#!/usr/bin/env node
import { compileExisting } from '../src/pipeline.js';

const dir = process.argv[2];
if (!dir || process.argv.length !== 3 || dir === '--help') {
  console.log('Usage: pnpm brand:compile data/<username>');
  process.exit(dir === '--help' ? 0 : 1);
}
try { console.log(`OpenDesign package: ${(await compileExisting(dir)).outputDir}`); }
catch (error) { console.error(error.message); process.exitCode = 1; }
