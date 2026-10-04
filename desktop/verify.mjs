import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { _electron } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const packaged = process.argv.includes('--packaged');
const output = path.join(root, 'tmp', 'app-shell-qa');
await mkdir(output, { recursive: true });
const profile = await mkdtemp(path.join(output, 'chromium-'));
const exe = packaged ? path.join(root, 'dist', 'app', 'win-unpacked', 'Instagram to OpenDesign.exe') : require('electron');
const args = [...(packaged ? [] : [root]), `--shell-test-data=${profile}`, '--shell-test-hidden'];
// No Node path or provider key is available to the packaged application.
const env = Object.fromEntries(['SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'COMSPEC', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA'].filter(key => process.env[key]).map(key => [key, process.env[key]]));
env.PATH = path.join(process.env.SystemRoot, 'System32');
const results = [];
let electronApp;
async function poll(operation, expected, timeout = 15000) {
  const end = Date.now() + timeout;
  let result;
  do { result = await operation(); if (expected(result)) return result; await new Promise(resolve => setTimeout(resolve, 100)); } while (Date.now() < end);
  throw new Error(`Condition timed out: ${JSON.stringify(result)}`);
}
async function workerPid() {
  return electronApp.evaluate(({ app }) => app.getAppMetrics().find(item => item.name === 'Local shell check')?.pid);
}
try {
  electronApp = await _electron.launch({ executablePath: exe, args, env, timeout: 30000 });
  let page = await electronApp.firstWindow();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.locator('#start').waitFor();
  await poll(() => page.evaluate(() => window.appShell.status()), value => value.state?.status === 'idle');
  assert.deepEqual(await page.evaluate(() => [typeof require, typeof process]), ['undefined', 'undefined']);
  const prefs = await electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences());
  assert.equal(prefs.sandbox, true); assert.equal(prefs.contextIsolation, true); assert.equal(prefs.nodeIntegration, false);
  await page.evaluate(() => document.querySelector('.skip').click());
  assert.equal((await page.evaluate(() => window.appShell.status())).ok, true);
  await page.locator('#start').focus();
  const focus = await page.locator('#start').evaluate(el => getComputedStyle(el).outlineStyle);
  assert.notEqual(focus, 'none');
  await page.keyboard.press('Enter');
  await poll(() => page.evaluate(() => window.appShell.status()), value => value.state?.ticks >= 1);
  const pid = await workerPid(); assert.ok(pid);
  const before = (await page.evaluate(() => window.appShell.status())).state.ticks;
  assert.equal((await page.evaluate(() => window.appShell.startCheck())).ok, false);
  await electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
  await page.locator('#close-dialog').waitFor({ state: 'visible' });
  assert.equal(await page.evaluate(() => document.activeElement.id), 'keep-open');
  await page.keyboard.press('Escape');
  await page.locator('#close-dialog').waitFor({ state: 'hidden' });
  await poll(() => page.evaluate(() => document.activeElement.id), value => value === 'exit');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'exit');
  await electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
  await page.locator('#confirm-close').click();
  await poll(() => electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length), value => value === 0);
  await new Promise(resolve => setTimeout(resolve, 1100));
  assert.equal(await workerPid(), pid);
  const newWindow = electronApp.waitForEvent('window');
  const second = spawn(exe, args, { env, windowsHide: true, stdio: 'ignore' });
  await new Promise((resolve, reject) => { second.once('error', reject); second.once('exit', code => code === 0 ? resolve() : reject(new Error(`Second instance exited ${code}`))); });
  page = await newWindow;
  await page.waitForLoadState();
  const resumed = await page.evaluate(() => window.appShell.status());
  assert.ok(resumed.state.ticks > before); assert.equal(await workerPid(), pid);
  assert.equal(await electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length), 1);
  results.push('Packaged core/sharp, isolated renderer, keyboard close dialog and background worker/second instance');
  await page.screenshot({ path: path.join(output, packaged ? 'packaged.png' : 'development.png') });
  // Renderer failure is independent of utility process ownership.
  await electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.forcefullyCrashRenderer());
  assert.equal(await workerPid(), pid);
  await poll(() => electronApp.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length), value => value === 0);
  const reopened = electronApp.waitForEvent('window');
  await electronApp.evaluate(({ Menu }) => Menu.getApplicationMenu().items[0].submenu.items[0].click());
  page = await reopened; await page.waitForLoadState();
  await poll(() => page.evaluate(() => window.appShell.status()), value => value.state?.status === 'completed');
  assert.equal(await workerPid(), pid);
  results.push('Renderer crash, menu reopen and observed completion retain the same worker');
  await page.setViewportSize({ width: 360, height: 650 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.emulateMedia({ forcedColors: 'active', reducedMotion: 'reduce' });
  await page.locator('#start').focus();
  assert.notEqual(await page.locator('#start').evaluate(el => getComputedStyle(el).outlineStyle), 'none');
  const current = page.url();
  await page.evaluate(() => { location.href = 'https://example.invalid/'; });
  await new Promise(resolve => setTimeout(resolve, 200));
  assert.equal(page.url(), current);
  assert.equal(await page.evaluate(() => window.open('https://example.invalid/') === null), true);
  const networkDenied = await page.evaluate(async () => { try { await fetch('https://example.invalid/'); return false; } catch { return true; } });
  assert.equal(networkDenied, true);
  assert.deepEqual(errors, []);
  results.push('External navigation, popup, fetch blocked; narrow layout and high contrast focus');
  const closed = electronApp.waitForEvent('close');
  await page.evaluate(() => window.appShell.exit());
  await closed;
  // OS process lookup must show that explicit Exit terminated the utility worker.
  assert.throws(() => process.kill(pid, 0));
  results.push('Explicit Exit terminates the worker');
  await writeFile(path.join(output, packaged ? 'packaged-verification.json' : 'development-verification.json'), JSON.stringify({ packaged, results }, null, 2));
  console.log(JSON.stringify({ packaged, passed: results }, null, 2));
} finally {
  if (electronApp) await electronApp.close().catch(() => {});
}
