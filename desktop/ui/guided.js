(() => {
  const $ = id => document.getElementById(id);
  const api = window.guidedWork;
  const messages = {
    'invalid-request': 'La acción no está disponible. Cerrá y volvé a abrir la ventana.',
    'stale-authorization': 'El contexto cambió. Cerrá este pedido y revisá el alcance nuevo.',
    'consent-required': 'Confirmá el alcance antes de continuar.',
    'job-unavailable': 'El trabajo no está disponible. Actualizá el estado.',
    'profile-required': 'El proyecto necesita un perfil de Instagram antes de planificar.',
    'paid-retry-requires-new-plan': 'Hace falta un plan nuevo. El reintento no hereda la autorización anterior.',
    'dispatch-stopped': 'No se enviarán más solicitudes desde esta app. El proveedor puede seguir con lo ya enviado.',
    'manual-reconciliation-required': 'Revisá el intento en el proveedor antes de autorizar otro pedido.',
    'lookup-unavailable': 'No se pudo consultar el intento anterior.',
    'storage-unavailable': 'No se pudo leer o guardar. Tus proyectos existentes se conservan.',
    'request-unavailable': 'Volvé a abrir la ventana para continuar.',
    'writer-busy': 'El proyecto está en uso. Terminá el trabajo activo antes de continuar.',
    'task-missing': 'La tarea no está disponible.',
    'authority-stale': 'La revisión ya no coincide con las entradas actuales.',
    'execution-review-required': 'Revisá la ejecución con las entradas actuales antes de continuar.',
  };
  const statusLabel = {
    queued: 'Listo para comenzar',
    running: 'En curso',
    'review-required': 'Espera una revisión',
    completed: 'Completado',
    failed: 'Falló',
    interrupted: 'Interrumpido',
  };
  const phaseStatus = stage => {
    if (stage.mode === 'cache' && stage.status === 'completed') return 'Reutilizado';
    return ({
      completed: stage.mode === 'local' ? 'Listo · local' : 'Listo',
      running: 'En curso',
      failed: 'Falló',
      'not-reached': 'Sin iniciar',
      interrupted: 'Interrumpido',
    })[stage.status] || stage.status;
  };
  let projectId = null;
  let progress = null;
  let consent = null;
  let busy = false;
  let opener = null;

  function money(amount) {
    if (!Number.isFinite(amount) || amount < 0) return 'importe no disponible';
    if (amount === 0) return '0';
    const fixed = amount.toFixed(8).replace(/\.?0+$/, '');
    return fixed === '0' ? amount.toExponential(2) : fixed;
  }
  function announce(text) { $('guided-announcement').textContent = text; }
  function showError(code) {
    $('guided-error').hidden = false;
    $('guided-error').textContent = messages[code] || messages['storage-unavailable'];
  }
  function clearError() { $('guided-error').hidden = true; $('guided-error').textContent = ''; }

  function renderNext() {
    const job = progress?.job;
    if (!job) {
      return `<p>Todavía no hay un trabajo planificado para este proyecto.</p>
        <button type="button" id="guided-plan" class="primary">Planificar preparación</button>`;
    }
    if (job.stale) {
      return `<p>Los datos o la configuración cambiaron. El alcance anterior ya no autoriza un pedido.</p>
        <button type="button" id="guided-replan">Planificar de nuevo</button>`;
    }
    if (job.state === 'queued' && job.nextAction === 'authorize') {
      return `<p>Revisá el alcance antes de autorizar. Configurar una clave no autoriza gastos.</p>
        <button type="button" id="guided-review-scope" class="primary">Revisar pedido</button>`;
    }
    if (job.state === 'running') {
      return `<p>Podés cerrar la ventana. Reabrir no reintenta nada. Detener solo evita nuevas solicitudes desde esta app.</p>
        <button type="button" id="guided-stop">Detener lo que falta</button>`;
    }
    if (job.state === 'review-required') {
      return `<p>Hay material listo para revisar. La revisión no dispara un proveedor.</p>`;
    }
    if (job.state === 'interrupted') {
      const remote = progress.requests?.some(item => item.responseKnown && ['uncertain', 'intent', 'observed'].includes(item.state));
      return `<p>El último estado no confirma el resultado ni el cargo. Reabrir esta vista no reintenta nada.</p>
        ${remote ? '<button type="button" id="guided-reconcile">Consultar el mismo intento</button>' : '<p class="muted">Sin identificador remoto confirmado: revisá el proveedor antes de un plan nuevo.</p>'}
        <button type="button" id="guided-retry">Preparar plan nuevo</button>`;
    }
    if (job.state === 'failed') {
      return `<p>Se conservan resultados previos válidos. Un reintento paga un plan nuevo.</p>
        <button type="button" id="guided-retry">Preparar plan nuevo</button>`;
    }
    if (job.state === 'completed') {
      return `<p>Las etapas solicitadas están listas. La publicación y la revisión creativa son pasos aparte.</p>`;
    }
    return `<p>Estado: ${statusLabel[job.state] || 'Desconocido'}.</p>`;
  }

  function renderSpend() {
    const spend = progress?.spend;
    if (!spend || !spend.attemptCount) return '<p class="muted">No hay solicitudes registradas.</p>';
    const totals = Object.entries(spend.byCurrency).map(([currency, amount]) => `<div>${money(amount)} ${currency}</div>`).join('');
    return `<div class="totals">${totals || 'Importe no disponible'}</div>
      <p>${spend.unknownBilling ? `${spend.unknownBilling} intento/s sin importe devuelto. Suma parcial.` : 'Importes observados en este proyecto.'}</p>
      ${Object.keys(spend.byCurrency).length > 1 ? '<p>No se suman monedas distintas.</p>' : ''}
      <p class="muted">Tiempo de proveedor y esfuerzo humano se muestran por separado. Sin porcentaje ni tiempo restante estimado.</p>
      <details id="guided-attempts"><summary>Ver uso y cargos (${spend.attemptCount})</summary>
        ${spend.observations.map(row => `<div class="attempt">
          <h3>${row.provider || 'Proveedor'} · ${row.phase || 'etapa'}</h3>
          <p>${row.billing ? `Importe: ${money(row.billing.amount)} ${row.billing.currency}` : 'Importe no disponible'}</p>
          <p>${row.usage ? `Entrada: ${row.usage.input_tokens ?? 'no disponible'} · salida: ${row.usage.output_tokens ?? 'no disponible'}` : 'Uso no disponible'}</p>
          ${row.usage?.input_tokens_details?.cached_tokens != null ? `<p>Tokens en caché: ${row.usage.input_tokens_details.cached_tokens} (incluidos en la entrada).</p>` : ''}
          ${row.usage?.output_tokens_details?.reasoning_tokens != null ? `<p>Tokens de razonamiento: ${row.usage.output_tokens_details.reasoning_tokens} (incluidos en la salida).</p>` : ''}
          <small>${row.wallMs == null ? 'Tiempo no disponible' : `${money(row.wallMs / 1000)} s de proveedor`} · ${row.humanMinutes == null ? 'esfuerzo humano no medido' : `${money(row.humanMinutes)} min humanos`}</small>
        </div>`).join('') || '<p>Sin intentos.</p>'}
      </details>`;
  }

  function render() {
    if (!projectId || !$('guided-panel')) return;
    const job = progress?.job;
    $('guided-status').textContent = job
      ? (job.stale ? 'Cambió el contexto' : (statusLabel[job.state] || job.state))
      : 'Sin trabajo planificado';
    $('guided-next').innerHTML = renderNext();
    $('guided-stages').innerHTML = (progress?.stages || []).map(stage =>
      `<li><span>${stage.label}${stage.status !== 'not-reached' && progress.available?.some(item => item.stage === stage.name) ? '' : ''}</span><span>${phaseStatus(stage)}</span></li>`
    ).join('') || '<li><span>Sin etapas</span><span>Sin iniciar</span></li>';
    const available = progress?.available || [];
    $('guided-available').innerHTML = available.length
      ? `<ul>${available.map(item => `<li>${item.stage} · ${item.files} archivo/s · ${item.state}</li>`).join('')}</ul>`
      : '<p class="muted">Todavía no hay inventario parcial disponible.</p>';
    $('guided-spend').innerHTML = renderSpend();
    $('guided-limits').textContent = progress?.cancellationSupported === false
      ? 'Esta app no cancela cargos remotos. Detener solo evita nuevas solicitudes locales.'
      : '';
  }

  async function refresh() {
    if (!api || !projectId) return null;
    const result = await api.status(projectId);
    if (!result.ok) { showError(result.code); return null; }
    progress = result.progress;
    clearError();
    render();
    return progress;
  }

  function openConsent() {
    const job = progress?.job;
    const preview = progress?.preview;
    if (!job || !preview) return;
    consent = { planHash: job.planHash, jobId: job.id };
    opener = document.activeElement;
    const paid = preview.stages.some(stage => stage.mode === 'possible-provider');
    $('consent-scope').innerHTML = `
      <p><strong>${paid ? 'Pedido con posibles solicitudes a proveedores' : 'Preparación local o reutilizada'}</strong></p>
      <p>Etapas: ${preview.stages.map(stage => `${stage.name} (${stage.mode})`).join(', ')}</p>
      <p>Límite de solicitudes pagas: ${preview.limits.maxPaidCalls}. Idioma del informe: ${preview.limits.language}.</p>
      <p><strong>${paid ? 'Importe final desconocido.' : 'Sin nuevas solicitudes a proveedores.'}</strong></p>`;
    $('authorize').checked = false;
    $('authorize').removeAttribute('aria-invalid');
    $('consent-error').hidden = true;
    $('consent-dialog').showModal();
    $('authorize').focus();
  }

  async function run(operation) {
    if (busy) return null;
    busy = true; clearError(); $('guided-panel')?.setAttribute('aria-busy', 'true');
    try {
      const result = await operation();
      if (!result?.ok) { showError(result?.code || 'storage-unavailable'); return null; }
      if (result.progress) { progress = result.progress; render(); }
      return result;
    } catch { showError('storage-unavailable'); return null; }
    finally { busy = false; $('guided-panel')?.removeAttribute('aria-busy'); }
  }

  async function planJob() {
    const taskId = crypto.randomUUID();
    return run(() => api.plan(projectId, taskId, 1, {
      includeReport: true, includePackage: false, includeExport: false, language: 'es',
      refresh: false, reanalyze: false, postLimit: 20,
    }));
  }

  $('guided-next')?.addEventListener('click', async event => {
    const id = event.target.closest('button')?.id;
    if (!id || !api || !projectId) return;
    if (id === 'guided-plan' || id === 'guided-replan') {
      const result = await planJob();
      if (result) { announce('Alcance listo para revisar.'); $('guided-status').focus(); }
      return;
    }
    if (id === 'guided-review-scope') { openConsent(); return; }
    if (id === 'guided-stop' && progress?.job) {
      const result = await run(() => api.stop(projectId, progress.job.id));
      if (result) announce('No se enviarán más solicitudes desde esta app.');
      return;
    }
    if (id === 'guided-retry' && progress?.job) {
      const result = await run(() => api.retry(projectId, progress.job.id, progress.job.planHash));
      if (result) announce('Plan nuevo listo. Requiere autorización propia.');
      return;
    }
    if (id === 'guided-reconcile' && progress?.job) {
      const request = progress.requests?.find(item => item.responseKnown);
      if (!request) { showError('manual-reconciliation-required'); return; }
      consent = { planHash: progress.job.planHash, jobId: progress.job.id, requestId: request.id, reconcile: true };
      opener = document.activeElement;
      $('consent-scope').innerHTML = `<p><strong>Consultar el intento anterior</strong></p>
        <p>No crea otra ejecución. Disponibilidad y costo de la consulta dependen del proveedor.</p>
        <p><strong>Importe final desconocido.</strong></p>`;
      $('authorize').checked = false;
      $('consent-error').hidden = true;
      $('consent-dialog').showModal();
      $('authorize').focus();
    }
  });

  $('consent-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    const check = $('authorize');
    const error = $('consent-error');
    if (!check.checked) {
      error.textContent = messages['consent-required'];
      error.hidden = false;
      check.setAttribute('aria-invalid', 'true');
      check.focus();
      return;
    }
    if (!consent || !progress?.job || progress.job.planHash !== consent.planHash || progress.job.stale) {
      error.textContent = messages['stale-authorization'];
      error.hidden = false;
      $('cancel-consent').focus();
      return;
    }
    if (consent.reconcile) {
      const result = await run(() => api.reconcile(projectId, consent.jobId, consent.requestId, consent.planHash));
      $('consent-dialog').close();
      consent = null;
      if (result) announce('Consulta del mismo intento registrada.');
      opener?.focus();
      return;
    }
    const authorized = await run(() => api.authorize(projectId, consent.jobId, consent.planHash, true));
    if (!authorized) {
      error.textContent = messages[authorized?.code] || messages['stale-authorization'];
      error.hidden = false;
      $('cancel-consent').focus();
      return;
    }
    const started = await run(() => api.run(projectId, consent.jobId, consent.planHash, authorized.authorization, false));
    $('consent-dialog').close();
    consent = null;
    if (started) {
      announce(started.job?.state === 'completed' ? 'Etapas solicitadas completadas.' : 'Trabajo en curso.');
      $('guided-status').focus();
    } else opener?.focus();
  });

  $('cancel-consent')?.addEventListener('click', () => {
    $('consent-dialog').close();
    consent = null;
    opener?.focus();
  });
  $('consent-dialog')?.addEventListener('cancel', event => {
    event.preventDefault();
    $('consent-dialog').close();
    consent = null;
    opener?.focus();
  });
  $('guided-refresh')?.addEventListener('click', async () => {
    const before = progress?.job?.state;
    await refresh();
    announce('Estado actualizado. Reabrir no reintenta nada.');
    if (before === 'running' && progress?.job?.state === 'running') {
      // Explicit refresh never authorizes or dispatches.
    }
  });

  window.guidedPanel = {
    async show(id) {
      projectId = id;
      $('guided-panel').hidden = false;
      await refresh();
      $('guided-status').focus();
    },
    hide() {
      projectId = null;
      progress = null;
      $('guided-panel').hidden = true;
    },
    refresh,
  };
})();
