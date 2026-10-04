#!/usr/bin/env node
import { exportAgentHandoff, verifyAgentHandoff } from '../src/core.js';
import writer from '../src/writer-guard.cjs';

const usage = 'Usage: pnpm brand:handoff data/<profile> [--out directory] | --verify <handoff-directory>';
const args = process.argv.slice(2);
if (!args.length || ['--help', '-h'].includes(args[0])) { console.log(usage); process.exit(args.length ? 0 : 1); }
let release = () => {};
try {
  if (args[0] === '--verify' && args.length === 2) {
    const inventory = await verifyAgentHandoff(args[1]);
    console.log(JSON.stringify({ status: inventory.status, mode: inventory.mode, verifiedFiles: Object.keys(inventory.files).length }, null, 2));
  } else if (!args[0].startsWith('--') && (args.length === 1 || args.length === 3 && args[1] === '--out')) {
    release = writer.acquireCliWriters([args[0], ...(args[2] ? [args[2]] : [])]);
    const result = await exportAgentHandoff(args[0], { outputDir: args[2] });
    console.log(JSON.stringify({ outputDir: result.outputDir, entrypoint: 'START.md', status: result.brief.status, pending: result.brief.pending }, null, 2));
  } else throw new Error(usage);
} catch (error) { console.error(error.message); process.exitCode = 1; } finally { release(); }
