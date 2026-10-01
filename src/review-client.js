// Embedded in standalone reports. No network, browser storage or automatic writes.
export function reviewClient() {
  const data = JSON.parse(document.getElementById('review-data').textContent);
  const form = document.getElementById('review-form'), status = document.getElementById('review-status');
  const reviewer = document.getElementById('reviewer'), file = document.getElementById('review-file');
  const dirty = new Set();
  const field = (id, suffix) => document.getElementById(`review-${id}-${suffix}`);
  const message = (text, error = false) => { status.textContent = text; status.setAttribute('role', error ? 'alert' : 'status'); };
  const text = data.language === 'es' ? {
    changed: 'Cambios pendientes de exportar: ', invalid: 'Revisá el nombre y las notas de las decisiones.',
    note: 'Explicá por qué aceptás o rechazás esta propuesta.', empty: 'Cambiá al menos una decisión antes de exportar.',
    saved: 'Se solicitó la descarga JSON. Verificá el archivo en la carpeta elegida por tu navegador e importalo con el comando indicado. El perfil todavía no cambió.',
    badFile: 'El JSON no corresponde a este perfil o contiene decisiones inválidas.',
    loaded: 'Decisiones cargadas para revisar. Las que tienen evidencia distinta volvieron a pendiente; revisalas antes de exportar.',
  } : { changed: 'Changes pending export: ', invalid: 'Review the reviewer name and decision notes.',
    note: 'Explain why you accept or reject this proposal.', empty: 'Change at least one decision before export.',
    saved: 'JSON download requested. Check the file in your browser’s chosen folder and import it using the command shown. Profile files have not changed.',
    badFile: 'JSON belongs to another profile or contains invalid decisions.', loaded: 'Decisions loaded for review. Changed evidence returned to pending; review it before export.' };
  form.hidden = false;
  for (const item of data.items) {
    for (const suffix of ['action', 'note']) field(item.id, suffix).addEventListener('input', () => {
      dirty.add(item.id); field(item.id, 'note').removeAttribute('aria-invalid'); field(item.id, 'error').textContent = '';
      message(text.changed + dirty.size);
    });
  }
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!dirty.size) return message(text.empty);
    if (!reviewer.value.trim()) { reviewer.setAttribute('aria-invalid', 'true'); reviewer.focus(); return message(text.invalid, true); }
    reviewer.removeAttribute('aria-invalid');
    const decisions = [];
    for (const item of data.items.filter((item) => dirty.has(item.id))) {
      const action = field(item.id, 'action').value, note = field(item.id, 'note').value.trim();
      if (action !== 'pending' && !note) {
        field(item.id, 'note').setAttribute('aria-invalid', 'true'); field(item.id, 'error').textContent = text.note;
        field(item.id, 'note').focus(); return message(text.invalid, true);
      }
      decisions.push({ inferenceId: item.id, fingerprint: item.fingerprint, baseRevision: item.baseRevision,
        action, reviewer: reviewer.value.trim(), reviewedAt: new Date().toISOString(), ...(note ? { note } : {}) });
    }
    const url = URL.createObjectURL(new Blob([JSON.stringify({ schemaVersion: 'brand-review/v1', username: data.username, decisions }, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = `${data.username}-brand-review.json`;
    document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); message(text.saved);
  });
  file.addEventListener('change', async () => {
    try {
      if (!file.files[0] || file.files[0].size > 1000000) throw new Error();
      const incoming = JSON.parse(await file.files[0].text());
      if (incoming.schemaVersion !== 'brand-review/v1' || incoming.username !== data.username || !Array.isArray(incoming.decisions)) throw new Error();
      const seen = new Set();
      for (const row of incoming.decisions) {
        if (!data.items.some((item) => item.id === row.inferenceId) || seen.has(row.inferenceId) ||
            !['accept-proposal', 'reject', 'pending'].includes(row.action) || !/^[a-f0-9]{64}$/.test(row.fingerprint) ||
            row.note !== undefined && typeof row.note !== 'string') throw new Error();
        seen.add(row.inferenceId);
      }
      for (const row of incoming.decisions) {
        const item = data.items.find((item) => item.id === row.inferenceId);
        field(item.id, 'action').value = item.fingerprint === row.fingerprint ? row.action : 'pending';
        field(item.id, 'note').value = row.note ?? ''; dirty.add(item.id);
      }
      file.removeAttribute('aria-invalid'); message(text.loaded);
    } catch { file.setAttribute('aria-invalid', 'true'); message(text.badFile, true); }
  });
}
