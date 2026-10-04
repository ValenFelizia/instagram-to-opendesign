const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

class BrokerError extends Error { constructor(code) { super(code); this.code = code; } }
function fail(code) { throw new BrokerError(code); }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const compare = value => process.platform === 'win32' ? value.toLowerCase() : value;
function inside(root, target) {
  const relative = path.relative(compare(root), compare(target));
  return relative !== '' && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative);
}
function safeName(name) {
  return typeof name === 'string' && name.length > 0 && name.length <= 180
    && !/[<>:"/\\|?*\x00-\x1f]/.test(name) && !/[. ]$/.test(name)
    && !['.', '..'].includes(name) && !/^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(name);
}
// Reject every linked ancestor, not only a leaf that looks contained lexically.
function checked(target) {
  if (typeof target !== 'string' || !path.isAbsolute(target) || /^\\\\/.test(target)) fail('unsafe-path');
  const absolute = path.resolve(target);
  let cursor = path.parse(absolute).root;
  for (const part of absolute.slice(cursor.length).split(path.sep).filter(Boolean)) {
    if (!safeName(part)) fail('unsafe-path');
    cursor = path.join(cursor, part);
    const stat = fs.lstatSync(cursor);
    if (stat.isSymbolicLink() || stat.nlink > 1 && stat.isFile()) fail('unsafe-path');
    if (compare(fs.realpathSync.native(cursor)) !== compare(cursor)) fail('unsafe-path');
  }
  return absolute;
}
function ensureDirectory(target) {
  const parent = path.dirname(target);
  if (parent !== target && !fs.existsSync(parent)) ensureDirectory(parent);
  checked(parent);
  if (!fs.existsSync(target)) fs.mkdirSync(target);
  checked(target);
  if (!fs.statSync(target).isDirectory()) fail('unsafe-path');
  return target;
}
const extensions = new Set(['.json', '.html', '.css', '.md', '.txt', '.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg', '.avif', '.tif', '.tiff', '.woff', '.woff2', '.ttf', '.otf', '.pdf', '.mp4', '.mov', '.webm']);
function inventory(root, { imports = false, guardToken = null } = {}) {
  checked(root);
  const files = [], directories = [], aliases = new Set();
  let total = 0;
  function walk(folder, depth = 0) {
    if (depth > 40) fail('import-too-large');
    checked(folder);
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      if (depth === 0 && entry.name === '.writer-guard' && guardToken) {
        if (require('../src/writer-guard.cjs').readOwner(root)?.token !== guardToken) fail('writer-fenced');
        continue;
      }
      if (!safeName(entry.name) || entry.name.startsWith('.') || /^(credentials?|settings)(\.|$)/i.test(entry.name)) fail('unsafe-file');
      const full = path.join(folder, entry.name), relative = path.relative(root, full);
      const alias = relative.toLowerCase();
      if (aliases.has(alias)) fail('duplicate-path');
      aliases.add(alias);
      if (aliases.size > 4000) fail('import-too-large');
      const stat = fs.lstatSync(full);
      checked(full);
      if (stat.isDirectory()) { directories.push(relative); walk(full, depth + 1); }
      else {
        if (!stat.isFile() || !extensions.has(path.extname(entry.name).toLowerCase()) || imports && relative === 'project.json') fail('unsafe-file');
        total += stat.size;
        if (stat.size > 32 * 1024 * 1024 || total > 256 * 1024 * 1024 || files.length >= 2000 || aliases.size > 4000) fail('import-too-large');
        const hash = crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex');
        files.push({ relative, size: stat.size, hash });
      }
    }
  }
  walk(root);
  return { files: files.sort((a, b) => a.relative.localeCompare(b.relative)), directories: directories.sort(), total };
}
function fingerprint(value) { return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function copyInventory(source, destination, expected, options = {}) {
  if (fingerprint(inventory(source, options)) !== fingerprint(expected)) fail('source-changed');
  ensureDirectory(destination);
  for (const relative of expected.directories) ensureDirectory(path.join(destination, relative));
  for (const file of expected.files) {
    const from = path.join(source, file.relative), to = path.join(destination, file.relative);
    checked(from); checked(path.dirname(to));
    if (!inside(destination, to)) fail('unsafe-path');
    const bytes = fs.readFileSync(from);
    if (crypto.createHash('sha256').update(bytes).digest('hex') !== file.hash) fail('source-changed');
    fs.writeFileSync(to, bytes, { flag: 'wx' });
  }
  if (fingerprint(inventory(source, options)) !== fingerprint(expected) || fingerprint(inventory(destination)) !== fingerprint(expected)) fail('source-changed');
}
// Never call recursive rm on a selected directory. Remove only a checked owned tree.
function removeOwned(root, target) {
  checked(root); checked(target);
  if (!inside(root, target)) fail('unsafe-path');
  const tree = inventory(target);
  for (const file of tree.files) { const full = path.join(target, file.relative); checked(full); fs.unlinkSync(full); }
  for (const directory of tree.directories.sort((a, b) => b.split(path.sep).length - a.split(path.sep).length)) { const full = path.join(target, directory); checked(full); fs.rmdirSync(full); }
  checked(target); fs.rmdirSync(target);
}
function atomicJson(target, value) {
  checked(path.dirname(target));
  if (fs.existsSync(target)) checked(target);
  const temporary = path.join(path.dirname(target), `write-${crypto.randomUUID()}.json`);
  const fd = fs.openSync(temporary, 'wx');
  try { fs.writeFileSync(fd, JSON.stringify(value, null, 2)); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  try { fs.renameSync(temporary, target); } catch (error) { fs.unlinkSync(temporary); throw error; }
}
module.exports = { BrokerError, fail, UUID, inside, safeName, checked, ensureDirectory, inventory, fingerprint, copyInventory, removeOwned, atomicJson };
