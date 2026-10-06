// Read-only accounting projection for guided progress (issue #57).
// Aggregates brand-run journals, pipeline request observations and supplied effort.
// Never invents invoices, percentages or human effort from wall time.

import { usageObservation } from './run-record.js';
import { externalEffort } from './task-delivery.js';

const PHASES = new Set(['ingestion', 'evidence', 'analysis', 'colors', 'compilation', 'directions', 'report', 'export']);
const RUN_STATUS = new Set(['complete', 'running', 'failed', 'review-required']);
const ATTEMPT_STATUS = new Set(['attempted', 'completed', 'failed', 'observed', 'saved', 'uncertain', 'intent']);

const stable = value => JSON.stringify(value, function (_key, item) {
  return item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)))
    : item;
});

function billingObservation(value) {
  if (value == null) return null;
  if (!Number.isFinite(value.amount) || value.amount < 0 || !/^[A-Z]{3}$/.test(value.currency || '')
      || typeof value.source !== 'string' || !/^[\w./: -]{1,160}$/.test(value.source)) {
    throw new Error('INVALID_BILLING');
  }
  return { amount: value.amount, currency: value.currency, source: value.source };
}

function validateUsage(usage) {
  if (usage == null) return null;
  const normalized = usageObservation(usage);
  if (!normalized) throw new Error('INVALID_USAGE');
  for (const field of ['input_tokens', 'output_tokens', 'total_tokens']) {
    const n = usage[field];
    if (n != null && (!Number.isFinite(n) || n < 0)) throw new Error('INVALID_USAGE');
  }
  for (const [field, key] of [['input_tokens_details', 'cached_tokens'], ['output_tokens_details', 'reasoning_tokens']]) {
    const n = usage[field]?.[key];
    if (n != null && (!Number.isFinite(n) || n < 0)) throw new Error('INVALID_USAGE');
  }
  return normalized;
}

function observationRow(value) {
  if (!value || typeof value !== 'object' || typeof value.id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/.test(value.id)) {
    throw new Error('INVALID_ATTEMPT');
  }
  if (!ATTEMPT_STATUS.has(value.status)) throw new Error('INVALID_ATTEMPT');
  const usage = validateUsage(value.usage ?? null);
  const billing = billingObservation(value.billing ?? null);
  const wallMs = value.wallMs == null ? null : Number.isFinite(value.wallMs) && value.wallMs >= 0 ? value.wallMs : (() => { throw new Error('INVALID_ATTEMPT'); })();
  const humanMinutes = value.humanMinutes == null ? null
    : Number.isFinite(value.humanMinutes) && value.humanMinutes >= 0 ? value.humanMinutes
      : (() => { throw new Error('INVALID_ATTEMPT'); })();
  return {
    id: value.id,
    source: value.source || 'journal',
    runId: value.runId ?? null,
    phase: value.phase ?? null,
    status: value.status,
    provider: value.provider ?? null,
    model: value.model ?? null,
    usage,
    billing,
    wallMs,
    humanMinutes,
  };
}

function fromBrandRun(record) {
  if (record?.schemaVersion !== 'brand-run/v1' || !Array.isArray(record.phases) || !RUN_STATUS.has(record.status)) {
    throw new Error('INVALID_RECORD');
  }
  const rows = [];
  for (const phase of record.phases) {
    if (!PHASES.has(phase.name) || phase.id !== `${record.id}-${phase.name}` || !Array.isArray(phase.attempts)) {
      throw new Error('INVALID_PHASE');
    }
    for (const [index, attempt] of phase.attempts.entries()) {
      if (attempt.id !== `${phase.id}-${index + 1}`) throw new Error('INVALID_ATTEMPT');
      rows.push(observationRow({
        id: attempt.id,
        source: 'brand-run',
        runId: record.id,
        phase: phase.name,
        status: attempt.status,
        provider: attempt.provider ?? null,
        model: attempt.model ?? null,
        usage: attempt.usage ?? null,
        billing: attempt.billing ?? null,
        wallMs: attempt.wallMs ?? null,
        humanMinutes: null,
      }));
    }
  }
  return rows;
}

function fromPipelineRequests(requests) {
  if (!Array.isArray(requests)) throw new Error('INVALID_RECORD');
  return requests.map(request => {
    if (!request || typeof request.id !== 'string') throw new Error('INVALID_ATTEMPT');
    const status = request.state === 'saved' || request.state === 'observed' ? 'completed'
      : request.state === 'intent' || request.state === 'uncertain' ? request.state
        : request.state === 'failed' ? 'failed' : 'attempted';
    return observationRow({
      id: `pipeline:${request.id}`,
      source: 'pipeline-request',
      runId: request.job ?? null,
      phase: request.stage ?? null,
      status,
      provider: request.provider ?? null,
      model: request.configuration?.model ?? request.model ?? null,
      usage: request.usage ?? null,
      billing: request.billing ?? null,
      wallMs: request.wallMs ?? null,
      humanMinutes: null,
    });
  });
}

function fromSuppliedEffort(records) {
  if (!Array.isArray(records)) throw new Error('INVALID_RECORD');
  return records.map(row => {
    const observation = externalEffort(row.observation ?? row);
    return observationRow({
      id: `${observation.provider}/${observation.attemptId}`,
      source: 'supplied-effort',
      runId: null,
      phase: observation.kind,
      status: 'completed',
      provider: observation.provider,
      model: null,
      usage: observation.usage ? {
        input_tokens: observation.usage.inputTokens,
        output_tokens: observation.usage.outputTokens,
      } : null,
      billing: observation.billing ? {
        amount: observation.billing.amount,
        currency: observation.billing.currency,
        source: observation.billing.basis,
      } : null,
      wallMs: observation.wallMs,
      humanMinutes: observation.humanMinutes,
    });
  });
}

/** Format a known amount without rounding a tiny positive value to zero. */
export function formatMoney(amount) {
  if (!Number.isFinite(amount) || amount < 0) throw new Error('INVALID_BILLING');
  if (amount === 0) return '0';
  const fixed = amount.toFixed(8).replace(/\.?0+$/, '');
  return fixed === '0' ? amount.toExponential(2) : fixed;
}

/**
 * Aggregate attempt observations once. Token detail fields stay subsets of totals.
 * Mixed currencies stay separate; null billing is never coerced to zero.
 * Wall time and human minutes remain independent measurements.
 */
export function projectSpend({ records = [], requests = [], efforts = [] } = {}) {
  const rows = new Map();
  const byCurrency = {};
  const usageByModel = {};
  const charges = new Map();
  let wallKnown = true;
  let humanKnown = true;
  let wallMs = 0;
  let humanMinutes = 0;

  const ingest = list => {
    for (const row of list) {
      if (rows.has(row.id)) {
        if (stable(rows.get(row.id)) !== stable(row)) throw new Error('CONFLICTING_OBSERVATION');
        continue;
      }
      rows.set(row.id, row);
      if (row.billing) {
        const chargeKey = row.billing.source?.startsWith('supplied') || row.source === 'supplied-effort'
          ? `${row.provider}/${row.billing.source}/${row.billing.amount}/${row.billing.currency}`
          : `${row.id}:${row.billing.currency}`;
        // Deduplicate identical returned bills by attempt; conflicting attempt rows already fail above.
        if (!charges.has(row.id)) {
          charges.set(row.id, row.billing);
          byCurrency[row.billing.currency] = (byCurrency[row.billing.currency] ?? 0) + row.billing.amount;
          if (!Number.isFinite(byCurrency[row.billing.currency])) throw new Error('INVALID_BILLING');
        }
        void chargeKey;
      }
      if (row.usage) {
        const key = `${row.provider ?? 'unknown'}/${row.model ?? 'unknown'}`;
        const total = usageByModel[key] ??= { input: 0, output: 0, inputObserved: 0, outputObserved: 0 };
        // Detail fields (cached/reasoning) are subsets — never added to totals.
        if (row.usage.input_tokens != null) { total.input += row.usage.input_tokens; total.inputObserved++; }
        if (row.usage.output_tokens != null) { total.output += row.usage.output_tokens; total.outputObserved++; }
      }
      if (row.wallMs == null) wallKnown = false;
      else wallMs += row.wallMs;
      if (row.humanMinutes == null) humanKnown = false;
      else humanMinutes += row.humanMinutes;
    }
  };

  ingest(records.flatMap(fromBrandRun));
  ingest(fromPipelineRequests(requests));
  ingest(fromSuppliedEffort(efforts));

  const observations = [...rows.values()];
  const currencies = Object.keys(byCurrency);
  return {
    observations,
    byCurrency,
    usageByModel,
    attemptCount: observations.length,
    unknownBilling: observations.filter(row => !row.billing).length,
    partial: observations.some(row => !row.billing),
    totalCost: observations.length > 0 && observations.every(row => row.billing) && currencies.length === 1
      ? byCurrency[currencies[0]] : null,
    suppliedAttemptWallMs: observations.length > 0 && wallKnown ? wallMs : null,
    humanMinutes: observations.length > 0 && humanKnown ? humanMinutes : null,
    coverage: 'observed-and-supplied-only',
    percentage: null,
    estimatedRemaining: null,
  };
}

export function projectStages(recipeStages = [], observed = [], jobState = null) {
  const byName = new Map(observed.map(row => [row.name, row]));
  return recipeStages.map(name => {
    const row = byName.get(name);
    return {
      name,
      label: ({
        ingestion: 'Fuentes', evidence: 'Evidencia', analysis: 'Análisis', colors: 'Colores',
        compilation: 'Contexto', directions: 'Direcciones', report: 'Informe', export: 'Exportación',
      })[name] || name,
      status: row?.state || (jobState === 'interrupted' && row?.state === 'running' ? 'interrupted' : 'not-reached'),
      snapshot: row?.snapshot || null,
      mode: row?.mode || null,
    };
  });
}

export { fromBrandRun, fromPipelineRequests, fromSuppliedEffort };
