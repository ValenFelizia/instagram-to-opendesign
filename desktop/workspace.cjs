const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { fail, UUID, checked, inside, ensureDirectory, inventory, fingerprint, copyInventory, removeOwned, atomicJson } = require('./paths.cjs');
function label(value) { if (typeof value !== 'string' || value.trim().length < 1 || value.length > 80 || /[\x00-\x1f]/.test(value)) fail('invalid-name'); return value.trim(); }
function profile(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    const match = url.pathname.match(/^\/([a-zA-Z0-9._]{1,30})\/?$/);
    if (url.protocol !== 'https:' || !['instagram.com', 'www.instagram.com'].includes(url.hostname) || url.username || url.password || url.port || url.search || url.hash || !match || ['p', 'reel', 'reels', 'stories', 'explore'].includes(match[1].toLowerCase())) fail('invalid-profile');
    return match[1].toLowerCase();
  } catch { fail('invalid-profile'); }
}
class Workspace {
  constructor(root, { write = atomicJson } = {}) { this.root = path.resolve(root); this.write = write; this.active = null; this.pending = null; this.tail = Promise.resolve(); }
  serial(operation) { const result = this.tail.then(operation); this.tail = result.catch(() => {}); return result; }
  registry() {
    ensureDirectory(this.root);
    const file = path.join(this.root, 'registry.json');
    if (!fs.existsSync(file)) return { version: 1, projects: [] };
    checked(file);
    let record;
    try { record = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { fail('registry-unreadable'); }
    if (record?.version !== 1 || !Array.isArray(record.projects) || record.projects.length > 1000) fail('registry-unreadable');
    const ids = new Set(), roots = new Set();
    for (const item of record.projects) {
      if (typeof item?.id !== 'string' || !UUID.test(item.id) || typeof item.path !== 'string' || !path.isAbsolute(item.path) || path.resolve(item.path) !== item.path || !['active', 'trash'].includes(item.status)) fail('registry-unreadable');
      label(item.name);
      const resolved = path.resolve(item.path).toLowerCase();
      if (ids.has(item.id) || roots.has(resolved) || [...roots].some(root => inside(root, resolved) || inside(resolved, root))) fail('registry-unreadable'); ids.add(item.id); roots.add(resolved);
    }
    return record;
  }
  commit(record) { this.write(path.join(this.root, 'registry.json'), record); }
  view(record = this.registry()) {
    return { projects: record.projects.map(({ id, name, status }) => ({ id, name, status })), active: this.active };
  }
  project(id, expectedStatus = 'active') {
    if (typeof id !== 'string' || !UUID.test(id)) fail('invalid-request');
    const record = this.registry(), item = record.projects.find(item => item.id === id && item.status === expectedStatus);
    if (!item) fail('project-unavailable');
    const directory = checked(item.path);
    // Both the registry and the on-disk identity must agree. Never adopt arbitrary folders.
    if (path.basename(directory) !== id || inside(directory, this.root) || directory === this.root) fail('unsafe-path');
    const file = path.join(directory, 'project.json'); checked(file);
    let metadata;
    try { metadata = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { fail('project-unavailable'); }
    if (metadata.version !== 1 || metadata.id !== id || metadata.name !== item.name) fail('project-unavailable');
    return { record, item, directory, metadata };
  }
  previewImport(source) {
    this.pending = null;
    const original = checked(source), tree = inventory(original, { imports: true });
    if (!tree.files.length) fail('empty-import');
    if (inside(original, this.root) || inside(this.root, original) || original === this.root) fail('unsafe-path');
    const token = crypto.randomUUID();
    let sourceProfile = null;
    const normalized = path.join(original, 'instagram-source.json');
    if (fs.existsSync(normalized)) {
      checked(normalized);
      try {
        const record = JSON.parse(fs.readFileSync(normalized, 'utf8'));
        if (record.schemaVersion === 'instagram-source/v1' && /^[a-zA-Z0-9._]{1,30}$/.test(record.profile?.username)) sourceProfile = record.profile.username.toLowerCase();
      } catch { /* Retain opaque legacy bytes; schema validation belongs to stage integration. */ }
    }
    this.pending = { token, original, tree, sourceProfile, expires: Date.now() + 10 * 60 * 1000 };
    return { token, files: tree.files.length, bytes: tree.total };
  }
  create(name, url, parent = path.join(this.root, 'projects'), importToken = null) {
    name = label(name); let handle = profile(url); const record = this.registry();
    let pending;
    if (importToken) {
      pending = this.pending; this.pending = null;
      if (!pending || pending.token !== importToken || pending.expires < Date.now()) fail('import-expired');
      if (fingerprint(inventory(pending.original, { imports: true })) !== fingerprint(pending.tree)) fail('source-changed');
      if (pending.sourceProfile && handle && pending.sourceProfile !== handle) fail('profile-mismatch');
      handle ||= pending.sourceProfile;
    }
    if (record.projects.length >= 1000) fail('project-unavailable');
    if (pending && (parent === pending.original || inside(pending.original, parent) || inside(parent, pending.original))) fail('unsafe-path');
    const id = crypto.randomUUID(), destination = path.join(parent, id);
    if (record.projects.some(item => inside(item.path, destination) || inside(destination, item.path))) fail('unsafe-path');
    ensureDirectory(parent); checked(parent);
    ensureDirectory(destination);
    try {
      const data = path.join(destination, 'data', handle || 'imported');
      ensureDirectory(data);
      if (pending) copyInventory(pending.original, data, pending.tree);
      atomicJson(path.join(destination, 'project.json'), { version: 1, id, name, profile: handle, createdAt: new Date().toISOString() });
      record.projects.push({ id, name, path: destination, status: 'active' });
      this.commit(record); this.active = id;
      return this.view(record);
    } catch (error) { removeOwned(parent, destination); throw error; }
  }
  open(id) { this.project(id); this.active = id; return this.view(); }
  export(id, scope, parent) {
    if (scope !== 'project-backup') fail('invalid-request');
    const { directory } = this.project(id);
    checked(parent);
    if (parent === directory || inside(directory, parent) || parent === this.root || inside(this.root, parent)) fail('unsafe-path');
    const tree = inventory(directory), destination = path.join(parent, `backup-${id}-${crypto.randomUUID()}`);
    ensureDirectory(destination);
    try { copyInventory(directory, destination, tree); } catch (error) { removeOwned(parent, destination); throw error; }
    return { files: tree.files.length };
  }
  trash(id, scope) {
    if (scope !== 'project') fail('invalid-request');
    const { record, item, directory } = this.project(id);
    inventory(directory); // Refuse links, secret-like filenames and unsupported content before moving.
    const trash = path.join(path.dirname(directory), 'trash'); ensureDirectory(trash);
    const destination = path.join(trash, id);
    if (fs.existsSync(destination)) fail('project-unavailable');
    checked(directory); checked(trash); fs.renameSync(directory, destination);
    item.path = destination; item.status = 'trash';
    try { this.commit(record); } catch (error) { checked(destination); checked(path.dirname(directory)); fs.renameSync(destination, directory); throw error; }
    if (this.active === id) this.active = null;
    return this.view(record);
  }
  restore(id) {
    const { record, item, directory } = this.project(id, 'trash');
    inventory(directory);
    if (path.basename(path.dirname(directory)) !== 'trash') fail('unsafe-path');
    const parent = path.dirname(path.dirname(directory)); checked(parent);
    const destination = path.join(parent, id);
    if (fs.existsSync(destination)) fail('project-unavailable');
    fs.renameSync(directory, destination); item.path = destination; item.status = 'active';
    try { this.commit(record); } catch (error) { checked(destination); checked(path.dirname(directory)); fs.renameSync(destination, directory); throw error; }
    return this.view(record);
  }
}
module.exports = { Workspace, profile, label };
