const CHANNEL = 'app-shell:request';
const UPDATES = 'app-shell:state';
const ACTIONS = new Set(['status', 'start-check', 'exit']);

function validRequest(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === 1 && Object.keys(value)[0] === 'action' && ACTIONS.has(value.action);
}

function trustedSender(event, window, documentUrl) {
  return Boolean(window && !window.isDestroyed()
    && event.sender === window.webContents
    && event.senderFrame === window.webContents.mainFrame
    && event.senderFrame.url.split('#')[0] === documentUrl);
}

function workerEnvironment(env) {
  // Do not pass provider keys, NODE_OPTIONS or arbitrary parent environment to the worker.
  return Object.fromEntries(['SystemRoot', 'WINDIR', 'TEMP', 'TMP'].filter(key => env[key]).map(key => [key, env[key]]));
}

module.exports = { CHANNEL, UPDATES, validRequest, trustedSender, workerEnvironment };
