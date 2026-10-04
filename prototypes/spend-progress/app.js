(() => {
  'use strict';
  const M=globalThis.SpendProgress, root=document.querySelector('#content'), dialog=document.querySelector('#consent-dialog');
  let state=M.create(), consentRevision=null, consentHash=null, consentAction='start', opener=null;
  const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const announce=text=>document.querySelector('#announcement').textContent=text;
  const button=(id,label,primary=false)=>`<button type="button" id="${id}"${primary?' class="primary"':''}>${label}</button>`;
  const status=()=>state.job.stale?'Cambió el contexto':({queued:'Listo para comenzar',running:'En curso',
    'review-required':'Espera una revisión',completed:'Completado',failed:'Falló',interrupted:'Interrumpido'}[state.job.status]);
  const phaseStatus=p=>p.mode==='cache'&&p.status==='completed'?'Reutilizado':({completed:p.mode==='local'?'Listo · local':'Listo',
    running:state.job.status==='interrupted'?'Interrumpido':state.job.stale?'En curso · contexto anterior':'En curso',failed:'Falló','not-reached':'Sin iniciar'}[p.status]??p.status);
  function scope(p) {
    return `<p><strong>${esc(p.title)}</strong></p><p>${esc(p.scope)}</p><p class="muted">Reutiliza: ${esc(p.reuse)}</p>`+
      (p.paid?`<p>Proveedor: ${esc(p.provider)} · ${esc(p.model)}</p><p><strong>Importe final desconocido.</strong></p>`:'<p>Sin nuevas solicitudes a proveedores.</p>')+
      (p.estimate?`<details><summary>Estimación ficticia</summary><p>${M.money(p.estimate.min)}–${M.money(p.estimate.max)} ${esc(p.estimate.currency)} · estimación.</p><p>${esc(p.estimate.basis)}</p><p>${esc(p.estimate.usageBasis)} · referencia ${esc(p.estimate.asOf)}.</p></details>`:'');
  }
  function nextAction() {
    if(state.job.stale) return '<p>Los datos cambiaron. El alcance anterior ya no sirve para autorizar un pedido.</p>'+
      (state.records.some(r=>r.status==='running')?'<p>Hay un intento anterior sin resolver; no se habilita otro pedido. Esta demo no simula reconciliarlo con entradas cambiadas.</p>':button('review-inputs','Simular revisión del cambio'));
    if(state.job.status==='queued') return `<p>${esc(state.plan.reason)}</p>${scope(state.plan)}`+button('start',state.plan.paid?'Revisar pedido (demo)':'Reutilizar y preparar (demo)',true);
    if(state.job.status==='running') return '<p>Podés dejar esta vista. Las solicitudes ya enviadas pueden seguir en el proveedor.</p>'+button('response','Simular resultado')+button('stop','Detener lo que falta (demo)');
    if(state.job.status==='review-required') return `<p>${state.job.reconciled?'Se recuperó el mismo intento. Revisá el trabajo que todavía falta.':'Las fuentes están listas. Falta clasificar las imágenes antes de analizar.'}</p>`+button('review','Simular revisión y ver alcance');
    if(state.job.status==='failed') return state.job.responseSaved?
      '<p>El contexto no se pudo guardar. La respuesta válida está disponible como checkpoint de la propuesta de app.</p>'+button('repair','Simular recuperación local',true):
      '<p>La respuesta está incompleta. Se conserva el uso registrado y el informe anterior.</p>'+button('retry','Preparar otro intento (demo)');
    if(state.job.status==='interrupted') {
      const running=M.latest(state)?.phases.find(p=>p.status==='running');
      const remote=running?.attempts.some(a=>a.responseId);
      return '<p>El último estado no confirma el resultado ni el cargo. Reabrir esta vista no reintenta nada.</p>'+
        (remote?button('reconcile','Simular consulta del mismo intento'):'<p class="muted">Sin identificador remoto: revisar el resultado en el proveedor antes de autorizar un intento nuevo. Esta demo no simula esa autorización.</p>');
    }
    return '<p>El trabajo de esta muestra terminó. La revisión del diseño y la publicación son pasos separados.</p>';
  }
  function render(focusId=null) {
    const open=[...root.querySelectorAll('details[id][open]')].map(n=>n.id);
    if(state.view==='projects') {
      root.innerHTML=`<section><h2 id="work-title" tabindex="-1">Proyectos</h2><p>Trabajo ficticio · ${status()}</p><p class="muted">Los datos de esta demo quedan en memoria mientras la página siga abierta.</p>${button('reopen','Volver al trabajo')}</section>`;
      if(focusId) document.getElementById(focusId)?.focus(); return;
    }
    const ledger=M.ledger(state.records), timeline=M.timeline(state);
    const totals=Object.entries(ledger.byCurrency).map(([currency,amount])=>`<div>${M.money(amount)} ${esc(currency)}</div>`).join('');
    root.innerHTML=`<div class="statusbar"><strong id="work-title" tabindex="-1">${status()}</strong>${button('leave','Ver proyectos')}</div>
      <div class="layout"><div>
      <section aria-labelledby="next-title"><h2 id="next-title">Próxima acción</h2>${nextAction()}<p id="action-error" role="alert" class="error" hidden></p></section>
      <section aria-labelledby="progress-title"><h2 id="progress-title">Etapas</h2><p class="muted">Último registro guardado</p><ol class="timeline">${timeline.map(p=>`<li><span>${p.label}${p.wallMs!=null?`<small>${M.money(p.wallMs/1000)} s observados</small>`:''}</span><span>${phaseStatus(p)}</span></li>`).join('')}</ol><p class="muted">Sin porcentaje ni tiempo restante estimado.</p></section>
      <section aria-labelledby="outputs-title"><h2 id="outputs-title">Disponible</h2>${state.outputs.length?`<ul>${state.outputs.map(o=>`<li>${esc(o.name)} · ${esc(o.status)}</li>`).join('')}</ul><details id="output-content"><summary>Ver contenido ficticio</summary><p>Fuentes e informe de ejemplo, conservados para inspección. No es un archivo real ni un export canónico.</p></details>`:'<p class="muted">Todavía no hay resultados guardados en esta muestra.</p>'}</section>
      </div><aside>
      <section aria-labelledby="cost-title"><h2 id="cost-title">Gasto registrado</h2><p class="muted">Proyecto · cada intento se cuenta una vez</p><div class="totals">${totals||'Importe no disponible'}</div>
      <p>${ledger.unknownBilling?`${ledger.unknownBilling} intento/s sin importe devuelto. Suma parcial.`:ledger.attemptCount?'Importes devueltos en la muestra.':'No hay solicitudes registradas.'}</p>
      ${Object.keys(ledger.byCurrency).length>1?'<p>No se suman monedas distintas.</p>':''}
      ${state.tasks.length?'<p>Dos tareas comparten la misma preparación; no se duplica el cargo.</p>':''}
      <details id="attempts"><summary>Ver uso y cargos por intento (${ledger.attemptCount})</summary>${ledger.observations.map(a=>`<div class="attempt"><h3>${esc(a.provider??'Proveedor desconocido')} · ${M.timeline(state).find(p=>p.name===a.phase)?.label??esc(a.phase)}</h3>
        <p>${a.billing?`Importe devuelto: ${M.money(a.billing.amount)} ${esc(a.billing.currency)}`:'Importe no disponible'}</p>
        <p>${a.usage?`Entrada: ${a.usage.input_tokens==null?'no disponible':a.usage.input_tokens} · salida: ${a.usage.output_tokens==null?'no disponible':a.usage.output_tokens}`:'Uso no disponible'}</p>
        ${a.usage?.input_tokens_details?.cached_tokens!=null?`<p>Tokens de entrada en caché: ${a.usage.input_tokens_details.cached_tokens} (incluidos en la entrada).</p>`:''}
        ${a.usage?.output_tokens_details?.reasoning_tokens!=null?`<p>Tokens de razonamiento: ${a.usage.output_tokens_details.reasoning_tokens} (incluidos en la salida).</p>`:''}
        <small>${a.wallMs==null?'Tiempo no disponible':`${M.money(a.wallMs/1000)} s de proveedor`} · esfuerzo humano no medido</small></div>`).join('')||'<p>Sin intentos.</p>'}</details>
      <p class="muted">Solo solicitudes registradas. No mide traducción ni generación externa.</p></section>
      <details id="technical"><summary>Registro y pruebas</summary><p>Sin proveedores ni persistencia. Recargar de verdad reinicia la muestra.</p>
        <div class="actions">${button('restart','Simular reinicio')}${button('inputs-changed','Simular cambio de contexto')}</div><pre id="records"></pre>
        <p>La respuesta guardada y los estados de trabajo pertenecen al diseño de app, no al journal actual.</p></details></aside></div>`;
    document.querySelector('#records').textContent=JSON.stringify({job:state.job,plan:state.plan,records:state.records,tasks:state.tasks},null,2);
    for(const id of open) { const d=document.getElementById(id); if(d) d.open=true; }
    if(focusId) (document.getElementById(focusId)??document.getElementById('work-title')).focus();
  }
  function openConsent(action='start') {
    const p=action==='reconcile'?M.recoveryPlan(state):state.plan;
    consentRevision=p.revision;consentHash=state.job.inputHash;consentAction=action;opener=document.getElementById(action);
    document.getElementById('consent-scope').innerHTML=scope(p);
    for(const d of dialog.querySelectorAll('details')) d.open=false;
    document.getElementById('authorize').checked=false;
    document.getElementById('authorize').removeAttribute('aria-invalid');
    document.getElementById('consent-error').hidden=true;
    dialog.showModal(); document.getElementById('authorize').focus();
  }
  const dismiss=()=>{dialog.close(); consentRevision=null; if(state.job.stale)render('review-inputs');else opener?.focus();};
  dialog.addEventListener('cancel',e=>{e.preventDefault();dismiss();});
  document.getElementById('cancel-consent').addEventListener('click',dismiss);
  document.getElementById('change-in-dialog').addEventListener('click',()=>{
    state=M.change(state,'inputs-changed'); announce('Cambió el contexto. El pedido abierto dejó de estar vigente.');
  });
  document.getElementById('consent-form').addEventListener('submit',e=>{
    e.preventDefault(); const check=document.getElementById('authorize'), error=document.getElementById('consent-error');
    if(!check.checked) { error.textContent='Confirmá el alcance antes de continuar.';error.hidden=false;check.setAttribute('aria-invalid','true');check.focus();return; }
    try {
      if(state.job.inputHash!==consentHash) throw new Error('STALE_SCOPE');
      state=consentAction==='reconcile'?M.change(state,'reconcile'):M.start(state,consentRevision);
      dialog.close();consentRevision=null;render('work-title');announce('Paso ficticio confirmado. No se llamó a ningún servicio.');
    }
    catch { error.textContent='El contexto cambió. Cerrá este pedido y revisá el alcance nuevo.';error.hidden=false;document.getElementById('cancel-consent').focus(); }
  });
  root.addEventListener('click',e=>{
    const id=e.target.closest('button')?.id; if(!id) return;
    if(id==='start'&&state.plan?.paid) {openConsent();return;}
    if(id==='reconcile') {openConsent('reconcile');return;}
    try { state=id==='start'?M.start(state):M.change(state,id);render(id==='leave'?'reopen':id==='reopen'?'work-title':id);announce(`${status()}. Cambio ficticio guardado en memoria.`); }
    catch { const error=document.getElementById('action-error'); if(error){error.textContent='Ese paso no está disponible en el estado actual.';error.hidden=false;} }
  });
  const selector=document.getElementById('scenario');
  selector.innerHTML=Object.entries(M.scenarios).map(([id,label])=>`<option value="${id}">${label}</option>`).join('');
  selector.addEventListener('change',()=>{state=M.create(selector.value);render();announce(`${selector.selectedOptions[0].textContent}. Muestra cargada.`);});
  render();
})();
