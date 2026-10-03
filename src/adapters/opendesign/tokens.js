import { readFile } from 'node:fs/promises';
import { validateTokenRule } from '../../decisions.js';

const template = await readFile(new URL('../../../examples/example-studio/tokens.css', import.meta.url), 'utf8');
const names = new Set([...template.matchAll(/--([a-z0-9-]+):/g)].map(match => match[1]));

export function validateOpenDesignTokenOverrides(overrides) {
  for (const [target, value] of Object.entries(overrides)) {
    validateTokenRule({ kind: 'token', target, value });
    if (!names.has(target)) throw new Error(`OpenDesign has no token mapping for: ${target}. Keep the core rule; provide an explicit adapter mapping before packaging.`);
    for (const reference of value.matchAll(/var\(\s*--([a-z0-9-]+)/g)) {
      if (!names.has(reference[1])) throw new Error(`Unknown OpenDesign token alias: ${reference[1]}. Provide an explicit adapter mapping before packaging.`);
    }
  }
}
