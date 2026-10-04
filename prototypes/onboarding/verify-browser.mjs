// Optional local browser check. Playwright is supplied by the operator, not an app dependency.
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
const output = fileURLToPath(new URL('../../tmp/onboarding-qa/', import.meta.url));
await mkdir(output, { recursive: true });
const checks = [], errors = [], external = [];
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
const page = await context.newPage();
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
page.on('request', request => { if (/^https?:/.test(request.url())) external.push(request.url()); });
const click = action => page.locator(`[data-action="${action}"]`).first().click();
const scenario = async name => {
  await page.locator('.scenarios > summary').click();
  await page.locator(`[data-scenario="${name}"]`).click();
};
const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('brand-onboarding-synthetic-v1')));
const focused = selector => page.locator(selector).evaluate(node => node === document.activeElement);
const noOverflow = async () => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
const shot = async name => {
  await page.evaluate(() => window.scrollTo(0, 0));
  return page.screenshot({ path: path.join(output, `${name}.png`), fullPage: true });
};
try {
  await page.goto(new URL('index.html', import.meta.url).href);
  await page.keyboard.press('Tab');
  assert.ok(await focused('.skip-link'));
  await page.keyboard.press('Enter');
  assert.ok(await focused('#main'));
  await noOverflow(); await shot('desktop-home');
  checks.push('Skip link reaches main; desktop home has no horizontal overflow.');

  await page.locator('#profile-url').fill('https://instagram.com/p/example');
  await page.locator('#intake-form button[type="submit"]').click();
  assert.ok(await focused('#profile-url'));
  assert.equal(await page.locator('#profile-url').getAttribute('aria-invalid'), 'true');
  assert.ok(await page.locator('#profile-error').isVisible());
  await page.locator('#profile-url').fill('https://www.instagram.com/example_studio/');
  await page.locator('#intake-form button[type="submit"]').click();
  assert.ok(await page.locator('#settings-dialog').isVisible());
  await page.locator('#settings-form button[type="submit"]').click();
  assert.ok(await focused('#apify-key'));
  assert.ok(await page.locator('#settings-error').isVisible());
  await page.keyboard.press('Escape');
  assert.ok(await focused('#intake-form button[type="submit"]'));
  checks.push('Invalid profile and missing demo configuration have linked errors and focus recovery; Escape restores the trigger.');

  await page.locator('#intake-form button[type="submit"]').click();
  await click('fill-demo');
  await page.locator('#settings-form button[type="submit"]').click();
  assert.ok(await page.locator('#run-dialog').isVisible());
  assert.equal(await page.locator('#apify-key').inputValue(), '');
  assert.equal(await page.locator('#analysis-key').inputValue(), '');
  assert.ok(!/demo-apify|demo-openai|instagram\.com/.test(JSON.stringify(await stored())));
  await click('confirm-run');
  await click('home');
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('brand-onboarding-synthetic-v1')).status === 'review-required');
  assert.equal((await stored()).view, 'home');
  assert.ok(await page.locator('#announcement').innerText());
  await page.locator('#projects button').click();
  assert.ok(await focused('main h1'));
  checks.push('Run confirmation is explicit; leaving the view keeps the tab simulation active; no keys or profile URL are saved.');

  await page.locator('#evidence-form button[type="submit"]').click();
  assert.ok(await focused('[name="asset-0"][value="brand-graphic"]'));
  assert.equal(await page.locator('[name="asset-0"]').first().getAttribute('aria-invalid'), 'true');
  for (let index = 0; index < 3; index++) await page.locator(`[name="asset-${index}"][value="excluded"]`).check();
  await page.locator('#evidence-form button[type="submit"]').click();
  assert.match(await page.locator('#evidence-error').innerText(), /al menos una/);
  for (const [index, value] of ['brand-graphic', 'product-photo', 'product-photo'].entries()) await page.locator(`[name="asset-${index}"][value="${value}"]`).check();
  await click('home'); await page.locator('#projects button').click();
  assert.equal(await page.locator('#evidence-form input:checked').count(), 3);
  await noOverflow(); await shot('desktop-evidence');
  assert.equal(await page.locator('.asset-card > img').first().evaluate(node => getComputedStyle(node).objectFit), 'contain');
  await page.locator('#evidence-form button[type="submit"]').click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('brand-onboarding-synthetic-v1')).status === 'ready');
  assert.equal((await stored()).view, 'progress');
  await click('report');
  assert.equal(await page.locator('h1').count(), 1);
  assert.ok(!(await page.locator('main').innerText()).includes('E-MARK-DEMO'));
  assert.ok(await page.locator('.signal').first().innerText());
  await page.locator('.signal details > summary').first().click();
  assert.match(await page.locator('.signal blockquote').first().innerText(), /./);
  await noOverflow(); await shot('desktop-dossier');
  checks.push('Image review rejects incomplete/all-excluded samples, saves partial choices and pauses before analysis; dossier retains evidence and concealed technical IDs.');

  await click('review');
  await page.locator('[name="palette"][value="proposal"]').check();
  await page.locator('[name="rights"][value="demo-permitted"]').check();
  await page.locator('#review-form button[type="submit"]').click();
  await page.locator('[data-task="website-change"]').click();
  assert.ok(await page.locator('[data-action="handoff"]').isDisabled());
  await click('site');
  assert.ok(await page.locator('[data-action="handoff"]').isEnabled());
  assert.equal((await stored()).phase, 4);
  await click('handoff');
  const downloadPending = page.waitForEvent('download');
  await click('download');
  const download = await downloadPending;
  const text = await readFile(await download.path(), 'utf8');
  assert.match(text, /No es un design-brief\/v1 validado/);
  assert.match(text, /website|sitio|Sitio/);
  assert.match(text, /Son elecciones simuladas/);
  assert.match(text, /Las imágenes no se incluyen/);
  checks.push('Selective proposal review never grants authority; site changes require mock access; switching tasks reuses analysis; download discloses its limited example scope.');

  await scenario('stale'); await click('report'); await click('actions');
  assert.ok(await page.locator('[data-action="handoff"]').isDisabled());
  await page.locator('#projects button').click(); await click('evidence');
  await page.locator('#evidence-form button[type="submit"]').click();
  assert.ok(await page.locator('#run-dialog').isVisible());
  assert.match(await page.locator('#extraction-scope').innerText(), /Reutilizado/);
  await click('close-run');
  assert.equal((await stored()).status, 'stale');
  await scenario('failed');
  assert.match(await page.locator('.run-summary').innerText(), /2.700 entrada/);
  await click('request-run');
  assert.match(await page.locator('#extraction-scope').innerText(), /Reutilizado/);
  await click('confirm-run');
  assert.equal((await stored()).phase, 2);
  await page.reload();
  assert.equal((await stored()).status, 'interrupted');
  assert.ok(await page.locator('[data-action="resume"]').isVisible());
  await click('resume');
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('brand-onboarding-synthetic-v1')).status === 'ready');
  checks.push('Stale input blocks new handoff; revised analysis/retries require confirmation and reuse extraction; reload restores interruption, followed by explicit resume.');

  await page.setViewportSize({ width: 390, height: 844 });
  for (const [name, label] of [['first', 'home'], ['evidence', 'evidence'], ['cached', 'dossier'], ['failed', 'failure']]) {
    await scenario(name); await noOverflow(); await shot(`mobile-${label}`);
  }
  await click('settings'); await noOverflow(); await shot('mobile-settings');
  await page.keyboard.press('Escape');
  await scenario('cached'); await click('review'); await noOverflow();
  await page.locator('#review-form button[type="submit"]').click(); await noOverflow();
  await click('handoff'); await noOverflow(); await shot('mobile-handoff');
  await page.setViewportSize({ width: 320, height: 740 });
  for (const name of ['first', 'evidence', 'cached']) { await scenario(name); await noOverflow(); }
  await page.emulateMedia({ reducedMotion: 'reduce' }); await scenario('first');
  assert.equal(await page.locator('.sample-paper').evaluate(node => getComputedStyle(node).transform), 'none');
  await page.locator('.new-project').focus(); await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => getComputedStyle(document.activeElement).outlineWidth), '3px');
  checks.push('390px journey screens/dialog and 320px home/evidence/dossier have no horizontal overflow; reduced motion and keyboard focus styling are active.');
  assert.deepEqual(errors, []); assert.deepEqual(external, []);
  checks.push('No browser console/page errors or HTTP(S) requests during the file-based test.');
  console.log(JSON.stringify({ status: 'pass', checks, screenshots: output }, null, 2));
  await writeFile(path.join(output, 'verification.json'), JSON.stringify({ status: 'pass', checks, errors, external }, null, 2), 'utf8');
} finally { await browser.close(); }
