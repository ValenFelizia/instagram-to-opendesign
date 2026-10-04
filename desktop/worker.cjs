// This worker imports the real core and exercises native sharp using an in-memory pixel.
// It deliberately has no provider operation, project input, file output or recovery loop.
globalThis.fetch = async () => { throw new Error('Network is unavailable in the shell check'); };
let timer = null;
let ready = false;
process.parentPort.on('message', ({ data }) => {
  if (data?.action === 'shutdown') { clearInterval(timer); process.exit(0); }
  if (data?.action !== 'start-check' || !ready || timer) return;
  let ticks = 0;
  timer = setInterval(() => {
    process.parentPort.postMessage({ type: 'tick', value: ++ticks });
    if (ticks === 20) { clearInterval(timer); timer = null; process.parentPort.postMessage({ type: 'complete' }); }
  }, 500);
});

(async () => {
  try {
    const core = await import('../src/core.js');
    const { default: sharp } = await import('sharp');
    const image = await sharp({ create: { width: 1, height: 1, channels: 3, background: '#ffffff' } }).png().toBuffer();
    const metadata = await sharp(image).metadata();
    if (typeof core.prepareBrief !== 'function' || metadata.width !== 1 || metadata.format !== 'png') throw new Error('Invalid local imports');
    ready = true;
    process.parentPort.postMessage({ type: 'ready', core: true, sharp: true });
  } catch {
    // Raw loader errors may contain paths. The main process receives only an allowlisted code.
    process.parentPort.postMessage({ type: 'failure' });
  }
})();
