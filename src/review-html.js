import { escapeHtml as e } from './local.js';
import { reviewClient } from './review-client.js';
import { createHash } from 'node:crypto';
import { REPORT_COPY } from './report-copy.js';
import { ANALYSIS_TOPICS } from './providers/openai.js';

export function reviewHtml(snapshot, language) {
  const copy = language === 'es' ? { heading: 'Revisar y exportar decisiones', note: 'Aceptar una propuesta no verifica una regla de marca. Las reglas confirmadas se conservan al importar.',
    name: 'Nombre de quien revisa', action: 'Decisión', pending: 'Pendiente', accept: 'Aceptar como propuesta', reject: 'Rechazar propuesta',
    noteLabel: 'Nota de revisión', changed: 'La evidencia cambió: requiere nueva revisión.', unchanged: 'Evidencia actual',
    download: 'Descargar decisiones JSON', load: 'Cargar una revisión JSON para comparar', help: 'El navegador guarda la descarga en la carpeta que elijas. Después ejecutá:',
    noJs: 'Sin JavaScript el informe sigue siendo legible; habilitalo para exportar decisiones.', ready: 'No se guardan cambios al abrir este archivo.' }
    : { heading: 'Review and export decisions', note: 'Accepting a proposal does not verify a brand fact. Confirmed rules survive import.', name: 'Reviewer name', action: 'Decision', pending: 'Pending', accept: 'Accept as proposal', reject: 'Reject proposal', noteLabel: 'Review note', changed: 'Evidence changed: renew review.', unchanged: 'Current evidence', download: 'Download decision JSON', load: 'Load a review JSON for comparison', help: 'Your browser saves the download in the folder you choose. Then run:', noJs: 'The report remains readable without JavaScript; enable it to export decisions.', ready: 'Opening this file does not save changes.' };
  const rows = snapshot.items.map((item) => {
    const action = item.stale ? 'pending' : item.existing?.action ?? 'pending';
    const topic = REPORT_COPY[language].topics[ANALYSIS_TOPICS.indexOf(item.topic)] ?? item.topic;
    return `<fieldset><legend>${e(topic)}</legend><p>${e(item.value ?? copy.pending)}</p><p>${item.stale ? copy.changed : copy.unchanged} · ${e(item.id)}</p><p>${item.evidenceIds.map((id) => `<a href="#evidence-${e(id)}">${e(id)}</a>`).join(' · ')}</p><label for="review-${e(item.id)}-action">${copy.action}</label><select id="review-${e(item.id)}-action">${[['pending', copy.pending], ['accept-proposal', copy.accept], ['reject', copy.reject]].map(([value, label]) => `<option value="${value}"${value === action ? ' selected' : ''}>${label}</option>`).join('')}</select><label for="review-${e(item.id)}-note">${copy.noteLabel}</label><textarea id="review-${e(item.id)}-note" aria-describedby="review-${e(item.id)}-error">${e(item.existing?.note ?? '')}</textarea><p id="review-${e(item.id)}-error"></p></fieldset>`;
  }).join('');
  const script = `(${reviewClient.toString()})();`;
  const scriptHash = createHash('sha256').update(script).digest('base64');
  const data = JSON.stringify({ ...snapshot, language }).replaceAll('<', '\\u003c');
  const commands = [`pnpm brand:decisions data/${e(snapshot.username)} --import &lt;downloaded-file.json&gt;`, `pnpm brand:compile data/${e(snapshot.username)}`, `pnpm brand:report data/${e(snapshot.username)}`].join('\n');
  return { scriptHash, html: `<section class="wrap section review" aria-labelledby="review-title"><h2 id="review-title">${copy.heading}</h2><p>${copy.note}</p><noscript>${copy.noJs}</noscript><form id="review-form" hidden><label for="reviewer">${copy.name}</label><input id="reviewer" required autocomplete="name" aria-describedby="review-status"><label for="review-file">${copy.load}</label><input id="review-file" type="file" accept="application/json,.json" aria-describedby="review-status">${rows}<button type="submit">${copy.download}</button></form><p id="review-status" role="status" aria-live="polite">${copy.ready}</p><p>${copy.help}</p><pre><code>${commands}</code></pre></section><script id="review-data" type="application/json">${data}</script><script>${script}</script>` };
}
