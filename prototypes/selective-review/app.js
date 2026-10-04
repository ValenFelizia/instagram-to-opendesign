(() => {
  'use strict';
  const M = globalThis.SelectiveReview;
  const root = document.querySelector('#review-content'), dialog = document.querySelector('#copy-dialog');
  let state = M.create(), preview = false, copyRevision = null, returnFocus = null;
  const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  const label = action => ({ pending:'Pendiente', 'accept-proposal':'Aceptada para explorar', reject:'Descartada' }[action]);
  const phase = value => ({ exploration:'Exploración', 'selected-execution-demo':'Ejecución revisada · demo', 'publication-accepted-demo':'Publicación revisada · demo' }[value]);
  const actionButton = (text, action) => `<button type="button" data-action="${action}">${text}</button>`;
  const announce = text => { document.querySelector('#announcement').textContent = text; };
  const sources = () => `<details id="sources"><summary>Fuentes y datos técnicos</summary><dl><dt>Observación</dt><dd>La muestra ficticia presenta cerámica en pequeñas series. <code>E-PROFILE-DEMO</code></dd><dt>Inferencia</dt><dd>«${state.tone.original}» desde un caption ficticio. <code>${state.tone.id}</code></dd><dt>Valor funcional</dt><dd>system-ui, sans-serif: default de interfaz, no fuente identificada.</dd><dt>Propuesta creativa original</dt><dd>«${state.composition.original}» <code>${state.composition.id}</code></dd><dt>Reglas confirmadas en la ficción</dt>${state.rules.map(rule => `<dd>${rule.scope}: ${rule.value} <code>${rule.sourceId}</code></dd>`).join('')}<dt>Imagen</dt><dd><code>${state.asset.id}</code> · ${state.asset.owner === 'collaborator' ? 'Autor colaborador: no atribuir identidad al perfil.' : 'Autor ficticio del perfil.'}${state.asset.lowResolution ? ' Tamaño de escenario: 80 × 60 px; no es una medición de un archivo.' : ''}</dd></dl></details>`;
  const fixes = {
    facts:'Simular fuente de producto confirmada', copy:'Simular confirmación del texto', source:'Simular revisión de la fuente nueva',
    action:'Simular revisión de la acción', origin:'Simular verificación del original', permission:'Simular permiso del titular',
    fit:'Simular revisión del encuadre', alt:'Simular revisión de la descripción', resolution:'Aceptar tamaño para esta prueba',
    site:'Simular acceso autorizado al código', channel:'Conservar la regla del sitio', asset:'Seleccionar otro original ficticio'
  };
  function render(focusAction = null) {
    const openDetails = [...root.querySelectorAll('details[id][open]')].map(node => node.id);
    const issues = M.issues(state), publicationIssues = M.publicationIssues(state), current = M.executionCurrent(state);
    document.querySelector('#task').value = state.task;
    root.innerHTML = `<div class="layout"><div>
      <section><div class="row"><h2>Texto y reglas</h2>${actionButton('Corregir texto', 'edit-copy')}</div><p>«${escape(state.copy.text)}»</p><small>${state.copy.confirmed && state.copy.reviewedVersion === state.copy.sourceVersion ? 'Confirmado en la ficción' : 'Necesita revisión'} · versión ${state.copy.revision} · canal ${M.channel(state) === 'website' ? 'web' : 'redes'}</small>${sources()}</section>
      <section aria-labelledby="required-title"><h2 id="required-title" tabindex="-1">Para ejecutar</h2>${issues.filter(issue => issue.id !== 'direction').map(issue => `<div class="issue" data-issue="${issue.id}"><h3>${issue.title}</h3><p>${issue.consequence}</p><div class="buttons">${fixes[issue.id] ? actionButton(fixes[issue.id], issue.id) : ''}${issue.id === 'permission' ? actionButton('Dejar como referencia', 'reference') : ''}</div></div>`).join('')}
      <fieldset id="directions"><legend>Dirección para esta tarea</legend><label class="option"><input type="radio" name="direction" value="text-first" ${state.direction === 'text-first' ? 'checked' : ''}>Texto primero · regiones apiladas</label><label class="option"><input type="radio" name="direction" value="product-first" ${state.direction === 'product-first' ? 'checked' : ''}>Producto primero · texto en una franja lateral</label></fieldset><small>Seleccionar una propuesta no confirma la marca ni revisa su render.</small></section>
      <section><h2>Opcional para explorar</h2><form id="tone-form"><fieldset><legend>Voz: una lectura tranquila y cercana</legend>${['pending','accept-proposal','reject'].map(value => `<label class="option"><input type="radio" name="tone" value="${value}" ${state.tone.action === value ? 'checked' : ''}>${label(value)}</label>`).join('')}</fieldset><button type="submit">Guardar decisión</button></form><small>Se conserva como preferencia para explorar; no modifica las reglas confirmadas.</small><details><summary>Ver evidencia</summary><blockquote>«Una taza para acompañar tu pausa.»</blockquote><p>Caption ficticio. La inferencia original se conserva aunque la descartes.</p><code>${state.tone.id} · E-CAPTION-DEMO</code></details>
      <form id="proposal-form" class="small-form" novalidate><label for="proposal-text">Propuesta de composición</label><textarea id="proposal-text" maxlength="180" required aria-describedby="proposal-effect proposal-error">${escape(state.composition.text)}</textarea><p id="proposal-effect"><small>Editar deja esta propuesta pendiente y borra la selección de dirección/revisión de ejecución. Conserva el texto confirmado y las otras decisiones.</small></p><p id="proposal-error" class="error" role="alert" hidden></p><div class="buttons"><button type="submit">Guardar propuesta</button>${actionButton('Descartar propuesta', 'reject-composition')}${actionButton('Revisar después', 'defer-composition')}</div></form><small>Estado: ${label(state.composition.action)}.</small></section>
      <details id="history"><summary>Historial de cambios (${state.history.length})</summary><ol class="history">${state.history.map(item => `<li><strong>${escape(item.action)}</strong><details><summary>Antes y después</summary><pre>${escape(JSON.stringify({before:item.before,after:item.after}, null, 2))}</pre></details></li>`).join('') || '<li>Sin cambios.</li>'}</ol>${state.archive.length ? `<p>${state.archive.length} revisión/es anterior/es conservadas, sin vigencia.</p>` : ''}</details>
      <details id="source-tools"><summary>Probar un cambio de fuente</summary><p>El texto pierde vigencia y la dirección se deselecciona. La decisión de voz y las reglas de otros canales se conservan.</p>${actionButton('Simular fuente cambiada', 'source-changed')}</details>
      </div><aside class="summary" aria-labelledby="status-title"><h2 id="status-title">Estado</h2><span class="status">${phase(M.phase(state))}</span><p>${issues.length ? `${issues.length} revisión/es para ejecutar.` : 'La muestra no tiene bloqueos de ejecución.'}</p><ul class="pending">${issues.map(item => `<li>${item.title}</li>`).join('')}</ul><p id="stage-error" class="error" role="alert" hidden></p>
      <div class="phase-actions"><button class="primary" data-action="explore">Preparar exploración demo</button><button data-action="execute" aria-describedby="execution-hint">Revisar ejecución demo</button><small id="execution-hint">Requiere resolver los puntos de arriba. Esta acción no genera una pieza.</small><label class="option"><input id="render-reviewed" type="checkbox" ${state.renderReviewed ? 'checked' : ''} ${current ? '' : 'disabled aria-describedby="publication-hint"'}>Simular revisión del render y la plataforma</label><button data-action="publish" ${publicationIssues.length ? 'disabled aria-describedby="publication-hint"' : ''}>Registrar aceptación de publicación demo</button><small id="publication-hint">${publicationIssues.length ? publicationIssues.join(' ') : 'No publica ni envía archivos.'}</small></div>
      ${preview ? previewView() : ''}</aside></div>`;
    for (const id of openDetails) root.querySelector(`#${id}`)?.setAttribute('open','');
    if (focusAction) {
      const target = root.querySelector(`[data-action="${focusAction}"]`) || document.querySelector('#required-title');
      target?.focus();
    }
  }
  function previewView() {
    const context = M.context(state);
    return `<div class="preview"><h3>Contexto para el agente</h3><p><strong>${phase(context.mode)}</strong> · ${escape(context.goal)}</p><p>Respetar la regla de ${M.channel(state) === 'website' ? 'web' : 'redes'}: ${context.rule.value}.</p><p>${context.confirmedCopy ? `Texto confirmado: «${escape(context.confirmedCopy)}». No reescribirlo sin una corrección humana.` : 'Texto pendiente: proponer alternativas como borradores.'}</p><p>${context.assetUse === 'placeholder-only' ? 'Usar un placeholder. No reutilizar la imagen de referencia.' : 'Original ficticio con permiso simulado; conservar sus límites de uso.'}</p><p>${context.attribution}</p>${context.missingFacts ? '<p>No inventar material, prestaciones ni disponibilidad.</p>' : ''}${state.task === 'website-change' && !state.siteAccess ? '<p>Puede proponer cambios; no editar sin código autorizado.</p>' : ''}<p>Voz: ${label(state.tone.action)}. Composición: ${label(state.composition.action)}. Ninguna es un hecho de marca.</p><details><summary>Registro técnico de la demo</summary><pre>${escape(JSON.stringify(context, null, 2))}</pre></details><small>Vista ilustrativa. No es un export válido del contrato actual.</small></div>`;
  }
  function update(next, message, focusAction = null) { state = next; render(focusAction); announce(message); }
  document.querySelector('#scenario').addEventListener('change', event => {
    state = M.create(event.target.value); preview = false; render(); announce('Escenario ficticio cambiado. No se guardaron datos reales.');
  });
  document.querySelector('#task').addEventListener('change', event => update(M.change(state,'task',event.target.value), 'Tarea cambiada. Se conserva la lectura y la voz; acción, encuadre, descripción y dirección necesitan revisión.'));
  document.addEventListener('change', event => {
    if (event.target.name === 'direction') {
      update(M.change(state,'direction',event.target.value), 'Dirección seleccionada para esta tarea. No es una regla de marca.');
      root.querySelector(`[name="direction"][value="${state.direction}"]`).focus();
    }
    if (event.target.id === 'render-reviewed') {
      update(M.change(state,'render',event.target.checked), 'Revisión del render simulada. No hay una pieza real.');
      root.querySelector('#render-reviewed').focus();
    }
  });
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-action]'); if (!button) return;
    const action = button.dataset.action;
    if (action === 'cancel-copy') return dialog.close();
    if (action === 'edit-copy') {
      returnFocus = button; copyRevision = state.copy.revision;
      document.querySelector('#copy-before').textContent = `Actual: «${state.copy.text}».`;
      document.querySelector('#copy-text').value = state.copy.text;
      document.querySelector('#copy-note').value = '';
      dialog.showModal(); document.querySelector('#copy-text').focus(); return;
    }
    if (action === 'explore') { preview = true; render('explore'); announce('Contexto exploratorio preparado. Las propuestas y los permisos pendientes mantienen su estado.'); return; }
    if (action === 'execute') {
      if (M.issues(state).length) {
        const error = document.querySelector('#stage-error'); error.hidden = false;
        error.textContent = 'Falta revisar: ' + M.issues(state).map(item => item.title).join(', ') + '.';
        const first = M.issues(state)[0].id;
        if (first === 'direction') { root.querySelectorAll('[name="direction"]').forEach(input => { input.setAttribute('aria-invalid','true'); input.setAttribute('aria-describedby','stage-error'); }); root.querySelector('[name="direction"]').focus(); }
        else root.querySelector(`[data-action="${first}"]`)?.focus();
        return;
      }
      return update(M.approveExecution(state), 'Revisión de ejecución registrada solo para la demo. La publicación sigue pendiente.', 'execute');
    }
    if (action === 'publish') return update(M.approvePublication(state), 'Aceptación de publicación simulada. No se publicó ni envió nada.', 'publish');
    if (action === 'reject-composition') return update(M.change(state,'composition','reject'), 'Propuesta descartada. Su original y las otras decisiones se conservan.', action);
    if (action === 'defer-composition') return update(M.change(state,'composition','pending'), 'Propuesta pendiente para volver a revisarla.', action);
    update(M.change(state,action), 'Revisión ficticia guardada. Las aprobaciones dependientes dejan de estar vigentes.', action);
  });
  document.addEventListener('submit', event => {
    if (!['tone-form','proposal-form','copy-form'].includes(event.target.id)) return;
    event.preventDefault();
    if (event.target.id === 'tone-form') {
      const choice = event.target.querySelector('[name="tone"]:checked').value;
      state = M.change(state,'tone',choice); render(); root.querySelector('#tone-form button').focus(); announce('Decisión guardada como preferencia para explorar. Las reglas no cambiaron.'); return;
    }
    if (event.target.id === 'proposal-form') {
      const input = document.querySelector('#proposal-text');
      try { state = M.change(state,'edit-proposal',input.value); }
      catch { input.setAttribute('aria-invalid','true'); const error = document.querySelector('#proposal-error'); error.hidden = false; error.textContent = 'Escribí una propuesta breve antes de guardar.'; input.focus(); return; }
      render(); root.querySelector('#proposal-form button').focus(); announce('Propuesta editada. Dirección y ejecución pendientes; texto confirmado y voz conservados.'); return;
    }
    const text = document.querySelector('#copy-text'), note = document.querySelector('#copy-note');
    const invalid = [!text.value.trim(), !note.value.trim()];
    [text,note].forEach((input,index) => input.setAttribute('aria-invalid',String(invalid[index])));
    try { if (invalid.some(Boolean)) throw new Error('missing'); state = M.replaceCopy(state, { text:text.value, note:note.value, baseRevision:copyRevision }); }
    catch { const error = document.querySelector('#copy-error'); error.hidden = false; error.textContent = 'Escribí el texto y el motivo. Si el texto cambió, cancelá y abrí la corrección de nuevo.'; [text,note][Math.max(0,invalid.indexOf(true))].focus(); return; }
    render(); dialog.close(); announce('Corrección demo confirmada. Versión anterior conservada; dirección, ejecución y publicación pendientes.');
  });
  dialog.addEventListener('close', () => {
    document.querySelector('#copy-error').hidden = true;
    document.querySelectorAll('#copy-form [aria-invalid]').forEach(input => input.removeAttribute('aria-invalid'));
    (returnFocus?.isConnected ? returnFocus : root.querySelector('[data-action="edit-copy"]'))?.focus();
    document.querySelector('#copy-form').reset();
  });
  render();
})();
