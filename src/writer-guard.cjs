// Portable Node >=20 interlock for app-managed projects. No SQLite dependency in the CLI.
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
function busy() { const error = new Error('Project writer unavailable. Close the active writer or explicitly repair its retained lock; never remove a live lock.'); error.code = 'writer-busy'; throw error; }
function canonical(target) {
  let cursor = path.resolve(target);
  while (!fs.existsSync(cursor)) { const parent = path.dirname(cursor); if (parent === cursor) busy(); cursor = parent; }
  const root = fs.realpathSync.native(cursor);
  // Reject aliases, including linked ancestors; do not lock a different lexical identity.
  const normalized = value => process.platform === 'win32' ? value.toLowerCase() : value;
  if (normalized(root) !== normalized(cursor)) busy();
  while (path.dirname(cursor) !== cursor) {
    if (fs.lstatSync(cursor).isSymbolicLink()) busy(); cursor = path.dirname(cursor);
  }
  return path.resolve(target);
}
function managedRoot(target) {
  let current = canonical(target);
  for (;;) {
    const file = path.join(current, 'project.json');
    if (fs.existsSync(file)) {
      if (fs.lstatSync(file).isSymbolicLink()) busy();
      let record;
      try { record = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { busy(); }
      if (record.version === 1 && typeof record.id === 'string' && uuid.test(record.id) && path.basename(current) === record.id) return current;
    }
    const parent = path.dirname(current); if (parent === current) return null; current = parent;
  }
}
function readOwner(root) {
  const directory = path.join(canonical(root), '.writer-guard');
  if (!fs.existsSync(directory)) return null;
  canonical(directory);
  if (!fs.lstatSync(directory).isDirectory()) busy();
  const entries = fs.readdirSync(directory);
  if (entries.length !== 1 || entries[0] !== 'owner.json') busy();
  const file = path.join(directory, 'owner.json'); canonical(file);
  if (!fs.existsSync(file) || fs.lstatSync(file).isSymbolicLink() || fs.lstatSync(file).nlink > 1) busy();
  let owner;
  try { owner = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { busy(); }
  if (owner?.version !== 1 || !['app', 'cli', 'workspace'].includes(owner.type) || typeof owner.token !== 'string' || !uuid.test(owner.token)) busy();
  return owner;
}
function claim(root, owner) {
  canonical(root); const directory = path.join(root, '.writer-guard');
  try { fs.mkdirSync(directory); } catch { busy(); }
  // An incomplete marker is retained, never guessed stale from PID/time.
  const fd = fs.openSync(path.join(directory, 'owner.json'), 'wx');
  try { fs.writeFileSync(fd, JSON.stringify(owner)); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}
function release(root, token) {
  const owner = readOwner(root); if (!owner || owner.token !== token) busy();
  const directory = path.join(root, '.writer-guard');
  if (fs.readdirSync(directory).length !== 1) busy();
  fs.unlinkSync(path.join(directory, 'owner.json')); fs.rmdirSync(directory);
}
function acquireCliWriters(targets) {
  const roots = [...new Set(targets.filter(value => typeof value === 'string' && value && !value.startsWith('--')).map(managedRoot).filter(Boolean))].sort();
  const held = [], token = randomUUID();
  try { for (const root of roots) { claim(root, { version: 1, type: 'cli', token }); held.push(root); } }
  catch (error) { for (const root of held.reverse()) release(root, token); throw error; }
  return () => { while (held.length) release(held.pop(), token); };
}
module.exports = { acquireCliWriters, managedRoot, readOwner, claim, release, canonical };
