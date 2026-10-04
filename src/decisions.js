import { readFile } from 'node:fs/promises';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { digest, escapeHtml, profileFile, readOptionalJson } from './local.js';

const schema = JSON.parse(await readFile(new URL('../schemas/brand-decisions.schema.json', import.meta.url), 'utf8'));
const historySchema = JSON.parse(await readFile(new URL('../schemas/brand-decisions-v2.schema.json', import.meta.url), 'utf8'));
const ajv = new Ajv2020({ allErrors: true }); addFormats(ajv);
const validate = ajv.compile(schema);
const validateHistory = ajv.compile(historySchema);
const sorted = (value) => Array.isArray(value) ? value.map(sorted) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, sorted(value[key])])) : value;

export function validateDecisionDocument(document) {
  const validator = document?.schemaVersion === 'brand-decisions/v2' ? validateHistory : validate;
  if (!validator(document)) throw new Error(`Invalid brand decisions: ${ajv.errorsText(validator.errors)}`);
  if (document.schemaVersion === 'brand-decisions/v2') {
    unique(document.history, item => item.id, 'history event');
    const latest = new Map();
    for (const event of document.history) {
      const rule = event.kind === 'rule-correction';
      const key = `${event.kind}/${rule ? event.after.id : event.after.inferenceId}`;
      if (rule ? !event.before?.id || event.before.id !== event.after.id || event.before.kind !== event.after.kind ||
          event.before.target !== event.after.target || (event.before.scope ?? 'all') !== (event.after.scope ?? 'all') || event.before.sourceId === event.after.sourceId
        : !event.after.inferenceId || event.before && event.before.inferenceId !== event.after.inferenceId) throw new Error('Invalid decision history transition.');
      if (latest.has(key) && JSON.stringify(sorted(latest.get(key))) !== JSON.stringify(sorted(event.before))) throw new Error('Broken decision history chain.');
      latest.set(key, event.after);
    }
    for (const [key, value] of latest) {
      const current = key.startsWith('rule-correction/') ? document.rules.find(item => item.id === value.id)
        : document.inferenceDecisions.find(item => item.inferenceId === value.inferenceId);
      if (JSON.stringify(sorted(current)) !== JSON.stringify(sorted(value))) throw new Error('Current decision differs from its retained history.');
    }
  }
}

export async function inferenceFingerprint(item, prepared, { allowMissing = false } = {}) {
  const catalog = new Map(prepared.evidence.map((record) => [record.id, record]));
  const sources = await Promise.all(item.evidenceIds.map(async (id) => {
    const record = catalog.get(id);
    if (!record) {
      if (allowMissing) return { id, missing: true };
      throw new Error(`Unknown inference evidence: ${id}`);
    }
    return { ...record, sha256: digest(await readFile(await profileFile(prepared.root, record.sourcePath))) };
  }));
  return digest(JSON.stringify(sorted({ item, sources })));
}

export async function emptyDecisions(prepared, analysis) {
  return { schemaVersion: 'brand-decisions/v1', username: prepared.source.profile.username,
    sources: [], rules: [], assetSelections: [], inferenceDecisions: await Promise.all(
      analysis.inferences.map(async (item) => ({ inferenceId: item.id,
        fingerprint: await inferenceFingerprint(item, prepared), action: 'pending' }))) };
}

function unique(items, key, label) {
  if (new Set(items.map(key)).size !== items.length) throw new Error(`Duplicate ${label} in brand decisions.`);
}

export function validateTokenRule(rule) {
  if (!/^[a-z][a-z0-9-]*$/.test(rule.target)) throw new Error(`Invalid token name: ${rule.target}`);
  if (/font-/.test(rule.target)) {
    if (!/^[A-Za-z0-9 ,"'_-]+$/.test(rule.value)) throw new Error('Invalid font stack.');
  } else if (!/^[#A-Za-z0-9(),.%'" _-]+$/.test(rule.value) || /(?:url|expression)\s*\(/i.test(rule.value)) {
    throw new Error(`Unsafe token value: ${rule.target}`);
  }
  if ([...rule.value.matchAll(/([a-z-]+)\s*\(/gi)].some((m) => !['var', 'color-mix', 'cubic-bezier', 'rgb', 'rgba', 'hsl', 'hsla', 'calc'].includes(m[1]))) {
    throw new Error(`Unsupported token function: ${rule.target}`);
  }
  for (const ref of rule.value.matchAll(/var\(\s*--([a-z0-9-]+)/g)) {
    if (!/^[a-z][a-z0-9-]*$/.test(ref[1])) throw new Error(`Invalid token alias: ${ref[1]}`);
  }
  if (rule.kind === 'font' && !rule.target.startsWith('font-')) throw new Error('Font rules must target a font token.');
}

export async function loadDecisions(prepared, analysis, { channel = 'website' } = {}) {
  if (!['website', 'social'].includes(channel)) throw new Error('Unknown decision channel.');
  const document = await readOptionalJson(path.join(prepared.root, 'brand-decisions.json'));
  const result = { document, activeRules: [], staleRules: [], sources: [], decisions: [], conflicts: [],
    assetSelections: [], tokenOverrides: {}, effectiveAnalysis: structuredClone(analysis) };
  if (!document) return result;
  validateDecisionDocument(document);
  if (document.username.toLowerCase() !== prepared.source.profile.username.toLowerCase()) throw new Error('Brand decisions belong to another profile.');
  unique(document.sources, (item) => item.id, 'source');
  unique(document.rules, (item) => item.id, 'rule');
  unique(document.rules, (item) => `${item.scope ?? 'all'}/${['token', 'font'].includes(item.kind) ? 'css' : item.kind}/${item.target}`, 'rule target');
  unique(document.inferenceDecisions, (item) => item.inferenceId, 'inference decision');
  unique(document.assetSelections, (item) => `${item.evidenceId}/${item.role}`, 'asset selection');
  for (const source of document.sources) {
    const absolutePath = await profileFile(prepared.root, source.path);
    result.sources.push({ ...source, absolutePath, stale: digest(await readFile(absolutePath)) !== source.sha256 });
  }
  const sources = new Map(result.sources.map((source) => [source.id, source]));
  const sourceFor = (item) => {
    const source = sources.get(item.sourceId);
    if (!source) throw new Error(`Unknown decision source: ${item.sourceId}`);
    return source;
  };
  const images = new Set(prepared.images.map((image) => image.evidenceId));
  for (const rule of [...document.rules].sort((a, b) => ((a.scope ?? 'all') === 'all' ? 0 : 1) - ((b.scope ?? 'all') === 'all' ? 0 : 1))) {
    const source = sourceFor(rule);
    if (['font', 'token'].includes(rule.kind)) validateTokenRule(rule);
    if (rule.kind === 'logo' && !images.has(rule.value)) throw new Error(`Unknown reviewed logo: ${rule.value}`);
    if (rule.scope && rule.scope !== 'all' && rule.scope !== channel) continue;
    (source.stale ? result.staleRules : result.activeRules).push(rule);
    if (!source.stale && ['font', 'token'].includes(rule.kind)) result.tokenOverrides[rule.target] = rule.value;
  }
  for (const selection of document.assetSelections) {
    if (!images.has(selection.evidenceId)) throw new Error(`Unknown reviewed asset: ${selection.evidenceId}`);
    result.assetSelections.push({ ...selection, stale: sourceFor(selection).stale });
  }
  for (const decision of document.inferenceDecisions) {
    const item = analysis.inferences.find((inference) => inference.id === decision.inferenceId);
    if (!item) throw new Error(`Unknown inference decision: ${decision.inferenceId}`);
    const stale = decision.fingerprint !== await inferenceFingerprint(item, prepared, { allowMissing: true });
    result.decisions.push({ ...decision, stale, candidate: item.value });
    if (stale || decision.action === 'reject') {
      const effective = result.effectiveAnalysis.inferences.find((inference) => inference.id === item.id);
      Object.assign(effective, { value: null, status: 'needs-review', confidence: null,
        rationale: stale ? 'Human decision is stale; review the changed candidate or evidence.' : 'Human reviewer rejected this proposal.' });
    }
  }
  // Describe provenance differences conservatively; CSS defaults are never brand facts.
  for (const rule of result.activeRules) {
    const topic = ['token', 'font'].includes(rule.kind) ? rule.target.startsWith('font-') ? 'typography.style'
      : /^(bg|surface|fg|muted|meta|border|accent|success|warn|danger)/.test(rule.target) ? 'color.palette' : 'composition.patterns'
      : rule.kind === 'copy' ? 'copy.cta' : rule.kind === 'logo' ? 'brand.personality' : 'ui.guidance';
    const inferred = analysis.inferences.find((item) => item.topic === topic);
    if (inferred?.value) result.conflicts.push({ ruleId: rule.id, confirmed: rule.value,
      candidate: inferred.value, evidenceIds: inferred.evidenceIds, sourceId: rule.sourceId,
      resolution: 'Use the confirmed rule; the Instagram proposal remains historical evidence.' });
  }
  return result;
}

export function decisionsMarkdown(review, tokenOrigins = []) {
  if (!review.document) return '';
  const e = (value) => String(value).replace(/[\r\n<>]/g, ' ');
  return ['## Human decisions and provenance', '',
    'Confirmed rules override inference. Accepting a creative proposal does not verify a brand fact.', '',
    ...review.activeRules.map((rule) => `- Confirmed ${e(rule.kind)} / ${e(rule.target)}: ${e(rule.value)}. Source: ${e(rule.sourceId)}.`),
    ...review.staleRules.map((rule) => `- Needs review: ${e(rule.id)}; its source changed. The old rule is not applied.`),
    ...review.decisions.map((item) => `- ${e(item.inferenceId)}: ${item.stale ? 'needs review (changed candidate/evidence)' : item.action}. ${e(item.note ?? '')}`),
    '', '### Conflicts and resolution', '',
    ...review.conflicts.map((conflict) => `- ${e(conflict.ruleId)}: confirmed “${e(conflict.confirmed)}” vs Instagram “${e(conflict.candidate)}” (${conflict.evidenceIds.join(', ')}). ${conflict.resolution}`),
    '', '### Decision sources', '',
    ...review.sources.map((source) => `- ${e(source.id)}: [${e(source.summary)}](${source.path}); reviewed by ${e(source.reviewer)} at ${source.reviewedAt}${source.stale ? '; changed since review' : ''}.`),
    ...(tokenOrigins.length ? ['', '### Effective token origins', '', ...tokenOrigins.map((item) => `- --${item.name}: ${item.origin}.`)] : []), ''].join('\n');
}

export function decisionsHtml(review, language = 'en') {
  if (!review.document) return '';
  const e = escapeHtml;
  const copy = language === 'es' ? { heading: 'Decisiones humanas', confirmed: 'Confirmada', review: 'Revisar',
    note: 'Las reglas confirmadas prevalecen; aprobar una propuesta no verifica un hecho.',
    changed: 'fuente modificada', conflicts: 'Comparación de fuentes', sources: 'Fuentes', use: 'Usar regla confirmada.',
    default: 'Los tokens sin regla confirmada siguen siendo valores funcionales provisionales.' }
    : { heading: 'Human decisions', confirmed: 'Confirmed', review: 'Needs review',
      note: 'Confirmed rules override inferences. Proposal approval does not verify a fact.',
      changed: 'source changed', conflicts: 'Source comparisons', sources: 'Sources', use: 'Use the confirmed rule.',
      default: 'CSS without a confirmed rule remains a provisional functional default.' };
  return `<section class="wrap section" aria-labelledby="brand-decisions-heading"><h2 id="brand-decisions-heading">${copy.heading}</h2>
    <p>${copy.note}</p><ul>${review.activeRules.map((rule) => `<li><strong>${copy.confirmed}: ${e(rule.target)}</strong> — ${e(rule.value)} · ${e(rule.sourceId)}</li>`).join('')}
    ${review.staleRules.map((rule) => `<li>${copy.review}: ${e(rule.id)} · ${copy.changed}</li>`).join('')}
    ${review.decisions.map((item) => `<li>${e(item.inferenceId)}: ${e(item.stale ? copy.review : item.action)} — ${e(item.candidate)}</li>`).join('')}</ul>
    <h3>${copy.conflicts}</h3><ul>${review.conflicts.map((item) => `<li>${e(item.ruleId)}: ${copy.confirmed} ${e(item.confirmed)}; Instagram: ${e(item.candidate)}. ${copy.use}</li>`).join('')}</ul>
    <h3>${copy.sources}</h3><ul>${review.sources.map((source) => `<li>${e(source.id)}: ${e(source.summary)} · ${e(source.path)} · ${e(source.reviewer)} · ${e(source.reviewedAt)}${source.stale ? ` · ${copy.review}` : ''}</li>`).join('')}</ul><p>${copy.default}</p></section>`;
}
