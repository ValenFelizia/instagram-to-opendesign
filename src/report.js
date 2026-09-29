import { randomUUID } from 'node:crypto';
import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { prepareAnalysis, validateAnalysis } from './analyze.js';
import { colorInputFingerprint, validateColorCandidates } from './colors.js';

const TOPICS = [
  ['color.palette', 'Paleta percibida'], ['color.roles', 'Uso del color'],
  ['typography.style', 'Tipografía'], ['imagery.direction', 'Fotografía'],
  ['material.texture', 'Materialidad'], ['composition.patterns', 'Composición'],
  ['voice.tone', 'Tono de voz'], ['copy.cta', 'Llamados a la acción'],
  ['brand.personality', 'Personalidad'], ['ui.guidance', 'Orientación para UI'],
];
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const id = (value) => `evidence-${value}`;
const e = escapeHtml;
const statusLabel = { inferred: 'Inferencia', 'needs-review': 'Revisar', verified: 'Verificado' };
const confidenceLabel = { high: 'alta', medium: 'media', low: 'baja' };

function safeProfileUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && ['instagram.com', 'www.instagram.com'].includes(url.hostname)
      ? url.href : null;
  } catch { return null; }
}

async function thumbnail(file) {
  const buffer = await sharp(file).rotate().resize(420, 420, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 72, mozjpeg: true }).toBuffer();
  return `data:image/jpeg;base64,${buffer.toString('base64')}`;
}

async function loadColors(prepared, analysis) {
  let colors;
  try { colors = JSON.parse(await readFile(path.join(prepared.root, 'color-proposals.json'), 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  const graphics = prepared.images.filter((image) => image.review.classification === 'brand-graphic').slice(0, 4);
  if (colors.schemaVersion !== 'color-proposals/v1' ||
      colors.inputHash !== await colorInputFingerprint(analysis, graphics)) return null;
  validateColorCandidates(colors.candidates, graphics);
  return colors.candidates;
}

function evidenceLinks(ids) {
  if (!ids.length) return '<span class="no-source">Sin fuente suficiente</span>';
  return ids.map((sourceId) => `<a class="source-link" href="#${e(id(sourceId))}">${e(sourceId)}</a>`).join('');
}

function inferenceCard(item, label) {
  const pending = item.status === 'needs-review';
  return `<article class="inference ${pending ? 'pending' : ''}">
    <div class="inference-head"><h3>${e(label)}</h3><span class="status ${pending ? 'status-pending' : ''}">${e(statusLabel[item.status])}</span></div>
    <p class="inference-value">${item.value ? e(item.value) : 'Todavía no hay una regla defendible.'}</p>
    <p class="rationale">${e(item.rationale)}</p>
    <div class="inference-foot"><span>${item.confidence ? `Confianza ${e(confidenceLabel[item.confidence])}` : 'Confianza pendiente'}</span><div class="source-links" aria-label="Fuentes">${evidenceLinks(item.evidenceIds)}</div></div>
  </article>`;
}

function colorCard(candidate, label) {
  if (!candidate?.hex) return `<div class="color-card empty"><span>${e(label)}</span><strong>Sin propuesta</strong><small>Faltan gráficos propios revisados.</small></div>`;
  return `<div class="color-card"><div class="swatch" style="background-color:${candidate.hex}"></div><div class="color-info"><span>${e(label)} · aproximado</span><strong>${e(candidate.hex)}</strong><p>${e(candidate.rationale)}</p><div class="source-links">${evidenceLinks(candidate.evidenceIds)}</div></div></div>`;
}

function render({ prepared, analysis, colors, thumbs }) {
  const profile = prepared.source.profile;
  const name = analysis.subject.displayName;
  const username = profile.username;
  const profileUrl = safeProfileUrl(analysis.subject.profileUrl);
  const inferred = analysis.inferences.filter((item) => item.status === 'inferred').length;
  const pending = analysis.inferences.length - inferred;
  const byTopic = new Map(analysis.inferences.map((item) => [item.topic, item]));
  const firstPhotos = prepared.images.filter((image) => image.imageId !== 'profile/avatar').slice(0, 3);
  const heroPhotos = firstPhotos.map((image, index) => `<img src="${thumbs.get(image.evidenceId)}" alt="Muestra ${index + 1} de publicaciones propias revisadas: ${e(image.review.notes || image.imageId)}">`).join('');
  const cards = TOPICS.map(([topic, label]) => inferenceCard(byTopic.get(topic), label)).join('');
  const sources = analysis.evidence.map((item) => {
    const image = thumbs.get(item.id);
    return `<li id="${e(id(item.id))}" class="evidence-row ${image ? 'with-image' : ''}">
      ${image ? `<img src="${image}" alt="${e(item.summary)}">` : '<span class="source-mark" aria-hidden="true">↗</span>'}
      <div><span class="source-kind">${e({ image: 'Imagen revisada', text: 'Texto propio', metadata: 'Perfil', manual: 'Nota manual' }[item.kind])}</span><strong>${e(item.id)}</strong><p>${e(item.summary)}</p></div>
    </li>`;
  }).join('');
  const date = new Intl.DateTimeFormat('es-AR', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(analysis.generatedAt));
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<title>${e(name)} · lectura de marca</title><style>
:root{--ink:#183039;--muted:#52666a;--line:#ced8d8;--paper:#f7faf8;--white:#fff;--mint:#d9eee8;--coral:#ee8068;--peach:#ffe8df;--focus:#a31e63}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--paper);color:var(--ink);font-family:'Segoe UI',Arial,sans-serif;line-height:1.5}a{color:inherit}a:focus-visible{outline:3px solid var(--focus);outline-offset:3px;border-radius:2px}.wrap{max-width:1250px;margin:auto;padding:0 32px}.topbar{border-bottom:1px solid var(--line);background:var(--white)}.topbar-inner{display:flex;align-items:center;justify-content:space-between;gap:20px;min-height:64px}.wordmark{font-size:13px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}.topbar a{font-size:13px;text-underline-offset:4px}.cover{background:var(--ink);color:#fff;overflow:hidden}.cover-grid{display:grid;grid-template-columns:1.12fr .88fr;min-height:490px}.cover-copy{padding:76px 60px 64px 0;display:flex;flex-direction:column;justify-content:space-between}.eyebrow,.section-kicker,.small-label{font-size:12px;font-weight:800;letter-spacing:.15em;text-transform:uppercase}.eyebrow{color:#c3e5db}.cover h1{font-size:clamp(48px,6vw,90px);line-height:1.01;letter-spacing:-.07em;margin:18px 0;max-width:650px;overflow-wrap:anywhere}.cover-subtitle{font-size:clamp(20px,2.1vw,28px);line-height:1.25;max-width:540px;margin:0;color:#e8f3ef}.cover-meta{display:flex;flex-wrap:wrap;gap:10px;margin-top:38px}.cover-meta span{padding:8px 12px;border:1px solid #83a49e;border-radius:99px;font-size:13px}.cover-art{display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:6px;padding:26px 0 26px 26px;min-height:400px}.cover-art img{width:100%;height:100%;object-fit:cover;min-width:0;min-height:0}.cover-art img:first-child{grid-row:1/3}.cover-art img:nth-child(2){object-position:center 35%}.cover-art img:nth-child(3){object-position:center 60%}.intro{display:grid;grid-template-columns:1.1fr .9fr;gap:70px;padding-top:78px;padding-bottom:78px}.intro h2,.section h2{font-size:clamp(32px,3.4vw,48px);letter-spacing:-.055em;line-height:1.1;margin:12px 0 22px}.intro p{font-size:19px;max-width:680px;white-space:pre-line}.intro .note{font-size:15px;color:var(--muted);margin-top:25px}.stats{display:grid;grid-template-columns:1fr 1fr;gap:12px;align-self:start}.stat{background:var(--white);border:1px solid var(--line);padding:22px 24px;min-height:140px}.stat strong{font-size:42px;letter-spacing:-.07em;line-height:1;display:block}.stat span{display:block;margin-top:12px;font-size:14px;color:var(--muted)}.section{padding-top:72px;padding-bottom:72px;border-top:1px solid var(--line)}.section-heading{display:flex;justify-content:space-between;align-items:end;gap:40px;margin-bottom:32px}.section-heading p{max-width:440px;color:var(--muted);font-size:15px}.section-kicker{color:#4b756c}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.inference{background:var(--white);border:1px solid var(--line);padding:27px;min-width:0;display:flex;flex-direction:column;min-height:275px}.inference.pending{background:#fffaf7;border-color:#eed7ca}.inference-head{display:flex;align-items:start;justify-content:space-between;gap:14px}.inference h3{font-size:17px;margin:0;letter-spacing:-.02em}.status{font-size:11px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;background:var(--mint);padding:6px 9px;white-space:nowrap}.status-pending{background:var(--peach)}.inference-value{font-size:20px;line-height:1.35;letter-spacing:-.025em;font-weight:600;margin:22px 0 10px}.rationale{font-size:14px;color:var(--muted);margin:0 0 20px}.inference-foot{margin-top:auto;border-top:1px solid var(--line);padding-top:14px;display:flex;justify-content:space-between;gap:12px;align-items:start;font-size:12px;color:var(--muted)}.source-links{display:flex;flex-wrap:wrap;gap:5px;justify-content:flex-end}.source-link{font-family:Consolas,monospace;font-size:10px;background:#eff3f1;padding:4px 6px;text-decoration:none;color:var(--ink);overflow-wrap:anywhere}.source-link:hover{text-decoration:underline}.no-source{font-size:12px}.color-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.color-card{border:1px solid var(--line);background:var(--white);display:grid;grid-template-columns:36% 1fr;min-height:220px}.swatch{min-height:220px}.color-info{padding:24px;min-width:0}.color-info span,.color-card.empty span{display:block;font-size:12px;text-transform:uppercase;letter-spacing:.12em;font-weight:700;color:var(--muted)}.color-info strong,.color-card.empty strong{font-size:25px;font-family:Consolas,monospace;display:block;margin:10px 0}.color-info p,.color-card.empty small{font-size:13px;color:var(--muted)}.color-info .source-links{justify-content:start}.color-card.empty{display:block;padding:24px}.evidence-list{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.evidence-row{display:flex;gap:14px;background:var(--white);border:1px solid var(--line);padding:12px;min-width:0;scroll-margin-top:18px}.evidence-row:target{outline:3px solid var(--coral)}.evidence-row img{width:94px;height:94px;object-fit:cover;flex:none}.source-mark{display:grid;place-items:center;width:94px;height:94px;background:#edf4f0;flex:none;font-size:30px;color:#52756c}.evidence-row div{min-width:0}.evidence-row strong{font-family:Consolas,monospace;font-size:11px;display:block;overflow-wrap:anywhere}.source-kind{font-size:11px;text-transform:uppercase;letter-spacing:.12em;color:var(--muted);font-weight:700;display:block;margin-bottom:5px}.evidence-row p{font-size:12px;color:var(--muted);margin:6px 0 0;overflow-wrap:anywhere}.review-box{background:var(--mint);padding:32px;display:grid;grid-template-columns:1fr 1fr;gap:30px}.review-box h3{font-size:24px;letter-spacing:-.04em;margin:0}.review-box ol{margin:0;padding-left:22px}.review-box li{margin-bottom:8px}.footer{padding:35px 0 55px;font-size:13px;color:var(--muted)}.footer p{max-width:700px}@media(max-width:850px){.cover-grid,.intro{grid-template-columns:1fr}.cover-copy{padding:50px 0 25px}.cover-art{padding:0 0 30px;min-height:300px}.intro{gap:25px;padding-top:55px;padding-bottom:55px}.section-heading{display:block}.grid,.color-grid,.evidence-list{grid-template-columns:1fr}}@media(max-width:600px){.wrap{padding:0 18px}.cover h1{font-size:49px}.cover-art{min-height:230px}.intro p{font-size:17px}.stats{gap:8px}.stat{padding:16px;min-height:110px}.stat strong{font-size:32px}.section{padding-top:55px;padding-bottom:55px}.inference{padding:21px;min-height:0}.inference-foot{display:block}.source-links{justify-content:start;margin-top:8px}.color-card{grid-template-columns:30% 1fr}.swatch{min-height:200px}.color-info{padding:18px}.evidence-row img,.source-mark{width:65px;height:65px}.review-box{grid-template-columns:1fr;padding:23px}}@media print{html{scroll-behavior:auto}body{background:white}.topbar{display:none}.cover{background:#fff;color:var(--ink);border-bottom:2px solid var(--ink)}.cover-subtitle,.eyebrow{color:var(--ink)}.cover-meta span{border-color:var(--line)}.cover-grid{min-height:0}.cover-copy{padding:25px 20px 25px 0}.cover-art{min-height:240px}.section,.intro{padding-top:28px;padding-bottom:28px}.inference,.evidence-row,.color-card,.stat{break-inside:avoid}.source-link{text-decoration:underline}}
</style></head><body>
<header class="topbar"><div class="wrap topbar-inner"><span class="wordmark">Lectura de marca / Instagram</span><a href="#revision">Ir a la revisión ↓</a></div></header>
<main><section class="cover"><div class="wrap cover-grid"><div class="cover-copy"><div><span class="eyebrow">Borrador basado en evidencia · ${e(date)}</span><h1>${e(name)}</h1><p class="cover-subtitle">Lo que el perfil muestra. Lo que podemos inferir. Lo que todavía necesita tu mirada.</p></div><div class="cover-meta"><span>@${e(username)}</span><span>${inferred} inferencias</span><span>${pending} ${pending === 1 ? 'punto' : 'puntos'} a revisar</span></div></div><div class="cover-art" aria-label="Tres muestras del perfil revisadas">${heroPhotos}</div></div></section>
<section class="wrap intro" aria-labelledby="observado"><div><span class="section-kicker">01 / Punto de partida</span><h2 id="observado">Lo observado</h2><p>${e(profile.biography || 'El perfil no tiene biografía disponible.')}</p><p class="note">La biografía y las imágenes son datos del perfil capturado. Las propuestas de identidad que siguen son interpretaciones, no instrucciones oficiales de la marca.</p>${profileUrl ? `<a href="${e(profileUrl)}" target="_blank" rel="noopener noreferrer">Ver perfil original ↗</a>` : ''}</div><div class="stats"><div class="stat"><strong>${prepared.images.length}</strong><span>imágenes propias revisadas y usadas</span></div><div class="stat"><strong>${prepared.captions.length}</strong><span>textos propios considerados</span></div><div class="stat"><strong>${prepared.excludedUnreviewed}</strong><span>imágenes sin revisar, fuera del análisis</span></div><div class="stat"><strong>${pending}</strong><span>temas que requieren decisión humana</span></div></div></section>
<section class="wrap section" aria-labelledby="interpretado"><div class="section-heading"><div><span class="section-kicker">02 / Lectura de identidad</span><h2 id="interpretado">Lo interpretado</h2></div><p>Cada tema muestra su estado, la razón y las fuentes concretas. “Inferencia” significa hipótesis sustentada; todavía no equivale a una regla aprobada.</p></div><div class="grid">${cards}</div></section>
<section class="wrap section" aria-labelledby="colores"><div class="section-heading"><div><span class="section-kicker">03 / Muestras aproximadas</span><h2 id="colores">Color candidato</h2></div><p>Los códigos se estiman desde gráficos propios revisados. Confirman una dirección para conversar, no especificaciones finales ni colores extraídos de productos.</p></div><div class="color-grid">${colorCard(colors?.primary, 'Principal')}${colorCard(colors?.secondary, 'Secundario')}</div></section>
<section class="wrap section" aria-labelledby="fuentes"><div class="section-heading"><div><span class="section-kicker">04 / Rastro de origen</span><h2 id="fuentes">Fuentes consultables</h2></div><p>Los enlaces de cada inferencia te traen aquí. Las miniaturas están integradas en este HTML para poder revisarlo sin conexión y sin abrir archivos aparte.</p></div><ul class="evidence-list">${sources}</ul></section>
<section id="revision" class="wrap section" aria-labelledby="revisar"><div class="review-box"><div><span class="section-kicker">05 / Decisión humana</span><h3 id="revisar">Qué revisar antes de diseñar</h3></div><ol><li>Confirmá qué inferencias representan a la marca hoy.</li><li>Corregí o descartá las reglas que las fuentes no sostienen.</li><li>Definí colores exactos, tipografía de interfaz y decisiones UI con la persona responsable de la marca.</li></ol></div></section></main>
<footer class="wrap footer"><p>Generado desde una captura pública de Instagram y una revisión local de evidencia. El análisis es un borrador; las publicaciones pueden haber cambiado desde el ${e(date)}. Este archivo contiene copias reducidas de imágenes del perfil y debe compartirse sólo con permiso de sus titulares.</p></footer></body></html>`;
}

async function replaceFile(file, content) {
  const temporary = `${file}.partial-${randomUUID()}`;
  const backup = `${file}.backup-${randomUUID()}`;
  await writeFile(temporary, content, { flag: 'wx' });
  let previous = false;
  try {
    try { await rename(file, backup); previous = true; }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    try { await rename(temporary, file); }
    catch (error) { if (previous) await rename(backup, file); throw error; }
    if (previous) await rm(backup);
  } finally { await rm(temporary, { force: true }); }
}

export async function buildBrandReport(profileDir, { outputPath } = {}) {
  const prepared = await prepareAnalysis(profileDir);
  const analysis = JSON.parse(await readFile(path.join(prepared.root, 'brand-analysis.json'), 'utf8'));
  await validateAnalysis(analysis, prepared);
  if (JSON.stringify(analysis.evidence) !== JSON.stringify(prepared.evidence) ||
      analysis.subject.profileUrl !== prepared.source.source.profileUrl) {
    throw new Error('Analysis evidence does not match the current profile. Reanalyze before generating a report.');
  }
  const colors = await loadColors(prepared, analysis);
  const thumbs = new Map(await Promise.all(prepared.images.map(async (image) =>
    [image.evidenceId, await thumbnail(image.absolutePath)])));
  const html = render({ prepared, analysis, colors, thumbs });
  const destination = path.resolve(outputPath || path.join(prepared.root, 'brand-report.html'));
  await replaceFile(destination, html);
  return { outputPath: destination, images: prepared.images.length,
    captions: prepared.captions.length, inferred: analysis.inferences.filter((item) => item.status === 'inferred').length };
}
