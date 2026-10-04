(() => {
  'use strict';
  const clone = value => JSON.parse(JSON.stringify(value));
  const stable = value => JSON.stringify(value, function(key,item) {
    return item && typeof item==='object' && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))) : item;
  });
  const names = ['ingestion', 'evidence', 'analysis', 'colors', 'compilation'];
  const phaseNames = { ingestion:'Fuentes', evidence:'Evidencia', analysis:'Análisis', colors:'Colores', compilation:'Contexto' };
  const scenarios = {
    fresh:'Perfil nuevo', cached:'Trabajo reutilizable', reanalyze:'Reanalizar', missing:'Uso sin factura',
    failed:'Fallo local con respuesta guardada', incomplete:'Respuesta incompleta', interrupted:'Trabajo interrumpido',
    review:'Espera una revisión', mixed:'Monedas distintas', shared:'Preparación compartida'
  };
  const usage = { input_tokens:800, output_tokens:240, total_tokens:1040,
    input_tokens_details:{cached_tokens:200}, output_tokens_details:{reasoning_tokens:60} };
  function attempt(id, name, number, provider, billing = null, status = 'completed') {
    return { id:`${id}-${name}-${number}`, status, provider,
      model:provider === 'openai' ? 'synthetic-vision-model' : null,
      configuration:{reasoningEffort:null,maxOutputTokens:provider === 'openai' ? 16000 : null,
        actor:provider === 'apify' ? 'apify/instagram-scraper' : null, resultsType:null},
      responseId:status === 'completed' ? `synthetic-response-${number}` : null,
      usage:provider === 'openai' && status === 'completed' ? clone(usage) : null,
      billing, startedAt:'2026-01-01T12:00:00.000Z',
      endedAt:status === 'attempted' ? null : '2026-01-01T12:00:04.000Z',
      wallMs:status === 'attempted' ? null : 4000 };
  }
  function phase(id, name, status = 'completed', mode = 'local', attempts = []) {
    return { id:`${id}-${name}`, name, status, mode, attempts,
      startedAt:'2026-01-01T12:00:00.000Z', endedAt:status === 'running' ? null : '2026-01-01T12:00:05.000Z',
      wallMs:status === 'running' ? null : 5000 };
  }
  function record(id, phases, status = 'complete') {
    return { schemaVersion:'brand-run/v1', id, status, phases,
      options:{refresh:false,reanalyze:false,postLimit:20},
      startedAt:'2026-01-01T12:00:00.000Z', endedAt:status === 'running' ? null : '2026-01-01T12:00:25.000Z' };
  }
  const bill = (amount, currency = 'USD') => ({amount,currency,source:'synthetic-provider-observation'});
  function prepared() {
    const id = 'run-synthetic-shared';
    return record(id, [phase(id,'ingestion','completed','provider',[
      attempt(id,'ingestion',1,'apify',bill(.15)),attempt(id,'ingestion',2,'apify',bill(.20))]),
      phase(id,'evidence'), phase(id,'analysis','completed','provider',[attempt(id,'analysis',1,'openai')]),
      phase(id,'colors','completed','provider',[attempt(id,'colors',1,'openai')]),phase(id,'compilation')]);
  }
  function intake(status = 'review-required') {
    const id = 'run-synthetic-intake';
    return record(id,[phase(id,'ingestion','completed','provider',[
      attempt(id,'ingestion',1,'apify',bill(.10)),attempt(id,'ingestion',2,'apify',bill(.20))]),phase(id,'evidence')],status);
  }
  function plan(operation) {
    const common = { revision:1,inputHash:'synthetic-input-v1', operation, estimate:null };
    if (operation === 'local') return { ...common,title:'Preparar con lo guardado', paid:false,
      reason:'Las fuentes y el análisis siguen vigentes.', reuse:'Fuentes, análisis y colores.',
      scope:'Compilar contexto y preparar informe en español. Sin solicitudes a proveedores.', calls:0,
      provider:null, model:null };
    if (operation === 'intake') return { ...common,title:'Traer el perfil', paid:true,
      reason:'Todavía no hay fuentes guardadas para este perfil.',reuse:'Sin fuentes anteriores.',
      scope:'Hasta 2 ejecuciones de Apify: perfil y hasta 20 publicaciones. El análisis espera la revisión de imágenes.',
      calls:2,provider:'Apify',model:'apify/instagram-scraper' };
    if (operation === 'colors') return { ...common,title:'Preparar propuestas de color',paid:true,
      reason:'El análisis recuperado se conserva; falta resolver la etapa de colores.',reuse:'Fuentes, clasificación y análisis recuperado.',
      scope:'Hasta 1 solicitud de visión con un máximo de 4 gráficos propios revisados. No repite el análisis.',
      calls:1,provider:'OpenAI',model:'synthetic-vision-model' };
    return { ...common,title:'Generar análisis y colores',paid:true,
      reason:'No hay un análisis vigente para el contexto revisado.',reuse:'Fuentes y clasificación de imágenes.',
      scope:'Hasta 2 solicitudes de visión: análisis y colores. Máximo 24 imágenes propias revisadas; colores usa hasta 4 gráficos.',
      calls:2,provider:'OpenAI',model:'synthetic-vision-model',
      estimate:{min:.02,max:.06,currency:'USD',basis:'Importes ficticios elegidos para esta demo; no son tarifas vigentes ni un límite de gasto.',
        usageBasis:'Supuesto ficticio: 2 solicitudes pequeñas de visión.', asOf:'2026-01-01'} };
  }
  function create(scenario = 'fresh') {
    if (!scenarios[scenario]) throw new Error('UNKNOWN_SCENARIO');
    const state = { scenario, records:[], latest:null, view:'work', revisions:[],
      job:{status:'queued',inputHash:'synthetic-input-v1',stale:false,error:null,responseSaved:false},
      plan:plan('intake'), outputs:[], tasks:[] };
    if (scenario === 'fresh') return state;
    if (['cached','reanalyze','shared'].includes(scenario)) {
      state.records = [prepared()]; state.latest = state.records[0].id;
      state.plan = plan(scenario === 'reanalyze' ? 'analysis' : 'local');
      state.outputs = [{name:'Informe anterior',status:'Versión anterior conservada'}];
      if (scenario === 'shared') {
        state.tasks = [{id:'task-synthetic-story',runIds:[state.latest]}, {id:'task-synthetic-page',runIds:[state.latest]}];
      }
      return state;
    }
    if (scenario === 'review') {
      state.records = [intake()]; state.latest = state.records[0].id;
      state.job.status = 'review-required'; state.plan = null;
      state.outputs = [{name:'Fuentes y contacto de imágenes',status:'Listos para revisar'}];
      return state;
    }
    const id = 'run-synthetic-observed';
    const active = attempt(id,'analysis',1,'openai',scenario === 'mixed' ? bill(.12,'EUR') : null,
      scenario === 'interrupted' ? 'attempted' : 'completed');
    if (scenario === 'interrupted') active.responseId = 'synthetic-remote-known';
    if (scenario === 'incomplete') active.status = 'failed';
    const phases = [phase(id,'ingestion','completed','provider',[attempt(id,'ingestion',1,'apify',bill(.18))]),
      phase(id,'evidence'),phase(id,'analysis', scenario === 'incomplete' ? 'failed' :
        scenario === 'interrupted' ? 'running' : 'completed','provider',[active])];
    if (['failed','missing','mixed'].includes(scenario)) phases.push(phase(id,'colors'),
      phase(id,'compilation',scenario === 'failed' ? 'failed' : 'completed'));
    state.records = [record(id,phases,scenario === 'interrupted' ? 'running' : ['failed','incomplete'].includes(scenario) ? 'failed' : 'complete')];
    state.latest = id; state.plan = null;
    state.job.status = scenario === 'interrupted' ? 'interrupted' : ['failed','incomplete'].includes(scenario) ? 'failed' : 'completed';
    state.job.error = scenario === 'failed' ? 'LOCAL_WRITE_FAILED' : scenario === 'incomplete' ? 'INCOMPLETE_RESPONSE' : null;
    state.job.responseSaved = scenario === 'failed'; // Proposed job checkpoint, not current core behavior.
    state.outputs = [{name:'Fuentes y evidencia',status:'Conservadas'},
      {name:'Informe anterior',status:'Versión anterior conservada'}];
    return state;
  }
  function ledger(records) {
    const rows = new Map(), byCurrency = {}, usageByModel = {};
    for (const run of records) {
      if (run.schemaVersion !== 'brand-run/v1' || !Array.isArray(run.phases) ||
        !['complete','running','failed','review-required'].includes(run.status)) throw new Error('INVALID_RECORD');
      for (const p of run.phases) {
        if (p.id !== `${run.id}-${p.name}` || !names.includes(p.name) || !Array.isArray(p.attempts)) throw new Error('INVALID_PHASE');
        for (const [index,a] of p.attempts.entries()) {
          if (a.id !== `${p.id}-${index+1}` || !['attempted','completed','failed'].includes(a.status)) throw new Error('INVALID_ATTEMPT');
          const value = {id:a.id,runId:run.id,phase:p.name,status:a.status,provider:a.provider,model:a.model,
            usage:a.usage ?? null,billing:a.billing ?? null,wallMs:a.wallMs ?? null};
          if (rows.has(a.id)) {
            if (stable(rows.get(a.id)) !== stable(value)) throw new Error('CONFLICTING_OBSERVATION');
            continue;
          }
          const b = value.billing;
          if (b && (!Number.isFinite(b.amount) || b.amount < 0 || !/^[A-Z]{3}$/.test(b.currency) || !b.source)) throw new Error('INVALID_BILLING');
          if (value.usage) for (const field of ['input_tokens','output_tokens','total_tokens']) {
            const n = value.usage[field];
            if (n != null && (!Number.isFinite(n) || n < 0)) throw new Error('INVALID_USAGE');
          }
          if (value.usage) for (const [field,key] of [['input_tokens_details','cached_tokens'],['output_tokens_details','reasoning_tokens']]) {
            const n=value.usage[field]?.[key]; if (n!=null&&(!Number.isFinite(n)||n<0)) throw new Error('INVALID_USAGE');
          }
          rows.set(a.id,value);
          if (b) {
            byCurrency[b.currency] = (byCurrency[b.currency] ?? 0) + b.amount;
            if (!Number.isFinite(byCurrency[b.currency])) throw new Error('INVALID_BILLING');
          }
          if (value.usage) {
            const key = `${value.provider ?? 'unknown'}/${value.model ?? 'unknown'}`;
            const total = usageByModel[key] ??= {input:0,output:0,inputObserved:0,outputObserved:0};
            for (const [field,target] of [['input_tokens','input'],['output_tokens','output']]) {
              if (value.usage[field] != null) { total[target] += value.usage[field]; total[`${target}Observed`]++; }
            }
          }
        }
      }
    }
    const observations = [...rows.values()];
    return {observations,byCurrency,usageByModel,unknownBilling:observations.filter(a=>!a.billing).length,
      partial:observations.some(a=>!a.billing),attemptCount:observations.length};
  }
  const latest = state => state.records.find(run=>run.id===state.latest) ?? null;
  function timeline(state) {
    const run = latest(state);
    return names.map(name => {
      const observed = run?.phases.find(p=>p.name===name);
      return {name,label:phaseNames[name],status:observed?.status ?? 'not-reached',mode:observed?.mode ?? null,
        wallMs:observed?.wallMs ?? null};
    });
  }
  function canStart(state) {
    return state.job.status === 'queued' && !state.job.stale && state.plan && state.plan.inputHash === state.job.inputHash;
  }
  function recoveryPlan(state) {
    if(state.job.status!=='interrupted'||state.job.stale) throw new Error('NOT_INTERRUPTED');
    const p=latest(state)?.phases.find(p=>p.status==='running'), a=p?.attempts.find(a=>a.responseId);
    if(!a) throw new Error('REMOTE_RESULT_UNKNOWN');
    return {revision:1,inputHash:state.job.inputHash,title:'Consultar el intento anterior',paid:true,
      reason:'Hay un identificador remoto guardado. No se crea otra ejecución.',reuse:'Mismo intento y fuentes guardadas.',
      scope:'Hasta 1 consulta simulada del resultado existente. Disponibilidad y costo de consulta requieren verificación por proveedor.',
      calls:1,provider:a.provider==='openai'?'OpenAI':'Apify',model:a.model??'Ejecución existente',estimate:null};
  }
  function start(state, authorizedRevision = null) {
    const next = clone(state);
    if (!canStart(state)) throw new Error('NOT_READY');
    if (state.plan.paid && authorizedRevision !== state.plan.revision) throw new Error('AUTHORIZATION_REQUIRED');
    const id = `run-synthetic-task-${state.revisions.length+1}`;
    const operation = state.plan.operation;
    const first = operation === 'intake' ? phase(id,'ingestion','running','provider',[attempt(id,'ingestion',1,'apify',null,'attempted')]) :
      operation === 'local' ? phase(id,'compilation','running','local') :
      phase(id,operation === 'colors' ? 'colors' : 'analysis','running','provider',[
        attempt(id,operation === 'colors' ? 'colors' : 'analysis',1,'openai',null,'attempted')]);
    const phases = operation === 'intake' ? [first] : [phase(id,'ingestion','completed','cache'),phase(id,'evidence'),
      ...(operation === 'local' ? [phase(id,'analysis','completed','cache'),phase(id,'colors','completed','cache')] :
        operation === 'colors' ? [phase(id,'analysis','completed','cache')] : []),first];
    next.records.push(record(id,phases,'running')); next.latest=id; next.job.status='running';
    next.revisions.push({revision:state.plan.revision,inputHash:state.plan.inputHash,paid:state.plan.paid,attemptRun:id});
    return next;
  }
  function change(state, action) {
    const next = clone(state);
    if (action === 'leave') { next.view='projects'; return next; }
    if (action === 'reopen') { next.view='work'; return next; } // Never dispatches.
    if (action === 'restart') {
      next.view='work'; if (next.job.status==='running') next.job.status='interrupted'; return next;
    }
    if (action === 'stop') {
      if (next.job.status!=='running') throw new Error('NOT_RUNNING');
      next.job.status='interrupted'; return next; // Stop local dispatch; remote remains uncertain.
    }
    if (action === 'inputs-changed') {
      next.job.inputHash += '-changed'; next.job.stale=true; return next;
    }
    if (action === 'review-inputs') {
      if (!next.job.stale) throw new Error('NOT_STALE');
      if (next.records.some(r=>r.status==='running')) throw new Error('OUTSTANDING_ATTEMPT');
      const previousRevision = next.plan?.revision ?? 1;
      next.plan = plan(next.scenario==='cached' || next.scenario==='shared' ? 'analysis' : next.plan?.operation ?? 'analysis');
      next.plan.revision=previousRevision+1; next.plan.inputHash=next.job.inputHash;
      next.job.stale=false; next.job.status='queued'; return next;
    }
    if (action === 'review') {
      if (next.job.status!=='review-required' || next.job.stale) throw new Error('NOT_REVIEWING');
      next.plan=plan(next.job.reconciled ? 'colors' : 'analysis'); next.job.status='queued'; return next;
    }
    if (action === 'retry') {
      if (next.job.status!=='failed' || next.job.responseSaved) throw new Error('RETRY_NOT_APPLICABLE');
      next.plan=plan('analysis'); next.plan.revision=next.revisions.length+2;
      next.job.status='queued'; next.job.error=null; return next; // Requires separate paid consent.
    }
    if (action === 'repair') {
      if (!next.job.responseSaved || next.job.status!=='failed' || next.job.stale) throw new Error('NO_CHECKPOINT');
      const id=`run-synthetic-task-${next.revisions.length+1}`, prior=next.latest;
      next.records.push(record(id,[phase(id,'ingestion','completed','cache'),phase(id,'evidence'),
        phase(id,'analysis','completed','cache'),phase(id,'colors','completed','cache'),phase(id,'compilation')]));
      next.latest=id; next.revisions.push({paid:false,recoveredFrom:prior});
      next.job.status='completed'; next.outputs.push({name:'Contexto ficticio recuperado',status:'Preparado localmente'}); return next;
    }
    if (action === 'reconcile') {
      if (next.job.status!=='interrupted' || next.job.stale) throw new Error('NOT_INTERRUPTED');
      const run=latest(next), p=run?.phases.find(p=>p.status==='running');
      if (!p || !p.attempts.length || !p.attempts[0].responseId) throw new Error('REMOTE_RESULT_UNKNOWN');
      for (const a of p.attempts) { a.status='completed'; a.usage=clone(usage); a.wallMs=4000; a.endedAt='2026-01-01T12:00:04.000Z'; }
      p.status='completed'; p.wallMs=5000; p.endedAt='2026-01-01T12:00:05.000Z';
      run.status='review-required'; run.endedAt='2026-01-01T12:00:25.000Z';
      next.job.status='review-required'; next.job.reconciled=true; next.plan=null;
      return next; // Same attempt; billing stays unknown; downstream work is not complete.
    }
    if (action === 'response') {
      if (next.job.status!=='running' || next.job.stale) throw new Error('NOT_RUNNING');
      const run=latest(next), operation=next.plan.operation, id=run.id;
      if (operation==='intake') {
        run.phases=[phase(id,'ingestion','completed','provider',[attempt(id,'ingestion',1,'apify',bill(.10)),attempt(id,'ingestion',2,'apify',bill(.20))]),phase(id,'evidence')];
        run.status='review-required'; next.job.status='review-required'; next.plan=null;
        next.outputs.push({name:'Fuentes y contacto de imágenes',status:'Listos para revisar'});
      } else {
        if (operation==='local') run.phases[run.phases.length-1]=phase(id,'compilation');
        else run.phases=[phase(id,'ingestion','completed','cache'),phase(id,'evidence'),
          phase(id,'analysis','completed',operation === 'colors' ? 'cache' : 'provider',operation === 'colors' ? [] : [attempt(id,'analysis',1,'openai')]),
          phase(id,'colors','completed','provider',[attempt(id,'colors',1,'openai')]),phase(id,'compilation')];
        run.status='complete'; next.job.status='completed'; next.outputs.push({name:'Contexto ficticio',status:'Preparado en la demo'});
      }
      run.endedAt='2026-01-01T12:00:25.000Z'; return next;
    }
    throw new Error('UNKNOWN_ACTION');
  }
  const money = amount => new Intl.NumberFormat('es-AR',{maximumSignificantDigits:6}).format(amount);
  globalThis.SpendProgress = {scenarios,create,ledger,latest,timeline,canStart,start,recoveryPlan,change,money,clone};
})();
