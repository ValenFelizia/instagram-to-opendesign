(() => {
  'use strict';
  const M = globalThis.OnboardingPrototype, F = globalThis.OnboardingFixture;
  const main = document.querySelector('#main'), projects = document.querySelector('#projects');
  const settings = document.querySelector('#settings-dialog'), runDialog = document.querySelector('#run-dialog');
  const storageKey = 'brand-onboarding-synthetic-v1';
  let state = M.initial(), timer = null, returnFocus = null, pendingRun = false, runPhase = 0, storageAvailable = true;
  try { state = M.restore(localStorage.getItem(storageKey)); } catch { storageAvailable = false; }
  const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const statuses = { empty: 'Ejemplo sin analizar', running: 'Preparando contexto', 'review-required': 'Imágenes para revisar',
    ready: 'Informe guardado', failed: 'Requiere atención', interrupted: 'Proceso interrumpido', stale: 'Fuentes cambiadas' };
  const badge = (text, kind = '') => `<span class="badge ${kind}">${esc(text)}</span>`;
  const button = (label, action, kind = 'primary') => `<button class="${kind}" data-action="${action}">${label}</button>`;
  const back = (label, action) => button(`<span aria-hidden="true">←</span> ${label}`, action, 'secondary');
  const projectHeader = () => `<div class="project-header"><img src="assets/mark.svg" alt=""><div><strong>${F.name}</strong><small>${F.handle} · ejemplo ficticio</small></div></div>`;
  const head = (eyebrow, title, text, action = '') => `<div class="page-head"><div><span class="eyebrow">${eyebrow}</span><h1 tabindex="-1">${title}</h1><p>${text}</p></div>${action}</div>`;
  const announce = text => { document.querySelector('#announcement').textContent = text; };
  function save() {
    try { localStorage.setItem(storageKey, JSON.stringify(M.snapshot(state))); }
    catch { storageAvailable = false; }
    document.querySelector('#storage-note').textContent = storageAvailable ? 'La demo recuerda tu avance en este navegador.' : 'No hay almacenamiento disponible. Esta demo funciona solo en la sesión actual.';
  }
  function renderProjects() {
    const current = state.view !== 'home' ? 'aria-current="page"' : '';
    projects.innerHTML = `<button class="project-button" data-action="project" ${current}><img src="assets/mark.svg" alt=""><span><strong>${F.name}</strong><small>${statuses[state.status]} · demo</small></span></button>`;
    document.querySelector('#setup-dot').classList.toggle('ready', state.configured);
    document.querySelector('.settings-trigger').setAttribute('aria-label', `Configuración: ${state.configured ? 'lista para la demo' : 'pendiente'}`);
  }
  function navigate(view) {
    state.view = view; save(); render(true);
  }
  function render(focus = false) {
    const renderers = { home, progress, evidence, report, review, actions, handoff };
    main.innerHTML = renderers[state.view]();
    document.querySelector('#breadcrumb').textContent = state.view === 'home' ? 'Tu espacio / Nuevo contexto' : `Taller Nube / ${ { progress: 'Proceso', evidence: 'Evidencia', report: 'Dossier', review: 'Revisión', actions: 'Próxima acción', handoff: 'Contexto para compartir' }[state.view] }`;
    renderProjects();
    if (focus) { main.querySelector('h1')?.focus(); window.scrollTo({ top: 0, behavior: 'instant' }); }
  }
  function home() {
    return `<section class="intro"><div><span class="eyebrow">DE UN PERFIL A UNA IDEA CON CONTEXTO</span><h1 tabindex="-1">Antes de crear,<br>conocé la marca.</h1><p class="lede">Reuní sus imágenes, su voz y las señales de identidad. Revisá lo importante y llevá ese contexto al agente que elijas.</p>
      <form class="intake-form" id="intake-form" novalidate><label for="profile-url">Link de Instagram</label><div class="input-row"><input id="profile-url" type="text" inputmode="url" autocomplete="off" placeholder="https://www.instagram.com/example_studio/" required aria-describedby="profile-hint profile-error"><button class="primary" type="submit">Preparar contexto <span aria-hidden="true">→</span></button></div><div id="profile-error" class="form-error" role="alert" hidden></div><p id="profile-hint" class="field-hint">Pegá un perfil público. En esta demo siempre se utiliza Taller Nube, una marca ficticia.</p><details class="goal"><summary>¿Ya tenés una idea en mente? <span class="muted">Opcional</span></summary><label for="objective">Para qué querés usar el contexto</label><select id="objective" class="select-input"><option value="later">Prefiero decidir después</option>${F.tasks.map(task => `<option value="${task.id}" ${state.objective === task.id ? 'selected' : ''}>${task.label}</option>`).join('')}</select><p class="field-hint">Podés cambiar de acción después. El análisis de marca se reutiliza.</p></details></form></div>
      <div class="intro-art" aria-hidden="true"><figure class="sample-paper"><img src="assets/cup.svg" alt=""><figcaption><span>Taller Nube</span><span>Una lectura visual</span></figcaption></figure><div class="sample-note"><small>DEL PERFIL AL CONTEXTO</small><strong>Hecho despacio.</strong><small>Una señal de voz para explorar.</small></div></div></section>
      <div class="journey-strip"><div><span class="step-number">01</span><span><strong>Una primera lectura</strong><p>Imágenes, relatos y señales.</p></span></div><div><span class="step-number">02</span><span><strong>Tu criterio, donde importa</strong><p>Evidencia y decisiones concretas.</p></span></div><div><span class="step-number">03</span><span><strong>Una próxima acción</strong><p>Contexto listo para explorar ideas.</p></span></div></div>
      <section class="home-project"><img src="assets/mark.svg" alt=""><div><strong>${state.status === 'empty' ? 'Probá con un contexto ya guardado' : F.name}</strong><p>${state.status === 'empty' ? 'Un dossier de ejemplo, sin configurar APIs.' : `${statuses[state.status]}. Abrilo para continuar.`}</p></div>${button(state.status === 'empty' ? 'Abrir ejemplo <span aria-hidden="true">↗</span>' : 'Volver al proyecto <span aria-hidden="true">→</span>', state.status === 'empty' ? 'cached' : 'project', 'secondary')}</section>`;
  }
  function progress() {
    const stages = [ ['Extraer el perfil', 'Biografía, publicaciones y archivos de la muestra.'], ['Preparar evidencia', 'Separar imágenes y conservar sus referencias.'], ['Leer la marca', 'Texto e imágenes, con inferencias revisables.'], ['Armar el dossier', 'Un resumen visual y las decisiones que siguen.'] ];
    const stalled = ['failed', 'interrupted', 'stale'].includes(state.status);
    const titles = { failed: 'Una pausa, no un comienzo de cero.', interrupted: 'El proceso quedó interrumpido.', stale: 'Cambió una parte de la muestra.' };
    const title = titles[state.status] ?? (state.status === 'ready' ? 'Tu dossier está listo.' : state.status === 'review-required' ? 'Tu mirada entra en esta parte.' : 'Estamos juntando las piezas.');
    let recovery = '';
    if (state.status === 'ready') recovery = `<div class="notice"><strong>La lectura de ejemplo terminó.</strong><p>Podés abrir el dossier cuando quieras. Cambiar de tarea reutiliza esta lectura.</p></div><div class="inline-actions">${button('Abrir el dossier', 'report')}</div>`;
    if (state.status === 'failed') recovery = `<div class="notice error"><strong>No se pudo validar la respuesta del análisis.</strong><p>La muestra y la evidencia siguen disponibles. El uso de tokens de ejemplo se conserva; la facturación no está disponible. No se volvió a intentar automáticamente.</p></div><div class="inline-actions">${button('Reintentar con alcance visible', 'request-run')}${button('Revisar la evidencia', 'evidence', 'secondary')}</div>`;
    if (state.status === 'interrupted') recovery = `<div class="notice"><strong>La ventana se cerró durante la simulación.</strong><p>La demo guardó el estado, pero no siguió trabajando. Podés retomar el ejemplo desde la última etapa guardada. La ejecución en segundo plano pertenece al diseño de la futura app.</p></div><div class="inline-actions">${button('Retomar simulación guardada', 'resume')}${button('Volver al inicio', 'home', 'secondary')}</div>`;
    if (state.status === 'stale') recovery = `<div class="notice"><strong>Hay una publicación nueva en el escenario ficticio.</strong><p>El dossier anterior se conserva como referencia. Para usar las nuevas fuentes hay que revisar la evidencia y regenerar la lectura; no se reemplazó ni se disparó una llamada.</p></div><div class="inline-actions">${button('Revisar la muestra nueva', 'evidence')}${button('Ver dossier anterior', 'report', 'secondary')}</div>`;
    if (state.status === 'review-required') recovery = `<div class="notice"><strong>Hay 3 imágenes que necesitan clasificación.</strong><p>Una foto de producto no define automáticamente los colores de la marca.</p></div><div class="inline-actions">${button('Revisar imágenes', 'evidence')}</div>`;
    if (!stalled && state.status === 'running') recovery = `<div class="notice"><strong>Podés volver al inicio mientras esperás.</strong><p>La simulación sigue si cambiás de pantalla dentro de esta pestaña. Si cerrás la ventana, se detiene; al volver verás el estado guardado.</p></div><div class="inline-actions">${button('Volver a mi espacio', 'home', 'secondary')}</div>`;
    return `${head('LECTURA EN CURSO', title, 'Cada etapa conserva su resultado. Tu proyecto sigue visible en el espacio de trabajo.', back('Inicio', 'home'))}<div class="progress-layout"><section aria-label="Estado de las etapas"><ol class="phase-list">${stages.map(([label, detail], index) => { const complete = index < state.phase, active = index === state.phase; return `<li class="${complete ? 'complete' : active ? 'active' : ''}"><span class="phase-symbol" aria-hidden="true">${complete ? '✓' : index + 1}</span><div><strong>${label}</strong><p>${detail}</p></div><small>${complete ? 'Lista' : active ? stalled ? 'Requiere atención' : state.status === 'review-required' ? 'Tu revisión' : 'En curso' : 'Pendiente'}</small></li>`; }).join('')}</ol>${recovery}</section><aside class="run-summary">${projectHeader()}<h3>Alcance de esta pasada</h3><dl class="compact-facts"><div><dt>Fuente</dt><dd>20 publicaciones ficticias</dd></div><div><dt>Imágenes</dt><dd>3 ilustraciones demo</dd></div><div><dt>Modo</dt><dd>Simulación local</dd></div><div><dt>Facturación</dt><dd>No disponible</dd></div><div><dt>Tokens de ejemplo</dt><dd>${state.status === 'failed' ? '2.700 entrada · 83 salida' : 'Todavía no informados'}</dd></div></dl><p class="field-hint">Tokens, cargos y tiempo de espera son datos distintos. No estimamos dinero a partir de estos tokens.</p></aside></div>`;
  }
  function evidence() {
    return `${head('UNA REVISIÓN ANTES DE LEER', 'Qué es marca.<br>Qué es producto.', 'Estas ilustraciones ficticias representan las imágenes de un perfil. Elegí qué aporta cada una: el análisis usará esa distinción.', back('Inicio', 'home'))}<form id="evidence-form" novalidate><div class="assets-grid">${F.assets.map((asset, index) => `<article class="asset-card"><img src="${asset.file}" alt="${asset.alt}"><div class="asset-body"><h2 class="asset-title">${asset.title}</h2><p>${asset.caption}</p><a class="asset-open" href="${asset.file}" target="_blank" rel="noopener" aria-label="Ver imagen completa: ${asset.title} (nueva pestaña)">Ver imagen completa <span aria-hidden="true">↗</span></a><fieldset><legend>Clasificar ${asset.title.toLowerCase()}</legend>${[['brand-graphic','Identidad / gráfica'],['product-photo','Foto de producto'],['excluded','Dejar fuera']].map(([value,label]) => `<label class="radio-line"><input type="radio" name="asset-${index}" value="${value}" ${state.images[index] === value ? 'checked' : ''} aria-describedby="evidence-error">${label}</label>`).join('')}</fieldset><details><summary>Referencia técnica</summary><p><code>${asset.id}</code><br>Origen: ilustración creada para esta demo. No es una fotografía descargada de Instagram.</p></details></div></article>`).join('')}</div><div id="evidence-error" class="form-error" role="alert" hidden></div><div class="report-next"><p>Clasificar la evidencia no confirma permisos de reutilización ni reglas de marca. Eso se revisa cuando elegís qué hacer.</p><button class="primary" type="submit">Continuar con la lectura <span aria-hidden="true">→</span></button></div></form>`;
  }
  function report() {
    const excluded = state.images.map((value, index) => value === 'excluded' ? F.assets[index].id : null).filter(Boolean);
    const visuals = F.assets.filter(asset => !excluded.includes(asset.id));
    return `${head('UN DOSSIER PARA TRABAJAR', 'Conocer, antes de proponer.', 'Una lectura inicial de la muestra ficticia. Hechos, inferencias y propuestas conservan su diferencia.', button('Elegir qué hacer <span aria-hidden="true">→</span>', 'actions'))}
      ${state.status === 'stale' ? '<div class="notice"><strong>Estás viendo el dossier anterior.</strong><p>Las fuentes cambiaron. Revisá la nueva muestra antes de preparar otro contexto.</p></div><br>' : ''}
      <article class="dossier"><div class="dossier-heading"><div><span class="eyebrow">${F.category.toUpperCase()}</span><h2>${F.name}</h2><p>${F.biography}</p><div class="source-line"><span>${F.handle}</span><span>Perfil y publicaciones de ejemplo</span></div></div><img class="mark" src="assets/mark.svg" alt="Marca ficticia Taller Nube"></div>
      <div class="visual-board">${[...visuals].reverse().map(asset => `<figure><img src="${asset.file}" alt="${asset.alt}"><figcaption>${asset.title}</figcaption></figure>`).join('')}</div><p class="dossier-caption">Ilustraciones de demostración. Las señales y citas de este dossier fueron escritas para el prototipo.</p>
      <div class="section-line"><h2>Lo que aparece en la muestra</h2><span class="muted">Y cómo podría orientar el trabajo</span></div><div class="report-body"><section aria-label="Señales e inferencias">${F.signals.map(signal => `<article class="signal"><div class="signal-heading"><h3>${signal.title}</h3>${badge(signal.status, signal.status === 'En la muestra' ? '' : 'pending')}</div><p>${signal.text}</p><details><summary>Ver evidencia</summary><blockquote>${esc(signal.source)}</blockquote><p>${signal.sourceLabel} · no es una fuente de una marca real.</p><details><summary>Referencia técnica</summary><code>${signal.id}</code></details></details></article>`).join('')}</section><aside class="palette-panel"><h3>Un lenguaje de color</h3><div class="swatches" aria-label="Verde profundo, arcilla y blanco cálido"><span class="swatch swatch-leaf"></span><span class="swatch swatch-clay"></span><span class="swatch swatch-paper"></span></div>${badge(state.palette === 'rejected' ? 'Propuesta descartada' : 'Paleta provisional', 'pending')}<p>Una hipótesis visual para explorar. Los colores del producto no son una especificación de identidad.</p><details><summary>Valores de la propuesta</summary><p>Verde #365749<br>Arcilla #b77758<br>Papel #f6f2e7</p></details></aside></div>
      <section class="decision-strip"><div><strong>${state.palette !== 'pending' && state.rights !== 'pending' ? 'Revisión demo registrada' : 'Dos decisiones para tu próxima idea'}</strong><p>El uso de las imágenes y el carácter provisional de la identidad.</p></div>${button('Revisar lo importante', 'review', 'secondary')}</section></article>
      <div class="report-next"><p>Podés explorar con propuestas abiertas. Confirmar una marca o publicar una pieza requiere su propia revisión.</p>${button('Preparar contexto para un agente <span aria-hidden="true">→</span>', 'actions')}</div>`;
  }
  function review() {
    return `${head('TU CRITERIO, EN DOS PUNTOS', 'Revisar sin frenar la idea.', 'No hace falta aprobar cada inferencia. Estas decisiones cambian cómo puede usarse el contexto.', back('Dossier', 'report'))}<form id="review-form"><div class="review-grid"><section class="review-block"><span class="eyebrow">01 / IDENTIDAD</span><h2>¿Esta paleta sirve como punto de partida?</h2><div class="swatches" aria-label="Verde, arcilla y blanco cálido"><span class="swatch swatch-leaf"></span><span class="swatch swatch-clay"></span><span class="swatch swatch-paper"></span></div><p>Aceptarla como propuesta permite explorar. No la convierte en un código de colores confirmado.</p><fieldset><legend>Qué hacemos con esta propuesta</legend>${[['proposal','Me sirve para explorar'],['pending','Lo reviso después'],['rejected','Prefiero otra dirección']].map(([value,label]) => `<label class="radio-line"><input type="radio" name="palette" value="${value}" ${state.palette === value ? 'checked' : ''}>${label}</label>`).join('')}</fieldset><details><summary>¿Y si ya tengo reglas de marca?</summary><p>La futura app deberá registrar la fuente y el alcance de esas reglas. Este prototipo no agrega aprobaciones reales al contrato.</p></details></section>
      <section class="review-block"><span class="eyebrow">02 / IMÁGENES</span><h2>Conservar evidencia no da permiso para reutilizarla.</h2><p>Para una pieza con estas imágenes necesitamos una autorización. Mientras tanto, pueden servir como contexto de lectura.</p><fieldset><legend>Permiso en la demostración</legend>${[['pending','Dejarlas como referencia por ahora'],['demo-permitted','Simular permiso de uso de los ejemplos']].map(([value,label]) => `<label class="radio-line"><input type="radio" name="rights" value="${value}" ${state.rights === value ? 'checked' : ''}>${label}</label>`).join('')}</fieldset><p class="field-hint">Las imágenes son ilustraciones del prototipo. Esta selección no autoriza ninguna foto ni negocio real.</p></section></div><div class="report-next"><p>Las decisiones se guardan solo para el ejemplo. La ejecución aprobada sigue necesitando copy, permisos y una dirección seleccionada.</p><button class="primary" type="submit">Guardar y elegir una acción <span aria-hidden="true">→</span></button></div></form>`;
  }
  function actions() {
    const task = F.tasks.find(item => item.id === state.task);
    return `${head('UN CONTEXTO, VARIAS POSIBILIDADES', '¿Qué querés crear ahora?', 'Reutilizá esta lectura para distintas tareas. Elegir otra acción no vuelve a analizar el perfil.', back('Dossier', 'report'))}<div class="action-layout"><section class="task-list" aria-label="Acciones posibles">${F.tasks.map(item => `<button class="task-option" data-task="${item.id}" aria-pressed="${state.task === item.id}"><span aria-hidden="true">${item.number}</span><span><strong>${item.name}</strong><small>${item.description}</small></span><span aria-hidden="true">${state.task === item.id ? '✓' : '↗'}</span></button>`).join('')}</section><aside class="task-preview"><span class="eyebrow">EL SIGUIENTE PASO</span><h2>${task.name}</h2><p>${task.objective}</p><ul><li>Resumen de marca y evidencia</li><li>Imágenes y sus límites de uso</li><li>Reglas confirmadas separadas de propuestas</li><li>Preguntas y comprobaciones pendientes</li></ul>
      ${task.id === 'website-change' ? `<div class="notice"><strong>${state.site ? 'Carpeta de ejemplo vinculada' : 'Primero, el sitio existente'}</strong><p>${state.site ? 'Se simula acceso a tres archivos del sitio ficticio. No se abrió una carpeta real.' : 'El agente necesita acceso al código actual. Una landing desde cero es otra tarea.'}</p>${button(state.site ? 'Quitar carpeta de ejemplo' : 'Vincular carpeta ficticia', 'site', 'text-button')}</div>` : ''}
      ${state.status === 'stale' ? '<div class="notice"><strong>Revisá las fuentes nuevas primero.</strong><p>El dossier guardado ya no representa la muestra actual.</p></div>' : ''}
      <p><strong>Modo inicial: exploración.</strong> Los detalles creativos pueden ser propuestas; no se asumen decisiones de marca.</p>
      <button class="primary" data-action="handoff" ${state.status === 'stale' || task.id === 'website-change' && !state.site ? 'disabled aria-describedby="task-blocker"' : ''}>Preparar borrador de contexto <span aria-hidden="true">→</span></button>
      ${state.status === 'stale' || task.id === 'website-change' && !state.site ? `<p id="task-blocker" class="field-hint">${state.status === 'stale' ? 'Revisá la evidencia y la lectura antes de continuar.' : 'Falta vincular el contexto del sitio. Usá la carpeta ficticia para recorrer este escenario.'}</p>` : ''}
      </aside></div>`;
  }
  function handoff() {
    const task = F.tasks.find(item => item.id === state.task);
    const missing = ['Confirmar el texto y la acción de la pieza.', 'Seleccionar y revisar una dirección antes de ejecutar.', 'Revisar el render y la accesibilidad antes de publicar.'];
    if (state.rights === 'pending') missing.unshift('Confirmar permiso de reutilización de imágenes.');
    return `${head('DEL CONTEXTO AL TRABAJO', 'Una idea bien acompañada.', 'El agente recibe qué explorar, con qué material y qué decisiones siguen abiertas.', back('Acciones', 'actions'))}<div class="handoff-layout"><section class="folder-sheet"><div class="folder-title"><span class="folder-icon" aria-hidden="true">▱</span><div><h2>${task.name}</h2><p>Taller Nube · contexto ficticio</p></div></div><ul class="folder-list"><li><strong>Un punto de entrada</strong><small>Objetivo, alcance y lectura recomendada</small></li><li><strong>La marca, con matices</strong><small>Evidencia, inferencias y propuestas</small></li><li><strong>Los originales</strong><small>Referencias a ${F.assets.filter((_,i) => state.images[i] !== 'excluded').length} ilustraciones</small></li><li><strong>Qué queda abierto</strong><small>${missing.length} comprobaciones pendientes</small></li>${state.task === 'website-change' ? '<li><strong>El sitio existente</strong><small>Acceso ficticio, por revisar</small></li>' : ''}</ul><p class="file-example">Esta demo descarga un Markdown de ejemplo. No ejecuta el exportador real ni genera una carpeta de trabajo completa.</p>${button('Descargar ejemplo de contexto <span aria-hidden="true">↓</span>', 'download')}<details><summary>Cómo se conecta con la herramienta</summary><p class="field-hint">El exportador genérico ya usa START.md, BRIEF.md y un inventario de archivos. La integración de esta interfaz con ese núcleo está pendiente.</p></details></section><aside class="handoff-notes">${badge('Borrador para explorar', 'pending')}<h3>Lo que le pedimos al agente</h3><p>${task.objective} Que proponga elecciones creativas y explique su relación con la muestra.</p><h3>Lo que sigue por revisar</h3><ul>${missing.map(item => `<li>${item}</li>`).join('')}</ul><div class="notice"><strong>Explorar no es aprobar.</strong><p>Este borrador no habilita una ejecución confirmada ni una publicación. Tampoco selecciona un proveedor de diseño.</p></div>${button('Volver al dossier', 'report', 'text-button')}</aside></div>`;
  }
  function openSettings() {
    returnFocus = document.activeElement; document.querySelector('#settings-error').hidden = true;
    settings.showModal(); document.querySelector('#apify-key').focus();
  }
  function requestRun(reason = 'new') {
    runPhase = reason === 'retry' || reason === 'revised' ? 2 : 0;
    if (!state.configured) { pendingRun = true; openSettings(); return; }
    returnFocus = document.activeElement;
    document.querySelector('#run-reason').textContent = runPhase === 2 ? 'Se reutilizan la extracción y la evidencia guardadas. Solo repetimos la lectura y el dossier de ejemplo; no se reintenta nada automáticamente.' : 'Vamos a preparar el perfil y una primera lectura de la marca.';
    document.querySelector('#extraction-scope').textContent = runPhase === 2 ? 'Reutilizado · sin nueva extracción' : 'Perfil y hasta 20 publicaciones';
    runDialog.showModal();
  }
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (state.status !== 'running') return;
      state.phase++;
      if (state.phase === 2 && state.images.some(value => value === null)) state.status = 'review-required';
      if (state.phase >= 4) state.status = 'ready';
      save();
      if (state.view === 'progress') {
        const focusedAction = main.contains(document.activeElement) ? document.activeElement.dataset.action : null;
        render(false);
        if (focusedAction) main.querySelector(`[data-action="${focusedAction}"]`)?.focus();
      }
      else renderProjects();
      if (state.status === 'running') schedule();
      else announce(state.status === 'ready' ? 'El dossier de ejemplo está listo. Abrilo desde tu espacio.' : 'La evidencia de ejemplo necesita tu revisión.');
    }, 1200);
  }
  function start() {
    clearTimeout(timer); runDialog.close(); state.status = 'running'; state.phase = runPhase;
    if (runPhase === 0) state.images = [null,null,null];
    navigate('progress'); announce('Comenzó la simulación. No hay llamadas a servicios.'); schedule();
  }
  function openProject() {
    navigate(state.status === 'empty' ? 'home' : state.status === 'ready' ? 'report' : state.status === 'review-required' ? 'evidence' : 'progress');
  }
  function scenario(name) {
    clearTimeout(timer); state = M.initial();
    state.configured = name !== 'first';
    if (name === 'running') { state.status = 'running'; state.view = 'progress'; schedule(); }
    if (name === 'evidence') { state.status = 'review-required'; state.phase = 2; state.view = 'evidence'; }
    if (['cached','stale','failed','interrupted'].includes(name)) {
      state.status = { cached:'ready', stale:'stale', failed:'failed', interrupted:'interrupted' }[name];
      state.phase = name === 'cached' || name === 'stale' ? 4 : 2;
      state.images = ['brand-graphic','product-photo','product-photo'];
      state.view = name === 'cached' ? 'report' : 'progress';
    }
    document.querySelector('.scenarios').open = false;
    save(); render(true); announce(`Escenario: ${name === 'first' ? 'primera vez' : statuses[state.status]}.`);
  }
  function download() {
    const task = F.tasks.find(item => item.id === state.task);
    const text = `# Contexto de ejemplo — ${F.name}\n\nPrototipo de onboarding. Todo el contenido es ficticio. No es un design-brief/v1 validado ni autoriza publicación.\n\n## Tarea\n\n${task.label}: ${task.objective}\n\n## Marca\n\n${F.biography}\n\n## Evidencia e inferencias\n\n${F.signals.map(s => `- ${s.title} (${s.status}): ${s.text} Fuente ficticia: ${s.source}`).join('\n')}\n\n## Imágenes\n\n${F.assets.filter((_,i) => state.images[i] !== 'excluded').map(a => `- ${a.title}: ${a.alt}. Archivo local de la demo: ${a.file}.`).join('\n')}\n\n## Estado de revisión\n\nPaleta: ${state.palette}. Permisos: ${state.rights}. Son elecciones simuladas, no reglas confirmadas.\n\n## Pendiente\n\nConfirmar copy/acción, permisos reales, dirección seleccionada, render y accesibilidad. ${state.task === 'website-change' ? 'Verificar acceso y hashes del repositorio real antes de editar. La carpeta vinculada aquí es ficticia.' : ''}\n\nEste archivo es un ejemplo de lectura. Las imágenes no se incluyen en esta descarga; no es el handoff completo del exportador real.\n`;
    const url = URL.createObjectURL(new Blob([text], { type:'text/markdown;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'taller-nube-contexto-demo.md'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000); announce('Se descargó el Markdown de ejemplo. No contiene una aprobación de marca.');
  }
  document.addEventListener('click', event => {
    const control = event.target.closest('[data-action],[data-task],[data-scenario]'); if (!control) return;
    event.preventDefault();
    if (control.dataset.scenario) return scenario(control.dataset.scenario);
    if (control.dataset.task) { state.task = control.dataset.task; save(); render(false); main.querySelector(`[data-task="${state.task}"]`).focus(); return; }
    const action = control.dataset.action;
    if (action === 'home') return navigate('home');
    if (action === 'project') return openProject();
    if (action === 'settings') return openSettings();
    if (action === 'close-settings') return settings.close();
    if (action === 'fill-demo') { document.querySelector('#apify-key').value = 'demo-apify'; document.querySelector('#analysis-key').value = 'demo-openai'; return; }
    if (action === 'close-run') return runDialog.close();
    if (action === 'request-run') return requestRun('retry');
    if (action === 'confirm-run') return start();
    if (action === 'cached') return scenario('cached');
    if (action === 'site') { state.site = !state.site; save(); render(false); main.querySelector('[data-action="site"]').focus(); return; }
    if (action === 'resume') { state.status = 'running'; navigate('progress'); schedule(); return; }
    if (action === 'download') return download();
    if (['report','review','actions','evidence','handoff'].includes(action)) {
      if (action === 'handoff' && (state.status === 'stale' || state.task === 'website-change' && !state.site)) return;
      if (action === 'actions' && state.objective !== 'later') { state.task = state.objective; state.objective = 'later'; }
      navigate(action);
    }
  });
  document.addEventListener('change', event => {
    const input = event.target;
    if (input.matches('#evidence-form input[type="radio"]')) {
      state.images[Number(input.name.slice(-1))] = input.value; save();
    }
  });
  document.addEventListener('submit', event => {
    if (!['intake-form','settings-form','evidence-form','review-form'].includes(event.target.id)) return;
    event.preventDefault();
    if (event.target.id === 'intake-form') {
      const input = document.querySelector('#profile-url'), error = document.querySelector('#profile-error');
      if (!M.profile(input.value)) { error.hidden = false; error.textContent = 'Pegá el link de un perfil de Instagram, no una publicación ni otro sitio.'; input.setAttribute('aria-invalid','true'); input.focus(); return; }
      input.removeAttribute('aria-invalid'); error.hidden = true; state.objective = document.querySelector('#objective').value; save(); requestRun();
    }
    if (event.target.id === 'settings-form') {
      const apify = document.querySelector('#apify-key'), analysis = document.querySelector('#analysis-key'), error = document.querySelector('#settings-error');
      const invalid = [apify.value !== 'demo-apify', analysis.value !== 'demo-openai'];
      [apify,analysis].forEach((field,index) => field.setAttribute('aria-invalid', String(invalid[index])));
      if (invalid.some(Boolean)) { error.hidden = false; error.textContent = 'Usá demo-apify y demo-openai para esta demostración. No ingreses claves reales.'; [apify,analysis][invalid.indexOf(true)].focus(); return; }
      state.configured = true; save(); renderProjects(); settings.close(); announce('Configuración de ejemplo lista. No se guardó ninguna credencial.');
      if (pendingRun) { pendingRun = false; requestRun(); }
    }
    if (event.target.id === 'evidence-form') {
      const choices = [0,1,2].map(index => event.target.querySelector(`input[name="asset-${index}"]:checked`)?.value ?? null);
      const error = document.querySelector('#evidence-error');
      if (choices.some(value => value === null) || choices.every(value => value === 'excluded')) {
        error.hidden = false; error.textContent = choices.every(value => value === 'excluded') ? 'Conservá al menos una imagen para la lectura de ejemplo.' : 'Elegí una clasificación para las tres imágenes antes de continuar.';
        event.target.querySelectorAll('input[type="radio"]').forEach(input => input.setAttribute('aria-invalid', String(choices.every(value => value === 'excluded') || choices[Number(input.name.slice(-1))] === null)));
        event.target.querySelector(`input[name="asset-${Math.max(0,choices.indexOf(null))}"]`).focus(); return;
      }
      state.images = choices; save();
      if (['stale', 'failed'].includes(state.status)) return requestRun('revised');
      state.phase = 2; state.status = 'running'; navigate('progress'); schedule();
    }
    if (event.target.id === 'review-form') {
      state.palette = event.target.querySelector('input[name="palette"]:checked').value;
      state.rights = event.target.querySelector('input[name="rights"]:checked').value;
      save(); navigate('actions'); announce('Decisiones del ejemplo guardadas. La identidad sigue siendo provisional.');
    }
  });
  for (const dialog of [settings,runDialog]) dialog.addEventListener('close', () => {
    if (dialog === settings) { document.querySelector('#settings-form').reset(); document.querySelector('#settings-error').hidden = true; document.querySelectorAll('#settings-form [aria-invalid]').forEach(input => input.removeAttribute('aria-invalid')); if (!state.configured) pendingRun = false; }
    if (returnFocus?.isConnected && !settings.open && !runDialog.open) returnFocus.focus();
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') document.querySelector('.scenarios').open = false; });
  save(); render();
})();
