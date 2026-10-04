// Synthetic, single-writer lifecycle experiment. Not a production job store.
import { mkdir, open, readFile, readdir, rename } from 'node:fs/promises';
import path from 'node:path';

export const fixtureHash = 'synthetic-input-v1';
const kinds = new Set(['queued', 'running', 'local-checkpoint', 'attempt-started',
  'attempt-response', 'review-required', 'completed', 'failed', 'interrupted']);

export function replay(events) {
  const state = { status: null, localCheckpoint: false, attempt: null, history: [] };
  for (const [index, event] of events.entries()) {
    if (event.version !== 'lifecycle-spike/v1' || event.seq !== index + 1 ||
        event.inputHash !== fixtureHash || !kinds.has(event.kind)) throw new Error('INVALID_EVENT');
    const kind = event.kind;
    if (kind === 'queued') {
      if (index !== 0) throw new Error('INVALID_TRANSITION');
      state.status = 'queued';
    } else if (kind === 'running') {
      if (state.status !== 'queued') throw new Error('INVALID_TRANSITION');
      state.status = 'running';
    } else {
      if (state.status !== 'running') throw new Error('INVALID_TRANSITION');
      if (kind === 'local-checkpoint') state.localCheckpoint = true;
      else if (kind === 'attempt-started') {
        if (state.attempt) throw new Error('DUPLICATE_ATTEMPT');
        state.attempt = { id: 'synthetic-attempt-1', responseSaved: false };
      } else if (kind === 'attempt-response') {
        if (!state.attempt || state.attempt.responseSaved) throw new Error('INVALID_TRANSITION');
        state.attempt.responseSaved = true;
      } else {
        if (kind === 'completed' && (!state.localCheckpoint || state.attempt && !state.attempt.responseSaved)) {
          throw new Error('INCOMPLETE_RESULT');
        }
        state.status = kind;
      }
    }
    state.history.push(event);
  }
  return state;
}

export async function load(root) {
  let files;
  try { files = await readdir(root); }
  catch (error) { if (error.code === 'ENOENT') return replay([]); throw error; }
  const committed = files.filter(file => /^\d{6}\.json$/.test(file)).sort();
  const events = [];
  for (const file of committed) {
    const event = JSON.parse(await readFile(path.join(root, file), 'utf8'));
    if (file !== `${String(events.length + 1).padStart(6, '0')}.json`) throw new Error('EVENT_GAP');
    events.push(event);
  }
  return replay(events);
}

export async function append(root, kind) {
  const before = await load(root);
  const event = { version: 'lifecycle-spike/v1', seq: before.history.length + 1, inputHash: fixtureHash, kind };
  const after = replay([...before.history, event]);
  await mkdir(root, { recursive: true });
  const target = path.join(root, `${String(event.seq).padStart(6, '0')}.json`);
  const staged = `${target}.partial`;
  const handle = await open(staged, 'wx');
  try { await handle.writeFile(JSON.stringify(event)); await handle.sync(); }
  finally { await handle.close(); }
  await rename(staged, target);
  return after;
}

// Read-only planning: deliberately contains no dispatch/provider/retry operation.
export function recover(state, currentHash = fixtureHash) {
  const stale = currentHash !== fixtureHash;
  const uncertain = Boolean(state.attempt && !state.attempt.responseSaved);
  return { status: state.status === 'running' ? 'interrupted' : state.status,
    stale, requiresReview: stale || uncertain,
    localCheckpointReusable: !stale && state.localCheckpoint,
    responseReusable: !stale && Boolean(state.attempt?.responseSaved),
    attemptId: state.attempt?.id ?? null, remoteOutcome: uncertain ? 'unknown' : null,
    next: stale ? 'review-inputs' : uncertain ? 'reconcile-attempt' :
      state.status === 'completed' ? 'open-output' : 'inspect-local-checkpoint',
    dispatch: false };
}
