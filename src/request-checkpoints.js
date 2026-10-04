import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { usageObservation } from './run-record.js';
import writer from './writer-guard.cjs';

const marked = Symbol('accounted-provider-transport');
const hash = value => createHash('sha256').update(value).digest('hex');
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const MAX_BODY = 32 * 1024 * 1024;
function save(file, value) {
  writer.canonical(path.dirname(file));
  if (fs.existsSync(file)) {
    writer.canonical(file);
    if (!fs.statSync(file).isFile() || fs.statSync(file).nlink !== 1) throw new Error('Unsafe request checkpoint.');
  }
  const temporary = `${file}.partial-${randomUUID()}`;
  const fd = fs.openSync(temporary, 'wx');
  try { fs.writeFileSync(fd, JSON.stringify(value)); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  fs.renameSync(temporary, file);
}
function providerRequest(url, options) {
  const target = new URL(url);
  if (target.protocol !== 'https:' || target.username || target.password) return null;
  if (target.origin === 'https://api.openai.com' && target.pathname === '/v1/responses') return 'openai';
  if (target.origin === 'https://api.apify.com' && target.pathname.startsWith('/v2/')) return 'apify';
  return null;
}
function observations(body, provider) {
  let result; try { result = JSON.parse(body); } catch { return {}; }
  const remote = provider === 'apify' ? result.data : result;
  return { responseId: typeof remote?.id === 'string' && /^[\w/-]{1,160}$/.test(remote.id) ? remote.id : null,
    model: typeof remote?.model === 'string' ? remote.model.slice(0, 80) : null,
    usage: usageObservation(remote?.usage),
    billing: Number.isFinite(remote?.usageTotalUsd) && remote.usageTotalUsd >= 0
      ? { amount: remote.usageTotalUsd, currency: 'USD', source: 'Apify actor-run usageTotalUsd' } : null };
}
function configuration(options, provider) {
  let body; try { body = JSON.parse(options.body || '{}'); } catch { return null; }
  return provider === 'apify' ? { resultsType: ['posts', 'details'].includes(body.resultsType) ? body.resultsType : null,
    resultsLimit: Number.isInteger(body.resultsLimit) ? body.resultsLimit : null }
    : { model: typeof body.model === 'string' ? body.model.slice(0, 80) : null,
      maxOutputTokens: Number.isInteger(body.max_output_tokens) ? body.max_output_tokens : null,
      reasoningEffort: ['high', 'medium', 'low'].includes(body.reasoning?.effort) ? body.reasoning.effort : null, store: body.store === true };
}
async function bodyText(response, limit) {
  if (response.body?.getReader) {
    const reader = response.body.getReader(), parts = []; let size = 0;
    try {
      while (true) { const { done, value } = await reader.read(); if (done) break;
        size += value.byteLength; if (size > limit) throw new Error('Provider response exceeds the authorized size.'); parts.push(Buffer.from(value)); }
      return Buffer.concat(parts).toString('utf8');
    } finally { await reader.cancel(); }
  }
  const text = response.text ? await response.text() : JSON.stringify(await response.json());
  if (Buffer.byteLength(text) > limit) throw new Error('Provider response exceeds the authorized size.');
  return text;
}
function restored(record, body) {
  return { ok: record.status >= 200 && record.status < 300, status: record.status,
    json: async () => JSON.parse(body), text: async () => body };
}

// All content here is PRIVATE local evidence, never diagnostics or renderer data.
// Headers, credentials, request URLs and request bodies are deliberately not stored.
export function requestCheckpoints(root, stage, fetchImpl = fetch, {
  beforeRequest = async () => {}, onRecord = async () => {}, fence = () => {},
  replay = [], replayOnly = false, maxResponseBytes = MAX_BODY, fault = () => {},
} = {}) {
  if (fetchImpl[marked]) return fetchImpl;
  const directory = path.resolve(root);
  // Check the existing ancestor before creating folders; linked roots are never adopted.
  let ancestor = directory; while (!fs.existsSync(ancestor)) ancestor = path.dirname(ancestor);
  writer.canonical(ancestor); fs.mkdirSync(directory, { recursive: true }); writer.canonical(directory);
  const records = replay.map(id => {
    if (!uuid.test(id)) throw new Error('Invalid request checkpoint ID.');
    const file = path.join(directory, `${id}.json`); writer.canonical(file);
    if (fs.statSync(file).size > 1024 * 1024 || fs.statSync(file).nlink !== 1) throw new Error('Invalid request checkpoint.');
    const record = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (record.version !== 1 || record.id !== id) throw new Error('Invalid request checkpoint.');
    return record;
  });
  const used = new Set();
  const transport = async (url, options = {}) => {
    const provider = providerRequest(url, options);
    if (!provider) return fetchImpl(url, options);
    fence();
    const method = (options.method || 'GET').toUpperCase();
    const secret = new Headers(options.headers).get('authorization')?.replace(/^Bearer\s+/i, '');
    const stageName = typeof stage === 'function' ? stage() : stage;
    const key = hash(JSON.stringify({ stage: stageName, method, url: String(url), body: options.body || '' }));
    const previous = records.find(record => record.key === key && !used.has(record.id));
    if (previous) {
      // An ambiguous or missing response blocks replay. Never turn it into a new call.
      if (previous.state !== 'saved') throw new Error('Request requires same-attempt reconciliation.');
      const payload = path.join(directory, `${previous.id}.response.json`); writer.canonical(payload);
      if (fs.statSync(payload).size > MAX_BODY + 1024 * 1024 || fs.statSync(payload).nlink !== 1) throw new Error('Invalid response checkpoint.');
      const body = JSON.parse(fs.readFileSync(payload, 'utf8')).body;
      if (typeof body !== 'string' || hash(body) !== previous.responseHash) throw new Error('Request response checkpoint is unavailable.');
      used.add(previous.id); return restored(previous, body);
    }
    if (replayOnly) throw new Error('Recovery cannot dispatch a new provider request.');
    const record = { version: 1, id: randomUUID(), stage: stageName, provider, method, key,
      paid: method === 'POST', state: 'intent', startedAt: new Date().toISOString(), endedAt: null,
      status: null, responseId: null, usage: null, billing: null, responseHash: null };
    record.configuration = configuration(options, provider);
    if (secret && record.configuration?.model?.includes(secret)) record.configuration.model = null;
    record.billingSemantics = provider === 'apify' ? 'cumulative-run-total' : null;
    await beforeRequest({ ...record }, { url: String(url), options }); fence();
    const file = path.join(directory, `${record.id}.json`);
    save(file, record); await onRecord({ ...record }); fault('request-after-intent');
    try {
      const response = await fetchImpl(url, { ...options, redirect: 'error' });
      const body = await bodyText(response, maxResponseBytes); fence();
      Object.assign(record, observations(body, provider), { status: response.status, state: 'observed', endedAt: new Date().toISOString() });
      for (const key of ['responseId', 'model']) if (secret && record[key]?.includes(secret)) record[key] = null;
      // Usage survives malformed semantic output and a subsequent payload/write failure.
      save(file, record); await onRecord({ ...record }); fault('request-before-response-save');
      if (secret && body.includes(secret)) throw new Error('Provider response contains a request credential; payload was not saved.');
      save(path.join(directory, `${record.id}.response.json`), { body });
      record.responseHash = hash(body); record.state = 'saved'; save(file, record); await onRecord({ ...record });
      return restored(record, body);
    } catch (error) {
      if (record.state === 'intent') record.state = 'uncertain';
      record.endedAt ??= new Date().toISOString();
      // If the disk itself is unavailable, retain the original error and committed intent.
      try { fence(); save(file, record); await onRecord({ ...record }); } catch {}
      throw error;
    }
  };
  transport[marked] = true;
  return transport;
}

export function standaloneRequests(profileDir, stage, fetchImpl = fetch) {
  if (fetchImpl[marked]) return fetchImpl;
  let transport;
  return markAccountedTransport((url, options = {}) => {
    if (!providerRequest(url, options)) return fetchImpl(url, options);
    transport ??= requestCheckpoints(path.join(profileDir, 'runs', 'requests'), stage, fetchImpl);
    return transport(url, options);
  });
}
export function markAccountedTransport(fetchImpl) { fetchImpl[marked] = true; return fetchImpl; }

export function reconcileResponse(root, originalId, lookupId) {
  if (![originalId, lookupId].every(id => uuid.test(id))) throw new Error('Invalid reconciliation ID.');
  const load = id => { const file = path.join(root, `${id}.json`); writer.canonical(file);
    if (fs.statSync(file).size > 1024 * 1024 || fs.statSync(file).nlink !== 1) throw new Error('Invalid request checkpoint.');
    return JSON.parse(fs.readFileSync(file)); };
  const original = load(originalId), lookup = load(lookupId);
  if (original.provider !== 'apify' || lookup.provider !== 'apify' || lookup.method !== 'GET' || lookup.state !== 'saved'
      || !original.responseId || lookup.responseId !== original.responseId) throw new Error('Lookup does not identify the original attempt.');
  // Preserve original bytes whenever available. Lost POST response content can be
  // reconstructed only from the explicitly retrieved same run, with provenance.
  if (original.state !== 'saved') {
    const payload = path.join(root, `${lookupId}.response.json`); writer.canonical(payload);
    if (fs.statSync(payload).size > MAX_BODY + 1024 * 1024 || fs.statSync(payload).nlink !== 1) throw new Error('Invalid lookup response.');
    const body = JSON.parse(fs.readFileSync(payload)).body;
    if (hash(body) !== lookup.responseHash) throw new Error('Invalid lookup response.');
    save(path.join(root, `${originalId}.response.json`), { body });
    Object.assign(original, { state: 'saved', responseHash: lookup.responseHash, recoveredFrom: lookupId, status: lookup.status });
    save(path.join(root, `${originalId}.json`), original);
  }
  return original;
}
