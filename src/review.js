import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { emptyDecisions, inferenceFingerprint, loadDecisions, validateDecisionDocument } from './decisions.js';
import { digest, json } from './local.js';
import { writeJsonAtomically } from './atomic.js';

export const decisionRevision = (decision) => decision ? digest(json(Object.fromEntries(Object.entries(decision).sort(([a], [b]) => a.localeCompare(b))))) : null;

export async function reviewSnapshot(prepared, analysis) {
  const review = await loadDecisions(prepared, analysis);
  return { username: prepared.source.profile.username, items: await Promise.all(analysis.inferences.map(async (item) => {
    const existing = review.document?.inferenceDecisions.find((decision) => decision.inferenceId === item.id) ?? null;
    const fingerprint = await inferenceFingerprint(item, prepared);
    return { ...item, fingerprint, existing, stale: Boolean(existing && existing.fingerprint !== fingerprint), baseRevision: decisionRevision(existing) };
  })) };
}

export async function importReview(prepared, analysis, incoming) {
  if (!incoming || incoming.schemaVersion !== 'brand-review/v1' || incoming.username !== prepared.source.profile.username ||
      Object.keys(incoming).some((key) => !['schemaVersion', 'username', 'decisions'].includes(key)) || !Array.isArray(incoming.decisions) || !incoming.decisions.length) {
    throw new Error('Invalid review or review from another profile. Export a changed decision from the current report.');
  }
  const review = await loadDecisions(prepared, analysis);
  const document = review.document ?? await emptyDecisions(prepared, analysis);
  if (new Set(incoming.decisions.map((item) => item.inferenceId)).size !== incoming.decisions.length) throw new Error('Duplicate review decision.');
  for (const row of incoming.decisions) {
    const { baseRevision, ...decision } = row;
    const inference = analysis.inferences.find((item) => item.id === decision.inferenceId);
    if (!inference) throw new Error('Unknown review inference.');
    const previous = review.document?.inferenceDecisions.find((item) => item.inferenceId === decision.inferenceId) ?? null;
    if (baseRevision !== decisionRevision(previous)) throw new Error('Decisions changed since the report was opened. Rebuild and review again.');
    if (decision.fingerprint !== await inferenceFingerprint(inference, prepared)) throw new Error('Review evidence changed. Rebuild the report before importing.');
    const index = document.inferenceDecisions.findIndex((item) => item.inferenceId === decision.inferenceId);
    if (document.schemaVersion === 'brand-decisions/v2') document.history.push({ id: randomUUID(), kind: 'inference-review',
      reviewer: decision.reviewer ?? 'Local operator', reviewedAt: decision.reviewedAt ?? new Date().toISOString(),
      reason: decision.note ?? 'Explicitly revisit inference', before: previous, after: decision });
    if (index < 0) document.inferenceDecisions.push(decision); else document.inferenceDecisions[index] = decision;
  }
  validateDecisionDocument(document);
  await writeJsonAtomically(path.join(prepared.root, 'brand-decisions.json'), document);
  return { changed: incoming.decisions.length, outputPath: path.join(prepared.root, 'brand-decisions.json') };
}

export async function importReviewFile(prepared, analysis, file) {
  let incoming; try { incoming = JSON.parse(await readFile(file, 'utf8')); }
  catch (error) { throw new Error(`Cannot read review JSON: ${error.message}`); }
  return importReview(prepared, analysis, incoming);
}
