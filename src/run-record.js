import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { writeJsonAtomically } from './atomic.js';

const number = (value) => Number.isFinite(value) && value >= 0 ? value : null;
const text = (value) => typeof value === 'string' && /^[\w./: -]{1,160}$/.test(value) ? value : null;
export function usageObservation(value) {
  if (!value || typeof value !== 'object') return null;
  const result = {};
  for (const key of ['input_tokens', 'output_tokens', 'total_tokens']) {
    if (number(value[key]) !== null) result[key] = value[key];
  }
  for (const [key, field] of [['input_tokens_details', 'cached_tokens'], ['output_tokens_details', 'reasoning_tokens']]) {
    if (number(value[key]?.[field]) !== null) result[key] = { [field]: value[key][field] };
  }
  return Object.keys(result).length ? result : null;
}

function billingObservation(value) {
  if (number(value?.amount) === null || !/^[A-Z]{3}$/.test(value?.currency ?? '') || !text(value?.source)) return null;
  return { amount: value.amount, currency: value.currency, source: value.source };
}

// Deliberately exclude prompts, captions, headers, URLs and arbitrary provider payloads.
function observation(value = {}) {
  return { provider: text(value.provider), model: text(value.model), responseId: text(value.responseId),
    usage: usageObservation(value.usage), billing: billingObservation(value.billing) };
}

export async function createRunRecord(profileDir, { refresh, reanalyze, postLimit }) {
  const id = `run-${randomUUID()}`;
  const outputPath = path.join(profileDir, 'runs', `${id}.json`);
  const record = { schemaVersion: 'brand-run/v1', id, startedAt: new Date().toISOString(),
    endedAt: null, status: 'running', options: { refresh, reanalyze, postLimit }, phases: [] };
  const save = () => writeJsonAtomically(outputPath, record);
  await save();
  return { outputPath, record,
    async phase(name, operation) {
      const started = Date.now();
      const phase = { id: `${id}-${name}`, name, status: 'running', mode: 'local',
        startedAt: new Date().toISOString(), endedAt: null, wallMs: null, attempts: [] };
      record.phases.push(phase); await save();
      const pending = new Map();
      const observe = async (event) => {
        if (event.event === 'start') {
          if (pending.has(event.key)) throw new Error('Provider attempt key already exists.');
          const attempt = { id: `${phase.id}-${phase.attempts.length + 1}`, status: 'attempted',
            startedAt: new Date().toISOString(), endedAt: null, wallMs: null,
            ...observation(event), configuration: {
              reasoningEffort: text(event.configuration?.reasoningEffort),
              maxOutputTokens: number(event.configuration?.maxOutputTokens),
              actor: text(event.configuration?.actor), resultsType: text(event.configuration?.resultsType),
            } };
          phase.mode = 'provider'; phase.attempts.push(attempt);
          pending.set(event.key, { attempt, started: Date.now() });
        } else {
          const active = pending.get(event.key);
          if (!active) throw new Error('Provider observation has no attempted call.');
          const update = observation(event);
          for (const [key, value] of Object.entries(update)) if (value !== null) active.attempt[key] = value;
          if (event.event === 'end') {
            active.attempt.status = event.status === 'failed' ? 'failed' : 'completed';
            active.attempt.endedAt = new Date().toISOString();
            active.attempt.wallMs = Date.now() - active.started;
          }
        }
        await save();
      };
      try {
        const result = await operation({ observe, phase });
        phase.status = 'completed'; return result;
      } catch (error) {
        phase.status = 'failed';
        // Error messages may contain credentials or untrusted provider content.
        throw error;
      } finally {
        for (const { attempt, started: attemptStarted } of pending.values()) if (attempt.endedAt === null) {
          attempt.status = 'failed'; attempt.endedAt = new Date().toISOString(); attempt.wallMs = Date.now() - attemptStarted;
        }
        phase.endedAt = new Date().toISOString(); phase.wallMs = Date.now() - started; await save();
      }
    },
    async finish(status) { record.status = status; record.endedAt = new Date().toISOString(); await save(); },
  };
}

export function trackProvider(provider, { observe, providerName, model = null, maxOutputTokens = null }) {
  return async (...args) => {
    const options = args.pop();
    const key = 'request';
    await observe({ event: 'start', key, provider: providerName, model,
      configuration: { reasoningEffort: model ? 'high' : null, maxOutputTokens } });
    try {
      const result = await provider(...args, { ...options,
        onUsage: async (value) => observe({ event: 'response', key, ...value }),
      });
      await observe({ event: 'end', key, status: 'completed', usage: result.usage, model: result.model, billing: result.billing });
      return result;
    } catch (error) { await observe({ event: 'end', key, status: 'failed' }); throw error; }
  };
}

export function runEffortEvents(record, currency = null) {
  if (record?.schemaVersion !== 'brand-run/v1' || !/^run-[\w-]{1,40}$/.test(record.id) || !Array.isArray(record.phases) ||
      !['complete', 'review-required', 'failed'].includes(record.status) || !record.endedAt) {
    throw new Error('Invalid brand-run/v1 record.');
  }
  const types = { ingestion: 'ingestion', evidence: 'asset-preparation', analysis: 'analysis', colors: 'analysis', compilation: 'asset-preparation' };
  const events = [];
  for (const phase of record.phases) {
    if (!types[phase.name] || phase.id !== `${record.id}-${phase.name}` || !Array.isArray(phase.attempts)) throw new Error('Invalid run phase.');
    const entries = phase.attempts.length ? phase.attempts : [{ id: phase.id, usage: null, billing: null }];
    for (const [index, attempt] of entries.entries()) {
      if (attempt.id !== (phase.attempts.length ? `${phase.id}-${index + 1}` : phase.id)) throw new Error('Invalid run attempt ID.');
      const billing = billingObservation(attempt.billing);
      if (attempt.billing !== null && attempt.billing !== undefined && !billing) throw new Error('Invalid billing observation.');
      if (billing && billing.currency !== currency) throw new Error('Run billing currency must match the review currency.');
      events.push({ id: attempt.id, type: types[phase.name], description: `${phase.name}: ${phase.mode} (${phase.status})`,
        minutes: null, cost: billing?.amount ?? null,
        provenance: { runId: record.id, phaseId: phase.id, wallMs: number(phase.wallMs),
          providerWallMs: number(attempt.wallMs), usage: usageObservation(attempt.usage), billing } });
    }
  }
  if (new Set(events.map((event) => event.id)).size !== events.length) throw new Error('Duplicate run event.');
  return events;
}
