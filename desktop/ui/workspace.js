(() => {
  const $ = id => document.getElementById(id), api = window.localWorkspace;
  const messages = {
    'invalid-name': 'Ingresá un nombre de hasta 80 caracteres.', 'invalid-profile': 'Usá el enlace HTTPS de un perfil de Instagram, sin parámetros.',
    'profile-mismatch': 'El enlace no coincide con el perfil del original. Corregilo y elegí otra vez la carpeta.',
    'invalid-key': 'Ingresá una clave de 8 a 4096 caracteres, sin espacios.',
    'protection-unavailable': 'Windows no ofrece almacenamiento protegido. No se guardó la clave. Reiniciá la app en una sesión de Windows compatible.',
    'credential-unreadable': 'No se pudo abrir la clave protegida. Reemplazala desde Configuración.',
    'registry-unreadable': 'No se pudo leer el registro. Tus archivos se conservan. Cerrá la app y revisá el registro local antes de reintentar.',
    'project-unavailable': 'El proyecto no está disponible o cambió fuera de la app. Recuperá su carpeta y elegí Actualizar.',
    'unsafe-path': 'La carpeta contiene enlaces, alias o una ubicación no permitida. Elegí una carpeta local sin enlaces.',
    'unsafe-file': 'Hay archivos no admitidos. Elegí solo la carpeta del perfil, sin claves, configuración, archivos ocultos ni ZIP.',
    'duplicate-path': 'Hay nombres de archivo que Windows considera iguales. Corregí la copia de origen y volvé a seleccionarla.',
    'import-too-large': 'La carpeta supera el límite: 2000 archivos, 32 MB por archivo o 256 MB en total.',
    'empty-import': 'La carpeta no contiene archivos para importar.', 'import-expired': 'La selección venció. Elegí otra vez la carpeta.',
    'source-changed': 'El original cambió durante la importación. No se guardó el proyecto. Elegí nuevamente la carpeta.',
    'writer-busy': 'El proyecto está en uso o conserva un bloqueo. Terminá el trabajo activo antes de moverlo o copiarlo. No borres un bloqueo activo.',
    'writer-fenced': 'Cambió quién controla el proyecto. Cerrá la app y revisá el bloqueo local antes de continuar.',
    'storage-unavailable': 'No se pudo guardar o leer. Tus proyectos existentes se conservan. Revisá espacio y permisos y reintentá.',
    'invalid-request': 'La acción no está disponible. Cerrá y volvé a abrir la ventana.', 'request-unavailable': 'Volvé a abrir la ventana para continuar.'
  };
  let preview = null, saved = null, busy = false, lastErrorCode = null;
  function error(id, result) { lastErrorCode = result.code; $(id).hidden = false; $(id).textContent = messages[result.code] || messages['storage-unavailable']; }
  function clear(id) { $(id).hidden = true; $(id).textContent = ''; }
  function renderWorkspace(state) {
    const focused = document.activeElement.id;
    $('projects').replaceChildren();
    for (const item of state.projects) {
      const li = document.createElement('li'), title = document.createElement('strong'), status = document.createElement('span'), actions = document.createElement('div');
      title.textContent = item.name; status.textContent = item.status === 'trash' ? 'En papelera' : state.active === item.id ? 'Abierto' : 'Guardado';
      actions.className = 'actions';
      const add = (text, operation, suffix) => {
        const button = document.createElement('button'); button.type = 'button'; button.textContent = text;
        button.id = `project-${item.id}-${suffix}`; button.setAttribute('aria-label', `${text}: ${item.name}`);
        button.addEventListener('click', () => run(operation)); actions.append(button);
      };
      if (item.status === 'trash') add('Restaurar', () => api.restore(item.id), 'restore');
      else { add('Abrir', () => api.open(item.id), 'open'); add('Copiar respaldo', () => api.exportBackup(item.id), 'export'); add('Papelera', () => api.trash(item.id), 'trash'); }
      li.append(title, status, actions); $('projects').append(li);
    }
    $('workspace-status').textContent = state.projects.length ? `${state.projects.filter(item => item.status === 'active').length} proyectos guardados.` : 'No hay proyectos guardados.';
    $('project-next').textContent = state.active ? 'Proyecto abierto. El análisis y el informe se conectarán en el siguiente paso.' : 'Guardar un proyecto no inicia un análisis ni usa APIs.';
    const next = document.getElementById(focused);
    if (next) next.focus(); else if (focused.startsWith('project-')) $('reload-projects').focus();
  }
  async function run(operation, errorId = 'workspace-error') {
    if (busy) return null;
    busy = true; clear(errorId); $('main').setAttribute('aria-busy', 'true');
    try {
      const result = await operation();
      if (!result.ok) { error(errorId, result); return null; }
      if (result.workspace) renderWorkspace(result.workspace);
      if (result.exported) $('workspace-status').textContent = `Respaldo copiado: ${result.exported.files} archivos.`;
      return result;
    } catch { error(errorId, { code: 'storage-unavailable' }); return null; }
    finally { busy = false; $('main').removeAttribute('aria-busy'); }
  }
  function openProject(imported = null) {
    preview = imported; $('project-form').reset(); clear('project-error');
    $('project-name').removeAttribute('aria-invalid'); $('project-url').removeAttribute('aria-invalid');
    $('project-title').textContent = imported ? 'Importar copia' : 'Nuevo proyecto';
    $('save-project').textContent = imported ? 'Copiar e importar' : 'Crear';
    $('import-preview').hidden = !imported;
    $('import-preview').textContent = imported ? `${imported.files} archivos · ${(imported.bytes / 1048576).toFixed(1)} MB. El original se conserva.` : '';
    $('location-label').hidden = Boolean(imported); $('project-location').hidden = Boolean(imported);
    $('project-dialog').showModal();
  }
  function credentialView() {
    if (!saved) return;
    $('protection').textContent = saved.available ? 'Protección de Windows disponible.' : messages['protection-unavailable'];
    const configured = saved.providers[$('provider').value];
    $('credential-state').textContent = configured ? 'Clave configurada. Podés reemplazarla.' : 'Sin clave configurada.';
    $('save-credential').disabled = !saved.available; $('credential-key').disabled = !saved.available; $('remove-credential').disabled = !configured;
  }
  if (!api) { for (const id of ['settings', 'new-project', 'import-project', 'reload-projects']) $(id).disabled = true; return; }
  $('new-project').addEventListener('click', () => openProject());
  $('import-project').addEventListener('click', async () => { const result = await run(api.pickImport); if (result?.preview) openProject(result.preview); });
  $('reload-projects').addEventListener('click', () => run(api.list));
  $('cancel-project').addEventListener('click', () => $('project-dialog').close());
  $('project-dialog').addEventListener('close', () => { if (preview) { void api.cancelImport(); $('import-project').focus(); } else $('new-project').focus(); preview = null; });
  $('project-form').addEventListener('submit', async event => {
    event.preventDefault();
    const result = await run(() => preview ? api.importCopy($('project-name').value, $('project-url').value, preview.token) : api.create($('project-name').value, $('project-url').value, $('project-location').value), 'project-error');
    if (result && !result.canceled) $('project-dialog').close();
    else if (!result) {
      const field = ['invalid-profile', 'profile-mismatch'].includes(lastErrorCode) ? $('project-url') : lastErrorCode === 'invalid-name' ? $('project-name') : null;
      if (field) { field.setAttribute('aria-invalid', 'true'); field.focus(); }
      else { $('project-error').tabIndex = -1; $('project-error').focus(); }
    }
  });
  $('settings').addEventListener('click', async () => {
    $('credential-form').reset(); clear('credential-error'); $('credential-key').removeAttribute('aria-invalid');
    $('settings-dialog').showModal(); $('provider').focus();
    const result = await run(api.credentialStatus, 'credential-error'); if (result) { saved = result.credentials; credentialView(); }
  });
  $('close-settings').addEventListener('click', () => $('settings-dialog').close());
  $('settings-dialog').addEventListener('close', () => { $('credential-key').value = ''; $('settings').focus(); });
  $('provider').addEventListener('change', () => { $('credential-key').value = ''; clear('credential-error'); credentialView(); });
  $('credential-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (busy) { $('credential-key').value = ''; return; }
    // The new input crosses the bridge once; no saved key, browser persistence or reveal action.
    const pending = api.saveCredential($('provider').value, $('credential-key').value); $('credential-key').value = '';
    const result = await run(() => pending, 'credential-error');
    if (result) { saved = result.credentials; credentialView(); $('credential-key').removeAttribute('aria-invalid'); $('credential-state').textContent = 'Clave guardada. No se hizo ninguna llamada al proveedor.'; }
    else { $('credential-key').setAttribute('aria-invalid', 'true'); $('credential-key').focus(); }
  });
  $('remove-credential').addEventListener('click', async () => { const result = await run(() => api.removeCredential($('provider').value), 'credential-error'); if (result) { saved = result.credentials; credentialView(); $('provider').focus(); } });
  run(api.list);
})();
