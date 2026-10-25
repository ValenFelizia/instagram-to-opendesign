#!/usr/bin/env node
// Runs the consumer-neutral core eval and prints a JSON summary.
// A person can run this directly; test/eval-consumer-neutral-core.test.js
// imports runEval() and asserts the same summary in CI.
//
// The case rebuilds `examples/consumer-neutral-brief/` from scratch. Every file
// the core generates must hash to the value recorded in that committed example.
import { readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { briefFixture, fixtureDirections } from '../../test/helpers/brief.js';
import {
  compileBrief, exportAgentHandoff, importDirections, prepareBrief, verifyAgentHandoff,
} from '../../src/core.js';

const EXAMPLE = path.resolve('examples/consumer-neutral-brief');

// A consumer-neutral export must not carry a renderer's contract.
const ADAPTER_MARKERS = [/open-?design/i, /design-systems/i, /tokens\.css/i, /manifest\.json/i, /metadata\.json/i];
const TEXT = /\.(md|json|css|html|txt)$/i;

async function walk(root, prefix = '') {
  const entries = await readdir(path.join(root, prefix), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...await walk(root, relative));
    else files.push(relative);
  }
  return files.sort();
}

async function adapterLeaks(outputDir, files) {
  const leaks = [];
  for (const file of files.filter((name) => TEXT.test(name))) {
    const text = await readFile(path.join(outputDir, file), 'utf8');
    for (const marker of ADAPTER_MARKERS) {
      if (marker.test(text)) leaks.push({ file, marker: marker.source });
    }
  }
  return leaks;
}

export async function runEval() {
  const fixture = await briefFixture('instagram-story');
  try {
    // Core tokens that a renderer's fixed slots cannot express (DEC-009).
    fixture.decisions.rules.push(
      { id: 'R-CRAFT-INK', kind: 'token', target: 'craft-ink', value: '#242424', sourceId: 'S-REQUEST' },
      { id: 'R-CRAFT-PAPER', kind: 'token', target: 'craft-paper', value: '#ffffff', sourceId: 'S-REQUEST' });
    await writeFile(path.join(fixture.root, 'brand-decisions.json'), JSON.stringify(fixture.decisions));

    fixture.request.selectedDirectionId = 'D-1';
    fixture.request.accessibility = { motion: false,
      pairs: [{ id: 'headline-ink', usage: 'normal-text', foreground: 'var(--craft-ink)', background: 'var(--craft-paper)' }] };
    await writeFile(path.join(fixture.root, 'design-request.json'), JSON.stringify(fixture.request));

    const { context } = await prepareBrief(fixture.root);
    await importDirections(fixture.root, { directions: fixtureDirections(context) });
    const compiled = await compileBrief(fixture.root);

    // Exporting twice over the same case must produce the same inventory.
    const first = await exportAgentHandoff(fixture.root);
    const firstInventory = await verifyAgentHandoff(first.outputDir);
    const second = await exportAgentHandoff(fixture.root);
    const secondInventory = await verifyAgentHandoff(second.outputDir);

    const files = await walk(first.outputDir);
    const handoff = JSON.parse(await readFile(path.join(first.outputDir, 'handoff.json'), 'utf8'));
    const example = JSON.parse(await readFile(path.join(EXAMPLE, 'handoff.json'), 'utf8'));

    const mismatched = files.filter((file) => handoff.files[file] !== example.files[file]);
    const authored = Object.keys(example.files).filter((file) => !files.includes(file));

    return {
      briefStatus: compiled.brief.status,
      entrypoint: handoff.entrypoint,
      inventoryStatus: firstInventory.status,
      inventoryMode: firstInventory.mode,
      files,
      matchesCommittedExample: mismatched.length === 0 && handoff.briefInputHash === example.briefInputHash,
      mismatched,
      authored,
      reproducible: JSON.stringify(firstInventory.files) === JSON.stringify(secondInventory.files),
      leaks: await adapterLeaks(first.outputDir, files),
      handoff,
    };
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const summary = await runEval();
  console.log(JSON.stringify(summary, null, 2));
}
