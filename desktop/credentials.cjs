const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { fail, checked, ensureDirectory, atomicJson } = require('./paths.cjs');
const PROVIDERS = new Set(['apify', 'openai']);
class Credentials {
  constructor(root, storage, platform = process.platform) { this.root = root; this.storage = storage; this.platform = platform; }
  async available() { return this.platform === 'win32' && Boolean(await this.storage.isAsyncEncryptionAvailable()); }
  file(provider) { if (!PROVIDERS.has(provider)) fail('invalid-request'); return path.join(this.root, `${provider}.json`); }
  async status() {
    const available = await this.available();
    return { available, providers: Object.fromEntries([...PROVIDERS].map(provider => [provider, fs.existsSync(this.file(provider))])) };
  }
  async save(provider, key) {
    this.file(provider);
    if (typeof key !== 'string' || key.length < 8 || key.length > 4096 || /[\s\x00-\x1f]/.test(key)) fail('invalid-key');
    if (!await this.available()) fail('protection-unavailable');
    const encrypted = await this.storage.encryptStringAsync(key);
    if (!Buffer.isBuffer(encrypted) || !encrypted.length) fail('protection-unavailable');
    ensureDirectory(this.root);
    atomicJson(this.file(provider), { version: 1, encrypted: encrypted.toString('base64') });
    return this.status();
  }
  remove(provider) { const file = this.file(provider); if (fs.existsSync(file)) { checked(file); fs.unlinkSync(file); } }
  // Revision of the protected record, never of the plaintext key. No renderer accessor.
  revision(provider) {
    const file = this.file(provider);
    if (!fs.existsSync(file)) return crypto.createHash('sha256').update('unconfigured').digest('hex');
    checked(file);
    return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  }
  // Only a future privileged provider dispatcher may call this; never expose it over IPC.
  async withKey(provider, operation) {
    if (!await this.available()) fail('protection-unavailable');
    const file = this.file(provider); checked(file);
    try {
      const record = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (record.version !== 1 || typeof record.encrypted !== 'string') fail('credential-unreadable');
      const { result } = await this.storage.decryptStringAsync(Buffer.from(record.encrypted, 'base64'));
      return await operation(result);
    } catch { fail('credential-unreadable'); }
  }
}
module.exports = { Credentials, PROVIDERS };
