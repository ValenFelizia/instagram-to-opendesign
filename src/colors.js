import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { standaloneRequests } from './request-checkpoints.js';
import { writeJsonAtomically } from './atomic.js';
import { requestColorCandidates } from './providers/openai-colors.js';

const HEX = /^#[0-9a-fA-F]{6}$/;
const emptyCandidate = (rationale) => ({ hex: null, evidenceIds: [], rationale });

export function validateColorCandidates(candidates, graphics) {
  if (!candidates || typeof candidates !== 'object' || Array.isArray(candidates) ||
      Object.keys(candidates).sort().join(',') !== 'primary,secondary') {
    throw new Error('Color proposal must contain primary and secondary candidates.');
  }
  const allowed = new Set(graphics.map((item) => item.evidenceId));
  for (const role of ['primary', 'secondary']) {
    const item = candidates[role];
    if (!item || typeof item !== 'object' || Array.isArray(item) ||
        Object.keys(item).sort().join(',') !== 'evidenceIds,hex,rationale' ||
        typeof item.rationale !== 'string' || !item.rationale.trim() ||
        !Array.isArray(item.evidenceIds) || new Set(item.evidenceIds).size !== item.evidenceIds.length) {
      throw new Error(`Invalid ${role} color candidate.`);
    }
    if (item.hex === null) {
      if (item.evidenceIds.length) throw new Error(`${role} has citations but no color.`);
    } else if (typeof item.hex !== 'string' || !HEX.test(item.hex) || !item.evidenceIds.length ||
      item.evidenceIds.some((id) => !allowed.has(id))) {
      throw new Error(`${role} must cite reviewed, profile-owned brand graphics and use #RRGGBB.`);
    }
  }
}

export async function colorInputFingerprint(analysis, graphics) {
  const hash = createHash('sha256').update(JSON.stringify(analysis));
  for (const graphic of graphics) hash.update(graphic.evidenceId).update(await readFile(graphic.absolutePath));
  return hash.digest('hex');
}

export async function getColorProposals(prepared, analysis, {
  force = false, token = process.env.OPENAI_API_KEY, fetchImpl = fetch,
  provider = requestColorCandidates, onUsage, configurationRevision,
} = {}) {
  const graphics = prepared.images.filter((item) => item.review.classification === 'brand-graphic').slice(0, 4);
  const inputHash = await colorInputFingerprint(analysis, graphics);
  const outputPath = path.join(prepared.root, 'color-proposals.json');
  if (!force) {
    try {
      const cached = JSON.parse(await readFile(outputPath, 'utf8'));
      if (cached.schemaVersion === 'color-proposals/v1' && cached.inputHash === inputHash &&
          (configurationRevision == null || cached.configurationRevision === configurationRevision)) {
        validateColorCandidates(cached.candidates, graphics);
        return { ...cached, outputPath, reused: true, usage: null };
      }
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  const { candidates, usage } = graphics.length
    ? await provider(graphics, analysis, { token, fetchImpl: standaloneRequests(prepared.root, 'colors', fetchImpl), onUsage })
    : { candidates: {
      primary: emptyCandidate('No hay gráficos propios revisados para proponer colores.'),
      secondary: emptyCandidate('No hay gráficos propios revisados para proponer colores.'),
    }, usage: null };
  validateColorCandidates(candidates, graphics);
  const result = { schemaVersion: 'color-proposals/v1', inputHash, candidates,
    ...(configurationRevision ? { configurationRevision } : {}) };
  await writeJsonAtomically(outputPath, result);
  return { ...result, outputPath, reused: false, usage };
}
