/** @typedef {'clean-machine' | 'native-shell' | 'assistive-technology' | 'release-decision'} Limit */

/**
 * @typedef {object} AcceptanceCriterion
 * @property {string} id
 * @property {number} issue
 * @property {string} text
 * @property {string[]} evidence
 * @property {string[]} tests
 * @property {Limit[]} manual
 */

export const LIMITS = {
  'clean-machine': 'The runner that starts the script has Node. The packaged child PATH is System32 only, and that child is not an NSIS install on a machine without Node.',
  'native-shell': 'The harness stubs file dialogs and keeps the window hidden. It does not drive the tray, the native folder picker, foreground activation, or Alt+F4.',
  'assistive-technology': 'Keyboard Tab and axe run in the packaged renderer. They do not run Narrator, 200% zoom, or a person reading the status announcements.',
  'release-decision': 'Signing, the Windows version floor, and install or upgrade retention stay on issue 58. This harness does not decide a release.',
};

const PATH_EVIDENCE = 'Packaged child PATH is System32 with no NODE_OPTIONS or secret-like environment';
const SQLITE_EVIDENCE = 'Bundled node:sqlite intent, acknowledgement, inventoried snapshot and fresh-store recovery without external Node or network';
const PIPELINE_EVIDENCE = 'Packaged core analysis/colors/compiler/report: private responses and stable request IDs survive report failure and database reopen, without another provider attempt';
const AUTHORITY_EVIDENCE = 'Packaged task authority: explicit v2 selection/review survives database reopen; changed confirmation revokes execution without granting publication';
const HANDOFF_EVIDENCE = 'Packaged generic/OpenDesign task handoff: explicit inventory, portable export, immutable result/feedback and idempotent supplied effort survive store reopen; unknown billing stays null';
const GUIDED_BROKER_EVIDENCE = 'Packaged guided broker: scoped consent, real stages/partial inventory and spend projection survive reopen without dispatch, percentage or cancellation claims';
const MANAGED_EVIDENCE = 'Managed create/import/open/backup/trash/restore, source byte equality, real Windows DPAPI and cleared password input';
const SHELL_EVIDENCE = 'Packaged core/sharp, isolated renderer, keyboard close dialog and background worker/second instance';
const CRASH_EVIDENCE = 'Renderer crash, menu reopen and observed completion retain the same worker';
const NAVIGATION_EVIDENCE = 'External navigation, popup, fetch blocked; narrow layout and high contrast focus';
const EXIT_EVIDENCE = 'Explicit Exit terminates the worker';
const RELAUNCH_EVIDENCE = 'Fresh app launch retains projects and protected credential configuration; explicit key removal';
const STORAGE_EVIDENCE = 'Managed workspace resolves outside the repository without the shell-test-data redirect';
const GUIDED_UI_EVIDENCE = 'guided-keyboard-and-axe';

const EXIT_TEST = 'explicit Exit rejects new work and kills a worker after a bounded grace period';
const SHELL_IPC_TEST = 'shell IPC accepts fixed actions only and refuses foreign frames';
const WORKSPACE_IPC_TEST = 'IPC rejects arbitrary paths, scope injection, IDs, extra fields and foreign actions';
const IMPORT_TEST = 'native import copies exact bytes and source inventory without rewriting originals';
const CREDENTIAL_TEST = 'credential broker fails closed and never returns saved values or raw exceptions';
const BACKUP_TEST = 'backups are scoped, portable and credential-free; trash is reversible and source is retained';
const DIAGNOSTIC_TEST = 'diagnostic responses never include secrets, paths or raw payloads';
const SECRETS_TEST = 'explicit originals are byte-identical; private configuration and recognizable secrets fail closed';
const JUNCTION_TEST = 'Windows junctions and linked ancestors cannot import/export/delete outside scope';
const MALICIOUS_TEST = 'malicious names, archives, hidden keys and hardlink aliases are refused';
const PROFILE_TEST = 'normalized legacy profile identity is retained and conflicting URLs are refused';
const IMPORT_FAILURE_TEST = 'changed import and registry write failure preserve existing projects and source';
const REGISTRY_TEST = 'registry corruption never resets or overwrites the registry or existing files';
const INTERRUPT_TEST = 'worker interrupt and store reopen show interrupted state with partial inventory semantics';
const STALE_CONSENT_TEST = 'scoped authorization binds plan hash; stale consent and reopen never dispatch';
const NULL_BILLING_TEST = 'null billing stays null; returned zero and tiny amounts retain meaning; mixed currencies stay separate';
const SHARED_ATTEMPT_TEST = 'shared preparation and identical records count each attempt once; token subsets are not added twice';
const CONFLICT_TEST = 'conflicting IDs and malformed amounts or usage reject aggregation';
const EFFORT_TEST = 'wall time and human effort stay separate; unfinished journals still project for UI';
const NOTIFICATION_TEST = 'notification copy and accessibility contracts stay allowlisted';
const PERCENT_TEST = 'projectStages never invent percentages and mark unreached stages';
const STOP_TEST = 'stop does not claim remote cancellation; notifications stay allowlisted';
const COMPLETED_TEST = 'local completed run projects stages and available inventory without fake progress';

/** Acceptance bullets copied from issues 51, 52, and 57. */
export const CRITERIA = [
  {
    id: '51.clean-install',
    issue: 51,
    text: 'A clean Windows installation without external Node opens the packaged app.',
    evidence: [PATH_EVIDENCE],
    tests: [],
    manual: ['clean-machine'],
  },
  {
    id: '51.worker-lifecycle',
    issue: 51,
    text: 'Window close and renderer failure leave a synthetic worker alive; reopen reconnects to that worker; Exit stops it after a bounded grace period.',
    evidence: [SHELL_EVIDENCE, CRASH_EVIDENCE, EXIT_EVIDENCE],
    tests: [EXIT_TEST],
    manual: ['native-shell'],
  },
  {
    id: '51.single-instance',
    issue: 51,
    text: 'A second instance activates the first.',
    evidence: [SHELL_EVIDENCE],
    tests: [],
    manual: ['native-shell'],
  },
  {
    id: '51.isolation',
    issue: 51,
    text: 'Renderer isolation, narrow validated IPC and local content policy are verified; no credentials or arbitrary filesystem execution are exposed.',
    evidence: [SHELL_EVIDENCE, NAVIGATION_EVIDENCE, MANAGED_EVIDENCE],
    tests: [SHELL_IPC_TEST, WORKSPACE_IPC_TEST],
    manual: [],
  },
  {
    id: '51.native-dependencies',
    issue: 51,
    text: 'Packaging includes usable native dependencies and declared Windows support requirements.',
    evidence: [SHELL_EVIDENCE, SQLITE_EVIDENCE, PIPELINE_EVIDENCE],
    tests: [],
    manual: ['release-decision'],
  },
  {
    id: '51.keyboard-shell',
    issue: 51,
    text: 'Keyboard-accessible Open/Exit and visible focus work in the actual Windows shell.',
    evidence: [SHELL_EVIDENCE, NAVIGATION_EVIDENCE, EXIT_EVIDENCE],
    tests: [],
    manual: ['native-shell', 'assistive-technology'],
  },
  {
    id: '52.import-bytes',
    issue: 52,
    text: 'Imported source bytes remain unchanged and imports never rewrite the source project.',
    evidence: [MANAGED_EVIDENCE],
    tests: [IMPORT_TEST],
    manual: [],
  },
  {
    id: '52.keys',
    issue: 52,
    text: 'No keys in renderer/browser storage, project exports, logs, IPC responses or public fixtures. Unavailable protection produces an actionable error.',
    evidence: [MANAGED_EVIDENCE, RELAUNCH_EVIDENCE],
    tests: [CREDENTIAL_TEST, BACKUP_TEST, DIAGNOSTIC_TEST, SECRETS_TEST],
    manual: [],
  },
  {
    id: '52.containment',
    issue: 52,
    text: 'Validate IPC, project identity and resolved containment, including Windows junctions, archive traversal, duplicate paths and malicious filenames.',
    evidence: [STORAGE_EVIDENCE],
    tests: [WORKSPACE_IPC_TEST, JUNCTION_TEST, MALICIOUS_TEST, PROFILE_TEST],
    manual: [],
  },
  {
    id: '52.scope',
    issue: 52,
    text: 'Export/delete require an explicit selected scope; deletion cannot escape that scope.',
    evidence: [MANAGED_EVIDENCE],
    tests: [JUNCTION_TEST, BACKUP_TEST],
    manual: [],
  },
  {
    id: '52.registry-errors',
    issue: 52,
    text: 'Registry/import failures preserve existing projects and show recoverable, keyboard-accessible errors.',
    evidence: [MANAGED_EVIDENCE],
    tests: [IMPORT_FAILURE_TEST, REGISTRY_TEST],
    manual: [],
  },
  {
    id: '57.reconnect',
    issue: 57,
    text: 'Reconnect/window close/worker failure show actual stages and available partial inventory; reopening never dispatches.',
    evidence: [GUIDED_BROKER_EVIDENCE],
    tests: [INTERRUPT_TEST, STALE_CONSENT_TEST],
    manual: [],
  },
  {
    id: '57.amounts',
    issue: 57,
    text: 'Null/zero, tiny positive amounts, mixed currencies, duplicate/conflicting IDs and partial coverage remain explicit. Token subsets are not added twice; wall time and human effort stay separate.',
    evidence: [],
    tests: [NULL_BILLING_TEST, SHARED_ATTEMPT_TEST, CONFLICT_TEST, EFFORT_TEST],
    manual: [],
  },
  {
    id: '57.authorization',
    issue: 57,
    text: 'Authorization binds to current inputs/config/revision and rejects stale modal confirmation.',
    evidence: [GUIDED_BROKER_EVIDENCE, GUIDED_UI_EVIDENCE, AUTHORITY_EVIDENCE],
    tests: [STALE_CONSENT_TEST],
    manual: [],
  },
  {
    id: '57.accessibility',
    issue: 57,
    text: 'Keyboard, focus, linked errors, status announcements, Narrator, zoom, high contrast and reduced motion are reviewed in the packaged Windows app.',
    evidence: [GUIDED_UI_EVIDENCE, NAVIGATION_EVIDENCE],
    tests: [NOTIFICATION_TEST],
    manual: ['assistive-technology'],
  },
  {
    id: '57.redaction',
    issue: 57,
    text: 'Errors/notifications contain no secret, profile identifier, raw payload or private path.',
    evidence: [GUIDED_BROKER_EVIDENCE],
    tests: [DIAGNOSTIC_TEST, NOTIFICATION_TEST],
    manual: [],
  },
  {
    id: '57.no-fake-progress',
    issue: 57,
    text: 'No fake percentage, fabricated invoice or unsupported cancellation claim.',
    evidence: [GUIDED_BROKER_EVIDENCE, HANDOFF_EVIDENCE],
    tests: [PERCENT_TEST, STOP_TEST, COMPLETED_TEST],
    manual: [],
  },
];

const ISSUE_BULLET_COUNTS = { 51: 6, 52: 5, 57: 6 };

/**
 * automated when the row has evidence or tests and no manual limit.
 * partial when both sides are present.
 * manual when the row has limits and no evidence or tests.
 * @param {AcceptanceCriterion} criterion
 * @returns {'automated' | 'partial' | 'manual'}
 */
export function disposition(criterion) {
  const hasProof = criterion.evidence.length > 0 || criterion.tests.length > 0;
  const hasManual = criterion.manual.length > 0;
  if (!hasProof && hasManual) return 'manual';
  if (hasProof && hasManual) return 'partial';
  if (hasProof) return 'automated';
  throw new Error(`${criterion.id} has no proof and no manual limit`);
}

function assertRegistry(criteria) {
  const ids = new Set();
  const texts = new Set();
  /** @type {Record<number, number>} */
  const counts = { 51: 0, 52: 0, 57: 0 };
  for (const criterion of criteria) {
    if (ids.has(criterion.id)) throw new Error(`duplicate criterion ${criterion.id}`);
    ids.add(criterion.id);
    if (!Object.hasOwn(ISSUE_BULLET_COUNTS, criterion.issue)) throw new Error(`${criterion.id} issue must be 51, 52, or 57`);
    counts[criterion.issue] += 1;
    if (typeof criterion.text !== 'string' || !criterion.text.endsWith('.')) throw new Error(`${criterion.id} text must be a verbatim bullet`);
    if (texts.has(criterion.text)) throw new Error(`duplicate bullet ${criterion.id}`);
    texts.add(criterion.text);
    if (criterion.text.includes('|')) throw new Error(`${criterion.id} text contains a table pipe`);
    for (const name of [...criterion.evidence, ...criterion.tests]) {
      if (typeof name !== 'string' || !name || name.includes('|')) throw new Error(`${criterion.id} has an empty or piped proof name`);
    }
    const limits = new Set();
    for (const limit of criterion.manual) {
      if (!Object.hasOwn(LIMITS, limit)) throw new Error(`${criterion.id} unknown limit ${limit}`);
      if (limits.has(limit)) throw new Error(`${criterion.id} repeats ${limit}`);
      limits.add(limit);
    }
    disposition(criterion);
  }
  for (const [issue, count] of Object.entries(ISSUE_BULLET_COUNTS)) {
    if (counts[issue] !== count) throw new Error(`issue ${issue} has ${counts[issue]} bullets, expected ${count}`);
  }
}

assertRegistry(CRITERIA);
