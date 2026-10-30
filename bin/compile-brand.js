#!/usr/bin/env node
import { compileExisting } from '../src/pipeline.js';
import { noReadyAssetsWarning } from '../src/asset-catalog.js';
import writer from '../src/writer-guard.cjs';

const dir = process.argv[2];
const extra = process.argv.slice(3);
if (!dir || extra.length && (extra.length !== 2 || extra[0] !== '--channel' || !['website', 'social'].includes(extra[1])) || dir === '--help') {
  console.log('Usage: pnpm brand:compile data/<username> [--channel website|social]');
  process.exit(dir === '--help' ? 0 : 1);
}
let release = () => {};
try {
  release = writer.acquireCliWriters([dir]);
  const compiled = await compileExisting(dir, { channel: extra[1] ?? 'website' });
  console.log(`OpenDesign package: ${compiled.outputDir}`);
  if (compiled.readyAssets === 0) console.warn(noReadyAssetsWarning(dir));
}
catch (error) { console.error(error.message); process.exitCode = 1; } finally { release(); }
