#!/usr/bin/env node
import { compileExisting } from '../src/pipeline.js';

const dir = process.argv[2];
const extra = process.argv.slice(3);
if (!dir || extra.length && (extra.length !== 2 || extra[0] !== '--channel' || !['website', 'social'].includes(extra[1])) || dir === '--help') {
  console.log('Usage: pnpm brand:compile data/<username> [--channel website|social]');
  process.exit(dir === '--help' ? 0 : 1);
}
try { console.log(`OpenDesign package: ${(await compileExisting(dir, { channel: extra[1] ?? 'website' })).outputDir}`); }
catch (error) { console.error(error.message); process.exitCode = 1; }
