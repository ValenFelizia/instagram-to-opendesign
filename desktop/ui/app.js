const stateText = { starting: 'Preparando el proceso local…', idle: 'Listo para la prueba.', running: 'Prueba en curso.', completed: 'Prueba terminada.', interrupted: 'El proceso se interrumpió. Cerrá la app y volvé a abrirla.', failed: 'No se pudo preparar la prueba local.', stopping: 'Cerrando la app…' };
const $ = id => document.getElementById(id);
let previous = '';
function render(state) {
  if (!state || !Object.hasOwn(stateText, state.status)) return;
  if (previous !== state.status) { $('status').textContent = stateText[state.status]; previous = state.status; }
  $('core').textContent = state.checks.core ? 'Disponible' : 'Pendiente';
  $('sharp').textContent = state.checks.sharp ? 'Disponible' : 'Pendiente';
  $('start').disabled = !['idle', 'completed'].includes(state.status);
  $('ticks').textContent = `${state.ticks} pasos locales`;
  $('error').hidden = !state.error;
  $('error').textContent = state.error ? 'Reabrí la app para repetir la comprobación. No se hizo ningún pedido a proveedores.' : '';
}
async function request(operation) {
  try {
    const result = await operation();
    if (result.state) render(result.state);
    if (!result.ok) throw new Error('Unavailable');
  } catch { $('error').hidden = false; $('error').textContent = 'No se pudo completar la acción. Volvé a abrir la ventana.'; }
}
if (window.appShell) {
  window.appShell.onState(render);
  window.appShell.onClosing(() => { if (!$('close-dialog').open) $('close-dialog').showModal(); });
  $('start').addEventListener('click', () => request(window.appShell.startCheck));
  $('exit').addEventListener('click', () => request(window.appShell.exit));
  $('keep-open').addEventListener('click', () => $('close-dialog').close());
  $('close-dialog').addEventListener('close', () => $('exit').focus());
  $('confirm-close').addEventListener('click', () => window.appShell.confirmClose());
  request(window.appShell.status);
} else {
  $('status').textContent = 'Abrí esta pantalla desde la app instalada.';
  $('exit').disabled = true;
}
