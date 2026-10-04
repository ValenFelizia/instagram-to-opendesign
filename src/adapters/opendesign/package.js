import { copyFile, mkdir, readFile, realpath, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import sharp from 'sharp';
import { validateAnalysis } from '../../analyze.js';
import { buildDirectoryAtomically } from '../../atomic.js';
import { validateColorCandidates } from '../../colors.js';
import { decisionsMarkdown, loadDecisions } from '../../decisions.js';
import { buildAssetCatalog } from '../../asset-catalog.js';
import { digest, fileDigests, json as stableJson } from '../../local.js';
import { validateOpenDesignTokenOverrides } from './tokens.js';

const BASE_TOKENS = new URL('../../../examples/example-studio/tokens.css', import.meta.url);
const ANALYSIS_SCHEMA = new URL('../../../schemas/brand-analysis.schema.json', import.meta.url);
const isOwn = (owner, username) => typeof owner === 'string' &&
  owner.replace(/^@/, '').toLowerCase() === username.toLowerCase();
const safeText = (value) => String(value ?? '').replace(/[<>]/g, '').trim();
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
const write = (root, relative, content) => writeFile(path.join(root, relative), content);

export function packageSlug(username) {
  const slug = String(username).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) throw new Error('Username cannot form an OpenDesign package ID.');
  return slug;
}

function contrastRatio(a, b) {
  const luminance = (hex) => {
    const channels = hex.slice(1).match(/../g).map((part) => parseInt(part, 16) / 255);
    return channels.map((n) => n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4)
      .reduce((sum, n, index) => sum + n * [0.2126, 0.7152, 0.0722][index], 0);
  };
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

function accessibleInk(background) {
  return contrastRatio(background, '#ffffff') >= contrastRatio(background, '#171717') ? '#ffffff' : '#171717';
}

export async function renderTokens(candidates, overrides = {}) {
  validateOpenDesignTokenOverrides(overrides);
  const original = await readFile(BASE_TOKENS, 'utf8');
  const accent = candidates.primary.hex?.toLowerCase() ?? '#333333';
  const warm = candidates.secondary.hex?.toLowerCase() ?? '#f4f3ee';
  const changes = new Map([
    ['bg', '#fffdf8'], ['surface', '#ffffff'], ['surface-warm', warm],
    ['fg', '#242424'], ['fg-2', 'var(--fg)'], ['muted', '#59605f'],
    ['border', '#c9d0c2'], ['accent', accent], ['accent-on', accessibleInk(accent)],
    ['font-display', 'Arial, system-ui, sans-serif'],
    ['font-body', 'Arial, system-ui, sans-serif'],
  ]);
  for (const [name, value] of Object.entries(overrides)) changes.set(name, value);
  const resolveColor = (name, seen = new Set()) => {
    if (seen.has(name)) throw new Error(`Circular color alias: ${name}`);
    seen.add(name);
    const value = changes.get(name);
    const alias = /^var\(--([a-z0-9-]+)\)$/.exec(value ?? '');
    return alias ? resolveColor(alias[1], seen) : value;
  };
  const effectiveAccent = resolveColor('accent');
  if (!/^#[a-f0-9]{6}$/i.test(effectiveAccent)) throw new Error('Accent must resolve to a six-digit hex color.');
  if (!overrides['accent-on']) changes.set('accent-on', accessibleInk(effectiveAccent));
  const names = new Set();
  const css = original.replace(/^\/\* Synthetic fixture[^\n]*\n/, '')
    .replace(/(--([a-z0-9-]+):\s*)([^;]+)(;)/g, (whole, prefix, name, value, end) => {
      names.add(name);
      return `${prefix}${changes.get(name) ?? value}${end}`;
    });
  if (names.size !== 56 || [...changes.keys()].some((name) => !names.has(name))) {
    throw new Error('The pinned OpenDesign token template no longer has its expected 56 slots.');
  }
  const ink = resolveColor('accent-on');
  if (!/^#[a-f0-9]{6}$/i.test(ink) || contrastRatio(effectiveAccent, ink) < 4.5) {
    throw new Error('Approved accent/foreground contrast is too low; review the confirmed pair.');
  }
  const origins = [...names].map((name) => ({ name,
    origin: overrides[name] ? 'confirmed human rule' : (name === 'accent' && candidates.primary.hex ||
      name === 'surface-warm' && candidates.secondary.hex) ? 'approximate visual inference' : 'functional default' }));
  return { css: `/* See source/token-origins.json for confirmed, inferred and default values. */\n${css}`,
    accent: effectiveAccent, warm: changes.get('surface-warm'), accentOn: ink,
    fontDisplay: changes.get('font-display'), fontBody: changes.get('font-body'), origins };
}

function paragraph(inference) {
  if (!inference || inference.value === null) return 'Sin evidencia suficiente; requiere revisión.';
  const label = inference.status === 'inferred' ? 'Inferencia revisable' : 'Propuesta pendiente de revisión';
  return `${label} (${inference.confidence ?? 'confianza no establecida'}): ${safeText(inference.value)} ` +
    `Evidencia: ${inference.evidenceIds.map((id) => `\`${id}\``).join(', ') || 'sin citas'}.`;
}

function designMarkdown(analysis, tokens, candidates) {
  const topics = new Map(analysis.inferences.map((item) => [item.topic, item]));
  const name = safeText(analysis.subject.displayName);
  const colorEvidence = [...new Set([...candidates.primary.evidenceIds, ...candidates.secondary.evidenceIds])];
  return `# ${name} — borrador para OpenDesign

> Category: Experimental

Identidad inicial derivada de evidencia pública revisada. Ninguna inferencia equivale a una decisión verificada por la marca. Consultar [procedencia](source/evidence.md) y [análisis completo](brand-analysis.json) antes de adoptar este sistema.

## Tema visual

${paragraph(topics.get('brand.personality'))}

## Colores y roles

${paragraph(topics.get('color.palette'))}

${paragraph(topics.get('color.roles'))}

Los tokens provisionales usan \`--accent: ${tokens.accent}\` y \`--surface-warm: ${tokens.warm}\`; \`--accent-on: ${tokens.accentOn}\` se eligió por contraste. Candidatos visuales: ${colorEvidence.map((id) => `\`${id}\``).join(', ') || 'ninguno; valores neutros de reserva'}. Los hexadecimales son aproximaciones para el prototipo, no especificaciones oficiales.

## Tipografía

${paragraph(topics.get('typography.style'))}

La UI usa \`${safeText(tokens.fontBody)}\` para cuerpo y \`${safeText(tokens.fontDisplay)}\` para títulos. Sin una regla humana confirmada, son fuentes funcionales provisionales. No se identificó ni licenció automáticamente una fuente del logotipo.

## Fotografía y materialidad

${paragraph(topics.get('imagery.direction'))}

${paragraph(topics.get('material.texture'))}

## Composición y espaciado

${paragraph(topics.get('composition.patterns'))}

La escala de espaciado de \`tokens.css\` es un valor funcional provisional, no una medición del perfil.

## Voz y llamadas a la acción

${paragraph(topics.get('voice.tone'))}

${paragraph(topics.get('copy.cta'))}

## Componentes e interacción

${paragraph(topics.get('ui.guidance'))}

Botones, bordes y estados usan los tokens semánticos. La guía UI sigue siendo una extrapolación para revisar en un diseño concreto.

## Accesibilidad y movimiento

Revisar contraste de cada combinación final, foco visible y navegación por teclado. Respetar preferencias de movimiento reducido. Los tokens de foco y movimiento son valores funcionales provisionales.

## Procedencia y límites

Las imágenes de \`source/images/\` y el moodboard son referencias de análisis; no autorizan reutilización. Usar en diseños sólo los assets marcados \`readyForDesign\` en \`source/asset-catalog.json\`, exportados a \`assets/reusable/\`. La autoría del perfil no establece permiso. Los IDs de evidencia se conservan en \`brand-analysis.json\`; sus rutas apuntan a archivos de este paquete. El material real no se publica con el repositorio OSS.
`;
}

function exportSource(source, prepared, imageTargets) {
  const mediaByPost = new Map();
  for (const image of prepared.images) {
    if (image.imageId === 'profile/avatar') continue;
    const postId = image.imageId.split('/')[0];
    mediaByPost.set(postId, [...(mediaByPost.get(postId) ?? []),
      { evidenceId: image.evidenceId, assetPath: imageTargets.get(image.evidenceId) }]);
  }
  return {
    schemaVersion: 'instagram-package-source/v1',
    source: { provider: source.source.provider, profileUrl: source.source.profileUrl,
      extractedAt: source.source.extractedAt },
    profile: { username: source.profile.username, fullName: source.profile.fullName,
      biography: source.profile.biography },
    posts: source.posts.filter((post) => isOwn(post.ownerUsername, source.profile.username))
      .map((post) => ({ id: post.id, url: post.url, ownerUsername: post.ownerUsername,
        timestamp: post.timestamp, caption: post.caption, media: mediaByPost.get(post.id) ?? [] })),
  };
}

async function createMoodboard(images, root) {
  const chosen = images.slice(0, 12);
  const width = 4 * 300, height = Math.ceil(chosen.length / 4) * 300;
  const composites = [];
  for (const [index, item] of chosen.entries()) {
    const input = await sharp(await readFile(item.absolutePath)).resize(300, 300, { fit: 'cover' }).jpeg().toBuffer();
    composites.push({ input, left: index % 4 * 300, top: Math.floor(index / 4) * 300 });
  }
  // Node's filesystem supports the long managed staging paths on Windows;
  // native image output APIs may still apply MAX_PATH.
  const bytes = await sharp({ create: { width, height, channels: 3, background: '#fffdf8' } })
    .composite(composites).webp({ quality: 82 }).toBuffer();
  await writeFile(path.join(root, 'assets', 'moodboard.webp'), bytes);
}

export async function validateBuiltPackage(root, slug) {
  const manifest = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8'));
  if (manifest.schemaVersion !== 'od-design-system-project/v1' || manifest.id !== slug ||
      manifest.files?.design !== 'DESIGN.md' || manifest.files?.tokens !== 'tokens.css' ||
      manifest.source?.type !== 'local' || manifest.sourceFiles !== undefined) {
    throw new Error('Generated manifest does not match the OpenDesign minimum profile.');
  }
  const analysis = JSON.parse(await readFile(path.join(root, 'brand-analysis.json'), 'utf8'));
  const schema = JSON.parse(await readFile(ANALYSIS_SCHEMA, 'utf8'));
  const ajv = new Ajv2020({ allErrors: true, strictTypes: false }); addFormats(ajv);
  const validate = ajv.compile(schema);
  if (!validate(analysis)) throw new Error(`Packaged analysis is invalid: ${ajv.errorsText(validate.errors)}`);
  const ids = new Set(analysis.evidence.map((item) => item.id));
  for (const item of analysis.inferences) {
    if (item.status === 'verified' || item.evidenceIds.some((id) => !ids.has(id))) {
      throw new Error('Packaged analysis contains an invalid inference reference or status.');
    }
  }
  for (const item of analysis.evidence) {
    const file = path.resolve(root, item.sourcePath);
    if (!file.startsWith(root + path.sep) || !(await stat(file)).isFile() ||
      !(await realpath(file)).startsWith(root + path.sep)) {
      throw new Error(`Packaged evidence path is unsafe: ${item.sourcePath}`);
    }
  }
  for (const required of ['DESIGN.md', 'tokens.css', 'assets/moodboard.webp', 'source/evidence.md',
    'source/instagram-source.json']) await stat(path.join(root, required));
  const css = await readFile(path.join(root, 'tokens.css'), 'utf8');
  if (new Set([...css.matchAll(/--([a-z0-9-]+):/g)].map((match) => match[1])).size !== 56) {
    throw new Error('Generated package does not contain all 56 OpenDesign tokens.');
  }
  const design = await readFile(path.join(root, 'DESIGN.md'), 'utf8');
  if ((design.match(/^## /gm) ?? []).length < 7) throw new Error('DESIGN.md needs seven substantive sections.');
}

export function packageContextHash(analysis, colorProposals, decisions, catalog, channel) {
  return digest(stableJson({ analysis, colorProposals: { schemaVersion: colorProposals.schemaVersion,
    inputHash: colorProposals.inputHash, candidates: colorProposals.candidates }, decisions: decisions.document, catalog, channel }));
}
export async function compilePackage(prepared, analysis, colorProposals, { outputRoot = 'brand-output', channel = 'website' } = {}) {
  await validateAnalysis(analysis, prepared);
  if (JSON.stringify(analysis.evidence) !== JSON.stringify(prepared.evidence)) {
    throw new Error('Analysis evidence is stale; re-run the analyzer before packaging.');
  }
  const graphics = prepared.images.filter((item) => item.review.classification === 'brand-graphic').slice(0, 4);
  validateColorCandidates(colorProposals.candidates, graphics);
  const decisions = await loadDecisions(prepared, analysis, { channel });
  const assets = await buildAssetCatalog(prepared, analysis, { write: false });
  const blockedColors = decisions.decisions.some((item) => (item.stale || item.action === 'reject') &&
    analysis.inferences.find((inference) => inference.id === item.inferenceId)?.topic.startsWith('color.'));
  const candidates = blockedColors ? {
    primary: { hex: null, evidenceIds: [], rationale: 'Color proposal requires human review.' },
    secondary: { hex: null, evidenceIds: [], rationale: 'Color proposal requires human review.' },
  } : colorProposals.candidates;
  const slug = packageSlug(prepared.source.profile.username);
  const outputDir = path.resolve(outputRoot, slug);
  const tokens = await renderTokens(candidates, decisions.tokenOverrides);
  await buildDirectoryAtomically(outputDir, async (root) => {
    for (const relative of ['assets/reusable', 'source/images', 'source/captions']) {
      await mkdir(path.join(root, relative), { recursive: true });
    }
    const imageTargets = new Map();
    for (const image of prepared.images) {
      const reusable = assets.entries.find((entry) => entry.id === image.evidenceId)?.readyForDesign;
      const relative = `${reusable ? 'assets/reusable' : 'source/images'}/${image.evidenceId}${path.extname(image.assetPath).toLowerCase()}`;
      imageTargets.set(image.evidenceId, relative);
      await copyFile(image.absolutePath, path.join(root, relative));
    }
    const assetExport = structuredClone(assets.catalog);
    for (const entry of assets.entries) {
      const target = imageTargets.get(entry.id) ?? `${entry.readyForDesign ? 'assets/reusable' : 'source/images'}/${entry.id}${path.extname(entry.path).toLowerCase()}`;
      if (!imageTargets.has(entry.id)) await copyFile(entry.absolutePath, path.join(root, target));
      const exported = assetExport.entries.find((item) => item.id === entry.id);
      exported.path = target;
    }
    const captionTargets = new Map();
    for (const caption of prepared.captions) {
      const relative = `source/captions/${caption.evidenceId}.md`;
      captionTargets.set(caption.evidenceId, relative);
      await write(root, relative, `# Caption ${caption.postId}\n\n${caption.caption}\n`);
    }
    const evidence = analysis.evidence.map((item) => ({ ...item,
      sourcePath: item.kind === 'metadata' ? 'source/instagram-source.json'
        : item.kind === 'image' ? imageTargets.get(item.id) : captionTargets.get(item.id) }));
    if (evidence.some((item) => !item.sourcePath)) throw new Error('Cannot remap an analysis evidence path.');
    const packagedAnalysis = { ...analysis, evidence };
    const source = exportSource(prepared.source, prepared, imageTargets);
    const manifest = {
      schemaVersion: 'od-design-system-project/v1', id: slug,
      name: `${safeText(analysis.subject.displayName)} (draft)`, category: 'Experimental',
      description: 'Provisional Instagram-derived identity with reviewable evidence.',
      source: { type: 'local', path: outputDir },
      files: { design: 'DESIGN.md', tokens: 'tokens.css' }, assetsDir: 'assets',
    };
    await write(root, 'manifest.json', json(manifest));
    // Published means selectable in the local catalog, not verified brand identity.
    await write(root, 'metadata.json', json({ status: 'published' }));
    const decisionExport = structuredClone(decisions.document);
    for (const source of decisions.sources) {
      const target = `source/manual/${source.id}${path.extname(source.path)}`;
      await mkdir(path.join(root, 'source/manual'), { recursive: true });
      await copyFile(source.absolutePath, path.join(root, target));
      decisionExport.sources.find((item) => item.id === source.id).path = target;
    }
    await write(root, 'DESIGN.md', designMarkdown({ ...packagedAnalysis,
      inferences: decisions.effectiveAnalysis.inferences }, tokens, candidates) + '\n' +
      decisionsMarkdown({ ...decisions, sources: decisionExport?.sources ?? [] }, tokens.origins) +
      '\n## Reusable assets and composition review\n\n' + assetExport.entries.map((entry) =>
        `- ${entry.id}: [${entry.role}](${entry.path}); ${entry.primary ? 'primary; ' : ''}` +
        `${entry.readyForDesign ? 'design use confirmed' : 'reference only: ' + entry.blockers.join('; ')}. ` +
        `Crop and alt text remain candidates for the actual composition.`).join('\n') + '\n');
    await write(root, 'tokens.css', tokens.css);
    await write(root, 'brand-analysis.json', json(packagedAnalysis));
    await write(root, 'source/token-origins.json', json(tokens.origins));
    await write(root, 'source/asset-catalog.json', json(assetExport));
    if (decisionExport) await write(root, 'source/brand-decisions.json', json(decisionExport));
    await write(root, 'source/instagram-source.json', json(source));
    await write(root, 'source/color-proposals.json', json({
      schemaVersion: colorProposals.schemaVersion, inputHash: colorProposals.inputHash,
      candidates: colorProposals.candidates,
    }));
    await write(root, 'source/evidence.md', [
      `# Evidencia de @${prepared.source.profile.username}`, '',
      'Sólo materiales propios, seleccionados y revisados. Las propuestas de color son aproximadas.', '',
      ...evidence.map((item) => `- \`${item.id}\` (${item.kind}): [${safeText(item.summary)}](../${item.sourcePath})`),
      '', '## Inferencias', '',
      ...packagedAnalysis.inferences.map((item) => `- \`${item.topic}\` · ${item.status} · ` +
        `${item.confidence ?? 'sin confianza'} · ${item.evidenceIds.join(', ') || 'sin evidencia'}`), '',
    ].join('\n'));
    await createMoodboard(prepared.images, root);
    await write(root, 'source/package-context.json', json({ schemaVersion: 'package-context/v1', channel,
      inputHash: packageContextHash(analysis, colorProposals, decisions, assets.catalog, channel), files: await fileDigests(root) }));
    await validateBuiltPackage(root, slug);
  });
  return { outputDir, slug, tokens };
}
