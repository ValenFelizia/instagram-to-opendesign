import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const fromBuilder = createRequire(require.resolve('electron-builder/package.json'));
const fromLibrary = createRequire(fromBuilder.resolve('app-builder-lib'));
const { listPackage, extractFile } = fromLibrary('@electron/asar');
const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const files = listPackage(path.join(root, 'dist/app/win-unpacked/resources/app.asar')).map(name => name.replaceAll('\\', '/'));
const permitted = new Set(['desktop', 'src', 'schemas', 'examples', 'node_modules', 'package.json', 'LICENSE']);
for (const file of files) {
  const segments = file.split('/').filter(Boolean);
  assert.ok(permitted.has(segments[0]), `Unexpected package entry: ${segments[0]}`);
  assert.ok(!segments.some(segment => segment === '.env' || segment.startsWith('.env.') || ['.git', '.csdd', 'data', 'brand-output', 'tmp'].includes(segment)), 'Private/configuration entry must not ship');
  if (segments[0] === 'node_modules') assert.ok(!['electron', 'electron-builder', 'playwright', 'playwright-core'].includes(segments[1]), 'Development tooling must not ship');
}
assert.ok(files.some(file => file.endsWith('/desktop/worker.cjs')));
assert.ok(files.some(file => file.endsWith('/desktop/jobs.cjs')));
assert.ok(files.some(file => file.endsWith('/src/writer-guard.cjs')));
assert.ok(files.some(file => file.endsWith('/src/core.js')));
assert.ok(files.some(file => file.includes('/@img/sharp-win32-x64/')));
for (const module of ['desktop/jobs.cjs', 'src/writer-guard.cjs']) {
  assert.ok(extractFile(path.join(root, 'dist/app/win-unpacked/resources/app.asar'), module).equals(fs.readFileSync(path.join(root, module))), 'Packaged job modules must match current source');
}
console.log(JSON.stringify({ packageInventory: 'pass', entries: files.length, privateData: 'excluded', nativeTarget: 'win32-x64' }));
