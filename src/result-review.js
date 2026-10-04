import { copyFile, lstat, mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import sharp from 'sharp';
import { createDirectoryAtomically } from './atomic.js';
import { contrastRatio } from './accessibility.js';
import { digest, fileDigests, json, profileFile } from './local.js';
import { runEffortEvents } from './run-record.js';

const box = { type: 'object', additionalProperties: false, required: ['x', 'y', 'width', 'height'], properties: {
  x: { type: 'number' }, y: { type: 'number' }, width: { type: 'number', minimum: 0 }, height: { type: 'number', minimum: 0 } } };
const nullableColor = { type: ['string', 'null'], pattern: '^#[a-fA-F0-9]{6}$' };
const observationSchema = { type: 'object', additionalProperties: false,
  required: ['schemaVersion', 'viewport', 'visibleText', 'overflow', 'copy', 'assets', 'action'], properties: {
    schemaVersion: { const: 'render-observations/v1' }, viewport: { type: 'object', additionalProperties: false,
      required: ['width', 'height'], properties: { width: { type: 'integer', minimum: 1 }, height: { type: 'integer', minimum: 1 } } },
    visibleText: { type: 'string' }, overflow: { type: 'boolean' }, copy: { type: 'array', items: { type: 'object', additionalProperties: false,
      required: ['id', 'text', 'visible', 'rect', 'foreground', 'background', 'fontSize', 'fontWeight'], properties: {
        id: { type: 'string' }, text: { type: 'string' }, visible: { type: 'boolean' }, rect: box,
        foreground: nullableColor, background: nullableColor, fontSize: { type: 'number' }, fontWeight: { type: 'number' },
      } } },
    assets: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['id', 'src', 'visible', 'rect', 'fit', 'alt'], properties: {
      id: { type: 'string' }, src: { type: ['string', 'null'] }, visible: { type: 'boolean' }, rect: box,
      fit: { type: 'string' }, alt: { type: ['string', 'null'] },
    } } },
    action: { anyOf: [{ type: 'null' }, { type: 'object', additionalProperties: false, required: ['tag', 'label', 'href', 'visible', 'occluded', 'rect'], properties: {
      tag: { type: 'string' }, label: { type: 'string' }, href: { type: ['string', 'null'] }, visible: { type: 'boolean' }, rect: box,
      occluded: { type: ['boolean', 'null'] },
    } }] },
  } };
const validateObservation = new Ajv2020({ strictTypes: false }).compile(observationSchema);
const safeId = /^[A-Za-z0-9][A-Za-z0-9-]{0,63}$/;
const normalize = (text) => text.replace(/\s+/g, ' ').trim();
const intersects = (a, b) => a.width > 0 && a.height > 0 && b.width > 0 && b.height > 0 && a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
const causes = ['source-selection', 'inference', 'preparation', 'brief', 'opendesign-composition', 'unknown'];

export async function reviewResult(briefDir, input, { outputRoot } = {}) {
  if (!outputRoot || !input || input.schemaVersion !== 'result-review-input/v1' || !safeId.test(input.experimentId) ||
      !['manual', 'tool'].includes(input.variant) || !Number.isInteger(input.revision) || input.revision < 0) throw new Error('Supply output root and valid experiment/variant/revision.');
  if (!input.run || !['none', 'limited', 'deep', 'unknown'].includes(input.run.priorKnowledge) || !input.run.model?.trim() ||
      !input.run.openDesignVersion?.trim() || !Number.isInteger(input.run.iterationBudget) || input.run.iterationBudget < 1) throw new Error('Record model, OpenDesign version, prior knowledge and iteration budget.');
  const root = await realpath(input.artifactRoot), sourceBrief = await realpath(briefDir);
  const brief = JSON.parse(await readFile(path.join(sourceBrief, 'design-brief.json'), 'utf8'));
  if (brief.schemaVersion !== 'design-brief/v1' || !brief.selectedDirection) throw new Error('Review requires a selected brief.');
  if (!Array.isArray(input.artifacts) || !input.artifacts.length) throw new Error('Preserve at least one HTML or screenshot artifact.');
  const checks = [], archive = new Map(), references = new Set([
    ...brief.request.copy.map((item) => item.id), ...brief.assets.map((item) => item.id),
    ...brief.verifiedRules.map((item) => item.id), ...brief.evidence.map((item) => item.id), 'action', 'viewport',
  ]);
  const add = (id, status, instruction, referenceIds = [], observation = null) => {
    references.add(id); checks.push({ id, status, instruction, referenceIds, observation, cause: 'unknown', scope: 'request' });
  };
  const preserve = async (relative) => {
    if (typeof relative !== 'string' || relative.split('/').some((part) => part === '.' || part === '..')) throw new Error('Artifact paths must be literal relative paths without traversal.');
    if (!archive.has(relative)) archive.set(relative, { absolute: await profileFile(root, relative), sha256: digest(await readFile(await profileFile(root, relative))) });
    return archive.get(relative);
  };
  const seen = new Set(), viewports = [], technical = new Map();
  for (const artifact of input.artifacts) {
    if (!['html', 'screenshot', 'observations', 'feedback', 'supporting'].includes(artifact.kind) || !safeId.test(artifact.id) || seen.has(artifact.id)) throw new Error('Invalid or duplicate artifact ID/kind.');
    seen.add(artifact.id); await preserve(artifact.path);
    if (artifact.kind === 'screenshot') {
      const metadata = await sharp(await profileFile(root, artifact.path), { limitInputPixels: 100000000 }).metadata();
      technical.set(artifact.id, { width: metadata.width, height: metadata.height, format: metadata.format });
      if (['instagram-story', 'promotional-image'].includes(brief.kind)) {
        const target = brief.request.target ?? { width: 1080, height: 1920 };
        add(`${artifact.id}-export-dimensions`, metadata.width === target.width && metadata.height === target.height ? 'pass' : 'fail', 'Match the approved exported artwork dimensions.', ['viewport'], { actual: technical.get(artifact.id), target });
      }
    }
    if (artifact.kind !== 'observations') continue;
    const html = input.artifacts.find((item) => item.id === artifact.htmlId && item.kind === 'html');
    if (!html || artifact.htmlSha256 !== (await preserve(html.path)).sha256) throw new Error('DOM observations must reference the exact preserved HTML hash.');
    const observed = JSON.parse(await readFile(await profileFile(root, artifact.path), 'utf8'));
    if (!validateObservation(observed)) throw new Error('Invalid rendered DOM observations.');
    for (const items of [observed.copy, observed.assets]) if (new Set(items.map((item) => item.id)).size !== items.length) throw new Error('Duplicate observed marker; review ambiguous IDs.');
    viewports.push(observed.viewport);
    const prefix = artifact.id;
    add(`${prefix}-overflow`, observed.overflow ? 'fail' : 'pass', 'Check horizontal overflow at the captured viewport.', ['viewport'], observed.viewport);
    for (const copy of brief.request.copy) {
      const node = observed.copy.find((item) => item.id === copy.id);
      const present = normalize(observed.visibleText).includes(normalize(copy.text));
      add(`${prefix}-copy-${copy.id}`, !present || node && (!node.visible || normalize(node.text) !== normalize(copy.text)) ? 'fail' : 'pass', 'Use the exact approved copy, visible in this render.', [copy.id], { expected: copy.text, markedText: node?.text ?? null, visible: node?.visible ?? null });
      if (!node) { add(`${prefix}-geometry-${copy.id}`, 'manual-review', 'Missing DOM marker: inspect clipping, contrast and placement.', [copy.id]); continue; }
      const solid = node.foreground && node.background;
      const threshold = node.fontSize >= 24 || node.fontSize >= 18.6667 && node.fontWeight >= 700 ? 3 : 4.5;
      const ratio = solid ? contrastRatio(node.foreground, node.background) : null;
      add(`${prefix}-contrast-${copy.id}`, ratio === null ? 'manual-review' : ratio >= threshold ? 'pass' : 'fail', 'Check measured text contrast; photograph/compositing backgrounds remain pending.', [copy.id], { ratio, threshold });
      const clipping = node.rect.x < 0 || node.rect.x + node.rect.width > observed.viewport.width;
      add(`${prefix}-clipping-${copy.id}`, clipping ? 'fail' : 'manual-review', 'Check clipping, ancestor masks, overlays and reading order in the screenshot; geometry alone cannot prove visibility.', [copy.id], node.rect);
    }
    for (const asset of brief.assets) {
      const node = observed.assets.find((item) => item.id === asset.id);
      if (!node) { add(`${prefix}-asset-${asset.id}`, 'manual-review', 'Missing image marker: verify the actual supplied file and composition.', [asset.id]); continue; }
      let bytes = null;
      if (node.src && /^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(node.src)) {
        try { bytes = (await preserve(node.src)).sha256; } catch (error) { if (error.code !== 'ENOENT') throw error; }
      }
      add(`${prefix}-asset-${asset.id}`, !node.visible || bytes && bytes !== asset.sha256 ? 'fail' : bytes ? 'pass' : 'manual-review', 'Use the exact approved asset; remote/data sources need independent byte verification.', [asset.id]);
      if (asset.use.alt.usage !== 'unknown') add(`${prefix}-alt-${asset.id}`, node.alt === asset.use.alt.text ? 'pass' : 'fail', 'Preserve the approved contextual alternative.', [asset.id]);
      const expectedFit = asset.use.fit;
      add(`${prefix}-crop-${asset.id}`, node.fit === 'cover' && expectedFit === 'contain' ? 'fail' : 'manual-review', 'Review actual crop, subject, distortion and resolution; the render must respect the approved fit.', [asset.id]);
      for (const copy of observed.copy.filter((item) => item.visible)) if (node.visible && intersects(copy.rect, node.rect)) add(`${prefix}-overlap-${copy.id}-${asset.id}`, 'fail', 'Selected direction requires separate copy and image regions; review the overlap.', [copy.id, asset.id]);
    }
    if (brief.request.action.type === 'link') {
      const action = observed.action;
      const good = action?.visible && !action.occluded && action.tag === 'a' && normalize(action.label) === normalize(brief.request.action.label) && action.href === brief.request.action.url;
      add(`${prefix}-action`, !action ? 'manual-review' : good ? 'pass' : 'fail', 'Keep the exact semantic link, approved label and destination visible.', ['action'], action);
      if (action) for (const image of observed.assets.filter((item) => item.visible)) if (intersects(action.rect, image.rect)) add(`${prefix}-action-overlap-${image.id}`, 'fail', 'Selected direction requires separate action and image regions; review the overlap.', ['action', image.id]);
    }
    if (['instagram-story', 'promotional-image'].includes(brief.kind)) {
      if (observed.action?.visible && ['a', 'button'].includes(observed.action.tag)) add(`${prefix}-static-action`, 'fail', 'Do not simulate a functioning web control in static artwork; review its native publishing action separately.', ['action']);
      const target = brief.request.target ?? { width: 1080, height: 1920 };
      add(`${prefix}-dimensions`, observed.viewport.width === target.width && observed.viewport.height === target.height ? 'pass' : 'fail', 'Match the approved artwork canvas dimensions.', ['viewport'], { actual: observed.viewport, target });
      const reserved = brief.request.action.reservedSpace;
      if (reserved) {
        const sticker = { x: reserved.x * target.width, y: reserved.y * target.height, width: reserved.width * target.width, height: reserved.height * target.height };
        for (const node of [...observed.copy, ...observed.assets].filter((item) => item.visible)) if (intersects(node.rect, sticker)) add(`${prefix}-sticker-${node.id}`, 'fail', 'Keep supplied copy/assets clear of the reserved native sticker space.', [node.id, 'action']);
      }
    }
  }
  if (!viewports.length) add('observability', 'manual-review', 'Screenshots/HTML alone do not establish computed contrast, asset bytes, action semantics or keyboard behavior. Supply rendered observations and human review.');
  const web = ['web-hero', 'website-change'].includes(brief.kind);
  if (web) for (const width of [1440, 390]) add(`viewport-${width}`, viewports.some((viewport) => viewport.width === width) ? 'pass' : 'manual-review', 'Capture and review this required web viewport.', ['viewport'], { width });
  for (const task of brief.accessibility?.checks.filter((check) => check.status === 'manual-review') ?? []) add(`manual-${task.id}`, 'manual-review', task.instruction, references.has(task.id) ? [task.id] : []);
  add('human-acceptance', 'manual-review', 'Review composition, crop, clipping, action and all accessibility tasks before publishing.');
  const corrections = checks.filter((check) => check.status !== 'pass').map((check) => ({ ...check, origin: 'deterministic-check', action: 'Review this requirement in the preserved result before changing inputs.' }));
  for (const feedback of input.feedback ?? []) {
    if (!feedback.reviewer?.trim() || !feedback.note?.trim() || !causes.includes(feedback.cause) ||
        !Array.isArray(feedback.referenceIds) || feedback.referenceIds.some((id) => !references.has(id))) throw new Error('Feedback requires reviewer, original note, valid cause and known references.');
    const source = input.artifacts.find((artifact) => artifact.id === feedback.sourceArtifactId && artifact.kind === 'feedback');
    if (!source) throw new Error('Human feedback must cite a preserved original feedback artifact.');
    corrections.push({ ...feedback, origin: 'human-judgment', status: 'manual-review', scope: 'request', action: 'Keep this preference request-specific; review before editing a brief or any brand decision.' });
  }
  const events = [...(input.events ?? [])];
  const importedRuns = [];
  if (input.runRecords !== undefined && !Array.isArray(input.runRecords)) throw new Error('runRecords must be an array of local JSON paths.');
  const imported = [];
  for (const file of input.runRecords ?? []) {
    const content = await readFile(file, 'utf8'), record = JSON.parse(content);
    importedRuns.push({ id: record.id, sha256: digest(Buffer.from(content)), content });
    imported.push(...runEffortEvents(record, input.currency ?? null));
  }
  const uniqueImports = new Map();
  for (const event of imported) {
    if (uniqueImports.has(event.id) && json(uniqueImports.get(event.id)) !== json(event)) throw new Error('Conflicting imported run event.');
    uniqueImports.set(event.id, event);
  }
  if (input.currency !== undefined && input.currency !== null && !/^[A-Z]{3}$/.test(input.currency)) throw new Error('Record an explicit three-letter currency or null.');
  if (new Set(events.map((event) => event.id)).size !== events.length) throw new Error('Duplicate effort event.');
  for (const event of events) if (!safeId.test(event.id) || !['ingestion', 'analysis', 'asset-preparation', 'prompt', 'manual-edit', 'review'].includes(event.type) ||
      !event.description?.trim() || !(event.minutes === null || Number.isFinite(event.minutes) && event.minutes >= 0) ||
      !(event.cost === null || Number.isFinite(event.cost) && event.cost >= 0)) throw new Error('Record event type, description and supplied duration/cost, or null for unknown.');
  if (!input.commonInputs?.root) throw new Error('Record the shared source directory and files for a matched comparison.');
  const commonRoot = await realpath(input.commonInputs.root);
  const commonFiles = [];
  if (!input.commonInputs.files?.length) throw new Error('Record the shared source files for a matched comparison.');
  for (const file of [...new Set(input.commonInputs.files)].sort()) commonFiles.push({ path: file, sha256: digest(await readFile(await profileFile(commonRoot, file))) });
  const { selectedDirectionId, ...commonRequest } = brief.request;
  const commonInputHash = digest(json({ request: commonRequest, files: commonFiles }));
  const target = path.resolve(outputRoot, input.experimentId, input.variant, `r${String(input.revision).padStart(3, '0')}`);
  const sourcePackage = input.packageDir ? await realpath(input.packageDir) : null;
  if (input.variant === 'tool' && !sourcePackage) throw new Error('Preserve the tool package directory with the result.');
  for (const source of [root, sourceBrief, commonRoot, ...(sourcePackage ? [sourcePackage] : [])]) {
    const a = path.relative(source, target), b = path.relative(target, source);
    if (!a || !a.startsWith('..') && !path.isAbsolute(a) || !b.startsWith('..') && !path.isAbsolute(b)) throw new Error('Review archive must be separate from all source directories.');
  }
  let ancestor = target;
  for (;;) {
    try { if ((await realpath(ancestor)).toLowerCase() !== ancestor.toLowerCase()) throw new Error('Review archive cannot redirect through a symbolic link.'); break; }
    catch (error) { if (error.code !== 'ENOENT') throw error; ancestor = path.dirname(ancestor); }
  }
  try { await lstat(target); throw new Error('Review revision already exists; first outputs and feedback are immutable.'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  let previous = null;
  if (input.revision > 0) {
    previous = JSON.parse(await readFile(path.join(path.dirname(target), `r${String(input.revision - 1).padStart(3, '0')}`, 'review.json'), 'utf8'));
    if (previous.commonInputHash !== commonInputHash || json(previous.run) !== json(input.run)) throw new Error('Changed shared inputs/run settings require a new experiment.');
    if (previous.metrics.currency !== (input.currency ?? null)) throw new Error('Keep the same currency across revisions; do not sum incomparable costs.');
    if (events.some((event) => previous.eventIds.includes(event.id))) throw new Error('Record only new prompts/edits/preparation events per revision.');
  }
  for (const event of uniqueImports.values()) {
    const existing = previous?.events.find((item) => item.id === event.id) ?? events.find((item) => item.id === event.id);
    if (existing) {
      if (json(existing) !== json(event)) throw new Error('Conflicting imported run event.');
    } else events.push(event);
  }
  const phases = ['ingestion', 'analysis', 'asset-preparation', 'prompt', 'manual-edit', 'review'];
  const cumulative = [...(previous?.events ?? []), ...events];
  const metrics = { suppliedMinutes: cumulative.reduce((sum, event) => sum + (event.minutes ?? 0), 0),
    suppliedCost: cumulative.reduce((sum, event) => sum + (event.cost ?? 0), 0),
    complete: phases.every((type) => cumulative.some((event) => event.type === type)) && cumulative.every((event) => event.minutes !== null && event.cost !== null),
    missingPhases: phases.filter((type) => !cumulative.some((event) => event.type === type)), currency: input.currency ?? null };
  const report = { schemaVersion: 'result-review/v1', experimentId: input.experimentId, variant: input.variant, revision: input.revision,
    briefHash: digest(json(brief)), briefInputHash: brief.inputHash, commonInputHash, kind: brief.kind, run: input.run,
    packageFiles: sourcePackage ? await fileDigests(sourcePackage) : null,
    recordedAt: new Date().toISOString(), status: checks.some((check) => check.status === 'fail') ? 'unmet-requirements' : 'needs-human-review',
    checks, corrections, metrics, events: cumulative, eventIds: cumulative.map((event) => event.id),
    importedRuns: [...new Map(importedRuns.map(({ id, sha256 }) => [id, { id, sha256 }])).values()],
    conclusion: 'insufficient-evidence', publication: 'human-acceptance-required',
    iterationBudgetExceeded: cumulative.filter((event) => event.type === 'prompt').length > input.run.iterationBudget,
    artifacts: input.artifacts.map((artifact) => ({ ...artifact, path: `artifacts/${artifact.path}`, sha256: archive.get(artifact.path).sha256,
      ...(technical.has(artifact.id) ? { technical: technical.get(artifact.id) } : {}) })),
    firstOutput: input.revision === 0 ? '.' : '../r000', modelSuggestions: [] };
  await createDirectoryAtomically(target, async (staged) => {
    if (importedRuns.length) {
      await mkdir(path.join(staged, 'runs'));
      for (const run of importedRuns) await writeFile(path.join(staged, 'runs', `${run.id}.json`), run.content);
    }
    await mkdir(path.join(staged, 'artifacts'));
    for (const [relative, file] of archive) {
      const destination = path.join(staged, 'artifacts', relative); await mkdir(path.dirname(destination), { recursive: true }); await copyFile(file.absolute, destination);
    }
    for (const [source, folder] of [[sourceBrief, 'brief'], ...(sourcePackage ? [[sourcePackage, 'package']] : [])]) {
      const files = Object.keys(await fileDigests(source));
      if (source === sourcePackage) {
        try { await lstat(path.join(source, 'source/package-context.json')); files.push('source/package-context.json'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
      }
      for (const relative of files) {
        const destination = path.join(staged, folder, relative); await mkdir(path.dirname(destination), { recursive: true });
        await copyFile(await profileFile(source, relative), destination);
      }
    }
    await writeFile(path.join(staged, 'input.json'), json(input));
    await writeFile(path.join(staged, 'review.json'), json(report));
    await writeFile(path.join(staged, 'REVIEW.md'), resultMarkdown(report));
  });
  return { outputDir: target, report };
}

export function resultMarkdown(report, { lang = 'es' } = {}) {
  if (!['es', 'en'].includes(lang)) throw new Error('Result report language must be es or en.');
  const es = lang === 'es', labels = es ? { pass: 'Pasa', fail: 'Falla', 'manual-review': 'Pendiente' } : { pass: 'Pass', fail: 'Fail', 'manual-review': 'Pending' };
  const translated = (check) => {
    if (!es) return check.instruction;
    if (check.id.includes('-contrast-')) return 'Revisar el contraste medido del texto; las fotos y fondos compuestos requieren revisión visual.';
    if (check.id.includes('-copy-')) return 'Usar el texto aprobado exacto y mantenerlo visible.';
    if (check.id.includes('-overlap-')) return 'Separar las áreas de imagen, texto y acción de acuerdo con la dirección seleccionada.';
    if (check.id.includes('-asset-')) return 'Usar el archivo aprobado exacto; verificar los bytes si la fuente es remota o integrada.';
    if (check.id.includes('-crop-')) return 'Revisar encuadre, sujeto, distorsión y resolución según el ajuste aprobado.';
    if (check.id.includes('-alt-')) return 'Conservar la alternativa contextual de imagen aprobada.';
    if (check.id.includes('-action')) return 'Mantener visible el enlace semántico con el texto y destino aprobados; revisar si otra capa lo cubre.';
    if (check.id.includes('-sticker-')) return 'Mantener texto e imágenes fuera del área reservada para el sticker nativo.';
    if (check.id.includes('-dimensions')) return 'Usar las dimensiones aprobadas para el arte exportado.';
    if (check.id.includes('-overflow')) return 'Comprobar que no haya desbordamiento horizontal.';
    if (check.id.includes('-clipping-') || check.id.includes('-geometry-')) return 'Revisar recortes, máscaras y capas en la captura. La geometría sola no demuestra visibilidad.';
    if (check.id.startsWith('viewport-')) return 'Capturar y revisar este tamaño de pantalla requerido.';
    if (check.id === 'observability') return 'Una captura o el HTML solo no permiten confirmar estilos calculados, bytes, semántica ni comportamiento. Aportar observaciones del diseño renderizado.';
    if (check.id.startsWith('manual-')) return 'Completar la comprobación humana correspondiente en ACCESSIBILITY.md y en el diseño renderizado.';
    return 'Revisar composición, encuadre, recortes, acción y accesibilidad antes de publicar.';
  };
  return `# ${es ? 'Revisión del resultado' : 'Result review'}\n\n${report.experimentId} / ${report.variant} / ${report.revision}\n\n` +
    `${es ? 'La aceptación humana sigue pendiente. No se calculó un puntaje estético ni se atribuyó una mejora a la herramienta.' : 'Human acceptance remains pending. No aesthetic score or utility claim was calculated.'}\n\n` +
    `## ${es ? 'Comprobaciones y referencias' : 'Checks and references'}\n\n` +
    report.checks.map((check) => `- **${check.id}: ${labels[check.status]}**. ${translated(check)} ${check.referenceIds.join(', ')}${check.observation ? ` — ${JSON.stringify(check.observation)}` : ''}`).join('\n') +
    `\n\n## ${es ? 'Correcciones para revisar' : 'Corrections to review'}\n\n` +
    report.corrections.map((item) => `- ${item.id ?? item.sourceArtifactId}: ${item.origin}; ${es ? 'causa' : 'cause'} ${item.cause}; ${item.referenceIds.join(', ')}. ${item.note ?? (es ? 'Revisar antes de cambiar el brief o las decisiones. Causa todavía no identificada.' : item.action)}`).join('\n') +
    `\n\n## ${es ? 'Esfuerzo registrado' : 'Recorded effort'}\n\n${report.metrics.suppliedMinutes} min; ${report.metrics.suppliedCost} ${report.metrics.currency ?? (es ? 'moneda sin declarar' : 'currency undeclared')}. ${report.metrics.complete ? es ? 'Registro de etapas completo.' : 'Phase record complete.' : es ? 'Registro incompleto: no inferir el esfuerzo total.' : 'Incomplete: do not infer total effort.'}\n`;
}

export function compareReviews(manual, tool) {
  const matched = manual.commonInputHash === tool.commonInputHash && manual.kind === tool.kind &&
    json(manual.run) === json(tool.run) && manual.variant === 'manual' && tool.variant === 'tool';
  const ready = matched && !manual.iterationBudgetExceeded && !tool.iterationBudgetExceeded && manual.metrics.complete && tool.metrics.complete && manual.run.priorKnowledge !== 'unknown' &&
    manual.metrics.currency && manual.metrics.currency === tool.metrics.currency;
  return { matched, completeEffort: !!ready, conclusion: 'insufficient-evidence',
    ...(ready ? { toolMinusManualMinutes: tool.metrics.suppliedMinutes - manual.metrics.suppliedMinutes,
      toolMinusManualCost: tool.metrics.suppliedCost - manual.metrics.suppliedCost } : {}),
    next: 'Human review must compare accepted outputs and all correction work before concluding helps, marginal improvement or worsens.' };
}
