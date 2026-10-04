const { EventEmitter } = require('node:events');

class Supervisor extends EventEmitter {
  constructor(fork, { shutdownMs = 1500 } = {}) {
    super();
    this.fork = fork;
    this.shutdownMs = shutdownMs;
    this.child = null;
    this.closing = false;
    this.state = { status: 'starting', ticks: 0, checks: { core: false, sharp: false }, error: null };
  }
  snapshot() { return structuredClone(this.state); }
  publish() { this.emit('state', this.snapshot()); }
  boot() {
    if (this.child || this.closing) return;
    try { this.child = this.fork(); }
    catch { this.state.status = 'failed'; this.state.error = 'worker-start'; this.publish(); return; }
    const child = this.child;
    child.on('message', message => {
      if (this.closing || this.child !== child || !message || typeof message !== 'object') return;
      if (message.type === 'ready' && this.state.status === 'starting' && message.core === true && message.sharp === true) {
        this.state = { status: 'idle', ticks: 0, checks: { core: true, sharp: true }, error: null };
      } else if (message.type === 'tick' && this.state.status === 'running'
        && Number.isInteger(message.value) && message.value === this.state.ticks + 1 && message.value <= 20) {
        this.state.ticks = message.value;
      } else if (message.type === 'complete' && this.state.status === 'running' && this.state.ticks === 20) {
        this.state.status = 'completed';
      } else if (message.type === 'failure') {
        this.state.status = 'failed'; this.state.error = 'core-check';
      } else return;
      this.publish();
    });
    child.once('exit', () => {
      if (this.child !== child) return;
      this.child = null;
      if (!this.closing) { this.state.status = 'interrupted'; this.state.error = 'worker-exit'; this.publish(); }
    });
  }
  start() {
    if (this.closing || !this.child || !['idle', 'completed'].includes(this.state.status)) return false;
    this.state.status = 'running'; this.state.ticks = 0; this.state.error = null;
    try { this.child.postMessage({ action: 'start-check' }); }
    catch { this.state.status = 'interrupted'; this.state.error = 'worker-exit'; this.publish(); return false; }
    this.publish();
    return true;
  }
  shutdown() {
    if (this.shutdownPromise) return this.shutdownPromise;
    this.closing = true;
    this.state.status = 'stopping'; this.publish();
    const child = this.child;
    this.shutdownPromise = new Promise(resolve => {
      if (!child) { resolve(); return; }
      const timer = setTimeout(() => { child.kill(); }, this.shutdownMs);
      // A second deadline prevents a hung child from keeping the local app alive indefinitely.
      const deadline = setTimeout(resolve, this.shutdownMs + 1000);
      child.once('exit', () => { clearTimeout(timer); clearTimeout(deadline); resolve(); });
      try { child.postMessage({ action: 'shutdown' }); } catch { child.kill(); }
    });
    return this.shutdownPromise;
  }
}

module.exports = { Supervisor };
