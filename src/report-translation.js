import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { writeJsonAtomically } from './atomic.js';
import { requestReportTranslation } from './providers/openai-report-translation.js';

const VERSION = 'report-translation/v1';

function textEntries(prepared, analysis, colors) {
  const entries = [];
  const add = (key, text) => { if (text != null && String(text).trim()) entries.push({ key, text }); };
  add('profile.biography', prepared.source.profile.biography);
  for (const item of analysis.inferences) {
    add(`${item.id}.value`, item.value);
    add(`${item.id}.rationale`, item.rationale);
  }
  for (const item of analysis.evidence) add(`${item.id}.summary`, item.summary);
  for (const role of ['primary', 'secondary']) add(`color.${role}.rationale`, colors?.[role]?.rationale);
  return entries;
}

export function validateReportTranslation(translations, entries) {
  if (!Array.isArray(translations) || translations.length !== entries.length) {
    throw new Error('Report translation must include every text entry.');
  }
  const expected = new Set(entries.map((entry) => entry.key));
  const found = new Map();
  for (const entry of translations) {
    if (!entry || Object.keys(entry).sort().join(',') !== 'key,text' ||
        !expected.has(entry.key) || found.has(entry.key) || typeof entry.text !== 'string' || !entry.text.trim()) {
      throw new Error('Report translation has an invalid, duplicate or unknown entry.');
    }
    found.set(entry.key, entry.text);
  }
  return found;
}

export async function translateReport(prepared, analysis, colors, {
  token = process.env.OPENAI_API_KEY, fetchImpl = fetch, provider = requestReportTranslation,
} = {}) {
  const entries = textEntries(prepared, analysis, colors);
  const inputHash = createHash('sha256').update(VERSION).update(JSON.stringify(entries)).digest('hex');
  const cachePath = path.join(prepared.root, 'report-translation.en.json');
  let cached;
  try { cached = JSON.parse(await readFile(cachePath, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  let translations, usage = null, reused = false;
  if (cached?.schemaVersion === VERSION && cached.language === 'en' && cached.inputHash === inputHash) {
    translations = cached.translations;
    reused = true;
  } else {
    const result = await provider(entries, { token, fetchImpl });
    translations = result.translations;
    usage = result.usage ?? null;
  }
  const translated = validateReportTranslation(translations, entries);
  if (!reused) await writeJsonAtomically(cachePath, { schemaVersion: VERSION, language: 'en', inputHash, translations });
  // Only prose is replaced. All source IDs, confidence, status, dates and color values stay local and unchanged.
  const displayAnalysis = {
    ...analysis,
    inferences: analysis.inferences.map((item) => ({ ...item,
      value: item.value == null ? null : translated.get(`${item.id}.value`) ?? item.value,
      rationale: translated.get(`${item.id}.rationale`),
    })),
    evidence: analysis.evidence.map((item) => ({ ...item, summary: translated.get(`${item.id}.summary`) })),
  };
  const displayColors = colors && Object.fromEntries(Object.entries(colors).map(([role, item]) =>
    [role, { ...item, rationale: translated.get(`color.${role}.rationale`) }]));
  return { analysis: displayAnalysis, colors: displayColors,
    biography: translated.get('profile.biography') ?? '', reused, usage };
}
