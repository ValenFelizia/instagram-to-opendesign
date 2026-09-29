#!/usr/bin/env node
import { buildBrandReport } from '../src/report.js';

const usage = 'Usage: pnpm brand:report data/<username>';
const [profileDir, ...extra] = process.argv.slice(2);
if (!profileDir || extra.length || profileDir === '--help' || profileDir === '-h') {
  console.log(usage);
  process.exit(profileDir && !extra.length ? 0 : 1);
}
try {
  const result = await buildBrandReport(profileDir);
  console.log(`Brand report: ${result.outputPath}`);
  console.log(`${result.images} reviewed images, ${result.captions} own captions, ${result.inferred} supported inferences.`);
} catch (error) { console.error(error.message); process.exitCode = 1; }
