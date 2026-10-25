import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CRITERIA, LIMITS, disposition } from './registry.mjs';
import { INSTALLER_ACCEPTANCE, INSTALLER_EVIDENCE, INSTALL_SUPPORT } from './install.mjs';

const GUIDED_NAME = 'guided-keyboard-and-axe';
const SUPPORT_START = '<!-- install-support -->';
const SUPPORT_END = '<!-- /install-support -->';
const PRIOR_BUILD = 'pnpm app:build "-c.extraMetadata.version=0.0.1" "-c.directories.output=dist/app-prior"';
const WORKFLOW = Object.freeze({
  shell: ['pnpm test', 'pnpm app:cite', 'pnpm app:build', 'node desktop/audit-package.mjs', 'pnpm app:verify --packaged', 'pnpm app:guided'],
  installer: [PRIOR_BUILD, 'pnpm app:install'],
});
const WATCHED = ['docs/manual-acceptance-debt.md', 'docs/windows-app-shell.md', '.csdd/decisions.md'];

function normalize(text) {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function proofCell(criterion) {
  return [...criterion.evidence, ...criterion.tests].join('; ') || 'None';
}

function series(items) {
  return items.length < 3 ? items.join(' and ') : `${items.slice(0, -1).join(', ')}, and ${items.at(-1)}`;
}

/** @param {string} text @param {string} start @param {string} [end] */
function between(text, start, end) {
  const from = text.indexOf(start);
  if (from < 0) return null;
  const to = end ? text.indexOf(end, from + start.length) : -1;
  return to < 0 ? text.slice(from) : text.slice(from, to);
}

/**
 * @param {typeof CRITERIA} criteria
 * @returns {string}
 */
export function renderDebtDoc(criteria = CRITERIA) {
  const issues = [...new Set(criteria.map(criterion => criterion.issue))];
  const lines = [
    '# Manual acceptance debt',
    '',
    `This file lists every acceptance bullet from issues ${series(issues.map(String))}. The bullet text is copied from the Acceptance section of each issue. \`pnpm app:cite\` checks this file against \`desktop/acceptance/registry.mjs\`. It does not read GitHub, and it does not mark a manual row passed.`,
    '',
    'A row is automated when it has evidence or unit tests and an empty manual list. A row is partial when it has both. A row is manual when it has limits and no evidence or tests. Partial and manual rows still need a person.',
    '',
    '## Commands',
    '',
    'The Windows workflow runs two jobs on `windows-latest`. The shell job runs these commands in this order.',
    '',
    '```powershell',
    ...WORKFLOW.shell,
    '```',
    '',
    '`pnpm app:verify --packaged` launches `dist/app/win-unpacked/Instagram to OpenDesign.exe`. The packaged child `PATH` is `System32` only. The job that starts the script still has Node. `pnpm app:guided` uses that same unpacked executable in the same job.',
    '',
    'The installer job needs the shell job and starts on a fresh runner where the app has never run. It downloads the audited shell setup into `dist/app` as the upgrade target. Then it runs these commands in this order.',
    '',
    '```powershell',
    ...WORKFLOW.installer,
    '```',
    '',
    'The first command rebuilds the same commit as version 0.0.1 into `dist/app-prior`, which is the version the run installs first. `pnpm app:install` runs the issue 58 phases below against the two setups and writes `tmp/app-install-qa/installer-report.json`. The job uploads the report and both setups.',
    '',
    '## Limits',
    '',
    '| Limit | Why it stays manual |',
    '| --- | --- |',
  ];
  for (const [id, text] of Object.entries(LIMITS)) lines.push(`| ${id} | ${text} |`);
  lines.push(
    '',
    '## Criteria',
    '',
    '| Id | Issue | Disposition | Bullet | Proof | Manual |',
    '| --- | --- | --- | --- | --- | --- |',
  );
  for (const criterion of criteria) {
    const issue = `[#${criterion.issue}](https://github.com/ValenFelizia/instagram-to-opendesign/issues/${criterion.issue})`;
    const manual = criterion.manual.join(', ') || 'None';
    lines.push(`| ${criterion.id} | ${issue} | ${disposition(criterion)} | ${criterion.text} | ${proofCell(criterion)} | ${manual} |`);
  }
  lines.push(
    '',
    '## Issue 58',
    '',
    '`runInstallerAcceptance` in `desktop/acceptance/install.mjs` runs these phases once, in this order, and stops at the first failure. Each phase declares its effect on three roots: the install directory, the Local workspace root `%LOCALAPPDATA%\\Instagram to OpenDesign` and the Roaming profile root `%APPDATA%\\Instagram to OpenDesign`. The machine snapshots every root after each phase and fails the phase when a root does not match its declared effect. The uninstall rows are the documented retention policy.',
    '',
    '| Phase | Install directory | Local workspace | Roaming profile | Evidence |',
    '| --- | --- | --- | --- | --- |',
  );
  for (const phase of INSTALLER_ACCEPTANCE.phases) {
    const { install, local, roaming } = phase.effects;
    lines.push(`| ${phase.name} | ${install} | ${local} | ${roaming} | ${phase.evidence || 'None'} |`);
  }
  lines.push('');
  for (const phase of INSTALLER_ACCEPTANCE.phases) {
    if (phase.note) lines.push(`- ${phase.name}: ${phase.note}`);
  }
  lines.push(
    '',
    '### Effects',
    '',
    '| Effect | Meaning |',
    '| --- | --- |',
  );
  for (const [effect, meaning] of Object.entries(INSTALLER_ACCEPTANCE.effects)) lines.push(`| ${effect} | ${meaning} |`);
  lines.push(
    '',
    '### Install support',
    '',
    'These statements are DEC-015 in `.csdd/decisions.md`, accepted on 2026-10-18. `docs/windows-app-shell.md` repeats them, and `pnpm app:cite` fails when either copy drifts.',
    '',
    '| Topic | Statement |',
    '| --- | --- |',
  );
  for (const [topic, statement] of Object.entries(INSTALL_SUPPORT)) lines.push(`| ${topic} | ${statement} |`);
  lines.push(
    '',
    '## Hosted runner risks',
    '',
    '- GitHub-hosted `windows-latest` has Node so the job can start. The clean-machine limit stays open.',
    '- `LOCALAPPDATA` on that runner is outside the checkout. The storage check resolves it to its long path before use, because an 8.3 short name fails the app path guards. The packaged-default launch throws when `dataRoot` is inside the repo, including when only the drive letter case differs. A runner that points `LOCALAPPDATA` at the workspace fails the storage check instead of passing it.',
    '- CI sets `TEMP` and `TMP` to an unaliased directory under the workspace. Short 8.3 paths fail the canonical path guards. Do not point those variables at a short name.',
    '- The guided window is hidden with `--shell-test-hidden`. Tab order is asserted on that window. A visible window can still differ. Narrator is not part of the job.',
    '- axe fails the job on serious and critical impacts. Moderate and minor impacts stay in `tmp/app-shell-qa/guided/axe.json` and do not fail the job.',
    '- The page CSP is `script-src \'self\'`. The guided script injects axe with `webContents.executeJavaScript`. If that injection is blocked, change the test process. Do not weaken the page CSP.',
    '- Verify and guided share one job, so the workflow does not upload the unpacked app between jobs. The job timeout is 30 minutes. A slow install plus the packaged launches can still hit that limit.',
    '- The packaged-default launch uses the app user-data directory rather than `--shell-test-data`. A leftover process from an earlier run on the same machine can make that launch exit immediately.',
    '- Chromium profiles are written under `tmp/app-shell-profiles` and are not part of the uploaded artifact. Reports, screenshots, and axe JSON are under `tmp/app-shell-qa`.',
    '- Installer preflight fails when the install directory, the Local workspace root, or the Roaming profile root already exists. The shell job writes both data roots, so the installer phases cannot run in that job.',
    '- The installer job installs a setup it downloaded as an artifact, which carries no Mark of the Web. SmartScreen never runs, so the smartscreen limit stays open.',
    '- `pnpm app:install` resolves `LOCALAPPDATA` and `APPDATA` to their long paths before the run. The installed app reads `LOCALAPPDATA` as given, and its path guards refuse an 8.3 short name.',
    '- The installer job timeout is 30 minutes. It installs dependencies, builds the prior setup, and then runs two installs, two uninstalls, and several app launches. Each phase also has its own timeout.',
    '',
  );
  return lines.join('\n');
}

function scanPushes(source, file) {
  /** @type {string[]} */
  const names = [];
  /** @type {string[]} */
  const dynamic = [];
  for (const line of source.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('results.push(')) continue;
    const match = trimmed.match(/^results\.push\((['"])(.*)\1\);?$/);
    if (!match || (match[1] === '`' && match[2].includes('${'))) {
      dynamic.push(`${file}: ${trimmed}`);
      continue;
    }
    names.push(match[2]);
  }
  return { names, dynamic };
}

/**
 * @param {string} repoRoot
 * @returns {Promise<string[]>}
 */
export async function checkDebt(repoRoot) {
  /** @type {string[]} */
  const errors = [];
  const verifyPath = path.join(repoRoot, 'desktop', 'verify.mjs');
  const guidedPath = path.join(repoRoot, 'desktop', 'acceptance', 'guided-ui.mjs');
  const docPath = path.join(repoRoot, 'docs', 'manual-acceptance-debt.md');
  const workflowPath = path.join(repoRoot, '.github', 'workflows', 'windows-app.yml');
  const packagePath = path.join(repoRoot, 'package.json');
  const auditPath = path.join(repoRoot, 'desktop', 'audit-package.mjs');
  const builderPath = path.join(repoRoot, 'desktop', 'builder.json');
  const decisionsPath = path.join(repoRoot, '.csdd', 'decisions.md');
  const shellDocPath = path.join(repoRoot, 'docs', 'windows-app-shell.md');
  const [verify, guided, doc, workflow, packageJson, audit, builder, decisions, shellDoc, testFiles] = await Promise.all([
    readFile(verifyPath, 'utf8'),
    readFile(guidedPath, 'utf8'),
    readFile(docPath, 'utf8').catch(() => ''),
    readFile(workflowPath, 'utf8'),
    readFile(packagePath, 'utf8'),
    readFile(auditPath, 'utf8'),
    readFile(builderPath, 'utf8'),
    readFile(decisionsPath, 'utf8'),
    readFile(shellDocPath, 'utf8'),
    readdir(path.join(repoRoot, 'test')).then(names => Promise.all(
      names.filter(name => name.endsWith('.test.js')).map(name => readFile(path.join(repoRoot, 'test', name), 'utf8')),
    )),
  ]);
  const scanned = scanPushes(verify, 'desktop/verify.mjs');
  for (const line of scanned.dynamic) errors.push(`evidence names must be static literals: ${line}`);
  const guidedName = guided.match(/const GUIDED_EVIDENCE_NAME = '([^']+)';/);
  if (!guidedName) errors.push('desktop/acceptance/guided-ui.mjs is missing GUIDED_EVIDENCE_NAME');
  else if (guidedName[1] !== GUIDED_NAME) errors.push(`guided evidence name is ${guidedName[1]}`);
  if (!guided.includes('name: GUIDED_EVIDENCE_NAME')) errors.push('guided report must use GUIDED_EVIDENCE_NAME');
  const evidence = new Set([...scanned.names, ...Object.values(INSTALLER_EVIDENCE)]);
  if (guidedName) evidence.add(guidedName[1]);
  const claimed = new Set(CRITERIA.flatMap(criterion => criterion.evidence));
  for (const name of evidence) {
    if (!claimed.has(name)) errors.push(`evidence name missing from registry: ${name}`);
  }
  for (const name of claimed) {
    if (!evidence.has(name)) errors.push(`registry evidence missing from the scripts: ${name}`);
  }
  for (const criterion of CRITERIA) {
    for (const title of criterion.tests) {
      const single = `test('${title}'`;
      const double = `test("${title}"`;
      if (!testFiles.some(source => source.includes(single) || source.includes(double))) {
        errors.push(`unknown test name: ${title}`);
      }
    }
  }
  if (normalize(doc) !== normalize(renderDebtDoc())) errors.push('docs/manual-acceptance-debt.md disagrees with the registry');
  const pkg = JSON.parse(packageJson);
  if (!pkg.devDependencies?.['axe-core']) errors.push('axe-core must be a devDependency');
  if (pkg.dependencies?.['axe-core']) errors.push('axe-core must not be a production dependency');
  if (pkg.scripts?.['app:cite'] !== 'node desktop/acceptance/cite.mjs') errors.push('package.json is missing app:cite');
  if (pkg.scripts?.['app:guided'] !== 'node desktop/acceptance/guided-ui.mjs') errors.push('package.json is missing app:guided');
  if (!audit.includes("'axe-core'")) errors.push('desktop/audit-package.mjs must deny axe-core');
  if (!audit.includes('desktop/acceptance/')) errors.push('desktop/audit-package.mjs must deny desktop/acceptance');
  const built = JSON.parse(builder);
  if (JSON.stringify(built.files || []).includes('acceptance')) errors.push('desktop/builder.json must not package desktop/acceptance');
  for (const key of ['oneClick', 'perMachine', 'runAfterFinish', 'deleteAppDataOnUninstall']) {
    if (built.nsis?.[key] !== false) errors.push(`desktop/builder.json nsis.${key} must be false`);
  }
  if (built.publish !== null) errors.push('desktop/builder.json publish must be null');
  if (pkg.dependencies?.['electron-updater'] || pkg.devDependencies?.['electron-updater']) errors.push('electron-updater must not be a dependency');
  const decision = between(normalize(decisions), '## DEC-015', '\n## ');
  const support = between(normalize(shellDoc), SUPPORT_START, SUPPORT_END);
  if (!decision) errors.push('.csdd/decisions.md is missing DEC-015');
  if (!support || !shellDoc.includes(SUPPORT_END)) errors.push('docs/windows-app-shell.md is missing the install-support block');
  for (const [topic, statement] of Object.entries(INSTALL_SUPPORT)) {
    if (decision && !decision.includes(statement)) errors.push(`DEC-015 disagrees with INSTALL_SUPPORT.${topic}`);
    if (support && !support.includes(statement)) errors.push(`docs/windows-app-shell.md disagrees with INSTALL_SUPPORT.${topic}`);
  }
  if (pkg.scripts?.['app:install'] !== 'node desktop/acceptance/install.mjs') errors.push('package.json is missing app:install');
  const jobs = Object.keys(WORKFLOW);
  jobs.forEach((job, index) => {
    const next = jobs[index + 1];
    const body = between(normalize(workflow), `\n  ${job}:\n`, next && `\n  ${next}:\n`);
    if (!body) {
      errors.push(`workflow is missing the ${job} job`);
      return;
    }
    for (const command of WORKFLOW[job]) {
      if (!body.includes(command)) errors.push(`workflow ${job} job is missing ${command}`);
    }
    if (!body.includes('runs-on: windows-latest')) errors.push(`workflow ${job} job must run on windows-latest`);
    if (!body.includes('if: always()')) errors.push(`workflow ${job} job must upload artifacts when it fails`);
  });
  if (!workflow.includes('needs: shell')) errors.push('workflow installer job must need the shell job');
  for (const file of WATCHED) {
    if (workflow.split(`'${file}'`).length < 3) errors.push(`workflow pull_request and push paths must include ${file}`);
  }
  return errors;
}

const here = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(here)) {
  const repoRoot = path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
  const errors = await checkDebt(repoRoot);
  if (errors.length) {
    for (const error of errors) console.error(error);
    process.exit(1);
  }
  console.log(`acceptance cite ok (${CRITERIA.length} criteria)`);
}
