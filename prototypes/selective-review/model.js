// Isolated proposal model. This never imports/writes canonical artifacts or grants real authority.
(() => {
  'use strict';
  const cases = ['normal', 'incomplete', 'collaborator', 'low-resolution', 'missing-site', 'channel-conflict'];
  const tasks = ['instagram-story', 'promotional-image', 'conceptual-landing', 'website-change'];
  const clone = state => JSON.parse(JSON.stringify(state));
  function create(caseId = 'normal') {
    if (!cases.includes(caseId)) throw new Error('Unknown synthetic case.');
    const state = {
      caseId, task: 'instagram-story', goal: 'Presentar una pieza de cerámica.',
      copy: { text: 'Hecho despacio.', confirmed: true, revision: 1, sourceId: 'S-COPY-DEMO', sourceVersion: 1, reviewedVersion: 1 },
      actionReviewed: true, factsReviewed: true, siteAccess: false, conflictResolved: true,
      asset: { id: 'A-PRODUCT-DEMO', owner: 'own', originReviewed: true, included: true,
        permission: 'public-demo', permissionSource: 'S-PERMISSION-DEMO', fitReviewed: true, altReviewed: true,
        lowResolution: false, lowAccepted: false },
      rules: [
        { id: 'R-WEB-DEMO', scope: 'website', value: 'Verde #365749', sourceId: 'S-WEB-DEMO' },
        { id: 'R-SOCIAL-DEMO', scope: 'social', value: 'Arcilla #b77758', sourceId: 'S-SOCIAL-DEMO' }
      ],
      tone: { id: 'I-TONE-DEMO', original: 'Una voz tranquila y cercana.', action: 'pending' },
      composition: { id: 'P-LAYOUT-DEMO', original: 'Dejar aire alrededor del producto.', text: 'Dejar aire alrededor del producto.', action: 'pending' },
      direction: null, execution: null, publication: null, renderReviewed: false, archive: [], history: []
    };
    if (caseId === 'incomplete') {
      state.factsReviewed = false; state.copy.confirmed = false;
      state.asset.originReviewed = false; state.asset.permission = 'pending'; state.asset.permissionSource = null;
    }
    if (caseId === 'collaborator') {
      state.asset.owner = 'collaborator'; state.asset.permission = 'pending'; state.asset.permissionSource = null;
    }
    if (caseId === 'low-resolution') state.asset.lowResolution = true;
    if (caseId === 'missing-site' || caseId === 'channel-conflict') state.task = 'website-change';
    if (caseId === 'channel-conflict') { state.siteAccess = true; state.conflictResolved = false; }
    return state;
  }
  const channel = state => state.task === 'website-change' || state.task === 'conceptual-landing' ? 'website' : 'social';
  function issues(state) {
    const items = [];
    const add = (id, title, consequence) => items.push({ id, title, consequence });
    if (!state.goal.trim()) add('goal', 'Falta el objetivo', 'No sabemos qué debe explorar el agente.');
    if (!state.factsReviewed) add('facts', 'Datos de producto incompletos', 'No afirmar material, prestaciones ni disponibilidad sin una fuente.');
    if (!state.copy.confirmed) add('copy', 'Texto sin confirmar', 'El agente puede proponer alternativas, pero no ejecutar un texto aprobado.');
    if (state.copy.sourceVersion !== state.copy.reviewedVersion) add('source', 'La fuente del texto cambió', 'La aprobación anterior ya no es vigente.');
    if (!state.actionReviewed) add('action', 'Acción pendiente', 'Revisar destino y comportamiento para esta tarea.');
    if (!state.asset.included) add('asset', 'Falta una imagen seleccionada', 'La referencia excluida no puede convertirse en el original de una pieza.');
    if (state.asset.included && !state.asset.originReviewed) add('origin', 'Original sin verificar', 'Revisar procedencia y posibles capturas o elementos ajenos.');
    if (state.asset.included && !['local-demo', 'public-demo'].includes(state.asset.permission)) add('permission', 'Permiso de uso pendiente', 'La exploración usa un placeholder; esta imagen no se entrega como reutilizable.');
    if (state.asset.included && !state.asset.fitReviewed) add('fit', 'Encuadre pendiente', 'Comprobar que el producto se conserva en el uso elegido.');
    if (state.asset.included && !state.asset.altReviewed) add('alt', 'Alternativa accesible pendiente', 'Revisar su función y descripción en esta composición.');
    if (state.asset.included && state.asset.lowResolution && !state.asset.lowAccepted) add('resolution', 'Baja resolución', 'Aceptar el tamaño solo para esta prueba o elegir otro original; el render sigue pendiente.');
    if (state.task === 'website-change' && !state.siteAccess) add('site', 'Falta acceso al sitio', 'Explorar ideas es posible; editar requiere código autorizado y actual.');
    if (!state.conflictResolved && channel(state) === 'website') add('channel', 'Conflicto con la regla del sitio', 'La paleta de redes no reemplaza la regla confirmada para la web.');
    if (!state.direction) add('direction', 'Falta seleccionar una dirección', 'Las propuestas alternativas no son instrucciones simultáneas.');
    return items;
  }
  function key(state) {
    return JSON.stringify({ task: state.task, goal: state.goal, copy: state.copy, action: state.actionReviewed,
      facts: state.factsReviewed, asset: state.asset, channel: channel(state), conflict: state.conflictResolved,
      site: state.task === 'website-change' ? state.siteAccess : null, direction: state.direction, rules: state.rules });
  }
  const executionCurrent = state => Boolean(state.execution && state.execution.key === key(state) && issues(state).length === 0);
  function publicationIssues(state) {
    const result = [];
    if (!executionCurrent(state)) result.push('Revisar la ejecución vigente.');
    if (!state.renderReviewed) result.push('Revisar el render y su uso en la plataforma.');
    if (state.asset.included && state.asset.permission !== 'public-demo') result.push('Confirmar permiso de publicación; el permiso de diseño local no alcanza.');
    return result;
  }
  const publicationCurrent = state => Boolean(publicationIssues(state).length === 0 && state.publication?.key === key(state));
  const phase = state => publicationCurrent(state) ? 'publication-accepted-demo' : executionCurrent(state) ? 'selected-execution-demo' : 'exploration';
  function record(state, action, before, after) {
    state.history.push({ id: `H-${state.history.length + 1}`, action, before: clone(before), after: clone(after) });
  }
  function invalidate(state, reason, clearDirection = false) {
    if (state.execution || state.publication) state.archive.push({ reason, execution: state.execution, publication: state.publication });
    state.execution = null; state.publication = null; state.renderReviewed = false;
    if (clearDirection) state.direction = null;
  }
  function change(input, action, value) {
    const state = clone(input);
    if (action === 'tone' || action === 'composition') {
      if (!['accept-proposal', 'reject', 'pending'].includes(value)) throw new Error('Unknown review action.');
      const before = state[action].action;
      state[action].action = value; record(state, `${action}: ${value}`, before, value);
      // These are exploration preferences, not selected execution constraints or confirmed rules.
      return state;
    }
    if (action === 'edit-proposal') {
      if (typeof value !== 'string' || !value.trim() || value.length > 180) throw new Error('Write a proposal of 1–180 characters.');
      const before = state.composition.text; state.composition.text = value.trim();
      state.composition.action = 'pending'; invalidate(state, 'Propuesta editada', true);
      record(state, action, before, state.composition.text); return state;
    }
    if (action === 'task') {
      if (!tasks.includes(value)) throw new Error('Unknown task.');
      if (state.task === value) return state;
      const before = state.task; state.task = value;
      state.actionReviewed = false; state.asset.fitReviewed = false; state.asset.altReviewed = false; state.asset.lowAccepted = false;
      invalidate(state, 'Tarea cambiada', true); record(state, action, before, value); return state;
    }
    if (action === 'direction') {
      if (!['text-first', 'product-first'].includes(value)) throw new Error('Unknown direction.');
      if (state.direction !== value) invalidate(state, 'Dirección cambiada');
      record(state, action, state.direction, value); state.direction = value; return state;
    }
    if (action === 'source-changed') {
      const before = state.copy.sourceVersion; state.copy.sourceVersion++;
      invalidate(state, 'Fuente del texto cambiada', true); record(state, action, before, state.copy.sourceVersion); return state;
    }
    if (action === 'render') {
      if (!executionCurrent(state)) throw new Error('Review current execution before reviewing its render.');
      state.renderReviewed = value === true; state.publication = null; record(state, action, null, state.renderReviewed); return state;
    }
    const fixes = {
      facts: () => { state.factsReviewed = true; },
      copy: () => { state.copy.confirmed = true; },
      source: () => { state.copy.reviewedVersion = state.copy.sourceVersion; },
      action: () => { state.actionReviewed = true; },
      origin: () => { state.asset.originReviewed = true; },
      permission: () => { state.asset.permission = 'public-demo'; state.asset.permissionSource = 'S-PERMISSION-DEMO'; },
      reference: () => { state.asset.included = false; },
      asset: () => { state.asset = { ...create().asset, id: 'A-REPLACEMENT-DEMO', permissionSource: 'S-REPLACEMENT-DEMO' }; },
      fit: () => { state.asset.fitReviewed = true; },
      alt: () => { state.asset.altReviewed = true; },
      resolution: () => { state.asset.lowAccepted = true; },
      site: () => { state.siteAccess = true; },
      channel: () => { state.conflictResolved = true; }
    };
    if (!fixes[action]) throw new Error('Unknown synthetic change.');
    const before = clone({ copy: state.copy, asset: state.asset, site: state.siteAccess, channel: state.conflictResolved });
    invalidate(state, `Revisión: ${action}`); fixes[action]();
    record(state, action, before, { copy: state.copy, asset: state.asset, site: state.siteAccess, channel: state.conflictResolved }); return state;
  }
  function replaceCopy(input, { text, note, baseRevision }) {
    if (baseRevision !== input.copy.revision) throw new Error('The text changed; reopen the correction.');
    if (typeof text !== 'string' || !text.trim() || text.length > 180 || typeof note !== 'string' || !note.trim()) throw new Error('Write the text and the reason for this correction.');
    const state = clone(input), before = clone(state.copy);
    state.copy = { ...state.copy, text: text.trim(), confirmed: true, revision: state.copy.revision + 1,
      sourceId: `S-CORRECTION-DEMO-${state.copy.revision + 1}`, reviewedVersion: state.copy.sourceVersion };
    invalidate(state, 'Texto confirmado corregido', true);
    record(state, `copy-correction: ${note.trim()}`, before, state.copy); return state;
  }
  function approveExecution(input) {
    if (issues(input).length) throw new Error('Execution still has required review.');
    const state = clone(input); state.execution = { key: key(state), copy: clone(state.copy), direction: state.direction };
    state.publication = null; state.renderReviewed = false;
    record(state, 'execution-review-demo', null, state.execution); return state;
  }
  function approvePublication(input) {
    if (publicationIssues(input).length) throw new Error('Review execution, output and publication permission first.');
    const state = clone(input); state.publication = { key: key(state) };
    record(state, 'publication-review-demo', null, state.publication); return state;
  }
  function context(state) {
    const currentRule = state.rules.find(rule => rule.scope === channel(state));
    const assetReusable = state.asset.included && state.asset.originReviewed && ['local-demo','public-demo'].includes(state.asset.permission);
    return {
      mode: phase(state), task: state.task, goal: state.goal,
      confirmedCopy: state.copy.confirmed && state.copy.sourceVersion === state.copy.reviewedVersion ? state.copy.text : null,
      rule: currentRule, observations: ['La muestra ficticia presenta cerámica en pequeñas series.'],
      inference: { ...state.tone }, functionalDefault: 'system-ui, sans-serif (valor funcional, no fuente de marca)',
      proposal: { ...state.composition }, selectedDirection: state.direction,
      assetUse: assetReusable ? 'authorized-demo-original' : 'placeholder-only',
      attribution: state.asset.owner === 'collaborator' ? 'Otro autor: no aporta reglas de identidad del perfil.' : 'Autor ficticio del perfil.',
      pending: issues(state), missingFacts: !state.factsReviewed,
      siteAccess: state.task === 'website-change' ? state.siteAccess : null
    };
  }
  globalThis.SelectiveReview = Object.freeze({ create, cases, tasks, channel, issues, publicationIssues, key, phase, executionCurrent,
    publicationCurrent, change, replaceCopy, approveExecution, approvePublication, context });
})();
