import { copyFile, lstat, mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { prepareAnalysis, validateAnalysis } from './analyze.js';
import { buildAssetCatalog } from './asset-catalog.js';
import { buildDirectoryAtomically, writeJsonAtomically } from './atomic.js';
import { loadDecisions } from './decisions.js';
import { digest, json, profileFile, readOptionalJson } from './local.js';
import { DIRECTIONS_MODEL, DIRECTIONS_SCHEMA, requestCreativeDirections } from './providers/openai-directions.js';

const requestSchema = JSON.parse(await readFile(new URL('../schemas/design-request.schema.json', import.meta.url), 'utf8'));
const ajv = new Ajv2020({ allErrors: true, strictTypes: false });
const validateRequestSchema = ajv.compile(requestSchema), validateDirectionsSchema = ajv.compile(DIRECTIONS_SCHEMA);
const unique = (items, key, label) => { if (new Set(items.map(key)).size !== items.length) throw new Error(`Duplicate ${label}.`); };

export function emptyRequest(username, kind = 'web-hero') {
  return { schemaVersion: 'design-request/v1', username, kind, objective: '', audience: '', sourceId: null,
    copy: [], action: { type: 'none', label: null, url: null, reservedSpace: null }, assets: [],
    constraints: [], selectedDirectionId: null };
}

export function validateRequest(request, username) {
  if (!validateRequestSchema(request)) throw new Error(`Invalid design request: ${ajv.errorsText(validateRequestSchema.errors)}`);
  if (request.username !== username) throw new Error('Design request belongs to another profile.');
  unique(request.copy, (item) => item.id, 'copy ID'); unique(request.assets, (item) => item.id, 'request asset');
  const action = request.action, box = action.reservedSpace;
  if (box && (box.x + box.width > 1 || box.y + box.height > 1)) throw new Error('Reserved sticker space escapes the canvas.');
  if (action.type === 'none' && (action.label !== null || action.url !== null || box !== null)) throw new Error('No-action request must not contain a control.');
  if (action.type !== 'none') {
    if (!action.label?.trim() || !action.url) throw new Error('Action requires confirmed label and destination.');
    let url; try { url = new URL(action.url); } catch { throw new Error('Invalid action destination.'); }
    if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Action destination must use HTTP(S).');
  }
  if (request.kind === 'instagram-story' && action.type === 'link') throw new Error('A static Story link must be reserved as a native sticker, not drawn as a functioning button.');
  if (request.kind === 'web-hero' && (action.type === 'native-sticker' || box)) throw new Error('Native sticker space applies only to Stories.');
  for (const asset of request.assets) if (asset.alt.usage === 'decorative' && asset.alt.text) throw new Error('Decorative asset must have empty alt text.');
}

export function validateDirections(directions, context) {
  if (!validateDirectionsSchema({ directions })) throw new Error(`Invalid creative directions: ${ajv.errorsText(validateDirectionsSchema.errors)}`);
  unique(directions, (item) => item.id, 'direction ID');
  for (const field of ['layout', 'hierarchy', 'assetTreatment']) unique(directions, (item) => item[field], `creative ${field}; alternatives must differ`);
  const assets = new Set(context.assets.map((item) => item.id)), evidence = new Set(context.evidence.map((item) => item.id));
  for (const direction of directions) {
    if (direction.assetIds.some((id) => !assets.has(id))) throw new Error(`Unknown or unselected direction asset: ${direction.id}`);
    if (direction.evidenceIds.some((id) => !evidence.has(id))) throw new Error(`Unknown direction evidence: ${direction.id}`);
    if (direction.assetIds.length !== (direction.assetTreatment === 'paired' ? 2 : 1)) throw new Error(`Asset count conflicts with treatment: ${direction.id}`);
  }
}

export async function prepareBrief(profileDir) {
  const prepared = await prepareAnalysis(profileDir);
  const analysis = JSON.parse(await readFile(path.join(prepared.root, 'brand-analysis.json'), 'utf8'));
  await validateAnalysis(analysis, prepared);
  if (JSON.stringify(analysis.evidence) !== JSON.stringify(prepared.evidence)) throw new Error('Analysis evidence is stale; re-analyze before briefing.');
  const request = JSON.parse(await readFile(path.join(prepared.root, 'design-request.json'), 'utf8'));
  validateRequest(request, prepared.source.profile.username);
  const decisions = await loadDecisions(prepared, analysis);
  const { catalog, entries } = await buildAssetCatalog(prepared, analysis, { kind: request.kind, write: false });
  const selected = request.assets.map((use) => {
    const asset = entries.find((entry) => entry.id === use.id);
    if (!asset) throw new Error(`Unknown request asset: ${use.id}`);
    if (!asset.readyForDesign) throw new Error(`Request asset is not approved for design: ${use.id}: ${asset.blockers.join('; ')}`);
    return { ...asset, use };
  });
  const blockers = [];
  if (!request.objective.trim()) blockers.push('Objective is missing.');
  if (!request.audience.trim()) blockers.push('Audience is missing.');
  if (!request.copy.length) blockers.push('Confirmed copy is missing.');
  if (!request.copy.some((copy) => copy.id === 'headline')) blockers.push('A headline copy block is required.');
  if (!selected.length) blockers.push('Select at least one approved asset.');
  const requestSource = decisions.sources.find((source) => source.id === request.sourceId);
  if (request.sourceId && !requestSource) throw new Error('Unknown request confirmation source.');
  if (!requestSource || requestSource.stale) blockers.push('Design request confirmation is missing or changed.');
  if (decisions.staleRules.length) blockers.push('Confirmed brand rules changed and require renewed review.');
  for (const rule of decisions.activeRules.filter((rule) => rule.kind === 'copy')) {
    const copy = request.copy.find((item) => item.id === rule.target);
    if (copy && copy.text !== rule.value) blockers.push(`Confirmed copy conflict: ${rule.target}.`);
  }
  for (const entry of selected) {
    if (entry.use.fit === 'cover' && entry.crop.reviewRequired && !entry.use.cropReviewed) blockers.push(`Review crop affecting/unknown subject: ${entry.id}.`);
    if (entry.lowResolution && !entry.use.lowResolutionAccepted) blockers.push(`Review resolution for actual slot: ${entry.id}.`);
    if (entry.use.alt.usage === 'unknown' || entry.use.alt.usage === 'informative' && !entry.use.alt.text.trim()) blockers.push(`Review image alternative: ${entry.id}.`);
  }
  if (request.action.type === 'native-sticker' && !request.action.reservedSpace) blockers.push('Reserve native sticker space and review it in Instagram composer.');
  const { selectedDirectionId, ...suggestionRequest } = request;
  const context = { request: suggestionRequest,
    observations: decisions.effectiveAnalysis.inferences,
    verifiedRules: decisions.activeRules,
    evidence: prepared.evidence,
    assets: selected.map(({ absolutePath, ...entry }) => entry),
    brandConflicts: decisions.conflicts,
  };
  // Only selection is excluded: approvals, byte hashes, evidence and fit changes invalidate paid cache.
  const inputHash = digest(json({ version: 'creative-context/v1', model: DIRECTIONS_MODEL, context,
    sources: decisions.sources.map(({ absolutePath, ...source }) => source) }));
  return { prepared, analysis, request, decisions, selected, catalog, context, inputHash, blockers };
}

export async function suggestDirections(profileDir, { provider = requestCreativeDirections, token, fetchImpl, force = false } = {}) {
  const state = await prepareBrief(profileDir);
  if (state.blockers.length) throw new Error(`Resolve the request before paid generation: ${state.blockers.join(' ')}`);
  const cacheFile = path.join(state.prepared.root, 'creative-directions.json');
  const cached = await readOptionalJson(cacheFile);
  if (!force && cached?.schemaVersion === 'creative-directions/v1' && cached.inputHash === state.inputHash) {
    validateDirections(cached.directions, state.context); return { ...cached, reused: true };
  }
  const result = await provider(state.context, { token, fetchImpl });
  validateDirections(result.directions, state.context);
  const cache = { schemaVersion: 'creative-directions/v1', inputHash: state.inputHash, model: DIRECTIONS_MODEL,
    generatedAt: new Date().toISOString(), directions: result.directions, usage: result.usage ?? null };
  await writeJsonAtomically(cacheFile, cache);
  return { ...cache, reused: false };
}

export async function importDirections(profileDir, document) {
  const state = await prepareBrief(profileDir);
  validateDirections(document.directions, state.context);
  const cache = { schemaVersion: 'creative-directions/v1', inputHash: state.inputHash,
    model: 'human-import', generatedAt: new Date().toISOString(), directions: document.directions, usage: null };
  await writeJsonAtomically(path.join(state.prepared.root, 'creative-directions.json'), cache);
  return cache;
}

const quoted = (value) => JSON.stringify(value);
const LAYOUT = {
  split: 'Separate copy and image into two clear areas; on a narrow web viewport stack them without overlap.',
  editorial: 'Use a reading sequence with copy above a dedicated image area; preserve generous text measure and a clear action.',
  framed: 'Use a contained frame with a brand/header area, then the image and supporting copy in separate regions.',
};
const HIERARCHY = {
  'headline-first': 'Make approved headline the first and strongest reading point, followed by image, body and action.',
  'image-first': 'Make the image the strongest visual point; keep headline and action readable in separate regions.',
  'brand-first': 'Lead with the approved brand copy block, then headline, image, supporting copy and action.',
};
const TREATMENT = {
  'single-contained': 'Feature one contained image panel; keep image and text separate, using the approved fit.',
  'single-field': 'Give one image a larger surrounding visual field; reserve an independent copy region, using the approved fit.',
  paired: 'Compose two approved images as a pair with unequal emphasis; keep copy in its own region and respect both approved fits.',
};

export function briefMarkdown(brief) {
  const selected = brief.selectedDirection;
  const layout = selected?.layout === 'split' && brief.kind === 'instagram-story'
    ? 'Separate copy and image into clearly stacked regions within the portrait canvas; preserve the native sticker reservation.'
    : LAYOUT[selected?.layout];
  return `# Design brief — ${brief.kind}\n\nStatus: **${brief.status}**. ${selected ? `Selected direction: ${quoted(selected.id)}.` : 'No direction selected; do not execute.'}\n\n` +
    `## Request\n\nObjective: ${quoted(brief.request.objective)}\n\nAudience: ${quoted(brief.request.audience)}\n\n` +
    `## Exact approved copy\n\n${brief.request.copy.map((item) => `- ${item.id}: ${quoted(item.text)}`).join('\n') || 'Pending.'}\n\n` +
    `Do not invent prices, stock, products, people, fonts or additional copy. Confirmation: ${brief.request.sourceId ?? 'pending'} in the source registry below.\n\n` +
    `## Execute only the selected direction\n\n${selected ? `${layout}\n\n${HIERARCHY[selected.hierarchy]}\n\n${TREATMENT[selected.assetTreatment]}` : 'Pending human selection.'}\n\n` +
    `Use only the files below. Proposal rationales and unselected alternatives are records of ideation, not competing execution instructions.\n\n` +
    `## Selected assets\n\n${brief.assets.map((asset) => `- ${asset.id}: [${asset.role}](${asset.path}); ${asset.technical.width}×${asset.technical.height}; fit **${asset.use.fit}**.\n` +
      `  - Image alternative (${asset.use.alt.usage}): ${quoted(asset.use.alt.text)}. Permission source: ${asset.permission.sourceId}.\n` +
      `  - ${asset.use.fit === 'contain' ? 'Keep the whole original; do not apply the catalog cover-crop candidate.' : `Cover crop candidate: ${quoted(asset.crop)}; renewed visual review remains part of render acceptance.`}\n` +
      `  - ${asset.lowResolution ? asset.use.lowResolutionAccepted ? 'Low resolution accepted for the actual slot; inspect sharpness in the render.' : 'Resolution review is pending.' : 'Resolution meets the provisional image slot.'}`).join('\n') || 'Pending.'}\n\n` +
    `## Action\n\n${quoted(brief.request.action)}\n\n${brief.kind === 'instagram-story' ? 'Native sticker space is a reservation only. Do not draw a fake functioning link/button. Review space and destination in Instagram composer; coordinates are not a permanent platform guarantee. Keep supplied copy clear of this area.' : 'If a link is requested, use a semantic anchor with the exact label and destination, keyboard access and visible focus.'}\n\n` +
    `## Constraints\n\n${brief.request.constraints.map((item) => `- ${quoted(item)}`).join('\n') || '- No additional request constraints.'}\n\n` +
    `## Verified brand rules\n\n${brief.verifiedRules.map((item) => `- ${item.kind}/${item.target}: ${quoted(item.value)}; source ${item.sourceId}.`).join('\n') || 'No confirmed brand rules; retain uncertainty.'}\n\n` +
    `## Source comparisons\n\n${brief.brandConflicts.map((item) => `- ${quoted(item)}`).join('\n') || 'No source comparisons recorded.'}\n\n` +
    `## Brand observations (not verified rules)\n\n${brief.observations.map((item) => `- ${item.id}: ${quoted(item.value)}; ${item.status}; confidence ${item.confidence}; citations ${item.evidenceIds.join(', ') || 'none'}.`).join('\n')}\n\n` +
    `## Evidence and confirmation sources\n\n${brief.evidence.map((item) => `- ${item.id}: [source](${item.sourcePath}); ${quoted(item.summary)}.`).join('\n')}\n${brief.sources.map((item) => `- ${item.id}: [${item.reviewer}](${item.path}); reviewed ${item.reviewedAt}; ${item.stale ? 'changed — review required' : 'digest current'}.`).join('\n')}\n\n` +
    `## Acceptance criteria\n\n${brief.acceptanceCriteria.map((item) => `- [ ] ${item}`).join('\n')}\n\n` +
    `## Pending review\n\n${brief.pending.map((item) => `- ${quoted(item)}`).join('\n') || 'No input blockers. Rendering and human acceptance remain required.'}\n\n` +
    `## Ideation record — do not execute unselected alternatives\n\n${brief.directions.map((item) => `- ${quoted(item.id)} ${quoted(item.label)} (${item.id === selected?.id ? 'selected' : 'unselected'}): ${item.layout}, ${item.hierarchy}, ${item.assetTreatment}; assets ${item.assetIds.join(', ')}; citations ${item.evidenceIds.join(', ')}. Proposal rationale: ${quoted(item.rationale)}. Limits: ${quoted(item.limits)}. Missing: ${quoted(item.missingInformation)}.`).join('\n')}\n`;
}

export async function compileBrief(profileDir, { outputDir } = {}) {
  const state = await prepareBrief(profileDir);
  const cached = await readOptionalJson(path.join(state.prepared.root, 'creative-directions.json'));
  if (!cached || cached.schemaVersion !== 'creative-directions/v1' || cached.inputHash !== state.inputHash) throw new Error('Creative directions are missing or stale; explicitly generate or import reviewed proposals.');
  validateDirections(cached.directions, state.context);
  const selected = cached.directions.find((direction) => direction.id === state.request.selectedDirectionId) ?? null;
  if (state.request.selectedDirectionId && !selected) throw new Error('Selected direction does not exist.');
  const pending = [...state.blockers];
  if (!selected) pending.push('Select one direction before execution.');
  if (selected) pending.push(...selected.missingInformation);
  if (selected?.hierarchy === 'brand-first' && !state.request.copy.some((item) => item.id === 'brand')) pending.push('brand-first direction requires confirmed brand copy.');
  const assets = selected ? state.selected.filter((entry) => selected.assetIds.includes(entry.id)) : state.selected;
  const brief = { schemaVersion: 'design-brief/v1', inputHash: state.inputHash, kind: state.request.kind,
    status: pending.length ? 'needs-review' : 'ready-for-execution', request: state.request,
    selectedDirection: selected, directions: cached.directions, pending,
    observations: state.decisions.effectiveAnalysis.inferences,
    verifiedRules: state.decisions.activeRules, brandConflicts: state.decisions.conflicts,
    sources: state.decisions.sources.map(({ absolutePath, ...source }) => ({ ...source, path: `sources/${source.id}${path.extname(source.path)}` })),
    evidence: structuredClone(state.prepared.evidence),
    assets: assets.map(({ absolutePath, ...entry }) => ({ ...entry, path: `assets/${entry.id}${path.extname(entry.path)}` })),
    acceptanceCriteria: [
      'Use the exact approved copy and selected direction; invent no brand facts or extra assets.',
      ...(state.request.kind === 'web-hero' ? [
        'Render and review at 1440 px and 390 px wide: no overlap, clipped copy or horizontal overflow.',
        'Use semantic headings, meaningful image alternatives, keyboard access and visible focus for links.',
        'Check actual color contrast and reduced-motion behavior; tokens alone do not prove accessibility.',
      ] : ['Render at 1080 × 1920; review copy legibility, image subject and reserved sticker space.',
        'Supply a text transcript/description with the exported Story; static artwork is not an accessible web control.']),
      'Review crop, source permissions, destination and composition with a person before publishing.',
    ] };
  const target = path.resolve(outputDir ?? path.join(state.prepared.root, 'brief', state.request.kind));
  const relative = path.relative(state.prepared.root, target);
  const ancestors = path.relative(target, state.prepared.root);
  if (relative === '' || !ancestors.startsWith('..') && !path.isAbsolute(ancestors) ||
      !relative.startsWith('..') && !path.isAbsolute(relative) && !relative.startsWith(`brief${path.sep}`)) throw new Error('Brief output must be a separate directory, not profile input or an ancestor.');
  let ancestor = target;
  for (;;) {
    try {
      const canonical = await realpath(ancestor);
      const comparable = (value) => process.platform === 'win32' ? value.toLowerCase() : value;
      if (comparable(canonical) !== comparable(ancestor)) throw new Error('Brief output cannot redirect through a symbolic link.');
      break;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      ancestor = path.dirname(ancestor);
    }
  }
  try {
    const existing = await lstat(target);
    if (existing.isSymbolicLink()) throw new Error('Brief output cannot redirect through a symbolic link.');
    const marker = await readOptionalJson(path.join(target, 'design-brief.json'));
    if (marker?.schemaVersion !== 'design-brief/v1') throw new Error('Refusing to replace a directory that is not an importer brief.');
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  await buildDirectoryAtomically(target, async (staged) => {
    for (const dir of ['assets', 'sources', 'evidence']) await mkdir(path.join(staged, dir));
    for (const entry of assets) await copyFile(entry.absolutePath, path.join(staged, brief.assets.find((item) => item.id === entry.id).path));
    for (const source of state.decisions.sources) await copyFile(source.absolutePath, path.join(staged, brief.sources.find((item) => item.id === source.id).path));
    for (const evidence of brief.evidence) {
      const source = await profileFile(state.prepared.root, evidence.sourcePath);
      const destination = `evidence/${evidence.id}${path.extname(evidence.sourcePath)}`;
      await copyFile(source, path.join(staged, destination)); evidence.sourcePath = destination;
    }
    await writeFile(path.join(staged, 'design-brief.json'), json(brief));
    await writeFile(path.join(staged, 'BRIEF.md'), briefMarkdown(brief));
  });
  return { outputDir: target, brief };
}
