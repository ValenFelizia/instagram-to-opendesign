#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { prepareAnalysis } from '../src/analyze.js';
import { emptyRequest, validateRequest, suggestDirections, importDirections, compileBrief } from '../src/brief.js';
import { writeJsonAtomically } from '../src/atomic.js';
import { readOptionalJson } from '../src/local.js';

const usage = 'Usage: pnpm brand:brief data/<username> [--init web-hero|instagram-story|promotional-image|website-change [--width N --height N] | --suggest [--force] | --import file.json | --compile [--out directory]]';
const [profileDir, mode = '--compile', ...args] = process.argv.slice(2);
if (!profileDir || ['--help', '-h'].includes(profileDir)) { console.log(usage); process.exit(profileDir ? 0 : 1); }
try {
  if (mode === '--init' && (args.length === 1 || args.length === 5 && args[1] === '--width' && args[3] === '--height')) {
    const prepared = await prepareAnalysis(profileDir), file = path.join(prepared.root, 'design-request.json');
    if (await readOptionalJson(file)) throw new Error('Request already exists; initialization never overwrites it.');
    const request = emptyRequest(prepared.source.profile.username, args[0], args.length === 5 ? { width: Number(args[2]), height: Number(args[4]) } : undefined);
    validateRequest(request, prepared.source.profile.username);
    await writeJsonAtomically(file, request); console.log(file);
  } else if (mode === '--suggest' && (!args.length || args.length === 1 && args[0] === '--force')) {
    const result = await suggestDirections(profileDir, { force: args[0] === '--force' });
    console.log(JSON.stringify({ reused: result.reused, directions: result.directions }, null, 2));
  } else if (mode === '--import' && args.length === 1) {
    console.log(JSON.stringify(await importDirections(profileDir, JSON.parse(await readFile(args[0], 'utf8'))), null, 2));
  } else if (mode === '--compile' && (!args.length || args.length === 2 && args[0] === '--out')) {
    const result = await compileBrief(profileDir, { outputDir: args[1] });
    console.log(JSON.stringify({ outputDir: result.outputDir, status: result.brief.status, pending: result.brief.pending }, null, 2));
  } else throw new Error(usage);
} catch (error) { console.error(error.message); process.exitCode = 1; }
