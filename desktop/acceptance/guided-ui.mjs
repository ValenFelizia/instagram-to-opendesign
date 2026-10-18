import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, mkdtemp, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchPackagedApp, packagedExe } from './launch.mjs';

const require = createRequire(import.meta.url);
const GUIDED_EVIDENCE_NAME = 'guided-keyboard-and-axe';

async function writeJson(file, value) {
  const temporary = `${file}.${process.pid}.tmp`;
  await writeFile(temporary, JSON.stringify(value, null, 2));
  await rename(temporary, file);
}

async function tabbableIds(page, rootSelector) {
  return page.evaluate(selector => {
    const root = document.querySelector(selector);
    if (!root) throw new Error(`missing ${selector}`);
    const nodes = [...root.querySelectorAll('a[href], button, input, select, textarea, summary, [tabindex]')];
    const ids = [];
    for (const el of nodes) {
      if (el.tabIndex < 0 || el.disabled) continue;
      if (el.closest('[hidden]')) continue;
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      if (!el.id) throw new Error(`tabbable control has no id in ${selector}`);
      ids.push(el.id);
    }
    return ids;
  }, rootSelector);
}

async function focusHop(page) {
  return page.evaluate(() => {
    const el = document.activeElement;
    return { id: el?.id || '', outlineStyle: el ? getComputedStyle(el).outlineStyle : 'none' };
  });
}

/**
 * @param {import('playwright').Page} page
 * @param {string} rootSelector
 * @param {Array<{ index: number, id: string, outlineStyle: string }>} hops
 */
async function walkFocus(page, rootSelector, hops) {
  const ids = await tabbableIds(page, rootSelector);
  assert.ok(ids.length >= 2, `${rootSelector} needs at least two tabbable controls`);
  await page.locator(`#${ids[0]}`).focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  for (let index = 0; index < ids.length; index += 1) {
    if (index > 0) await page.keyboard.press('Tab');
    const hop = await focusHop(page);
    assert.equal(hop.id, ids[index], `${rootSelector} focus ${index}`);
    assert.notEqual(hop.outlineStyle, 'none', `${hop.id} outline`);
    hops.push({ index: hops.length, id: hop.id, outlineStyle: hop.outlineStyle });
  }
  await page.keyboard.press('Shift+Tab');
  const back = await focusHop(page);
  assert.equal(back.id, ids[ids.length - 2], `${rootSelector} Shift+Tab`);
}

// addScriptTag is blocked by the page CSP (script-src 'self'). The main process reads axe and runs it with executeJavaScript.
async function injectAxe(session) {
  const axePath = require.resolve('axe-core');
  await session.app.evaluate(async ({ BrowserWindow }, file) => {
    const code = process.getBuiltinModule('fs').readFileSync(file, 'utf8');
    await BrowserWindow.getAllWindows()[0].webContents.executeJavaScript(code);
  }, axePath);
  const ready = await session.page.evaluate(() => typeof window.axe?.run === 'function');
  if (!ready) throw new Error('axe-core did not load in the renderer. Keep the page CSP and fix the test injection.');
}

async function scan(page, screen, selector) {
  const violations = await page.evaluate(async root => {
    const target = document.querySelector(root);
    const result = await window.axe.run(target, { resultTypes: ['violations'] });
    return result.violations.map(item => ({
      id: item.id,
      impact: item.impact || 'unknown',
      nodes: item.nodes.length,
      help: item.help,
    }));
  }, selector);
  return { screen, violationCount: violations.length, violations };
}

/**
 * @param {import('./launch.mjs').LaunchSession} session
 */
export async function runGuidedAcceptance(session) {
  if (session?.spec?.kind !== 'packaged-test') throw new Error('guided acceptance requires a packaged-test session');
  await mkdir(session.spec.outputDir, { recursive: true });
  const page = session.page;
  const hops = [];
  const axe = [];
  try {
    await page.locator('#start').waitFor();
    await session.poll(() => page.evaluate(() => window.appShell.status()), value => value.state?.status === 'idle');
    await page.evaluate(() => {
      window.__acceptanceConfirmed = false;
      document.getElementById('confirm-consent').addEventListener('click', () => { window.__acceptanceConfirmed = true; }, true);
    });
    await page.locator('#new-project').click();
    await page.locator('#project-name').fill('Example studio');
    await page.locator('#project-url').fill('https://www.instagram.com/example.studio/');
    await page.locator('#save-project').click();
    await page.locator('#project-dialog').waitFor({ state: 'hidden' });
    await page.locator('#guided-panel').waitFor({ state: 'visible' });
    await page.locator('#guided-plan').waitFor();
    await session.screenshot('guided-idle.png');
    await walkFocus(page, '#guided-panel', hops);
    await injectAxe(session);
    axe.push(await scan(page, 'guided-panel', '#guided-panel'));
    await page.locator('#guided-plan').focus();
    await page.keyboard.press('Enter');
    try {
      await page.locator('#guided-review-scope').waitFor({ timeout: 20000 });
    } catch (error) {
      const message = await page.locator('#guided-error').textContent().catch(() => '');
      throw new Error(message ? `guided plan failed: ${message}` : error.message);
    }
    await page.locator('#guided-review-scope').focus();
    await page.keyboard.press('Enter');
    await page.locator('#consent-dialog').waitFor({ state: 'visible' });
    await session.screenshot('guided-consent.png');
    axe.push(await scan(page, 'consent-dialog', '#consent-dialog'));
    await walkFocus(page, '#consent-dialog', hops);
    await page.keyboard.press('Escape');
    await page.locator('#consent-dialog').waitFor({ state: 'hidden' });
    assert.equal(await page.locator('#authorize').isChecked(), false);
    const jobState = await page.evaluate(async () => {
      const listed = await window.localWorkspace.list();
      const status = await window.guidedWork.status(listed.workspace.active);
      return status.progress?.job?.state || 'none';
    });
    const confirmedPaidWork = await page.evaluate(() => window.__acceptanceConfirmed === true);
    assert.equal(confirmedPaidWork, false);
    assert.notEqual(jobState, 'running');
    assert.equal(jobState, 'queued');
    await page.locator('#settings').focus();
    await page.keyboard.press('Enter');
    await page.locator('#settings-dialog').waitFor({ state: 'visible' });
    await page.locator('#provider').waitFor();
    await session.screenshot('guided-settings.png');
    axe.push(await scan(page, 'settings-dialog', '#settings-dialog'));
    await walkFocus(page, '#settings-dialog', hops);
    await page.keyboard.press('Escape');
    await page.locator('#settings-dialog').waitFor({ state: 'hidden' });
    assert.equal(await page.locator('#credential-key').inputValue(), '');
    const blocking = axe.flatMap(screen => screen.violations
      .filter(item => item.impact === 'serious' || item.impact === 'critical')
      .map(item => `${screen.screen}:${item.id}:${item.impact}`));
    const report = {
      name: GUIDED_EVIDENCE_NAME,
      hops,
      axe,
      consent: 'closed-without-confirm',
      jobState,
      confirmedPaidWork: false,
    };
    if (blocking.length) throw new Error(`axe serious or critical: ${blocking.join(', ')}`);
    return report;
  } finally {
    if (axe.length) await writeJson(path.win32.join(session.spec.outputDir, 'axe.json'), axe);
  }
}

const here = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(here)) {
  const repoRoot = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
  const outputDir = path.resolve(repoRoot, 'tmp', 'app-shell-qa', 'guided');
  const profiles = path.resolve(repoRoot, 'tmp', 'app-shell-profiles');
  await mkdir(outputDir, { recursive: true });
  await mkdir(profiles, { recursive: true });
  const profileDir = await mkdtemp(path.join(profiles, 'guided-'));
  const session = await launchPackagedApp({
    kind: 'packaged-test',
    exe: packagedExe(repoRoot),
    profileDir,
    outputDir,
  });
  let report = null;
  try {
    report = await runGuidedAcceptance(session);
    await writeJson(path.join(outputDir, 'report.json'), report);
    console.log(JSON.stringify({ name: report.name, jobState: report.jobState, confirmedPaidWork: report.confirmedPaidWork, hops: report.hops.length }, null, 2));
  } catch (error) {
    await writeJson(path.join(outputDir, 'report.json'), {
      name: GUIDED_EVIDENCE_NAME,
      error: error instanceof Error ? error.message : String(error),
      partial: report,
    });
    throw error;
  } finally {
    await session.close();
  }
}
