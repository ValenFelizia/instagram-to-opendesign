#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { accessibilityPreflight, accessibilityMarkdown, tokenMap } from '../src/accessibility.js';
const args = process.argv.slice(2);
const usage = 'Usage: pnpm brand:accessibility <package-dir> <design-brief.json> [--lang es|en]';
try {
  if (![2, 4].includes(args.length) || args.length === 4 && (args[2] !== '--lang' || !['es', 'en'].includes(args[3]))) throw new Error(usage);
  const brief = JSON.parse(await readFile(args[1], 'utf8'));
  if (brief.schemaVersion !== 'design-brief/v1') throw new Error('Expected a selected design brief.');
  const tokens = tokenMap(await readFile(path.join(args[0], 'tokens.css'), 'utf8'));
  const report = accessibilityPreflight({ tokens, plan: brief.request.accessibility, request: brief.request, assets: brief.assets });
  const output = path.dirname(path.resolve(args[1]));
  await writeFile(path.join(output, 'accessibility.json'), JSON.stringify(report, null, 2) + '\n');
  await writeFile(path.join(output, args[3] === 'en' ? 'ACCESSIBILITY.en.md' : 'ACCESSIBILITY.md'), accessibilityMarkdown(report, { lang: args[3] ?? 'es' }));
  console.log(JSON.stringify({ status: report.status, output }));
  if (report.status === 'fail') process.exitCode = 2;
} catch (error) { console.error(error.message); process.exitCode = 1; }
