const { UUID, BrokerError, inside, checked, fail } = require('./paths.cjs');
const { PROVIDERS } = require('./credentials.cjs');
const BROKER = 'workspace:request';
const shapes = {
  list: [], create: ['name', 'url', 'location'], 'pick-import': [], 'cancel-import': [],
  import: ['name', 'url', 'token'], open: ['id'], export: ['id', 'scope'], trash: ['id', 'scope'], restore: ['id'],
  'credential-status': [], 'credential-save': ['provider', 'key'], 'credential-remove': ['provider']
};
function validWorkspaceRequest(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || typeof value.action !== 'string' || !Object.hasOwn(shapes, value.action)) return false;
  const keys = shapes[value.action];
  if (Object.keys(value).length !== keys.length + 1 || !keys.every(key => Object.hasOwn(value, key))) return false;
  if (keys.includes('id') && (typeof value.id !== 'string' || !UUID.test(value.id))) return false;
  if (keys.includes('token') && (typeof value.token !== 'string' || !UUID.test(value.token))) return false;
  if (keys.includes('name') && (typeof value.name !== 'string' || value.name.length > 80)) return false;
  if (keys.includes('url') && (typeof value.url !== 'string' || value.url.length > 200)) return false;
  if (keys.includes('location') && !['default', 'choose'].includes(value.location)) return false;
  if (keys.includes('provider') && !PROVIDERS.has(value.provider)) return false;
  if (keys.includes('key') && (typeof value.key !== 'string' || value.key.length > 4096)) return false;
  if (value.action === 'export' && value.scope !== 'project-backup' || value.action === 'trash' && value.scope !== 'project') return false;
  return true;
}
const codes = new Set(['invalid-request', 'invalid-name', 'invalid-profile', 'profile-mismatch', 'invalid-key', 'protection-unavailable', 'credential-unreadable', 'registry-unreadable', 'project-unavailable', 'unsafe-path', 'unsafe-file', 'duplicate-path', 'import-too-large', 'empty-import', 'import-expired', 'source-changed', 'writer-busy', 'writer-fenced', 'job-store-unavailable']);
function diagnostic(error, action) {
  // Never spread arbitrary exceptions, provider payloads, selected paths or keys into a response/log.
  return { ok: false, code: error instanceof BrokerError && codes.has(error.code) || error?.code === 'writer-busy' ? error.code : 'storage-unavailable', action: Object.hasOwn(shapes, action) ? action : 'unknown' };
}
class Broker {
  constructor(workspace, credentials, dialog, { window, authorized, forbidden = [], importForbidden = [] }) {
    Object.assign(this, { workspace, credentials, dialog, window, authorized, forbidden, importForbidden });
  }
  async pick(title, source = false) {
    const result = await this.dialog.showOpenDialog(this.window(), { title, properties: ['openDirectory', 'dontAddToRecent'] });
    if (!this.authorized()) fail('invalid-request');
    if (result.canceled) return null;
    if (result.filePaths.length !== 1) fail('unsafe-path');
    const selected = checked(result.filePaths[0]);
    if ((source ? this.importForbidden : this.forbidden).some(root => selected === root || inside(root, selected))) fail('unsafe-path');
    return selected;
  }
  async confirm(message, detail) {
    const result = await this.dialog.showMessageBox(this.window(), { type: 'question', message, detail, buttons: ['Cancelar', 'Continuar'], defaultId: 0, cancelId: 0, noLink: true });
    if (!this.authorized()) fail('invalid-request');
    return result.response === 1;
  }
  async handle(request) {
    if (!validWorkspaceRequest(request)) return diagnostic(new BrokerError('invalid-request'), 'unknown');
    return this.workspace.serial(async () => {
      try {
        if (!this.authorized()) fail('invalid-request');
        switch (request.action) {
          case 'list': return { ok: true, workspace: this.workspace.view() };
          case 'create': {
            const parent = request.location === 'choose' ? await this.pick('Carpeta para el nuevo proyecto · elegí un disco local sin sincronización') : undefined;
            if (parent === null) return { ok: true, canceled: true };
            return { ok: true, workspace: this.workspace.create(request.name, request.url, parent) };
          }
          case 'pick-import': {
            const source = await this.pick('Importar una carpeta de perfil del CLI · se copiará sin modificar el original', true);
            return source === null ? { ok: true, canceled: true } : { ok: true, preview: this.workspace.previewImport(source) };
          }
          case 'cancel-import': this.workspace.pending = null; return { ok: true };
          case 'import': return { ok: true, workspace: this.workspace.create(request.name, request.url, undefined, request.token) };
          case 'open': return { ok: true, workspace: this.workspace.open(request.id) };
          case 'export': {
            const { item } = this.workspace.project(request.id);
            if (!await this.confirm(`Copiar respaldo de «${item.name}»`, 'Incluye todos los archivos del proyecto: fotos, evidencia y resultados privados. No incluye claves ni configuración. La carpeta elegida puede sincronizarse si vos la configuraste así.')) return { ok: true, canceled: true };
            const parent = await this.pick('Destino del respaldo');
            return parent === null ? { ok: true, canceled: true } : { ok: true, exported: this.workspace.export(request.id, request.scope, parent) };
          }
          case 'trash': {
            const { item } = this.workspace.project(request.id);
            if (!await this.confirm(`Mover «${item.name}» a la papelera`, 'Se mueve solo la copia administrada por la app. Podés restaurarla. El original importado y los respaldos se conservan.')) return { ok: true, canceled: true };
            return { ok: true, workspace: this.workspace.trash(request.id, request.scope) };
          }
          case 'restore': return { ok: true, workspace: this.workspace.restore(request.id) };
          case 'credential-status': return { ok: true, credentials: await this.credentials.status() };
          case 'credential-save': return { ok: true, credentials: await this.credentials.save(request.provider, request.key) };
          case 'credential-remove': this.credentials.remove(request.provider); return { ok: true, credentials: await this.credentials.status() };
        }
      } catch (error) { return diagnostic(error, request.action); }
    });
  }
}
module.exports = { BROKER, Broker, validWorkspaceRequest, diagnostic };
